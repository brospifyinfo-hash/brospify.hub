// ─── /api/admin/credits/backfill-starter ─────────────────────────
// Walks every customer row, grants the 500-Credit Willkommens-Bonus
// to anyone who never received it. Bestehende Balances werden nie
// überschrieben — der Grant ist additiv (siehe `ensureStarterGrant`).
//
// Two callers are allowed:
//   1. Admin session (manual button in the panel)
//   2. Cron jobs presenting `Authorization: Bearer ${CRON_SECRET}`
//      — Vercel Cron does this automatically when CRON_SECRET is set.
//
// Vercel Cron sends GET, manuelle Klicks senden POST. Beide gehen.

import { NextRequest, NextResponse } from "next/server";
import { backfillStarterGrants, logSystemEvent } from "@/lib/sheets";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function isAuthorised(req: NextRequest): Promise<{ ok: boolean; actor: string }> {
  // 1. Cron / external trigger via bearer token.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") || "";
    if (auth === `Bearer ${cronSecret}`) {
      return { ok: true, actor: "cron" };
    }
  }
  // 2. Admin session.
  const session = await getSession();
  if (session.isLoggedIn && session.isAdmin) {
    return {
      ok: true,
      actor: session.googleEmail || session.lizenzschluessel || "admin",
    };
  }
  return { ok: false, actor: "" };
}

async function run(req: NextRequest) {
  const auth = await isAuthorised(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await backfillStarterGrants();

    void logSystemEvent({
      level: result.granted > 0 ? "audit" : "info",
      actor: auth.actor,
      action: "credits.backfill_starter",
      target: "",
      details: {
        scanned: result.scanned,
        granted: result.granted,
        skipped: result.skipped,
        errors: result.errors,
        grantedKeys: result.grantedKeys.slice(0, 50),
      },
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[backfill-starter] error:", err);
    void logSystemEvent({
      level: "error",
      actor: auth.actor,
      action: "credits.backfill_starter.fail",
      target: "",
      details: { message: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backfill failed." },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
