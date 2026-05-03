// ─── POST /api/photoroom/remove-bg ──────────────────────────────
// Magic Background Remover. Photoroom's /v1/segment endpoint does
// strict alpha-mask cut-out — it returns the original product pixels
// punched against transparency, never re-drawn or hallucinated.
// The product (incl. on-package text and logos) stays pixel-perfect.
//
// Wire:
//   Client → us:        multipart/form-data { file }
//   us → Photoroom:     multipart/form-data { image_file, format=png }
//   Photoroom → us:     binary image/png with transparency
//   us → Vercel Blob:   public PNG
//   us → Client:        JSON  { url, creditsRemaining }
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

export const runtime = "nodejs";
export const maxDuration = 120;

const SEGMENT_URL = "https://sdk.photoroom.com/v1/segment";
const ALLOWED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
// Vercel hard cap on multipart bodies is 4.5 MB — leave a cushion.
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
    if (credits.balance < CREDIT_LIMITS.BG_REMOVE) {
      return NextResponse.json(
        {
          error: `Nicht genug Credits — Background Remover kostet ${CREDIT_LIMITS.BG_REMOVE}. Du hast ${credits.balance}.`,
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

  // 3) Forward to Photoroom /v1/segment
  let pngBuffer: Buffer;
  try {
    const upstream = new FormData();
    upstream.append("image_file", fileEntry, fileEntry.name);
    upstream.append("format", "png");

    const res = await fetch(SEGMENT_URL, {
      method: "POST",
      headers: {
        // Don't set Content-Type — fetch fills the multipart boundary.
        "x-api-key": token,
        Accept: "image/png, application/json",
      },
      body: upstream,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[Photoroom segment] upstream error:", res.status, text.slice(0, 400));
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
      if (res.status === 429) {
        return NextResponse.json(
          { error: "Zu viele Anfragen. Bitte 30 Sekunden warten und erneut versuchen." },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: `Hintergrund-Entfernung fehlgeschlagen (Status ${res.status}).` },
        { status: 502 },
      );
    }

    const arr = await res.arrayBuffer();
    pngBuffer = Buffer.from(arr);
  } catch (err) {
    console.error("[Photoroom segment] network error:", err);
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

  // 4) Stash PNG in Vercel Blob so the client can download via a URL.
  let outputUrl: string;
  try {
    const baseName = fileEntry.name.replace(/\.[^.]+$/, "");
    const blob = await put(
      `bg-removed/${Date.now()}-${baseName}.png`,
      pngBuffer,
      { access: "public", contentType: "image/png" },
    );
    outputUrl = blob.url;
  } catch (err) {
    console.error("[Photoroom segment] blob put failed:", err);
    return NextResponse.json(
      { error: "Ergebnis konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }

  // 5) Charge credits — admins skip the meter. If the deduction
  //    fails we still return the result; better to under-bill than
  //    block a paying customer.
  let creditsRemaining: number | undefined;
  if (kundeRowIndex !== null && kundeProfile !== null) {
    try {
      const result = await deductCredits(
        kundeRowIndex,
        kundeProfile,
        CREDIT_LIMITS.BG_REMOVE,
      );
      if (result.success) creditsRemaining = result.remaining;
    } catch (err) {
      console.error("[Photoroom remove-bg] credit deduction failed:", err);
    }
  }

  return NextResponse.json(
    { url: outputUrl, creditsRemaining },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
