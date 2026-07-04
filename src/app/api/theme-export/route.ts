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
import { getEditorBaseThemeZip } from "@/lib/theme-master";
import { generateThemeCopy } from "@/lib/theme-copy";
import { buildThemeZip, isValidColors, isValidFontHandle, type ThemeColors } from "@/lib/theme-inject";
import { getThemeStyle, radiusOverrides, radiusForStyle } from "@/lib/theme-styles";
import { sectionHeadingsToThemeCopy } from "@/lib/theme-sections";
import { compileDocumentZip, isValidDocument } from "@/lib/theme-compile";
import type { ThemeDocument } from "@/lib/theme-doc";
import { buildBuyboxPlan, generateSyncCode } from "@/lib/buybox-plan";
import { saveBuyboxPlan, updateKundeProfile, getThemeDesign, saveThemeDesign } from "@/lib/sheets";
import { SITE_URL } from "@/lib/seo";
import { BUYBOX_CSS } from "@/lib/buybox-css";
import { promises as fsp } from "fs";
import path from "path";

// Storefront-Runtime fürs Einbacken ins ZIP (assets/bspx-runtime.js) —
// pro Lambda gecached; Pfad-Kandidaten wegen Vercel-File-Tracing.
let runtimeJsCache: string | null = null;
async function getRuntimeJs(): Promise<string> {
  if (runtimeJsCache) return runtimeJsCache;
  const candidates = [
    path.join(process.cwd(), "public", "bspx-runtime.js"),
    path.join(process.cwd(), "..", "public", "bspx-runtime.js"),
  ];
  for (const p of candidates) {
    try {
      runtimeJsCache = await fsp.readFile(p, "utf8");
      return runtimeJsCache;
    } catch {
      /* nächsten Kandidaten probieren */
    }
  }
  console.warn("[theme-export] bspx-runtime.js nicht gefunden — ZIP ohne Asset-Runtime (Hub-Script bleibt).");
  return "";
}

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

  let body: { productId?: string; colors?: Partial<ThemeColors>; font?: string; headingFont?: string; style?: string; radius?: number; hiddenSections?: string[]; sectionHeadings?: Record<string, string>; buyboxOrder?: string[]; hiddenBlocks?: string[]; design?: { shadow?: number; border?: number; iconStyle?: string }; benefitIcons?: string[]; document?: ThemeDocument; designCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 });
  }

  // ── v2 (Editor): komplettes ThemeDocument · Legacy: Einzel-Felder ──
  const doc = body.document && isValidDocument(body.document) ? body.document : null;
  if (body.document && !doc) {
    return NextResponse.json({ error: "Ungültiges Theme-Dokument." }, { status: 400 });
  }

  const productId = doc ? doc.productId : body.productId || "";
  const font = doc ? doc.global.bodyFont : body.font || "";
  const headingFont = doc ? doc.global.headingFont : body.headingFont || font;
  const colors = doc ? doc.global.colors : body.colors;
  const style = getThemeStyle(doc ? doc.global.styleId : body.style);
  const radius = typeof body.radius === "number" ? body.radius : radiusForStyle(style);
  // Vom Kunden ausgeblendete Sektionen + editierte Überschriften (Legacy).
  const userHidden = Array.isArray(body.hiddenSections) ? body.hiddenSections.filter((s) => typeof s === "string") : [];
  const headingCopy = sectionHeadingsToThemeCopy(body.sectionHeadings);

  if (!productId) return NextResponse.json({ error: "productId fehlt." }, { status: 400 });
  if (!isValidColors(colors)) {
    return NextResponse.json({ error: "Ungültige Farben (alle als Hex #rrggbb)." }, { status: 400 });
  }
  if (!isValidFontHandle(font) || !isValidFontHandle(headingFont)) {
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

  // Autorisierung. Credits kosten NUR echte API-Kosten: die einmalige
  // KI-Text-Erstellung pro Produkt (DeepSeek). Download/Build selbst ist
  // kostenlos — liegen die Texte schon am Produkt, wird nichts abgezogen.
  let chargeRow: number | null = null;
  let chargeProfile: import("@/lib/sheets").KundeProfile | null = null;
  let kunde: Awaited<ReturnType<typeof findKundeByKey>> = null;
  let cost = 0;
  const needsCopyGen = !produkt.extra?.themeCopy || Object.keys(produkt.extra.themeCopy).length === 0;
  if (!session.isAdmin) {
    if (!session.lizenzschluessel) {
      return NextResponse.json({ error: "Kein Kundenkonto." }, { status: 403 });
    }
    kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde) return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });

    const drawn = Array.isArray(kunde.profile?.drawnProducts) ? kunde.profile.drawnProducts : [];
    if (!drawn.includes(produkt.id)) {
      return NextResponse.json({ error: "Dieses Produkt hast du noch nicht gezogen." }, { status: 403 });
    }

    if (needsCopyGen) {
      cost = await getCreditCost("THEME_EXPORT");
      const balance = getCreditsState(kunde.profile).balance;
      if (cost > 0 && balance < cost) {
        return NextResponse.json(
          { error: `Nicht genug Credits — die einmalige KI-Text-Erstellung für dieses Produkt kostet ${cost}. Du hast ${balance}.`, creditsRemaining: balance },
          { status: 402 },
        );
      }
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

  // ── Dynamische Buy Box: Sync-Code je Kunde+Produkt (wiederverwendet,
  // damit bereits installierte Themes Live-Updates bekommen) + Render-Plan
  // unter dem Code speichern. MUSS vor dem Build klappen — sonst würde ein
  // ZIP mit totem Code ausgeliefert.
  let syncCode = "";
  let payloadJson = "";
  let designName = "";
  if (doc) {
    // Aktives GESPEICHERTES Design? → dessen Code verwenden (Besitz prüfen).
    // Download = Speichern: Doc + Live-Plan unter dem Design-Code aktualisieren.
    const requestedCode = typeof body.designCode === "string" ? body.designCode.trim() : "";
    if (requestedCode) {
      const design = await getThemeDesign(requestedCode);
      const owner = session.isAdmin ? "admin" : session.lizenzschluessel || "";
      if (design && (design.user === owner || session.isAdmin)) {
        syncCode = requestedCode;
        designName = design.name;
      }
    }
    if (!syncCode && kunde) {
      const codes = { ...(kunde.profile.buyboxCodes || {}) };
      syncCode = codes[produkt.id] || "";
      if (!syncCode) {
        syncCode = generateSyncCode();
        codes[produkt.id] = syncCode;
        kunde.profile.buyboxCodes = codes;
        try {
          await updateKundeProfile(kunde.rowIndex, kunde.profile);
        } catch (e) {
          console.warn("[theme-export] buyboxCodes-Persist fehlgeschlagen (Code bleibt nutzbar):", e);
        }
      }
    }
    if (!syncCode) {
      syncCode = generateSyncCode();
    }
    try {
      const plan = buildBuyboxPlan(doc, themeCopy);
      // Gleiches Payload-Format wie GET /api/buybox/[code] — wird ZUSÄTZLICH
      // als assets/bspx-plan.json ins ZIP gebacken (Offline-Fallback).
      payloadJson = JSON.stringify({ v: 1, css: BUYBOX_CSS, plan });
      const owner = session.isAdmin ? "admin" : session.lizenzschluessel || "";
      await saveBuyboxPlan(syncCode, owner, produkt.id, JSON.stringify(plan));
      // Download eines gespeicherten Designs hält den Speicherstand synchron.
      if (designName) {
        await saveThemeDesign(syncCode, owner, produkt.id, designName, JSON.stringify(doc));
      }
    } catch (err) {
      // Sheet-Ausfall blockiert den Download NICHT mehr — der eingebackene
      // Plan rendert die Buy Box auch ohne Live-Sync; Sync greift beim
      // nächsten „Live aktualisieren".
      console.error("[theme-export] Buybox-Plan speichern fehlgeschlagen (Download läuft mit Offline-Plan weiter):", err);
    }
  }

  // Basis-Theme laden (hochgeladenes Theme bevorzugt) + injizieren.
  let zip: Buffer;
  try {
    const { zip: master, source, key } = await getEditorBaseThemeZip();
    console.log(`[theme-export] Basis-Theme: ${source} (${doc ? "v2-Dokument" : "Legacy"})`);
    zip = doc
      ? compileDocumentZip(
          master,
          doc,
          themeCopy || {},
          key,
          syncCode ? { syncCode, hubUrl: SITE_URL, payloadJson, runtimeJs: await getRuntimeJs() } : null,
        )
      : buildThemeZip(master, {
      themeCopy: { ...themeCopy, ...headingCopy },
      colors: colors as ThemeColors,
      font,
      headingFont,
      hiddenTypes: [...style.hiddenTypes, ...userHidden],
      settingOverrides: {
        ...style.settingOverrides,
        ...radiusOverrides(radius),
        // Design: Schatten → card_style (Karten mit/ohne Schatten im echten Theme).
        ...(body.design && typeof body.design.shadow === "number" ? { card_style: body.design.shadow >= 1 ? "card" : "standard" } : {}),
      },
      buyboxOrder: Array.isArray(body.buyboxOrder) ? body.buyboxOrder.filter((s) => typeof s === "string") : undefined,
      hiddenBlocks: Array.isArray(body.hiddenBlocks) ? body.hiddenBlocks.filter((s) => typeof s === "string") : undefined,
      benefitIcons: Array.isArray(body.benefitIcons) ? body.benefitIcons.filter((s) => typeof s === "string") : undefined,
    });
  } catch (err) {
    console.error("[theme-export] build failed:", err);
    const msg = err instanceof Error ? err.message : "Theme-Erstellung fehlgeschlagen.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Credits abziehen — NUR für die einmalige KI-Text-Erstellung (echte
  // API-Kosten) und erst NACH erfolgreichem Build (kein Abzug bei Fehler).
  if (chargeRow !== null && chargeProfile && cost > 0 && needsCopyGen) {
    try {
      const result = await deductCredits(chargeRow, chargeProfile, cost, "theme-export");
      if (!result.success) {
        return NextResponse.json(
          { error: `Nicht genug Credits — die KI-Text-Erstellung kostet ${cost}.`, creditsRemaining: result.remaining },
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
      ...(syncCode ? { "X-Bspx-Code": syncCode } : {}),
    },
  });
}
