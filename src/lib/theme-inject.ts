import "server-only";
import AdmZip from "adm-zip";
import { getPlaceholderValues, type ThemeCopy } from "@/lib/theme-placeholders";

// ─────────────────────────────────────────────────────────────────
// Theme-Injection-Engine (in-memory, Vercel-tauglich).
//
// Nimmt das Master-Theme als Zip-Buffer, ersetzt `[[KEY]]`-Tokens NUR in den
// aktiven `order`-Sections, setzt eine ganze Farb-Palette + Schrift und gibt
// einen neuen Zip-Buffer zurück. `adm-zip` modifiziert nur die 3 JSON-Einträge.
// ─────────────────────────────────────────────────────────────────

const ACTIVE_TEMPLATES = ["templates/index.json", "templates/product.json"];
const SETTINGS_PATH = "config/settings_data.json";
const COLOR_SCHEME_KEYS = ["scheme-1", "scheme-2", "scheme-3", "scheme-4", "scheme-5"];

// Section-Setting-Keys, die als „Akzent" gelten und auf die Akzentfarbe
// umgefärbt werden (dekorative Farben, kein Layout-Risiko).
const ACCENT_KEYS = new Set([
  "accent_color", "star_color", "wave_color", "underline_color",
  "dot_active", "pin_color", "color_accent", "btn_border_color",
  "box2_badge_bg", "badge_bg_color",
]);

const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
const FONT_HANDLE_RE = /^[a-z0-9_]+$/;
const TOKEN_RE = /\[\[([A-Z0-9_]+)\]\]/g;
const COLORISH_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\([\d.,\s%]+\))$/;

export interface ThemeColors {
  /** Buttons & Primärfarbe. */
  button: string;
  /** Textfarbe auf Buttons. */
  buttonText: string;
  /** Seiten-Hintergrund. */
  background: string;
  /** Allgemeine Textfarbe. */
  text: string;
  /** Akzente: Wellen, Sterne, Unterstreichungen, Highlights. */
  accent: string;
}

export interface InjectOptions {
  themeCopy: ThemeCopy;
  colors: ThemeColors;
  font: string;
}

export function isValidHex(color: string): boolean {
  return typeof color === "string" && HEX_RE.test(color);
}
export function isValidFontHandle(font: string): boolean {
  return typeof font === "string" && FONT_HANDLE_RE.test(font);
}
export function isValidColors(c: Partial<ThemeColors> | null | undefined): c is ThemeColors {
  return (
    !!c &&
    isValidHex(c.button || "") &&
    isValidHex(c.buttonText || "") &&
    isValidHex(c.background || "") &&
    isValidHex(c.text || "") &&
    isValidHex(c.accent || "")
  );
}

/** Baut das personalisierte Theme. @returns Zip-Buffer. */
export function buildThemeZip(masterZip: Buffer, opts: InjectOptions): Buffer {
  if (!isValidColors(opts.colors)) throw new Error("Ungültige Farben — alle müssen Hex (#rrggbb) sein.");
  if (!isValidFontHandle(opts.font)) throw new Error("Ungültiges Font-Handle (z. B. work_sans_n4).");

  const zip = new AdmZip(masterZip);
  const values = getPlaceholderValues(opts.themeCopy);

  // Texte + Akzentfarben injizieren.
  for (const tplPath of ACTIVE_TEMPLATES) {
    const entry = findEntry(zip, tplPath);
    if (!entry) continue;
    const data = JSON.parse(entry.getData().toString("utf8"));
    injectTemplateData(data, values, opts.colors.accent);
    zip.updateFile(entry.entryName, Buffer.from(JSON.stringify(data, null, 2), "utf8"));
  }

  // Palette + Schrift in den globalen Settings.
  const settingsEntry = findEntry(zip, SETTINGS_PATH);
  if (settingsEntry) {
    const data = JSON.parse(settingsEntry.getData().toString("utf8"));
    injectSettingsData(data, opts.colors, opts.font);
    zip.updateFile(settingsEntry.entryName, Buffer.from(JSON.stringify(data, null, 2), "utf8"));
  }

  return zip.toBuffer();
}

// ─── Texte (Tokens) + Akzentfarben NUR in aktiven order-Sections ───

function injectTemplateData(
  data: { order?: string[]; sections?: Record<string, unknown> },
  values: ThemeCopy,
  accent: string,
) {
  const order = Array.isArray(data.order) ? data.order : [];
  const sections = (data.sections || {}) as Record<string, { disabled?: boolean } & Record<string, unknown>>;
  for (const sectionId of order) {
    const section = sections[sectionId];
    if (!section || section.disabled === true) continue; // nur AKTIVE Sections
    replaceTokensDeep(section, values);
    recolorAccentsDeep(section, accent);
  }
}

function replaceTokensDeep(node: unknown, values: ThemeCopy): void {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      if (typeof node[i] === "string") node[i] = replaceTokens(node[i] as string, values);
      else replaceTokensDeep(node[i], values);
    }
  } else if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      if (typeof obj[k] === "string") obj[k] = replaceTokens(obj[k] as string, values);
      else replaceTokensDeep(obj[k], values);
    }
  }
}

function replaceTokens(str: string, values: ThemeCopy): string {
  return str.replace(TOKEN_RE, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) && values[key] != null ? String(values[key]) : match,
  );
}

/** Setzt Akzent-Setting-Keys (dekorativ) auf die Akzentfarbe. */
function recolorAccentsDeep(node: unknown, accent: string): void {
  if (Array.isArray(node)) {
    for (const item of node) recolorAccentsDeep(item, accent);
  } else if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (typeof v === "string" && ACCENT_KEYS.has(k) && COLORISH_RE.test(v)) {
        obj[k] = accent;
      } else if (v && typeof v === "object") {
        recolorAccentsDeep(v, accent);
      }
    }
  }
}

// ─── Palette + Schrift in settings_data.json ───────────────────────

function injectSettingsData(
  data: { current?: Record<string, unknown> },
  colors: ThemeColors,
  font: string,
): void {
  const current = (data.current = (data.current || {}) as Record<string, unknown>);
  current.type_header_font = font;
  current.type_body_font = font;

  const schemes = (current.color_schemes = (current.color_schemes || {}) as Record<
    string,
    { settings?: Record<string, unknown> }
  >);
  for (const key of COLOR_SCHEME_KEYS) {
    const scheme = schemes[key];
    if (!scheme || !scheme.settings) continue;
    // Buttons + Button-Text in JEDEM Schema.
    scheme.settings.button = colors.button;
    scheme.settings.button_label = colors.buttonText;
    scheme.settings.secondary_button_label = colors.button;
    // Hintergrund + Text nur im Primär-Schema (dunkle Schemata bleiben dunkel).
    if (key === "scheme-1") {
      scheme.settings.background = colors.background;
      scheme.settings.text = colors.text;
    }
  }
}

// ─── Zip-Eintrag tolerant finden (Pfad-Trenner-agnostisch) ─────────

function findEntry(zip: AdmZip, wanted: string): AdmZip.IZipEntry | null {
  const direct = zip.getEntry(wanted);
  if (direct) return direct;
  const norm = wanted.replace(/\\/g, "/");
  return (
    zip.getEntries().find((e) => e.entryName.replace(/\\/g, "/").replace(/^\.?\//, "") === norm) || null
  );
}
