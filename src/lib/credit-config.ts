// ─── Editable Credit Config (client-safe) ───────────────────────
// The hub ships with hard-coded defaults in `credit-costs.ts`. This
// module layers an *admin-editable* override on top: the credit cost
// of every AI/tool, the shop credit packages (prices), the credit
// icon, and a per-tool estimated API cost (for the profit view).
//
// The override is persisted as ONE JSON blob in the Settings sheet
// (key `credit_config_v1`, written via the server resolver in
// `credit-config-server.ts`). Both the client (`/api/credit-config`)
// and the server deduction routes read the *effective* config so an
// admin price change actually takes effect everywhere.
//
// This file is intentionally free of any server-only imports so it
// can be bundled into client components.

import { CREDIT_COSTS, CREDIT_PACKAGES } from "./credit-costs";

export const DEFAULT_CREDIT_ICON = "🪙";

// ─── Tool catalog ───────────────────────────────────────────────
// Every billable action the admin can re-price. `key` doubles as the
// CREDIT_COSTS key AND the config map key. `defaultApiCostEur` is our
// best estimate of what one call costs us upstream — used purely for
// the "Gewinn pro Nutzung" display and fully editable in the admin.

export interface ToolPricingMeta {
  key: keyof typeof CREDIT_COSTS;
  label: string;
  hint: string;
  /** Best-estimate upstream API cost per single call, in EUR. */
  defaultApiCostEur: number;
  group: "ai" | "tool";
  /** Tools whose UI we removed but whose route still exists. */
  hidden?: boolean;
}

export const TOOL_PRICING_META: readonly ToolPricingMeta[] = [
  { key: "AI_STUDIO", label: "AI Studio (Hintergrund AI)", hint: "Fal IC-Light v2 · pro Bild", defaultApiCostEur: 0.047, group: "ai" },
  { key: "BG_REMOVE", label: "Background Remover", hint: "Fal BiRefNet · pro Bild", defaultApiCostEur: 0.037, group: "ai" },
  { key: "UPSCALE_IMAGE", label: "Image Upscaler", hint: "Replicate Real-ESRGAN", defaultApiCostEur: 0.010, group: "ai" },
  { key: "EMAIL_GENERATE", label: "E-Mail-Generator", hint: "DeepSeek-chat", defaultApiCostEur: 0.004, group: "ai" },
  { key: "VIDEO_SCOUT_1", label: "Video Scout · 1 Video", hint: "Apify TikTok+IG+YT + Claude", defaultApiCostEur: 0.060, group: "ai" },
  { key: "VIDEO_SCOUT_2", label: "Video Scout · 2 Videos", hint: "Apify TikTok+IG+YT + Claude", defaultApiCostEur: 0.080, group: "ai" },
  { key: "VIDEO_SCOUT_3", label: "Video Scout · 3 Videos", hint: "Apify TikTok+IG+YT + Claude", defaultApiCostEur: 0.100, group: "ai" },
  { key: "CHARTS_DRAW", label: "Produkt-Drop (Zufall)", hint: "Sheet-Lookup · keine externe API", defaultApiCostEur: 0, group: "tool" },
  { key: "THEME_EXPORT", label: "Produkt-Theme-Export", hint: "DeepSeek-Texte + Theme-Build · pro Download", defaultApiCostEur: 0.008, group: "ai" },
  { key: "THEME_AI_SMALL", label: "Theme AI Standard · klein", hint: "Claude Sonnet 5 + Prompt-Cache · kleiner Plan", defaultApiCostEur: 0.012, group: "ai" },
  { key: "THEME_AI_MEDIUM", label: "Theme AI Standard · mittel", hint: "Claude Sonnet 5 + Prompt-Cache · mittlerer Plan", defaultApiCostEur: 0.02, group: "ai" },
  { key: "THEME_AI_LARGE", label: "Theme AI Standard · groß", hint: "Claude Sonnet 5 + Prompt-Cache · großer Umbau", defaultApiCostEur: 0.035, group: "ai" },
  { key: "THEME_AI_EXPERT_SMALL", label: "Theme AI Expert · klein", hint: "Claude Opus 4.8 · kleiner Plan", defaultApiCostEur: 0.025, group: "ai" },
  { key: "THEME_AI_EXPERT_MEDIUM", label: "Theme AI Expert · mittel", hint: "Claude Opus 4.8 · mittlerer Plan", defaultApiCostEur: 0.045, group: "ai" },
  { key: "THEME_AI_EXPERT_LARGE", label: "Theme AI Expert · groß", hint: "Claude Opus 4.8 · großer Umbau (ggf. mit Bildern)", defaultApiCostEur: 0.075, group: "ai" },
  { key: "BLOG_GENERATE", label: "Blog-Writer (versteckt)", hint: "DeepSeek-chat", defaultApiCostEur: 0.007, group: "ai", hidden: true },
] as const;

