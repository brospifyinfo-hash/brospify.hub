import "server-only";
import AdmZip from "adm-zip";
import {
  getPlaceholderValues,
  type ThemeCopy,
  type ColorPalette,
} from "@/lib/theme-placeholders";
import type { ThemeDocument, SectionInstance } from "@/lib/theme-doc";
import {
  SECTION_LIBRARY,
  getSectionDef,
  getPresetDef,
  resolveTexts,
  resolvePaletteRef,
  type BaseSectionInfo,
} from "@/lib/theme-library";
import { getThemeStyle, radiusOverrides } from "@/lib/theme-styles";
import {
  applyCopyBindings,
  applyBuyboxLayout,
  applyBenefitIcons,
  injectSettingsData,
  replaceTokensDeep,
  recolorByRoleDeep,
  findEntry,
} from "@/lib/theme-inject";

// ─────────────────────────────────────────────────────────────────
// Compile-Engine v2: ThemeDocument → fertiges Shopify-Theme-ZIP.
//
// Ein Dokument (Produkt, globale Styles, Section-Instanzen mit Presets,
// Kaufbox) wird deterministisch auf DREI Dateien abgebildet:
//   config/settings_data.json  ← global (Fonts, Palette, Radius, Design)
//   templates/product.json     ← Sections (Reorder + Presets + Instanziierung)
//   templates/index.json       ← Copy/Farben (Struktur bleibt Basis-Stand)
// Die Vorschau liest DIESELBEN Bibliotheks-Definitionen → Vorschau = Download.
// ─────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

const MANAGED_TYPES = new Set(SECTION_LIBRARY.map((s) => s.type));
const TOKEN_STRIP_RE = /\[\[[A-Z0-9_]+\]\]/g;

interface TemplateData {
  order?: string[];
  sections?: Record<string, any>;
}

// ─── Schema-Defaults einer Section aus der Basis-ZIP lesen ─────────

interface SectionSchema {
  settingsDefaults: Record<string, unknown>;
  blockDefaults: Record<string, Record<string, unknown>>;
}

const SCHEMA_RE = /\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/;
const schemaCache = new Map<string, SectionSchema | null>();

function readSectionSchema(zip: AdmZip, cacheKey: string, type: string): SectionSchema | null {
  const key = `${cacheKey}|${type}`;
  if (schemaCache.has(key)) return schemaCache.get(key) ?? null;
  let result: SectionSchema | null = null;
  const entry = findEntry(zip, `sections/${type}.liquid`);
  if (entry) {
    try {
      const raw = entry.getData().toString("utf8");
      const m = raw.match(SCHEMA_RE);
      if (m) {
        const schema = JSON.parse(m[1]);
        const settingsDefaults: Record<string, unknown> = {};
        for (const s of schema.settings || []) {
          if (s && s.id && s.default !== undefined) settingsDefaults[s.id] = s.default;
        }
        const blockDefaults: Record<string, Record<string, unknown>> = {};
        for (const b of schema.blocks || []) {
          if (!b || !b.type) continue;
          const d: Record<string, unknown> = {};
          for (const s of b.settings || []) {
            if (s && s.id && s.default !== undefined) d[s.id] = s.default;
          }
          blockDefaults[b.type] = d;
        }
        result = { settingsDefaults, blockDefaults };
      }
    } catch (e) {
      console.warn(`[theme-compile] Schema von ${type} nicht lesbar:`, e);
    }
  }
  schemaCache.set(key, result);
  return result;
}

/** Existiert der Section-Typ als nicht-leere Liquid-Datei in der Basis? */
function sectionTypeAvailable(zip: AdmZip, type: string): boolean {
  const entry = findEntry(zip, `sections/${type}.liquid`);
  return !!entry && entry.getData().length > 80;
}

// ─── Manifest der Basis (für Editor-UI + Initial-Dokument) ─────────

export interface BaseManifest {
  /** Aktive Produktseiten-Sections verwalteter Typen (id + Typ, in order-Reihenfolge). */
  baseSections: BaseSectionInfo[];
  /** Bibliotheks-Typen, die diese Basis wirklich rendern kann. */
  capabilities: string[];
}

