// ─── Tier shared types / constants (client-safe) ─────────────────
// No server imports. Use this from client components and React UIs.
// The server-side getter/setter live in `./tiers.ts`.
//
// One-plan world: we used to ship Bronze/Silber/Gold but consolidated
// to a single membership. The type signature still uses `TierKey` so
// the rest of the codebase (gating, profile, admin) keeps its shape —
// `TIER_KEYS` is just a one-element tuple now.

export const TIER_KEYS = ["pro"] as const;
export type TierKey = (typeof TIER_KEYS)[number];

export const FEATURE_FLAGS = [
  "aiChat",
  "aiStudio",
  "bgRemove",
  "upscale",
  "blogGenerator",
  "emailTemplates",
  "seoAudit",
  "shopifyInsights",
  "productImports",
  "themesGallery",
  "codeBlocks",
  "coaching",
  "chartsAnalytics",
  "videoScout",
  "library",
  "prioritySupport",
  "customBranding",
  "apiAccess",
  "earlyAccess",
] as const;
export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

export const FEATURE_LABELS: Record<FeatureFlag, string> = {
  aiChat: "AI Chat",
  aiStudio: "AI Studio",
  bgRemove: "Background Remover",
  upscale: "Hybrid Upscaler",
  blogGenerator: "Blog-Generator",
  emailTemplates: "E-Mail Templates",
  seoAudit: "SEO Audit",
  shopifyInsights: "Shopify Insights",
  productImports: "Produkt-Imports",
  themesGallery: "Theme-Galerie",
  codeBlocks: "Code-Blöcke",
  coaching: "Privates Coaching",
  chartsAnalytics: "Trend-Charts",
  videoScout: "Video Scout",
  library: "Bibliothek",
  prioritySupport: "Priority-Support",
  customBranding: "White-Label Branding",
  apiAccess: "API-Zugang",
  earlyAccess: "Early-Access Features",
};

export const LIMIT_KEYS = [
  "maxProducts",
  "maxBlogsPerMonth",
  "maxEmailsPerMonth",
  "maxAiChatsPerMonth",
  "maxAiStudioJobsPerMonth",
  "maxBgRemovesPerMonth",
  "maxUpscalesPerMonth",
  "maxStores",
  "maxThemesInstall",
  "maxTeamMembers",
] as const;
export type LimitKey = (typeof LIMIT_KEYS)[number];

export const LIMIT_LABELS: Record<LimitKey, string> = {
  maxProducts: "Produkte",
  maxBlogsPerMonth: "Blogs / Monat",
  maxEmailsPerMonth: "E-Mails / Monat",
  maxAiChatsPerMonth: "AI-Chats / Monat",
  maxAiStudioJobsPerMonth: "AI-Studio Jobs / Monat",
  maxBgRemovesPerMonth: "BG-Removes / Monat",
  maxUpscalesPerMonth: "Upscales / Monat",
  maxStores: "Verbundene Shops",
  maxThemesInstall: "Theme-Installs",
  maxTeamMembers: "Team-Mitglieder",
};

export type TierFeatures = Record<FeatureFlag, boolean>;
export type TierLimits = Record<LimitKey, number>;

export interface TierDefinition {
  key: TierKey;
  label: string;
  hidden: boolean;
  highlighted: boolean;
  tagline: string;
  description: string;
  ctaLabel: string;
  priceMonthlyEur: number;
  priceYearlyEur: number;
  trialDays: number;
  startingCredits: number;
  monthlyCreditAllowance: number;
  limits: TierLimits;
  features: TierFeatures;
  bullets: string[];
  /** Plan image URL shown on the public /tiers page. Optional —
   *  pages fall back to a gradient placeholder when missing. */
  imageUrl?: string;
  /** Destination of the CTA button on the public /tiers page (e.g. a
   *  Shopify product checkout). Empty falls back to /credits. */
  ctaUrl?: string;
}

// ─── SKU → tier mapping ─────────────────────────────────────────
// The customer's SKU column in the Kunden sheet is the source of
// truth for "is this customer subscribed". With a single membership
// every historical Bronze/Silber/Gold SKU plus the new neutral aliases
// resolve to the same single tier — that way legacy customers keep
// access without us having to migrate the sheet.
export const SKU_TO_TIER: Record<string, TierKey> = {
  bronze: "pro",
  silber: "pro",
  silver: "pro",
  gold: "pro",
  pro: "pro",
  abo: "pro",
  kauf: "pro",
  member: "pro",
  membership: "pro",
  mitglied: "pro",
  mitgliedschaft: "pro",
};

export function tierFromSku(sku: string | null | undefined): TierKey | null {
  if (!sku) return null;
  return SKU_TO_TIER[sku.trim().toLowerCase()] ?? null;
}

/** Public German tier names used for display + admin defaults. */
export const TIER_DISPLAY_LABEL: Record<TierKey, string> = {
  pro: "Brospify Membership",
};

function allFeatures(): TierFeatures {
  const out = {} as TierFeatures;
  for (const f of FEATURE_FLAGS) out[f] = true;
  return out;
}

