// ─── Aktive-Designs-Limit (Editor-Abos) ────────────────────────────
// Jeder Editor-Plan erlaubt eine feste Zahl "aktiver Designs" (Starter 1,
// Pro 3, Business 25; kein Abo = FREE_MAX_ACTIVE_DESIGNS). Als "aktiv"
// zählen NUR vom Nutzer BENANNTE Designs — die Auto-Rows (rollender
// "Aktueller Shop-Stand" + datierte "Download …"-Snapshots) werden
// herausgefiltert, sonst würde jeder Download das Limit sprengen.

import { listThemeDesigns } from "@/lib/sheets";
import { AUTO_LIVE_NAME, AUTO_SNAP_PREFIX } from "@/lib/design-autosave";
import { getTierConfig } from "@/lib/tiers";
import {
  resolveEffectiveTier,
  isActiveSubFromKunde,
  FREE_MAX_ACTIVE_DESIGNS,
  type TierKey,
} from "@/lib/tiers-shared";

type KundeLike = {
  sku?: string | null;
  profile?: { tier?: TierKey | string; tierSince?: string; tierCanceledAt?: string };
};

/** Zählt die vom Nutzer benannten (nicht automatischen) Designs. */
export async function countNamedDesigns(user: string): Promise<number> {
  if (!user) return 0;
  const all = await listThemeDesigns(user);
  return all.filter(
    (d) => d.name !== AUTO_LIVE_NAME && !d.name.startsWith(AUTO_SNAP_PREFIX),
  ).length;
}

/** Max. aktive Designs für dieses Konto: Plan-Limit (admin-editierbar via
 *  Tier-Config) oder Free-Default. */
export async function maxActiveDesignsFor(kunde: KundeLike): Promise<number> {
  if (!isActiveSubFromKunde(kunde)) return FREE_MAX_ACTIVE_DESIGNS;
  // Gleiche Prioritäten wie resolvePlan (profile.tier vor SKU) — sonst
  // greifen Admin-Plan-Overrides im Editor-Limit nicht.
  const key: TierKey | null = resolveEffectiveTier(kunde);
  if (!key) return FREE_MAX_ACTIVE_DESIGNS;
  const tiers = await getTierConfig();
  const max = tiers.find((t) => t.key === key)?.limits.maxActiveDesigns;
  return typeof max === "number" ? max : FREE_MAX_ACTIVE_DESIGNS;
}
