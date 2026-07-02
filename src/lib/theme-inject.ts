import "server-only";
import AdmZip from "adm-zip";
import {
  getPlaceholderValues,
  recolorByRole,
  type ThemeCopy,
  type ColorPalette,
} from "@/lib/theme-placeholders";
import { BUYBOX_BLOCKS, BUYBOX_DEFAULT_ORDER } from "@/lib/theme-sections";

const BUYBOX_TYPES = new Set(BUYBOX_BLOCKS.map((b) => b.type));

// ─────────────────────────────────────────────────────────────────
// Theme-Injection-Engine (in-memory, Vercel-tauglich).
//
// Nimmt das Master-Theme als Zip-Buffer, ersetzt `[[KEY]]`-Tokens NUR in den
// aktiven `order`-Sections, setzt eine ganze Farb-Palette + Schrift und gibt
// einen neuen Zip-Buffer zurück. `adm-zip` modifiziert nur die 3 JSON-Einträge.
// ─────────────────────────────────────────────────────────────────

const ACTIVE_TEMPLATES = ["templates/index.json", "templates/product.json"];
const SETTINGS_PATH = "config/settings_data.json";

const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
const FONT_HANDLE_RE = /^[a-z0-9_]+$/;
const TOKEN_RE = /\[\[([A-Z0-9_]+)\]\]/g;

export type ThemeColors = ColorPalette;

export interface InjectOptions {
  themeCopy: ThemeCopy;
  colors: ThemeColors;
  font: string; // Body-Schrift
  headingFont?: string; // Überschriften-Schrift (default = Body)
  hiddenTypes?: string[]; // Section-Typen, die der Style ausblendet (→ disabled)
  settingOverrides?: Record<string, number | string>; // globale Style-Settings
  buyboxOrder?: string[]; // Reihenfolge der main-product-Bausteine (Block-Typen)
  hiddenBlocks?: string[]; // ausgeblendete main-product-Bausteine (Block-Typen)
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
  const hidden = new Set(opts.hiddenTypes || []);

  // Texte + Palette injizieren; vom Style ausgeblendete Sections disablen.
  // Pro Template defensiv — ein kaputtes/fremdes Template darf den Build nicht
  // abbrechen (Ziel: läuft auf JEDEM hochgeladenen Theme).
  for (const tplPath of ACTIVE_TEMPLATES) {
    const entry = findEntry(zip, tplPath);
    if (!entry) continue;
    try {
      const data = JSON.parse(entry.getData().toString("utf8"));
      injectTemplateData(data, values, opts.colors, hidden);
      if (/product\.json$/.test(tplPath)) applyBuyboxLayout(data, opts.buyboxOrder, opts.hiddenBlocks);
      zip.updateFile(entry.entryName, Buffer.from(JSON.stringify(data, null, 2), "utf8"));
    } catch (e) {
      console.warn(`[theme-inject] Template übersprungen (${tplPath}):`, e);
    }
  }

  // Palette + Schrift + Style-Settings in den globalen Settings.
  const settingsEntry = findEntry(zip, SETTINGS_PATH);
  if (settingsEntry) {
    try {
      const data = JSON.parse(settingsEntry.getData().toString("utf8"));
      injectSettingsData(data, opts.colors, opts.font, opts.headingFont || opts.font, opts.settingOverrides);
      zip.updateFile(settingsEntry.entryName, Buffer.from(JSON.stringify(data, null, 2), "utf8"));
    } catch (e) {
      console.warn("[theme-inject] settings_data.json übersprungen:", e);
    }
  }

  return zip.toBuffer();
}

