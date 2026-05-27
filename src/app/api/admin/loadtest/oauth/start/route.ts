import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSession } from "@/lib/session";
import {
  getLoadTestOAuthCreds,
  LOADTEST_OAUTH_SCOPES,
} from "@/lib/loadtest-creds";
import { assertDevStoreDomain } from "@/lib/shopify-graphql";

export const dynamic = "force-dynamic";

// Kick off the Shopify OAuth handshake. Reads the dev-store domain
// from the query (passed in by the dashboard) and bounces the admin
// to Shopify's authorize endpoint. The state nonce is stashed in
// iron-session (`oauthNonce` already exists in SessionData) so the
// callback can verify it against tampering.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const shopRaw = req.nextUrl.searchParams.get("shop") || "";
  let shop: string;
  try {
    shop = assertDevStoreDomain(shopRaw);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ungültige Shop-Domain" },
      { status: 400 },
    );
  }

  const creds = await getLoadTestOAuthCreds();
  if (!creds) {
    return NextResponse.json(
      { error: "Client ID + Client Secret fehlen. Erst unter /admin/loadtest die OAuth-App-Credentials speichern." },
      { status: 400 },
    );
  }

  const nonce = crypto.randomBytes(16).toString("hex");
  session.oauthNonce = `loadtest:${shop}:${nonce}`;
  await session.save();

  const base = process.env.NEXT_PUBLIC_APP_URL || `https://${req.nextUrl.host}`;
  const redirectUri = `${base.replace(/\/$/, "")}/api/admin/loadtest/oauth/callback`;

  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("scope", LOADTEST_OAUTH_SCOPES);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", nonce);

  return NextResponse.redirect(url.toString());
}
