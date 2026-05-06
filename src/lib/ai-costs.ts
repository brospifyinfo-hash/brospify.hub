// ─── AI Tool Cost Map (EUR per call) ────────────────────────────
// What each tool actually costs us at the underlying API. Used by
// the admin Stats view to show monthly burn vs. revenue from credit
// pack sales. Numbers are best-estimate based on each provider's
// public pricing — keep them updated when prices change.
//
// Sources:
//   • Replicate Real-ESRGAN: $0.000725/s × ~15s on T4 ≈ $0.011
//   • Fal rembg (BRIA RMBG-1.4): ~$0.005 / image
//   • Fal BiRefNet v2: ~$0.04 / image
//   • Fal IC-Light v2 (AI Studio): ~$0.05 / image
//   • DeepSeek-chat: $0.27/M input + $1.10/M output → ~$0.004 per
//     email (3k tokens), ~$0.007 per blog (5k), ~$0.001 per chat
//
// `creditPriceEur` = what 1 credit costs the customer (~average across
// the credit packages we sell). Used to compute revenue from topups.

export const CREDIT_PRICE_EUR = 0.0125; // 0.0125€ per credit, ≈ avg pack price

// USD → EUR conversion (rough — update if FX swings hard)
const USD_TO_EUR = 0.93;

const usd = (cents: number) => +(cents * USD_TO_EUR).toFixed(4);

/** Cost in EUR per single API call, by deduct.reason. */
export const TOOL_COST_EUR: Record<string, number> = {
  // Image generation / processing
  "upscale-image": usd(0.011),         // Replicate Real-ESRGAN
  "bg-remove-fast": usd(0.005),        // Fal rembg
  "bg-remove-precise": usd(0.04),      // Fal BiRefNet General Heavy
  "bg-remove-hair": usd(0.04),         // Fal BiRefNet Portrait
  "ai-studio": usd(0.05),              // Fal IC-Light v2

  // LLM (DeepSeek)
  "email-generate": usd(0.004),
  "blog-generate": usd(0.007),
  "ai-chat": usd(0.001),
  "product-optimize": usd(0.003),
  "legal-generate": usd(0.005),
};

/** Friendly label per reason — used for admin dashboards. */
export const TOOL_LABEL: Record<string, string> = {
  "upscale-image": "Upscaler",
  "bg-remove-fast": "BG Remover (schnell)",
  "bg-remove-precise": "BG Remover (präzise)",
  "bg-remove-hair": "BG Remover (Haar/Fell)",
  "ai-studio": "AI Studio",
  "email-generate": "E-Mail-Generator",
  "blog-generate": "Blog-Writer",
  "ai-chat": "AI Support Chat",
  "product-optimize": "Produkt-Optimierung",
  "legal-generate": "Rechtstexte",
};

/** Provider per reason — used for grouping costs by upstream API. */
export const TOOL_PROVIDER: Record<string, "fal" | "replicate" | "deepseek" | "other"> = {
  "upscale-image": "replicate",
  "bg-remove-fast": "fal",
  "bg-remove-precise": "fal",
  "bg-remove-hair": "fal",
  "ai-studio": "fal",
  "email-generate": "deepseek",
  "blog-generate": "deepseek",
  "ai-chat": "deepseek",
  "product-optimize": "deepseek",
  "legal-generate": "deepseek",
};

/**
 * Best-effort lookup: a deduct entry's `reason` field may not exactly
 * match a key in TOOL_COST_EUR (e.g. legacy spellings, extra prefix).
 * Tries exact, then includes-substring, then 0.
 */
export function costForReason(reason: string): { eur: number; key: string | null; label: string; provider: string } {
  const norm = (reason || "").toLowerCase().trim();
  // exact match
  if (TOOL_COST_EUR[norm] !== undefined) {
    return {
      eur: TOOL_COST_EUR[norm],
      key: norm,
      label: TOOL_LABEL[norm] || norm,
      provider: TOOL_PROVIDER[norm] || "other",
    };
  }
  // substring fallback
  for (const key of Object.keys(TOOL_COST_EUR)) {
    if (norm.includes(key)) {
      return {
        eur: TOOL_COST_EUR[key],
        key,
        label: TOOL_LABEL[key] || key,
        provider: TOOL_PROVIDER[key] || "other",
      };
    }
  }
  return { eur: 0, key: null, label: reason || "unknown", provider: "other" };
}
