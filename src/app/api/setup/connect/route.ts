import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey, updateKundeFields } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.isAdmin || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { shopDomain, clientId, clientSecret } = await req.json();

    if (!shopDomain || !clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Bitte fülle alle Felder aus." },
        { status: 400 }
      );
    }

    // Normalize domain
    let domain = shopDomain.trim().toLowerCase();
    if (!domain.includes(".myshopify.com")) {
      domain = domain.replace(/\.myshopify\.com$/, "") + ".myshopify.com";
    }

    // Store credentials: "clientId|clientSecret" in column A, domain in column D
    const tokenString = `${clientId.trim()}|${clientSecret.trim()}`;

    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde) {
      return NextResponse.json(
        { error: "Kunde nicht gefunden." },
        { status: 404 }
      );
    }

    await updateKundeFields(kunde.rowIndex, [
      { column: "A", value: tokenString },
      { column: "D", value: domain },
    ]);

    // Update session
    session.shopDomain = domain;
    session.shopifyToken = tokenString;
    session.setupStep1Done = true;
    await session.save();

    return NextResponse.json({ success: true, domain });
  } catch (error) {
    console.error("Connect error:", error);
    return NextResponse.json(
      { error: "Fehler beim Speichern der Verbindungsdaten." },
      { status: 500 }
    );
  }
}
