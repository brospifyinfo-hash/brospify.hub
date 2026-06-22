// ─── /api/survey ─────────────────────────────────────────────────
// User-seitige System-Verbesserungs-Umfrage.
//   GET  → Fragen-Definition + ob dieser Account schon abgegeben hat.
//   POST → Antworten speichern (eine Zeile in SurveyResponses) + Profil-
//          Flag setzen, damit die Karte auf der Startseite verschwindet.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { addSurveyResponse, findKundeByKey, getKundeProfile, updateKundeProfile } from "@/lib/sheets";
import {
  SURVEY_QUESTIONS,
  SURVEY_VERSION,
  sanitizeAnswers,
  hasRequiredAnswers,
} from "@/lib/survey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  let answered = false;
  try {
    if (!session.isAdmin && session.lizenzschluessel) {
      const kunde = await findKundeByKey(session.lizenzschluessel);
      if (kunde) {
        const profile = await getKundeProfile(kunde.rowIndex);
        answered = !!profile.surveyAnsweredV1;
      }
    }
  } catch {
    /* answered bleibt false → Karte zeigt die Umfrage */
  }

  return NextResponse.json(
    { version: SURVEY_VERSION, questions: SURVEY_QUESTIONS, answered },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || session.isAdmin || !session.lizenzschluessel) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  let body: { answers?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request." }, { status: 400 });
  }

  const answers = sanitizeAnswers(body.answers);
  if (Object.keys(answers).length === 0) {
    return NextResponse.json({ error: "Bitte beantworte mindestens eine Frage." }, { status: 400 });
  }
  if (!hasRequiredAnswers(answers)) {
    return NextResponse.json({ error: "Bitte beantworte die Pflichtfragen." }, { status: 400 });
  }

  try {
    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde) {
      return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });
    }
    // Antwort speichern (Nutzer-Kennung = E-Mail, sonst Lizenzschlüssel).
    await addSurveyResponse(kunde.kundenEmail || session.lizenzschluessel, answers);

    // Profil-Flag setzen (idempotent — überschreibt nur die zwei Felder).
    const profile = await getKundeProfile(kunde.rowIndex);
    await updateKundeProfile(kunde.rowIndex, {
      ...profile,
      surveyAnsweredV1: true,
      surveyAnsweredAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[survey] submit failed:", e);
    return NextResponse.json({ error: "Speichern fehlgeschlagen." }, { status: 500 });
  }
}
