import "server-only";
import AdmZip from "adm-zip";

// ─────────────────────────────────────────────────────────────────
// Shopify-Upload-Härtung (Ursache des „404 nach Theme-Upload"-Bugs).
//
// Shopify validiert beim ZIP-Upload JEDE Datei einzeln und lehnt ab:
//   1. Section-Schemas mit leerem Default (`"default": ""`) —
//      Fehlermeldung „Invalid schema: setting … default darf nicht leer
//      sein". Die Section fehlt dann im Theme, und ALLE Templates, die
//      sie referenzieren (index.json/product.json), werden mit abgelehnt
//      → Startseite/Produktseite rendern die 404-Seite.
//   2. settings_data.json / Template-Settings mit range-Werten, die nicht
//      exakt auf dem min/step-Raster liegen, oder select-Werten außerhalb
//      der Optionen — die komplette Datei wird verworfen → Farben/
//      Schriften/Design kommen nie im Shop an („sieht anders aus als im
//      Preview").
//
// Diese Passes reparieren beides direkt vor dem Zippen. Sie laufen über
// JEDE Basis (gebündelte Schablone UND vom Admin hochgeladene Themes),
// damit auch alte Uploads mit kaputten Schemas gültige ZIPs ergeben.
// ─────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

const SCHEMA_RE = /(\{%-?\s*schema\s*-?%\})([\s\S]*?)(\{%-?\s*endschema\s*-?%\})/;

