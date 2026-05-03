// ─── POST /api/ai-studio ────────────────────────────────────────
// AI Studio. Three-step server pipeline that produces a polished
// product hero shot WITHOUT letting any model rewrite the product
// pixels (logos, text, finish stay 1:1 from the source):
//
//   1. Background removal — Fal `fal-ai/imageutils/rembg` returns a
//      transparent-PNG cutout of the product. This is the source of
//      truth for product pixels.
//
//   2. Scene relight — Fal `fal-ai/iclight-v2` takes the cutout +
//      a scene/lighting prompt and produces an image of the product
//      placed into that scene with realistic shadows + ambient
//      bounce light. (IC-Light is a relighting diffusion model;
//      it CAN drift on subject pixels — that's fine, we discard
//      its subject in step 3 and keep only background + shadows.)
//
//   3. Composite restore — Sharp overlays the original cutout from
//      step 1 on top of the relit image from step 2 using the
//      cutout's alpha channel. Result:
//        • Where alpha = 1 (product body): pixel-perfect original.
//        • Where alpha < 1 (edges, surroundings): IC-Light's relit
//          background + AI-generated shadows.
//
// Wire:
//   Client → us:        multipart/form-data { file, sceneId }
//   us → Fal rembg:     { image_url: data:URI }
//   us → Fal iclight:   { image_url: cutoutUrl, prompt: scene.prompt }
//   us → Vercel Blob:   public composite (JPEG)
//   us → Client:        JSON { url, sceneId, sceneLabel, creditsRemaining }
//
// Env: FAL_KEY required.

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { getSession } from "@/lib/session";
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
import { callFal, FalError, type IcLightResponse, type RembgResponse } from "@/lib/fal";

export const runtime = "nodejs";
export const maxDuration = 300;

const ALLOWED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE = Math.floor(4.2 * 1024 * 1024);
// Normalise to a fixed canvas before anything goes to Fal — gives
// rembg and IC-Light identical input dimensions, so the cutout and
// the relit image align pixel-for-pixel for the composite step.
const STUDIO_DIM = 1024;

export async function POST(req: Request) {
  // 0) Auth + credit gate
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

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

  // 3) Normalise to a centred white-padded square at STUDIO_DIM. Both
  //    rembg and IC-Light return outputs at the input dimensions, so
  //    same-square input → same-square outputs → trivial alpha composite.
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

  // 4) Step 1 — bg removal. Fal returns a hosted URL that IC-Light
  //    can fetch directly, so we don't have to round-trip the bytes.
  let cutoutUrl: string;
  let cutoutBuffer: Buffer;
  try {
    const rembg = await callFal<RembgResponse>("fal-ai/imageutils/rembg", {
      image_url: normalisedDataUri,
    });
    if (!rembg.image?.url) {
      throw new FalError("rembg lieferte keine Bild-URL.", 502, rembg);
    }
    cutoutUrl = rembg.image.url;

    const dl = await fetch(cutoutUrl);
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

  // 5) Step 2 — IC-Light relight in the chosen scene. We feed the
  //    NORMALISED ORIGINAL (not the cutout) so the model has lighting
  //    context for the subject geometry, then we discard its subject
  //    pixels in step 6 anyway.
  let relitBuffer: Buffer;
  try {
    const iclight = await callFal<IcLightResponse>("fal-ai/iclight-v2", {
      image_url: normalisedDataUri,
      prompt: scene.prompt,
      negative_prompt: buildNegativePrompt(scene),
      image_size: "square_hd",
      num_inference_steps: 28,
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

  // 6) Step 3 — composite. Force both layers to STUDIO_DIM × STUDIO_DIM
  //    so alignment is guaranteed, then overlay the cutout (with its
  //    alpha intact) onto the relit base. Sharp's `composite` honours
  //    the alpha channel of the input — every fully-opaque pixel of
  //    the cutout overwrites the relit pixel beneath it; partially-
  //    transparent pixels at the edge blend smoothly with the AI
  //    shadow underneath, giving a clean, integrated result.
  let finalJpeg: Buffer;
  try {
    const baseSquared = await sharp(relitBuffer)
      .resize(STUDIO_DIM, STUDIO_DIM, { fit: "fill" })
      .toBuffer();
    const cutoutSquared = await sharp(cutoutBuffer)
      .resize(STUDIO_DIM, STUDIO_DIM, { fit: "fill" })
      .png()
      .toBuffer();
    finalJpeg = await sharp(baseSquared)
      .composite([{ input: cutoutSquared, blend: "over" }])
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    console.error("[ai-studio] sharp composite failed:", err);
    return NextResponse.json(
      { error: "Composite-Schritt fehlgeschlagen." },
      { status: 500 },
    );
  }

  // 7) Persist final to Blob.
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

  // 8) Charge credits — admins skip the meter.
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
