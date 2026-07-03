import type { ColorPalette } from "@/lib/theme-placeholders";
import { BUYBOX_DEFAULT_ORDER, BUYBOX_OPTIONAL } from "@/lib/theme-sections";

// ─────────────────────────────────────────────────────────────────
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

// Baut die settings_data-Overrides eines Stils konsistent aus einem Radius +
// optionalen Extras (card_style, Abstände, Skalierung …).
type SO = Record<string, number | string>;
function so(radius: number, opts: { card?: string; spacing?: number; pageWidth?: number; headingScale?: number; extra?: SO } = {}): SO {
  return {
    buttons_radius: radius,
    card_corner_radius: radius > 0 ? radius + 2 : 0,
    media_radius: radius,
    inputs_radius: Math.min(radius, 12),
    badge_corner_radius: radius,
    variant_pills_radius: radius > 0 ? 40 : 0,
    card_style: opts.card ?? "standard",
    spacing_sections: opts.spacing ?? 16,
    page_width: opts.pageWidth ?? 1200,
    heading_scale: opts.headingScale ?? 115,
    ...(opts.extra || {}),
  };
}

export const THEME_STYLES: ThemeStyle[] = [
  {
    id: "modern", label: "Modern", hint: "Clean, kantig, viel Weißraum",
    palette: { button: "#111111", buttonText: "#ffffff", background: "#ffffff", text: "#1a1a1a", accent: "#2f6bff" },
    headingFont: "inter_n4", bodyFont: "inter_n4",
    settingOverrides: so(0, { spacing: 12, pageWidth: 1400, headingScale: 112, extra: { media_radius: 6, buttons_border_thickness: 1 } }),
    hiddenTypes: ["wave", "map"],
  },
  {
    id: "elegant", label: "Elegant", hint: "Serifen, warm, luxuriös",
    palette: { button: "#1a1a1a", buttonText: "#ffffff", background: "#faf7f2", text: "#2a2520", accent: "#b8915f" },
    headingFont: "playfair_n4", bodyFont: "lato_n4",
    settingOverrides: so(14, { card: "card", spacing: 28, headingScale: 122, extra: { buttons_radius: 4, inputs_radius: 4 } }),
    hiddenTypes: ["wave"],
  },
  {
    id: "bold", label: "Bold", hint: "Große Typo, starker Kontrast",
    palette: { button: "#0a0a0a", buttonText: "#ffffff", background: "#fffdf6", text: "#0a0a0a", accent: "#ff4d2e" },
    headingFont: "bebas_neue_n4", bodyFont: "dmsans_n4",
    settingOverrides: so(0, { spacing: 8, pageWidth: 1500, headingScale: 145, extra: { buttons_border_thickness: 2 } }),
    hiddenTypes: ["map"],
  },
  {
    id: "playful", label: "Verspielt", hint: "Rund, bunt, freundlich",
    palette: { button: "#7c5cff", buttonText: "#ffffff", background: "#fffdf9", text: "#2a2440", accent: "#ff7aa8" },
    headingFont: "poppins_n4", bodyFont: "nunito_n4",
    settingOverrides: so(28, { card: "card", spacing: 16, headingScale: 110 }),
    hiddenTypes: [],
  },
  {
    id: "minimal", label: "Minimal", hint: "Reduziert, viel Luft",
    palette: { button: "#1a1a1a", buttonText: "#ffffff", background: "#ffffff", text: "#222222", accent: "#6b7280" },
    headingFont: "montserrat_n4", bodyFont: "inter_n4",
    settingOverrides: so(2, { spacing: 24, pageWidth: 1300, headingScale: 108 }),
    hiddenTypes: ["wave", "map", "socialicons"],
  },
  {
    id: "noir", label: "Noir", hint: "Dunkel & edel",
    palette: { button: "#ffffff", buttonText: "#0a0a0a", background: "#0f0f12", text: "#f2f2f4", accent: "#d4af37" },
    headingFont: "playfair_n4", bodyFont: "inter_n4",
    settingOverrides: so(6, { card: "card", spacing: 18, headingScale: 120 }),
    hiddenTypes: ["wave"],
  },
  {
    id: "sunset", label: "Sunset", hint: "Warm & einladend",
    palette: { button: "#2a1a12", buttonText: "#ffffff", background: "#fff7f0", text: "#3a2a20", accent: "#ff6b35" },
    headingFont: "poppins_n4", bodyFont: "nunito_n4",
    settingOverrides: so(20, { card: "card", spacing: 18, headingScale: 116 }),
    hiddenTypes: [],
  },
  {
    id: "ocean", label: "Ocean", hint: "Frisch & klar",
    palette: { button: "#0c2733", buttonText: "#ffffff", background: "#f3fafd", text: "#12303a", accent: "#0ea5e9" },
    headingFont: "montserrat_n4", bodyFont: "dmsans_n4",
    settingOverrides: so(12, { spacing: 18, headingScale: 114 }),
    hiddenTypes: ["map"],
  },
  {
    id: "nature", label: "Nature", hint: "Natürlich & ruhig",
    palette: { button: "#1f2a1a", buttonText: "#ffffff", background: "#f6faf3", text: "#26301f", accent: "#16a34a" },
    headingFont: "raleway_n4", bodyFont: "lato_n4",
    settingOverrides: so(14, { card: "card", spacing: 20, headingScale: 114 }),
    hiddenTypes: ["wave"],
  },
  {
    id: "candy", label: "Candy", hint: "Süß & verspielt",
    palette: { button: "#7a2e5a", buttonText: "#ffffff", background: "#fff5f9", text: "#3a2233", accent: "#f472b6" },
    headingFont: "nunito_n4", bodyFont: "nunito_n4",
    settingOverrides: so(30, { card: "card", spacing: 16, headingScale: 112 }),
    hiddenTypes: [],
  },
  {
    id: "tech", label: "Tech", hint: "Modern & digital",
    palette: { button: "#0f1220", buttonText: "#ffffff", background: "#f7f8fc", text: "#131728", accent: "#6366f1" },
    headingFont: "inter_n4", bodyFont: "inter_n4",
    settingOverrides: so(8, { spacing: 14, pageWidth: 1400, headingScale: 116 }),
    hiddenTypes: ["wave", "map"],
  },
  {
    id: "royal", label: "Royal", hint: "Luxuriös & tief",
    palette: { button: "#2a1a4a", buttonText: "#ffffff", background: "#faf7ff", text: "#241a3a", accent: "#7c3aed" },
    headingFont: "playfair_n4", bodyFont: "lato_n4",
    settingOverrides: so(10, { card: "card", spacing: 20, headingScale: 120 }),
    hiddenTypes: ["wave"],
  },
];

