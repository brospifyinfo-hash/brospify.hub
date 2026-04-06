import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllKunden } from "@/lib/sheets";
import { shopifyFetch, type ShopifyOrder, type ShopifyProduct } from "@/lib/shopify";

export const dynamic = "force-dynamic";

/** Resolve Shopify credentials: session first, then sheet lookup */
async function resolveShopify(session: { shopifyToken?: string; shopDomain?: string; lizenzschluessel?: string }) {
  if (session.shopifyToken && session.shopDomain) {
    return { token: session.shopifyToken, domain: session.shopDomain };
  }
  if (!session.lizenzschluessel) return null;
  const kunden = await getAllKunden();
  const kunde = kunden.find((k) => k.lizenzschluessel === session.lizenzschluessel);
  if (!kunde?.shopifyToken || !kunde?.shopDomain) return null;
  return { token: kunde.shopifyToken, domain: kunde.shopDomain };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const creds = await resolveShopify(session);
    if (!creds) {
      return NextResponse.json({ error: "shopify_not_connected" }, { status: 200 });
    }

    const { domain, token } = creds;

    // Parse date range
    const range = req.nextUrl.searchParams.get("range") || "30d";
    const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceISO = since.toISOString();

    // ── Fetch all orders in date range (paginate up to 750) ──
    let allOrders: ShopifyOrder[] = [];
    let pageInfo: string | null = null;
    let hasMore = true;
    let pageCount = 0;

    while (hasMore && pageCount < 3) {
      const pagePath: string = pageInfo
        ? `/orders.json?limit=250&page_info=${pageInfo}`
        : `/orders.json?status=any&created_at_min=${sinceISO}&limit=250`;

      const response = await fetch(`https://${domain}/admin/api/2024-01${pagePath}`, {
        headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Shopify ${response.status}: ${text}`);
      }

      const data = await response.json();
      allOrders = allOrders.concat(data.orders || []);

      // Check Link header for cursor-based pagination
      const linkHeader = response.headers.get("Link") || "";
      const nextMatch = linkHeader.match(/<[^>]*page_info=([^>&]+)[^>]*>;\s*rel="next"/);
      if (nextMatch && (data.orders || []).length === 250) {
        pageInfo = nextMatch[1];
      } else {
        hasMore = false;
      }
      pageCount++;
    }

    // ── Revenue by day ──
    const revenueByDay: Record<string, number> = {};
    for (let d = 0; d < days; d++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - d));
      revenueByDay[date.toISOString().split("T")[0]] = 0;
    }

    for (const order of allOrders) {
      const day = order.created_at.split("T")[0];
      if (revenueByDay[day] !== undefined) {
        revenueByDay[day] += parseFloat(order.total_price || "0");
      }
    }

    const revenueTimeline = Object.entries(revenueByDay).map(([date, amount]) => ({
      date,
      amount: Math.round(amount * 100) / 100,
    }));

    const totalRevenue = revenueTimeline.reduce((s, d) => s + d.amount, 0);
    const aov = allOrders.length > 0 ? totalRevenue / allOrders.length : 0;

    // ── Traffic sources ──
    const sourceCounts: Record<string, number> = { direct: 0, google: 0, social: 0, referral: 0 };

    for (const order of allOrders) {
      const ref = (order.referring_site || "").toLowerCase();
      const src = (order.source_name || "").toLowerCase();

      if (ref.includes("google") || ref.includes("bing") || ref.includes("yahoo")) {
        sourceCounts.google++;
      } else if (ref.includes("facebook") || ref.includes("instagram") || ref.includes("tiktok") || ref.includes("pinterest") || ref.includes("twitter") || ref.includes("youtube")) {
        sourceCounts.social++;
      } else if (ref && ref !== "" && ref !== "null" && !src.includes("pos") && !src.includes("draft")) {
        sourceCounts.referral++;
      } else {
        sourceCounts.direct++;
      }
    }

    const trafficTotal = Object.values(sourceCounts).reduce((s, v) => s + v, 0) || 1;
    const trafficSources = [
      { label: "Direct", value: Math.round((sourceCounts.direct / trafficTotal) * 100), color: "#95BF47" },
      { label: "Google / Organic", value: Math.round((sourceCounts.google / trafficTotal) * 100), color: "#6366f1" },
      { label: "Social Media", value: Math.round((sourceCounts.social / trafficTotal) * 100), color: "#a855f7" },
      { label: "Referral", value: Math.round((sourceCounts.referral / trafficTotal) * 100), color: "#ec4899" },
    ].filter((t) => t.value > 0);

    // Ensure they sum to 100
    const sumPct = trafficSources.reduce((s, t) => s + t.value, 0);
    if (sumPct < 100 && trafficSources.length > 0) {
      trafficSources[0].value += 100 - sumPct;
    }

    // ── Top 5 products by revenue ──
    const productRevenue: Record<string, { title: string; revenue: number; quantity: number; productId: number }> = {};

    for (const order of allOrders) {
      for (const item of order.line_items || []) {
        const key = String(item.product_id);
        if (!productRevenue[key]) {
          productRevenue[key] = { title: item.title, revenue: 0, quantity: 0, productId: item.product_id };
        }
        productRevenue[key].revenue += parseFloat(item.price) * item.quantity;
        productRevenue[key].quantity += item.quantity;
      }
    }

    const topProducts = Object.values(productRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Fetch product images
    const topProductsWithImages = await Promise.all(
      topProducts.map(async (p) => {
        try {
          const { product } = await shopifyFetch<{ product: ShopifyProduct }>({
            domain, token,
            path: `/products/${p.productId}.json?fields=id,title,image`,
          });
          return { ...p, revenue: Math.round(p.revenue * 100) / 100, image: product.image?.src || "" };
        } catch {
          return { ...p, revenue: Math.round(p.revenue * 100) / 100, image: "" };
        }
      })
    );

    // ── Conversion funnel ──
    const uniqueCheckouts = new Set(allOrders.map((o) => o.checkout_id).filter(Boolean)).size;
    const paidOrders = allOrders.filter((o) =>
      ["paid", "partially_paid", "refunded", "partially_refunded"].includes(o.financial_status)
    ).length;
    const estimatedVisitors = Math.max(uniqueCheckouts * 8, allOrders.length * 12, 1);
    const estimatedAddToCart = Math.max(uniqueCheckouts * 3, allOrders.length * 4);

    const funnel = {
      visitors: estimatedVisitors,
      addToCart: estimatedAddToCart,
      checkout: uniqueCheckouts || allOrders.length,
      purchased: paidOrders,
    };

    // ── Previous period comparison ──
    let revenueChange = 0;
    try {
      const prevSince = new Date();
      prevSince.setDate(prevSince.getDate() - days * 2);
      const prevUntil = new Date();
      prevUntil.setDate(prevUntil.getDate() - days);

      const { orders: prevOrders } = await shopifyFetch<{ orders: ShopifyOrder[] }>({
        domain, token,
        path: `/orders.json?status=any&created_at_min=${prevSince.toISOString()}&created_at_max=${prevUntil.toISOString()}&limit=250`,
      });
      const prevRevenue = prevOrders.reduce((s, o) => s + parseFloat(o.total_price || "0"), 0);
      if (prevRevenue > 0) {
        revenueChange = ((totalRevenue - prevRevenue) / prevRevenue) * 100;
      }
    } catch {
      // Previous period comparison is optional
    }

    return NextResponse.json({
      revenueTimeline,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      revenueChange: Math.round(revenueChange * 10) / 10,
      trafficSources,
      topProducts: topProductsWithImages,
      funnel,
      orderCount: allOrders.length,
      aov: Math.round(aov * 100) / 100,
      days,
    });
  } catch (error) {
    console.error("[Analytics] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
