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
  getBuyboxLib,
  resolveBlockSettings,
  effectiveBuyboxPresetId,
  getGalleryPreset,
  type BaseSectionInfo,
} from "@/lib/theme-library";
import { getThemeStyle, radiusOverrides } from "@/lib/theme-styles";
import { BUYBOX_BLOCKS } from "@/lib/theme-sections";
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
        // "t:…"-Defaults (Schema-Übersetzungskeys) NICHT übernehmen — in
        // Template-Settings würden sie als roher Text erscheinen.
        const usable = (v: unknown) => v !== undefined && !(typeof v === "string" && v.startsWith("t:"));
        const settingsDefaults: Record<string, unknown> = {};
        for (const s of schema.settings || []) {
          if (s && s.id && usable(s.default)) settingsDefaults[s.id] = s.default;
        }
        const blockDefaults: Record<string, Record<string, unknown>> = {};
        for (const b of schema.blocks || []) {
          if (!b || !b.type) continue;
          const d: Record<string, unknown> = {};
          for (const s of b.settings || []) {
            if (s && s.id && usable(s.default)) d[s.id] = s.default;
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
  /** Aktive Startseiten-Sections verwalteter Typen (templates/index.json). */
  homeSections: BaseSectionInfo[];
  /** Bibliotheks-Typen, die diese Basis wirklich rendern kann. */
  capabilities: string[];
}

function readManagedSections(zip: AdmZip, tplPath: string): BaseSectionInfo[] {
  const out: BaseSectionInfo[] = [];
  const entry = findEntry(zip, tplPath);
  if (!entry) return out;
  try {
    const data = JSON.parse(entry.getData().toString("utf8")) as TemplateData;
    const order = Array.isArray(data.order) ? data.order : [];
    for (const sid of order) {
      const sec = data.sections?.[sid];
      if (!sec || sec.disabled === true) continue;
      const type = String(sec.type || "");
      if (MANAGED_TYPES.has(type) && sectionTypeAvailable(zip, type)) {
        out.push({ id: sid, type });
      }
    }
  } catch (e) {
    console.warn(`[theme-compile] ${tplPath} der Basis nicht lesbar:`, e);
  }
  return out;
}

export function readBaseManifest(baseZip: Buffer, cacheKey = "base"): BaseManifest {
  const zip = new AdmZip(baseZip);
  const capabilities = SECTION_LIBRARY.filter((s) => sectionTypeAvailable(zip, s.type)).map((s) => s.type);
  void cacheKey;
  return {
    baseSections: readManagedSections(zip, "templates/product.json"),
    homeSections: readManagedSections(zip, "templates/index.json"),
    capabilities,
  };
}

// ─── Dokument → product.json ───────────────────────────────────────

function ensureHtml(s: string): string {
  return /<[a-z][\s\S]*>/i.test(s) ? s : `<p>${s}</p>`;
}

/** Wendet Preset-Settings + kuratierte Texte einer Instanz auf die Section an. */
function applyInstanceToSection(section: any, instance: SectionInstance, palette: ColorPalette, fresh = false): void {
  const def = getSectionDef(instance.type);
  if (!def) return;
  // presetId "" = NEUTRAL (übernommene Startseiten-Sections behalten ihren
  // Basis-Look) — identische Semantik wie resolvePresetSettings im Frontend.
  const preset = instance.presetId ? getPresetDef(def, instance.presetId) : undefined;
  section.settings = section.settings && typeof section.settings === "object" ? section.settings : {};

  // 1) Preset-Settings (Palette-Refs auflösen) — echte Schema-Keys.
  for (const [k, v] of Object.entries(preset?.settings || {})) {
    section.settings[k] = resolvePaletteRef(v, palette);
  }

  // 2) Kuratierte Texte. Regel: NUTZER-Eingaben überschreiben immer;
  //    Feld-Defaults füllen nur LEERE Ziele — vorhandene Inhalte (KI-Texte
  //    aus Copy-Bindings, echte Template-Inhalte) bleiben sonst erhalten.
  const userTexts = instance.texts || {};
  const isBlank = (v: unknown) =>
    typeof v !== "string" || !v.trim() || /\[\[[A-Z0-9_]+\]\]/.test(v) || v.startsWith("t:");
  for (const f of def.fields) {
    const u = userTexts[f.id];
    const userVal = typeof u === "string" && u.trim() ? u.trim() : null;

    // Ziel auflösen (Section-Setting oder Block-Setting).
    let target: Record<string, unknown> | null = null;
    if (f.target.blockType) {
      const blocks = section.blocks || {};
      const blockOrder: string[] = Array.isArray(section.block_order) ? section.block_order : Object.keys(blocks);
      const idsOfType = blockOrder.filter((id) => String(blocks[id]?.type || "") === f.target.blockType);
      const targetId = idsOfType[f.target.index ?? 0];
      if (targetId && blocks[targetId]) {
        blocks[targetId].settings = blocks[targetId].settings || {};
        target = blocks[targetId].settings;
      }
    } else {
      target = section.settings;
    }
    if (!target) continue;

    // FRISCH instanzierte Sections tragen nur generische Schema-Platzhalter
    // (z. B. "UEBERSCHRIFT") — dort überschreiben unsere kuratierten
    // Feld-Defaults IMMER. Bei Template-/Klon-Sections füllen Defaults nur
    // leere Ziele (echte Inhalte + KI-Texte bleiben erhalten).
    const raw = userVal ?? ((fresh || isBlank(target[f.target.key])) && f.def ? f.def : null);
    if (!raw) continue;
    target[f.target.key] = f.html ? ensureHtml(raw) : raw;
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

/** Dynamische Buy Box: Sync-Code + Hub-URL für den Master-Block.
 *  `payloadJson` ({v, css, plan}) und `runtimeJs` werden zusätzlich als
 *  Theme-Assets ins ZIP gebacken — die Buy Box rendert dann IMMER voll
 *  designt (Offline-Plan), der Hub-Abruf ist nur noch der Live-Update-Kanal. */
export interface DynamicBuyboxOpts {
  syncCode: string;
  hubUrl: string;
  payloadJson?: string;
  runtimeJs?: string;
}

function compileProductTemplate(
  data: TemplateData,
  doc: ThemeDocument,
  zip: AdmZip,
  cacheKey: string,
  values: ThemeCopy,
  palette: ColorPalette,
  dyn: DynamicBuyboxOpts | null,
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
    let fresh = false;
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
        fresh = true; // nur Schema-Platzhalter → kuratierte Texte übernehmen
      }
      if (!section) {
        console.warn(`[theme-compile] Section-Typ „${instance.type}" nicht in Basis — übersprungen.`);
        continue;
      }
      sid = instance.uid.startsWith("hub_") ? instance.uid : `hub_${instance.uid}`;
      sections[sid] = section;
    }
    applyInstanceToSection(section, instance, palette, fresh);
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

  // Produktgalerie (pg_*) bleibt IMMER statisch im ZIP — nur die
  // Produktinfo-Spalte ist von der dynamischen Buy Box betroffen.
  applyGallerySettings(data, doc, palette);

  // Kaufbox: DYNAMISCH (ein brospify_buybox-Block, Design kommt live über
  // den Sync-Code vom Hub) — oder STATISCH als Fallback, wenn die Basis den
  // Master-Block nicht kennt (alte Uploads) oder kein Sync-Code vorliegt.
  const dynOk = dyn ? applyDynamicBuybox(data, zip, cacheKey, dyn.syncCode, dyn.hubUrl) : false;
  if (dynOk && dyn) {
    // Offline-Plan + Runtime als Theme-Assets einbacken → Buy Box rendert
    // auch ohne Hub/Code voll designt (Runtime-Kette: Hub → Cache → Asset).
    if (dyn.payloadJson) zip.addFile("assets/bspx-plan.json", Buffer.from(dyn.payloadJson, "utf8"));
    if (dyn.runtimeJs) zip.addFile("assets/bspx-runtime.js", Buffer.from(dyn.runtimeJs, "utf8"));
  } else {
    applyBuyboxStatic(data, doc, zip, cacheKey, palette);
    applyBuyboxLayout(data, doc.buybox.order, doc.buybox.hidden);
    applyBenefitIcons(data, doc.buybox.benefitIcons);
  }

  // Rest-Tokens in aktiven Sections leeren (nie rohes [[…]] ausliefern).
  for (const sid of data.order) {
    const sec = sections[sid];
    if (!sec || sec.disabled === true) continue;
    stripStrayTokens(sec);
  }
}

// ─── Produktgalerie (pg_*): Preset + Radius + Badge — immer statisch ──

function findMainProduct(data: TemplateData): any | null {
  return (Object.values(data.sections || {}) as any[]).find((s) => s && s.type === "main-product") || null;
}

function applyGallerySettings(data: TemplateData, doc: ThemeDocument, palette: ColorPalette): void {
  const main = findMainProduct(data);
  if (!main) return;
  main.settings = main.settings && typeof main.settings === "object" ? main.settings : {};
  const buybox = doc.buybox || ({} as ThemeDocument["buybox"]);
  // Ältere Clients senden evtl. kein gallery-Feld → dann Basis unangetastet.
  if (buybox.gallery && typeof buybox.gallery === "object") {
    const preset = getGalleryPreset(buybox.gallery.presetId);
    for (const [k, v] of Object.entries(preset.settings)) main.settings[k] = resolvePaletteRef(v, palette);
    main.settings.pg_radius = Math.max(0, Math.min(40, Math.round(doc.global.radius || 0)));
    const badge = typeof buybox.gallery.badge === "string" ? buybox.gallery.badge.trim() : "";
    if (badge) {
      main.settings.pg_badge_enable = true;
      main.settings.pg_badge_text = badge;
      main.settings.pg_badge_bg = palette.accent;
      main.settings.pg_badge_color = "#ffffff";
    }
  }
}

// ─── DYNAMISCHE Buy Box: Produktinfo-Spalte = EIN Master-Block ─────
// Ersetzt alle verwalteten Produktinfo-Bausteine durch einen einzigen
// brospify_buybox-Block mit vorbefülltem Sync-Code. Das Design kommt zur
// Laufzeit vom Hub (GET /api/buybox/[code]) — Design-Updates erreichen den
// Shop OHNE neues Theme-ZIP. Gibt false zurück, wenn die Basis den
// Master-Block nicht kennt (alte Uploads) → Aufrufer fällt auf statisch zurück.

const DYNAMIC_BLOCK_TYPE = "brospify_buybox";

function applyDynamicBuybox(
  data: TemplateData,
  zip: AdmZip,
  cacheKey: string,
  syncCode: string,
  hubUrl: string,
): boolean {
  if (!syncCode) return false;
  const main = findMainProduct(data);
  if (!main) return false;
  const schema = readSectionSchema(zip, cacheKey, "main-product");
  if (!schema || !(DYNAMIC_BLOCK_TYPE in schema.blockDefaults)) return false;

  const managed = new Set(BUYBOX_BLOCKS.map((b) => b.type));
  main.blocks = main.blocks && typeof main.blocks === "object" ? main.blocks : {};
  main.block_order = Array.isArray(main.block_order) ? main.block_order : [];

  // Verwaltete Bausteine raus; der ERSTE verwaltete Slot wird zur Position
  // des Master-Blocks. Unverwaltete Blöcke (@app, custom_liquid …) bleiben.
  const keep: string[] = [];
  let inserted = false;
  for (const bid of main.block_order) {
    const t = String(main.blocks[bid]?.type || "");
    if (managed.has(t)) {
      if (!inserted) {
        keep.push("bspx");
        inserted = true;
      }
      delete main.blocks[bid];
    } else {
      keep.push(bid);
    }
  }
  if (!inserted) keep.unshift("bspx");
  main.blocks["bspx"] = {
    type: DYNAMIC_BLOCK_TYPE,
    settings: { sync_code: syncCode, hub_url: hubUrl },
  };
  main.block_order = keep;
  return true;
}

// ─── Kaufbox STATISCH (Fallback für Basen ohne Master-Block) ────────

function applyBuyboxStatic(
  data: TemplateData,
  doc: ThemeDocument,
  zip: AdmZip,
  cacheKey: string,
  palette: ColorPalette,
): void {
  const main = findMainProduct(data);
  if (!main) return;
  main.settings = main.settings && typeof main.settings === "object" ? main.settings : {};
  const buybox = doc.buybox || ({} as ThemeDocument["buybox"]);

  // 2) Sichtbare Bausteine ohne Template-Instanz aus dem main-product-Schema
  //    instanziieren (z. B. sale_banner, feature_box, icon-with-text …).
  main.blocks = main.blocks && typeof main.blocks === "object" ? main.blocks : {};
  main.block_order = Array.isArray(main.block_order) ? main.block_order : [];
  const order = Array.isArray(buybox.order) ? buybox.order : [];
  const hidden = new Set(Array.isArray(buybox.hidden) ? buybox.hidden : []);
  const present = new Set(Object.values(main.blocks).map((b: any) => String(b?.type || "")));
  const schema = readSectionSchema(zip, cacheKey, "main-product");
  for (const type of order) {
    if (hidden.has(type) || present.has(type)) continue;
    if (!getBuyboxLib(type)) continue;
    const defaults = schema?.blockDefaults[type];
    if (!defaults) continue; // Basis kennt den Block-Typ nicht → auslassen
    const id = `hub_${type.replace(/[^a-z0-9_]/gi, "_")}`;
    main.blocks[id] = { type, settings: { ...defaults } };
    main.block_order.push(id);
    present.add(type);
  }

  // 3) Style-Art + Texte je Baustein-Typ (jeweils erster Block des Typs).
  //    Preset nur anwenden, wenn der Kunde eine Style-Art gewählt hat ODER
  //    der Block frisch instanziiert wurde — kuratierte Template-Settings
  //    bleiben sonst unangetastet.
  const cfgs = buybox.blocks && typeof buybox.blocks === "object" ? buybox.blocks : {};
  const seen = new Set<string>();
  for (const bid of main.block_order) {
    const blk = main.blocks[bid];
    if (!blk) continue;
    const type = String(blk.type || "");
    if (seen.has(type)) continue;
    seen.add(type);
    const lib = getBuyboxLib(type);
    if (!lib) continue;
    const cfg = cfgs[type];
    blk.settings = blk.settings && typeof blk.settings === "object" ? blk.settings : {};

    // Effektive Style-Art: Kunden-Wahl > impliziter globaler Icon-Stil
    // (Vorteile/Timeline) > erstes Preset NUR bei frisch instanziierten.
    const effId = effectiveBuyboxPresetId(type, cfg, doc.global.design);
    const presetId = effId || (String(bid).startsWith("hub_") ? lib.presets[0]?.id || "" : "");
    if (presetId && lib.presets.length) {
      Object.assign(blk.settings, resolveBlockSettings(type, { presetId }, palette));
    }

    const isBlank = (v: unknown) => typeof v !== "string" || !v.trim() || v.startsWith("t:");
    for (const f of lib.fields) {
      const u = cfg?.texts?.[f.id];
      const userVal = typeof u === "string" && u.trim() ? u.trim() : null;
      const raw = userVal ?? (isBlank(blk.settings[f.target.key]) && f.def ? f.def : null);
      if (!raw) continue;
      blk.settings[f.target.key] = f.html ? ensureHtml(raw) : raw;
    }
  }
}

// ─── Dokument → index.json (Startseite) ────────────────────────────
// Gleiche Struktur-Logik wie die Produktseite: verwaltete Basis-Sections
// werden durch den doc.home-Aufbau ersetzt (Reihenfolge, Presets, Texte,
// Instanziierung), unverwaltete (Header-artiges, leere, disabled) bleiben
// an ihrem Platz. presetId "" = Basis-Look der übernommenen Section bleibt.

function compileHomeTemplate(
  data: TemplateData,
  doc: ThemeDocument,
  zip: AdmZip,
  cacheKey: string,
  values: ThemeCopy,
  palette: ColorPalette,
): void {
  const sections = (data.sections = data.sections && typeof data.sections === "object" ? data.sections : {});
  const origOrder = Array.isArray(data.order) ? data.order : Object.keys(sections);

  // Bindings + Token-Injection auf dem UNVERÄNDERTEN Template (Occurrence-
  // Zählung der Bindings braucht die Original-Reihenfolge).
  applyCopyBindings(data, "index");
  for (const sid of origOrder) {
    const sec = sections[sid];
    if (!sec || sec.disabled === true) continue;
    replaceTokensDeep(sec, values);
    recolorByRoleDeep(sec, palette);
  }

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
  for (const instance of doc.home || []) {
    let section: any = null;
    let sid = instance.uid;
    let fresh = false;
    if (instance.source === "template" && sections[instance.uid]) {
      section = sections[instance.uid];
      keptTemplateIds.add(instance.uid);
      delete section.disabled;
    } else {
      const donorId = origOrder.find((id) => String(sections[id]?.type || "") === instance.type);
      if (donorId) {
        section = JSON.parse(JSON.stringify(sections[donorId]));
        delete section.disabled;
      } else {
        section = instantiateSection(zip, cacheKey, instance);
        fresh = true;
      }
      if (!section) {
        console.warn(`[theme-compile] Home-Section-Typ „${instance.type}" nicht in Basis — übersprungen.`);
        continue;
      }
      sid = instance.uid.startsWith("hub_") ? instance.uid : `hub_${instance.uid}`;
      sections[sid] = section;
    }
    applyInstanceToSection(section, instance, palette, fresh);
    replaceTokensDeep(section, values);
    docIds.push(sid);
  }

  for (const sid of origOrder) {
    if (isManaged(sid) && !keptTemplateIds.has(sid)) delete sections[sid];
  }

  data.order = [...unmanagedPrefix, ...docIds, ...unmanagedSuffix];

  for (const sid of data.order) {
    const sec = sections[sid];
    if (!sec || sec.disabled === true) continue;
    stripStrayTokens(sec);
  }
}

// Generische Struktur-Validierung (order ↔ sections + Block-Bijektion) —
// verhindert, dass jemals ein für Shopify ungültiges Template ausgeliefert wird.
function validateTemplateStructure(data: TemplateData, name: string): void {
  const sections = data.sections || {};
  const order = Array.isArray(data.order) ? data.order : [];
  if (!order.length) throw new Error(`Validierung: order-Array von ${name} ist leer.`);
  if (order.length > 25) throw new Error(`Validierung: ${name} hat ${order.length} Sections — Shopify erlaubt max. 25.`);
  const orderSet = new Set(order);
  if (orderSet.size !== order.length) throw new Error(`Validierung: doppelte Section-ID in ${name}.`);
  for (const sid of order) {
    if (!sections[sid]) throw new Error(`Validierung: Section „${sid}" fehlt in ${name}.`);
  }
  for (const sid of Object.keys(sections)) {
    if (!orderSet.has(sid)) throw new Error(`Validierung: Section „${sid}" steht nicht im order-Array von ${name}.`);
  }
  for (const [sid, secRaw] of Object.entries(sections)) {
    const sec = secRaw as any;
    if (!sec?.blocks) continue;
    const bo: string[] = Array.isArray(sec.block_order) ? sec.block_order : [];
    if (bo.length > 50) throw new Error(`Validierung: „${sid}" in ${name} hat ${bo.length} Blöcke — max. 50.`);
    const boSet = new Set(bo);
    for (const bid of bo) if (!sec.blocks[bid]) throw new Error(`Validierung: Block „${bid}" fehlt in „${sid}" (${name}).`);
    for (const bid of Object.keys(sec.blocks)) if (!boSet.has(bid)) throw new Error(`Validierung: Block „${bid}" verwaist in „${sid}" (${name}).`);
  }
}

// ─── Shopify-Konformität: blocks ↔ block_order exakt 1:1 halten ─────
// Shopify verwirft ein JSON-Template KOMPLETT (Customizer zeigt „No
// templates found"), wenn ein Block in `blocks` nicht in `block_order`
// steht oder umgekehrt. Dieser Pass repariert JEDE Section defensiv.
function sanitizeTemplateBlocks(data: TemplateData): void {
  for (const sec of Object.values(data.sections || {})) {
    if (!sec || typeof sec !== "object") continue;
    const s = sec as { blocks?: Record<string, unknown>; block_order?: string[] };
    const hasBlocks = s.blocks && typeof s.blocks === "object";
    if (!hasBlocks) {
      if (Array.isArray(s.block_order)) delete s.block_order;
      continue;
    }
    const blocks = s.blocks as Record<string, unknown>;
    if (!Array.isArray(s.block_order)) s.block_order = Object.keys(blocks);
    // (1) order-Einträge ohne Block-Objekt raus, Duplikate raus.
    const seen = new Set<string>();
    s.block_order = s.block_order.filter((id) => {
      if (typeof id !== "string" || !blocks[id] || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    // (2) Block-Objekte ohne order-Eintrag löschen (Verwaiste).
    for (const id of Object.keys(blocks)) {
      if (!seen.has(id)) delete blocks[id];
    }
    if (!s.block_order.length) {
      delete s.blocks;
      delete s.block_order;
    }
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
  if (order.length > 25) throw new Error(`Validierung: ${order.length} Sections — Shopify erlaubt max. 25 pro Template.`);
  const main = Object.values(sections).find((s: any) => s && s.type === "main-product") as any;
  if (!main) throw new Error("Validierung: main-product-Section fehlt.");
  if (!Array.isArray(main.block_order) || !main.block_order.length) {
    throw new Error("Validierung: main-product hat keine Bausteine (block_order leer).");
  }
  // Shopify-Pflicht: blocks ↔ block_order in JEDER Section exakt 1:1,
  // sonst verwirft der Customizer das gesamte Template.
  for (const [sid, secRaw] of Object.entries(sections)) {
    const sec = secRaw as any;
    if (!sec?.blocks) continue;
    const ids = Object.keys(sec.blocks);
    const bo: string[] = Array.isArray(sec.block_order) ? sec.block_order : [];
    if (bo.length > 50) throw new Error(`Validierung: Section „${sid}" hat ${bo.length} Blöcke — Shopify erlaubt max. 50.`);
    for (const bid of bo) {
      if (!sec.blocks[bid]) throw new Error(`Validierung: Block „${bid}" in „${sid}" steht in block_order, fehlt aber in blocks.`);
    }
    const boSet = new Set(bo);
    for (const bid of ids) {
      if (!boSet.has(bid)) throw new Error(`Validierung: Block „${bid}" in „${sid}" ist VERWAIST (nicht in block_order).`);
    }
  }
}

// ─── Haupteinstieg ─────────────────────────────────────────────────

export function compileDocumentZip(
  baseZip: Buffer,
  doc: ThemeDocument,
  themeCopy: ThemeCopy,
  cacheKey = "base",
  dyn: DynamicBuyboxOpts | null = null,
): Buffer {
  const zip = new AdmZip(baseZip);
  const values = getPlaceholderValues(themeCopy);
  const style = getThemeStyle(doc.global.styleId);
  const palette = doc.global.colors;

  // 1) templates/product.json — Struktur + Presets + Texte + Kaufbox.
  const productEntry = findEntry(zip, "templates/product.json");
  if (!productEntry) throw new Error("Theme-Basis hat keine templates/product.json.");
  const productData = JSON.parse(productEntry.getData().toString("utf8")) as TemplateData;
  compileProductTemplate(productData, doc, zip, cacheKey, values, palette, dyn);
  sanitizeTemplateBlocks(productData);
  validateProductTemplate(productData);
  zip.updateFile(productEntry.entryName, Buffer.from(JSON.stringify(productData, null, 2), "utf8"));

  // 2) templates/index.json — dokumentgesteuert, wenn das Dokument einen
  // Startseiten-Aufbau mitbringt (doc.home); sonst Legacy: Copy + Farben,
  // Struktur bleibt Basis-Stand.
  const indexEntry = findEntry(zip, "templates/index.json");
  if (indexEntry) {
    try {
      const indexData = JSON.parse(indexEntry.getData().toString("utf8")) as TemplateData;
      if (Array.isArray(doc.home) && doc.home.length) {
        compileHomeTemplate(indexData, doc, zip, cacheKey, values, palette);
      } else {
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
      }
      sanitizeTemplateBlocks(indexData);
      validateTemplateStructure(indexData, "index.json");
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
    // home ist optional (ältere Clients) — wenn vorhanden, muss es passen.
    (d.home === undefined ||
      (Array.isArray(d.home) && d.home.every((s) => s && typeof s.uid === "string" && typeof s.type === "string"))) &&
    !!d.buybox &&
    Array.isArray(d.buybox.order)
  );
}
