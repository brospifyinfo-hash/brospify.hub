// ─── Credit Config — server resolver ────────────────────────────
// Reads/writes the admin-editable credit override (key
// `credit_config_v1`) in the Settings sheet and merges it over the
// hard-coded defaults. Cached for a short window so the hot path of
// every tool deduction does not hammer the Sheets API.
//
// Server-only — imports `@/lib/sheets` (googleapis).

import { getAdminSetting, setAdminSetting } from "./sheets";
import {
  mergeCreditConfig,
  defaultCreditConfig,
  type CreditConfig,
} from "./credit-config";

const SETTING_KEY = "credit_config_v1";
const TTL_MS = 30_000;

let cache: { cfg: CreditConfig; at: number } | null = null;

/** Effective config (defaults + admin override), short-cached. */
export async function getCreditConfig(force = false): Promise<CreditConfig> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.cfg;
  let override: Partial<CreditConfig> | null = null;
  try {
    const raw = await getAdminSetting(SETTING_KEY);
    if (raw) override = JSON.parse(raw) as Partial<CreditConfig>;
  } catch (err) {
    console.error("[credit-config] read failed, using defaults:", err);
  }
  const cfg = mergeCreditConfig(override);
  cache = { cfg, at: Date.now() };
  return cfg;
}

/** Persist a full effective config and refresh the cache. */
export async function saveCreditConfig(next: CreditConfig): Promise<CreditConfig> {
  const cfg = mergeCreditConfig(next);
  await setAdminSetting(SETTING_KEY, JSON.stringify(cfg));
  cache = { cfg, at: Date.now() };
  return cfg;
}

/**
 * Effective credit cost for a single action. Falls back to the
 * hard-coded default (never throws) so a Sheets hiccup can never make
 * a tool free or wildly mispriced.
 */
export async function getCreditCost(key: string): Promise<number> {
  try {
    const cfg = await getCreditConfig();
    const v = cfg.costs[key];
    if (Number.isFinite(v) && v >= 0) return v;
  } catch {
    /* fall through to default */
  }
  const fallback = (defaultCreditConfig().costs as Record<string, number>)[key];
  return Number.isFinite(fallback) ? fallback : 0;
}
