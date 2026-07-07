// Gemeinsame UI-Konstanten des Theme-Editors (client-safe).

import type { CSSProperties } from "react";
import type { GlobalStyles } from "@/lib/theme-doc";

import { THEME_FONTS, FONT_FAMILY, fontStack } from "@/lib/theme-fonts";

/** Abgeleitet aus der zentralen Font-Bibliothek (src/lib/theme-fonts.ts). */
export const EDITOR_FONTS = THEME_FONTS.map((f) => ({ value: f.value, label: f.label }));

export { FONT_FAMILY };

/** CSS-Variablen (--pv-*) für Replica-Renderer außerhalb des Vorschau-Canvas
 *  (z. B. Bibliotheks-Thumbnails) — identisch zur ThemePreview-Belegung. */
export function previewVars(g: GlobalStyles): CSSProperties {
  return {
    "--pv-bg": g.colors.background,
    "--pv-text": g.colors.text,
    "--pv-btn": g.colors.button,
    "--pv-btnText": g.colors.buttonText,
    "--pv-accent": g.colors.accent,
    "--pv-h": fontStack(g.headingFont),
    "--pv-b": fontStack(g.bodyFont),
    "--pv-r": `${Math.max(0, g.radius)}px`,
    "--pv-shadow": ["none", "0 4px 14px -8px rgba(0,0,0,.16)", "0 12px 30px -10px rgba(0,0,0,.26)"][Math.max(0, Math.min(2, g.design.shadow))],
    "--pv-bd": `${Math.max(1, Math.min(3, g.design.border))}px`,
  } as Record<string, string> as CSSProperties;
}

export const ACCENT = "#95BF47";

/** Klassen für Segment-Buttons (an/aus) im Editor-Chrome. */
export function segCls(on: boolean): string {
  return `rounded-md border px-1.5 py-1 text-[10px] font-medium transition ${
    on ? "border-[#95BF47]/60 bg-[#95BF47]/10 text-white" : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07]"
  }`;
}