export const DEFAULT_TIERS: TierDefinition[] = [
  {
    key: "pro",
    label: "Brospify Membership",
    hidden: false,
    highlighted: true,
    tagline: "Alles inklusive — ein Preis, ein Plan.",
    description: "Voller Zugriff auf alle Tools, Themes und Coaching — ohne Stufen-Spielereien.",
    ctaLabel: "Membership buchen",
    ctaUrl: "https://brospify.com/cart/52979364069723:1",
    priceMonthlyEur: 21,
    priceYearlyEur: 0,
    trialDays: 7,
    // 500 Credits werden bei JEDER Abo-Zahlung gutgeschrieben
    // (orders/paid webhook). startingCredits = erste Zahlung,
    // monthlyCreditAllowance = jedes Renewal danach (gleicher Key bleibt).
    startingCredits: 500,
    monthlyCreditAllowance: 500,
    limits: {
      maxProducts: -1,
      maxBlogsPerMonth: -1,
      maxEmailsPerMonth: -1,
      maxAiChatsPerMonth: -1,
      maxAiStudioJobsPerMonth: -1,
      maxBgRemovesPerMonth: -1,
      maxUpscalesPerMonth: -1,
      maxStores: -1,
      maxThemesInstall: -1,
      maxTeamMembers: -1,
    },
    features: allFeatures(),
    bullets: [
      "500 Credits / Monat — automatisch nachgeladen",
      "Alle AI-Tools (Produkt-Generator, AI Studio, u. a.)",
      "Privates Coaching & Priority-Support",
      "Keine künstlichen Limits",
    ],
  },
];

// ─── Pure helpers (client-safe) ──────────────────────────────────

export function isTierKey(v: unknown): v is TierKey {
  return typeof v === "string" && (TIER_KEYS as readonly string[]).includes(v);
}

export function resolveTier(tier: TierKey | string | undefined | null): TierKey | null {
  if (!tier) return null;
  return (TIER_KEYS as readonly string[]).includes(tier) ? (tier as TierKey) : null;
}

export function isActiveSub(profile: { tier?: TierKey | string; tierSince?: string; tierCanceledAt?: string }): boolean {
  const tier = resolveTier(profile.tier);
  if (!tier) return false;
  if (!profile.tierSince) return false;
  if (profile.tierCanceledAt) return false;
  return true;
}

/** SKU-aware variant: a customer counts as actively subscribed when the
 *  Kunden-sheet SKU column maps to the tier, even if the profile JSON
 *  has nothing — the admin entering an SKU is the authoritative grant.
 *  Profile-level cancellation still applies. */
export function isActiveSubFromKunde(k: {
  sku?: string | null;
  profile?: { tier?: TierKey | string; tierSince?: string; tierCanceledAt?: string };
}): boolean {
  if (k.profile?.tierCanceledAt) return false;
  if (tierFromSku(k.sku)) return true;
  if (k.profile) return isActiveSub(k.profile);
  return false;
}

export function hasFeature(tier: TierDefinition, flag: FeatureFlag): boolean {
  return tier.features[flag] === true;
}

export function withinLimit(tier: TierDefinition, key: LimitKey, currentUsage: number): boolean {
  const max = tier.limits[key];
  if (max === -1) return true;
  return currentUsage < max;
}

// ─── Sanitiser used both client and server ───────────────────────

function asNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asNonNegInt(v: unknown, fallback: number): number {
  const n = asNumber(v, fallback);
  if (!Number.isFinite(n) || n < 0) return Math.max(0, fallback);
  return Math.round(n);
}

function asLimit(v: unknown, fallback: number): number {
  const n = asNumber(v, fallback);
  if (!Number.isFinite(n)) return fallback;
  if (n < 0) return -1;
  return Math.round(n);
}

function asString(v: unknown, fallback: string, maxLen = 200): string {
  if (typeof v !== "string") return fallback;
  return v.slice(0, maxLen);
}

function asStringArray(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.slice(0, 200))
    .slice(0, 20);
}

function asFeatures(v: unknown, fallback: TierFeatures): TierFeatures {
  if (!v || typeof v !== "object") return { ...fallback };
  const out = { ...fallback };
  const obj = v as Record<string, unknown>;
  for (const key of FEATURE_FLAGS) {
    if (typeof obj[key] === "boolean") out[key] = obj[key] as boolean;
  }
  return out;
}

function asLimits(v: unknown, fallback: TierLimits): TierLimits {
  if (!v || typeof v !== "object") return { ...fallback };
  const out = { ...fallback };
  const obj = v as Record<string, unknown>;
  for (const key of LIMIT_KEYS) {
    if (key in obj) out[key] = asLimit(obj[key], fallback[key]);
  }
  return out;
}

export function mergeTierWithDefault(raw: unknown, def: TierDefinition): TierDefinition {
  if (!raw || typeof raw !== "object") return { ...def };
  const r = raw as Record<string, unknown>;
  const legacyPrice = typeof r.priceEur === "number" ? r.priceEur : undefined;

  return {
    key: def.key,
    label: asString(r.label, def.label, 40).trim() || def.label,
    hidden: typeof r.hidden === "boolean" ? r.hidden : def.hidden,
    highlighted: typeof r.highlighted === "boolean" ? r.highlighted : def.highlighted,
    tagline: asString(r.tagline, def.tagline, 80),
    description: asString(r.description, def.description, 500),
    ctaLabel: asString(r.ctaLabel, def.ctaLabel, 40).trim() || def.ctaLabel,
    priceMonthlyEur: asNonNegInt(r.priceMonthlyEur ?? legacyPrice, def.priceMonthlyEur),
    priceYearlyEur: asNonNegInt(r.priceYearlyEur, def.priceYearlyEur),
    trialDays: asNonNegInt(r.trialDays, def.trialDays),
    startingCredits: asNonNegInt(r.startingCredits, def.startingCredits),
    monthlyCreditAllowance: asNonNegInt(r.monthlyCreditAllowance, def.monthlyCreditAllowance),
    limits: asLimits(r.limits, def.limits),
    features: asFeatures(r.features, def.features),
    bullets: asStringArray(r.bullets, def.bullets),
    imageUrl: typeof r.imageUrl === "string" && r.imageUrl ? asString(r.imageUrl, "", 600) : def.imageUrl,
    ctaUrl: typeof r.ctaUrl === "string" ? asString(r.ctaUrl, "", 600) : def.ctaUrl,
  };
}
