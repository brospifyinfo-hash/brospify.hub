// ─── /api/admin/reviews ──────────────────────────────────────────
//   GET    alle Bewertungen, neueste zuerst
//   POST   Bewertung eintragen
//   PATCH  ändern oder veröffentlichen/zurückziehen
//   DELETE löschen

import { NextRequest, NextResponse } from "next/server";
import { isStudioAdmin } from "@/lib/auth";
import { addReview, deleteReview, readData, updateReview } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function guard(): Promise<NextResponse | null> {
  if (await isStudioAdmin()) return null;
  return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function clampRating(value: unknown): number | null {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  const { reviews } = await readData();
  return NextResponse.json({
    reviews: reviews.slice().sort((a, b) => b.date.localeCompare(a.date)),
  });
}

export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });

  const name = text(body.name, 60);
  const reviewText = text(body.text, 1500);
  const rating = clampRating(body.rating);
  const date = text(body.date, 10);

  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = "Bitte einen Namen angeben.";
  if (reviewText.length < 10) errors.text = "Die Bewertung ist zu kurz.";
  if (rating === null) errors.rating = "Bitte 1 bis 5 Sterne wählen.";
  if (!DATE_RE.test(date)) errors.date = "Bitte ein Datum wählen.";
  if (Object.keys(errors).length) return NextResponse.json({ errors }, { status: 400 });

  const review = await addReview({
    name,
    text: reviewText,
    rating: rating!,
    date,
    source: text(body.source, 40) || undefined,
    // Standardmäßig sofort sichtbar — der Inhaber trägt sie ja bewusst ein.
    published: body.published !== false,
  });
  return NextResponse.json({ review });
}

export async function PATCH(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = text(body?.id, 64);
  if (!id) return NextResponse.json({ error: "Bewertung fehlt." }, { status: 400 });

  const patch: Parameters<typeof updateReview>[1] = {};
  if (typeof body!.name === "string") patch.name = text(body!.name, 60);
  if (typeof body!.text === "string") patch.text = text(body!.text, 1500);
  if (typeof body!.source === "string") patch.source = text(body!.source, 40) || undefined;
  if (typeof body!.date === "string" && DATE_RE.test(body!.date)) patch.date = body!.date;
  if (typeof body!.published === "boolean") patch.published = body!.published;
  if (body!.rating !== undefined) {
    const rating = clampRating(body!.rating);
    if (rating === null) return NextResponse.json({ error: "Sterne 1 bis 5." }, { status: 400 });
    patch.rating = rating;
  }

  const review = await updateReview(id, patch);
  if (!review) return NextResponse.json({ error: "Bewertung nicht gefunden." }, { status: 404 });
  return NextResponse.json({ review });
}

export async function DELETE(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Bewertung fehlt." }, { status: 400 });
  const ok = await deleteReview(id);
  if (!ok) return NextResponse.json({ error: "Bewertung nicht gefunden." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
