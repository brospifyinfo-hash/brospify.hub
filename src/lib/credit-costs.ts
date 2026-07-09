// ─── Credit costs & purchasable packages (client-safe) ───────────
// The hub uses a purchase-based credit balance — users buy packs in
// the Shopify store, the webhook tops up their balance, and each AI
// action burns a fixed amount. SEO is free (cost 0).
//
// Server code in `@/lib/sheets` re-exports CREDIT_COSTS as
// CREDIT_LIMITS for back-compat. Bumping a number here is enough —
// every consumer reads from this single source.

export const CREDIT_COSTS = {
  EMAIL_GENERATE: 20,
  UPSCALE_IMAGE: 5,
  BLOG_GENERATE: 10,
  SEO_AUDIT: 0,
  BG_REMOVE: 5,
  AI_STUDIO: 15,
  // Zufalls-Generator ("Produkt-Drop"): jeder Zug zieht EIN zufälliges
  // Produkt, das der Account noch nie gezogen hat. Kein Doppel-Ziehen.
  CHARTS_DRAW: 50,
  // Video Scout ("Premium Search"): findet per Apify-Scraper echte
  // Videos zu einem Produkt — quer über TikTok, Instagram Reels und
  // YouTube Shorts. Preis richtet sich nach der angeforderten Menge
  // (1/2/3). Höher als die reinen Text-Tools, weil pro Suche mehrere
  // Apify-Runs (ein Run je Plattform) echtes Geld kosten.
  VIDEO_SCOUT_1: 40,
  VIDEO_SCOUT_2: 70,
  VIDEO_SCOUT_3: 95,
  // Personalisiertes Produkt-Theme: Kunde lädt auf /themes eine fertig
  // befüllte Shopify-Theme-ZIP (KI-Texte + eigene Farb-Palette + Schrift).
  // Pro Build/Download fällig (jede Farb-/Schrift-Anpassung = neuer Build).
  THEME_EXPORT: 100,
  // AI Co-Pilot im Theme-Editor: Claude plant Änderungen am Theme
  // (Text + Bilder rein → Plan → Umsetzung). Preis nach AUFWAND des
  // bestätigten Plans (klein/mittel/groß) — Abzug erst bei "Plan umsetzen".
  // Standard-Modus (Claude Sonnet 5 — günstig, Alltag):
  THEME_AI_SMALL: 15,
  THEME_AI_MEDIUM: 30,
  THEME_AI_LARGE: 50,
  // Expert-Modus (Claude Opus 4.8 — stärkstes Modell, mehr Credits):
  THEME_AI_EXPERT_SMALL: 25,
  THEME_AI_EXPERT_MEDIUM: 50,
  THEME_AI_EXPERT_LARGE: 85,
} as const;

// Welcome grant — jeder Kunde bekommt das EINMALIG beim ersten Login.
// Idempotent via `credits.starterGranted` auf dem Kundenrecord.
export const STARTER_CREDITS = 1500;

// Fortlaufende Gutschrift: danach alle RECURRING_PERIOD_DAYS Tage automatisch
// RECURRING_CREDITS dazu. Anker ist `creditsStartedAt` (erster Login). Die
// Top-ups passieren idempotent beim Profil-Lesen (ensureRecurringGrant).
export const RECURRING_CREDITS = 1000;
export const RECURRING_PERIOD_DAYS = 28;

// ─── Shopify Cart Permalinks (purchase packages) ─────────────────
// `[USER_EMAIL]` is replaced at render time with the logged-in
// customer's email, so the Shopify checkout pre-fills the field.
//
// variantId is the Shopify Variant ID — we match against this in
// the orders/paid webhook to know which pack was bought.

export interface CreditPackage {
  id: "starter" | "plus" | "pro" | "max";
  variantId: string;
  credits: number;
  priceLabel: string;
  priceCents: number;
  cartUrl: string;
  hint?: string;
}

// ─── 4 Staffel-Pakete — MARGEN-GARANTIE: nie < 4× pro Prompt ──────
// Regel (bewusst hart): der Credit-Preis des GÜNSTIGSTEN Pakets darf nie
// so tief sinken, dass ein einzelner Prompt unter 4× Aufschlag fällt.
// Teuerster wiederkehrender Prompt = Expert/Opus · groß · 3 Bilder ·
// Cache-Treffer ≈ €0,15 → 85 Credits → ≈ €0,00175/Credit. 4× davon =
// 0,70 ct/Credit als absoluter Boden. Max liegt bei 0,79 ct → ~4,5×
// selbst im Worst Case; typische Prompts sind 6–14×. 1000/10 = teuerste
// Ratio (der Anker). Reihenfolge = Anzeige-Reihenfolge (aufsteigend).
//
// ⚠️ SHOPIFY-SYNC PFLICHT, bevor das live geht:
//   1. Die 3 bestehenden Varianten-PREISE in Shopify auf 10 / 22 / 45 €
//      ändern (die IDs unten bleiben, die granted Credits kommen aus
//      pkg.credits — der Preis kommt aus Shopify, beides MUSS matchen).
//   2. Eine 4. Variante (Max, 95 €) in Shopify anlegen und ihre
//      Variant-ID unten bei `id: "max"` eintragen (Platzhalter ersetzen).
//   Solange der Platzhalter steht, ist der Max-Kauf-Link bewusst kaputt
//   (fail-safe: lieber kein Kauf als ein Kauf zum falschen Preis).
export const CREDIT_PACKAGES: readonly CreditPackage[] = [
  {
    id: "starter",
    variantId: "52911652667739",
    credits: 1000,
    priceLabel: "10 €",
    priceCents: 1000,
    cartUrl:
      "https://brospify.com/cart/52911652667739:1?checkout[email]=[USER_EMAIL]",
  },
  {
    id: "plus",
    variantId: "52911654306139",
    credits: 2500,
    priceLabel: "22 €",
    priceCents: 2200,
    hint: "−12 %",
    cartUrl:
      "https://brospify.com/cart/52911654306139:1?checkout[email]=[USER_EMAIL]",
  },
  {
    id: "pro",
    variantId: "52911655715163",
    credits: 5500,
    priceLabel: "45 €",
    priceCents: 4500,
    hint: "−18 %",
    cartUrl:
      "https://brospify.com/cart/52911655715163:1?checkout[email]=[USER_EMAIL]",
  },
  {
    id: "max",
    // ⚠️ In Shopify neu anlegen (95 €) und die echte Variant-ID hier eintragen:
    variantId: "SHOPIFY_MAX_VARIANT_ID_HIER_EINTRAGEN",
    credits: 12000,
    priceLabel: "95 €",
    priceCents: 9500,
    hint: "−21 %",
    cartUrl:
      "https://brospify.com/cart/SHOPIFY_MAX_VARIANT_ID_HIER_EINTRAGEN:1?checkout[email]=[USER_EMAIL]",
  },
] as const;

export function packageByVariantId(variantId: string | number): CreditPackage | null {
  const id = String(variantId);
  return CREDIT_PACKAGES.find((p) => p.variantId === id) ?? null;
}

export function buildCartUrl(pkg: CreditPackage, email: string): string {
  const safe = encodeURIComponent(email).replace(/%40/g, "@");
  return pkg.cartUrl.replace("[USER_EMAIL]", safe);
}
