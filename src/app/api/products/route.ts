import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getProdukteBysku } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.isAdmin) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    if (!session.sku) {
      return NextResponse.json({ error: "Keine SKU zugewiesen" }, { status: 400 });
    }

    const produkte = await getProdukteBysku(session.sku);

    // Group by month
    const grouped: Record<string, typeof produkte> = {};
    for (const p of produkte) {
      if (!p.monat) continue;
      if (!grouped[p.monat]) grouped[p.monat] = [];
      grouped[p.monat].push(p);
    }

    // Sort months descending (MM/YYYY format)
    const sortedMonths = Object.keys(grouped).sort((a, b) => {
      const [ma, ya] = a.split("/").map(Number);
      const [mb, yb] = b.split("/").map(Number);
      if (yb !== ya) return yb - ya;
      return mb - ma;
    });

    // Sort products within each month by trendScore descending
    const result = sortedMonths.map((monat) => ({
      monat,
      produkte: grouped[monat].sort((a, b) => {
        const scoreA = a.extra?.stats?.trendScore ?? 0;
        const scoreB = b.extra?.stats?.trendScore ?? 0;
        return scoreB - scoreA;
      }),
    }));

    return NextResponse.json({ charts: result });
  } catch (error) {
    console.error("Products fetch error:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Produkte." },
      { status: 500 }
    );
  }
}
