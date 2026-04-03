import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { bulkAddProdukte } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  try {
    const { produkte } = await req.json();

    if (!Array.isArray(produkte) || produkte.length === 0) {
      return NextResponse.json(
        { error: "Ungültiges JSON-Format. Erwartet: { produkte: [...] }" },
        { status: 400 }
      );
    }

    const mapped = produkte.map((p: Record<string, string>) => ({
      id: p.id || p.ID || String(Date.now() + Math.random()),
      sku: p.sku || p.SKU || "",
      monat: p.monat || p.Monat || "",
      titel: p.titel || p.Titel || "",
      bildUrl: p.bildUrl || p.bild_url || p.Bild_URL || "",
      beschreibung: p.beschreibung || p.Beschreibung || "",
      preis: p.preis || p.Preis || "",
      aliExpressLink: p.aliExpressLink || p.aliexpress_link || p.AliExpress_Link || "",
    }));

    await bulkAddProdukte(mapped);

    return NextResponse.json({
      success: true,
      count: mapped.length,
      message: `${mapped.length} Produkte erfolgreich importiert.`,
    });
  } catch (error) {
    console.error("Bulk import error:", error);
    return NextResponse.json(
      { error: "Fehler beim Bulk-Import. Bitte überprüfe das JSON-Format." },
      { status: 500 }
    );
  }
}
