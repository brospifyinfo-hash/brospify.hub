// ─── /api/admin/survey ───────────────────────────────────────────
// Admin-Auswertung der System-Verbesserungs-Umfrage: Gesamtergebnis
// (Aggregat) + alle einzelnen Abgaben.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { listSurveyResponses } from "@/lib/sheets";
import { aggregateSurvey, SURVEY_QUESTIONS } from "@/lib/survey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }
  try {
    const responses = await listSurveyResponses();
    const aggregate = aggregateSurvey(responses);
    return NextResponse.json(
      { ok: true, questions: SURVEY_QUESTIONS, aggregate, responses },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[admin/survey] load failed:", e);
    return NextResponse.json({ error: "Auswertung konnte nicht geladen werden." }, { status: 500 });
  }
}
