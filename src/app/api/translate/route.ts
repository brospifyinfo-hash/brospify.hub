import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { translateBatch, type Lang } from "@/lib/translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST — generische KI-Übersetzung (gecached). Body: { texts: string[], lang }
// Übersetzt beliebige Hub-/Produktinhalte ins Englische. Deutsch (Quelle)
// wird unverändert zurückgegeben. Fail-safe: bei Fehlern Originaltexte.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const lang: Lang = body.lang === "en" ? "en" : "de";
  const texts: string[] = Array.isArray(body.texts)
    ? body.texts.map((t: unknown) => String(t ?? ""))
    : [];

  if (texts.length === 0) return NextResponse.json({ translations: [] });
  if (texts.length > 300) {
    return NextResponse.json({ error: "Zu viele Texte (max. 300)." }, { status: 400 });
  }

  try {
    const translations = await translateBatch(texts, lang);
    return NextResponse.json({ translations }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[api/translate] error:", err);
    return NextResponse.json({ translations: texts }); // Original als Fallback
  }
}