// ─── Kaufbox-Layout: Bausteine sortieren + ausblenden ───────────────
// Wendet die vom Kunden gewählte Reihenfolge/Sichtbarkeit der main-product-
// Bausteine auf `block_order` an. Nicht verwaltete Blöcke (Beschreibung,
// Accordions, Variant-Picker …) bleiben an ihrer Position; die verwalteten
// Slots werden mit der Nutzer-Reihenfolge gefüllt (ausgeblendete entfallen).
/* eslint-disable @typescript-eslint/no-explicit-any */
function applyBuyboxLayout(data: any, order?: string[], hiddenBlocks?: string[]): void {
  const hasOrder = Array.isArray(order) && order.length > 0;
  const hasHidden = Array.isArray(hiddenBlocks) && hiddenBlocks.length > 0;
  if (!hasOrder && !hasHidden) return;
  const sections = data?.sections;
  if (!sections || typeof sections !== "object") return;
  const main: any = Object.values(sections).find((s: any) => s && s.type === "main-product");
  if (!main || !main.blocks || !Array.isArray(main.block_order)) return;

  const typeOf = (id: string): string => String(main.blocks[id]?.type || "");
  const hidden = new Set(hiddenBlocks || []);
  const orderTypes = hasOrder ? (order as string[]) : BUYBOX_DEFAULT_ORDER;

  // Verwaltete Block-IDs je Typ (Original-Reihenfolge).
  const byType: Record<string, string[]> = {};
  for (const id of main.block_order) {
    const t = typeOf(id);
    if (BUYBOX_TYPES.has(t)) (byType[t] ||= []).push(id);
  }
  // Nutzer-Reihenfolge → IDs (ausgeblendete Typen entfallen).
  const userManaged: string[] = [];
  for (const t of orderTypes) {
    if (hidden.has(t)) continue;
    for (const id of byType[t] || []) userManaged.push(id);
  }
  // Original durchgehen: verwaltete Slots mit userManaged füllen, Rest bleibt.
  let mi = 0;
  const result: string[] = [];
  for (const id of main.block_order) {
    if (BUYBOX_TYPES.has(typeOf(id))) {
      if (mi < userManaged.length) result.push(userManaged[mi++]);
    } else {
      result.push(id);
    }
  }
  main.block_order = result;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── Texte (Tokens) + Akzentfarben NUR in aktiven order-Sections ───

function injectTemplateData(
  data: { order?: string[]; sections?: Record<string, unknown> },
  values: ThemeCopy,
  palette: ColorPalette,
  hidden: Set<string>,
) {
  const order = Array.isArray(data.order) ? data.order : [];
  const sections = (data.sections || {}) as Record<string, { disabled?: boolean; type?: string } & Record<string, unknown>>;
  for (const sectionId of order) {
    const section = sections[sectionId];
    if (!section) continue;
    if (section.type && hidden.has(section.type)) { section.disabled = true; continue; } // Style blendet aus
    if (section.disabled === true) continue; // nur AKTIVE Sections
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
  headingFont: string,
  settingOverrides?: Record<string, number | string>,
): void {
  const current = (data.current = (data.current || {}) as Record<string, unknown>);
  current.type_header_font = headingFont;
  current.type_body_font = font;
  // Style-Overrides (Radius/Spacing/…) nur setzen, wenn das Theme den Key kennt
  // ODER es ein bekannter Standard-Key ist — schadet sonst nicht, kann aber bei
  // exotischen Themes ignoriert werden. Wir setzen sie tolerant immer.
  if (settingOverrides) Object.assign(current, settingOverrides);

  // Farbschemata: NICHT auf scheme-1..5 festnageln — jedes Theme benennt sie
  // anders (Dawn: "scheme-1", neuere: "background-1"/"accent-1", custom: …).
  // Wir laufen über ALLE vorhandenen Schemata und färben Buttons überall;
  // Hintergrund/Text setzen wir nur im ERSTEN Schema (damit dunkle Schemata
  // dunkel bleiben). So „funktioniert" die Farbanpassung auf jedem Theme.
  const schemes = current.color_schemes;
  if (schemes && typeof schemes === "object") {
    const keys = Object.keys(schemes as Record<string, unknown>);
    let isFirst = true;
    for (const key of keys) {
      const scheme = (schemes as Record<string, { settings?: Record<string, unknown> }>)[key];
      if (!scheme || !scheme.settings || typeof scheme.settings !== "object") continue;
      const s = scheme.settings;
      // Buttons + Button-Text nur überschreiben, wenn der Key existiert
      // (so bauen wir keine fremden Keys ins Theme, die Shopify ignoriert).
      if ("button" in s) s.button = colors.button;
      if ("button_label" in s) s.button_label = colors.buttonText;
      if ("secondary_button_label" in s) s.secondary_button_label = colors.button;
      if (isFirst) {
        if ("background" in s) s.background = colors.background;
        if ("text" in s) s.text = colors.text;
        isFirst = false;
      }
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
