// ─── /api/admin/license/expire-overdue ────────────────────────
// Walks every customer row, finds those whose
// profile.subscriptionEndsAt is in the past, and flips the
// status column to "abgelaufen". Purely a janitorial pass —
// the live licence gate at /api/license/validate already
// rejects expired subs in real time, so this cron exists only
// to keep the human-readable status column in the sheet in
// sync with reality.
//
// Two callers are allowed (same pattern as backfill-starter):
//   1. Admin session (manual button in the panel)
//   2. Cron jobs presenting `Authorization: Bearer ${CRON_SECRET}`

import { NextRequest, NextResponse } from "next/server";
import { expireOverdueSubscriptions, logSystemEvent } from "@/lib/sheets";
import { getSession } from "@/lib/session";
import { alertLowBalances } from "@/lib/api-balance-alerts";
import { maybePruneScoutCache } from "@/lib/scout-cache-prune";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function isAuthorised(req: NextRequest): Promise<{ ok: boolean; actor: string }> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") || "";
    if (auth === `Bearer ${cronSecret}`) {
      return { ok: true, actor: "cron" };
    }
  }
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
    const result = await expireOverdueSubscriptions();

    void logSystemEvent({
      level: result.expired > 0 ? "audit" : "info",
      actor: auth.actor,
      action: "license.expire_overdue",
      target: "",
      details: result,
    });

    // Piggyback: täglicher API-Guthaben-Check + Mail-Alert an den Admin,
    // wenn ein Provider-Konto knapp wird. Bewusst hier angehängt, weil
    // Vercel-Hobby keinen zusätzlichen Cron-Job zulässt. Niemals fatal.
    let apiBalances: Awaited<ReturnType<typeof alertLowBalances>> | { error: string } | undefined;
    try {
      apiBalances = await alertLowBalances();
    } catch (e) {
      apiBalances = { error: e instanceof Error ? e.message : "balance check failed" };
      console.warn("[expire-overdue] api-balance alert failed:", e);
    }

    // Piggyback 2: wöchentlich (gedrosselt) tote Video-Links aus dem
    // gemeinsamen ScoutCache entfernen. Kundengespeicherte Videos bleiben
    // unangetastet. Niemals fatal.
    let scoutPrune: Awaited<ReturnType<typeof maybePruneScoutCache>> | { error: string } | undefined;
    try {
      scoutPrune = await maybePruneScoutCache();
    } catch (e) {
      scoutPrune = { error: e instanceof Error ? e.message : "scout prune failed" };
      console.warn("[expire-overdue] scout cache prune failed:", e);
    }

    return NextResponse.json({ success: true, ...result, apiBalances, scoutPrune });
  } catch (err) {
    console.error("[license/expire-overdue] error:", err);
    void logSystemEvent({
      level: "error",
      actor: auth.actor,
      action: "license.expire_overdue.fail",
      target: "",
      details: { message: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Expire pass failed." },
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