export function readBaseManifest(baseZip: Buffer, cacheKey = "base"): BaseManifest {
  const zip = new AdmZip(baseZip);
  const baseSections: BaseSectionInfo[] = [];
  const entry = findEntry(zip, "templates/product.json");
  if (entry) {
    try {
      const data = JSON.parse(entry.getData().toString("utf8")) as TemplateData;
      const order = Array.isArray(data.order) ? data.order : [];
      for (const sid of order) {
        const sec = data.sections?.[sid];
        if (!sec || sec.disabled === true) continue;
        const type = String(sec.type || "");
        if (MANAGED_TYPES.has(type) && sectionTypeAvailable(zip, type)) {
          baseSections.push({ id: sid, type });
        }
      }
    } catch (e) {
      console.warn("[theme-compile] product.json der Basis nicht lesbar:", e);
    }
  }
  const capabilities = SECTION_LIBRARY.filter((s) => sectionTypeAvailable(zip, s.type)).map((s) => s.type);
  void cacheKey;
  return { baseSections, capabilities };
}

// ─── Dokument → product.json ───────────────────────────────────────

function ensureHtml(s: string): string {
  return /<[a-z][\s\S]*>/i.test(s) ? s : `<p>${s}</p>`;
}

/** Wendet Preset-Settings + kuratierte Texte einer Instanz auf die Section an. */
function applyInstanceToSection(section: any, instance: SectionInstance, palette: ColorPalette): void {
  const def = getSectionDef(instance.type);
  if (!def) return;
  const preset = getPresetDef(def, instance.presetId);
  section.settings = section.settings && typeof section.settings === "object" ? section.settings : {};

  // 1) Preset-Settings (Palette-Refs auflösen) — echte Schema-Keys.
  for (const [k, v] of Object.entries(preset?.settings || {})) {
    section.settings[k] = resolvePaletteRef(v, palette);
  }

  // 2) Kuratierte Texte (Feld-Defaults ⊕ Nutzer-Eingaben).
  const texts = resolveTexts(instance);
  for (const f of def.fields) {
    const raw = texts[f.id];
    if (typeof raw !== "string" || !raw.trim()) continue;
    const value = f.html ? ensureHtml(raw) : raw;
    if (f.target.blockType) {
      const blocks = section.blocks || {};
      const blockOrder: string[] = Array.isArray(section.block_order) ? section.block_order : Object.keys(blocks);
      const idsOfType = blockOrder.filter((id) => String(blocks[id]?.type || "") === f.target.blockType);
      const targetId = idsOfType[f.target.index ?? 0];
      if (targetId && blocks[targetId]) {
        blocks[targetId].settings = blocks[targetId].settings || {};
        blocks[targetId].settings[f.target.key] = value;
      }
    } else {
      section.settings[f.target.key] = value;
    }
  }
}

/** Baut eine frische Section aus Schema-Defaults + Preset-Block-Rezepten. */
function instantiateSection(zip: AdmZip, cacheKey: string, instance: SectionInstance): any | null {
  if (!sectionTypeAvailable(zip, instance.type)) return null;
  const schema = readSectionSchema(zip, cacheKey, instance.type);
  const def = getSectionDef(instance.type);
  const preset = getPresetDef(def, instance.presetId);

  const section: any = { type: instance.type, settings: { ...(schema?.settingsDefaults || {}) } };
  const recipes = preset?.blocks || [];
  if (recipes.length) {
    const blocks: Record<string, any> = {};
    const blockOrder: string[] = [];
    recipes.forEach((r, i) => {
      const id = `b${i + 1}`;
      blocks[id] = {
        type: r.type,
        settings: { ...(schema?.blockDefaults[r.type] || {}), ...r.settings },
      };
      blockOrder.push(id);
    });
    section.blocks = blocks;
    section.block_order = blockOrder;
  }
  return section;
}

