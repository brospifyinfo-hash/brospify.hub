import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey, getAllProdukte } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.isAdmin || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { produktId } = await req.json();
    if (!produktId) {
      return NextResponse.json({ error: "Keine Produkt-ID angegeben" }, { status: 400 });
    }

    // Get customer data for token
    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde || !kunde.shopifyToken || !kunde.shopDomain) {
      return NextResponse.json(
        { error: "Shop ist nicht verbunden. Bitte zuerst in den Einstellungen verbinden." },
        { status: 400 }
      );
    }

    const accessToken = kunde.shopifyToken;

    // Find product
    const allProdukte = await getAllProdukte();
    const produkt = allProdukte.find((p) => p.id === produktId);
    if (!produkt) {
      return NextResponse.json({ error: "Produkt nicht gefunden" }, { status: 404 });
    }

    // Import to Shopify via Admin REST API
    const shopifyRes = await fetch(
      `https://${kunde.shopDomain}/admin/api/2024-01/products.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          product: {
            title: produkt.titel,
            body_html: produkt.beschreibung,
            variants: [
              {
                price: produkt.preis,
                requires_shipping: true,
              },
            ],
            images: produkt.bildUrl
              ? [{ src: produkt.bildUrl }]
              : [],
          },
        }),
      }
    );

    if (!shopifyRes.ok) {
      const errorText = await shopifyRes.text();
      console.error("Shopify import error:", errorText);

      if (shopifyRes.status === 401 || shopifyRes.status === 403) {
        return NextResponse.json(
          { error: "Shopify-Zugang ungültig. Bitte aktualisiere deine Verbindungsdaten in den Einstellungen." },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: "Fehler beim Import in Shopify. Bitte versuche es erneut." },
        { status: 500 }
      );
    }

    const shopifyData = await shopifyRes.json();

    return NextResponse.json({
      success: true,
      shopifyProduct: shopifyData.product,
      aliExpressLink: produkt.aliExpressLink,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten. Bitte versuche es erneut." },
      { status: 500 }
    );
  }
}
