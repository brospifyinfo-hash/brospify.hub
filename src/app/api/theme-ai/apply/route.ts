// ─── POST /api/theme-ai/apply — AI Co-Pilot: Plan bestätigen ────────
// Der Nutzer hat den Plan bestätigt → Credits nach AUFWAND abziehen.
// Die Kosten werden serverseitig aus den mitgeschickten Ops NEU berechnet
// (nie dem Client glauben). Die Anwendung selbst passiert im Editor-Client
// (Live-Preview ohne Reload); hier wird nur autorisiert + abgerechnet.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey, deductCredits } from "@/lib/sheets";
import { getCreditCost } from "@/lib/credit-config-server";
import { isValidDocument } from "@/lib/theme-compile";
import { validateAiOps, aiEffortPoints, aiEffortTier, AI_TIER_KEYS } from "@/lib/theme-ai-ops";
import type { ThemeDocument } from "@/lib/theme-doc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  document?: ThemeDocument;
  ops?: unknown;
  imageCount?: number;
  capabilities?: string[];
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 });
  }
  const doc = body.document && isValidDocument(body.document) ? body.document : null;
  if (!doc) return NextResponse.json({ error: "Ungültiges Theme-Dokument." }, { status: 400 });

  const capabilities = Array.isArray(body.capabilities)
    ? body.capabilities.filter((c): c is string => typeof c === "string" && c.length <= 64).slice(0, 100)
    : [];
  const ops = validateAiOps(body.ops, doc, capabilities);
  if (!ops.length) return NextResponse.json({ error: "Keine gültigen Operationen." }, { status: 400 });

  const imageCount = Math.max(0, Math.min(3, Math.round(Number(body.imageCount) || 0)));
  const tier = aiEffortTier(aiEffortPoints(ops, imageCount));

  if (session.isAdmin) {
    return NextResponse.json({ ok: true, cost: 0, tier });
  }
  if (!session.lizenzschluessel) return NextResponse.json({ error: "Kein Kundenkonto." }, { status: 403 });
  const kunde = await findKundeByKey(session.lizenzschluessel);
  if (!kunde) return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });

  const cost = await getCreditCost(AI_TIER_KEYS[tier]);
  if (cost > 0) {
    try {
      const result = await deductCredits(kunde.rowIndex, kunde.profile, cost, "theme-ai");
      if (!result.success) {
        return NextResponse.json(
          { error: `Nicht genug Credits — diese Umsetzung kostet ${cost}.`, creditsRemaining: result.remaining },
          { status: 402 },
        );
      }
      return NextResponse.json({ ok: true, cost, tier, creditsRemaining: result.remaining });
    } catch (err) {
      console.error("[theme-ai] deduct failed:", err);
      return NextResponse.json({ error: "Credit-Abzug fehlgeschlagen." }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, cost: 0, tier });
}
