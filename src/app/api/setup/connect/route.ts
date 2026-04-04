import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import crypto from "crypto";

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

    // Store customer's credentials in session for the callback
    session.shopDomain = domain;
    session.customerClientId = clientId.trim();
    session.customerClientSecret = clientSecret.trim();

    const nonce = crypto.randomBytes(16).toString("hex");
    session.oauthNonce = nonce;
    await session.save();

    // Build Shopify OAuth authorize URL using the CUSTOMER'S client_id
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://brospify-hub.vercel.app";
    const redirectUri = `${appUrl}/api/auth/shopify/callback`;
    const scopes = "read_products,write_products,read_themes,write_themes,read_content,write_content,write_legal_policies";

    const authUrl =
      `https://${domain}/admin/oauth/authorize` +
      `?client_id=${encodeURIComponent(clientId.trim())}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${nonce}`;

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error("Connect error:", error);
    return NextResponse.json(
      { error: "Fehler beim Starten der Verbindung." },
      { status: 500 }
    );
  }
}
