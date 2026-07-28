// ─── Farb-Mathe + MONO-Design-System (client-safe, SINGLE SOURCE) ────────────
// Design-Entscheidung 2026-07-28 (Nutzer-Vorgabe): Sections haben KEINE bunten
// Hintergründe und KEINE Farbverläufe mehr. Ein Theme ist entweder WEISS-Modus
// (weiße Seite, dunkler Text) oder BLACK-Modus (schwarze Seite, heller Text).
// Die Akzentfarbe — aus dem Produkt abgeleitet oder vom Kunden gesetzt —
// trägt NUR noch Sub-Texte, Buttons, Icons, Badges, Sterne und feine Linien.
//
// Flächen dürfen ausschließlich NEUTRAL sein (weiß, zartes Grau, schwarz).
// Damit vorhandene Presets, die weißen Text auf einer farbigen Fläche
// ausgeben, lesbar bleiben, ist die Umfärbung POLARITÄTS-ERHALTEND: eine
// helle Fläche wird hell-neutral, eine dunkle (oder akzentfarbene) Fläche
// wird dunkel-neutral. Text-/Icon-Keys bleiben dadurch unangetastet.
//
// Vorschau (SectionReplica/ThemePreview) UND Export (theme-compile) nutzen
// dieselben Funktionen → „Vorschau = Download" bleibt garantiert.

import type { ColorPalette } from "@/lib/theme-placeholders";

const HEX6 = /^#([0-9a-f]{6})$/i;

export function isHex(v: unknown): v is string {
  return typeof v === "string" && HEX6.test(v.trim());
}

export function mixHex(a: string, b: string, t: number): string {
  const pa = HEX6.exec(a)?.[1];
  const pb = HEX6.exec(b)?.[1];
  if (!pa || !pb) return a;
  const c = (o: number) => {
    const va = parseInt(pa.slice(o, o + 2), 16);
    const vb = parseInt(pb.slice(o, o + 2), 16);
    return Math.round(va + (vb - va) * t).toString(16).padStart(2, "0");
  };
  return `#${c(0)}${c(2)}${c(4)}`;
}

/** WCAG-relative Luminanz (0 = schwarz, 1 = weiß). Ungültig → 1 (hell). */
export function relLuminance(hex: string): number {
  const m = HEX6.exec(hex);
  if (!m) return 1;
  const chan = (o: number) => {
    let c = parseInt(m[1].slice(o, o + 2), 16) / 255;
    c = c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return c;
  };
  return 0.2126 * chan(0) + 0.7152 * chan(2) + 0.0722 * chan(4);
}

/** True, wenn auf der Farbe HELLER Text besser lesbar ist als dunkler. */
export function isDarkColor(hex: string): boolean {
  return relLuminance(hex) < 0.4;
}

// Mindest-Luminanz für Flächen, auf denen Sections hart dunklen Text setzen.
const MIN_BG_LUM = 0.34;

/** Legacy-Klammer: hebt zu dunkle Alt-Hintergründe an. Neue Designs brauchen
 *  das nicht mehr (Mono-Flächen sind per Konstruktion sicher). */
export function ensureReadableBg(hex: string): string {
  if (!isHex(hex)) return hex;
  if (relLuminance(hex) >= MIN_BG_LUM) return hex;
  for (let t = 0.12; t <= 1; t += 0.08) {
    const lifted = mixHex(hex, "#ffffff", t);
    if (relLuminance(lifted) >= MIN_BG_LUM) return lifted;
  }
  return "#f3f2ef";
}

// ─── Die einzigen erlaubten Flächen-Farben ──────────────────────────────────

export const MONO = {
  /** Seite im Weiß-Modus. */
  white: "#ffffff",
  /** Zarte helle Fläche (Kontrast-Band, Karten auf Weiß). */
  offWhite: "#f6f6f7",
  /** Etwas kräftigere helle Fläche (max. Kontrast im Weiß-Modus). */
  softWhite: "#f0f0f1",
  /** Seite im Black-Modus. */
  black: "#000000",
  /** Zarte dunkle Fläche (Kontrast-Band im Black-Modus). */
  offBlack: "#0e0e10",
  /** Dunkles Panel (weißer Text darauf bleibt lesbar). */
  ink: "#111114",
  /** Abgesetzte dunkle Karte / Panel im Black-Modus. */
  inkSoft: "#17171a",
  /** Fließtext hell/dunkel. */
  textLight: "#111114",
  textDark: "#f5f5f7",
} as const;

export interface MonoTokens {
  /** Black-Modus? (aus der Seiten-Hintergrundfarbe abgeleitet) */
  dark: boolean;
  /** Seiten-Hintergrund (#ffffff oder #000000). */
  page: string;
  /** Dezente Kontrast-Fläche für Bänder/Karten. */
  surface: string;
  /** Kräftigere Kontrast-Fläche (Höhepunkt einer Seite). */
  strong: string;
  /** Dunkles Panel — hier steht IMMER heller Text drauf. */
  panel: string;
  /** Fließtext-Farbe des Modus. */
  text: string;
}

