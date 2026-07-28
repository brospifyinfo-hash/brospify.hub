import type { ColorPalette } from "@/lib/theme-placeholders";
import { BUYBOX_DEFAULT_ORDER, BUYBOX_OPTIONAL, sortBuyboxOrder } from "@/lib/theme-sections";

// ─────────────────────────────────────────────────────────────────
// MONO-REGEL (2026-07-28): Der Seiten-Hintergrund jedes Stils ist reines
// Weiß (#ffffff) oder reines Schwarz (#000000), der Fließtext die passende
// neutrale Gegenfarbe. Farbe tragen NUR button/buttonText/accent — also
// Buttons, Icons, Badges, Sterne und Sub-Texte. Neue Stile halten sich
// daran, sonst zieht monoPalette (theme-color) sie ohnehin gerade.
//
// Theme-Stile: vorgefertigte „Looks", die das Theme spürbar anders machen —
// jeweils eigene Farb-Palette, Schriften, globale Settings (Ecken-Radius,
// Abstände, Skalierung) UND ausgeblendete Section-Typen (so wirken die
// Stile wie unterschiedliche Themes). Der Kunde kann nach der Stil-Wahl die
// Farben/Schriften noch einzeln anpassen.
// ─────────────────────────────────────────────────────────────────

export interface ThemeStyle {
  id: string;
  label: string;
  /** Kurzbeschreibung fürs UI. */
  hint: string;
  palette: ColorPalette;
  headingFont: string;
  bodyFont: string;
  /** Globale settings_data-Overrides (Radius, Abstände, Skalierung …). */
  settingOverrides: Record<string, number | string>;
  /** Section-Typen, die dieser Stil ausblendet (für ein anderes Layout). */
  hiddenTypes: string[];
  /** Reihenfolge der Kaufbox-Bausteine (Block-Typen) dieses Stils. */
  buyboxOrder?: string[];
  /** Kaufbox-Bausteine, die dieser Stil ausblendet. */
  hiddenBlocks?: string[];
  /** Produktseiten-Sektionen (unter der Kaufbox), die dieser Stil ausblendet. */
  hiddenSections?: string[];
  /** Design-Ausprägung der Karten/Sektionen (Schatten, Rand, Icon-Stil). */
  design?: StyleDesign;
}

export interface StyleDesign {
  shadow: 0 | 1 | 2; // aus / weich / stark
  border: 1 | 2; // Randstärke in px
  iconStyle: "dark" | "accent" | "outline";
}
export const DEFAULT_DESIGN: StyleDesign = { shadow: 1, border: 1, iconStyle: "dark" };

// Shopify validiert range-Settings beim Theme-Upload strikt gegen min/max/
// step aus settings_schema.json — EIN Wert daneben und die komplette
// settings_data.json wird abgelehnt (Farben/Schriften kommen dann nie im
// Shop an). Deshalb werden alle Werte hier auf das Raster gerundet.
function snapRange(v: number, min: number, max: number, step: number): number {
  const snapped = min + Math.round((v - min) / step) * step;
  return Math.max(min, Math.min(max, snapped));
}

// Baut die settings_data-Overrides eines Stils konsistent aus einem Radius +
// optionalen Extras (card_style, Abstände, Skalierung …).
type SO = Record<string, number | string>;
function so(radius: number, opts: { card?: string; spacing?: number; pageWidth?: number; headingScale?: number; extra?: SO } = {}): SO {
  const r = snapRange(radius, 0, 40, 2); // *_radius: step 2
  return {
    buttons_radius: r,
    card_corner_radius: r > 0 ? Math.min(40, r + 2) : 0,
    media_radius: r,
    inputs_radius: Math.min(r, 12),
    badge_corner_radius: r,
    variant_pills_radius: r > 0 ? 40 : 0,
    card_style: opts.card ?? "standard",
    spacing_sections: snapRange(opts.spacing ?? 16, 0, 100, 4),
    page_width: snapRange(opts.pageWidth ?? 1200, 1000, 1600, 100),
    heading_scale: snapRange(opts.headingScale ?? 115, 100, 150, 5),
    ...(opts.extra || {}),
  };
}

