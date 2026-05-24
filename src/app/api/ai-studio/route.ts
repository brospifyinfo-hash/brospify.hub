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
import { requireFeature } from "@/lib/tier-guard";
import {
  CREDIT_LIMITS,
  deductCredits,
  findKundeByKey,
  getCreditsState,
  getKundeProfile,
} from "@/lib/sheets";
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

export async function POST(req: Request) {
  // 0) Auth + tier + credit gate
  const session = await getSession();
  const guard = await requireFeature(session, "aiStudio");
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
    if (credits.balance < CREDIT_LIMITS.AI_STUDIO) {
      return NextResponse.json(
        {
          error: `Nicht genug Credits — AI Studio kostet ${CREDIT_LIMITS.AI_STUDIO}. Du hast ${credits.balance}.`,
          creditsRemaining: credits.balance,
        },
        { status: 402 },
      );
    }
  }

  // 1) Token check
  if (!process.env.FAL_KEY) {
    return NextResponse.json(
      { error: "AI Studio ist nicht konfiguriert. Admin kontaktieren." },
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
  const sceneIdRaw = formData.get("sceneId");
  const customPromptRaw = formData.get("customPrompt");
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

  // 4) Single-call relight — IC-Light handles bg, shadows, and the
  //    integration of the subject into the new lighting environment.
  let relitBuffer: Buffer;
  try {
    const iclight = await callFal<IcLightResponse>("fal-ai/iclight-v2", {
      image_url: normalisedDataUri,
      prompt: finalPrompt,
      negative_prompt: buildNegativePrompt(scene),
      image_size: "square_hd",
      // Von 28 auf 40 hochgesetzt — deutlich saerfere Details +
      // sauberere Schatten/Reflexionen ohne dass die Generierungszeit
      // explodiert (~+5s pro Bild).
      num_inference_steps: 40,
      // guidance_scale: 4.5 ist der IC-Light v2 Default, etwas niedriger
      // produziert natuerlichere Resultate. Wir lassen ihn explizit
      // damit Fal nicht plotzlich was anderes einsetzt.
      guidance_scale: 4.5,
      enable_safety_checker: false,
    });
    const relitUrl = iclight.images?.[0]?.url;
    if (!relitUrl) {
      throw new FalError("iclight lieferte keine Bild-URL.", 502, iclight);
    }
    const dl = await fetch(relitUrl);
    if (!dl.ok) {
      throw new FalError(
        `Relight-Download fehlgeschlagen (${dl.status}).`,
        502,
      );
    }
    relitBuffer = Buffer.from(await dl.arrayBuffer());
  } catch (err) {
    return falErrorResponse(err, "Szenen-Generierung");
  }

  // 5) Re-encode as a clean JPEG (Fal often returns PNG which is
  //    larger; we standardise on JPEG for the download endpoint).
  let finalJpeg: Buffer;
  try {
    finalJpeg = await sharp(relitBuffer)
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    console.error("[ai-studio] sharp re-encode failed:", err);
    finalJpeg = relitBuffer; // fall back to whatever Fal sent
  }

  // 6) Persist final to Blob.
  let outputUrl: string;
  try {
    const baseName = fileEntry.name.replace(/\.[^.]+$/, "");
    const blob = await put(
      `ai-studio/${Date.now()}-${baseName}-${scene.id}.jpg`,
      finalJpeg,
      { access: "public", contentType: "image/jpeg" },
    );
    outputUrl = blob.url;
  } catch (err) {
    console.error("[ai-studio] blob put failed:", err);
    return NextResponse.json(
      { error: "Ergebnis konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }

  // 7) Charge credits — admins skip the meter.
  let creditsRemaining: number | undefined;
  if (kundeRowIndex !== null && kundeProfile !== null) {
    try {
      const result = await deductCredits(
        kundeRowIndex,
        kundeProfile,
        CREDIT_LIMITS.AI_STUDIO,
      );
      if (result.success) creditsRemaining = result.remaining;
    } catch (err) {
      console.error("[ai-studio] credit deduction failed:", err);
    }
  }

  return NextResponse.json(
    {
      url: outputUrl,
      sceneId: scene.id,
      sceneLabel: scene.label,
      creditsRemaining,
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
