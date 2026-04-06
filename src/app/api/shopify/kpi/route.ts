import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.shopifyToken || !session.shopDomain) {
      return NextResponse.json({ error: "Not connected" }, { status: 401 });
    }

    const domain = session.shopDomain;
    const token = session.shopifyToken;
    const today = new Date().toISOString().split("T")[0];

    // Fetch today's orders from Shopify
    const ordersRes = await fetch(
      `https://${domain}/admin/api/2024-01/orders.json?status=any&created_at_min=${today}T00:00:00Z&limit=250`,
      { headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" } }
    );

    let revenue = 0;
    let sessions = 0;
    let conversionRate = 0;

    if (ordersRes.ok) {
      const data = await ordersRes.json();
      const orders = data.orders || [];
      revenue = orders.reduce((sum: number, o: { total_price: string }) => sum + parseFloat(o.total_price || "0"), 0);
    }

    // Note: Shopify doesn't expose live visitors via REST API
    // These would need Shopify Analytics API or a custom pixel
    return NextResponse.json({
      revenue,
      visitors: 0,
      sessions,
      conversionRate,
    });
  } catch (error) {
    console.error("[KPI] Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