// ─── Config shapes ──────────────────────────────────────────────

export interface CreditPackageConfig {
  id: string;
  credits: number;
  priceCents: number;
  priceLabel: string;
}

export interface CreditConfig {
  /** Emoji or short text shown wherever the credit balance appears. */
  icon: string;
  /** Credit cost per action, keyed by CREDIT_COSTS key. */
  costs: Record<string, number>;
  /** Estimated upstream API cost per action, in EUR (profit view). */
  apiCostsEur: Record<string, number>;
  /** Purchasable shop packages (prices in cents). */
  packages: CreditPackageConfig[];
}

function defaultApiCosts(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of TOOL_PRICING_META) out[t.key] = t.defaultApiCostEur;
  return out;
}

export function defaultCreditConfig(): CreditConfig {
  return {
    icon: DEFAULT_CREDIT_ICON,
    costs: { ...(CREDIT_COSTS as Record<string, number>) },
    apiCostsEur: defaultApiCosts(),
    packages: CREDIT_PACKAGES.map((p) => ({
      id: p.id,
      credits: p.credits,
      priceCents: p.priceCents,
      priceLabel: p.priceLabel,
    })),
  };
}

/** Merge a (possibly partial / stale) override over the live defaults. */
export function mergeCreditConfig(
  override: Partial<CreditConfig> | null | undefined,
): CreditConfig {
  const base = defaultCreditConfig();
  if (!override || typeof override !== "object") return base;
  return {
    icon: typeof override.icon === "string" && override.icon.trim() ? override.icon.trim() : base.icon,
    costs: { ...base.costs, ...sanitizeNumberMap(override.costs) },
    apiCostsEur: { ...base.apiCostsEur, ...sanitizeNumberMap(override.apiCostsEur) },
    packages:
      Array.isArray(override.packages) && override.packages.length > 0
        ? override.packages
            .filter((p) => p && typeof p.id === "string")
            .map((p) => ({
              id: p.id,
              credits: Math.max(0, Math.round(Number(p.credits) || 0)),
              priceCents: Math.max(0, Math.round(Number(p.priceCents) || 0)),
              priceLabel:
                typeof p.priceLabel === "string" && p.priceLabel.trim()
                  ? p.priceLabel
                  : formatEuro(Number(p.priceCents) || 0),
            }))
        : base.packages,
  };
}

function sanitizeNumberMap(m: Record<string, number> | undefined): Record<string, number> {
  if (!m || typeof m !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(m)) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) out[k] = n;
  }
  return out;
}

export function formatEuro(cents: number): string {
  return `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

// ─── Profit helpers ─────────────────────────────────────────────

/** Effective average price the customer pays per single credit (EUR). */
export function pricePerCreditEur(cfg: CreditConfig): number {
  const valid = cfg.packages.filter((p) => p.credits > 0 && p.priceCents > 0);
  if (valid.length === 0) return 0.0125;
  const sum = valid.reduce((s, p) => s + p.priceCents / 100 / p.credits, 0);
  return sum / valid.length;
}

export interface ToolProfit {
  key: string;
  credits: number;
  /** Revenue from the credits this action burns. */
  revenueEur: number;
  /** Estimated upstream cost. */
  apiCostEur: number;
  /** revenue − cost. */
  profitEur: number;
  marginPct: number;
}

export function toolProfit(cfg: CreditConfig, key: string): ToolProfit {
  const credits = Number(cfg.costs[key]) || 0;
  const ppc = pricePerCreditEur(cfg);
  const revenueEur = credits * ppc;
  const apiCostEur = Number(cfg.apiCostsEur[key]) || 0;
  const profitEur = revenueEur - apiCostEur;
  const marginPct = revenueEur > 0 ? Math.round((profitEur / revenueEur) * 100) : 0;
  return { key, credits, revenueEur, apiCostEur, profitEur, marginPct };
}
