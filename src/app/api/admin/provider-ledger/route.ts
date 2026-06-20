// ─── POST /api/admin/provider-ledger ─────────────────────────────
// Admin korrigiert den lokal mitgeführten Verbrauchs-Stand eines
// Providers (nach Aufladen oder Abgleich mit dem echten Dashboard).
//   USD-Provider (anthropic/fal/replicate): { provider, balance }
//   Resend:                                 { provider:"resend", monthUsed, dayUsed, monthLimit?, dayLimit? }

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { setLedgerEntry, type LedgerProvider } from "@/lib/provider-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID: LedgerProvider[] = ["anthropic", "fal", "replicate", "resend"];

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 });
  }
  const provider = String(body.provider || "") as LedgerProvider;
  if (!VALID.includes(provider)) {
    return NextResponse.json({ error: "Unbekannter Provider." }, { status: 400 });
  }
  try {
    if (provider === "resend") {
      await setLedgerEntry("resend", {
        monthUsed: body.monthUsed != null ? Number(body.monthUsed) : undefined,
        dayUsed: body.dayUsed != null ? Number(body.dayUsed) : undefined,
        monthLimit: body.monthLimit != null ? Number(body.monthLimit) : undefined,
        dayLimit: body.dayLimit != null ? Number(body.dayLimit) : undefined,
      });
    } else {
      const balance = Number(body.balance);
      if (!Number.isFinite(balance) || balance < 0) {
        return NextResponse.json({ error: "Gültiges Guthaben (balance) fehlt." }, { status: 400 });
      }
      await setLedgerEntry(provider, { balance });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[provider-ledger] POST error:", e);
    return NextResponse.json({ error: "Speichern fehlgeschlagen." }, { status: 500 });
  }
}
