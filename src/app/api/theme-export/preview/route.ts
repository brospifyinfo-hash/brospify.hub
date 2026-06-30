// ─── /api/theme-export/preview ───────────────────────────────────
// Rendert die PRODUKTSEITE 1:1 aus dem Editor-Basis-Theme (zuletzt
// hochgeladenes Theme bzw. Schablone) als echtes Liquid-HTML für die Live-
// Vorschau. Farben/Schriften/Ecken/Stil werden exakt wie beim Download
// angewandt → Vorschau = Download. Verkaufstexte aus themeCopy (fehlt etwas,
// greifen polierte Beispiel-Defaults — nie ein rohes [[TOKEN]]). Kostenlos.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllProdukte, findKundeByKey, type Produkt } from "@/lib/sheets";
import { getEditorBaseThemeZip } from "@/lib/theme-master";
import { renderThemePage, type RenderProduct } from "@/lib/theme-render";
import { isValidColors, isValidFontHandle, type ThemeColors } from "@/lib/theme-inject";
import { getThemeStyle, radiusOverrides, radiusForStyle } from "@/lib/theme-styles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function httpImages(p: Produkt): string[] {
  const out: string[] = [];
  const push = (u?: string) => { if (u && /^https?:\/\//i.test(u) && !out.includes(u)) out.push(u); };
  push(p.bildUrl);
  for (const u of p.extra?.images || []) push(u);
  return out.slice(0, 7);
}
function toCents(s: string): number {
  const cleaned = String(s).replace(/[^\d.,]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const eur = parseFloat(cleaned);
  return Number.isFinite(eur) && eur > 0 ? Math.round(eur * 100) : 2999;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  let body: { productId?: string; colors?: Partial<ThemeColors>; font?: string; headingFont?: string; style?: string; radius?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 });
  }

  const productId = body.productId || "";
  const font = isValidFontHandle(body.font || "") ? (body.font as string) : "work_sans_n4";
  const headingFont = isValidFontHandle(body.headingFont || "") ? (body.headingFont as string) : font;
  const colors: ThemeColors = isValidColors(body.colors)
    ? (body.colors as ThemeColors)
    : { button: "#111111", buttonText: "#ffffff", background: "#ffffff", text: "#1a1a1a", accent: "#2f6bff" };
  const style = getThemeStyle(body.style);
  const radius = typeof body.radius === "number" ? body.radius : radiusForStyle(style);

  if (!productId) return NextResponse.json({ error: "productId fehlt." }, { status: 400 });

  let produkt: Produkt | undefined;
  try {
    produkt = (await getAllProdukte()).find((p) => p.id === productId);
  } catch (err) {
    console.error("[theme-preview] getAllProdukte failed:", err);
    return NextResponse.json({ error: "Produkte konnten nicht geladen werden." }, { status: 500 });
  }
  if (!produkt) return NextResponse.json({ error: "Produkt nicht gefunden." }, { status: 404 });

  if (!session.isAdmin) {
    if (!session.lizenzschluessel) return NextResponse.json({ error: "Kein Kundenkonto." }, { status: 403 });
    const kunde = await findKundeByKey(session.lizenzschluessel);
    const drawn = Array.isArray(kunde?.profile?.drawnProducts) ? kunde!.profile.drawnProducts : [];
    if (!drawn.includes(produkt.id)) {
      return NextResponse.json({ error: "Dieses Produkt hast du noch nicht gezogen." }, { status: 403 });
    }
  }

  const desc = (produkt.beschreibung || "").trim();
  const product: RenderProduct = {
    title: produkt.titel || "Dein Produkt",
    priceCents: toCents(produkt.preis),
    compareCents: Math.round(toCents(produkt.preis) * 1.6),
    images: httpImages(produkt),
    descriptionHtml: desc ? (/<\w+/.test(desc) ? desc : `<p>${desc}</p>`) : "<p>Hochwertiges Produkt — sorgfältig ausgewählt und gemacht, um zu überzeugen.</p>",
  };

  try {
    const { zip, key } = await getEditorBaseThemeZip();
    const html = await renderThemePage(
      zip,
      {
        template: "product.json",
        themeCopy: produkt.extra?.themeCopy || {},
        product,
        palette: colors,
        font,
        headingFont,
        hiddenTypes: style.hiddenTypes,
        settingOverrides: { ...style.settingOverrides, ...radiusOverrides(radius) },
        // kein limitSections → ganze Produktseite 1:1
      },
      key,
    );
    return NextResponse.json({ html }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[theme-preview] render failed:", err);
    return NextResponse.json({ error: "Vorschau konnte nicht gerendert werden." }, { status: 500 });
  }
}
