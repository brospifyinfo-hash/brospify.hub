// ─── POST /api/ai-studio ────────────────────────────────────────
// AI Studio. Single-call pipeline: the user's product photo goes to
// Fal `fal-ai/iclight-v2` together with a curated scene prompt
// (optionally augmented by a free-form user prompt). IC-Light is a
// relighting diffusion model that reasons jointly about the subject,
// the new background, and the scene lighting — so it is allowed to:
//   • adapt the lighting + shading on the product itself
//   • adjust position and scale for a natural composition
// while keeping the product visually recognisable. We deliberately
// do NOT post-composite the original cutout back over the result —
// strict-pixel preservation would defeat the lighting integration.
//
// Wire:
//   Client → us:        multipart/form-data { file, sceneId, customPrompt? }
//   us → Fal iclight:   { image_url: data:URI, prompt, negative_prompt, ... }
//   us → Vercel Blob:   public JPEG
//   us → Client:        JSON { url, sceneId, sceneLabel, creditsRemaining }
//
// Env: FAL_KEY required.

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { getSession } from "@/lib/session";
import { autoSaveLibraryImage } from "@/lib/library";
import { requireFeature } from "@/lib/tier-guard";
import {
  deductCredits,
  findKundeByKey,
  getCreditsState,
  getKundeProfile,
} from "@/lib/sheets";
import { recordUsd, FAL_AI_STUDIO_USD } from "@/lib/provider-usage";
import { getCreditCost } from "@/lib/credit-config-server";
import {
  AI_STUDIO_SCENES,
  buildNegativePrompt,
  findScene,
} from "@/lib/ai-studio-scenes";
import { callFal, FalError, type IcLightResponse } from "@/lib/fal";

export const runtime = "nodejs";
export const maxDuration = 300;

const ALLOWED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE = Math.floor(4.2 * 1024 * 1024);
// IC-Light v2 takes a fixed `image_size` enum. We pre-pad the input
// to a square so the model has clean breathing room around the
// product — this also lets it scale/move the subject within the
// canvas without cropping.
const STUDIO_DIM = 1024;
// Free-form prompt cap — keeps payloads reasonable and stops users
// from injecting massive blobs.
const CUSTOM_PROMPT_MAX = 500;
// How many variations a single request may generate (1–3).
const MAX_IMAGES = 3;

