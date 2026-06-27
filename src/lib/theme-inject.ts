import "server-only";
import AdmZip from "adm-zip";
import { getPlaceholderValues, type ThemeCopy } from "@/lib/theme-placeholders";

// ─────────────────────────────────────────────────────────────────
// Theme-Injection-Engine (in-memory, Vercel-tauglich).
//
// Nimmt das Master-Theme als Zip-Buffer, ersetzt `[[KEY]]`-Tokens NUR in den
// aktiven `order`-Sections von index.json/product.json, setzt Farbe + Schrift
// in settings_data.json und gibt einen neuen Zip-Buffer zurück. Kein /tmp,
// kein Entpacken auf die Platte — `adm-zip` modifiziert nur die 3 JSON-Einträge.
// ─────────────────────────────────────────────────────────────────

const ACTIVE_TEMPLATES = ["templates/index.json", "templates/product.json"];
const SETTINGS_PATH = "config/settings_data.json";
const COLOR_SCHEME_KEYS = ["scheme-1", "scheme-2", "scheme-3", "scheme-4", "scheme-5"];

const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
const FONT_HANDLE_RE = /^[a-z0-9_]+$/;
const TOKEN_RE = /\[\[([A-Z0-9_]+)\]\]/g;

export interface InjectOptions {
  themeCopy: ThemeCopy;
  color: string; // #rrggbb
  font: string; // Shopify-Font-Handle, z. B. work_sans_n4
}

export function isValidHex(color: string): boolean {
  return typeof color === "string" && HEX_RE.test(color);
}
export function isValidFontHandle(font: string): boolean {
  return typeof font === "string" && FONT_HANDLE_RE.test(font);
}

/**
 * Baut das personalisierte Theme.
 * @returns Zip-Buffer des fertigen Themes.
 */
export function buildThemeZip(masterZip: Buffer, opts: InjectOptions): Buffer {
  if (!isValidHex(opts.color)) throw new Error("Ungültige Farbe — erwartet Hex wie #95bf47.");
  if (!isValidFontHandle(opts.font)) throw new Error("Ungültiges Font-Handle (z. B. work_sans_n4).");

  const zip = new AdmZip(masterZip);
  const values = getPlaceholderValues(opts.themeCopy);

  // Texte injizieren.
  for (const tplPath of ACTIVE_TEMPLATES) {
    const entry = findEntry(zip, tplPath);
    if (!entry) continue; // Template nicht im Theme → überspringen
    const data = JSON.parse(entry.getData().toString("utf8"));
    injectTemplateData(data, values);
    zip.updateFile(entry.entryName, Buffer.from(JSON.stringify(data, null, 2), "utf8"));
  }

  // Farbe + Schrift injizieren.
  const settingsEntry = findEntry(zip, SETTINGS_PATH);
  if (settingsEntry) {
    const data = JSON.parse(settingsEntry.getData().toString("utf8"));
    injectSettingsData(data, opts.color, opts.font);
    zip.updateFile(settingsEntry.entryName, Buffer.from(JSON.stringify(data, null, 2), "utf8"));
  }

  return zip.toBuffer();
}

// ─── Token-Ersetzung NUR in aktiven order-Sections ─────────────────

function injectTemplateData(data: { order?: string[]; sections?: Record<string, unknown> }, values: ThemeCopy) {
  const order = Array.isArray(data.order) ? data.order : [];
  const sections = (data.sections || {}) as Record<string, { disabled?: boolean } & Record<string, unknown>>;
  for (const sectionId of order) {
    const section = sections[sectionId];
    if (!section || section.disabled === true) continue; // nur AKTIVE Sections
    replaceTokensDeep(section, values);
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

// ─── Farbe + Schrift ───────────────────────────────────────────────

function injectSettingsData(
  data: { current?: Record<string, unknown> },
  color: string,
  font: string,
): void {
  const current = (data.current = (data.current || {}) as Record<string, unknown>);
  current.type_header_font = font;
  current.type_body_font = font;

  const label = contrastColor(color);
  const schemes = (current.color_schemes = (current.color_schemes || {}) as Record<
    string,
    { settings?: Record<string, unknown> }
  >);
  for (const key of COLOR_SCHEME_KEYS) {
    const scheme = schemes[key];
    if (scheme && scheme.settings) {
      scheme.settings.button = color;
      scheme.settings.button_label = label;
    }
  }
}

/** Schwarz/Weiß je nach Helligkeit der Farbe (grobe WCAG-Heuristik). */
function contrastColor(hex: string): string {
  const c = hex.replace("#", "");
  const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#121212" : "#ffffff";
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
