// ─── /api/admin/media ────────────────────────────────────────────
//   GET    alle Bilder, sortiert
//   POST   Bild hochladen (multipart/form-data, Feld "file")
//   PATCH  Beschriftung, Sichtbarkeit oder Reihenfolge ändern
//   DELETE Bild samt Datei entfernen

import { NextRequest, NextResponse } from "next/server";
import { isStudioAdmin } from "@/lib/auth";
import { addMedia, deleteMedia, moveMedia, readData, updateMedia } from "@/lib/store";
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES, removeImage, storeImage } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Große Bilder durch sharp zu schicken dauert; der Standard von 15 s
// reicht für ein 12-MB-Handyfoto nicht zuverlässig.
export const maxDuration = 60;

async function guard(): Promise<NextResponse | null> {
  if (await isStudioAdmin()) return null;
  return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  const { media } = await readData();
  return NextResponse.json({
    media: media.slice().sort((a, b) => a.sortIndex - b.sortIndex),
  });
}

export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Datei konnte nicht gelesen werden." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Keine Datei übergeben." }, { status: 400 });
  }
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Nur JPG, PNG, WebP oder AVIF." },
      { status: 415 },
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `Das Bild ist zu groß (max. ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB).` },
      { status: 413 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeImage(buffer, file.name || "bild");
    const title = text(form.get("title"), 80) || "Ohne Titel";
    const item = await addMedia({
      ...stored,
      title,
      style: text(form.get("style"), 60),
      placement: text(form.get("placement"), 60),
      // Ohne eigene Beschreibung wenigstens der Titel — besser als ein
      // leeres alt-Attribut, das Screenreader einfach überspringen.
      alt: text(form.get("alt"), 200) || title,
      inGallery: form.get("inGallery") !== "false",
      inHero: form.get("inHero") === "true",
    });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("[media] Upload fehlgeschlagen", error);
    return NextResponse.json(
      { error: "Das Bild konnte nicht verarbeitet werden." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as
    | {
        id?: string; title?: string; style?: string; placement?: string; alt?: string;
        inGallery?: boolean; inHero?: boolean; move?: number;
      }
    | null;
  if (!body?.id) return NextResponse.json({ error: "Bild fehlt." }, { status: 400 });

  // Verschieben ist eine eigene Aktion — sie berührt die Indizes aller
  // Bilder, nicht nur dieses einen.
  if (body.move === -1 || body.move === 1) {
    const ok = await moveMedia(body.id, body.move);
    if (!ok) return NextResponse.json({ error: "Nicht verschiebbar." }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const patch: Parameters<typeof updateMedia>[1] = {};
  if (typeof body.title === "string") patch.title = text(body.title, 80) || "Ohne Titel";
  if (typeof body.style === "string") patch.style = text(body.style, 60);
  if (typeof body.placement === "string") patch.placement = text(body.placement, 60);
  if (typeof body.alt === "string") patch.alt = text(body.alt, 200);
  if (typeof body.inGallery === "boolean") patch.inGallery = body.inGallery;
  if (typeof body.inHero === "boolean") patch.inHero = body.inHero;

  const item = await updateMedia(body.id, patch);
  if (!item) return NextResponse.json({ error: "Bild nicht gefunden." }, { status: 404 });
  return NextResponse.json({ item });
}

export async function DELETE(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Bild fehlt." }, { status: 400 });

  const url = await deleteMedia(id);
  if (!url) return NextResponse.json({ error: "Bild nicht gefunden." }, { status: 404 });
  // Erst der Eintrag, dann die Datei: andersherum bliebe bei einem
  // Fehler ein Eintrag ohne Bild stehen — sichtbar kaputt statt nur
  // unaufgeräumt.
  await removeImage(url);
  return NextResponse.json({ ok: true });
}
