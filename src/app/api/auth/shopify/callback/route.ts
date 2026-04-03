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

    if (!code) {
      return NextResponse.redirect(new URL("/setup?error=no_code", req.url));
    }

    const domain = session.shopDomain;
    const clientId = process.env.SHOPIFY_CLIENT_ID!;
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET!;

    // Exchange code for access token
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
      console.error("Token exchange failed:", await tokenRes.text());
      return NextResponse.redirect(new URL("/setup?error=token_failed", req.url));
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Save token and domain to Google Sheets
    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (kunde) {
      await updateKundeFields(kunde.rowIndex, [
        { column: "A", value: accessToken },
        { column: "D", value: domain },
      ]);
    }

    // Update session
    session.shopifyToken = accessToken;
    session.shopDomain = domain;
    session.setupStep1Done = true;
    await session.save();

    return NextResponse.redirect(new URL("/setup?step=2", req.url));
  } catch (error) {
    console.error("Shopify callback error:", error);
    return NextResponse.redirect(new URL("/setup?error=callback_failed", req.url));
  }
}
