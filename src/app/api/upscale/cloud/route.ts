// ─── POST /api/upscale/cloud ─────────────────────────────────────
// "High Quality" branch of the hybrid upscaler.
//
// Backed by Replicate's `nightmareai/real-esrgan` (Real-ESRGAN, 4×).
// Pay-per-second on a T4 GPU — typically 3–10s per image, billing
// rounds to ~0.5–1.5 ¢ per upscale.  No monthly minimum.
//
// Wire:
//   Client → us:        multipart/form-data { file, scale?, face_enhance? }
//   us → Replicate:     JSON  { input: { image: dataUri, scale, face_enhance } }
//   Replicate → us:     prediction object (with output URL when ready)
//   us → Client:        JSON  { url, width?, height?, model, creditsRemaining }
//
// Env:
//   REPLICATE_API_TOKEN  required
//
// Hard timing notes: Vercel functions on Pro plans accept up to
// `maxDuration = 300` (5 min). Real-ESRGAN at 4× on a high-res
// photo can run 30–80 s GPU time; with cold-start overhead a tight
// 60 s budget made the function reliably time out before Replicate
// finished. We now ask Replicate to stream the prediction with
// `Prefer: wait=60` and fall back to polling for up to 200 s.

import { NextResponse } from "next/server";
import sharp from "sharp";
import { getSession } from "@/lib/session";
import { requireFeature } from "@/lib/tier-guard";
import {
  CREDIT_LIMITS,
  deductCredits,
  findKundeByKey,
  getCreditsState,
  getKundeProfile,
} from "@/lib/sheets";

// Erkennt Replicate/Real-ESRGAN-Fehler die auf Pixel-Overload zeigen.
function isPixelOverloadError(msg: string): boolean {
  const m = (msg || "").toLowerCase();
  return (
    m.includes("out of memory") ||
    m.includes("cuda out of memory") ||
    m.includes("oom") ||
    m.includes("too large") ||
    m.includes("too big") ||
    m.includes("exceed") ||
    m.includes("image size") ||
    m.includes("dimension") ||
    m.includes("memory")
  );
}

export const runtime = "nodejs";
export const maxDuration = 300;

const ALLOWED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
// Vercel's hard body cap is 4.5 MB; we cushion to 4.2 to leave room
// for multipart boundary + headers without Vercel chopping the body.
const MAX_FILE_SIZE = Math.floor(4.2 * 1024 * 1024);
const MODEL = "nightmareai/real-esrgan";
const PREDICTION_URL = `https://api.replicate.com/v1/models/${MODEL}/predictions`;
// Replicate caps `Prefer: wait` at 60 — anything higher is silently
// clamped. After the wait, we keep polling until the function deadline.
const WAIT_BUDGET_S = 60;
const POLL_DEADLINE_MS = 200_000;

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: string | string[] | null;
  error?: string | null;
  urls?: { get?: string; cancel?: string };
}

