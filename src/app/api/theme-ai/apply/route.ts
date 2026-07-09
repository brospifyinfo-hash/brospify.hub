// ─── POST /api/theme-ai/apply — AI Co-Pilot: Plan anwenden (PREPAID) ────────
// Die Credits fielen BEREITS bei der Plan-Erstellung an (/api/theme-ai/plan).
// Das Anwenden passiert clientseitig (Live-Preview ohne Reload); diese Route
// AUTORISIERT nur best-effort und füttert den Lernspeicher. Sie darf das
// Anwenden NIE blockieren (sonst „bezahlt, aber kein Ergebnis") — antwortet
// deshalb praktisch immer mit ok, ohne Credit-/Sheets-Abhängigkeit.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isValidDocument } from "@/lib/theme-compile";
import { learnFromApply } from "@/lib/theme-ai-learn";
import { verifyPlanToken } from "@/lib/theme-ai-token";
import { validateAiOps, aiEffortPoints, aiEffortTier } from "@/lib/theme-ai-ops";
import type { ThemeDocument } from "@/lib/theme-doc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  document?: ThemeDocument;
  ops?: unknown;
  /** Signierter Token aus der plan-Route — Quelle für mode/imageCount (nur Attribution). */
  planToken?: string;
  productTitle?: string;
  capabilities?: string[];
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    /* Anwenden ist prepaid + clientseitig — selbst ein kaputter Body blockiert nichts. */
  }

  const doc = body.document && isValidDocument(body.document) ? body.document : null;
  const capabilities = Array.isArray(body.capabilities)
    ? body.capabilities.filter((c): c is string => typeof c === "string" && c.length <= 64).slice(0, 100)
    : [];
  const ops = doc ? validateAiOps(body.ops, doc, capabilities) : [];
  const user = session.isAdmin ? "admin" : session.lizenzschluessel || "";
  const tokenData = verifyPlanToken(body.planToken, user, ops);
  const productTitle = typeof body.productTitle === "string" ? body.productTitle.slice(0, 200) : "";

  // Nur bei gültigem Token + Ops in den Lernspeicher schreiben (saubere
  // Attribution) — nie fatal, blockiert die Antwort nicht.
  if (tokenData && ops.length) learnFromApply(productTitle, ops).catch(() => {});

  const tier = aiEffortTier(aiEffortPoints(ops, tokenData?.imageCount ?? 0));
  return NextResponse.json({ ok: true, cost: 0, tier, mode: tokenData?.mode ?? "standard", prepaid: true });
}