export const THEME_STYLES: ThemeStyle[] = [
  {
    id: "modern", label: "Modern", hint: "Clean, kantig, viel Weißraum",
    palette: { button: "#111111", buttonText: "#ffffff", background: "#ffffff", text: "#111114", accent: "#2f6bff" },
    headingFont: "inter_n4", bodyFont: "inter_n4",
    settingOverrides: so(0, { spacing: 12, pageWidth: 1400, headingScale: 112, extra: { media_radius: 6, buttons_border_thickness: 1 } }),
    hiddenTypes: ["wave", "map"],
  },
  {
    id: "elegant", label: "Elegant", hint: "Serifen, warm, luxuriös",
    palette: { button: "#1a1a1a", buttonText: "#ffffff", background: "#ffffff", text: "#111114", accent: "#b8915f" },
    headingFont: "playfair_n4", bodyFont: "lato_n4",
    settingOverrides: so(14, { card: "card", spacing: 28, headingScale: 122, extra: { buttons_radius: 4, inputs_radius: 4 } }),
    hiddenTypes: ["wave"],
  },
  {
    id: "bold", label: "Bold", hint: "Große Typo, starker Kontrast",
    palette: { button: "#0a0a0a", buttonText: "#ffffff", background: "#ffffff", text: "#111114", accent: "#ff4d2e" },
    headingFont: "bebas_neue_n4", bodyFont: "dmsans_n4",
    settingOverrides: so(0, { spacing: 8, pageWidth: 1500, headingScale: 145, extra: { buttons_border_thickness: 2 } }),
    hiddenTypes: ["map"],
  },
  {
    id: "playful", label: "Verspielt", hint: "Rund, bunt, freundlich",
    palette: { button: "#7c5cff", buttonText: "#ffffff", background: "#ffffff", text: "#111114", accent: "#ff7aa8" },
    headingFont: "poppins_n4", bodyFont: "nunito_n4",
    settingOverrides: so(28, { card: "card", spacing: 16, headingScale: 110 }),
    hiddenTypes: [],
  },
  {
    id: "minimal", label: "Minimal", hint: "Reduziert, viel Luft",
    palette: { button: "#1a1a1a", buttonText: "#ffffff", background: "#ffffff", text: "#111114", accent: "#6b7280" },
    headingFont: "montserrat_n4", bodyFont: "inter_n4",
    settingOverrides: so(2, { spacing: 24, pageWidth: 1300, headingScale: 108 }),
    hiddenTypes: ["wave", "map", "socialicons"],
  },
  {
    id: "noir", label: "Noir", hint: "Dunkel & edel",
    palette: { button: "#ffffff", buttonText: "#0a0a0a", background: "#000000", text: "#f5f5f7", accent: "#d4af37" },
    headingFont: "playfair_n4", bodyFont: "inter_n4",
    settingOverrides: so(6, { card: "card", spacing: 18, headingScale: 120 }),
    hiddenTypes: ["wave"],
  },
  {
    id: "sunset", label: "Sunset", hint: "Warm & einladend",
    palette: { button: "#2a1a12", buttonText: "#ffffff", background: "#ffffff", text: "#111114", accent: "#ff6b35" },
    headingFont: "poppins_n4", bodyFont: "nunito_n4",
    settingOverrides: so(20, { card: "card", spacing: 18, headingScale: 116 }),
    hiddenTypes: [],
  },
  {
    id: "ocean", label: "Ocean", hint: "Frisch & klar",
    palette: { button: "#0c2733", buttonText: "#ffffff", background: "#ffffff", text: "#111114", accent: "#0ea5e9" },
    headingFont: "montserrat_n4", bodyFont: "dmsans_n4",
    settingOverrides: so(12, { spacing: 18, headingScale: 114 }),
    hiddenTypes: ["map"],
  },
  {
    id: "nature", label: "Nature", hint: "Natürlich & ruhig",
    palette: { button: "#1f2a1a", buttonText: "#ffffff", background: "#ffffff", text: "#111114", accent: "#16a34a" },
    headingFont: "raleway_n4", bodyFont: "lato_n4",
    settingOverrides: so(14, { card: "card", spacing: 20, headingScale: 114 }),
    hiddenTypes: ["wave"],
  },
  {
    id: "candy", label: "Candy", hint: "Süß & verspielt",
    palette: { button: "#7a2e5a", buttonText: "#ffffff", background: "#ffffff", text: "#111114", accent: "#f472b6" },
    headingFont: "nunito_n4", bodyFont: "nunito_n4",
    settingOverrides: so(30, { card: "card", spacing: 16, headingScale: 112 }),
    hiddenTypes: [],
  },
  {
    id: "tech", label: "Tech", hint: "Modern & digital",
    palette: { button: "#0f1220", buttonText: "#ffffff", background: "#ffffff", text: "#111114", accent: "#6366f1" },
    headingFont: "inter_n4", bodyFont: "inter_n4",
    settingOverrides: so(8, { spacing: 14, pageWidth: 1400, headingScale: 116 }),
    hiddenTypes: ["wave", "map"],
  },
  {
    id: "royal", label: "Royal", hint: "Luxuriös & tief",
    palette: { button: "#2a1a4a", buttonText: "#ffffff", background: "#ffffff", text: "#111114", accent: "#7c3aed" },
    headingFont: "playfair_n4", bodyFont: "lato_n4",
    settingOverrides: so(10, { card: "card", spacing: 20, headingScale: 120 }),
    hiddenTypes: ["wave"],
  },
  {
    id: "luxe", label: "Luxe", hint: "High-Fashion, monochrom, editorial",
    palette: { button: "#000000", buttonText: "#ffffff", background: "#ffffff", text: "#111114", accent: "#9a8866" },
    headingFont: "oswald_n4", bodyFont: "lato_n4",
    settingOverrides: so(0, { spacing: 34, pageWidth: 1250, headingScale: 128 }),
    hiddenTypes: ["wave", "map", "socialicons"],
  },
  {
    id: "street", label: "Street", hint: "Streetwear, laut, Hype-Drops",
    palette: { button: "#101010", buttonText: "#ffffff", background: "#ffffff", text: "#111114", accent: "#a3e635" },
    headingFont: "bebas_neue_n4", bodyFont: "work_sans_n4",
    settingOverrides: so(0, { spacing: 10, pageWidth: 1500, headingScale: 150, extra: { buttons_border_thickness: 2 } }),
    hiddenTypes: ["wave", "map"],
  },
  {
    id: "clinic", label: "Care", hint: "Sauber & seriös, Vertrauen zuerst",
    palette: { button: "#0e7490", buttonText: "#ffffff", background: "#ffffff", text: "#111114", accent: "#14b8a6" },
    headingFont: "work_sans_n4", bodyFont: "assistant_n4",
    settingOverrides: so(10, { card: "card", spacing: 22, headingScale: 110 }),
    hiddenTypes: ["wave", "socialicons"],
  },
  {
    id: "cozy", label: "Cozy", hint: "Warm, wohnlich, Interior",
    palette: { button: "#4a3426", buttonText: "#fff7ee", background: "#ffffff", text: "#111114", accent: "#c2703d" },
    headingFont: "merriweather_n4", bodyFont: "nunito_n4",
    settingOverrides: so(18, { card: "card", spacing: 26, headingScale: 116 }),
    hiddenTypes: ["wave"],
  },
  {
    id: "sport", label: "Sport", hint: "Performance, Energie, Tempo",
    palette: { button: "#111111", buttonText: "#ffffff", background: "#ffffff", text: "#111114", accent: "#ef4444" },
    headingFont: "oswald_n4", bodyFont: "roboto_n4",
    settingOverrides: so(4, { spacing: 12, pageWidth: 1450, headingScale: 136, extra: { buttons_border_thickness: 2 } }),
    hiddenTypes: ["map"],
  },
  {
    id: "fresh", label: "Fresh", hint: "Frisch & leicht, Food & Küche",
    palette: { button: "#166534", buttonText: "#ffffff", background: "#ffffff", text: "#111114", accent: "#65a30d" },
    headingFont: "poppins_n4", bodyFont: "lato_n4",
    settingOverrides: so(16, { card: "card", spacing: 18, headingScale: 112 }),
    hiddenTypes: ["wave"],
  },
  {
    id: "family", label: "Family", hint: "Sanft, pastellig, Familie & Kids",
    palette: { button: "#4f7dd9", buttonText: "#ffffff", background: "#ffffff", text: "#111114", accent: "#f9a8d4" },
    headingFont: "nunito_n4", bodyFont: "assistant_n4",
    settingOverrides: so(26, { card: "card", spacing: 20, headingScale: 110 }),
    hiddenTypes: ["wave", "map"],
  },
  {
    id: "carbon", label: "Carbon", hint: "Dunkel, technisch, Gadgets",
    palette: { button: "#22d3ee", buttonText: "#06222a", background: "#000000", text: "#f5f5f7", accent: "#22d3ee" },
    headingFont: "dmsans_n4", bodyFont: "dmsans_n4",
    settingOverrides: so(8, { card: "card", spacing: 16, pageWidth: 1400, headingScale: 118 }),
    hiddenTypes: ["wave", "map"],
  },
  {
    id: "retro", label: "Retro", hint: "Vintage-Charme, warm & nostalgisch",
    palette: { button: "#7f1d1d", buttonText: "#fdf3e3", background: "#ffffff", text: "#111114", accent: "#d97706" },
    headingFont: "acme_n4", bodyFont: "merriweather_n4",
    settingOverrides: so(6, { card: "card", spacing: 24, headingScale: 120, extra: { buttons_border_thickness: 2 } }),
    hiddenTypes: ["wave", "socialicons"],
  },
  {
    id: "spa", label: "Spa", hint: "Beauty & Selfcare, weich und hell",
    palette: { button: "#8f5f76", buttonText: "#ffffff", background: "#ffffff", text: "#111114", accent: "#d48aa8" },
    headingFont: "playfair_n4", bodyFont: "raleway_n4",
    settingOverrides: so(22, { card: "card", spacing: 28, headingScale: 114 }),
    hiddenTypes: ["wave", "map"],
  },
  {
    id: "outdoor", label: "Outdoor", hint: "Rau, erdig, Abenteuer",
    palette: { button: "#1c2f23", buttonText: "#f2f6ec", background: "#ffffff", text: "#111114", accent: "#cc5f22" },
    headingFont: "montserrat_n4", bodyFont: "roboto_n4",
    settingOverrides: so(2, { spacing: 20, pageWidth: 1450, headingScale: 124, extra: { buttons_border_thickness: 2 } }),
    hiddenTypes: [],
  },
  {
    id: "deal", label: "Deal", hint: "Maximale Conversion, Angebots-Druck",
    palette: { button: "#dc2626", buttonText: "#ffffff", background: "#ffffff", text: "#111114", accent: "#f59e0b" },
    headingFont: "work_sans_n4", bodyFont: "inter_n4",
    settingOverrides: so(8, { spacing: 10, headingScale: 118 }),
    hiddenTypes: ["wave", "map"],
  },
];

