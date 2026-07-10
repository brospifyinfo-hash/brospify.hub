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

/** Dominante Farbtöne eines Bildes clientseitig extrahieren (Canvas) —
 *  genutzt vom AI Co-Pilot UND dem Eigenes-Produkt-Formular (paletteHints). */
export async function extractPalette(dataUrl: string): Promise<string[]> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = dataUrl;
    });
    const size = 48;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum > 244 || lum < 12) continue; // fast weiß/schwarz ignorieren
      const key = `${r >> 5}_${g >> 5}_${b >> 5}`;
      const e = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
      e.r += r; e.g += g; e.b += b; e.n += 1;
      buckets.set(key, e);
    }
    const hex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
    return Array.from(buckets.values())
      .sort((a, b) => b.n - a.n)
      .slice(0, 4)
      .map((e) => `#${hex(e.r / e.n)}${hex(e.g / e.n)}${hex(e.b / e.n)}`);
  } catch {
    return [];
  }
}

/** Klassen für Segment-Buttons (an/aus) im Editor-Chrome. */
export function segCls(on: boolean): string {
  return `rounded-md border px-1.5 py-1 text-[10px] font-medium transition ${
    on ? "border-[#95BF47]/60 bg-[#95BF47]/10 text-white" : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07]"
  }`;
}
