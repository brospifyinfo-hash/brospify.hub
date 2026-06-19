// ─── /api/cron/check-api-balances ─────────────────────────────────
// Prüft alle API-Provider-Guthaben und mailt an brospify.info@gmail.com,
// wenn etwas niedrig/leer ist (Logik + Entprellung in lib/api-balance-
// alerts). Läuft automatisch täglich, weil er an den expire-overdue-Cron
// angehängt ist (Vercel-Hobby erlaubt keine zusätzlichen Cron-Jobs); dieser
// Endpoint dient zum MANUELLEN Auslösen (Admin-Panel / "jetzt prüfen").
//
// Auth: `Authorization: Bearer ${CRON_SECRET}` ODER Admin-Session.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { alertLowBalances } from "@/lib/api-balance-alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function isAuthorised(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`) {
    return true;
  }
  const session = await getSession();
  return !!(session.isLoggedIn && session.isAdmin);
}

async function run(req: NextRequest) {
  if (!(await isAuthorised(req))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const result = await alertLowBalances();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}
