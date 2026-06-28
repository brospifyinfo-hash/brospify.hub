// ─── /api/theme-export/preview ───────────────────────────────────
// Liefert die Daten für die Live-Vorschau des Produkt-Themes: Titel, Preis,
// Produktbilder + die zusammengeführten Theme-Texte (echte KI-Texte, falls
// vorhanden — sonst Defaults/Produkt-Fallbacks). KOSTENLOS, kein Credit, kein
// KI-Call (rein lesend), damit die Vorschau sofort lädt.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllProdukte, findKundeByKey, type Produkt } from "@/lib/sheets";
import { getPlaceholderValues } from "@/lib/theme-placeholders";
import { getMasterThemeZip } from "@/lib/theme-master";
import { readActiveSections } from "@/lib/theme-inject";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function httpImages(produkt: Produkt): string[] {
  const out: string[] = [];
  const push = (u?: string) => {
    if (u && /^https?:\/\//i.test(u) && !out.includes(u)) out.push(u);
  };
  push(produkt.bildUrl);
  for (const u of produkt.extra?.images || []) push(u);
  return out.slice(0, 6);
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

  const fin = produkt.extra?.finances;
  const sell = fin?.recommendedSellPrice;
  const price = produkt.preis || (sell ? String(sell) : "");
  // Grober „Statt"-Preis für die Vorschau (nur Optik): Verkaufspreis × 1.6.
  const comparePrice =
    sell && sell > 0 ? `${(Math.round(sell * 1.6 * 100) / 100).toFixed(2).replace(".", ",")}€` : "";

  // Echte aktive Sections (1:1 aus dem Theme, Tokens ersetzt) für die Vorschau.
  let sections: { home: unknown[]; product: unknown[] } = { home: [], product: [] };
  try {
    const master = await getMasterThemeZip();
    sections = readActiveSections(master, produkt.extra?.themeCopy || {});
  } catch (err) {
    console.error("[theme-preview] readActiveSections failed:", err);
  }

  return NextResponse.json(
    {
      title: produkt.titel,
      price,
      comparePrice,
      images: httpImages(produkt),
      hasCopy: Boolean(produkt.extra?.themeCopy && Object.keys(produkt.extra.themeCopy).length),
      copy: getPlaceholderValues(produkt.extra?.themeCopy),
      home: sections.home,
      product: sections.product,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
