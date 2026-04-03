import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { bulkAddProdukte } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const items = Array.isArray(body) ? body : body.produkte || body.products || [];

    if (!items.length) {
      return NextResponse.json({ error: "Keine Produkte im JSON." }, { status: 400 });
    }

    const produkte = items.map((item: Record<string, unknown>) => {
      const stats = item.stats as Record<string, number> | undefined;
      const finances = item.finances as Record<string, number> | undefined;
      const links = item.links as Record<string, string> | undefined;
      const images = (item.images as string[]) || [];

      return {
        id: (item.id as string) || `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        sku: (item.sku as string) || (item.SKU as string) || "",
        monat: (item.monat as string) || (item.Monat as string) || "",
        titel: (item.title as string) || (item.titel as string) || (item.Titel as string) || "",
        bildUrl: images[0] || (item.bildUrl as string) || (item.Bild_URL as string) || "",
        beschreibung: (item.description as string) || (item.beschreibung as string) || (item.Beschreibung as string) || "",
        preis: String(finances?.recommendedSellPrice || item.preis || item.Preis || ""),
        aliExpressLink: links?.aliexpressLink || (item.aliExpressLink as string) || (item.AliExpress_Link as string) || "",
        extra: {
          stats: stats ? {
            trendScore: stats.trendScore || 0,
            viralScore: stats.viralScore || 0,
            impulseBuyFactor: stats.impulseBuyFactor || 0,
            problemSolverIndex: stats.problemSolverIndex || 0,
            marketSaturation: stats.marketSaturation || 0,
          } : undefined,
          finances: finances ? {
            buyPrice: finances.buyPrice || 0,
            recommendedSellPrice: finances.recommendedSellPrice || 0,
            profitMargin: finances.profitMargin || 0,
          } : undefined,
          images: images.length > 0 ? images : undefined,
        },
      };
    });

    await bulkAddProdukte(produkte);
    return NextResponse.json({ success: true, count: produkte.length, message: `${produkte.length} Produkte importiert.` });
  } catch (error) {
    console.error("Bulk import error:", error);
    return NextResponse.json({ error: "Fehler beim Import." }, { status: 500 });
  }
}
