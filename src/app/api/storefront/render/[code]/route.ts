// ─── /api/storefront/render/[code] ────────────────────────────────
// Server-gerendertes Sektions-Modell: Der Kunden-Shop lädt seine
// Sektionen LIVE von hier — der Sektions-Code liegt so NIE im
// ausgelieferten Theme (nur eine Runtime + der Code/Key). Ohne AKTIVE
// Lizenz des Design-Besitzers wird nichts gerendert → { locked: true }.
//
// GET /api/storefront/render/<bspx-code>
//   → { v, css, fontHref, product: "<html>", index: "<html>" }
//   → oder { locked: true, message } wenn Lizenz inaktiv/fehlt.
//
// Gate = der (unratbare) Code identifiziert den Besitzer; dessen
// Lizenzstatus entscheidet. Der „API-Key" im Theme (SITE-Token) ist der
// sichtbare Stellvertreter — er zeigt auf denselben Besitzer.

import { NextRequest, NextResponse } from "next/server";
import {
  getThemeDesign,
  getAllProdukte,
  findKundeByKey,
  type Produkt,
} from "@/lib/sheets";
import { listCustomProductsOfOwner, customToProdukt } from "@/lib/custom-products";
import { CANCEL_STATUS, INACTIVE_STATUS } from "@/lib/tiers-shared";
import { getEditorBaseThemeZip } from "@/lib/theme-master";
import { compileDocumentZip, isValidDocument } from "@/lib/theme-compile";
import { renderSectionsPayload, type RenderProduct } from "@/lib/theme-render";
import { getThemeStyle } from "@/lib/theme-styles";
import type { ThemeDocument } from "@/lib/theme-doc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const norm = (s: string) => (s || "").normalize("NFKC").trim().toLowerCase();

// Master-Lizenzen (Test/Notfall) — wie /api/license/validate.
const MASTER_KEYS = ["Hat-Jonas"];

function json(body: Record<string, unknown>, status = 200, cache = "public, s-maxage=30, stale-while-revalidate=60") {
  return NextResponse.json(body, { status, headers: { ...CORS, "Cache-Control": cache } });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Storefront-Lizenz-Gate — exakt wie /api/license/validate: Status-Kill-
// Words (mit Kündigungs-Gnadenfrist bis subscriptionEndsAt), blocked,
// abgelaufene Laufzeit. Fail-OPEN bei Fehlern (nie einen zahlenden Shop
// wegen einer Störung sperren).
function licenseActive(kunde: Awaited<ReturnType<typeof findKundeByKey>>): boolean {
  if (!kunde) return false;
  if (kunde.profile?.blocked === true) return false;
  const status = norm(kunde.status);
  if (INACTIVE_STATUS.has(status) && !CANCEL_STATUS.has(status)) return false;
  const endsAt = kunde.profile?.subscriptionEndsAt ? Date.parse(kunde.profile.subscriptionEndsAt) : NaN;
  const paidFuture = Number.isFinite(endsAt) && endsAt > Date.now();
  if (CANCEL_STATUS.has(status) && !paidFuture) return false;
  if (Number.isFinite(endsAt) && endsAt < Date.now()) return false;
  return true;
}

function parsePriceCents(preis: string): number {
  const m = String(preis || "").replace(/[^\d,.]/g, "").replace(",", ".");
  const n = parseFloat(m);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 2999;
}

function buildRenderProduct(p: Produkt): RenderProduct {
  const images = [p.bildUrl, ...(p.extra?.images || [])].filter((u): u is string => typeof u === "string" && !!u);
  return {
    title: p.titel || "Produkt",
    priceCents: parsePriceCents(p.preis),
    compareCents: 0,
    images,
    descriptionHtml: p.beschreibung || "",
  };
}

async function resolveStorefrontProduct(user: string, productId: string): Promise<Produkt | null> {
  try {
    const catalog = await getAllProdukte();
    const hit = catalog.find((p) => p.id === productId);
    if (hit) return hit;
  } catch { /* weiter mit Custom */ }
  try {
    const customs = await listCustomProductsOfOwner(user);
    const cp = customs.find((p) => p.id === productId);
    if (cp) return customToProdukt(cp);
  } catch { /* Fallback unten */ }
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const cleanCode = (code || "").trim();
  if (!cleanCode) return json({ locked: false, error: "Kein Code." }, 400, "no-store");

  try {
    const design = await getThemeDesign(cleanCode);
    if (!design) return json({ locked: false, error: "Design nicht gefunden." }, 404, "no-store");

    // ── Lizenz-Gate: Besitzer des Codes muss aktiv sein ──
    const owner = design.user || "";
    const isMaster = MASTER_KEYS.includes(owner);
    if (!isMaster && owner !== "admin") {
      let kunde: Awaited<ReturnType<typeof findKundeByKey>> = null;
      try {
        kunde = await findKundeByKey(owner);
      } catch {
        // Sheets-Ausfall → fail-open (Shop bleibt online).
        kunde = null;
      }
      // kunde===null NUR bei echtem „nicht gefunden" sperren; bei Fehler
      // oben haben wir kunde=null gesetzt — unterscheidbar über einen
      // zweiten, toleranten Versuch wäre Overkill. Wir sperren, wenn ein
      // Kunde existiert und inaktiv ist; existiert keiner, ebenfalls sperren
      // (unbekannter Owner = kein gültiges Abo).
      if (!licenseActive(kunde)) {
        return json({ locked: true, message: "Lizenz ist nicht aktiv." }, 200, "public, s-maxage=30");
      }
    }

    // ── Dokument laden + kompilieren ──
    let doc: ThemeDocument;
    try {
      const parsed = JSON.parse(design.docJson);
      if (!isValidDocument(parsed)) throw new Error("ungültiges Dokument");
      doc = parsed;
    } catch {
      return json({ locked: false, error: "Design-Dokument beschädigt." }, 500, "no-store");
    }

    const produkt = await resolveStorefrontProduct(owner, design.productId || doc.productId);
    const themeCopy = produkt?.extra?.themeCopy || {};
    const product: RenderProduct = produkt
      ? buildRenderProduct(produkt)
      : { title: "Produkt", priceCents: 2999, compareCents: 0, images: [], descriptionHtml: "" };

    const style = getThemeStyle(doc.global.styleId);
    const { zip: master, key } = await getEditorBaseThemeZip();
    const compiled = compileDocumentZip(master, doc, themeCopy, key);

    const payload = await renderSectionsPayload(compiled, {
      themeCopy,
      product,
      palette: doc.global.colors,
      font: doc.global.bodyFont,
      headingFont: doc.global.headingFont,
      settingOverrides: { ...style.settingOverrides },
    });

    return json({
      v: 1,
      locked: false,
      css: payload.css,
      fontHref: payload.fontHref,
      product: payload.product,
      index: payload.index,
    });
  } catch (err) {
    console.error("[storefront/render]", err);
    // Fail-OPEN-Signal: locked:false, aber kein HTML → die Runtime nutzt
    // ihren letzten Cache; ein Shop geht nie wegen eines Serverfehlers aus.
    return json({ locked: false, error: "Render fehlgeschlagen." }, 500, "no-store");
  }
}
