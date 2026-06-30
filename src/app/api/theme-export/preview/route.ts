// ─── /api/theme-export/preview ───────────────────────────────────
// Liefert die DATEN für die getreue Nachbildung der Produktseiten-Oberseite
// (main-product: Galerie + Infospalte bis VOR der Beschreibung). Texte aus
// themeCopy, sonst polierte Defaults — nie ein rohes [[TOKEN]]. Kostenlos,
// kein Liquid-Render (zuverlässig, schnell). Theming passiert clientseitig.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllProdukte, findKundeByKey, type Produkt } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function httpImages(p: Produkt): string[] {
  const out: string[] = [];
  const push = (u?: string) => { if (u && /^https?:\/\//i.test(u) && !out.includes(u)) out.push(u); };
  push(p.bildUrl);
  for (const u of p.extra?.images || []) push(u);
  return out.slice(0, 5);
}
function toEur(s: string): number {
  const cleaned = String(s).replace(/[^\d.,]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const eur = parseFloat(cleaned);
  return Number.isFinite(eur) && eur > 0 ? eur : 29.99;
}
function eur(n: number): string {
  return n.toFixed(2).replace(".", ",") + " €";
}
function dateIn(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  if (days === 0) return "Heute";
  if (days === 1) return "Morgen";
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "long" }).format(d);
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

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
  const cp = (key: string, fb: string): string => {
    const v = tc[key];
    return typeof v === "string" && v.trim() && !/^\[\[[A-Z0-9_]+\]\]$/.test(v) ? v : fb;
  };
  const stripHtml = (s: string) => s.replace(/<[^>]+>/g, "").trim();

  const base = toEur(produkt.preis);
  // Mengen-Bundles aus dem Basispreis (Staffelrabatt) — wie ein echter Shop.
  const bundles = [
    { qty: 1, label: "1 Stück", total: base, badge: "", popular: false, save: 0 },
    { qty: 2, label: "2 Stück", total: base * 2 * 0.85, badge: "Beliebt", popular: true, save: 15 },
    { qty: 3, label: "3 Stück", total: base * 3 * 0.75, badge: "Bestes Angebot", popular: false, save: 25 },
  ].map((b) => ({
    label: b.label,
    badge: b.badge,
    popular: b.popular,
    price: eur(b.total),
    perUnit: eur(b.total / b.qty) + " / Stück",
    save: b.save ? `-${b.save}%` : "",
  }));

  return NextResponse.json(
    {
      title: produkt.titel || "Dein Produkt",
      images: httpImages(produkt),
      badge: cp("PRODUCT_BADGE_TEXT", "BESTSELLER"),
      urgencyPrefix: "Bestelle innerhalb der nächsten",
      urgencyTime: "1 Std. 8 Min.",
      urgencySuffix: "— Versand noch heute!",
      ratingValue: "4.9",
      ratingText: cp("PRODUCT_RATING_TEXT", "361 Bewertungen"),
      usps: [
        cp("PRODUCT_USP_1", "Kostenloser Versand"),
        cp("PRODUCT_USP_2", "30 Tage Rückgaberecht"),
        cp("PRODUCT_USP_3", "Sichere Bezahlung"),
        cp("PRODUCT_USP_4", "Premium-Qualität"),
      ],
      stock: cp("PRODUCT_STOCK_TEXT", "Auf Lager — nur noch wenige verfügbar"),
      price: eur(base),
      comparePrice: eur(base * 1.6),
      bundleHeading: cp("BUNDLE_HEADING", "Wähle dein Paket & spare"),
      bundles,
      cta: cp("SLIDE_1_BTN_TEXT", "In den Warenkorb"),
      giftTitle: cp("GIFT_TITLE", "Sichere dir dein Gratis-Geschenk"),
      giftSubtitle: cp("GIFT_SUBTITLE", "Bei jeder Bestellung — solange der Vorrat reicht."),
      timeline: [
        { label: "Bestellt", date: dateIn(0) },
        { label: "Versendet", date: dateIn(1) },
        { label: "Zugestellt", date: dateIn(3) },
      ],
      reviewQuote: stripHtml(cp("REVIEW2_1_QUOTE", "Beste Entscheidung seit langem — ich nutze es täglich!")),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
