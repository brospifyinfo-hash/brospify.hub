import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { imageUrl, alt } = await req.json();
    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl fehlt" }, { status: 400 });
    }

    // Get customer Shopify credentials
    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde || !kunde.shopifyToken || !kunde.shopDomain) {
      return NextResponse.json(
        { error: "Shop nicht verbunden. Bitte verbinde deinen Shop in den Einstellungen." },
        { status: 400 }
      );
    }

    const accessToken = kunde.shopifyToken;
    const domain = kunde.shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");

    console.log("[PushToShopify] Uploading file to:", domain);
    console.log("[PushToShopify] Image URL:", imageUrl);

    // Use Shopify GraphQL API to upload file via originalSource URL
    const graphqlQuery = `
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            id
            alt
            createdAt
            fileStatus
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      files: [
        {
          alt: alt || "BrospifyHub Community Bild",
          contentType: "IMAGE",
          originalSource: imageUrl,
        },
      ],
    };

    const shopifyRes = await fetch(
      `https://${domain}/admin/api/2024-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ query: graphqlQuery, variables }),
      }
    );

    if (!shopifyRes.ok) {
      const errText = await shopifyRes.text();
      console.error("[PushToShopify] HTTP error:", shopifyRes.status, errText);

      if (shopifyRes.status === 401 || shopifyRes.status === 403) {
        return NextResponse.json(
          { error: "Shopify-Zugang ungültig. Bitte verbinde deinen Shop neu. Eventuell fehlt die Berechtigung 'write_files'." },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: `Shopify-Fehler (${shopifyRes.status})` },
        { status: 500 }
      );
    }

    const result = await shopifyRes.json();
    console.log("[PushToShopify] Response:", JSON.stringify(result).substring(0, 500));

    const userErrors = result?.data?.fileCreate?.userErrors;
    if (userErrors && userErrors.length > 0) {
      const errorMsg = userErrors.map((e: { message: string }) => e.message).join(", ");
      console.error("[PushToShopify] User errors:", errorMsg);
      return NextResponse.json({ error: `Shopify: ${errorMsg}` }, { status: 400 });
    }

    const files = result?.data?.fileCreate?.files;
    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Datei konnte nicht erstellt werden." }, { status: 500 });
    }

    console.log("[PushToShopify] Success! File ID:", files[0].id);

    return NextResponse.json({
      success: true,
      file: {
        id: files[0].id,
        alt: files[0].alt,
        status: files[0].fileStatus,
      },
    });
  } catch (error) {
    console.error("[PushToShopify] Error:", error);
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten. Bitte versuche es erneut." },
      { status: 500 }
    );
  }
}
