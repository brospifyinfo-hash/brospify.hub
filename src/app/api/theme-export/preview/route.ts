// ─── /api/theme-export/preview ───────────────────────────────────
// Rendert die ECHTE Theme-Seite (Home oder Produkt) serverseitig per Liquid
// und liefert fertiges HTML für die Live-Vorschau (iframe). Farb-Palette +
// Schrift werden wie beim Download angewandt. Kostenlos, kein Credit, kein
// KI-Call.
//
//   POST { productId, page: "home"|"product", colors:{…}, font }

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllProdukte, findKundeByKey, type Produkt } from "@/lib/sheets";
import { getMasterThemeZip } from "@/lib/theme-master";
import { renderThemePage, RENDER_FONTS, type RenderProduct } from "@/lib/theme-render";
import { isValidColors, isValidFontHandle, type ThemeColors } from "@/lib/theme-inject";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function httpImages(produkt: Produkt): string[] {
  const out: string[] = [];
  const push = (u?: string) => {
    if (u && /^https?:\/\//i.test(u) && !out.includes(u)) out.push(u);
  };
  push(produkt.bildUrl);
  for (const u of produkt.extra?.images || []) push(u);
  return out.slice(0, 8);
}

/** "29,99 €" / "29.99" / 2999 → Cent. */
function toCents(price: string): number {
  const cleaned = String(price).replace(/[^\d.,]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const eur = parseFloat(cleaned);
  if (!Number.isFinite(eur) || eur <= 0) return 2999;
  return Math.round(eur * 100);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  let body: { productId?: string; page?: string; colors?: Partial<ThemeColors>; font?: string; headingFont?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 });
  }

  const productId = body.productId || "";
  const page = body.page === "product" ? "product.json" : "index.json";
  const colors = body.colors;
  const font = body.font && RENDER_FONTS[body.font] ? body.font : "work_sans_n4";
  const headingFont = body.headingFont && RENDER_FONTS[body.headingFont] ? body.headingFont : font;

  if (!productId) return NextResponse.json({ error: "productId fehlt." }, { status: 400 });
  if (!isValidColors(colors) || !isValidFontHandle(font)) {
    return NextResponse.json({ error: "Ungültige Vorschau-Parameter." }, { status: 400 });
  }

  let produkt: Produkt | undefined;
  try {
    produkt = (await getAllProdukte()).find((p) => p.id === productId);
  } catch (err) {
    console.error("[theme-preview] getAllProdukte failed:", err);
    return NextResponse.json({ error: "Produkte konnten nicht geladen werden." }, { status: 500 });
  }
  if (!produkt) return NextResponse.json({ error: "Produkt nicht gefunden." }, { status: 404 });

  // Autorisierung (wie Export): Admin oder Produkt gezogen.
  if (!session.isAdmin) {
    if (!session.lizenzschluessel) {
      return NextResponse.json({ error: "Kein Kundenkonto." }, { status: 403 });
    }
    const kunde = await findKundeByKey(session.lizenzschluessel);
    const drawn = Array.isArray(kunde?.profile?.drawnProducts) ? kunde!.profile.drawnProducts : [];
    if (!drawn.includes(produkt.id)) {
      return NextResponse.json({ error: "Dieses Produkt hast du noch nicht gezogen." }, { status: 403 });
    }
  }

  const priceCents = toCents(produkt.preis);
  const sell = produkt.extra?.finances?.recommendedSellPrice;
  const compareCents = sell && sell > 0 ? Math.round(sell * 1.6 * 100) : Math.round(priceCents * 1.6);

  const renderProduct: RenderProduct = {
    title: produkt.titel || "Produkt",
    priceCents,
    compareCents,
    images: httpImages(produkt),
    descriptionHtml: produkt.beschreibung || "",
  };

  try {
    const master = await getMasterThemeZip();
    const html = await renderThemePage(master, {
      template: page,
      themeCopy: produkt.extra?.themeCopy || {},
      product: renderProduct,
      palette: colors as ThemeColors,
      font,
      headingFont,
    });
    return NextResponse.json({ html }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[theme-preview] render failed:", err);
    const msg = err instanceof Error ? err.message : "Vorschau konnte nicht erstellt werden.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
