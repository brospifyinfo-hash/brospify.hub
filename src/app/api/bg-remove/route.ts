// ─── POST /api/bg-remove ────────────────────────────────────────
// Magic Background Remover. Two precision tiers — both return clean
// alpha-cutout PNGs. The cutout is the original product pixels
// punched against transparency, the model never re-paints subject
// pixels.
//   • "fast"    → fal-ai/imageutils/rembg (BRIA RMBG-1.4) · ~2 s
//   • "precise" → fal-ai/birefnet/v2 (General Use Heavy)  · ~6 s
//
// Wire:
//   Client → us:        multipart/form-data { file, precision? }
//   us → Fal:           JSON { image_url: data:URI, ...modelInputs }
//   Fal → us:           { image: { url } }
//   us → Vercel Blob:   public PNG
//   us → Client:        JSON { url, precision, creditsRemaining }
//
// Env: FAL_KEY required (header `Authorization: Key <key>`).

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { getSession } from "@/lib/session";
import { requireFeature } from "@/lib/tier-guard";
import {
  deductCredits,
  findKundeByKey,
  getCreditsState,
  getKundeProfile,
} from "@/lib/sheets";
import { callFal, FalError, type RembgResponse } from "@/lib/fal";
import { recordUsd, FAL_BG_REMOVE_USD } from "@/lib/provider-usage";
import { findBgPrecision } from "@/lib/ai-studio-scenes";
import { getCreditCost } from "@/lib/credit-config-server";

export const runtime = "nodejs";
export const maxDuration = 120;

const ALLOWED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE = Math.floor(4.2 * 1024 * 1024);
// Hard cap on what we send to Fal — keeps base64 payload manageable
// and rembg latency low. The client also pre-resizes to ~2400 px.
const SERVER_MAX_DIM = 1600;

export async function POST(req: Request) {
  // 0) Auth + tier + credit gate
  const session = await getSession();
  const guard = await requireFeature(session, "bgRemove");
  if (!guard.ok) return guard.response;

  const cost = await getCreditCost("BG_REMOVE");

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
    if (credits.balance < cost) {
      return NextResponse.json(
        {
          error: `Nicht genug Credits — Background Remover kostet ${cost}. Du hast ${credits.balance}.`,
          creditsRemaining: credits.balance,
        },
        { status: 402 },
      );
    }
  }

  // 1) Token check
  if (!process.env.FAL_KEY) {
    return NextResponse.json(
      { error: "Background Remover ist nicht konfiguriert. Admin kontaktieren." },
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
  const precisionRaw = formData.get("precision");
  const precision = findBgPrecision(
    typeof precisionRaw === "string" ? precisionRaw : null,
  );
  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      { error: "Feld 'file' fehlt oder ist keine Datei." },
      { status: 400 },
    );
  }
  if (!ALLOWED_MIME.includes(fileEntry.type)) {
    return NextResponse.json(
      { error: `Format nicht unterstützt (${fileEntry.type}). Bitte JPG, PNG oder WebP.` },
      { status: 400 },
    );
  }
  if (fileEntry.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        error: `Datei zu groß (${(fileEntry.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
      },
      { status: 413 },
    );
  }

  // 3) Resize server-side to a sane dim, encode JPEG → data URI for Fal.
  let dataUri: string;
  try {
    const buf = Buffer.from(await fileEntry.arrayBuffer());
    const jpeg = await sharp(buf, { failOn: "none" })
      .rotate() // honour EXIF orientation
      .resize({
        width: SERVER_MAX_DIM,
        height: SERVER_MAX_DIM,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
    dataUri = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch (err) {
    console.error("[bg-remove] sharp prep failed:", err);
    return NextResponse.json(
      { error: "Bild konnte nicht vorbereitet werden." },
      { status: 400 },
    );
  }

  // 4) Call the chosen Fal model (rembg or birefnet/v2).
  let cutoutBuffer: Buffer;
  try {
    const result = await callFal<RembgResponse>(precision.model, {
      image_url: dataUri,
      ...(precision.modelInputs ?? {}),
    });
    if (!result.image?.url) {
      throw new FalError("Fal-Response enthielt keine Bild-URL.", 502, result);
    }
    const dl = await fetch(result.image.url);
    if (!dl.ok) {
      throw new FalError(
        `Cutout-Download fehlgeschlagen (${dl.status}).`,
        502,
      );
    }
    cutoutBuffer = Buffer.from(await dl.arrayBuffer());
  } catch (err) {
    return falErrorResponse(err, "Hintergrund-Entfernung");
  }

  // 5) Persist to Blob.
  let outputUrl: string;
  try {
    const baseName = fileEntry.name.replace(/\.[^.]+$/, "");
    const blob = await put(
      `bg-removed/${Date.now()}-${baseName}.png`,
      cutoutBuffer,
      { access: "public", contentType: "image/png" },
    );
    outputUrl = blob.url;
  } catch (err) {
    console.error("[bg-remove] blob put failed:", err);
    return NextResponse.json(
      { error: "Ergebnis konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }

  // 6) Charge credits — admins skip the meter.
  let creditsRemaining: number | undefined;
  if (kundeRowIndex !== null && kundeProfile !== null) {
    try {
      const result = await deductCredits(
        kundeRowIndex,
        kundeProfile,
        cost,
      );
      if (result.success) creditsRemaining = result.remaining;
    } catch (err) {
      console.error("[bg-remove] credit deduction failed:", err);
    }
  }

  // Fal-Operation war erfolgreich → lokales Verbrauchs-Ledger belasten.
  await recordUsd("fal", FAL_BG_REMOVE_USD);

  return NextResponse.json(
    { url: outputUrl, precision: precision.id, creditsRemaining },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

function falErrorResponse(err: unknown, label: string): NextResponse {
  if (err instanceof FalError) {
    console.error(`[${label}] Fal error:`, err.status, err.message);
    if (err.isOutOfBalance) {
      return NextResponse.json(
        {
          error: `${label}: Fal.ai-Guthaben aufgebraucht. Bitte unter fal.ai/dashboard/billing aufladen.`,
        },
        { status: 502 },
      );
    }
    if (err.status === 401 || err.status === 403) {
      return NextResponse.json(
        { error: `${label}: Fal-Zugang abgelehnt. Admin kontaktieren.` },
        { status: 502 },
      );
    }
    if (err.status === 402) {
      return NextResponse.json(
        { error: `${label}: Fal-Quota erschöpft. Admin kontaktieren.` },
        { status: 502 },
      );
    }
    if (err.status === 422) {
      return NextResponse.json(
        { error: `${label}: Bild wurde abgelehnt.` },
        { status: 400 },
      );
    }
    if (err.status === 429) {
      return NextResponse.json(
        { error: "Zu viele Anfragen. Bitte 30 Sekunden warten und erneut versuchen." },
        { status: 429 },
      );
    }
    if (err.status === 504) {
      return NextResponse.json(
        { error: `${label}: dauert ungewöhnlich lange. Bitte erneut versuchen.` },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: `${label} fehlgeschlagen: ${err.message}` },
      { status: 502 },
    );
  }
  console.error(`[${label}] unexpected error:`, err);
  return NextResponse.json(
    {
      error:
        err instanceof Error
          ? `${label} fehlgeschlagen: ${err.message}`
          : `${label} fehlgeschlagen.`,
    },
    { status: 502 },
  );
}
