// ─── /api/admin/logs ─────────────────────────────────────────────
// Paginated SystemLogs feed for the admin Logs tab. Query params:
//   limit (default 200, max 500)
//   level (info | warn | error | audit)
//   sinceDays
//   actor (substring match)
//   action (substring match)

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSystemLogs, type SystemLogLevel } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ALLOWED_LEVELS: SystemLogLevel[] = ["info", "warn", "error", "audit"];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const limit = Math.min(500, Math.max(1, Number(sp.get("limit")) || 200));
  const sinceDays = Math.max(0, Number(sp.get("sinceDays")) || 0);
  const levelRaw = sp.get("level") as SystemLogLevel | null;
  const level = levelRaw && ALLOWED_LEVELS.includes(levelRaw) ? levelRaw : undefined;
  const actor = sp.get("actor")?.trim() || undefined;
  const action = sp.get("action")?.trim() || undefined;

  const entries = await getSystemLogs({
    limit,
    level,
    sinceDays,
    actorContains: actor,
    actionContains: action,
  });

  return NextResponse.json({ entries, total: entries.length });
}
