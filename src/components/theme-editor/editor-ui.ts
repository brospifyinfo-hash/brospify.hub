// Gemeinsame UI-Konstanten des Theme-Editors (client-safe).

import type { CSSProperties } from "react";
import type { GlobalStyles } from "@/lib/theme-doc";

export const EDITOR_FONTS = [
  { value: "work_sans_n4", label: "Work Sans" },
  { value: "poppins_n4", label: "Poppins" },
  { value: "montserrat_n4", label: "Montserrat" },
  { value: "inter_n4", label: "Inter" },
  { value: "roboto_n4", label: "Roboto" },
  { value: "lato_n4", label: "Lato" },
  { value: "nunito_n4", label: "Nunito" },
  { value: "raleway_n4", label: "Raleway" },
  { value: "dmsans_n4", label: "DM Sans" },
  { value: "assistant_n4", label: "Assistant" },
  { value: "oswald_n4", label: "Oswald" },
  { value: "bebas_neue_n4", label: "Bebas Neue" },
  { value: "playfair_n4", label: "Playfair Display" },
  { value: "merriweather_n4", label: "Merriweather" },
  { value: "acme_n4", label: "Acme" },
];

export const FONT_FAMILY: Record<string, string> = {
  work_sans_n4: "'Work Sans'", poppins_n4: "'Poppins'", montserrat_n4: "'Montserrat'",
  inter_n4: "'Inter'", roboto_n4: "'Roboto'", lato_n4: "'Lato'", nunito_n4: "'Nunito'",
  raleway_n4: "'Raleway'", dmsans_n4: "'DM Sans'", assistant_n4: "'Assistant'",
  oswald_n4: "'Oswald'", bebas_neue_n4: "'Bebas Neue'", playfair_n4: "'Playfair Display'",
  merriweather_n4: "'Merriweather'", acme_n4: "'Acme'",
};

/** CSS-Variablen (--pv-*) für Replica-Renderer außerhalb des Vorschau-Canvas
 *  (z. B. Bibliotheks-Thumbnails) — identisch zur ThemePreview-Belegung. */
export function previewVars(g: GlobalStyles): CSSProperties {
  return {
    "--pv-bg": g.colors.background,
    "--pv-text": g.colors.text,
    "--pv-btn": g.colors.button,
    "--pv-btnText": g.colors.buttonText,
    "--pv-accent": g.colors.accent,
    "--pv-h": `${FONT_FAMILY[g.headingFont] || "'Work Sans'"}, sans-serif`,
    "--pv-b": `${FONT_FAMILY[g.bodyFont] || "'Work Sans'"}, sans-serif`,
    "--pv-r": `${Math.max(0, g.radius)}px`,
    "--pv-shadow": ["none", "0 4px 14px -8px rgba(0,0,0,.16)", "0 12px 30px -10px rgba(0,0,0,.26)"][Math.max(0, Math.min(2, g.design.shadow))],
    "--pv-bd": `${Math.max(1, Math.min(3, g.design.border))}px`,
  } as Record<string, string> as CSSProperties;
}

export const ACCENT = "#95BF47";

/** Klassen für Segment-Buttons (an/aus) im Editor-Chrome. */
export function segCls(on: boolean): string {
  return `rounded-md border px-2 py-1.5 text-[11px] font-medium transition ${
    on ? "border-[#95BF47]/60 bg-[#95BF47]/10 text-white" : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07]"
  }`;
}
