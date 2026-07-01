// ─── /api/theme-export/preview ───────────────────────────────────
// Liefert die DATEN für die getreue Nachbildung der Produktseiten-Oberseite
// (main-product bis VOR der Beschreibung). Inhalte/Reihenfolge/Icons exakt wie
// im echten Brospify-Theme; Verkaufstexte aus themeCopy, sonst die Theme-
// Defaults — nie ein rohes [[TOKEN]]. Kostenlos, kein Liquid (zuverlässig).

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
const money = (n: number) => n.toFixed(2).replace(".", ",") + " €";
function dateIn(days: number, withWeekday = false): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  if (days === 0) return "Heute";
  if (days === 1) return "Morgen";
  return new Intl.DateTimeFormat("de-DE", withWeekday ? { weekday: "short", day: "2-digit", month: "long" } : { day: "2-digit", month: "long" }).format(d);
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

  const base = toEur(produkt.preis);
  const compare = base * 1.6;
  // Mengen-Bundles wie im echten bundle_selector (1×, 2× -15 %, 3× -25 %).
  const mk = (qty: number, disc: number, badge: string, popular: boolean) => {
    const total = base * qty * (1 - disc / 100);
    return { label: `${qty} Stück`, price: money(total), perUnit: money(total / qty) + " / Stück", badge, save: disc ? `-${disc}%` : "", popular };
  };

  return NextResponse.json(
    {
      title: produkt.titel || "Dein Produkt",
      images: httpImages(produkt),
      badge: cp("PRODUCT_BADGE_TEXT", "BESTSELLER"),
      // 1. urgency_text (oben, rot)
      offerEndText: `Angebot endet am ${dateIn(2)}`,
      // 4. rating
      ratingValue: "4.9",
      ratingText: cp("PRODUCT_RATING_TEXT", "361 Bewertungen"),
      // 5. benefits_list (Emoji in dunklen Kreisen)
      benefits: [
        { emoji: "🚚", text: cp("PRODUCT_USP_1", "Kostenloser Blitzversand") },
        { emoji: "↩️", text: cp("PRODUCT_USP_2", "30 Tage Rückgaberecht") },
        { emoji: "🛡️", text: cp("PRODUCT_USP_3", "100% Sichere Bezahlung") },
        { emoji: "⭐", text: cp("PRODUCT_USP_4", "Premium-Qualität") },
      ],
      // 6. stock
      stock: cp("PRODUCT_STOCK_TEXT", "Auf Lager – Sofort verfügbar"),
      // 9. price
      price: money(base),
      comparePrice: money(compare),
      discount: `-${Math.round((1 - base / compare) * 100)}%`,
      // 10. bundle_selector
      bundleHeading: cp("BUNDLE_HEADING", "Zeitlich begrenztes Angebot"),
      bundles: [mk(1, 0, "", false), mk(2, 15, "Am beliebtesten", true), mk(3, 25, "Bestes Angebot", false)],
      // 11. buy_buttons
      cta: cp("SLIDE_1_BTN_TEXT", "In den Warenkorb"),
      // 12. payment_icons
      payHeading: "Sicher bezahlen mit",
      // 13. free_gift
      giftTitle: cp("GIFT_TITLE", "Sichere dir dein Geschenk"),
      giftSubtitle: cp("GIFT_SUBTITLE", "Wähle einen Artikel aus — er wird deinem Warenkorb kostenlos hinzugefügt."),
      // 14. delivery_timeline (Countdown + Bestellt/Versendet/Zugestellt)
      countdownPrefix: "Wenn du innerhalb",
      countdown: "1 Std. 8 Min.",
      countdownSuffix: "bestellst!",
      timeline: [
        { icon: "bag", label: "Bestellt", date: dateIn(0) },
        { icon: "truck", label: "Versendet", date: dateIn(1) },
        { icon: "package", label: "Zugestellt", date: dateIn(3) },
      ],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
