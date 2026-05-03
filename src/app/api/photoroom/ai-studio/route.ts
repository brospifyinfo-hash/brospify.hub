// ─── POST /api/photoroom/ai-studio ──────────────────────────────
// AI Studio: drop a product, pick a scene, get a fully-composited
// hero shot. Routes through Photoroom /v2/edit with STRICT
// COMPOSITING settings — the original product mask is cut once and
// then placed on the AI-generated background unchanged. No relight,
// no AI beautify, no text removal — those are the features that
// re-imagine subject pixels and we explicitly do not touch them.
// What we DO add: an AI shadow under the product (matches the
// scene lighting) for realism.
//
// Wire:
//   Client → us:        multipart/form-data { file, sceneId }
//   us → Photoroom:     multipart/form-data { imageFile, removeBackground=true,
//                                             background.prompt=<scene>, shadow.mode=ai.soft, ... }
//   Photoroom → us:     binary image/jpeg
//   us → Vercel Blob:   public JPEG
//   us → Client:        JSON  { url, sceneId, sceneLabel, creditsRemaining }
//
// Env:
//   PHOTOROOM_API_KEY   required  (header: x-api-key)

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/session";
import {
  CREDIT_LIMITS,
  deductCredits,
  findKundeByKey,
  getCreditsState,
  getKundeProfile,
} from "@/lib/sheets";
import { AI_STUDIO_SCENES, findScene } from "@/lib/photoroom-scenes";

export const runtime = "nodejs";
export const maxDuration = 300;

const EDIT_URL = "https://image-api.photoroom.com/v2/edit";
const ALLOWED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE = Math.floor(4.2 * 1024 * 1024);

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
  const token = process.env.PHOTOROOM_API_KEY;
  if (!token) {
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

  // 3) Forward to Photoroom /v2/edit with strict-compositing payload.
  //    KEY: we pass `removeBackground=true` (mask-only cutout, the
  //    product pixels are preserved) and `background.prompt` (AI
  //    generates ONLY the scene around the cut subject). We omit
  //    every feature that would re-paint the subject.
  let outBuffer: Buffer;
  let outContentType = "image/jpeg";
  try {
    const upstream = new FormData();
    upstream.append("imageFile", fileEntry, fileEntry.name);
    upstream.append("removeBackground", "true");
    upstream.append("referenceBox", "originalImage");
    upstream.append("background.prompt", scene.prompt);
    // Don't let Photoroom rewrite our prompt — we already curated them.
    upstream.append("background.expandPrompt.mode", "ai.never");
    upstream.append("background.scaling", "fit");
    // AI shadow grounds the product without touching its pixels.
    upstream.append("shadow.mode", scene.shadow);
    upstream.append("padding", "0.08");
    upstream.append("outputSize", "1280x1280");
    upstream.append("export.format", "jpeg");

    const res = await fetch(EDIT_URL, {
      method: "POST",
      headers: {
        "x-api-key": token,
        Accept: "image/jpeg, image/png, application/json",
      },
      body: upstream,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[Photoroom edit] upstream error:", res.status, text.slice(0, 500));
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json(
          { error: "Photoroom-Zugang abgelehnt. Admin kontaktieren." },
          { status: 502 },
        );
      }
      if (res.status === 402) {
        return NextResponse.json(
          { error: "Photoroom-Quota erschöpft. Admin kontaktieren." },
          { status: 502 },
        );
      }
      if (res.status === 422) {
        return NextResponse.json(
          { error: "Bild wurde abgelehnt. Bitte ein anderes Foto verwenden." },
          { status: 400 },
        );
      }
      if (res.status === 429) {
        return NextResponse.json(
          { error: "Zu viele Anfragen. Bitte 30 Sekunden warten und erneut versuchen." },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: `Verarbeitung fehlgeschlagen (Status ${res.status}).` },
        { status: 502 },
      );
    }

    const ct = res.headers.get("content-type") || "";
    if (ct.includes("image/")) outContentType = ct.split(";")[0].trim();
    const arr = await res.arrayBuffer();
    outBuffer = Buffer.from(arr);
  } catch (err) {
    console.error("[Photoroom edit] network error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Verbindung fehlgeschlagen: ${err.message}`
            : "Verbindung fehlgeschlagen.",
      },
      { status: 502 },
    );
  }

  // 4) Persist to Blob.
  let outputUrl: string;
  try {
    const baseName = fileEntry.name.replace(/\.[^.]+$/, "");
    const ext = outContentType === "image/png" ? "png" : "jpg";
    const blob = await put(
      `ai-studio/${Date.now()}-${baseName}-${scene.id}.${ext}`,
      outBuffer,
      { access: "public", contentType: outContentType },
    );
    outputUrl = blob.url;
  } catch (err) {
    console.error("[Photoroom edit] blob put failed:", err);
    return NextResponse.json(
      { error: "Ergebnis konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }

  // 5) Charge credits.
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
      console.error("[Photoroom ai-studio] credit deduction failed:", err);
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
