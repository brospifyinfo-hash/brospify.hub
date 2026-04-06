import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllKunden } from "@/lib/sheets";
import { shopifyFetch, type ShopifyOrder } from "@/lib/shopify";

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

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const creds = await resolveShopify(session);
    if (!creds) {
      return NextResponse.json({
        revenue: 0, visitors: 0, sessions: 0, conversionRate: 0,
        ordersToday: 0, ordersThisMonth: 0, aov: 0,
        error: "shopify_not_connected",
      });
    }

    const { domain, token } = creds;
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const monthStart = `${today.slice(0, 7)}-01`;

    // Fetch this month's orders (up to 250)
    const { orders: monthOrders } = await shopifyFetch<{ orders: ShopifyOrder[] }>({
      domain, token,
      path: `/orders.json?status=any&created_at_min=${monthStart}T00:00:00Z&limit=250`,
    });

    // Filter today's orders from the monthly batch
    const todayOrders = monthOrders.filter((o) => o.created_at.startsWith(today));

    const revenueToday = todayOrders.reduce((s, o) => s + parseFloat(o.total_price || "0"), 0);
    const revenueMonth = monthOrders.reduce((s, o) => s + parseFloat(o.total_price || "0"), 0);
    const aov = monthOrders.length > 0 ? revenueMonth / monthOrders.length : 0;

    // Estimate sessions from unique cart_tokens
    const uniqueCarts = new Set(todayOrders.map((o) => o.cart_token).filter(Boolean));
    const estimatedSessions = Math.max(uniqueCarts.size * 8, todayOrders.length * 10, 1);
    const conversionRate = estimatedSessions > 0 ? (todayOrders.length / estimatedSessions) * 100 : 0;

    return NextResponse.json({
      revenue: Math.round(revenueToday * 100) / 100,
      revenueMonth: Math.round(revenueMonth * 100) / 100,
      visitors: estimatedSessions,
      sessions: estimatedSessions,
      conversionRate: Math.round(conversionRate * 100) / 100,
      ordersToday: todayOrders.length,
      ordersThisMonth: monthOrders.length,
      aov: Math.round(aov * 100) / 100,
    });
  } catch (error) {
    console.error("[KPI] Error:", error);
    return NextResponse.json({
      revenue: 0, visitors: 0, sessions: 0, conversionRate: 0,
      ordersToday: 0, ordersThisMonth: 0, aov: 0,
      error: String(error),
    });
  }
}