export async function POST(req: Request) {
  // 0) Auth + tier + credit gate
  const session = await getSession();
  const guard = await requireFeature(session, "aiStudio");
  if (!guard.ok) return guard.response;

  // 1) Token check
  if (!process.env.FAL_KEY) {
    return NextResponse.json(
      { error: "AI Studio ist nicht konfiguriert. Admin kontaktieren." },
      { status: 500 },
    );
  }

  // 2) Parse multipart body FIRST — we need `count` to price the gate.
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
  const sceneIdRaw = formData.get("sceneId");
  const customPromptRaw = formData.get("customPrompt");
  const countRaw = formData.get("count");
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

  // How many variations to generate (1–3).
  const count = Math.max(
    1,
    Math.min(MAX_IMAGES, Math.round(Number(countRaw) || 1)),
  );

  // 3) Credit gate (per image × count). Admins skip the meter.
  const perImage = await getCreditCost("AI_STUDIO");
  const totalCost = perImage * count;

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
    if (credits.balance < totalCost) {
      return NextResponse.json(
        {
          error: `Nicht genug Credits — ${count} ${count === 1 ? "Bild" : "Bilder"} kosten ${totalCost} (${perImage}/Bild). Du hast ${credits.balance}.`,
          creditsRemaining: credits.balance,
        },
        { status: 402 },
      );
    }
  }

  const sceneId = typeof sceneIdRaw === "string" ? sceneIdRaw : "";
  const scene = findScene(sceneId) || AI_STUDIO_SCENES[0];
  const customPrompt =
    typeof customPromptRaw === "string"
      ? customPromptRaw.trim().slice(0, CUSTOM_PROMPT_MAX)
      : "";
  // Quality-Booster anhaengen — Schluesselwoerter die IC-Light v2
  // konsistent zu schaerferen, photorealistischen Outputs draengen.
  // Werden NACH dem Custom-Prompt eingefuegt damit User-Wuensche
  // weiterhin priorisiert werden.
  const QUALITY_BOOSTER =
    "photorealistic, ultra-detailed, high resolution, professional studio lighting, color-grading consistent with subject, perfect exposure";
  const finalPrompt = customPrompt
    ? `${scene.prompt}, ${customPrompt}, ${QUALITY_BOOSTER}`
    : `${scene.prompt}, ${QUALITY_BOOSTER}`;

  // 3) Pre-process: pad to a centred white square so IC-Light has
  //    headroom to compose the subject in the new scene. Same dim
  //    matches the IC-Light `image_size: square_hd` (1024x1024).
  let normalisedDataUri: string;
  try {
    const buf = Buffer.from(await fileEntry.arrayBuffer());
    const square = await sharp(buf, { failOn: "none" })
      .rotate()
      .resize({
        width: STUDIO_DIM,
        height: STUDIO_DIM,
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
    normalisedDataUri = `data:image/jpeg;base64,${square.toString("base64")}`;
  } catch (err) {
    console.error("[ai-studio] sharp normalise failed:", err);
    return NextResponse.json(
      { error: "Bild konnte nicht vorbereitet werden." },
      { status: 400 },
    );
  }

  // 4) Relight — ONE IC-Light job that returns `count` variations via
  //    the model's native `num_images`. One queue job = reliable count
  //    + predictable latency. (Firing N parallel jobs got throttled by
  //    Fal, which is why "2 angefragt → nur 1, und 3 Min" passierte.)
  let relitUrls: string[];
  try {
    const iclight = await callFal<IcLightResponse>("fal-ai/iclight-v2", {
      image_url: normalisedDataUri,
      prompt: finalPrompt,
      negative_prompt: buildNegativePrompt(scene),
      image_size: "square_hd",
      // Anzahl Varianten in EINEM Job (Fal IC-Light v2 unterstützt das).
      num_images: count,
      // 30 Steps: spürbar schneller als 40 und visuell quasi gleich gut.
      num_inference_steps: 30,
      // IC-Light v2 Default ist 5; 4.5 wirkt minimal natürlicher und das
      // (verschärfte) Negative-Prompt greift bei diesem CFG zuverlässig.
      guidance_scale: 4.5,
      output_format: "jpeg",
      enable_safety_checker: false,
    });
    relitUrls = (iclight.images || [])
      .map((i) => i?.url)
      .filter((u): u is string => typeof u === "string" && u.length > 0);
    if (relitUrls.length === 0) {
      throw new FalError("iclight lieferte keine Bild-URL.", 502, iclight);
    }
  } catch (err) {
    return falErrorResponse(err, "Szenen-Generierung");
  }

  // 5+6) Download, re-encode to clean JPEG, persist each variation.
  const baseName = fileEntry.name.replace(/\.[^.]+$/, "");
  const outputUrls: string[] = [];
  for (let i = 0; i < relitUrls.length; i++) {
    try {
      const dl = await fetch(relitUrls[i]);
      if (!dl.ok) {
        throw new FalError(`Relight-Download fehlgeschlagen (${dl.status}).`, 502);
      }
      const buf = Buffer.from(await dl.arrayBuffer());
      let jpeg: Buffer;
      try {
        jpeg = await sharp(buf).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
      } catch {
        jpeg = buf; // fall back to whatever Fal sent
      }
      const blob = await put(
        `ai-studio/${Date.now()}-${baseName}-${scene.id}-${i + 1}.jpg`,
        jpeg,
        { access: "public", contentType: "image/jpeg" },
      );
      outputUrls.push(blob.url);
    } catch (err) {
      console.error("[ai-studio] variation persist failed:", err);
    }
  }
  if (outputUrls.length === 0) {
    return NextResponse.json(
      { error: "Ergebnis konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }

  // 7) Charge credits — bill ONLY for variations we actually delivered.
  const billedCount = outputUrls.length;
  let creditsRemaining: number | undefined;
  if (kundeRowIndex !== null && kundeProfile !== null) {
    try {
      const result = await deductCredits(
        kundeRowIndex,
        kundeProfile,
        perImage * billedCount,
      );
      if (result.success) creditsRemaining = result.remaining;
    } catch (err) {
      console.error("[ai-studio] credit deduction failed:", err);
    }
  }

  // Fal-Operation war erfolgreich → lokales Verbrauchs-Ledger belasten.
  await recordUsd("fal", FAL_AI_STUDIO_USD * billedCount);

  // Automatisch in die Mediathek (serverseitig, bleibt auch bei zu-Tab).
  for (const u of outputUrls) {
    await autoSaveLibraryImage({
      userKey: session.lizenzschluessel,
      source: "ai-studio",
      title: `AI Studio — ${scene.label}`,
      remoteUrl: u,
      meta: { sceneId: scene.id, sceneLabel: scene.label },
    });
  }

  return NextResponse.json(
    {
      urls: outputUrls,
      // back-compat: callers that still read a single `url`.
      url: outputUrls[0],
      sceneId: scene.id,
      sceneLabel: scene.label,
      count: billedCount,
      creditsRemaining,
      savedToLibrary: !!session.lizenzschluessel,
    },
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
