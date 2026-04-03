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

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const extra = {
      stats: body.stats || undefined,
      finances: body.finances || undefined,
      images: body.images || undefined,
    };
    await addProdukt({
      id: body.id || `prod_${Date.now()}`,
      sku: body.sku || "",
      monat: body.monat || "",
      titel: body.title || body.titel || "",
      bildUrl: body.images?.[0] || body.bildUrl || "",
      beschreibung: body.description || body.beschreibung || "",
      preis: String(body.finances?.recommendedSellPrice || body.preis || ""),
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
    const extra = {
      stats: body.stats || body.extra?.stats || undefined,
      finances: body.finances || body.extra?.finances || undefined,
      images: body.images || body.extra?.images || undefined,
    };
    await updateProdukt(body.rowIndex, {
      id: body.id,
      sku: body.sku || "",
      monat: body.monat || "",
      titel: body.title || body.titel || "",
      bildUrl: body.images?.[0] || body.extra?.images?.[0] || body.bildUrl || "",
      beschreibung: body.description || body.beschreibung || "",
      preis: String(body.finances?.recommendedSellPrice || body.extra?.finances?.recommendedSellPrice || body.preis || ""),
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
