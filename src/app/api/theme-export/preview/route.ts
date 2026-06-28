// ─── /api/theme-export/preview ───────────────────────────────────
// Liefert SAUBERE Daten für den Live-Vorschau-Mockup (eine Produkt-Ansicht):
// Titel, Preis, Bild + Verkaufstexte. Nutzt die generierten themeCopy-Texte,
// wenn vorhanden — sonst polierte Beispiele. Niemals rohe [[TOKEN]]. Schnell
// (kein Liquid-Render). Kostenlos, kein Credit.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllProdukte, findKundeByKey, type Produkt } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function firstHttpImage(p: Produkt): string {
  if (p.bildUrl && /^https?:\/\//i.test(p.bildUrl)) return p.bildUrl;
  for (const u of p.extra?.images || []) if (/^https?:\/\//i.test(u)) return u;
  return "";
}
function httpImages(p: Produkt): string[] {
  const out: string[] = [];
  const push = (u?: string) => { if (u && /^https?:\/\//i.test(u) && !out.includes(u)) out.push(u); };
  push(p.bildUrl);
  for (const u of p.extra?.images || []) push(u);
  return out.slice(0, 4);
}
function fmtPrice(price: string): string {
  const cleaned = String(price).replace(/[^\d.,]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const eur = parseFloat(cleaned);
  if (!Number.isFinite(eur) || eur <= 0) return "29,99 €";
  return eur.toFixed(2).replace(".", ",") + " €";
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  const productId = req.nextUrl.searchParams.get("productId") || "";
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

  const tc = produkt.extra?.themeCopy || {};
  // themeCopy-Wert nur nutzen, wenn nicht leer und kein rohes [[TOKEN]].
  const cp = (key: string, fb: string): string => {
    const v = tc[key];
    return typeof v === "string" && v.trim() && !/^\[\[[A-Z0-9_]+\]\]$/.test(v) ? v : fb;
  };
  const stripHtml = (s: string) => s.replace(/<[^>]+>/g, "").trim();

  const fin = produkt.extra?.finances;
  const sell = fin?.recommendedSellPrice;
  const price = fmtPrice(produkt.preis);
  const comparePrice = sell && sell > 0 ? `${(Math.round(sell * 1.6 * 100) / 100).toFixed(2).replace(".", ",")} €` : "";

  return NextResponse.json(
    {
      title: produkt.titel || "Dein Produkt",
      price,
      comparePrice,
      image: firstHttpImage(produkt),
      images: httpImages(produkt),
      badge: cp("PRODUCT_BADGE_TEXT", "BESTSELLER"),
      headline: cp("SLIDE_1_HEADING", produkt.titel || "Spürbar besser im Alltag"),
      subline: cp("SLIDE_1_SUBHEADING", "Premium-Qualität, die du jeden Tag spürst — von tausenden Kunden geliebt."),
      cta: cp("SLIDE_1_BTN_TEXT", "In den Warenkorb"),
      stock: cp("PRODUCT_STOCK_TEXT", "Auf Lager — sofort lieferbar"),
      ratingText: cp("PRODUCT_RATING_TEXT", "361 Bewertungen"),
      usps: [
        cp("PRODUCT_USP_1", "Kostenloser Versand"),
        cp("PRODUCT_USP_2", "30 Tage Rückgaberecht"),
        cp("PRODUCT_USP_3", "Sichere Bezahlung"),
        cp("PRODUCT_USP_4", "Premium-Qualität"),
      ],
      reviewQuote: stripHtml(cp("REVIEW2_1_QUOTE", "Beste Entscheidung seit langem — ich nutze es täglich!")),
      reviewAuthor: cp("REVIEW2_1_AUTHOR", "Sarah M."),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
