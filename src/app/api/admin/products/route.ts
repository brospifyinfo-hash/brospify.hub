import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllProdukte, addProdukt, updateProdukt, deleteProdukt } from "@/lib/sheets";

async function requireAdmin() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return false;
  }
  return true;
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
    await addProdukt({
      id: body.id || String(Date.now()),
      sku: body.sku,
      monat: body.monat,
      titel: body.titel,
      bildUrl: body.bildUrl || body.bild_url || "",
      beschreibung: body.beschreibung,
      preis: body.preis,
      aliExpressLink: body.aliExpressLink || body.aliexpress_link || "",
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
    await updateProdukt(body.rowIndex, {
      id: body.id,
      sku: body.sku,
      monat: body.monat,
      titel: body.titel,
      bildUrl: body.bildUrl || body.bild_url || "",
      beschreibung: body.beschreibung,
      preis: body.preis,
      aliExpressLink: body.aliExpressLink || body.aliexpress_link || "",
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
    if (!rowIndex) {
      return NextResponse.json({ error: "rowIndex fehlt" }, { status: 400 });
    }
    await deleteProdukt(rowIndex);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin delete product error:", error);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
