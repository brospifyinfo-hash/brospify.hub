// ─── /api/admin/api-balances ────────────────────────────────────
// Liefert den aktuellen Konto-Stand jedes Upstream-Providers für die
// Admin-Ansicht. Provider mit echter Balance-API (Apify/DeepSeek/Tavily)
// kommen aus lib/api-balances; für die übrigen (Anthropic/Fal/Replicate/
// Resend) wird der lokal mitgeführte Verbrauchs-Stand (provider-usage)
// angehängt, damit der Admin auch dort eine konkrete Zahl sieht.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { checkAllBalances } from "@/lib/api-balances";
import { getProviderLedger } from "@/lib/provider-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  const [providers, ledger] = await Promise.all([checkAllBalances(), getProviderLedger()]);

  const merged = providers.map((p) => {
    const e = ledger[p.provider as keyof typeof ledger];
    if (e?.kind === "usd") {
      return { ...p, ledgerKind: "usd" as const, ledgerUsd: e.balance };
    }
    if (e?.kind === "count") {
      return {
        ...p,
        ledgerKind: "count" as const,
        ledgerCount: {
          monthUsed: e.monthUsed,
          monthLimit: e.monthLimit,
          dayUsed: e.dayUsed,
          dayLimit: e.dayLimit,
        },
      };
    }
    return p;
  });

  return NextResponse.json({ generatedAt: new Date().toISOString(), providers: merged });
}
