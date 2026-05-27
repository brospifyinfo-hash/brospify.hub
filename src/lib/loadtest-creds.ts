// Shared accessor for the dev-store creds the loadtest API routes
// share. Sits next to lib/sheets so any future helper (cleanup
// script, cron, etc.) can pick it up without importing a route file.
//
// Two credential layers exist:
//
//   1. App-level OAuth creds (`client_id` + `client_secret`) — issued
//      by Shopify when the admin creates a "LOADTESTER" app in the
//      Dev Dashboard. Shared per-Hub-install. Used by the OAuth
//      handshake to mint per-shop tokens.
//
//   2. Per-shop creds (`domain` + `token`) — the access token returned
//      after the admin completes the OAuth install for a specific
//      dev store. This is what the order-create calls use.

import { getAdminSetting } from "@/lib/sheets";

export const LOADTEST_KEY_DOMAIN = "loadtest_dev_domain";
export const LOADTEST_KEY_TOKEN = "loadtest_dev_token";
export const LOADTEST_KEY_CLIENT_ID = "loadtest_oauth_client_id";
export const LOADTEST_KEY_CLIENT_SECRET = "loadtest_oauth_client_secret";

// OAuth permissions we request for the load tester. Anything beyond
// these two would be unjustified; we order-create and we list
// products to power the dropdown.
export const LOADTEST_OAUTH_SCOPES = "write_orders,read_products";

export async function getLoadTestCreds(): Promise<{ domain: string; token: string } | null> {
  const domain = await getAdminSetting(LOADTEST_KEY_DOMAIN);
  const token = await getAdminSetting(LOADTEST_KEY_TOKEN);
  if (!domain || !token) return null;
  return { domain, token };
}

export async function getLoadTestOAuthCreds(): Promise<{ clientId: string; clientSecret: string } | null> {
  const clientId = await getAdminSetting(LOADTEST_KEY_CLIENT_ID);
  const clientSecret = await getAdminSetting(LOADTEST_KEY_CLIENT_SECRET);
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