// ─── Pro Stil: eigene Baustein-Anordnung + Sichtbarkeit + Karten-Design ──
// So sieht jeder Stil nicht nur farblich anders aus, sondern hat auch ein
// anderes Layout (Reihenfolge/ein-/ausgeblendete Bausteine & Sektionen) und
// eine andere Design-Ausprägung (Schatten, Randstärke, Icon-Stil).
const U = "urgency_text", T = "custom_title", R = "custom_rating", B = "benefits_list",
  S = "stock_indicator", P = "custom_price", BN = "bundle_selector", BT = "buy_buttons",
  PI = "payment_icons", G = "free_gift", TL = "delivery_timeline",
  SB = "sale_banner", FB = "feature_box", IW = "icon-with-text", CT = "collapsible_tab", CO = "complementary",
  // Runtime-Bausteine (nur dynamische Buy Box) — geben den Stilen eigene Layouts:
  CD = "countdown_timer", SBAR = "stock_bar", GU = "guarantee", TB = "trust_badges",
  SP = "social_proof", RQ = "review_quote", VS = "value_stack", SL = "spec_list",
  PD = "price_per_day", CC = "coupon_code", MC = "mini_compare", HL = "highlights",
  SC = "ship_countdown", RP = "return_promise",
  BC = "benefit_cards", UG = "usp_grid", AP = "avatar_proof";
