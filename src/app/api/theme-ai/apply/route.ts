// ─── POST /api/theme-ai/apply — AI Co-Pilot: Plan bestätigen ────────
// Der Nutzer hat den Plan bestätigt → Credits nach AUFWAND + MODUS abziehen.
// Die Kosten werden serverseitig aus den mitgeschickten Ops NEU berechnet
// (nie dem Client glauben). Die Anwendung selbst passiert im Editor-Client
// (Live-Preview ohne Reload); hier wird nur autorisiert + abgerechnet —
// und der Lernspeicher gefüttert (die AI bildet sich mit jedem Lauf weiter).

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey, deductCredits } from "@/lib/sheets";
import { getCreditCost } from "@/lib/credit-config-server";
import { isValidDocument } from "@/lib/theme-compile";
import { learnFromApply } from "@/lib/theme-ai-learn";
import { verifyPlanToken } from "@/lib/theme-ai-token";
import { validateAiOps, aiEffortPoints, aiEffortTier, aiTierCreditKey } from "@/lib/theme-ai-ops";
import type { ThemeDocument } from "@/lib/theme-doc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  document?: ThemeDocument;
  ops?: unknown;
  /** Signierter Token aus der plan-Route — EINZIGE Quelle für mode/imageCount. */
  planToken?: string;
  productTitle?: string;
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

  // Modus + Bildanzahl kommen AUSSCHLIESSLICH aus dem signierten Plan-Token
  // (Kosten-Integrität: ein Expert-Plan kann nicht zum Standard-Tarif
  // bestätigt werden, imageCount nicht kleingerechnet). Die Re-Validierung
  // der Ops ist deterministisch → der ops-Hash im Token matcht exakt.
  const user = session.isAdmin ? "admin" : session.lizenzschluessel || "";
  const tokenData = verifyPlanToken(body.planToken, user, ops);
  if (!tokenData) {
    return NextResponse.json(
      { error: "Der Plan ist abgelaufen oder ungültig — bitte erstelle ihn neu (kostenlos)." },
      { status: 400 },
    );
  }
  const mode = tokenData.mode;
  const imageCount = tokenData.imageCount;
  const tier = aiEffortTier(aiEffortPoints(ops, imageCount));
  const productTitle = typeof body.productTitle === "string" ? body.productTitle.slice(0, 200) : "";

  // Lernspeicher füttern — nie fatal, blockiert die Antwort nicht spürbar.
  const learn = () => learnFromApply(productTitle, ops).catch(() => {});

  if (session.isAdmin) {
    await learn();
    return NextResponse.json({ ok: true, cost: 0, tier, mode });
  }
  if (!session.lizenzschluessel) return NextResponse.json({ error: "Kein Kundenkonto." }, { status: 403 });
  const kunde = await findKundeByKey(session.lizenzschluessel);
  if (!kunde) return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });

  const cost = await getCreditCost(aiTierCreditKey(tier, mode));
  if (cost > 0) {
    try {
      const result = await deductCredits(kunde.rowIndex, kunde.profile, cost, mode === "expert" ? "theme-ai-expert" : "theme-ai");
      if (!result.success) {
        return NextResponse.json(
          { error: `Nicht genug Credits — diese Umsetzung kostet ${cost}.`, creditsRemaining: result.remaining },
          { status: 402 },
        );
      }
      await learn();
      return NextResponse.json({ ok: true, cost, tier, mode, creditsRemaining: result.remaining });
    } catch (err) {
      console.error("[theme-ai] deduct failed:", err);
      return NextResponse.json({ error: "Credit-Abzug fehlgeschlagen." }, { status: 500 });
    }
  }
  await learn();
  return NextResponse.json({ ok: true, cost: 0, tier, mode });
}
