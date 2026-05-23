import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllProdukte, addProdukt, updateProdukt, deleteProdukt } from "@/lib/sheets";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  return session.isLoggedIn && session.isAdmin;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  try {
    const produkte = await getAllProdukte();
    return NextResponse.json({ produkte });
  } catch (error) {
    console.error("Admin products fetch error:", error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

// ─── Shared helpers to extract data from any body format ────────
// The admin frontend sends: { extra: { stats, finances, images }, bildUrl, preis, ... }
// Bulk import sends:        { stats, finances, images, ... }
// We must handle BOTH formats.

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Build the extra JSON object from the request body.
 * Admin UI sends:   { extra: { stats, finances, images, links, ads, linkStatus }, ... }
 * Bulk import sends: { stats, finances, images, ... }
 * We handle BOTH by checking body.extra first, then top-level.
 */
function buildExtra(body: Record<string, unknown>): {
  stats?: { trendScore: number; viralScore: number; impulseBuyFactor: number; problemSolverIndex: number; marketSaturation: number };
  finances?: { buyPrice: number; recommendedSellPrice: number; profitMargin: number };
  images?: string[];
  links?: Record<string, unknown>;
  ads?: Record<string, unknown>;
  linkStatus?: Record<string, unknown>;
  deepStats?: Record<string, unknown>;
  audience?: Record<string, unknown>;
  adStrategy?: Record<string, unknown>;
} {
  const nested = body.extra as Record<string, unknown> | undefined;

  // Stats: prefer nested, fall back to top-level
  const stats = (nested?.stats || body.stats || undefined) as any;

  // Finances: prefer nested, fall back to top-level
  const finances = (nested?.finances || body.finances || undefined) as any;

  // Images: prefer nested, fall back to top-level — ensure it's a real array of strings
  const rawImages = nested?.images || body.images;
  let images: string[] | undefined;
  if (Array.isArray(rawImages) && rawImages.length > 0) {
    images = rawImages.filter((u: any) => typeof u === "string" && u.length > 0);
    if (images.length === 0) images = undefined;
  }

  // Strukturierte Felder durchreichen — Admin UI editiert sie nicht
  // direkt, aber sie müssen erhalten bleiben (Linkstatus pflegt der
  // Cron, Ads kommen aus der KI-Discovery).
  const pickObj = (v: unknown): Record<string, unknown> | undefined =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;

  const links = pickObj(nested?.links) || pickObj(body.links);
  const ads = pickObj(nested?.ads) || pickObj(body.ads);
  const linkStatus = pickObj(nested?.linkStatus) || pickObj(body.linkStatus);
  const deepStats = pickObj(nested?.deepStats) || pickObj(body.deepStats);
  const audience = pickObj(nested?.audience) || pickObj(body.audience);
  const adStrategy = pickObj(nested?.adStrategy) || pickObj(body.adStrategy);

  console.log("[buildExtra] nested?.images:", JSON.stringify(nested?.images));
  console.log("[buildExtra] body.images:", JSON.stringify(body.images));
  console.log("[buildExtra] final images:", JSON.stringify(images));
  console.log(
    "[buildExtra] structured present?",
    !!links, !!ads, !!linkStatus, !!deepStats, !!audience, !!adStrategy,
  );

  return { stats, finances, images, links, ads, linkStatus, deepStats, audience, adStrategy };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function extractBildUrl(body: Record<string, unknown>): string {
  const extra = body.extra as Record<string, unknown> | undefined;
  const topImages = body.images as string[] | undefined;
  const extraImages = extra?.images as string[] | undefined;
  return topImages?.[0] || extraImages?.[0] || (body.bildUrl as string) || "";
}

function extractPreis(body: Record<string, unknown>): string {
  const extra = body.extra as Record<string, unknown> | undefined;
  const topFin = body.finances as Record<string, number> | undefined;
  const extraFin = extra?.finances as Record<string, number> | undefined;
  const price = topFin?.recommendedSellPrice || extraFin?.recommendedSellPrice || body.preis || "";
  return String(price);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  try {
    const body = await req.json();

    // Build extra: prefer body.extra (from admin UI), fall back to top-level fields (bulk import)
    const extra = buildExtra(body);
    const bildUrl = extractBildUrl(body);
    const preis = extractPreis(body);
    const titel = String(body.title || body.titel || "").trim();

    // Harte Validierung: wir wollen NIE eine Zeile speichern, die nur
    // aus einer Auto-ID besteht. Lieber dem Admin sagen "Titel fehlt"
    // als später eine "verbugte" Anzeige bei Kunden.
    if (!titel) {
      return NextResponse.json(
        { error: "Titel ist erforderlich. Speichern abgebrochen." },
        { status: 400 },
      );
    }

    console.log("=== [Admin POST] BACKEND EMPFANGEN ===");
    console.log("[Admin POST] titel:", titel);
    console.log("[Admin POST] body.extra:", JSON.stringify(body.extra));
    console.log("[Admin POST] built extra:", JSON.stringify(extra));
    console.log("[Admin POST] extra.images:", JSON.stringify(extra.images));
    console.log("[Admin POST] bildUrl:", bildUrl, "preis:", preis);

    await addProdukt({
      id: body.id || `prod_${Date.now()}`,
      sku: body.sku || "",
      monat: body.monat || "",
      titel,
      bildUrl,
      beschreibung: body.description || body.beschreibung || "",
      preis,
      aliExpressLink: body.links?.aliexpressLink || body.aliExpressLink || "",
      extra,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin add product error:", error);
    return NextResponse.json({ error: "Fehler beim Hinzufügen" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  try {
    const body = await req.json();
    if (!body.rowIndex) {
      return NextResponse.json({ error: "rowIndex fehlt" }, { status: 400 });
    }

    // Build extra: prefer body.extra (from admin UI), fall back to top-level fields (bulk import)
    const extra = buildExtra(body);
    const bildUrl = extractBildUrl(body);
    const preis = extractPreis(body);
    const titel = String(body.title || body.titel || "").trim();

    if (!titel) {
      return NextResponse.json(
        { error: "Titel ist erforderlich. Speichern abgebrochen." },
        { status: 400 },
      );
    }

    console.log("=== [Admin PUT] BACKEND EMPFANGEN ===");
    console.log("[Admin PUT] row:", body.rowIndex, "titel:", titel);
    console.log("[Admin PUT] body.extra:", JSON.stringify(body.extra));
    console.log("[Admin PUT] built extra:", JSON.stringify(extra));
    console.log("[Admin PUT] extra.images:", JSON.stringify(extra.images));
    console.log("[Admin PUT] bildUrl:", bildUrl, "preis:", preis);

    await updateProdukt(body.rowIndex, {
      id: body.id,
      sku: body.sku || "",
      monat: body.monat || "",
      titel,
      bildUrl,
      beschreibung: body.description || body.beschreibung || "",
      preis,
      aliExpressLink: body.links?.aliexpressLink || body.aliExpressLink || "",
      extra,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin update product error:", error);
    return NextResponse.json({ error: "Fehler beim Aktualisieren" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  try {
    const { rowIndex } = await req.json();
    if (!rowIndex) return NextResponse.json({ error: "rowIndex fehlt" }, { status: 400 });
    await deleteProdukt(rowIndex);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin delete product error:", error);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
