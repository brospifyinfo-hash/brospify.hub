// ─── /api/theme-export ────────────────────────────────────────────
// Kunden-Download: baut aus der Master-Schablone ein personalisiertes
// Shopify-Theme (Produkt-Texte aus extra.themeCopy + Hauptfarbe + Schrift)
// und liefert es als .zip.
//
//   GET ?productId=&color=%23rrggbb&font=work_sans_n4
//
// Voraussetzung: Der Kunde hat das Produkt gezogen (drawnProducts) ODER ist
// Admin, und für das Produkt wurden bereits Theme-Texte generiert.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllProdukte, findKundeByKey, type Produkt } from "@/lib/sheets";
import { getMasterThemeZip } from "@/lib/theme-master";
import { buildThemeZip, isValidHex, isValidFontHandle } from "@/lib/theme-inject";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function slugify(name: string): string {
  return (
    (name || "theme")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "theme"
  );
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const url = req.nextUrl.searchParams;
  const productId = url.get("productId") || "";
  const color = url.get("color") || "";
  const font = url.get("font") || "";

  if (!productId) return NextResponse.json({ error: "productId fehlt." }, { status: 400 });
  if (!isValidHex(color)) {
    return NextResponse.json({ error: "Ungültige Farbe (erwartet Hex wie #95bf47)." }, { status: 400 });
  }
  if (!isValidFontHandle(font)) {
    return NextResponse.json({ error: "Ungültige Schriftart." }, { status: 400 });
  }

  // Produkt laden.
  let produkt: Produkt | undefined;
  try {
    produkt = (await getAllProdukte()).find((p) => p.id === productId);
  } catch (err) {
    console.error("[theme-export] getAllProdukte failed:", err);
    return NextResponse.json({ error: "Produkte konnten nicht geladen werden." }, { status: 500 });
  }
  if (!produkt) return NextResponse.json({ error: "Produkt nicht gefunden." }, { status: 404 });

  // Autorisierung: Admin ODER Produkt vom Kunden gezogen.
  if (!session.isAdmin) {
    if (!session.lizenzschluessel) {
      return NextResponse.json({ error: "Kein Kundenkonto." }, { status: 403 });
    }
    const kunde = await findKundeByKey(session.lizenzschluessel);
    const drawn = Array.isArray(kunde?.profile?.drawnProducts) ? kunde!.profile.drawnProducts : [];
    if (!drawn.includes(produkt.id)) {
      return NextResponse.json(
        { error: "Dieses Produkt hast du noch nicht gezogen." },
        { status: 403 },
      );
    }
  }

  // Theme-Texte vorhanden?
  const themeCopy = produkt.extra?.themeCopy;
  if (!themeCopy || Object.keys(themeCopy).length === 0) {
    return NextResponse.json(
      { error: "Für dieses Produkt wurden noch keine Theme-Texte erstellt." },
      { status: 409 },
    );
  }

  // Master-Theme laden + injizieren.
  try {
    const master = await getMasterThemeZip();
    const zip = buildThemeZip(master, { themeCopy, color, font });
    const fileName = `${slugify(produkt.titel)}-theme.zip`;

    return new Response(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(zip.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[theme-export] build failed:", err);
    const msg = err instanceof Error ? err.message : "Theme-Erstellung fehlgeschlagen.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
