// ─── /api/admin/survey ───────────────────────────────────────────
// Admin-Auswertung der gestaffelten Umfragen: pro Umfrage das Gesamt-
// ergebnis (Aggregat) + alle einzelnen Abgaben.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { listSurveyResponses } from "@/lib/sheets";
import { aggregateSurvey, SURVEYS } from "@/lib/survey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }
  try {
    const all = await listSurveyResponses();
    const surveys = SURVEYS.map((s) => {
      const responses = all.filter((r) => r.surveyId === s.id);
      return {
        id: s.id,
        title: s.title,
        creditReward: s.creditReward,
        unlockAfterDays: s.unlockAfterDays,
        questions: s.questions,
        aggregate: aggregateSurvey(s, responses),
        responses,
      };
    });
    return NextResponse.json(
      { ok: true, totalResponses: all.length, surveys },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[admin/survey] load failed:", e);
    return NextResponse.json({ error: "Auswertung konnte nicht geladen werden." }, { status: 500 });
  }
}