interface StyleExtra {
  order: string[];
  hideB: string[];
  hideS: string[];
  design: StyleDesign;
  /** Opt-in-Bausteine, die DIESER Stil sichtbar schaltet (aus BUYBOX_OPTIONAL). */
  showB?: string[];
}
const STYLE_EXTRAS: Record<string, StyleExtra> = {
  modern:  { order: [T, R, P, B, UG, BN, BT, PI], hideB: [U, S, G, TL], hideS: ["bro-info-tabs", "vids"], design: { shadow: 0, border: 1, iconStyle: "dark" } },
  elegant: { order: [U, T, R, B, S, P, BN, BT, PI, G, CT], hideB: [TL], hideS: ["vids"], design: { shadow: 2, border: 1, iconStyle: "outline" }, showB: [CT] },
  bold:    { order: [SB, U, T, P, BN, BT, B, R, S, PI], hideB: [G, TL], hideS: ["bro-info-tabs"], design: { shadow: 0, border: 2, iconStyle: "accent" }, showB: [SB] },
  playful: { order: [U, T, R, AP, BN, B, S, P, BT, G, PI, TL, FB], hideB: [], hideS: [], design: { shadow: 1, border: 2, iconStyle: "accent" }, showB: [FB] },
  minimal: { order: [T, P, BN, BT], hideB: [U, R, B, S, PI, G, TL], hideS: ["bro-info-tabs", "brospify-hero", "vids"], design: { shadow: 0, border: 1, iconStyle: "outline" } },
  noir:    { order: [U, T, R, P, BN, BT, PI, G, TL], hideB: [B, S], hideS: ["featured-collection"], design: { shadow: 2, border: 1, iconStyle: "accent" } },
  sunset:  { order: [U, T, R, B, BC, P, BN, BT, G, PI, TL], hideB: [S], hideS: [], design: { shadow: 1, border: 1, iconStyle: "accent" } },
  ocean:   { order: [T, R, B, UG, S, P, BN, BT, PI, TL, IW], hideB: [U, G], hideS: ["vids"], design: { shadow: 1, border: 1, iconStyle: "dark" }, showB: [IW] },
  nature:  { order: [T, B, BC, R, P, BN, BT, G, PI], hideB: [U, S, TL], hideS: ["featured-collection"], design: { shadow: 1, border: 1, iconStyle: "outline" } },
  candy:   { order: [SB, U, T, R, AP, BN, P, B, BT, G, PI, TL], hideB: [S], hideS: [], design: { shadow: 2, border: 2, iconStyle: "accent" }, showB: [SB] },
  tech:    { order: [T, P, R, B, UG, BN, BT, PI, IW], hideB: [U, S, G, TL], hideS: ["brospify-hero", "vids"], design: { shadow: 0, border: 1, iconStyle: "dark" }, showB: [IW] },
  royal:   { order: [U, T, R, P, B, BN, BT, PI, G, TL, CO], hideB: [S], hideS: [], design: { shadow: 2, border: 1, iconStyle: "accent" }, showB: [CO] },
  luxe:    { order: [T, P, R, BT, PI, B], hideB: [U, S, G, TL, BN], hideS: ["vids", "bro-info-tabs"], design: { shadow: 0, border: 1, iconStyle: "outline" } },
  street:  { order: [SB, CD, T, R, P, SBAR, BT, PI, AP], hideB: [U, S, G, TL, B, BN], hideS: ["bro-info-tabs"], design: { shadow: 0, border: 2, iconStyle: "accent" }, showB: [SB] },
  clinic:  { order: [T, R, GU, B, UG, P, BT, PI, TL, TB], hideB: [U, S, G, BN], hideS: ["vids"], design: { shadow: 1, border: 1, iconStyle: "outline" } },
  cozy:    { order: [T, R, B, BC, P, BN, BT, G, PI], hideB: [U, S, TL], hideS: [], design: { shadow: 1, border: 1, iconStyle: "dark" } },
  sport:   { order: [U, T, R, RQ, P, BN, BT, SBAR, PI, B], hideB: [S, G, TL], hideS: [], design: { shadow: 0, border: 2, iconStyle: "accent" } },
  fresh:   { order: [T, R, AP, B, P, VS, BT, PI, G], hideB: [U, S, TL, BN], hideS: [], design: { shadow: 1, border: 1, iconStyle: "accent" } },
  family:  { order: [T, R, AP, B, GU, P, BN, BT, G, PI], hideB: [U, S, TL], hideS: [], design: { shadow: 1, border: 2, iconStyle: "accent" } },
  carbon:  { order: [T, R, SL, P, PD, BN, BT, PI, IW], hideB: [U, S, G, TL, B], hideS: ["bro-info-tabs"], design: { shadow: 2, border: 1, iconStyle: "accent" }, showB: [IW] },
  retro:   { order: [U, T, R, AP, P, B, BT, PI, CC], hideB: [S, G, TL, BN], hideS: ["vids"], design: { shadow: 0, border: 2, iconStyle: "dark" } },
  spa:     { order: [T, R, B, BC, P, BT, RP, PI, G, TL], hideB: [U, S, BN], hideS: [], design: { shadow: 1, border: 1, iconStyle: "outline" } },
  outdoor: { order: [T, R, HL, P, BN, BT, PI, SC, TL], hideB: [U, S, G, B], hideS: [], design: { shadow: 0, border: 2, iconStyle: "dark" } },
  deal:    { order: [SB, CD, U, T, R, P, MC, BN, CC, BT, SBAR, PI, G, TL], hideB: [S, B], hideS: [], design: { shadow: 1, border: 2, iconStyle: "accent" }, showB: [SB] },
};
for (const s of THEME_STYLES) {
  const e = STYLE_EXTRAS[s.id];
  if (!e) continue;
  // buyboxOrder als vollständige Permutation, GESAMT durch das bewährte
  // Funnel-Muster normalisiert (sortBuyboxOrder über kuratierte + fehlende
  // Default-Typen in EINEM Lauf — sonst landen sichtbare Nachzügler wie
  // description hinter collapsible_tab/complementary). Der Stil bestimmt
  // WELCHE Bausteine aktiv sind, der Funnel bestimmt WO sie stehen —
  // nie wieder „Bewertung nach dem Kaufen-Button".
  s.buyboxOrder = sortBuyboxOrder([
    ...e.order,
    ...BUYBOX_DEFAULT_ORDER.filter((t) => !e.order.includes(t)),
  ]);
  // Opt-in-Bausteine sind je Stil aus — außer der Stil schaltet sie via showB
  // gezielt frei (z. B. Bold → Sale-Banner, Tech → Vertrauens-Icons).
  const show = new Set(e.showB || []);
  s.hiddenBlocks = Array.from(new Set([...e.hideB, ...BUYBOX_OPTIONAL.filter((t) => !show.has(t))]));
  s.hiddenSections = e.hideS;
  s.design = e.design;
}

