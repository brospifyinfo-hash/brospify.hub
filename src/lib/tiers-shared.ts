// ─── Tier shared types / constants (client-safe) ─────────────────
// No server imports. Use this from client components and React UIs.
// The server-side getter/setter live in `./tiers.ts`.

export const TIER_KEYS = ["starter", "pro", "business"] as const;
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
// truth for their plan. Admin enters "Bronze", "Silber" or "Gold"
// (case-insensitive) and we resolve it to one of the internal tier
// keys. Older "SPORT"/"TREND"-style categories don't map and resolve
// to null (= no plan).
export const SKU_TO_TIER: Record<string, TierKey> = {
  bronze: "starter",
  silber: "pro",
  silver: "pro",
  gold: "business",
};

export function tierFromSku(sku: string | null | undefined): TierKey | null {
  if (!sku) return null;
  return SKU_TO_TIER[sku.trim().toLowerCase()] ?? null;
}

/** Public German tier names used for display + admin defaults. */
export const TIER_DISPLAY_LABEL: Record<TierKey, string> = {
  starter: "Bronze",
  pro: "Silber",
  business: "Gold",
};

function emptyFeatures(): TierFeatures {
  const out = {} as TierFeatures;
  for (const f of FEATURE_FLAGS) out[f] = false;
  return out;
}

function allFeatures(): TierFeatures {
  const out = {} as TierFeatures;
  for (const f of FEATURE_FLAGS) out[f] = true;
  return out;
}

export const DEFAULT_TIERS: TierDefinition[] = [
  {
    key: "starter",
    label: "Bronze",
    hidden: false,
    highlighted: false,
    tagline: "Für Solo-Founder",
    description: "Alle wichtigen Tools für deinen ersten Shop.",
    ctaLabel: "Bronze buchen",
    ctaUrl: "https://brospify.com/cart/52979130204507:1",
    priceMonthlyEur: 19,
    priceYearlyEur: 190,
    trialDays: 7,
    // 500 Credits werden bei JEDER Abo-Zahlung gutgeschrieben
    // (orders/paid webhook). startingCredits = erste Zahlung,
    // monthlyCreditAllowance = jedes Renewal danach. Beide gleich.
    startingCredits: 500,
    monthlyCreditAllowance: 500,
    limits: {
      maxProducts: 50,
      maxBlogsPerMonth: 10,
      maxEmailsPerMonth: 20,
      maxAiChatsPerMonth: 200,
      maxAiStudioJobsPerMonth: 30,
      maxBgRemovesPerMonth: 50,
      maxUpscalesPerMonth: 50,
      maxStores: 1,
      maxThemesInstall: 5,
      maxTeamMembers: 1,
    },
    // Bronze: NUR Upscaler + Background-Remover als AI-Tool. Browse-
    // Features (Charts, Library, Themes-Galerie) bleiben aktiv damit
    // der User die Plattform ueberhaupt benutzen kann. Generative
    // Tools (SEO/Blog/Email/Studio/Chat) + Code-Blöcke + Coaching
    // bleiben Silber/Gold vorbehalten.
    features: {
      ...emptyFeatures(),
      bgRemove: true,
      upscale: true,
      themesGallery: true,
      chartsAnalytics: true,
      library: true,
      productImports: true,
    },
    bullets: [
      "500 Credits / Monat",
      "1 Shop, 50 Produkte",
      "AI-Tools: NUR Upscaler + Background-Remover",
      "Trend-Charts & Theme-Galerie",
      "Generative Tools & Code-Blöcke ab Silber",
    ],
  },
  {
    key: "pro",
    label: "Silber",
    hidden: false,
    highlighted: true,
    tagline: "Für ambitionierte Stores",
    description: "Skalier deinen Store mit höheren Limits & Priority-Support.",
    ctaLabel: "Silber buchen",
    ctaUrl: "https://brospify.com/cart/52979364069723:1",
    priceMonthlyEur: 49,
    priceYearlyEur: 490,
    trialDays: 7,
    startingCredits: 2000,
    monthlyCreditAllowance: 2000,
    limits: {
      maxProducts: 250,
      maxBlogsPerMonth: 50,
      maxEmailsPerMonth: 100,
      maxAiChatsPerMonth: 1000,
      maxAiStudioJobsPerMonth: 150,
      maxBgRemovesPerMonth: 250,
      maxUpscalesPerMonth: 250,
      maxStores: 3,
      maxThemesInstall: -1,
      maxTeamMembers: 3,
    },
    // Silber: alle aktuell verfügbaren Tools + Code-Blöcke.
    // Coaching bleibt Gold vorbehalten.
    features: {
      ...allFeatures(),
      coaching: false,
      apiAccess: false,
      customBranding: false,
    },
    bullets: [
      "2.000 Credits / Monat",
      "3 Shops, 250 Produkte",
      "Alle AI-Tools + Code-Blöcke",
      "Priority-Support",
    ],
  },
  {
    key: "business",
    label: "Gold",
    hidden: false,
    highlighted: false,
    tagline: "Für Profis und Agenturen",
    description: "Unbegrenzte Limits, API-Zugang und White-Label.",
    ctaLabel: "Gold buchen",
    ctaUrl: "https://brospify.com/cart/52979364692315:1",
    priceMonthlyEur: 99,
    priceYearlyEur: 990,
    trialDays: 14,
    startingCredits: 10000,
    monthlyCreditAllowance: 10000,
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
      maxTeamMembers: 10,
    },
    // Gold: alles inkl. Code-Blöcke + privates Coaching + WhatsApp-Support.
    features: allFeatures(),
    bullets: [
      "10.000 Credits / Monat",
      "Alle Tools + Code-Blöcke",
      "Privates Coaching + WhatsApp-Support",
      "API-Zugang & White-Label",
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
 *  Kunden-sheet SKU column maps to a tier (Bronze/Silber/Gold), even if
 *  the profile JSON has nothing — the admin entering "Gold" into SKU
 *  is the authoritative grant. Profile-level cancellation still applies. */
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