// Eigene Kopie von theme-inject.findEntry (Pfad-Trenner-agnostisch) —
// bewusst KEIN Import aus theme-inject, um einen Zirkular-Import zu vermeiden.
function findEntry(zip: AdmZip, wanted: string): AdmZip.IZipEntry | null {
  const direct = zip.getEntry(wanted);
  if (direct) return direct;
  const norm = wanted.replace(/\\/g, "/");
  return (
    zip.getEntries().find((e) => e.entryName.replace(/\\/g, "/").replace(/^\.?\//, "") === norm) || null
  );
}

interface SettingRule {
  type: string;
  min?: number;
  max?: number;
  step?: number;
  options?: Set<string>;
}

interface SectionRules {
  settings: Map<string, SettingRule>;
  blocks: Map<string, Map<string, SettingRule>>;
}

function toRule(s: any): SettingRule | null {
  if (!s || typeof s.id !== "string" || typeof s.type !== "string") return null;
  const rule: SettingRule = { type: s.type };
  if (s.type === "range") {
    rule.min = typeof s.min === "number" ? s.min : 0;
    rule.max = typeof s.max === "number" ? s.max : 100;
    rule.step = typeof s.step === "number" && s.step > 0 ? s.step : 1;
  } else if (s.type === "select" && Array.isArray(s.options)) {
    rule.options = new Set(s.options.map((o: any) => String(o?.value ?? "")));
  }
  return rule;
}

/** Rundet einen range-Wert aufs min/step-Raster und klemmt ihn in [min,max]. */
export function snapToRange(v: number, rule: SettingRule): number {
  const min = rule.min ?? 0;
  const max = rule.max ?? 100;
  const step = rule.step ?? 1;
  const snapped = min + Math.round((v - min) / step) * step;
  return Math.max(min, Math.min(max, snapped));
}

/** Setting-WERTE gegen die Regeln reparieren: range snappen, ungültige
 *  select-Werte entfernen (→ Theme-Default greift). Unbekannte Keys bleiben
 *  unangetastet (Shopify ignoriert sie tolerant). */
function sanitizeValues(settings: Record<string, unknown> | undefined, rules: Map<string, SettingRule>): void {
  if (!settings || typeof settings !== "object") return;
  for (const [k, v] of Object.entries(settings)) {
    const rule = rules.get(k);
    if (!rule) continue;
    if (rule.type === "range") {
      const num = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(num)) {
        const snapped = snapToRange(num, rule);
        if (snapped !== v) settings[k] = snapped;
      }
    } else if (rule.type === "select" && rule.options && v !== undefined) {
      if (!rule.options.has(String(v))) delete settings[k];
    }
  }
}

// ─── 1) Section-Schemas im ZIP reparieren ──────────────────────────

function stripEmptyDefaults(settings: any[] | undefined): boolean {
  let changed = false;
  for (const s of settings || []) {
    if (s && s.default === "") {
      delete s.default;
      changed = true;
    }
  }
  return changed;
}

/** Entfernt `"default": ""` aus allen Section-Schemas (Settings + Blocks).
 *  Gibt die Zahl der reparierten Dateien zurück. */
export function sanitizeSectionSchemas(zip: AdmZip): number {
  let fixed = 0;
  for (const entry of zip.getEntries()) {
    const name = entry.entryName.replace(/\\/g, "/");
    if (!name.startsWith("sections/") || !name.endsWith(".liquid")) continue;
    const raw = entry.getData().toString("utf8");
    const m = raw.match(SCHEMA_RE);
    if (!m) continue;
    let schema: any;
    try {
      schema = JSON.parse(m[2]);
    } catch {
      continue; // kaputtes Schema können wir nicht sicher anfassen
    }
    let changed = stripEmptyDefaults(schema.settings);
    for (const b of schema.blocks || []) changed = stripEmptyDefaults(b?.settings) || changed;
    if (!changed) continue;
    const replaced = raw.replace(SCHEMA_RE, () => `${m[1]}\n${JSON.stringify(schema, null, 2)}\n${m[3]}`);
    zip.updateFile(entry.entryName, Buffer.from(replaced, "utf8"));
    fixed++;
  }
  return fixed;
}

// ─── 2) Regeln aus den Schemas lesen (pro Zip gecached) ─────────────

const sectionRulesCache = new WeakMap<AdmZip, Map<string, SectionRules | null>>();

function readSectionRules(zip: AdmZip, type: string): SectionRules | null {
  let cache = sectionRulesCache.get(zip);
  if (!cache) {
    cache = new Map();
    sectionRulesCache.set(zip, cache);
  }
  if (cache.has(type)) return cache.get(type) ?? null;
  let result: SectionRules | null = null;
  const entry = findEntry(zip, `sections/${type}.liquid`);
  if (entry) {
    const m = entry.getData().toString("utf8").match(SCHEMA_RE);
    if (m) {
      try {
        const schema = JSON.parse(m[2]);
        const settings = new Map<string, SettingRule>();
        for (const s of schema.settings || []) {
          const rule = toRule(s);
          if (rule) settings.set(s.id, rule);
        }
        const blocks = new Map<string, Map<string, SettingRule>>();
        for (const b of schema.blocks || []) {
          if (!b?.type) continue;
          const bm = new Map<string, SettingRule>();
          for (const s of b.settings || []) {
            const rule = toRule(s);
            if (rule) bm.set(s.id, rule);
          }
          blocks.set(b.type, bm);
        }
        result = { settings, blocks };
      } catch {
        result = null;
      }
    }
  }
  cache.set(type, result);
  return result;
}

const globalRulesCache = new WeakMap<AdmZip, Map<string, SettingRule>>();

function readGlobalRules(zip: AdmZip): Map<string, SettingRule> {
  const hit = globalRulesCache.get(zip);
  if (hit) return hit;
  const rules = new Map<string, SettingRule>();
  const entry = findEntry(zip, "config/settings_schema.json");
  if (entry) {
    try {
      const schema = JSON.parse(entry.getData().toString("utf8"));
      for (const group of Array.isArray(schema) ? schema : []) {
        for (const s of group?.settings || []) {
          const rule = toRule(s);
          if (rule) rules.set(s.id, rule);
        }
      }
    } catch {
      /* ohne Schema keine Regeln — dann bleibt alles unangetastet */
    }
  }
  globalRulesCache.set(zip, rules);
  return rules;
}

// ─── 3) Werte in settings_data + Templates reparieren ──────────────

/** settings_data.current gegen settings_schema.json snappen. */
export function sanitizeSettingsData(data: { current?: Record<string, unknown> }, zip: AdmZip): void {
  if (!data?.current || typeof data.current !== "object") return;
  sanitizeValues(data.current, readGlobalRules(zip));
}

/** Alle Section-/Block-Settings eines JSON-Templates gegen die jeweiligen
 *  Section-Schemas snappen. */
export function sanitizeTemplateData(
  data: { sections?: Record<string, any> } | undefined,
  zip: AdmZip,
): void {
  for (const sec of Object.values(data?.sections || {})) {
    if (!sec || typeof sec !== "object") continue;
    const rules = readSectionRules(zip, String(sec.type || ""));
    if (!rules) continue;
    sanitizeValues(sec.settings, rules.settings);
    for (const blk of Object.values(sec.blocks || {}) as any[]) {
      if (!blk || typeof blk !== "object") continue;
      const blockRules = rules.blocks.get(String(blk.type || ""));
      if (blockRules) sanitizeValues(blk.settings, blockRules);
    }
  }
}
