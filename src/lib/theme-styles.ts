import type { ColorPalette } from "@/lib/theme-placeholders";

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
}

export const THEME_STYLES: ThemeStyle[] = [
  {
    id: "modern",
    label: "Modern",
    hint: "Clean, kantig, viel Weißraum",
    palette: { button: "#111111", buttonText: "#ffffff", background: "#ffffff", text: "#1a1a1a", accent: "#2f6bff" },
    headingFont: "inter_n4",
    bodyFont: "inter_n4",
    settingOverrides: {
      buttons_radius: 0, variant_pills_radius: 0, inputs_radius: 0, card_corner_radius: 0,
      media_radius: 6, badge_corner_radius: 0, buttons_border_thickness: 1, card_style: "standard",
      spacing_sections: 12, page_width: 1400, heading_scale: 112,
    },
    hiddenTypes: ["wave", "map"],
  },
  {
    id: "elegant",
    label: "Elegant",
    hint: "Serifen, warm, luxuriös",
    palette: { button: "#1a1a1a", buttonText: "#ffffff", background: "#faf7f2", text: "#2a2520", accent: "#b8915f" },
    headingFont: "playfair_n4",
    bodyFont: "lato_n4",
    settingOverrides: {
      buttons_radius: 4, variant_pills_radius: 40, inputs_radius: 4, card_corner_radius: 14,
      media_radius: 14, badge_corner_radius: 40, card_style: "card",
      spacing_sections: 28, page_width: 1200, heading_scale: 122,
    },
    hiddenTypes: ["wave"],
  },
  {
    id: "bold",
    label: "Bold",
    hint: "Große Typo, starker Kontrast",
    palette: { button: "#0a0a0a", buttonText: "#ffffff", background: "#fffdf6", text: "#0a0a0a", accent: "#ff4d2e" },
    headingFont: "bebas_neue_n4",
    bodyFont: "dmsans_n4",
    settingOverrides: {
      buttons_radius: 0, variant_pills_radius: 0, inputs_radius: 0, card_corner_radius: 0,
      media_radius: 0, badge_corner_radius: 0, buttons_border_thickness: 2, card_style: "standard",
      spacing_sections: 8, page_width: 1500, heading_scale: 145,
    },
    hiddenTypes: ["map"],
  },
  {
    id: "playful",
    label: "Verspielt",
    hint: "Rund, bunt, freundlich",
    palette: { button: "#7c5cff", buttonText: "#ffffff", background: "#fffdf9", text: "#2a2440", accent: "#ff7aa8" },
    headingFont: "poppins_n4",
    bodyFont: "nunito_n4",
    settingOverrides: {
      buttons_radius: 30, variant_pills_radius: 30, inputs_radius: 16, card_corner_radius: 20,
      media_radius: 20, badge_corner_radius: 30, card_style: "card",
      spacing_sections: 16, page_width: 1200, heading_scale: 110,
    },
    hiddenTypes: [],
  },
];

export const DEFAULT_STYLE_ID = "modern";

export function getThemeStyle(id: string | undefined): ThemeStyle {
  return THEME_STYLES.find((s) => s.id === id) || THEME_STYLES[0];
}
