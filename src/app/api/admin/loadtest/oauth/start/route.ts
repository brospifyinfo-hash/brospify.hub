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

  // Prefer the public host the admin actually hit (carries through
  // Vercel's proxy as x-forwarded-host) — env-var fallback is last
  // because NEXT_PUBLIC_APP_URL was pointing at the internal vercel.app
  // hostname in production, which then doesn't match the redirect URL
  // the admin registered on brospifyhub.com in Shopify's Dev Dashboard.
  const forwardedHost = req.headers.get("x-forwarded-host");
  const rawHost = forwardedHost || req.headers.get("host") || req.nextUrl.host;
  const envBase = process.env.NEXT_PUBLIC_APP_URL || "";
  // Don't trust env if it's an internal vercel.app — that's the bug we just fixed.
  const base = rawHost && !rawHost.endsWith(".vercel.app")
    ? `https://${rawHost}`
    : envBase && !envBase.includes(".vercel.app")
    ? envBase
    : `https://${rawHost}`;
  const redirectUri = `${base.replace(/\/$/, "")}/api/admin/loadtest/oauth/callback`;

  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("scope", LOADTEST_OAUTH_SCOPES);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", nonce);

  return NextResponse.redirect(url.toString());
}
