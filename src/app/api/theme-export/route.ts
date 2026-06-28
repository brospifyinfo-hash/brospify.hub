// ─── /api/theme-export ────────────────────────────────────────────
// Kunden-Download (POST, weil Credits abgezogen werden): baut aus der
// Master-Schablone ein personalisiertes Shopify-Theme (Produkt-Texte aus
// extra.themeCopy + komplette Farb-Palette + Schrift) und liefert es als .zip.
//
//   POST { productId, colors: { button, buttonText, background, text, accent }, font }
//
// Voraussetzung: Der Kunde hat das Produkt gezogen (drawnProducts) ODER ist
// Admin, und für das Produkt wurden bereits Theme-Texte generiert.
// Kostet CREDIT_COSTS.THEME_EXPORT Credits pro Build (Admins kostenlos).

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getAllProdukte,
  findKundeByKey,
  getCreditsState,
  deductCredits,
  updateProduktExtra,
  type Produkt,
  type KundeProfile,
} from "@/lib/sheets";
import { getCreditCost } from "@/lib/credit-config-server";
import { getMasterThemeZip } from "@/lib/theme-master";
import { generateThemeCopy } from "@/lib/theme-copy";
import { buildThemeZip, isValidColors, isValidFontHandle, type ThemeColors } from "@/lib/theme-inject";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// On-demand-Textgenerierung (2 DeepSeek-Calls) + Theme-Build → mehr Headroom.
export const maxDuration = 120;

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

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  let body: { productId?: string; colors?: Partial<ThemeColors>; font?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 });
  }

  const productId = body.productId || "";
  const font = body.font || "";
  const colors = body.colors;

  if (!productId) return NextResponse.json({ error: "productId fehlt." }, { status: 400 });
  if (!isValidColors(colors)) {
    return NextResponse.json({ error: "Ungültige Farben (alle als Hex #rrggbb)." }, { status: 400 });
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

  // Autorisierung + Credits (Admins frei, ohne Abzug).
  let chargeRow: number | null = null;
  let chargeProfile: import("@/lib/sheets").KundeProfile | null = null;
  let cost = 0;
  if (!session.isAdmin) {
    if (!session.lizenzschluessel) {
      return NextResponse.json({ error: "Kein Kundenkonto." }, { status: 403 });
    }
    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde) return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });

    const drawn = Array.isArray(kunde.profile?.drawnProducts) ? kunde.profile.drawnProducts : [];
    if (!drawn.includes(produkt.id)) {
      return NextResponse.json({ error: "Dieses Produkt hast du noch nicht gezogen." }, { status: 403 });
    }

    cost = await getCreditCost("THEME_EXPORT");
    const balance = getCreditsState(kunde.profile).balance;
    if (cost > 0 && balance < cost) {
      return NextResponse.json(
        { error: `Nicht genug Credits — ein Theme-Build kostet ${cost}. Du hast ${balance}.`, creditsRemaining: balance },
        { status: 402 },
      );
    }
    chargeRow = kunde.rowIndex;
    chargeProfile = kunde.profile;
  }

  // Theme-Texte: vorhandene nutzen ODER on-demand per DeepSeek generieren —
  // so scheitert der Download nie an "noch keine Texte". Generierte Texte
  // werden für künftige Builds am Produkt gecached.
  let themeCopy = produkt.extra?.themeCopy;
  if (!themeCopy || Object.keys(themeCopy).length === 0) {
    try {
      const result = await generateThemeCopy({ name: produkt.titel, brief: produkt.beschreibung });
      themeCopy = result.copy;
      try {
        await updateProduktExtra(produkt.rowIndex, { ...produkt.extra, themeCopy: result.copy });
      } catch (e) {
        console.warn("[theme-export] themeCopy cache write failed:", e);
      }
    } catch (err) {
      console.error("[theme-export] on-demand generation failed:", err);
      const msg = err instanceof Error ? err.message : "Theme-Texte konnten nicht erstellt werden.";
      return NextResponse.json({ error: `Texterstellung fehlgeschlagen: ${msg}` }, { status: 502 });
    }
  }

  // Master-Theme laden + injizieren.
  let zip: Buffer;
  try {
    const master = await getMasterThemeZip();
    zip = buildThemeZip(master, { themeCopy, colors: colors as ThemeColors, font });
  } catch (err) {
    console.error("[theme-export] build failed:", err);
    const msg = err instanceof Error ? err.message : "Theme-Erstellung fehlgeschlagen.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Credits abziehen (erst NACH erfolgreichem Build → kein Abzug bei Fehler).
  if (chargeRow !== null && chargeProfile && cost > 0) {
    try {
      const result = await deductCredits(chargeRow, chargeProfile, cost, "theme-export");
      if (!result.success) {
        return NextResponse.json(
          { error: `Nicht genug Credits — ein Theme-Build kostet ${cost}.`, creditsRemaining: result.remaining },
          { status: 402 },
        );
      }
    } catch (err) {
      console.error("[theme-export] deduct failed:", err);
      return NextResponse.json({ error: "Credit-Abzug fehlgeschlagen." }, { status: 500 });
    }
  }

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
}
