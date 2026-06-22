// ─── /api/survey ─────────────────────────────────────────────────
// Gestaffelte User-Umfragen.
//   GET  → alle Umfragen mit Status (available/completed/locked) für diesen
//          Account, inkl. Tagen bis zur Freischaltung.
//   POST → Antworten einer Umfrage speichern, als abgeschlossen markieren
//          und die Belohnungs-Credits gutschreiben.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  addSurveyResponse,
  completeSurvey,
  findKundeByKey,
  getKundeProfile,
} from "@/lib/sheets";
import {
  getSurveyById,
  sanitizeAnswers,
  sanitizeMeta,
  hasRequiredAnswers,
  surveysWithStatus,
} from "@/lib/survey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function daysSince(iso: string | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  let completedIds: string[] = [];
  let daysSinceStart = 0;
  try {
    if (!session.isAdmin && session.lizenzschluessel) {
      const kunde = await findKundeByKey(session.lizenzschluessel);
      if (kunde) {
        const profile = await getKundeProfile(kunde.rowIndex);
        completedIds = Array.isArray(profile.surveysCompleted) ? profile.surveysCompleted : [];
        daysSinceStart = daysSince(profile.creditsStartedAt);
      }
    }
  } catch {
    /* Defaults → nur die Willkommens-Umfrage ist verfügbar */
  }

  const surveys = surveysWithStatus(daysSinceStart, completedIds);
  return NextResponse.json(
    { surveys },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || session.isAdmin || !session.lizenzschluessel) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  let body: { surveyId?: unknown; answers?: unknown; meta?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request." }, { status: 400 });
  }

  const surveyId = typeof body.surveyId === "string" ? body.surveyId : "";
  const survey = getSurveyById(surveyId);
  if (!survey) {
    return NextResponse.json({ error: "Unbekannte Umfrage." }, { status: 400 });
  }

  const answers = sanitizeAnswers(survey, body.answers);
  const meta = sanitizeMeta(body.meta, survey.questions.length);
  if (!hasRequiredAnswers(survey, answers)) {
    return NextResponse.json({ error: "Bitte beantworte die Pflichtfragen." }, { status: 400 });
  }

  try {
    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde) {
      return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });
    }
    const profile = await getKundeProfile(kunde.rowIndex);

    // Schon abgeschlossen? Kein Doppel-Credit.
    const completed = Array.isArray(profile.surveysCompleted) ? profile.surveysCompleted : [];
    if (completed.includes(surveyId)) {
      return NextResponse.json({ error: "Diese Umfrage hast du bereits abgeschlossen." }, { status: 409 });
    }

    // Serverseitige Freischalt-Prüfung (kein vorzeitiges Ausfüllen via API).
    const daysSinceStart = daysSince(profile.creditsStartedAt);
    if (daysSinceStart < survey.unlockAfterDays) {
      return NextResponse.json({ error: "Diese Umfrage ist noch nicht freigeschaltet." }, { status: 403 });
    }

    // Antwort speichern (Kennung = E-Mail, sonst Lizenzschlüssel).
    await addSurveyResponse(kunde.kundenEmail || session.lizenzschluessel, surveyId, answers, meta);

    // Abschluss markieren + Credits gutschreiben (atomar).
    const result = await completeSurvey(kunde.rowIndex, profile, surveyId, survey.creditReward);

    return NextResponse.json({
      ok: true,
      creditsAwarded: result.awarded,
      creditsRemaining: result.balance,
    });
  } catch (e) {
    console.error("[survey] submit failed:", e);
    return NextResponse.json({ error: "Speichern fehlgeschlagen." }, { status: 500 });
  }
}