// ─── Pro Stil: eigene Baustein-Anordnung + Sichtbarkeit + Karten-Design ──
// So sieht jeder Stil nicht nur farblich anders aus, sondern hat auch ein
// anderes Layout (Reihenfolge/ein-/ausgeblendete Bausteine & Sektionen) und
// eine andere Design-Ausprägung (Schatten, Randstärke, Icon-Stil).
const U = "urgency_text", T = "custom_title", R = "custom_rating", B = "benefits_list",
  S = "stock_indicator", P = "custom_price", BN = "bundle_selector", BT = "buy_buttons",
  PI = "payment_icons", G = "free_gift", TL = "delivery_timeline",
  SB = "sale_banner", FB = "feature_box", IW = "icon-with-text", CT = "collapsible_tab", CO = "complementary";
interface StyleExtra {
  order: string[];
  hideB: string[];
  hideS: string[];
  design: StyleDesign;
  /** Opt-in-Bausteine, die DIESER Stil sichtbar schaltet (aus BUYBOX_OPTIONAL). */
  showB?: string[];
}
const STYLE_EXTRAS: Record<string, StyleExtra> = {
  modern:  { order: [T, R, P, B, BN, BT, PI], hideB: [U, S, G, TL], hideS: ["bro-info-tabs", "vids"], design: { shadow: 0, border: 1, iconStyle: "dark" } },
  elegant: { order: [U, T, R, B, S, P, BN, BT, PI, G, CT], hideB: [TL], hideS: ["vids"], design: { shadow: 2, border: 1, iconStyle: "outline" }, showB: [CT] },
  bold:    { order: [SB, U, T, P, BN, BT, B, R, S, PI], hideB: [G, TL], hideS: ["bro-info-tabs"], design: { shadow: 0, border: 2, iconStyle: "accent" }, showB: [SB] },
  playful: { order: [U, T, R, BN, B, S, P, BT, G, PI, TL, FB], hideB: [], hideS: [], design: { shadow: 1, border: 2, iconStyle: "accent" }, showB: [FB] },
  minimal: { order: [T, P, BN, BT], hideB: [U, R, B, S, PI, G, TL], hideS: ["bro-info-tabs", "brospify-hero", "vids"], design: { shadow: 0, border: 1, iconStyle: "outline" } },
  noir:    { order: [U, T, R, P, BN, BT, PI, G, TL], hideB: [B, S], hideS: ["featured-collection"], design: { shadow: 2, border: 1, iconStyle: "accent" } },
  sunset:  { order: [U, T, R, B, P, BN, BT, G, PI, TL], hideB: [S], hideS: [], design: { shadow: 1, border: 1, iconStyle: "accent" } },
  ocean:   { order: [T, R, B, S, P, BN, BT, PI, TL, IW], hideB: [U, G], hideS: ["vids"], design: { shadow: 1, border: 1, iconStyle: "dark" }, showB: [IW] },
  nature:  { order: [T, B, R, P, BN, BT, G, PI], hideB: [U, S, TL], hideS: ["featured-collection"], design: { shadow: 1, border: 1, iconStyle: "outline" } },
  candy:   { order: [SB, U, T, R, BN, P, B, BT, G, PI, TL], hideB: [S], hideS: [], design: { shadow: 2, border: 2, iconStyle: "accent" }, showB: [SB] },
  tech:    { order: [T, P, R, B, BN, BT, PI, IW], hideB: [U, S, G, TL], hideS: ["brospify-hero", "vids"], design: { shadow: 0, border: 1, iconStyle: "dark" }, showB: [IW] },
  royal:   { order: [U, T, R, P, B, BN, BT, PI, G, TL, CO], hideB: [S], hideS: [], design: { shadow: 2, border: 1, iconStyle: "accent" }, showB: [CO] },
};
for (const s of THEME_STYLES) {
  const e = STYLE_EXTRAS[s.id];
  if (!e) continue;
  // buyboxOrder als vollständige Permutation (fehlende Typen ans Ende — sie sind
  // ohnehin über hiddenBlocks aus).
  s.buyboxOrder = [...e.order, ...BUYBOX_DEFAULT_ORDER.filter((t) => !e.order.includes(t))];
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

/** Baut die Radius-bezogenen settings_data-Overrides aus einem Px-Wert. */
export function radiusOverrides(r: number): Record<string, number> {
  const v = Math.max(0, Math.min(40, Math.round(Number.isFinite(r) ? r : 8)));
  return {
    buttons_radius: v,
    card_corner_radius: v > 0 ? v + 2 : 0,
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