export async function POST(req: Request) {
  // 0) Auth + credit gate. Admins bypass the meter; anyone else must
  //    have at least UPSCALE_IMAGE credits before we even hit Replicate.
  const session = await getSession();
  const guard = await requireFeature(session, "upscale");
  if (!guard.ok) return guard.response;

  let kundeRowIndex: number | null = null;
  let kundeProfile: Awaited<ReturnType<typeof getKundeProfile>> | null = null;
  if (!session.isAdmin && session.lizenzschluessel) {
    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde) {
      return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });
    }
    kundeRowIndex = kunde.rowIndex;
    kundeProfile = await getKundeProfile(kunde.rowIndex);
    const credits = getCreditsState(kundeProfile);
    if (credits.balance < CREDIT_LIMITS.UPSCALE_IMAGE) {
      return NextResponse.json(
        {
          error: `Nicht genug Credits — Cloud-Upscale kostet ${CREDIT_LIMITS.UPSCALE_IMAGE}. Du hast ${credits.balance}.`,
          creditsRemaining: credits.balance,
        },
        { status: 402 },
      );
    }
  }

  // 1) Token check
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Upscaler ist nicht konfiguriert. Admin kontaktieren." },
      { status: 500 },
    );
  }

  // 2) Parse multipart body
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Konnte FormData nicht lesen." },
      { status: 400 },
    );
  }

  const fileEntry = formData.get("file");
  const scaleRaw = formData.get("scale");
  const faceEnhanceRaw = formData.get("face_enhance");

  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      { error: "Feld 'file' fehlt oder ist keine Datei." },
      { status: 400 },
    );
  }
  if (!ALLOWED_MIME.includes(fileEntry.type)) {
    return NextResponse.json(
      {
        error: `Format nicht unterstützt (${fileEntry.type}). Bitte JPG, PNG oder WebP.`,
      },
      { status: 400 },
    );
  }
  if (fileEntry.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        error: `Datei zu groß (${(fileEntry.size / 1024 / 1024).toFixed(
          1,
        )} MB). Max ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
      },
      { status: 413 },
    );
  }

  const scale = clamp(toNumber(scaleRaw, 4), 2, 4);
  const modeRaw = formData.get("mode");
  // Mode is the primary control. Legacy `face_enhance` form field is still
  // accepted for back-compat and overrides whatever the mode would imply.
  const mode = normaliseMode(typeof modeRaw === "string" ? modeRaw : null);
  const faceEnhance = faceEnhanceRaw !== null
    ? String(faceEnhanceRaw) === "true"
    : mode === "faces";

  // 3) File → Buffer. Wir downscalen evtl. progressiv falls Replicate
  //    "out of memory" returnt — daher arbeiten wir mit dem Buffer und
  //    bauen die data-URI erst pro Retry-Versuch.
  const originalBuffer = Buffer.from(await fileEntry.arrayBuffer());
  // Originaldimensionen ermitteln um initial sinnvoll zu starten.
  let origWidth = 0;
  let origHeight = 0;
  try {
    const meta = await sharp(originalBuffer).metadata();
    origWidth = meta.width || 0;
    origHeight = meta.height || 0;
  } catch {
    // metadata-Failure ist nicht tragisch — wir versuchen's mit Originalgroesse
  }
  console.log(`[upscale] input ${origWidth}x${origHeight} scale=${scale}`);

  // 4) Retry-Schleife mit progressivem Downscaling.
  //    Versuch 1: Original
  //    Versuch 2: 80% Dimension (= 64% Pixel)
  //    Versuch 3: 60% Dimension (= 36% Pixel)
  //    Danach Abbruch mit "zu viele Pixel"-Fehler.
  const PIXEL_RETRY_RATIOS = [1.0, 0.8, 0.6];
  let prediction: ReplicatePrediction | null = null;
  let lastErrorMsg = "";

  for (let attempt = 0; attempt < PIXEL_RETRY_RATIOS.length; attempt++) {
    const ratio = PIXEL_RETRY_RATIOS[attempt];
    // Buffer fuer diesen Versuch vorbereiten (nur downscalen, kein Re-encode bei 1.0).
    // `Buffer` weil sharp einen Standard-Buffer liefert; mit `as Buffer` casten
    // damit der TypeScript-Bucket-Type sich nicht verbeisst (Buffer<ArrayBufferLike>).
    let attemptBuffer: Buffer = originalBuffer;
    let attemptMime = fileEntry.type;
    if (ratio < 1.0 && origWidth > 0 && origHeight > 0) {
      const newW = Math.max(64, Math.round(origWidth * ratio));
      const newH = Math.max(64, Math.round(origHeight * ratio));
      try {
        const resized = await sharp(originalBuffer, { failOn: "none" })
          .rotate()
          .resize({ width: newW, height: newH, fit: "inside" })
          .jpeg({ quality: 92, mozjpeg: true })
          .toBuffer();
        attemptBuffer = resized as unknown as Buffer;
        attemptMime = "image/jpeg";
        console.log(`[upscale] retry ${attempt + 1} downscaled to ${newW}x${newH}`);
      } catch (e) {
        console.warn(`[upscale] downscale to ${newW}x${newH} failed:`, e);
      }
    }
    const dataUri = `data:${attemptMime};base64,${attemptBuffer.toString("base64")}`;

    // Replicate-Call
    let started: ReplicatePrediction | null = null;
    try {
      const res = await fetch(PREDICTION_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: `wait=${WAIT_BUDGET_S}`,
        },
        body: JSON.stringify({
          input: { image: dataUri, scale, face_enhance: faceEnhance },
        }),
      });
      const text = await res.text();
      let json: (ReplicatePrediction & { detail?: string }) | null = null;
      try {
        json = JSON.parse(text);
      } catch {
        console.error("[Replicate upscale] non-JSON body:", res.status, text.slice(0, 400));
        return NextResponse.json(
          { error: `Replicate antwortete unerwartet (Status ${res.status}).` },
          { status: 502 },
        );
      }
      if (!res.ok || !json) {
        const msg = json?.detail || json?.error || `HTTP ${res.status}`;
        lastErrorMsg = msg;
        // Fatale Errors die NIE durch Retry behoben werden — sofort abbrechen.
        if (res.status === 401 || res.status === 403) {
          return NextResponse.json({ error: "Upscaler-Zugang abgelehnt. Admin kontaktieren." }, { status: 502 });
        }
        if (res.status === 402) {
          return NextResponse.json({ error: "Upscaler-Quota erschöpft. Admin kontaktieren." }, { status: 502 });
        }
        if (res.status === 429) {
          return NextResponse.json({ error: "Zu viele Anfragen. Bitte 30 Sekunden warten und erneut versuchen." }, { status: 429 });
        }
        // 422 = Bild abgelehnt. Bei Pixel-Overload-Indikator -> nochmal mit kleinerer Aufloesung.
        if (res.status === 422) {
          if (isPixelOverloadError(msg)) {
            console.warn(`[upscale] attempt ${attempt + 1} rejected for pixel overload, retry with smaller image`);
            continue;
          }
          return NextResponse.json({ error: `Bild wurde abgelehnt: ${msg}` }, { status: 400 });
        }
        // Andere 5xx — beim ersten Mal nochmal probieren falls Pixel-Hint im Error
        if (isPixelOverloadError(msg)) {
          console.warn(`[upscale] attempt ${attempt + 1} pixel-related: ${msg.slice(0, 100)}`);
          continue;
        }
        return NextResponse.json({ error: `Verarbeitung fehlgeschlagen: ${msg}` }, { status: 502 });
      }
      started = json;
    } catch (err) {
      console.error("[Upscale] start failed:", err);
      return NextResponse.json(
        { error: err instanceof Error ? `Verbindung fehlgeschlagen: ${err.message}` : "Verbindung fehlgeschlagen." },
        { status: 502 },
      );
    }

    // Wenn nach Wait-Budget noch nicht fertig: pollen.
    let finished = started;
    if ((finished.status === "starting" || finished.status === "processing") && finished.urls?.get) {
      finished = await pollUntilDone(finished.urls.get, token, POLL_DEADLINE_MS);
    }

    // Schauen ob das Ergebnis ein Pixel-Overload war — dann naechster Retry.
    if (finished.status === "failed" || finished.status === "canceled") {
      const reason = finished.error || "Verarbeitung ist fehlgeschlagen.";
      lastErrorMsg = reason;
      if (isPixelOverloadError(reason)) {
        console.warn(`[upscale] attempt ${attempt + 1} failed with pixel-overload, will retry with smaller image`);
        continue;
      }
      // Anderer Fail-Grund — nicht durch Retry loesbar.
      return NextResponse.json({ error: reason }, { status: 502 });
    }
    if (finished.status !== "succeeded") {
      return NextResponse.json(
        { error: "Verarbeitung dauert ungewöhnlich lange (Timeout). Bitte erneut versuchen." },
        { status: 504 },
      );
    }
    prediction = finished;
    break; // Erfolg -> Schleife verlassen
  }

  // Alle Versuche failed -> "zu viele Pixel"-Antwort
  if (!prediction) {
    return NextResponse.json(
      {
        error:
          "Dieses Bild hat zu viele Pixel — der Upscaler hat es 3x mit verschiedenen Größen probiert und es passt nicht in den GPU-Speicher. " +
          "Bitte das Original kleiner machen (z.B. unter 2000×2000 px) und erneut versuchen.",
        attempts: PIXEL_RETRY_RATIOS.length,
        lastError: lastErrorMsg.slice(0, 200),
      },
      { status: 413 },
    );
  }

  if (prediction.status === "failed" || prediction.status === "canceled") {
    const reason = prediction.error || "Verarbeitung ist fehlgeschlagen.";
    return NextResponse.json({ error: reason }, { status: 502 });
  }
  if (prediction.status !== "succeeded") {
    return NextResponse.json(
      {
        error:
          "Verarbeitung dauert ungewöhnlich lange (Timeout). Bitte erneut versuchen.",
      },
      { status: 504 },
    );
  }

  const outputUrl = Array.isArray(prediction.output)
    ? prediction.output[0]
    : prediction.output;
  if (!outputUrl) {
    return NextResponse.json(
      { error: "Es kam kein Bild zurück. Bitte erneut versuchen." },
      { status: 502 },
    );
  }

  // Charge the credit. Admins skip the meter entirely; if the deduction
  // somehow fails (race, sheet timeout) we still return the upscale —
  // we'd rather under-bill than block a paying customer.
  let creditsRemaining: number | undefined;
  if (kundeRowIndex !== null && kundeProfile !== null) {
    try {
      const result = await deductCredits(
        kundeRowIndex,
        kundeProfile,
        CREDIT_LIMITS.UPSCALE_IMAGE,
      );
      if (result.success) creditsRemaining = result.remaining;
    } catch (err) {
      console.error("[Upscale cloud] credit deduction failed:", err);
    }
  }

  return NextResponse.json(
    { url: outputUrl, scale, mode, creditsRemaining },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

function normaliseMode(raw: string | null): "photo" | "faces" | "graphics" {
  if (raw === "faces") return "faces";
  if (raw === "graphics") return "graphics";
  return "photo";
}

// ─── helpers ─────────────────────────────────────────────────────

function toNumber(v: FormDataEntryValue | null, fallback: number): number {
  if (v === null) return fallback;
  const n = Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}
function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

async function pollUntilDone(
  url: string,
  token: string,
  deadlineMs: number,
): Promise<ReplicatePrediction> {
  const start = Date.now();
  // Open with quick checks, then back off — typical 4×-runs converge
  // within 10–30 s of the wait window, so 1 s / 1.5 s / 2 s / 3 s
  // buys most cases without hammering Replicate.
  let delay = 1000;
  let lastSnapshot: ReplicatePrediction | null = null;
  while (Date.now() - start < deadlineMs) {
    await sleep(delay);
    delay = Math.min(Math.round(delay * 1.4), 4000);
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const json = (await res.json()) as ReplicatePrediction;
      lastSnapshot = json;
      if (
        json.status === "succeeded" ||
        json.status === "failed" ||
        json.status === "canceled"
      ) {
        return json;
      }
    } catch {
      // transient — try again
    }
  }
  return (
    lastSnapshot ?? {
      id: "",
      status: "processing",
      output: null,
      error: "Polling-Timeout.",
    }
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
