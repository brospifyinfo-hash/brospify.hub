import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// Shopify notification template types mapped to REST API titles
const SHOPIFY_TEMPLATE_MAP: Record<string, string> = {
  order_confirmation: "order_confirmation",
  shipping_confirmation: "shipping_confirmation",
  abandoned_checkout: "abandoned_checkout",
  customer_welcome: "customer",
  refund_notification: "refund_notification",
  order_cancelled: "order_cancelled",
  password_reset: "customer_password_reset",
  account_activation: "customer_account_activation",
  fulfillment_request: "fulfillment_request",
  invoice: "invoice",
};

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { type, html } = await req.json();

    if (!type || !html) {
      return NextResponse.json({ error: "Template-Typ und HTML sind erforderlich" }, { status: 400 });
    }

    const shopifyType = SHOPIFY_TEMPLATE_MAP[type];
    if (!shopifyType) {
      return NextResponse.json({ error: `Unbekannter Template-Typ: ${type}` }, { status: 400 });
    }

    // Get customer shop credentials
    if (!session.lizenzschluessel) {
      return NextResponse.json({ error: "Kein Lizenzschlüssel in Session" }, { status: 401 });
    }

    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde || !kunde.shopifyToken || !kunde.shopDomain) {
      return NextResponse.json(
        { error: "Shop nicht verbunden. Bitte zuerst Shopify unter Einstellungen verbinden." },
        { status: 400 }
      );
    }

    const domain = kunde.shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const token = kunde.shopifyToken;

    console.log("[EmailPush] Pushing template:", shopifyType, "to", domain);

    // Shopify REST API: PUT /admin/api/2024-01/email_templates/{title}.json
    const shopifyRes = await fetch(
      `https://${domain}/admin/api/2024-01/email_templates/${shopifyType}.json`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({
          email_template: {
            title: shopifyType,
            body: html,
          },
        }),
      }
    );

    const responseText = await shopifyRes.text();
    let responseData: Record<string, unknown> = {};
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    console.log("[EmailPush] Shopify status:", shopifyRes.status);

    if (!shopifyRes.ok) {
      const errMsg =
        (responseData.errors as string) ||
        (responseData.error as string) ||
        `HTTP ${shopifyRes.status}`;

      if (shopifyRes.status === 401 || shopifyRes.status === 403) {
        return NextResponse.json(
          { error: "Shopify-Zugriff verweigert. Bitte Shop neu verbinden (Scope: write_notifications)." },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: `Shopify-Fehler: ${JSON.stringify(errMsg).slice(0, 200)}` },
        { status: 500 }
      );
    }

    console.log("[EmailPush] Success:", shopifyType);

    return NextResponse.json({
      success: true,
      templateType: shopifyType,
      shopDomain: domain,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[EmailPush] Error:", msg);
    return NextResponse.json(
      { error: `Deployment-Fehler: ${msg.slice(0, 150)}` },
      { status: 500 }
    );
  }
}