export const DEFAULT_STYLE_ID = "modern";

export function getThemeStyle(id: string | undefined): ThemeStyle {
  return THEME_STYLES.find((s) => s.id === id) || THEME_STYLES[0];
}

// ─── Ecken-Stil (zusätzliche Kunden-Anpassung über den Style hinweg) ──
export const RADIUS_OPTIONS = [
  { id: "sharp", label: "Kantig", value: 0 },
  { id: "soft", label: "Leicht", value: 10 },
  { id: "round", label: "Rund", value: 28 },
];

/** Baut die Radius-bezogenen settings_data-Overrides aus einem Px-Wert.
 *  Snappt auf das step-2-Raster der *_radius-Settings und deckelt bei 40 —
 *  ungerade Slider-Werte oder v+2 > 40 würden die settings_data sonst bei
 *  Shopifys Upload-Validierung komplett kippen. */
export function radiusOverrides(r: number): Record<string, number> {
  const v = snapRange(Number.isFinite(r) ? r : 8, 0, 40, 2);
  return {
    buttons_radius: v,
    card_corner_radius: v > 0 ? Math.min(40, v + 2) : 0,
    media_radius: v,
    inputs_radius: Math.min(v, 12),
    badge_corner_radius: v,
    variant_pills_radius: v > 0 ? 40 : 0,
  };
}

/** Default-Radius eines Stils (für die Vorbelegung im UI). */
export function radiusForStyle(style: ThemeStyle): number {
  const r = style.settingOverrides.buttons_radius;
  return typeof r === "number" ? r : 8;
}
