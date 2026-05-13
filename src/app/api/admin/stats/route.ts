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
  type TierKey,
} from "@/lib/sheets";
import { CREDIT_PRICE_EUR, costForReason } from "@/lib/ai-costs";
import { getTierConfig, isActiveSubFromKunde, resolveTier, tierFromSku } from "@/lib/tiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ToolUsage {
  reason: string;
  count: number;
  totalCredits: number;
}

interface SkuBreakdown {
  sku: string;
  count: number;
  activeSubs: number;
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
    admins: number;
  };
  credits: {
    sumBalance: number;
    sumTotalPurchased: number;
    sumTotalUsed: number;
    avgBalance: number;
    avgUsed: number;
  };
  /** Subscription rollups — drives the new MRR / churn / signup KPIs. */
  subscriptions: {
    activeTotal: number;
    /** Per-tier active counts, keyed by TierKey. Always includes every tier. */
    byTier: Record<TierKey, number>;
    /** Live MRR in EUR (sum of active tier prices). */
    mrrEur: number;
    /** Tier price config snapshot used for this calculation. */
    pricing: { key: TierKey; label: string; priceEur: number }[];
    /** New paid subscriptions in the last 30 days. */
    newPaid30d: number;
    /** Cancellations in the last 30 days. */
    churn30d: number;
    /** churn / activeAtStart ratio, 0–100. 0 if no active. */
    churnRatePct: number;
  };
  /** Signup rollups for the "Neuanmeldungen 30d" card. */
  signups: {
    last7d: number;
    last30d: number;
    /** Daily counts oldest first, length 30. */
    daily30d: { date: string; count: number }[];
  };
  /** Top SKU categories — replaces the missing theme rental KPI. */
  topSkus: SkuBreakdown[];
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
  /** Money side: actual API cost vs. credit-pack revenue (current month). */
  money: {
    monthLabel: string;            // "2026-05"
    costThisMonthEur: number;      // sum of deduct × per-call EUR cost
    costAllTimeEur: number;        // same, all-time
    revenueThisMonthEur: number;   // sum of topup credits × CREDIT_PRICE_EUR
    revenueAllTimeEur: number;     // same, all-time
    profitThisMonthEur: number;
    profitMarginPct: number;       // (rev-cost)/rev × 100, 0 if no revenue
    /** Per-tool monthly breakdown: count + EUR cost + credits charged. */
    toolBreakdown: { reason: string; label: string; provider: string; calls: number; costEur: number; creditsCharged: number }[];
  };
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
    const tierPricing = await getTierConfig();
    const tierPriceMap = new Map<TierKey, number>(
      tierPricing.map((t) => [t.key, t.priceMonthlyEur]),
    );

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
    // 30-day signup buckets
    const signupDailyMap = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      signupDailyMap.set(d.toISOString().slice(0, 10), 0);
    }
    const toolMap = new Map<string, { count: number; total: number }>();
    const allTx: (CreditTransaction & { customer: string; email: string })[] = [];

    // ── Money rollups ──
    const monthIso = new Date().toISOString().slice(0, 7); // "2026-05"
    let costThisMonthEur = 0;
    let costAllTimeEur = 0;
    let revenueThisMonthCredits = 0;
    let revenueAllTimeCredits = 0;
    const monthlyToolMap = new Map<string, { calls: number; costEur: number; creditsCharged: number }>();

    // ── Subscription rollups ──
    const subsByTier: Record<TierKey, number> = { starter: 0, pro: 0, business: 0 };
    let mrrEur = 0;
    let newPaid30d = 0;
    let churn30d = 0;

    // ── Signup rollups ──
    let signupLast7d = 0;
    let signupLast30d = 0;

    // ── SKU rollups ──
    const skuMap = new Map<string, { count: number; activeSubs: number }>();

    let activeLast7d = 0;
    let activeLast30d = 0;
    let withShopify = 0;
    let withGoogle = 0;
    let starterGranted = 0;
    let admins = 0;
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
      if (k.profile.role === "admin") admins++;

      // ── Subscription / tier roll-up ──
      // Sheets SKU column ("Bronze"/"Silber"/"Gold") is authoritative;
      // profile.tier is only a fallback override.
      const tier = tierFromSku(k.sku) || resolveTier(k.profile.tier);
      if (tier) subsByTier[tier]++;
      if (isActiveSubFromKunde(k) && tier) {
        mrrEur += tierPriceMap.get(tier) || 0;
        const since = Date.parse(k.profile.tierSince || "");
        if (Number.isFinite(since) && since >= t30d) newPaid30d++;
      }
      const canceledTs = Date.parse(k.profile.tierCanceledAt || "");
      if (Number.isFinite(canceledTs) && canceledTs >= t30d) churn30d++;

      // ── Signup roll-up ──
      const signupTs = Date.parse(k.profile.signupAt || "");
      if (Number.isFinite(signupTs)) {
        if (signupTs >= t7d) signupLast7d++;
        if (signupTs >= t30d) {
          signupLast30d++;
          const dayKey = new Date(signupTs).toISOString().slice(0, 10);
          if (signupDailyMap.has(dayKey)) {
            signupDailyMap.set(dayKey, (signupDailyMap.get(dayKey) || 0) + 1);
          }
        }
      }

      // ── SKU breakdown — count both totals and active subs per SKU ──
      const skuKey = k.sku || "—";
      const sku = skuMap.get(skuKey) || { count: 0, activeSubs: 0 };
      sku.count++;
      if (isActiveSubFromKunde(k)) sku.activeSubs++;
      skuMap.set(skuKey, sku);

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

        // Tool usage + cost (from deduct entries)
        if (tx.type === "deduct") {
          const reason = tx.reason || "unknown";
          const t = toolMap.get(reason) || { count: 0, total: 0 };
          t.count++;
          t.total += Math.abs(tx.delta);
          toolMap.set(reason, t);

          const cost = costForReason(reason);
          costAllTimeEur += cost.eur;
          if (tx.ts.startsWith(monthIso)) {
            costThisMonthEur += cost.eur;
            const m = monthlyToolMap.get(reason) || { calls: 0, costEur: 0, creditsCharged: 0 };
            m.calls++;
            m.costEur += cost.eur;
            m.creditsCharged += Math.abs(tx.delta);
            monthlyToolMap.set(reason, m);
          }
        }

        // Revenue tracking (topup entries only)
        if (tx.type === "topup") {
          revenueAllTimeCredits += tx.delta;
          if (tx.ts.startsWith(monthIso)) {
            revenueThisMonthCredits += tx.delta;
          }
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

    const activeSubsTotal =
      subsByTier.starter + subsByTier.pro + subsByTier.business;
    const churnRatePct =
      activeSubsTotal + churn30d > 0
        ? +((churn30d / (activeSubsTotal + churn30d)) * 100).toFixed(1)
        : 0;

    const topSkus: SkuBreakdown[] = Array.from(skuMap.entries())
      .map(([sku, v]) => ({ sku, count: v.count, activeSubs: v.activeSubs }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const signupDaily30d = Array.from(signupDailyMap.entries()).map(
      ([date, count]) => ({ date, count }),
    );

    const out: StatsResponse = {
      generatedAt: new Date().toISOString(),
      customers: {
        total: customerCount,
        activeLast7d,
        activeLast30d,
        withShopify,
        withGoogle,
        starterGranted,
        admins,
      },
      credits: {
        sumBalance,
        sumTotalPurchased,
        sumTotalUsed,
        avgBalance: customerCount > 0 ? Math.round(sumBalance / customerCount) : 0,
        avgUsed: customerCount > 0 ? Math.round(sumTotalUsed / customerCount) : 0,
      },
      subscriptions: {
        activeTotal: activeSubsTotal,
        byTier: subsByTier,
        mrrEur: +mrrEur.toFixed(2),
        pricing: tierPricing.map((t) => ({ key: t.key, label: t.label, priceEur: t.priceMonthlyEur })),
        newPaid30d,
        churn30d,
        churnRatePct,
      },
      signups: {
        last7d: signupLast7d,
        last30d: signupLast30d,
        daily30d: signupDaily30d,
      },
      topSkus,
      heatmap,
      daily14d,
      toolUsage,
      topUsers,
      recentTx,
      money: (() => {
        const revenueThisMonthEur = +(revenueThisMonthCredits * CREDIT_PRICE_EUR).toFixed(2);
        const revenueAllTimeEur = +(revenueAllTimeCredits * CREDIT_PRICE_EUR).toFixed(2);
        const cm = +costThisMonthEur.toFixed(2);
        const profitThisMonthEur = +(revenueThisMonthEur - cm).toFixed(2);
        const margin = revenueThisMonthEur > 0
          ? +(((revenueThisMonthEur - cm) / revenueThisMonthEur) * 100).toFixed(1)
          : 0;
        const toolBreakdown = Array.from(monthlyToolMap.entries())
          .map(([reason, v]) => {
            const meta = costForReason(reason);
            return {
              reason,
              label: meta.label,
              provider: meta.provider,
              calls: v.calls,
              costEur: +v.costEur.toFixed(4),
              creditsCharged: v.creditsCharged,
            };
          })
          .sort((a, b) => b.costEur - a.costEur);
        return {
          monthLabel: monthIso,
          costThisMonthEur: cm,
          costAllTimeEur: +costAllTimeEur.toFixed(2),
          revenueThisMonthEur,
          revenueAllTimeEur,
          profitThisMonthEur,
          profitMarginPct: margin,
          toolBreakdown,
        };
      })(),
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
