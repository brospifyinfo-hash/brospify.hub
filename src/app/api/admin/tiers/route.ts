// ─── /api/admin/tiers ────────────────────────────────────────────
// Read & update the live tier price config (Settings sheet, key
// `tier_config_json`). The defaults seed the file the first time
// the panel opens; user edits persist across deploys.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { logSystemEvent } from "@/lib/sheets";
import { getTierConfig, setTierConfig, type TierDefinition } from "@/lib/tiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }
  const tiers = await getTierConfig();
  return NextResponse.json({ tiers });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  let body: { tiers?: TierDefinition[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  if (!Array.isArray(body.tiers)) {
    return NextResponse.json({ error: "tiers muss ein Array sein." }, { status: 400 });
  }

  const saved = await setTierConfig(body.tiers);
  const actor = session.googleEmail || session.lizenzschluessel || "admin";
  void logSystemEvent({
    level: "audit",
    actor,
    action: "tiers.update",
    target: "",
    details: { tiers: saved },
  });
  return NextResponse.json({ tiers: saved });
}
