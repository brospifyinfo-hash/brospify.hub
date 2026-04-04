import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllProdukte, addProdukt, updateProdukt, deleteProdukt } from "@/lib/sheets";

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

function extractExtra(body: Record<string, unknown>): {
  stats?: { trendScore: number; viralScore: number; impulseBuyFactor: number; problemSolverIndex: number; marketSaturation: number };
  finances?: { buyPrice: number; recommendedSellPrice: number; profitMargin: number };
  images?: string[];
} {
  const extra = body.extra as Record<string, unknown> | undefined;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return {
    stats: (body.stats || extra?.stats || undefined) as any,
    finances: (body.finances || extra?.finances || undefined) as any,
    images: (body.images || extra?.images || undefined) as any,
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

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
    const extra = extractExtra(body);
    const bildUrl = extractBildUrl(body);
    const preis = extractPreis(body);

    console.log("[Admin POST] extra:", JSON.stringify(extra));
    console.log("[Admin POST] bildUrl:", bildUrl, "preis:", preis);

    await addProdukt({
      id: body.id || `prod_${Date.now()}`,
      sku: body.sku || "",
      monat: body.monat || "",
      titel: body.title || body.titel || "",
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
    const extra = extractExtra(body);
    const bildUrl = extractBildUrl(body);
    const preis = extractPreis(body);

    console.log("[Admin PUT] row:", body.rowIndex, "extra:", JSON.stringify(extra));
    console.log("[Admin PUT] row:", body.rowIndex, "bildUrl:", bildUrl, "preis:", preis);

    await updateProdukt(body.rowIndex, {
      id: body.id,
      sku: body.sku || "",
      monat: body.monat || "",
      titel: body.title || body.titel || "",
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
