// Zentrale Font-Bibliothek des Theme-Editors — SINGLE SOURCE OF TRUTH.
// value = Shopify-font_picker-Handle (muss exakt in Shopifys Font-Library existieren,
// sonst lehnt der Theme-Upload die settings_data.json ab!). Neue Fonts nur mit
// verifiziertem Handle ergänzen; Mehrwort-Familien haben unregelmäßige Slugs
// (playfair_n4, dmsans_n4) — im Zweifel weglassen.
// google = css2-Familien-Param inkl. NUR tatsächlich existierender Gewichte
// (ein ungültiges Gewicht lässt Google die ganze Familie verwerfen).

export interface ThemeFontDef {
  value: string; // Shopify-Handle, z. B. "work_sans_n4"
  label: string; // Anzeigename
  family: string; // CSS-Familienname (unquoted)
  google: string; // css2-Param, z. B. "Work+Sans:wght@400;600;800"
  serif?: boolean; // fürs CSS-Fallback (serif statt sans-serif)
}

export const THEME_FONTS: ThemeFontDef[] = [
  { value: "work_sans_n4", label: "Work Sans", family: "Work Sans", google: "Work+Sans:wght@400;600;800" },
  { value: "poppins_n4", label: "Poppins", family: "Poppins", google: "Poppins:wght@400;600;800" },
  { value: "montserrat_n4", label: "Montserrat", family: "Montserrat", google: "Montserrat:wght@400;600;800" },
  { value: "inter_n4", label: "Inter", family: "Inter", google: "Inter:wght@400;600;800" },
  { value: "roboto_n4", label: "Roboto", family: "Roboto", google: "Roboto:wght@400;500;700" },
  { value: "lato_n4", label: "Lato", family: "Lato", google: "Lato:wght@400;700;900" },
  { value: "nunito_n4", label: "Nunito", family: "Nunito", google: "Nunito:wght@400;600;800" },
  { value: "raleway_n4", label: "Raleway", family: "Raleway", google: "Raleway:wght@400;600;800" },
  { value: "dmsans_n4", label: "DM Sans", family: "DM Sans", google: "DM+Sans:wght@400;600;700" },
  { value: "assistant_n4", label: "Assistant", family: "Assistant", google: "Assistant:wght@400;600;800" },
  { value: "oswald_n4", label: "Oswald", family: "Oswald", google: "Oswald:wght@400;600;700" },
  { value: "bebas_neue_n4", label: "Bebas Neue", family: "Bebas Neue", google: "Bebas+Neue" },
  { value: "playfair_n4", label: "Playfair Display", family: "Playfair Display", google: "Playfair+Display:wght@400;600;800", serif: true },
  { value: "merriweather_n4", label: "Merriweather", family: "Merriweather", google: "Merriweather:wght@400;700;900", serif: true },
  { value: "acme_n4", label: "Acme", family: "Acme", google: "Acme" },
  // Erweiterung 2026-07 (nur Ein-Wort-Familien = eindeutige Shopify-Handles):
  { value: "anton_n4", label: "Anton", family: "Anton", google: "Anton" },
  { value: "archivo_n4", label: "Archivo", family: "Archivo", google: "Archivo:wght@400;600;800" },
  { value: "cabin_n4", label: "Cabin", family: "Cabin", google: "Cabin:wght@400;600;700" },
  { value: "cormorant_n4", label: "Cormorant", family: "Cormorant", google: "Cormorant:wght@400;600;700", serif: true },
  { value: "karla_n4", label: "Karla", family: "Karla", google: "Karla:wght@400;600;800" },
  { value: "lora_n4", label: "Lora", family: "Lora", google: "Lora:wght@400;600;700", serif: true },
  { value: "quicksand_n4", label: "Quicksand", family: "Quicksand", google: "Quicksand:wght@400;600;700" },
  { value: "rubik_n4", label: "Rubik", family: "Rubik", google: "Rubik:wght@400;600;800" },
  { value: "alegreya_n4", label: "Alegreya", family: "Alegreya", google: "Alegreya:wght@400;600;800", serif: true },
];

const BY_HANDLE: Record<string, ThemeFontDef> = Object.fromEntries(
  THEME_FONTS.map((f) => [f.value, f]),
);

export function getFontDef(handle: string): ThemeFontDef {
  return BY_HANDLE[handle] || THEME_FONTS[0];
}

/** Handle → gequotete CSS-Familie, z. B. "'Work Sans'". */
export const FONT_FAMILY: Record<string, string> = Object.fromEntries(
  THEME_FONTS.map((f) => [f.value, `'${f.family}'`]),
);

/** Komplette CSS-family-Deklaration inkl. Fallback (serif/sans-serif). */
export function fontStack(handle: string): string {
  const def = getFontDef(handle);
  return `'${def.family}', ${def.serif ? "serif" : "sans-serif"}`;
}

/** Google-Fonts-css2-URL für beliebig viele Handles (dedupliziert). */
export function googleFontsUrlFor(handles: string[]): string {
  const parts = Array.from(new Set(handles.map((h) => getFontDef(h).google))).map(
    (g) => `family=${g}`,
  );
  return `https://fonts.googleapis.com/css2?${parts.join("&")}&display=swap`;
}

/** Eine URL mit ALLEN Editor-Fonts (für die Live-Vorschau). */
export const GOOGLE_FONTS_ALL = googleFontsUrlFor(THEME_FONTS.map((f) => f.value));
