// ─── /api/admin/api-balances ────────────────────────────────────
// Liefert den aktuellen Konto-Stand jedes Upstream-Providers für die
// Admin-Ansicht (System-Status → "AI-API Balances"). Die eigentliche
// Logik liegt in lib/api-balances (geteilt mit dem Alert-Cron).

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { checkAllBalances } from "@/lib/api-balances";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  const providers = await checkAllBalances();
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    providers,
  });
}
