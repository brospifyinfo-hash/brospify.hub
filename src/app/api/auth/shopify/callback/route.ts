import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey, updateKundeFields } from "@/lib/sheets";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.lizenzschluessel || !session.shopDomain) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code) {
      return NextResponse.redirect(new URL("/setup?error=no_code", req.url));
    }

    // Verify state/nonce
    if (session.oauthNonce && state !== session.oauthNonce) {
      return NextResponse.redirect(new URL("/setup?error=invalid_state", req.url));
    }

    const domain = session.shopDomain;

    // Use the customer's own client_id and client_secret from the session
    const clientId = session.customerClientId;
    const clientSecret = session.customerClientSecret;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL("/setup?error=missing_credentials", req.url));
    }

    // Exchange code for access token using customer's credentials
    const tokenRes = await fetch(`https://${domain}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Token exchange failed:", errText);
      return NextResponse.redirect(new URL("/setup?error=token_failed", req.url));
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Save token and domain to Google Sheets
    // Store "clientId|clientSecret" in column A alongside the access token
    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (kunde) {
      await updateKundeFields(kunde.rowIndex, [
        { column: "A", value: accessToken },
        { column: "D", value: domain },
      ]);
    }

    // Update session - clear temporary OAuth data
    session.shopifyToken = accessToken;
    session.shopDomain = domain;
    session.setupStep1Done = true;
    session.customerClientId = undefined;
    session.customerClientSecret = undefined;
    session.oauthNonce = undefined;
    await session.save();

    return NextResponse.redirect(new URL("/setup?step=1done", req.url));
  } catch (error) {
    console.error("Shopify callback error:", error);
    return NextResponse.redirect(new URL("/setup?error=oauth_failed", req.url));
  }
}
