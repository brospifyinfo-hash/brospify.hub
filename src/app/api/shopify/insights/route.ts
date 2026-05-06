import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey } from "@/lib/sheets";
import { shopifyFetch } from "@/lib/shopify";
import { requireFeature } from "@/lib/tier-guard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─── Types from Shopify ───────────────────────────────────────────
interface ShopifyLineItem {
  product_id: number;
  title: string;
  quantity: number;
  price: string;
}

interface ShopifyOrderRaw {
  id: number;
  created_at: string;
  total_price: string;
  financial_status: string;
  cancelled_at?: string | null;
  customer?: { id?: number } | null;
  line_items: ShopifyLineItem[];
}

interface OrdersResponse {
  orders: ShopifyOrderRaw[];
}

interface CheckoutRaw {
  id: number;
  created_at: string;
  completed_at: string | null;
  total_price?: string;
}

interface CheckoutsResponse {
  checkouts: CheckoutRaw[];
}

interface ShopifyProductRaw {
  id: number;
}

interface ProductsResponse {
  products: ShopifyProductRaw[];
}

// Estimated COGS multiplier — used when no per-product cost is stored.
// Conservative: assume 35% of selling price is COGS.
const ASSUMED_COGS_RATIO = 0.35;

// ─── Helpers ──────────────────────────────────────────────────────
function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function hourFromIso(iso: string): number {
  return new Date(iso).getUTCHours();
}

