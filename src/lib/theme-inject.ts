import "server-only";
import AdmZip from "adm-zip";
import {
  getPlaceholderValues,
  recolorByRole,
  type ThemeCopy,
  type ColorPalette,
} from "@/lib/theme-placeholders";

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

const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
const FONT_HANDLE_RE = /^[a-z0-9_]+$/;
const TOKEN_RE = /\[\[([A-Z0-9_]+)\]\]/g;

export type ThemeColors = ColorPalette;

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
    injectTemplateData(data, values, opts.colors);
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
  palette: ColorPalette,
) {
  const order = Array.isArray(data.order) ? data.order : [];
  const sections = (data.sections || {}) as Record<string, { disabled?: boolean } & Record<string, unknown>>;
  for (const sectionId of order) {
    const section = sections[sectionId];
    if (!section || section.disabled === true) continue; // nur AKTIVE Sections
    replaceTokensDeep(section, values);
    recolorByRoleDeep(section, palette);
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

/** Färbt Setting-Keys gemäß ihrer Palette-Rolle um (Akzent/Button/Button-Text).
 *  Exakt dieselbe Logik nutzt die Live-Vorschau → Vorschau = Download. */
function recolorByRoleDeep(node: unknown, palette: ColorPalette): void {
  if (Array.isArray(node)) {
    for (const item of node) recolorByRoleDeep(item, palette);
  } else if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (typeof v === "string") {
        const mapped = recolorByRole(k, v, palette);
        if (mapped !== null) obj[k] = mapped;
      } else if (v && typeof v === "object") {
        recolorByRoleDeep(v, palette);
      }
    }
  }
}

// ─── Aktive Sections fürs Frontend lesen (für die Live-Vorschau) ───

export interface PreviewSection {
  id: string;
  type: string;
  settings: Record<string, unknown>;
  blocks?: Record<string, { type: string; settings: Record<string, unknown> }>;
  block_order?: string[];
}

function readTemplateSections(zip: AdmZip, tplPath: string, values: ThemeCopy): PreviewSection[] {
  const entry = findEntry(zip, tplPath);
  if (!entry) return [];
  let data: { order?: string[]; sections?: Record<string, unknown> };
  try {
    data = JSON.parse(entry.getData().toString("utf8"));
  } catch {
    return [];
  }
  const order = Array.isArray(data.order) ? data.order : [];
  const sections = (data.sections || {}) as Record<string, { disabled?: boolean } & Record<string, unknown>>;
  const out: PreviewSection[] = [];
  for (const id of order) {
    const sec = sections[id];
    if (!sec || sec.disabled === true) continue;
    // Tokens ersetzen (Texte). Farben werden clientseitig live gesetzt.
    replaceTokensDeep(sec, values);
    out.push({
      id,
      type: String(sec.type || ""),
      settings: (sec.settings as Record<string, unknown>) || {},
      blocks: sec.blocks as PreviewSection["blocks"],
      block_order: sec.block_order as string[] | undefined,
    });
  }
  return out;
}

/** Liest die aktiven Sections von index.json + product.json (Tokens ersetzt)
 *  fürs Rendern der Live-Vorschau. */
export function readActiveSections(
  masterZip: Buffer,
  themeCopy: ThemeCopy,
): { home: PreviewSection[]; product: PreviewSection[] } {
  const zip = new AdmZip(masterZip);
  const values = getPlaceholderValues(themeCopy);
  return {
    home: readTemplateSections(zip, "templates/index.json", values),
    product: readTemplateSections(zip, "templates/product.json", values),
  };
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
