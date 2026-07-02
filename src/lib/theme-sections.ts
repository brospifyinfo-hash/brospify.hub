// ─── Editierbare Produktseiten-Sektionen (geteilt: Builder, Vorschau, Export) ──
// Die Kaufbox (main-product) ist immer sichtbar. Diese Sektionen darunter kann
// der Kunde ein-/ausblenden und ihre Überschrift setzen. `type` = echter
// Section-Typ im Theme (für hiddenTypes beim Download), `token` = der
// themeCopy-Platzhalter der Überschrift (damit die Überschrift auch im
// heruntergeladenen Theme landet → Vorschau == Theme).

export interface ProductSectionDef {
  type: string;
  label: string;
  defaultHeading: string;
  token: string;
}

export const PRODUCT_SECTIONS: ProductSectionDef[] = [
  { type: "bro-info-tabs", label: "Produktdetails", defaultHeading: "Mehr über das Produkt", token: "INFO_TABS_HEADING" },
  { type: "brospify-hero", label: "Marken-Story", defaultHeading: "Warum uns tausende vertrauen", token: "BRAND_TITLE" },
  { type: "vids", label: "Video-Bewertungen", defaultHeading: "Echte Erfahrungen unserer Kunden", token: "VIDS_TITLE" },
  { type: "reviews2", label: "Bewertungen", defaultHeading: "Das sagen unsere Kunden", token: "REVIEWS2_HEADLINE" },
  { type: "featured-collection", label: "Weitere Produkte", defaultHeading: "Das könnte dir auch gefallen", token: "FEATURED_COLLECTION_TITLE" },
];

// ─── Kaufbox-Bausteine (Blöcke der main-product-Infospalte) ──────────
// Jeder Block ist einzeln ein-/ausblendbar und umsortierbar. `type` = echter
// Block-Typ in der main-product-Section (für block_order/disabled beim Download).
export interface BuyboxBlockDef {
  type: string;
  label: string;
}
export const BUYBOX_BLOCKS: BuyboxBlockDef[] = [
  { type: "urgency_text", label: "Angebots-Hinweis" },
  { type: "custom_title", label: "Produkttitel" },
  { type: "custom_rating", label: "Sterne-Bewertung" },
  { type: "benefits_list", label: "Vorteile-Liste" },
  { type: "stock_indicator", label: "Lager-Hinweis" },
  { type: "variant_picker", label: "Varianten-Auswahl" },
  { type: "custom_price", label: "Preis" },
  { type: "bundle_selector", label: "Mengen-Bundles" },
  { type: "buy_buttons", label: "Kaufen-Button" },
  { type: "payment_icons", label: "Zahlarten" },
  { type: "free_gift", label: "Gratis-Geschenk" },
  { type: "delivery_timeline", label: "Liefer-Timeline" },
  { type: "custom_divider", label: "Trennlinie" },
  { type: "text", label: "Freitext" },
  { type: "custom_accordion", label: "FAQ (Klappbereich)" },
];
export const BUYBOX_DEFAULT_ORDER = BUYBOX_BLOCKS.map((b) => b.type);
// Zusätzliche Bausteine, die im Theme eingebaut, aber standardmäßig NICHT im
// Layout sind (opt-in). Der Kunde blendet sie im Baustein-Manager ein +
// positioniert sie. Alle existieren als echte main-product-Blöcke.
export const BUYBOX_OPTIONAL = ["variant_picker", "custom_divider", "text", "custom_accordion"];

export function sectionHeadingsToThemeCopy(headings: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headings) return out;
  for (const def of PRODUCT_SECTIONS) {
    const v = headings[def.type];
    if (typeof v === "string" && v.trim()) out[def.token] = v.trim();
  }
  return out;
}