function compileProductTemplate(
  data: TemplateData,
  doc: ThemeDocument,
  zip: AdmZip,
  cacheKey: string,
  values: ThemeCopy,
  palette: ColorPalette,
): void {
  const sections = (data.sections = data.sections && typeof data.sections === "object" ? data.sections : {});
  const origOrder = Array.isArray(data.order) ? data.order : Object.keys(sections);

  // Copy-Bindings + Token-Injection zuerst auf dem UNVERÄNDERTEN Template —
  // die Vorkommens-Zählung der Bindings setzt die Original-Reihenfolge voraus.
  applyCopyBindings(data, "product");
  for (const sid of origOrder) {
    const sec = sections[sid];
    if (!sec || sec.disabled === true) continue;
    replaceTokensDeep(sec, values);
    recolorByRoleDeep(sec, palette);
  }

  // Struktur: verwaltete Basis-Sections raus, Dokument-Sections rein.
  const isManaged = (sid: string) => MANAGED_TYPES.has(String(sections[sid]?.type || ""));
  const unmanagedPrefix: string[] = [];
  const unmanagedSuffix: string[] = [];
  let seenManaged = false;
  for (const sid of origOrder) {
    if (isManaged(sid)) {
      seenManaged = true;
      continue;
    }
    (seenManaged ? unmanagedSuffix : unmanagedPrefix).push(sid);
  }

  const docIds: string[] = [];
  const keptTemplateIds = new Set<string>();
  for (const instance of doc.sections) {
    let section: any = null;
    let sid = instance.uid;
    if (instance.source === "template" && sections[instance.uid]) {
      section = sections[instance.uid];
      keptTemplateIds.add(instance.uid);
      delete section.disabled;
    } else {
      // Bevorzugt eine Basis-Section gleichen Typs klonen (behält echte
      // Inhalte wie Kollektions-Verweise/Videos), sonst frisch instanziieren.
      const donorId = origOrder.find((id) => String(sections[id]?.type || "") === instance.type);
      if (donorId) {
        section = JSON.parse(JSON.stringify(sections[donorId]));
        delete section.disabled;
      } else {
        section = instantiateSection(zip, cacheKey, instance);
      }
      if (!section) {
        console.warn(`[theme-compile] Section-Typ „${instance.type}" nicht in Basis — übersprungen.`);
        continue;
      }
      sid = instance.uid.startsWith("hub_") ? instance.uid : `hub_${instance.uid}`;
      sections[sid] = section;
    }
    applyInstanceToSection(section, instance, palette);
    // Nutzer-Texte sind final — eventuelle Rest-Tokens darin auflösen.
    replaceTokensDeep(section, values);
    docIds.push(sid);
  }

  // Nicht übernommene verwaltete Basis-Sections komplett entfernen
  // (Shopify verlangt: jede Section in `sections` steht genau 1× in `order`).
  for (const sid of origOrder) {
    if (isManaged(sid) && !keptTemplateIds.has(sid)) delete sections[sid];
  }

  data.order = [...unmanagedPrefix, ...docIds, ...unmanagedSuffix];

  // Kaufbox (main-product): Reihenfolge, Sichtbarkeit, Vorteile-Icons.
  applyBuyboxLayout(data, doc.buybox.order, doc.buybox.hidden);
  applyBenefitIcons(data, doc.buybox.benefitIcons);

  // Rest-Tokens in aktiven Sections leeren (nie rohes [[…]] ausliefern).
  for (const sid of data.order) {
    const sec = sections[sid];
    if (!sec || sec.disabled === true) continue;
    stripStrayTokens(sec);
  }
}

function stripStrayTokens(node: unknown): void {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      if (typeof node[i] === "string") node[i] = (node[i] as string).replace(TOKEN_STRIP_RE, "").trim();
      else stripStrayTokens(node[i]);
    }
  } else if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      if (typeof obj[k] === "string") obj[k] = (obj[k] as string).replace(TOKEN_STRIP_RE, "").trim();
      else stripStrayTokens(obj[k]);
    }
  }
}

// ─── Validierung (vor dem Download — nie ein kaputtes ZIP liefern) ──

function validateProductTemplate(data: TemplateData): void {
  const sections = data.sections || {};
  const order = Array.isArray(data.order) ? data.order : [];
  if (!order.length) throw new Error("Validierung: order-Array der Produktseite ist leer.");
  for (const sid of order) {
    if (!sections[sid]) throw new Error(`Validierung: Section „${sid}" fehlt im sections-Objekt.`);
  }
  const orderSet = new Set(order);
  if (orderSet.size !== order.length) throw new Error("Validierung: doppelte Section-ID im order-Array.");
  for (const sid of Object.keys(sections)) {
    if (!orderSet.has(sid)) throw new Error(`Validierung: Section „${sid}" steht nicht im order-Array.`);
  }
  const main = Object.values(sections).find((s: any) => s && s.type === "main-product") as any;
  if (!main) throw new Error("Validierung: main-product-Section fehlt.");
  if (!Array.isArray(main.block_order) || !main.block_order.length) {
    throw new Error("Validierung: main-product hat keine Bausteine (block_order leer).");
  }
  for (const bid of main.block_order) {
    if (!main.blocks?.[bid]) throw new Error(`Validierung: Kaufbox-Baustein „${bid}" fehlt.`);
  }
}

