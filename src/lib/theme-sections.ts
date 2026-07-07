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
  { type: "sale_banner", label: "Sale-Banner" },
  { type: "urgency_text", label: "Angebots-Hinweis" },
  { type: "custom_title", label: "Produkttitel" },
  { type: "custom_rating", label: "Sterne-Bewertung" },
  { type: "benefits_list", label: "Vorteile-Liste" },
  { type: "stock_indicator", label: "Lager-Hinweis" },
  { type: "stock_bar", label: "Lager-Balken" },
  { type: "variant_picker", label: "Varianten-Auswahl" },
  { type: "quantity_selector", label: "Mengen-Auswahl" },
  { type: "custom_price", label: "Preis" },
  { type: "bundle_selector", label: "Mengen-Bundles" },
  { type: "buy_buttons", label: "Kaufen-Button" },
  { type: "payment_icons", label: "Zahlarten" },
  { type: "trust_badges", label: "Vertrauens-Badges" },
  { type: "guarantee", label: "Garantie-Box" },
  { type: "highlights", label: "Highlights (Häkchen)" },
  { type: "social_proof", label: "Social-Proof" },
  { type: "free_gift", label: "Gratis-Geschenk" },
  { type: "delivery_timeline", label: "Liefer-Timeline" },
  { type: "feature_box", label: "Feature-Boxen" },
  { type: "icon-with-text", label: "Vertrauens-Icons" },
  { type: "description", label: "Produktbeschreibung" },
  { type: "custom_divider", label: "Trennlinie" },
  { type: "text", label: "Freitext" },
  { type: "custom_accordion", label: "FAQ (Klappbereich)" },
  { type: "collapsible_tab", label: "Aufklapp-Tab (Icon)" },
  { type: "complementary", label: "Passende Produkte" },
  { type: "share", label: "Teilen-Button" },
  { type: "countdown_timer", label: "Countdown-Timer" },
  { type: "press_bar", label: "Bekannt aus" },
  { type: "spec_list", label: "Produkt-Daten" },
  { type: "value_stack", label: "Wert-Stapel" },
  { type: "review_quote", label: "Kunden-Zitat" },
  { type: "ship_countdown", label: "Versand-Countdown" },
  { type: "return_promise", label: "Retouren-Versprechen" },
  { type: "fit_check", label: "Zielgruppen-Check" },
  { type: "mini_compare", label: "Mini-Vergleich" },
  { type: "coupon_code", label: "Rabattcode-Box" },
  { type: "price_per_day", label: "Preis pro Tag" },
];

// Fresh-Dokument-Standardreihenfolge (die etablierten 23 Bausteine). Alle
// weiteren, nur Runtime-gerenderten Bausteine (siehe BUYBOX_RUNTIME_ONLY)
// sind opt-in über die Baustein-Galerie.
export const BUYBOX_DEFAULT_ORDER = [
  "sale_banner", "urgency_text", "custom_title", "custom_rating", "benefits_list",
  "stock_indicator", "variant_picker", "quantity_selector", "custom_price",
  "bundle_selector", "buy_buttons", "payment_icons", "free_gift",
  "delivery_timeline", "feature_box", "icon-with-text", "description",
  "custom_divider", "text", "custom_accordion", "collapsible_tab",
  "complementary", "share",
];

// Nur in der dynamischen Buy Box (Runtime) gerenderte Bausteine — es gibt
// KEINEN echten Liquid-Blocktyp dafür, deshalb im statischen Fallback nicht
// verfügbar (dort werden sie beim Compile einfach übersprungen).
export const BUYBOX_RUNTIME_ONLY = new Set([
  "stock_bar", "trust_badges", "guarantee", "highlights", "social_proof",
  "countdown_timer", "press_bar", "spec_list",
  "value_stack", "review_quote", "ship_countdown", "return_promise",
  "fit_check", "mini_compare", "coupon_code", "price_per_day",
  "benefit_cards", "usp_grid", "avatar_proof",
]);

// ─── Metadaten je Baustein: Kategorie + Icon + Beschreibung (für die
// Baustein-Galerie und den Manager). `icon` = lucide-react-Name. ─────────
export type BuyboxCategory = "kern" | "conversion" | "vertrauen" | "info";

