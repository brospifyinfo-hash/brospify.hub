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
} as const;

// Welcome grant — every customer gets this once, automatically, the
// first time their profile is loaded after the grant shipped.
// Idempotent via `credits.starterGranted` on the customer record.
export const STARTER_CREDITS = 500;

// ─── Shopify Cart Permalinks (purchase packages) ─────────────────
// `[USER_EMAIL]` is replaced at render time with the logged-in
// customer's email, so the Shopify checkout pre-fills the field.
//
// variantId is the Shopify Variant ID — we match against this in
// the orders/paid webhook to know which pack was bought.

export interface CreditPackage {
  id: "starter" | "pro" | "max";
  variantId: string;
  credits: number;
  priceLabel: string;
  priceCents: number;
  cartUrl: string;
  hint?: string;
}

export const CREDIT_PACKAGES: readonly CreditPackage[] = [
  {
    id: "starter",
    variantId: "52911652667739",
    credits: 500,
    priceLabel: "9,95 €",
    priceCents: 995,
    cartUrl:
      "https://brospify.com/cart/52911652667739:1?checkout[email]=[USER_EMAIL]",
  },
  {
    id: "pro",
    variantId: "52911654306139",
    credits: 2000,
    priceLabel: "24,95 €",
    priceCents: 2495,
    cartUrl:
      "https://brospify.com/cart/52911654306139:1?checkout[email]=[USER_EMAIL]",
  },
  {
    id: "max",
    variantId: "52911655715163",
    credits: 5000,
    priceLabel: "39,95 €",
    priceCents: 3995,
    cartUrl:
      "https://brospify.com/cart/52911655715163:1?checkout[email]=[USER_EMAIL]",
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