// ─── Haupteinstieg ─────────────────────────────────────────────────

export function compileDocumentZip(
  baseZip: Buffer,
  doc: ThemeDocument,
  themeCopy: ThemeCopy,
  cacheKey = "base",
): Buffer {
  const zip = new AdmZip(baseZip);
  const values = getPlaceholderValues(themeCopy);
  const style = getThemeStyle(doc.global.styleId);
  const palette = doc.global.colors;

  // 1) templates/product.json — Struktur + Presets + Texte + Kaufbox.
  const productEntry = findEntry(zip, "templates/product.json");
  if (!productEntry) throw new Error("Theme-Basis hat keine templates/product.json.");
  const productData = JSON.parse(productEntry.getData().toString("utf8")) as TemplateData;
  compileProductTemplate(productData, doc, zip, cacheKey, values, palette);
  validateProductTemplate(productData);
  zip.updateFile(productEntry.entryName, Buffer.from(JSON.stringify(productData, null, 2), "utf8"));

  // 2) templates/index.json — Copy + Farben (Struktur bleibt Basis-Stand).
  const indexEntry = findEntry(zip, "templates/index.json");
  if (indexEntry) {
    try {
      const indexData = JSON.parse(indexEntry.getData().toString("utf8")) as TemplateData;
      applyCopyBindings(indexData, "index");
      const hidden = new Set(style.hiddenTypes || []);
      const order = Array.isArray(indexData.order) ? indexData.order : [];
      for (const sid of order) {
        const sec = indexData.sections?.[sid];
        if (!sec) continue;
        if (sec.type && hidden.has(String(sec.type))) {
          sec.disabled = true;
          continue;
        }
        if (sec.disabled === true) continue;
        replaceTokensDeep(sec, values);
        recolorByRoleDeep(sec, palette);
        stripStrayTokens(sec);
      }
      zip.updateFile(indexEntry.entryName, Buffer.from(JSON.stringify(indexData, null, 2), "utf8"));
    } catch (e) {
      console.warn("[theme-compile] index.json übersprungen:", e);
    }
  }

  // 3) config/settings_data.json — globale Styles.
  const settingsEntry = findEntry(zip, "config/settings_data.json");
  if (settingsEntry) {
    try {
      const settingsData = JSON.parse(settingsEntry.getData().toString("utf8"));
      const d = doc.global.design;
      injectSettingsData(settingsData, palette, doc.global.bodyFont, doc.global.headingFont, {
        ...style.settingOverrides,
        ...radiusOverrides(doc.global.radius),
        card_style: d.shadow >= 1 ? "card" : "standard",
        card_shadow_opacity: [0, 8, 18][Math.max(0, Math.min(2, d.shadow))],
        card_border_thickness: d.border,
        buttons_border_thickness: d.border,
      });
      zip.updateFile(settingsEntry.entryName, Buffer.from(JSON.stringify(settingsData, null, 2), "utf8"));
    } catch (e) {
      console.warn("[theme-compile] settings_data.json übersprungen:", e);
    }
  }

  return zip.toBuffer();
}

/** Minimale Dokument-Prüfung für den Export-Endpoint (400 statt 500). */
export function isValidDocument(doc: unknown): doc is ThemeDocument {
  if (!doc || typeof doc !== "object") return false;
  const d = doc as ThemeDocument;
  return (
    d.version === 1 &&
    typeof d.productId === "string" &&
    !!d.global &&
    typeof d.global.styleId === "string" &&
    !!d.global.colors &&
    Array.isArray(d.sections) &&
    d.sections.every((s) => s && typeof s.uid === "string" && typeof s.type === "string") &&
    !!d.buybox &&
    Array.isArray(d.buybox.order)
  );
}