export interface BuyboxMeta {
  category: BuyboxCategory;
  icon: string;
  label: string; labelEn: string;
  desc: string; descEn: string;
}

export const BUYBOX_CATEGORY_LABELS: Record<BuyboxCategory, { de: string; en: string }> = {
  kern: { de: "Basis (Kaufen)", en: "Core (buying)" },
  conversion: { de: "Conversion & Dringlichkeit", en: "Conversion & urgency" },
  vertrauen: { de: "Vertrauen & Vorteile", en: "Trust & benefits" },
  info: { de: "Infos & Extras", en: "Info & extras" },
};

export const BUYBOX_META: Record<string, BuyboxMeta> = {
  custom_title: { category: "kern", icon: "Type", label: "Produkttitel", labelEn: "Product title", desc: "Der Name des Produkts.", descEn: "The product name." },
  custom_price: { category: "kern", icon: "Tag", label: "Preis", labelEn: "Price", desc: "Preis, Vergleichspreis & Rabatt-Badge.", descEn: "Price, compare price & discount badge." },
  variant_picker: { category: "kern", icon: "SlidersHorizontal", label: "Varianten-Auswahl", labelEn: "Variant picker", desc: "Farbe, Größe & Co. auswählen.", descEn: "Pick color, size etc." },
  quantity_selector: { category: "kern", icon: "Hash", label: "Mengen-Auswahl", labelEn: "Quantity", desc: "Stückzahl −/+ wählen.", descEn: "Choose quantity −/+." },
  buy_buttons: { category: "kern", icon: "ShoppingCart", label: "Kaufen-Button", labelEn: "Buy button", desc: "In den Warenkorb / Express-Checkout.", descEn: "Add to cart / express checkout." },
  bundle_selector: { category: "conversion", icon: "Layers", label: "Mengen-Bundles", labelEn: "Quantity bundles", desc: "1× / 2× / 3× mit Mengenrabatt.", descEn: "1× / 2× / 3× with volume discount." },
  sale_banner: { category: "conversion", icon: "Megaphone", label: "Sale-Banner", labelEn: "Sale banner", desc: "Auffälliger Angebots-Balken oben.", descEn: "Eye-catching offer bar on top." },
  urgency_text: { category: "conversion", icon: "Flame", label: "Angebots-Hinweis", labelEn: "Urgency text", desc: "Angebot-endet-am-Hinweis mit Datum.", descEn: "\"Offer ends on …\" with date." },
  stock_indicator: { category: "conversion", icon: "PackageCheck", label: "Lager-Hinweis", labelEn: "Stock note", desc: "Auf-Lager-Hinweis mit Puls-Punkt.", descEn: "\"In stock\" with pulse dot." },
  stock_bar: { category: "conversion", icon: "BatteryLow", label: "Lager-Balken", labelEn: "Stock bar", desc: "Dringlichkeit: nur-noch-X mit Balken.", descEn: "Urgency: \"Only X left\" with bar." },
  free_gift: { category: "conversion", icon: "Gift", label: "Gratis-Geschenk", labelEn: "Free gift", desc: "Geschenk-Auswahl im Warenkorb.", descEn: "Free-gift picker in cart." },
  social_proof: { category: "conversion", icon: "Users", label: "Social-Proof", labelEn: "Social proof", desc: "z. B. 12 sehen sich das gerade an.", descEn: "\"12 people viewing right now\"." },
  countdown_timer: { category: "conversion", icon: "Clock", label: "Countdown-Timer", labelEn: "Countdown timer", desc: "Live-Countdown: Angebot endet in HH:MM:SS.", descEn: "Live countdown: offer ends in HH:MM:SS." },
  value_stack: { category: "conversion", icon: "Boxes", label: "Wert-Stapel", labelEn: "Value stack", desc: "„Das bekommst du heute“: Boni mit GRATIS-Badges & Ersparnis.", descEn: "\"What you get today\": bonuses with FREE badges & savings." },
  ship_countdown: { category: "conversion", icon: "Timer", label: "Versand-Countdown", labelEn: "Shipping countdown", desc: "Bestelle in X Std → Versand heute + Lieferdatum.", descEn: "Order within X hrs → ships today + delivery date." },
  mini_compare: { category: "conversion", icon: "Scale", label: "Mini-Vergleich", labelEn: "Mini comparison", desc: "Wir ✓ vs. Andere ✗ — kompakt in der Kaufbox.", descEn: "Us ✓ vs. others ✗ — compact in the buy box." },
  coupon_code: { category: "conversion", icon: "Ticket", label: "Rabattcode-Box", labelEn: "Coupon box", desc: "Gutschein-Code zum Kopieren per Klick.", descEn: "Coupon code with click-to-copy." },
  price_per_day: { category: "conversion", icon: "Calculator", label: "Preis pro Tag", labelEn: "Price per day", desc: "Rechnet den Preis auf „nur X € pro Tag“ um.", descEn: "Reframes the price as \"only X per day\"." },
  fit_check: { category: "conversion", icon: "UserCheck", label: "Zielgruppen-Check", labelEn: "Audience check", desc: "„Perfekt für dich, wenn …“ — Selbst-Qualifizierung.", descEn: "\"Perfect for you if …\" — self-qualification." },
  review_quote: { category: "vertrauen", icon: "Quote", label: "Kunden-Zitat", labelEn: "Customer quote", desc: "Testimonial mit Sternen & Verifiziert-Badge.", descEn: "Testimonial with stars & verified badge." },
  benefit_cards: { category: "vertrauen", icon: "LayoutGrid", label: "Benefit-Karten", labelEn: "Benefit cards", desc: "2 pastell-getönte Karten: Emoji + Titel + Text (z. B. Rückgabe + Mission).", descEn: "2 pastel-tinted cards: emoji + title + text (e.g. returns + mission)." },
  usp_grid: { category: "vertrauen", icon: "Table", label: "USP-Raster", labelEn: "USP grid", desc: "6 Vorteile im 2-Spalten-Raster mit feinen Trennlinien.", descEn: "6 benefits in a 2-column grid with fine dividers." },
  avatar_proof: { category: "vertrauen", icon: "Users", label: "Avatar-Proof", labelEn: "Avatar proof", desc: "„Davie ✓ und 1500+ andere lieben es“ — Avatare + Verifiziert-Badge.", descEn: "\"Davie ✓ and 1500+ others love it\" — avatars + verified badge." },
  return_promise: { category: "vertrauen", icon: "RotateCcw", label: "Retouren-Versprechen", labelEn: "Return promise", desc: "30 Tage Rückgabe — direkt am Kaufen-Button.", descEn: "30-day returns — right at the buy button." },
  press_bar: { category: "vertrauen", icon: "Award", label: "Bekannt aus", labelEn: "As seen in", desc: "Presse-/Autoritäts-Leiste mit Namen.", descEn: "Press/authority bar with names." },
  spec_list: { category: "info", icon: "Table", label: "Produkt-Daten", labelEn: "Spec list", desc: "Eigenschaften als Bezeichnung/Wert-Zeilen.", descEn: "Attributes as label/value rows." },
  custom_rating: { category: "vertrauen", icon: "Star", label: "Sterne-Bewertung", labelEn: "Star rating", desc: "Sterne + Anzahl Bewertungen.", descEn: "Stars + review count." },
  benefits_list: { category: "vertrauen", icon: "ListChecks", label: "Vorteile-Liste", labelEn: "Benefits list", desc: "Bis 4 Vorteile mit Icon-Kreisen.", descEn: "Up to 4 benefits with icon circles." },
  trust_badges: { category: "vertrauen", icon: "ShieldCheck", label: "Vertrauens-Badges", labelEn: "Trust badges", desc: "Icon-Leiste: Versand, Rückgabe, sicher.", descEn: "Icon strip: shipping, returns, secure." },
  guarantee: { category: "vertrauen", icon: "BadgeCheck", label: "Garantie-Box", labelEn: "Guarantee box", desc: "Große Geld-zurück-Garantie mit Siegel.", descEn: "Big money-back guarantee with seal." },
  highlights: { category: "vertrauen", icon: "CheckCheck", label: "Highlights", labelEn: "Highlights", desc: "Häkchen-Liste der Kernfeatures.", descEn: "Checkmark list of key features." },
  payment_icons: { category: "vertrauen", icon: "CreditCard", label: "Zahlarten", labelEn: "Payment icons", desc: "Visa, PayPal, Klarna & Co.", descEn: "Visa, PayPal, Klarna etc." },
  delivery_timeline: { category: "vertrauen", icon: "Truck", label: "Liefer-Timeline", labelEn: "Delivery timeline", desc: "Bestellt → Versendet → Zugestellt.", descEn: "Ordered → shipped → delivered." },
  feature_box: { category: "vertrauen", icon: "LayoutGrid", label: "Feature-Boxen", labelEn: "Feature boxes", desc: "2–3 Karten mit Kern-Argumenten.", descEn: "2–3 cards with key arguments." },
  "icon-with-text": { category: "vertrauen", icon: "Sparkles", label: "Vertrauens-Icons", labelEn: "Icon + text", desc: "Kleine Icon-Text-Reihe.", descEn: "Small icon-text row." },
  description: { category: "info", icon: "AlignLeft", label: "Produktbeschreibung", labelEn: "Description", desc: "Die Shopify-Produktbeschreibung.", descEn: "The Shopify product description." },
  custom_accordion: { category: "info", icon: "ChevronsDownUp", label: "FAQ (Klappbereich)", labelEn: "FAQ (collapsible)", desc: "Aufklappbare Info mit Icon.", descEn: "Collapsible info with icon." },
  collapsible_tab: { category: "info", icon: "PanelBottomOpen", label: "Aufklapp-Tab", labelEn: "Collapsible tab", desc: "Details/Pflege als Klapp-Tab.", descEn: "Details/care as a collapsible tab." },
  complementary: { category: "info", icon: "PackagePlus", label: "Passende Produkte", labelEn: "Complementary", desc: "Cross-Selling direkt in der Kaufbox.", descEn: "Cross-selling inside the buy box." },
  text: { category: "info", icon: "Pilcrow", label: "Freitext", labelEn: "Free text", desc: "Eigener Absatz.", descEn: "Your own paragraph." },
  custom_divider: { category: "info", icon: "Minus", label: "Trennlinie", labelEn: "Divider", desc: "Dünne Trennlinie.", descEn: "Thin divider line." },
  share: { category: "info", icon: "Share2", label: "Teilen-Button", labelEn: "Share button", desc: "Produkt teilen.", descEn: "Share the product." },
};