/** Mono-Tokens eines Themes — allein abhängig davon, ob die Seite dunkel ist. */
export function monoTokens(palette: ColorPalette): MonoTokens {
  const dark = isDarkColor(palette.background);
  return dark
    ? { dark, page: MONO.black, surface: MONO.offBlack, strong: MONO.inkSoft, panel: MONO.inkSoft, text: MONO.textDark }
    : { dark, page: MONO.white, surface: MONO.offWhite, strong: MONO.softWhite, panel: MONO.ink, text: MONO.textLight };
}

/**
 * Normalisiert eine Palette auf das Mono-System: Hintergrund wird zu reinem
 * Weiß bzw. reinem Schwarz, Text auf die passende neutrale Gegenfarbe.
 * Button-, Button-Text- und Akzentfarbe bleiben UNANGETASTET — sie sind die
 * erlaubten Farbträger (Buttons, Icons, Sub-Texte).
 */
export function monoPalette(p: ColorPalette): ColorPalette {
  const dark = isDarkColor(p.background);
  return {
    ...p,
    background: dark ? MONO.black : MONO.white,
    text: dark ? MONO.textDark : MONO.textLight,
  };
}

/** Nur der Seiten-Hintergrund (für set_colors/AI): weiß ODER schwarz. */
export function monoBackground(bg: string): string {
  return isDarkColor(bg) ? MONO.black : MONO.white;
}

/** Ist die Palette im Black-Modus? */
export function isDarkMode(p: ColorPalette): boolean {
  return isDarkColor(p.background);
}

// ─── Flächen-Keys der Section-Presets → Mono ────────────────────────────────
// „section" = Fläche der ganzen Sektion · „card" = Karte/Kachel INNERHALB
// einer Sektion · „panel" = ehemalige Verlaufs-Fläche (wird EINE Farbe).
// NUR Section-Settings laufen hier durch — Kaufbox-Bausteine behalten ihre
// Akzent-Flächen (Badges, Balken), das ist der erlaubte Farbträger.

export type SurfaceLevel = "section" | "card" | "panel";

export const MONO_SURFACE_KEYS: Record<string, SurfaceLevel> = {
  bg: "section",
  bg_color: "section",
  color_bg: "section",
  background_color: "section",
  band_bg: "section",
  bg_1: "card",
  bg_2: "card",
  bg_3: "card",
  bg_4: "card",
  c1_bg: "card",
  c2_bg: "card",
  card_bg: "card",
  color_card: "card",
  box_bg: "card",
  panel_bg: "card",
  // Verlaufs-Stopps: alle drei bekommen dieselbe Farbe → kein Verlauf mehr.
  g1: "panel",
  g2: "panel",
  g3: "panel",
};

/**
 * Übersetzt EINEN Flächen-Wert in die Mono-Welt. Polaritäts-erhaltend, damit
 * der Text des Presets lesbar bleibt:
 *   hell  → weiß / zartes Grau      dunkel & akzentfarben → dunkles Panel
 * Nicht-Hex-Werte (rgba(), transparent, Bild-Refs) bleiben unangetastet.
 */
export function monoSurface(value: string, palette: ColorPalette, level: SurfaceLevel): string {
  if (!isHex(value)) return value;
  const m = monoTokens(palette);
  const v = value.trim().toLowerCase();
  if (level === "panel") return m.panel;
  // Die Seitenfarbe selbst bleibt die Seitenfarbe (keine unnötige Kante).
  if (v === palette.background.trim().toLowerCase()) return m.page;
  // Vollflächen in Akzent-/Button-Farbe sind der klassische „bunte Block" —
  // sie tragen fast immer weißen Text, werden also zum dunklen Panel.
  const accentish = v === palette.accent.trim().toLowerCase() || v === palette.button.trim().toLowerCase();
  if (accentish || isDarkColor(v)) return m.panel;
  return level === "card" ? m.surface : m.page;
}

/** Mono-Wert für einen Setting-Key — oder null, wenn der Key keine Fläche ist. */
export function monoSurfaceForKey(key: string, value: unknown, palette: ColorPalette): string | null {
  const level = MONO_SURFACE_KEYS[key];
  if (!level || typeof value !== "string") return null;
  const mapped = monoSurface(value, palette, level);
  return mapped === value ? null : mapped;
}

// ─── Hintergrund-Töne der Sections (Design-Layer sec_bg) ────────────────────
// Ersetzt die alten Akzent-Tönungen: es gibt nur noch neutrale Abstufungen,
// die IMMER zum Modus passen (heller Modus → helle Flächen, Black-Modus →
// dunkle Flächen). Damit kann keine Section je „bunt" oder unlesbar werden.

export type SectionTone = "none" | "tint" | "soft" | "wash" | "deep";
export const SECTION_TONES: SectionTone[] = ["none", "tint", "soft", "wash", "deep"];

/** Neutrale Fläche eines Tons ("" = Seitenfarbe, keine eigene Fläche). */
export function monoToneSurface(tone: SectionTone, palette: ColorPalette): string {
  const m = monoTokens(palette);
  switch (tone) {
    case "tint":
    case "wash":
      return m.surface;
    case "soft":
    case "deep":
      return m.strong;
    default:
      return "";
  }
}
