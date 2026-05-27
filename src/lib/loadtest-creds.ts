// Shared accessor for the dev-store creds the loadtest API routes
// share. Sits next to lib/sheets so any future helper (cleanup
// script, cron, etc.) can pick it up without importing a route file.

import { getAdminSetting } from "@/lib/sheets";

export const LOADTEST_KEY_DOMAIN = "loadtest_dev_domain";
export const LOADTEST_KEY_TOKEN = "loadtest_dev_token";

export async function getLoadTestCreds(): Promise<{ domain: string; token: string } | null> {
  const domain = await getAdminSetting(LOADTEST_KEY_DOMAIN);
  const token = await getAdminSetting(LOADTEST_KEY_TOKEN);
  if (!domain || !token) return null;
  return { domain, token };
}
