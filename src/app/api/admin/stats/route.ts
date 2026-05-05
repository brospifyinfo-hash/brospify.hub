// ─── /api/admin/stats ────────────────────────────────────────────
// Admin-only stats endpoint. Walks every Kunde row, parses each
// profile's credits.log, and aggregates everything in one pass.
// Returns a JSON shape ready to drop into the Dashboard view —
// KPIs, hour×day activity heatmap, tool-usage breakdown, top
// spenders, and customer-growth signals.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getAllKunden,
  type CreditTransaction,
} from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ToolUsage {
  reason: string;
  count: number;
  totalCredits: number;
}

interface TopUser {
  lizenzschluessel: string;
  email: string;
  shopDomain: string;
  balance: number;
  used30d: number;
  txCount30d: number;
}

interface StatsResponse {
  generatedAt: string;
  customers: {
    total: number;
    activeLast7d: number;
    activeLast30d: number;
    withShopify: number;
    withGoogle: number;
    starterGranted: number;
  };
  credits: {
    sumBalance: number;
    sumTotalPurchased: number;
    sumTotalUsed: number;
    avgBalance: number;
    avgUsed: number;
  };
  /** 24×7 grid: heatmap[dayOfWeek][hour] = transaction count.
   *  dayOfWeek: 0 = Mon … 6 = Sun (German convention). */
  heatmap: number[][];
  /** Daily transaction counts over the last 14 days, oldest first. */
  daily14d: { date: string; deduct: number; topup: number; admin: number }[];
  /** Tool usage breakdown — derived from deduct entries' `reason`. */
  toolUsage: ToolUsage[];
  /** Top 10 customers by credits used in the last 30 days. */
  topUsers: TopUser[];
  /** Most-recent N transactions across the whole platform. */
  recentTx: (CreditTransaction & { customer: string; email: string })[];
}

function dayOfWeekDe(d: Date): number {
  // JS getUTCDay: 0=Sun…6=Sat. We want Monday=0…Sunday=6.
  return (d.getUTCDay() + 6) % 7;
}

function isoDay(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  try {
    const kunden = await getAllKunden();
    const now = Date.now();
    const t7d = now - 7 * 24 * 60 * 60 * 1000;
    const t30d = now - 30 * 24 * 60 * 60 * 1000;
    const t14d = now - 14 * 24 * 60 * 60 * 1000;

    // Aggregators
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const dailyMap = new Map<string, { deduct: number; topup: number; admin: number }>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      dailyMap.set(d.toISOString().slice(0, 10), { deduct: 0, topup: 0, admin: 0 });
    }
    const toolMap = new Map<string, { count: number; total: number }>();
    const allTx: (CreditTransaction & { customer: string; email: string })[] = [];

    let activeLast7d = 0;
    let activeLast30d = 0;
    let withShopify = 0;
    let withGoogle = 0;
    let starterGranted = 0;
    let sumBalance = 0;
    let sumTotalPurchased = 0;
    let sumTotalUsed = 0;
    const topUserMap = new Map<string, { tx: number; used: number; email: string; shopDomain: string; balance: number; key: string }>();

    for (const k of kunden) {
      if (!k.lizenzschluessel) continue;
      const c = k.profile.credits;
      const log = Array.isArray(c?.log) ? c.log : [];

      sumBalance += Math.max(0, c?.balance ?? 0);
      sumTotalPurchased += Math.max(0, c?.totalPurchased ?? 0);
      sumTotalUsed += Math.max(0, c?.totalUsed ?? 0);
      if (k.shopifyToken) withShopify++;
      if (k.profile.linkedGoogleEmail) withGoogle++;
      if (c?.starterGranted) starterGranted++;

      // Activity rollups
      let userActive7d = false;
      let userActive30d = false;
      let userUsed30d = 0;
      let userTx30d = 0;

      for (const tx of log) {
        const ts = Date.parse(tx.ts);
        if (!Number.isFinite(ts)) continue;

        // Heatmap (Mon–Sun × 0–23)
        const dt = new Date(ts);
        const dow = dayOfWeekDe(dt);
        const hour = dt.getUTCHours();
        heatmap[dow][hour]++;

        // Daily 14d bucket
        if (ts >= t14d) {
          const k14 = isoDay(ts);
          const bucket = dailyMap.get(k14);
          if (bucket) {
            if (tx.type === "deduct") bucket.deduct++;
            else if (tx.type === "topup") bucket.topup++;
            else if (tx.type === "admin-grant" || tx.type === "admin-revoke") bucket.admin++;
          }
        }

        // Tool usage (from deduct entries)
        if (tx.type === "deduct") {
          const reason = tx.reason || "unknown";
          const t = toolMap.get(reason) || { count: 0, total: 0 };
          t.count++;
          t.total += Math.abs(tx.delta);
          toolMap.set(reason, t);
        }

        // Top user / activity
        if (ts >= t30d) {
          userActive30d = true;
          userTx30d++;
          if (tx.type === "deduct") userUsed30d += Math.abs(tx.delta);
        }
        if (ts >= t7d) userActive7d = true;

        // Recent transactions feed
        allTx.push({
          ...tx,
          customer: k.lizenzschluessel,
          email: k.kundenEmail || "",
        });
      }

      if (userActive7d) activeLast7d++;
      if (userActive30d) activeLast30d++;

      if (userTx30d > 0) {
        topUserMap.set(k.lizenzschluessel, {
          tx: userTx30d,
          used: userUsed30d,
          email: k.kundenEmail,
          shopDomain: k.shopDomain,
          balance: c?.balance ?? 0,
          key: k.lizenzschluessel,
        });
      }
    }

    const customerCount = kunden.filter((k) => k.lizenzschluessel).length;

    // Sort recent tx newest first, keep top 12
    allTx.sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
    const recentTx = allTx.slice(0, 12);

    // Top 10 users by used30d
    const topUsers: TopUser[] = Array.from(topUserMap.values())
      .sort((a, b) => b.used - a.used)
      .slice(0, 10)
      .map((u) => ({
        lizenzschluessel: u.key,
        email: u.email,
        shopDomain: u.shopDomain,
        balance: u.balance,
        used30d: u.used,
        txCount30d: u.tx,
      }));

    // Tool usage as sorted list
    const toolUsage: ToolUsage[] = Array.from(toolMap.entries())
      .map(([reason, v]) => ({ reason, count: v.count, totalCredits: v.total }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const daily14d = Array.from(dailyMap.entries()).map(([date, v]) => ({
      date,
      ...v,
    }));

    const out: StatsResponse = {
      generatedAt: new Date().toISOString(),
      customers: {
        total: customerCount,
        activeLast7d,
        activeLast30d,
        withShopify,
        withGoogle,
        starterGranted,
      },
      credits: {
        sumBalance,
        sumTotalPurchased,
        sumTotalUsed,
        avgBalance: customerCount > 0 ? Math.round(sumBalance / customerCount) : 0,
        avgUsed: customerCount > 0 ? Math.round(sumTotalUsed / customerCount) : 0,
      },
      heatmap,
      daily14d,
      toolUsage,
      topUsers,
      recentTx,
    };

    return NextResponse.json(out);
  } catch (err) {
    console.error("[admin/stats] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fehler beim Laden der Stats." },
      { status: 500 },
    );
  }
}
