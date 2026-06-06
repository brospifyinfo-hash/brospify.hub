// ─── POST /api/ai-studio/public ─────────────────────────────────
// CORS-fähige Variante des AI-Studio-Endpoints. Auth via Lizenz-
// schlüssel / Customer-Email (multipart Felder), gleiche Pipeline
// wie /api/ai-studio (Sharp-Padding → IC-Light v2 → Blob).
//
// Body (multipart/form-data):
//   file        – Bilddatei (JPG/PNG/WebP, max ~4.2 MB)
//   sceneId     – Scene-ID aus AI_STUDIO_SCENES (z.B. "podium", "studio")
//   customPrompt? – freie Prompt-Erweiterung (max 500 Zeichen)
//   key | email – Identifier
//   apikey      – LICENSE_API_KEY Soft-Gate
//
// Response: { ok, url, sceneId, sceneLabel, creditsRemaining, cost }

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import sharp from "sharp";
import {
  CREDIT_LIMITS,
  deductCredits,
  findKundeByEmail,
  findKundeByKey,
  getCreditsState,
  getKundeProfile,
} from "@/lib/sheets";
import { isActiveSubFromKunde } from "@/lib/tiers-shared";
import {
  AI_STUDIO_SCENES,
  buildNegativePrompt,
  findScene,
} from "@/lib/ai-studio-scenes";
import { callFal, FalError, type IcLightResponse } from "@/lib/fal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const ALLOWED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE = Math.floor(4.2 * 1024 * 1024);
const STUDIO_DIM = 1024;
const CUSTOM_PROMPT_MAX = 500;
const QUALITY_BOOSTER =
  "photorealistic, ultra-detailed, high resolution, professional studio lighting, color-grading consistent with subject, perfect exposure";

export async function POST(req: Request) {
  // 1) Parse multipart
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return json({ error: "Konnte FormData nicht lesen." }, 400);
  }

  // 2) Soft-Gate
  const apikey = String(formData.get("apikey") || "").trim();
  const expected = (process.env.LICENSE_API_KEY || "").trim();
  if (expected && apikey !== expected) {
    return json({ error: "Nicht autorisiert." }, 401);
  }

  // 3) Identifier
  const key = String(formData.get("key") || "").trim();
  const email = String(formData.get("email") || "").trim();
  if (!key && !email) return json({ error: "Lizenzschlüssel oder Email fehlt." }, 400);

  // 4) File + scene
  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    return json({ error: "Feld 'file' fehlt oder ist keine Datei." }, 400);
  }
  if (!ALLOWED_MIME.includes(fileEntry.type)) {
    return json({ error: `Format nicht unterstützt (${fileEntry.type}).` }, 400);
  }
  if (fileEntry.size > MAX_FILE_SIZE) {
    return json(
      { error: `Datei zu groß (${(fileEntry.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_FILE_SIZE / 1024 / 1024} MB.` },
      413,
    );
  }

  const sceneId = String(formData.get("sceneId") || "");
  const scene = findScene(sceneId) || AI_STUDIO_SCENES[0];
  const customPromptRaw = String(formData.get("customPrompt") || "");
  const customPrompt = customPromptRaw.trim().slice(0, CUSTOM_PROMPT_MAX);
  const finalPrompt = customPrompt
    ? `${scene.prompt}, ${customPrompt}, ${QUALITY_BOOSTER}`
    : `${scene.prompt}, ${QUALITY_BOOSTER}`;

  // 5) Customer + tier + credits
  let kunde;
  try {
    kunde = key ? await findKundeByKey(key) : await findKundeByEmail(email);
  } catch (err) {
    console.error("[ai-studio/public] kunde lookup failed:", err);
    return json({ error: "Upstream-Fehler." }, 502);
  }
  if (!kunde) return json({ error: "Kunde nicht gefunden." }, 404);
  if (!isActiveSubFromKunde(kunde)) {
    return json({ error: "Membership erforderlich.", gated: true }, 403);
  }
  const profile = await getKundeProfile(kunde.rowIndex);
  const credits = getCreditsState(profile);
  if (credits.balance < CREDIT_LIMITS.AI_STUDIO) {
    return json(
      {
        error: `Nicht genug Credits — AI Studio kostet ${CREDIT_LIMITS.AI_STUDIO}. Du hast ${credits.balance}.`,
        creditsRemaining: credits.balance,
        cost: CREDIT_LIMITS.AI_STUDIO,
      },
      402,
    );
  }

  // 6) Token + Pre-process
  if (!process.env.FAL_KEY) {
    return json({ error: "AI Studio ist nicht konfiguriert." }, 500);
  }
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
    console.error("[ai-studio/public] sharp normalise failed:", err);
    return json({ error: "Bild konnte nicht vorbereitet werden." }, 400);
  }

  // 7) Single-call IC-Light
  let relitBuffer: Buffer;
  try {
    const iclight = await callFal<IcLightResponse>("fal-ai/iclight-v2", {
      image_url: normalisedDataUri,
      prompt: finalPrompt,
      negative_prompt: buildNegativePrompt(scene),
      image_size: "square_hd",
      num_inference_steps: 40,
      guidance_scale: 4.5,
      enable_safety_checker: false,
    });
    const relitUrl = iclight.images?.[0]?.url;
    if (!relitUrl) throw new FalError("iclight lieferte keine Bild-URL.", 502, iclight);
    const dl = await fetch(relitUrl);
    if (!dl.ok) throw new FalError(`Relight-Download fehlgeschlagen (${dl.status}).`, 502);
    relitBuffer = Buffer.from(await dl.arrayBuffer());
  } catch (err) {
    if (err instanceof FalError) {
      console.error("[ai-studio/public] Fal error:", err.status, err.message);
      return json({ error: `Szenen-Generierung fehlgeschlagen: ${err.message}` }, 502);
    }
    console.error("[ai-studio/public] unexpected fal err:", err);
    return json({ error: "Szenen-Generierung fehlgeschlagen." }, 502);
  }

  // 8) Re-encode JPEG
  let finalJpeg: Buffer;
  try {
    finalJpeg = await sharp(relitBuffer).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  } catch {
    finalJpeg = relitBuffer;
  }

  // 9) Blob upload
  let outputUrl: string;
  try {
    const baseName = fileEntry.name.replace(/\.[^.]+$/, "");
    const blob = await put(
      `ai-studio-public/${Date.now()}-${baseName}-${scene.id}.jpg`,
      finalJpeg,
      { access: "public", contentType: "image/jpeg" },
    );
    outputUrl = blob.url;
  } catch (err) {
    console.error("[ai-studio/public] blob put failed:", err);
    return json({ error: "Ergebnis konnte nicht gespeichert werden." }, 500);
  }

  // 10) Credits deduction
  let creditsRemaining: number | undefined;
  try {
    const result = await deductCredits(kunde.rowIndex, profile, CREDIT_LIMITS.AI_STUDIO);
    if (result.success) creditsRemaining = result.remaining;
  } catch (err) {
    console.error("[ai-studio/public] credit deduction failed:", err);
  }

  return json({
    ok: true,
    url: outputUrl,
    sceneId: scene.id,
    sceneLabel: scene.label,
    creditsRemaining,
    cost: CREDIT_LIMITS.AI_STUDIO,
  });
}
