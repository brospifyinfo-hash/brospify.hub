import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.isAdmin) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { shopDomain } = await req.json();
    if (!shopDomain || typeof shopDomain !== "string") {
      return NextResponse.json(
        { error: "Bitte gib deine Shop-Domain ein." },
        { status: 400 }
      );
    }

    // Normalize domain
    let domain = shopDomain.trim().toLowerCase();
    if (!domain.endsWith(".myshopify.com")) {
      domain = domain.replace(/\.myshopify\.com$/, "") + ".myshopify.com";
    }

    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUri = `${appUrl}/api/auth/shopify/callback`;
    const scopes = "write_products,read_products";
    const nonce = crypto.randomBytes(16).toString("hex");

    // Store domain and nonce in session
    session.shopDomain = domain;
    await session.save();

    const authUrl =
      `https://${domain}/admin/oauth/authorize` +
      `?client_id=${clientId}` +
      `&scope=${scopes}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${nonce}`;

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error("Shopify auth error:", error);
    return NextResponse.json(
      { error: "Fehler beim Starten der Shopify-Verbindung." },
      { status: 500 }
    );
  }
}
