import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey, updateKundeFields } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.isAdmin || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { shopDomain, accessToken } = await req.json();

    if (!shopDomain || !accessToken) {
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

    const token = accessToken.trim();

    // Verify the token works by making a test API call
    try {
      const testRes = await fetch(
        `https://${domain}/admin/api/2024-01/shop.json`,
        {
          headers: {
            "X-Shopify-Access-Token": token,
          },
        }
      );
      if (!testRes.ok) {
        return NextResponse.json(
          { error: "Der Access Token ist ungültig oder die Domain stimmt nicht. Bitte überprüfe deine Eingaben." },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Konnte keine Verbindung zu deinem Shop herstellen. Überprüfe die Domain." },
        { status: 400 }
      );
    }

    // Save token to column A and domain to column D
    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde) {
      return NextResponse.json(
        { error: "Kunde nicht gefunden." },
        { status: 404 }
      );
    }

    await updateKundeFields(kunde.rowIndex, [
      { column: "A", value: token },
      { column: "D", value: domain },
    ]);

    // Update session
    session.shopDomain = domain;
    session.shopifyToken = token;
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