// ─── Main handler ─────────────────────────────────────────────────
export async function GET() {
  try {
    const session = await getSession();
    const guard = await requireFeature(session, "shopifyInsights");
    if (!guard.ok) return guard.response;

    if (session.isAdmin || !session.lizenzschluessel) {
      return NextResponse.json({ connected: false });
    }

    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde || !kunde.shopifyToken || !kunde.shopDomain) {
      return NextResponse.json({ connected: false });
    }

    const domain = kunde.shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const token = kunde.shopifyToken;

    // Pull last 60 days of orders + 14 days of checkouts in parallel.
    // We track each fetch's failure separately so the UI can tell the
    // user *why* a chart is empty (missing scope vs no orders yet vs
    // network error). The previous version silently returned empty
    // arrays on any failure, so users with old tokens (no read_orders
    // scope) saw "Shop connected" + zero data instead of a re-connect
    // prompt.
    const since60 = isoDaysAgo(60);
    const since14 = isoDaysAgo(14);

    const fetchErrors: { kind: string; status?: number; message: string }[] = [];
    const captureError = (kind: string) => (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      // shopifyFetch throws "Shopify <status>: <body>"
      const m = msg.match(/^Shopify (\d+):/);
      const status = m ? parseInt(m[1], 10) : undefined;
      fetchErrors.push({ kind, status, message: msg.slice(0, 200) });
      console.warn(`[insights] ${kind} failed (${status ?? "?"}): ${msg.slice(0, 200)}`);
      if (kind === "orders") return { orders: [] as ShopifyOrderRaw[] };
      if (kind === "checkouts") return { checkouts: [] as CheckoutRaw[] };
      return { products: [] as ShopifyProductRaw[] };
    };

    const [ordersData, checkoutsData, productsData] = await Promise.all([
      shopifyFetch<OrdersResponse>({
        domain,
        token,
        path: `/orders.json?status=any&limit=250&created_at_min=${encodeURIComponent(since60)}`,
      }).catch(captureError("orders")) as Promise<OrdersResponse>,
      shopifyFetch<CheckoutsResponse>({
        domain,
        token,
        path: `/checkouts.json?limit=250&created_at_min=${encodeURIComponent(since14)}`,
      }).catch(captureError("checkouts")) as Promise<CheckoutsResponse>,
      shopifyFetch<ProductsResponse>({
        domain,
        token,
        path: `/products.json?limit=250&fields=id,title,variants,image`,
      }).catch(captureError("products")) as Promise<ProductsResponse>,
    ]);

    // Detect missing-scope state: 401/403/scope errors on the orders
    // fetch are the most visible indicator. Tell the UI to ask for a
    // re-connect with the new scope set.
    const ordersErr = fetchErrors.find((e) => e.kind === "orders");
    const needsReconnect = !!ordersErr && (
      ordersErr.status === 401 ||
      ordersErr.status === 403 ||
      /scope|access denied|requires merchant approval/i.test(ordersErr.message)
    );
    if (needsReconnect) {
      return NextResponse.json({
        connected: true,
        needsReconnect: true,
        reconnectReason: "Dein Shop-Token hat keine Orders-Permission. Verbinde den Shop unter /setup neu — dann sind alle neuen Bereiche (read_orders, read_customers) drin.",
        debug: { fetchErrors },
      });
    }

    const orders = (ordersData.orders || []).filter(
      (o) => !o.cancelled_at && o.financial_status !== "voided" && o.financial_status !== "refunded"
    );
    const checkouts = checkoutsData.checkouts || [];
    const products = productsData.products || [];

    // ─── Today vs yesterday quick KPI ─────────────────────────────
    const todayKey = new Date().toISOString().slice(0, 10);
    const yKey = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let todayOrders = 0, todayRevenue = 0, ydayOrders = 0, ydayRevenue = 0;
    for (const o of orders) {
      const k = dayKey(o.created_at);
      const v = parseFloat(o.total_price || "0");
      if (k === todayKey) { todayOrders++; todayRevenue += v; }
      else if (k === yKey) { ydayOrders++; ydayRevenue += v; }
    }
    const today = {
      orders: todayOrders,
      revenue: +todayRevenue.toFixed(2),
      revenueDeltaPct: ydayRevenue > 0
        ? +(((todayRevenue - ydayRevenue) / ydayRevenue) * 100).toFixed(0)
        : 0,
      ordersDelta: todayOrders - ydayOrders,
    };

    // ─── 1. Conversion trend (last 14 days) ──────────────────────
    // Sessions aren't available via REST; we approximate "conversion"
    // as completed orders / (completed orders + abandoned checkouts)
    // bucketed per day.
    const now = new Date();
    const days14: { date: string; orders: number; abandoned: number; conversion: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - i);
      days14.push({ date: d.toISOString().slice(0, 10), orders: 0, abandoned: 0, conversion: 0 });
    }
    const dayMap = new Map(days14.map((d) => [d.date, d]));

    for (const o of orders) {
      const k = dayKey(o.created_at);
      const bucket = dayMap.get(k);
      if (bucket) bucket.orders++;
    }
    for (const c of checkouts) {
      if (c.completed_at) continue; // completed checkouts already counted as orders
      const k = dayKey(c.created_at);
      const bucket = dayMap.get(k);
      if (bucket) bucket.abandoned++;
    }
    for (const d of days14) {
      const total = d.orders + d.abandoned;
      d.conversion = total > 0 ? +(d.orders / total * 100).toFixed(1) : 0;
    }

    // ─── 2. Bestellwert-Entwicklung (AOV per week, last 8 weeks) ──
    const weeksMap = new Map<string, { sum: number; count: number }>();
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - i * 7);
      const key = `KW${getWeekNumber(d)}`;
      if (!weeksMap.has(key)) weeksMap.set(key, { sum: 0, count: 0 });
    }
    for (const o of orders) {
      const created = new Date(o.created_at);
      if ((now.getTime() - created.getTime()) > 56 * 24 * 60 * 60 * 1000) continue;
      const key = `KW${getWeekNumber(created)}`;
      const w = weeksMap.get(key);
      if (!w) continue;
      w.sum += parseFloat(o.total_price || "0");
      w.count++;
    }
    const aovWeeks = Array.from(weeksMap.entries()).map(([label, v]) => ({
      label,
      aov: v.count > 0 ? +(v.sum / v.count).toFixed(2) : 0,
    }));

    // ─── 3. Verkaufs-Hotspots (orders by hour of day, 60d window) ─
    const hourBuckets: number[] = Array(24).fill(0);
    for (const o of orders) {
      hourBuckets[hourFromIso(o.created_at)]++;
    }
    const hotspots = hourBuckets.map((count, hour) => ({ hour, count }));

    // Best converting hour: hour with highest order count out of total
    let bestHour = 0;
    let bestHourCount = -1;
    for (let h = 0; h < 24; h++) {
      if (hourBuckets[h] > bestHourCount) {
        bestHourCount = hourBuckets[h];
        bestHour = h;
      }
    }
    const totalOrders = orders.length;
    const bestHourPercent = totalOrders > 0 ? +(bestHourCount / totalOrders * 100).toFixed(0) : 0;

    // ─── 4. Produkt-Ranking nach geschätztem Gewinn ──────────────
    type ProductAgg = { id: number; title: string; revenue: number; units: number };
    const productAgg = new Map<number, ProductAgg>();
    for (const o of orders) {
      for (const li of o.line_items) {
        const existing = productAgg.get(li.product_id) ||
          { id: li.product_id, title: li.title, revenue: 0, units: 0 };
        existing.revenue += parseFloat(li.price || "0") * li.quantity;
        existing.units += li.quantity;
        productAgg.set(li.product_id, existing);
      }
    }
    const productRanking = Array.from(productAgg.values())
      .map((p) => ({
        id: p.id,
        title: p.title,
        units: p.units,
        revenue: +p.revenue.toFixed(2),
        estimatedProfit: +(p.revenue * (1 - ASSUMED_COGS_RATIO)).toFixed(2),
      }))
      .sort((a, b) => b.estimatedProfit - a.estimatedProfit)
      .slice(0, 5);

    // ─── 4b. Cross-Sell Pairs ────────────────────────────────────
    // Products that are frequently bought TOGETHER in the same order.
    // Standard Shopify Analytics doesn't surface this — it's the basis
    // for bundle creation and "frequently bought together" widgets.
    //
    // Algorithm: for every order with ≥2 distinct products, count
    // every (a,b) pair (a < b by id to dedupe). Top pairs are the
    // strongest co-occurrences in the customer's actual basket history.
    type PairKey = string;
    const pairCounts = new Map<PairKey, { a: number; b: number; titleA: string; titleB: string; count: number }>();

    for (const o of orders) {
      // Distinct product IDs in this order (line items can repeat the same product variant)
      const seen = new Map<number, string>();
      for (const li of o.line_items) {
        if (li.product_id && !seen.has(li.product_id)) {
          seen.set(li.product_id, li.title);
        }
      }
      const ids = Array.from(seen.keys()).sort((x, y) => x - y);
      if (ids.length < 2) continue;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = ids[i], b = ids[j];
          const key = `${a}|${b}`;
          const titleA = seen.get(a) || "";
          const titleB = seen.get(b) || "";
          const existing = pairCounts.get(key);
          if (existing) {
            existing.count++;
          } else {
            pairCounts.set(key, { a, b, titleA, titleB, count: 1 });
          }
        }
      }
    }
    const crossSellPairs = Array.from(pairCounts.values())
      .filter((p) => p.count >= 2) // at least 2 co-occurrences worth surfacing
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((p) => ({
        a: p.titleA,
        b: p.titleB,
        count: p.count,
      }));

    // ─── 5. Verpasster Umsatz (abandoned checkouts, 30d) ─────────
    const abandoned30dCutoff = new Date(now);
    abandoned30dCutoff.setUTCDate(abandoned30dCutoff.getUTCDate() - 30);
    const abandoned30dPriorCutoff = new Date(now);
    abandoned30dPriorCutoff.setUTCDate(abandoned30dPriorCutoff.getUTCDate() - 60);

    let missedRevenueCurrent = 0;
    let missedRevenuePrior = 0;
    let missedCountCurrent = 0;
    for (const c of checkouts) {
      if (c.completed_at) continue;
      const t = new Date(c.created_at).getTime();
      const v = parseFloat(c.total_price || "0");
      if (t >= abandoned30dCutoff.getTime()) {
        missedRevenueCurrent += v;
        missedCountCurrent++;
      } else if (t >= abandoned30dPriorCutoff.getTime()) {
        missedRevenuePrior += v;
      }
    }
    const missedTrend = missedRevenuePrior > 0
      ? +(((missedRevenueCurrent - missedRevenuePrior) / missedRevenuePrior) * 100).toFixed(0)
      : 0;

    // ─── 6. Wiederkehrer-Rate (returning customers %) ────────────
    // Group orders by customer id; customer with >=2 orders in window = returning.
    const ordersByCustomer = new Map<number, number>();
    for (const o of orders) {
      const cid = o.customer?.id;
      if (!cid) continue;
      ordersByCustomer.set(cid, (ordersByCustomer.get(cid) || 0) + 1);
    }
    let returningCount = 0;
    for (const cnt of ordersByCustomer.values()) if (cnt >= 2) returningCount++;
    const totalCustomers = ordersByCustomer.size;
    const returningRate = totalCustomers > 0
      ? +((returningCount / totalCustomers) * 100).toFixed(1)
      : 0;

    // Mini-trend: returning rate per week (last 6 weeks) ────────
    const returningTrend: { label: string; rate: number }[] = [];
    for (let w = 5; w >= 0; w--) {
      const winStart = new Date(now);
      winStart.setUTCDate(winStart.getUTCDate() - (w + 1) * 7);
      const winEnd = new Date(now);
      winEnd.setUTCDate(winEnd.getUTCDate() - w * 7);
      const winOrders = orders.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= winStart.getTime() && t < winEnd.getTime();
      });
      const map = new Map<number, number>();
      for (const o of winOrders) {
        const cid = o.customer?.id;
        if (!cid) continue;
        map.set(cid, (map.get(cid) || 0) + 1);
      }
      let ret = 0;
      for (const c of map.values()) if (c >= 2) ret++;
      const total = map.size;
      returningTrend.push({
        label: `KW${getWeekNumber(winStart)}`,
        rate: total > 0 ? +((ret / total) * 100).toFixed(0) : 0,
      });
    }

    // ─── 7. Empfehlung basierend auf Hotspot ────────────────────
    let recommendation = "";
    if (totalOrders >= 5) {
      const hourLabel = `${String(bestHour).padStart(2, "0")}:00`;
      recommendation = `Plane Ads & Mailings auf ${hourLabel} Uhr — hier kommt der Großteil deiner Bestellungen rein.`;
    } else {
      recommendation = "Noch zu wenig Daten. Sobald du regelmäßig Bestellungen bekommst, zeigen wir dir den besten Sendezeitpunkt.";
    }

    // ─── Response ────────────────────────────────────────────────
    return NextResponse.json({
      connected: true,
      hasOrders: totalOrders > 0,
      partialErrors: fetchErrors.length > 0 ? fetchErrors : undefined,
      window: { since: since60, until: now.toISOString(), totalOrders },
      today,
      conversionTrend: days14.map((d) => ({ date: d.date, value: d.conversion })),
      aovWeeks,
      hotspots,
      productRanking,
      crossSellPairs,
      missedRevenue: {
        amount: +missedRevenueCurrent.toFixed(2),
        count: missedCountCurrent,
        trendPct: missedTrend,
      },
      returning: {
        ratePct: returningRate,
        customers: totalCustomers,
        trend: returningTrend,
      },
      bestHour: {
        hour: bestHour,
        label: `${String(bestHour).padStart(2, "0")}:00`,
        sharePct: bestHourPercent,
        recommendation,
      },
      productCount: products.length,
    });
  } catch (error) {
    console.error("[Shopify Insights] error:", error);
    return NextResponse.json(
      { connected: false, error: "Fehler beim Laden der Insights" },
      { status: 200 }
    );
  }
}

// ISO week number (Monday-based)
function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