// Bewährte Reihenfolge einer hochkonvertierenden Kaufbox (für „Anordnen").
// Nur die AKTIVEN Bausteine werden hiernach sortiert; nicht Gelistetes hängt
// ans Ende.
export const BUYBOX_CANONICAL_ORDER = [
  "sale_banner", "urgency_text", "countdown_timer", "ship_countdown", "custom_title",
  "custom_rating", "review_quote", "custom_price", "price_per_day",
  "stock_bar", "stock_indicator", "variant_picker", "bundle_selector", "value_stack",
  "coupon_code", "quantity_selector", "buy_buttons", "return_promise", "payment_icons",
  "trust_badges", "press_bar",
  "guarantee", "benefits_list", "benefit_cards", "usp_grid", "highlights", "mini_compare", "fit_check",
  "delivery_timeline", "free_gift",
  "avatar_proof", "social_proof", "feature_box", "icon-with-text", "spec_list", "description", "text",
  "custom_divider", "custom_accordion", "collapsible_tab", "complementary", "share",
];

export function getBuyboxMeta(type: string): BuyboxMeta {
  return BUYBOX_META[type] || { category: "info", icon: "Square", label: type, labelEn: type, desc: "", descEn: "" };
}
// Zusätzliche Bausteine, die im Theme eingebaut, aber standardmäßig NICHT im
// Layout sind (opt-in). Der Kunde blendet sie im Baustein-Manager ein +
// positioniert sie. Alle existieren als echte main-product-Blocktypen —
// fehlt eine Instanz im Template, instanziiert die Compile-Engine sie aus
// den Schema-Defaults. `description` ist bewusst NICHT optional (war schon
// immer im Theme sichtbar und bleibt es standardmäßig).
export const BUYBOX_OPTIONAL = [
  "variant_picker", "custom_divider", "text", "custom_accordion",
  "sale_banner", "quantity_selector", "feature_box", "icon-with-text",
  "collapsible_tab", "complementary", "share",
];

export function sectionHeadingsToThemeCopy(headings: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headings) return out;
  for (const def of PRODUCT_SECTIONS) {
    const v = headings[def.type];
    if (typeof v === "string" && v.trim()) out[def.token] = v.trim();
  }
  return out;
}
