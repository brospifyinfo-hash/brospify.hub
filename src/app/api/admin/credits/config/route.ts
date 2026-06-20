// ─── /api/admin/credits/config ──────────────────────────────────
// Admin read/write of the editable credit config: per-tool credit
// costs, per-tool estimated API cost (EUR), the credit icon, and the
// shop credit packages. Persisted as one JSON blob in the Settings
// sheet (key `credit_config_v1`).

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getCreditConfig, saveCreditConfig } from "@/lib/credit-config-server";
import { mergeCreditConfig, type CreditConfig } from "@/lib/credit-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const cfg = await getCreditConfig(true);
  return NextResponse.json({ config: cfg });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: Partial<CreditConfig>;
  try {
    body = (await req.json()) as Partial<CreditConfig>;
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 });
  }

  try {
    // Merge over current effective config so a partial save never wipes
    // unrelated keys, then re-merge over defaults for full validation.
    const current = await getCreditConfig(true);
    const merged = mergeCreditConfig({
      icon: body.icon ?? current.icon,
      costs: { ...current.costs, ...(body.costs || {}) },
      apiCostsEur: { ...current.apiCostsEur, ...(body.apiCostsEur || {}) },
      packages: body.packages ?? current.packages,
    });
    const saved = await saveCreditConfig(merged);
    return NextResponse.json({ ok: true, config: saved });
  } catch (e) {
    console.error("[admin/credits/config] save error:", e);
    return NextResponse.json({ error: "Speichern fehlgeschlagen." }, { status: 500 });
  }
}
