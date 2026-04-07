import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey, getAllProdukte, getKundeProfile, updateKundeProfile } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.isAdmin || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { produktId, optimizedTitle, optimizedBodyHtml } = await req.json();
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
    const domain = kunde.shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");

    // Find product
    const allProdukte = await getAllProdukte();
    const produkt = allProdukte.find((p) => p.id === produktId);
    if (!produkt) {
      return NextResponse.json({ error: "Produkt nicht gefunden" }, { status: 404 });
    }

    // Build images array — include ALL images (main + extras)
    const allImages: { src: string }[] = [];
    if (produkt.bildUrl) {
      allImages.push({ src: produkt.bildUrl });
    }
    if (produkt.extra?.images) {
      for (const img of produkt.extra.images) {
        // Don't duplicate the main image
        if (img && img !== produkt.bildUrl) {
          allImages.push({ src: img });
        }
      }
    }

    console.log("[Import] Importing product:", produkt.id, "to shop:", domain);
    console.log("[Import] Images count:", allImages.length);
    console.log("[Import] Access token length:", accessToken.length);

    // Import to Shopify via Admin REST API
    const shopifyRes = await fetch(
      `https://${domain}/admin/api/2024-01/products.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          product: {
            title: optimizedTitle || produkt.titel,
            body_html: optimizedBodyHtml || produkt.beschreibung || "",
            variants: [
              {
                price: produkt.preis || "0",
                requires_shipping: true,
              },
            ],
            images: allImages,
          },
        }),
      }
    );

    if (!shopifyRes.ok) {
      const errorText = await shopifyRes.text();
      console.error("[Import] Shopify error status:", shopifyRes.status, "body:", errorText);

      if (shopifyRes.status === 401 || shopifyRes.status === 403) {
        // IMPORTANT: Return 400 NOT 401 here!
        // Returning 401 causes the frontend to think the USER session expired
        // and redirects to login page. The actual issue is the Shopify token.
        return NextResponse.json(
          { error: "Shopify-Zugang ungültig. Bitte verbinde deinen Shop neu in den Einstellungen." },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: `Shopify-Fehler (${shopifyRes.status}): ${errorText.substring(0, 200)}` },
        { status: 500 }
      );
    }

    const shopifyData = await shopifyRes.json();
    console.log("[Import] Success! Shopify product ID:", shopifyData.product?.id);

    // Update onboarding checklist
    try {
      const profile = await getKundeProfile(kunde.rowIndex);
      await updateKundeProfile(kunde.rowIndex, {
        ...profile,
        onboarding_checklist: { ...profile.onboarding_checklist, product_imported: true },
      });
    } catch (e) { console.error("[Import] Checklist update failed:", e); }

    return NextResponse.json({
      success: true,
      shopifyProduct: shopifyData.product,
      aliExpressLink: produkt.aliExpressLink,
    });
  } catch (error) {
    console.error("[Import] Error:", error);
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten. Bitte versuche es erneut." },
      { status: 500 }
    );
  }
}
