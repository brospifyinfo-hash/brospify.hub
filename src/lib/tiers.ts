import { getAdminSetting, setAdminSetting } from "./sheets";
import {
  TIER_KEYS,
  DEFAULT_TIERS,
  isTierKey,
  mergeTierWithDefault,
  type TierDefinition,
  type TierKey,
} from "./tiers-shared";

// Re-export everything client-safe so existing imports still work.
export * from "./tiers-shared";

const SETTINGS_KEY = "tier_config_json";

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

  const defByKey = new Map<TierKey, TierDefinition>();
  for (const def of DEFAULT_TIERS) defByKey.set(def.key, def);

  const byKey = new Map<TierKey, TierDefinition>();
  for (const def of DEFAULT_TIERS) byKey.set(def.key, { ...def });

  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const key = (entry as { key?: unknown }).key;
    if (!isTierKey(key)) continue;
    const def = defByKey.get(key)!;
    byKey.set(key, mergeTierWithDefault(entry, def));
  }

  return TIER_KEYS.map((k) => byKey.get(k)!);
}

export async function setTierConfig(next: TierDefinition[]): Promise<TierDefinition[]> {
  const defByKey = new Map<TierKey, TierDefinition>();
  for (const def of DEFAULT_TIERS) defByKey.set(def.key, def);

  const byKey = new Map<TierKey, TierDefinition>();
  for (const def of DEFAULT_TIERS) byKey.set(def.key, { ...def });

  for (const entry of next) {
    if (!entry || !isTierKey(entry.key)) continue;
    const def = defByKey.get(entry.key)!;
    byKey.set(entry.key, mergeTierWithDefault(entry, def));
  }

  const out = TIER_KEYS.map((k) => byKey.get(k)!);
  await setAdminSetting(SETTINGS_KEY, JSON.stringify(out));
  return out;
}

export async function getTier(key: TierKey): Promise<TierDefinition> {
  const all = await getTierConfig();
  return all.find((t) => t.key === key) || DEFAULT_TIERS.find((t) => t.key === key)!;
}
