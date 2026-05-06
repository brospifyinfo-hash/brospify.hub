import { getAdminSetting, setAdminSetting, type TierKey } from "./sheets";

// ─── Subscription tiers ──────────────────────────────────────────
// The tier *keys* are part of the data model and code-level — they
// shouldn't change at runtime. The labels and prices, however, are
// admin-editable from the Tier-Settings panel: they live in the
// `Settings` sheet under `tier_config_json`. Defaults seed the
// config the first time the panel opens.

export const TIER_KEYS = ["free", "starter", "pro", "business"] as const;
export type { TierKey };

export interface TierDefinition {
  key: TierKey;
  label: string;
  /** Monthly price in EUR. 0 means free. */
  priceEur: number;
}

export const DEFAULT_TIERS: TierDefinition[] = [
  { key: "free",     label: "Free",     priceEur: 0 },
  { key: "starter",  label: "Starter",  priceEur: 19 },
  { key: "pro",      label: "Pro",      priceEur: 49 },
  { key: "business", label: "Business", priceEur: 99 },
];

const SETTINGS_KEY = "tier_config_json";

function isTierKey(v: unknown): v is TierKey {
  return typeof v === "string" && (TIER_KEYS as readonly string[]).includes(v);
}

// Read the current config. Always returns a fully-populated array
// in TIER_KEYS order, falling back to defaults for any missing key.
export async function getTierConfig(): Promise<TierDefinition[]> {
  const raw = await getAdminSetting(SETTINGS_KEY);
  let parsed: unknown[] = [];
  if (raw) {
    try {
      const j = JSON.parse(raw);
      if (Array.isArray(j)) parsed = j;
    } catch {
      parsed = [];
    }
  }

  const byKey = new Map<TierKey, TierDefinition>();
  for (const def of DEFAULT_TIERS) byKey.set(def.key, { ...def });
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const key = e.key;
    if (!isTierKey(key)) continue;
    const label = typeof e.label === "string" && e.label.trim() ? e.label.trim() : byKey.get(key)!.label;
    const priceEur =
      typeof e.priceEur === "number" && Number.isFinite(e.priceEur) && e.priceEur >= 0
        ? Math.round(e.priceEur * 100) / 100
        : byKey.get(key)!.priceEur;
    byKey.set(key, { key, label, priceEur });
  }

  // Stable order: TIER_KEYS first, anything unknown last.
  return TIER_KEYS.map((k) => byKey.get(k)!);
}

export async function setTierConfig(next: TierDefinition[]): Promise<TierDefinition[]> {
  // Sanitise — ignore unknown keys, clamp prices ≥ 0, fall back to
  // defaults for anything missing.
  const byKey = new Map<TierKey, TierDefinition>();
  for (const def of DEFAULT_TIERS) byKey.set(def.key, { ...def });
  for (const entry of next) {
    if (!entry || !isTierKey(entry.key)) continue;
    const label = typeof entry.label === "string" && entry.label.trim()
      ? entry.label.trim().slice(0, 40)
      : byKey.get(entry.key)!.label;
    const priceRaw = Number(entry.priceEur);
    const priceEur = Number.isFinite(priceRaw) && priceRaw >= 0
      ? Math.round(priceRaw * 100) / 100
      : byKey.get(entry.key)!.priceEur;
    byKey.set(entry.key, { key: entry.key, label, priceEur });
  }
  const out = TIER_KEYS.map((k) => byKey.get(k)!);
  await setAdminSetting(SETTINGS_KEY, JSON.stringify(out));
  return out;
}

// Resolve a profile's tier with `free` as the default — the user
// hasn't been assigned a tier yet so the dashboard should treat
// them as a free user, not "unknown".
export function resolveTier(tier: TierKey | undefined | null): TierKey {
  return tier || "free";
}

// Active for MRR purposes = has a non-free tier and is not canceled.
// Also requires `tierSince` to be set, otherwise we treat the profile
// as a free user with stale tier data and don't count it.
export function isActiveSub(profile: { tier?: TierKey; tierSince?: string; tierCanceledAt?: string }): boolean {
  const tier = resolveTier(profile.tier);
  if (tier === "free") return false;
  if (!profile.tierSince) return false;
  if (profile.tierCanceledAt) return false;
  return true;
}
