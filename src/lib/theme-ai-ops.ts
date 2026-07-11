// ─── AI Co-Pilot: Operationen auf dem ThemeDocument (client-safe) ────
// Der Co-Pilot ändert das Theme NIE direkt — Claude liefert einen Plan aus
// menschenlesbaren Schritten + diesen strukturierten Operationen. Der Server
// validiert sie strikt gegen die Bibliotheken (theme-library/-styles/-sections),
// der Client wendet sie nach Bestätigung Schritt für Schritt auf das Dokument
// an (Live-Preview aktualisiert sich ohne Reload). Aus der Summe der
// Op-Gewichte ergibt sich der Aufwand → Credit-Stufe (klein/mittel/groß).
// Geteilt von Server-Route UND Editor-Client → identische Semantik.

import type { ColorPalette } from "@/lib/theme-placeholders";
import {
  type ThemeDocument,
  type SectionInstance,
  type EditorPage,
} from "@/lib/theme-doc";
import {
  SECTION_LIBRARY,
  getSectionDef,
  getBuyboxLib,
  getBuyboxPreset,
  getBuyboxControls,
  GALLERY_PRESETS,
  createLibraryInstance,
  buildInitialDocument,
  STYLE_GALLERY,
  SECTION_TONES,
  SECTION_DIVIDERS,
  sectionToneSettings,
  sectionSupportsDesign,
  harmonizeBackground,
  type SectionTone,
  type BaseSectionInfo,
} from "@/lib/theme-library";
import { THEME_STYLES, getThemeStyle } from "@/lib/theme-styles";
import { BUYBOX_DEFAULT_ORDER, BUYBOX_RUNTIME_ONLY, sortBuyboxOrder } from "@/lib/theme-sections";
import { resolveIconId } from "@/lib/theme-icon-resolver";
import { EDITOR_FONTS } from "@/components/theme-editor/editor-ui";

// ─── Operationen ────────────────────────────────────────────────────

export type AiOp =
  | { op: "set_style"; styleId: string; mode: "design" | "full" }
  | { op: "set_colors"; colors: Partial<ColorPalette> }
  | { op: "set_fonts"; headingFont?: string; bodyFont?: string }
  | { op: "set_radius"; radius: number }
  | { op: "set_design"; shadow?: 0 | 1 | 2; border?: 1 | 2; iconStyle?: "dark" | "accent" | "outline" }
  | { op: "add_section"; page: EditorPage; type: string; presetId?: string; position?: number; texts?: Record<string, string>; uid?: string }
  | { op: "remove_section"; uid: string }
  | { op: "move_section"; uid: string; to: number }
  | { op: "set_section_preset"; uid: string; presetId: string }
  | { op: "set_section_text"; uid: string; field: string; value: string }
  // Design-Layer: Hintergrund-Ton + Formen-Kanten EINER Section (aus der
  // Palette abgeleitet — nie „AI-bunt") bzw. rohe Design-/Icon-Settings.
  // Fades gibt es für die AI nicht mehr (direkte Kanten/Formen statt Verlauf).
  | { op: "set_section_tone"; uid: string; tone: SectionTone; divider?: (typeof SECTION_DIVIDERS)[number]; dividerTop?: (typeof SECTION_DIVIDERS)[number] }
  | { op: "set_section_setting"; uid: string; key: string; value: string }
  // Produkt-passende Icons für die Vorteile-Liste der Kaufbox (4 Stück).
  // Werte dürfen freie englische Keywords sein — resolveIconId löst sie
  // deterministisch gegen die ~1750-Icon-Bibliothek auf.
  | { op: "set_benefit_icons"; icons: string[] }
  | { op: "add_buybox_block"; blockType: string; position?: number; presetId?: string }
  | { op: "remove_buybox_block"; blockType: string }
  | { op: "reorder_buybox"; order: string[] }
  | { op: "set_block_preset"; blockType: string; presetId: string }
  | { op: "set_block_text"; blockType: string; field: string; value: string }
  | { op: "set_block_setting"; blockType: string; key: string; value: string | number | boolean }
  | { op: "set_gallery"; presetId?: string; badge?: string }
  | { op: "set_buybox_spacing"; spacing: number };

export interface AiPlanStep {
  title: string;
  detail: string;
}

export interface AiPlan {
  summary: string;
  steps: AiPlanStep[];
  ops: AiOp[];
  /** Aufwands-Stufe → Credit-Key (klein/mittel/groß). */
  tier: AiEffortTier;
  cost: number;
}

// ─── Gültige Werte (aus den Bibliotheken abgeleitet) ────────────────

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const FONT_VALUES = new Set(EDITOR_FONTS.map((f) => f.value));
const STYLE_IDS = new Set(THEME_STYLES.map((s) => s.id));
const SECTION_TYPES = new Set(SECTION_LIBRARY.map((s) => s.type));
const BLOCK_TYPES = new Set<string>([...BUYBOX_DEFAULT_ORDER, ...BUYBOX_RUNTIME_ONLY]);
const GALLERY_IDS = new Set(GALLERY_PRESETS.map((p) => p.id));
const COLOR_KEYS = ["button", "buttonText", "background", "text", "accent"] as const;
/** Rohe Design-/Icon-Setting-Keys, die die AI direkt setzen darf.
 *  sec_fade absichtlich NICHT mehr dabei (keine Fades für neue Designs). */
const SECTION_SETTING_KEYS = new Set(["sec_bg", "sec_bg2", "sec_divider", "sec_divider_top", "icon_1", "icon_2", "icon_3", "icon_4"]);
// MUSS mit dem System-Prompt übereinstimmen („Max. 48 Operationen",
// theme-ai.ts Regel 5)! Ein niedrigeres Validierungs-Limit würde die
// ZULETZT generierten Ops still verwerfen — das sind bei Voll-Neubauten
// typischerweise die Kaufbox-Personalisierungen (dünne Kaufbox als Symptom).
const MAX_OPS = 48;
const MAX_TEXT = 600;

const isStr = (v: unknown): v is string => typeof v === "string";
const clampInt = (v: unknown, min: number, max: number, fb: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fb;
};
const cleanText = (v: unknown): string => (isStr(v) ? v.slice(0, MAX_TEXT) : "");

function docUids(doc: ThemeDocument): Set<string> {
  return new Set([...doc.sections, ...(doc.home || [])].map((s) => s.uid));
}
function findInstance(doc: ThemeDocument, uid: string): SectionInstance | undefined {
  return doc.sections.find((s) => s.uid === uid) || (doc.home || []).find((s) => s.uid === uid);
}

/**
 * Validiert rohe Operationen (aus dem LLM) strikt gegen Dokument +
 * Bibliotheken. Ungültige Ops werden VERWORFEN (nie „repariert geraten") —
 * lieber ein Schritt weniger als eine kaputte Änderung.
 * `capabilities` (Section-Typen der Theme-Basis, leer = alles erlaubt) hält
 * die Validierung deckungsgleich mit der Client-Anwendung — es wird nie
 * Aufwand für Ops berechnet, die der Client sicher verwirft.
 */
export function validateAiOps(raw: unknown, doc: ThemeDocument, capabilities: string[] = []): AiOp[] {
  if (!Array.isArray(raw)) return [];
  const caps = new Set(capabilities.filter((c) => typeof c === "string"));
  const out: AiOp[] = [];
  // Angewandt wird set_style IMMER zuerst (Sortierung unten) — enthält der
  // Plan einen Voll-Umbau, sind ALLE bisherigen Doc-uids von Anfang an
  // ungültig (nur Platzhalter neu eingefügter Sections zählen).
  const hasFullStyle = raw.some(
    (r) => !!r && typeof r === "object" && (r as Record<string, unknown>).op === "set_style"
      && (r as Record<string, unknown>).mode === "full" && STYLE_IDS.has(String((r as Record<string, unknown>).styleId)),
  );
  // uid-Menge wird fortgeschrieben, damit set_section_* auf frisch per
  // add_section eingefügte Sections zeigen kann (Platzhalter-uid "new:<n>").
  let uids = hasFullStyle ? new Set<string>() : docUids(doc);
  const newUids = new Set<string>();

  for (const r of raw.slice(0, MAX_OPS)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const kind = o.op;
    const uidOk = (uid: unknown): uid is string => isStr(uid) && (uids.has(uid) || newUids.has(uid));

    switch (kind) {
      case "set_style": {
        if (!isStr(o.styleId) || !STYLE_IDS.has(o.styleId)) break;
        const mode = o.mode === "full" ? "full" : "design";
        // mode "full" baut die Seiten NEU → alle bisherigen Doc-uids sind
        // danach ungültig; nur Platzhalter danach eingefügter Sections gelten.
        if (mode === "full") uids = new Set<string>();
        out.push({ op: "set_style", styleId: o.styleId, mode });
        break;
      }
      case "set_colors": {
        const colors: Partial<ColorPalette> = {};
        const src = (o.colors && typeof o.colors === "object" ? o.colors : {}) as Record<string, unknown>;
        for (const k of COLOR_KEYS) {
          const v = src[k];
          if (isStr(v) && HEX_RE.test(v)) colors[k] = v.toLowerCase();
        }
        if (Object.keys(colors).length) out.push({ op: "set_colors", colors });
        break;
      }
      case "set_fonts": {
        const heading = isStr(o.headingFont) && FONT_VALUES.has(o.headingFont) ? o.headingFont : undefined;
        const body = isStr(o.bodyFont) && FONT_VALUES.has(o.bodyFont) ? o.bodyFont : undefined;
        if (heading || body) out.push({ op: "set_fonts", headingFont: heading, bodyFont: body });
        break;
      }
      case "set_radius":
        out.push({ op: "set_radius", radius: clampInt(o.radius, 0, 40, 8) });
        break;
      case "set_design": {
        const d: { shadow?: 0 | 1 | 2; border?: 1 | 2; iconStyle?: "dark" | "accent" | "outline" } = {};
        if ([0, 1, 2].includes(Number(o.shadow))) d.shadow = Number(o.shadow) as 0 | 1 | 2;
        if ([1, 2].includes(Number(o.border))) d.border = Number(o.border) as 1 | 2;
        if (o.iconStyle === "dark" || o.iconStyle === "accent" || o.iconStyle === "outline") d.iconStyle = o.iconStyle;
        if (Object.keys(d).length) out.push({ op: "set_design", ...d });
        break;
      }
      case "add_section": {
        if (!isStr(o.type) || !SECTION_TYPES.has(o.type)) break;
        // Nur Typen, die die Theme-Basis wirklich kennt — sonst würde der
        // Client die Op (und Folge-Ops auf ihrer Platzhalter-uid) verwerfen,
        // der Aufwand wäre aber schon berechnet.
        if (caps.size && !caps.has(o.type)) break;
        const def = getSectionDef(o.type);
        const presetId = isStr(o.presetId) && def?.presets.some((p) => p.id === o.presetId) ? o.presetId : def?.presets[0]?.id;
        const fields = new Set((def?.fields || []).map((f) => f.id));
        const texts: Record<string, string> = {};
        if (o.texts && typeof o.texts === "object") {
          for (const [k, v] of Object.entries(o.texts as Record<string, unknown>)) {
            if (fields.has(k) && isStr(v) && v.trim()) texts[k] = cleanText(v);
          }
        }
        // Das LLM darf der neuen Section eine Platzhalter-uid geben ("new:1"),
        // um sie in Folge-Ops zu referenzieren.
        const placeholderUid = isStr(o.uid) && /^new:/.test(o.uid) ? o.uid : undefined;
        if (placeholderUid) newUids.add(placeholderUid);
        out.push({
          op: "add_section",
          page: o.page === "home" ? "home" : "product",
          type: o.type,
          presetId,
          position: typeof o.position === "number" ? clampInt(o.position, 0, 50, 0) : undefined,
          texts: Object.keys(texts).length ? texts : undefined,
          uid: placeholderUid,
        });
        break;
      }
      case "remove_section":
        if (uidOk(o.uid)) out.push({ op: "remove_section", uid: o.uid });
        break;
      case "move_section":
        if (uidOk(o.uid)) out.push({ op: "move_section", uid: o.uid, to: clampInt(o.to, 0, 50, 0) });
        break;
      case "set_section_preset": {
        if (!uidOk(o.uid) || !isStr(o.presetId)) break;
        const inst = findInstance(doc, o.uid);
        // Für frische ("new:")-Sections kennt doc den Typ noch nicht — Preset
        // wird beim Anwenden gegen die echte Instanz geprüft.
        if (inst && !getSectionDef(inst.type)?.presets.some((p) => p.id === o.presetId)) break;
        out.push({ op: "set_section_preset", uid: o.uid, presetId: o.presetId });
        break;
      }
      case "set_section_text": {
        if (!uidOk(o.uid) || !isStr(o.field) || !isStr(o.value)) break;
        const inst = findInstance(doc, o.uid);
        if (inst && !getSectionDef(inst.type)?.fields.some((f) => f.id === o.field)) break;
        out.push({ op: "set_section_text", uid: o.uid, field: o.field, value: cleanText(o.value) });
        break;
      }
      case "set_section_tone": {
        if (!uidOk(o.uid) || !isStr(o.tone) || !SECTION_TONES.includes(o.tone as SectionTone)) break;
        const inst = findInstance(doc, o.uid);
        if (inst && !sectionSupportsDesign(inst.type)) break; // "new:"-uids prüft die Anwendung
        out.push({
          op: "set_section_tone",
          uid: o.uid,
          tone: o.tone as SectionTone,
          divider: isStr(o.divider) && (SECTION_DIVIDERS as readonly string[]).includes(o.divider) ? (o.divider as (typeof SECTION_DIVIDERS)[number]) : undefined,
          dividerTop: isStr(o.dividerTop) && (SECTION_DIVIDERS as readonly string[]).includes(o.dividerTop) ? (o.dividerTop as (typeof SECTION_DIVIDERS)[number]) : undefined,
        });
        break;
      }
      case "set_section_setting": {
        if (!uidOk(o.uid) || !isStr(o.key) || !SECTION_SETTING_KEYS.has(o.key)) break;
        const inst = findInstance(doc, o.uid);
        if (inst && !sectionSupportsDesign(inst.type)) break;
        let value: string | undefined;
        if (o.key.startsWith("icon_")) {
          // Freie Keywords erlaubt — deterministisch gegen die Icon-
          // Bibliothek aufgelöst (identisch in plan- und apply-Route).
          value = isStr(o.value) ? resolveIconId(o.value) ?? undefined : undefined;
        } else if (o.key === "sec_divider" || o.key === "sec_divider_top") {
          value = isStr(o.value) && (SECTION_DIVIDERS as readonly string[]).includes(o.value) ? o.value : undefined;
        } else {
          value = isStr(o.value) && (o.value === "" || HEX_RE.test(o.value)) ? o.value.toLowerCase() : undefined;
        }
        if (value === undefined) break;
        out.push({ op: "set_section_setting", uid: o.uid, key: o.key, value });
        break;
      }
      case "set_benefit_icons": {
        const icons = Array.isArray(o.icons)
          ? (o.icons as unknown[])
              .map((i) => (isStr(i) ? resolveIconId(i) : null))
              .filter((i): i is string => !!i)
              .slice(0, 4)
          : [];
        if (icons.length) out.push({ op: "set_benefit_icons", icons });
        break;
      }
      case "add_buybox_block": {
        if (!isStr(o.blockType) || !BLOCK_TYPES.has(o.blockType)) break;
        const presetId = isStr(o.presetId) && getBuyboxLib(o.blockType)?.presets.some((p) => p.id === o.presetId) ? o.presetId : undefined;
        out.push({
          op: "add_buybox_block",
          blockType: o.blockType,
          position: typeof o.position === "number" ? clampInt(o.position, 0, 50, 0) : undefined,
          presetId,
        });
        break;
      }
      case "remove_buybox_block":
        // description nie entfernen — sonst verliert das Theme die Beschreibung.
        if (isStr(o.blockType) && BLOCK_TYPES.has(o.blockType) && o.blockType !== "description") {
          out.push({ op: "remove_buybox_block", blockType: o.blockType });
        }
        break;
      case "reorder_buybox": {
        if (!Array.isArray(o.order)) break;
        // dedupliziert — doppelte Typen würden downstream (block_order-
        // Bijektion) einen aktiven Baustein aus dem Export verdrängen.
        const order = Array.from(new Set((o.order as unknown[]).filter((t): t is string => isStr(t) && BLOCK_TYPES.has(t))));
        if (order.length) out.push({ op: "reorder_buybox", order });
        break;
      }
      case "set_block_preset": {
        if (!isStr(o.blockType) || !isStr(o.presetId)) break;
        if (!getBuyboxLib(o.blockType)?.presets.some((p) => p.id === o.presetId)) break;
        out.push({ op: "set_block_preset", blockType: o.blockType, presetId: o.presetId });
        break;
      }
      case "set_block_text": {
        if (!isStr(o.blockType) || !isStr(o.field) || !isStr(o.value)) break;
        if (!getBuyboxLib(o.blockType)?.fields.some((f) => f.id === o.field)) break;
        out.push({ op: "set_block_text", blockType: o.blockType, field: o.field, value: cleanText(o.value) });
        break;
      }
      case "set_block_setting": {
        if (!isStr(o.blockType) || !isStr(o.key)) break;
        const ctl = getBuyboxControls(o.blockType).find((c) => c.key === o.key);
        if (!ctl) break;
        let value: string | number | boolean | undefined;
        if (ctl.kind === "color" && isStr(o.value) && HEX_RE.test(o.value)) value = (o.value as string).toLowerCase();
        if (ctl.kind === "slider") value = clampInt(o.value, ctl.min ?? 0, ctl.max ?? 100, ctl.min ?? 0);
        if (ctl.kind === "segment" && isStr(o.value) && ctl.options?.some((x) => x.value === o.value)) value = o.value as string;
        if (value === undefined) break;
        out.push({ op: "set_block_setting", blockType: o.blockType, key: o.key, value });
        break;
      }
      case "set_gallery": {
        const presetId = isStr(o.presetId) && GALLERY_IDS.has(o.presetId) ? o.presetId : undefined;
        const badge = isStr(o.badge) ? o.badge.slice(0, 40) : undefined;
        if (presetId !== undefined || badge !== undefined) out.push({ op: "set_gallery", presetId, badge });
        break;
      }
      case "set_buybox_spacing":
        out.push({ op: "set_buybox_spacing", spacing: clampInt(o.spacing, 4, 40, 15) });
        break;
      default:
        break;
    }
  }
  // set_style IMMER zuerst anwenden (stabile Sortierung): ein Stil ersetzt
  // Palette/Fonts/Design (mode "full" sogar die Sections) — nachfolgende
  // Detail-Ops sollen den Stil verfeinern, nie von ihm überschrieben werden.
  return [...out.filter((o) => o.op === "set_style"), ...out.filter((o) => o.op !== "set_style")];
}

// ─── Anwendung (pure) ───────────────────────────────────────────────

export interface AiApplyCtx {
  baseSections: BaseSectionInfo[];
  capabilities: string[];
  homeSections: BaseSectionInfo[];
  /** Map Platzhalter-uid ("new:1") → echte uid der eingefügten Instanz.
   *  Wird während der Anwendung fortgeschrieben. */
  uidMap: Map<string, string>;
}

export function newAiApplyCtx(baseSections: BaseSectionInfo[], capabilities: string[], homeSections: BaseSectionInfo[]): AiApplyCtx {
  return { baseSections, capabilities, homeSections, uidMap: new Map() };
}

/** Wendet EINE Operation auf das Dokument an (pure — gibt neues Doc zurück). */
export function applyAiOpToDoc(doc: ThemeDocument, op: AiOp, ctx: AiApplyCtx): ThemeDocument {
  const resolveUid = (uid: string): string => ctx.uidMap.get(uid) || uid;

  switch (op.op) {
    case "set_style": {
      const s = getThemeStyle(op.styleId);
      if (op.mode === "full") {
        const next = buildInitialDocument(doc.productId, s.id, ctx.baseSections, ctx.capabilities, ctx.homeSections);
        return next;
      }
      return {
        ...doc,
        global: {
          styleId: s.id,
          colors: { ...s.palette },
          headingFont: s.headingFont,
          bodyFont: s.bodyFont,
          radius: typeof s.settingOverrides.buttons_radius === "number" ? s.settingOverrides.buttons_radius : 8,
          design: s.design ? { ...s.design } : doc.global.design,
        },
        buybox: {
          ...doc.buybox,
          gallery: { ...doc.buybox.gallery, presetId: STYLE_GALLERY[s.id] || doc.buybox.gallery.presetId },
        },
      };
    }
    case "set_colors": {
      // Harmonie-Garantie: ein gesättigter heller Hintergrund, der mit dem
      // (evtl. gerade geänderten) Akzent beißt, wird auf ein sauberes Neutral
      // gezogen — kein clashendes Beige/Sand mehr, egal was die KI ausgibt.
      const merged = { ...doc.global.colors, ...op.colors };
      merged.background = harmonizeBackground(merged.background, merged.accent);
      return { ...doc, global: { ...doc.global, colors: merged } };
    }
    case "set_fonts":
      return {
        ...doc,
        global: {
          ...doc.global,
          ...(op.headingFont ? { headingFont: op.headingFont } : {}),
          ...(op.bodyFont ? { bodyFont: op.bodyFont } : {}),
        },
      };
    case "set_radius":
      return { ...doc, global: { ...doc.global, radius: op.radius } };
    case "set_design":
      return {
        ...doc,
        global: {
          ...doc.global,
          design: {
            shadow: op.shadow ?? doc.global.design.shadow,
            border: op.border ?? doc.global.design.border,
            iconStyle: op.iconStyle ?? doc.global.design.iconStyle,
          },
        },
      };
    case "add_section": {
      // Nur Typen einfügen, die die Theme-Basis kennt (capabilities).
      if (ctx.capabilities.length && !ctx.capabilities.includes(op.type)) return doc;
      const instance = createLibraryInstance(op.type, op.presetId);
      if (op.texts) instance.texts = { ...op.texts };
      if (op.uid) ctx.uidMap.set(op.uid, instance.uid);
      const key = op.page === "home" ? "home" : "sections";
      const list = [...(doc[key] || [])];
      const at = typeof op.position === "number" ? Math.max(0, Math.min(list.length, op.position)) : list.length;
      list.splice(at, 0, instance);
      return { ...doc, [key]: list };
    }
    case "remove_section": {
      const uid = resolveUid(op.uid);
      return {
        ...doc,
        sections: doc.sections.filter((s) => s.uid !== uid),
        home: (doc.home || []).filter((s) => s.uid !== uid),
      };
    }
    case "move_section": {
      const uid = resolveUid(op.uid);
      for (const key of ["sections", "home"] as const) {
        const list = doc[key] || [];
        const i = list.findIndex((s) => s.uid === uid);
        if (i < 0) continue;
        const next = [...list];
        const [item] = next.splice(i, 1);
        next.splice(Math.max(0, Math.min(next.length, op.to)), 0, item);
        return { ...doc, [key]: next };
      }
      return doc;
    }
    case "set_section_preset": {
      const uid = resolveUid(op.uid);
      const inst = findInstance(doc, uid);
      if (!inst || !getSectionDef(inst.type)?.presets.some((p) => p.id === op.presetId)) return doc;
      const mapList = (list: SectionInstance[]) => list.map((s) => (s.uid === uid ? { ...s, presetId: op.presetId } : s));
      return { ...doc, sections: mapList(doc.sections), home: mapList(doc.home || []) };
    }
    case "set_section_text": {
      const uid = resolveUid(op.uid);
      const inst = findInstance(doc, uid);
      if (!inst || !getSectionDef(inst.type)?.fields.some((f) => f.id === op.field)) return doc;
      const mapList = (list: SectionInstance[]) =>
        list.map((s) => (s.uid === uid ? { ...s, texts: { ...s.texts, [op.field]: op.value } } : s));
      return { ...doc, sections: mapList(doc.sections), home: mapList(doc.home || []) };
    }
    case "set_section_tone": {
      const uid = resolveUid(op.uid);
      const inst = findInstance(doc, uid);
      if (!inst || !sectionSupportsDesign(inst.type)) return doc;
      // Symmetrie-Garantie: schlägt die AI nur EINE Kante vor, bekommt die
      // Section dieselbe Form oben UND unten — einseitige oder gemischte
      // Übergänge wirken kaputt und sind per Design-Regel verboten.
      const shape =
        op.divider && op.divider !== "none" ? op.divider
        : op.dividerTop && op.dividerTop !== "none" ? op.dividerTop
        : undefined;
      const toneSettings = sectionToneSettings(op.tone, doc.global.colors, {
        divider: shape ?? op.divider,
        dividerTop: shape ?? op.dividerTop,
      });
      const mapList = (list: SectionInstance[]) =>
        list.map((s) => (s.uid === uid ? { ...s, settings: { ...(s.settings || {}), ...toneSettings } } : s));
      return { ...doc, sections: mapList(doc.sections), home: mapList(doc.home || []) };
    }
    case "set_section_setting": {
      const uid = resolveUid(op.uid);
      const inst = findInstance(doc, uid);
      if (!inst || !sectionSupportsDesign(inst.type)) return doc;
      // Divider-Keys wirken IMMER als Paar (gleiche Form oben+unten, "none"
      // entfernt beide) — dieselbe Symmetrie-Garantie wie bei set_section_tone,
      // sonst könnte die AI über diesen Op-Typ einseitige Kanten erzeugen.
      const patch: Record<string, string> =
        op.key === "sec_divider" || op.key === "sec_divider_top"
          ? { sec_divider: op.value, sec_divider_top: op.value }
          : { [op.key]: op.value };
      const mapList = (list: SectionInstance[]) =>
        list.map((s) => (s.uid === uid ? { ...s, settings: { ...(s.settings || {}), ...patch } } : s));
      return { ...doc, sections: mapList(doc.sections), home: mapList(doc.home || []) };
    }
    case "set_benefit_icons": {
      // Auf 4 auffüllen (Rest = bestehende Icons), damit die Vorteile-Liste
      // immer vollständig besetzt bleibt.
      const cur = doc.buybox.benefitIcons || [];
      const icons = [...op.icons];
      for (let i = icons.length; i < 4; i++) icons.push(cur[i] || "check");
      return { ...doc, buybox: { ...doc.buybox, benefitIcons: icons.slice(0, 4) } };
    }
    case "add_buybox_block": {
      if (doc.buybox.order.includes(op.blockType)) {
        // Schon aktiv → höchstens die Style-Art übernehmen.
        if (!op.presetId) return doc;
        const prev = doc.buybox.blocks[op.blockType] || { presetId: "", texts: {} };
        return { ...doc, buybox: { ...doc.buybox, blocks: { ...doc.buybox.blocks, [op.blockType]: { ...prev, presetId: op.presetId } } } };
      }
      // Position kommt NICHT von der AI: neue Bausteine landen immer an ihrem
      // Platz im Funnel-Kanon (Conversion über dem Kaufen-Button, Vertrauen/
      // Versand/Details darunter) — nie wieder Quatsch-Anordnungen.
      const order = sortBuyboxOrder([...doc.buybox.order, op.blockType]);
      const blocks = op.presetId
        ? { ...doc.buybox.blocks, [op.blockType]: { ...(doc.buybox.blocks[op.blockType] || { presetId: "", texts: {} }), presetId: op.presetId } }
        : doc.buybox.blocks;
      return {
        ...doc,
        buybox: { ...doc.buybox, order, blocks, hidden: doc.buybox.hidden.filter((h) => h !== op.blockType) },
      };
    }
    case "remove_buybox_block":
      if (!doc.buybox.order.includes(op.blockType)) return doc;
      return {
        ...doc,
        buybox: {
          ...doc.buybox,
          order: doc.buybox.order.filter((t) => t !== op.blockType),
          hidden: doc.buybox.hidden.includes(op.blockType) ? doc.buybox.hidden : [...doc.buybox.hidden, op.blockType],
        },
      };
    case "reorder_buybox": {
      // Die AI bestimmt nur noch, WELCHE Bausteine sie anspricht — die
      // Reihenfolge wird IMMER aufs bewährte Funnel-Muster gesnappt
      // (sortBuyboxOrder): Dringlichkeit/Titel/Bewertung/Preis ÜBER dem
      // Kaufen-Button, Zahlarten/Vorteile/Versand/Details DARUNTER.
      const active = new Set(doc.buybox.order);
      const wanted = op.order.some((t) => active.has(t));
      if (!wanted) return doc;
      return { ...doc, buybox: { ...doc.buybox, order: sortBuyboxOrder(doc.buybox.order) } };
    }
    case "set_block_preset": {
      const prev = doc.buybox.blocks[op.blockType] || { presetId: "", texts: {} };
      return { ...doc, buybox: { ...doc.buybox, blocks: { ...doc.buybox.blocks, [op.blockType]: { ...prev, presetId: op.presetId } } } };
    }
    case "set_block_text": {
      const prev = doc.buybox.blocks[op.blockType] || { presetId: "", texts: {} };
      return {
        ...doc,
        buybox: {
          ...doc.buybox,
          blocks: { ...doc.buybox.blocks, [op.blockType]: { ...prev, texts: { ...prev.texts, [op.field]: op.value } } },
        },
      };
    }
    case "set_block_setting": {
      const prev = doc.buybox.blocks[op.blockType] || { presetId: "", texts: {} };
      return {
        ...doc,
        buybox: {
          ...doc.buybox,
          blocks: {
            ...doc.buybox.blocks,
            [op.blockType]: { ...prev, settings: { ...(prev.settings || {}), [op.key]: op.value } },
          },
        },
      };
    }
    case "set_gallery":
      return {
        ...doc,
        buybox: {
          ...doc.buybox,
          gallery: {
            presetId: op.presetId ?? doc.buybox.gallery.presetId,
            badge: op.badge ?? doc.buybox.gallery.badge,
          },
        },
      };
    case "set_buybox_spacing":
      return { ...doc, buybox: { ...doc.buybox, spacing: op.spacing } };
    default:
      return doc;
  }
}

// ─── Aufwand → Credit-Stufe ─────────────────────────────────────────

export type AiEffortTier = "small" | "medium" | "large";
export const AI_TIER_KEYS: Record<AiEffortTier, string> = {
  small: "THEME_AI_SMALL",
  medium: "THEME_AI_MEDIUM",
  large: "THEME_AI_LARGE",
};
export const AI_TIER_KEYS_EXPERT: Record<AiEffortTier, string> = {
  small: "THEME_AI_EXPERT_SMALL",
  medium: "THEME_AI_EXPERT_MEDIUM",
  large: "THEME_AI_EXPERT_LARGE",
};

/** Credit-Key für Stufe + Modus (standard = Sonnet, expert = Opus). */
export function aiTierCreditKey(tier: AiEffortTier, mode: "standard" | "expert"): string {
  return (mode === "expert" ? AI_TIER_KEYS_EXPERT : AI_TIER_KEYS)[tier];
}

const OP_WEIGHTS: Record<AiOp["op"], number> = {
  set_colors: 1, set_fonts: 1, set_radius: 1, set_design: 1,
  set_gallery: 1, set_buybox_spacing: 1,
  set_section_text: 1, set_block_text: 1, set_block_setting: 1,
  set_section_preset: 1, set_block_preset: 1,
  set_section_tone: 1, set_section_setting: 1, set_benefit_icons: 1,
  add_buybox_block: 2, remove_buybox_block: 2, reorder_buybox: 2,
  add_section: 3, remove_section: 2, move_section: 2,
  set_style: 4,
};

/** Aufwands-Punkte eines Plans: Summe der Op-Gewichte (+3 je Bild). */
export function aiEffortPoints(ops: AiOp[], imageCount = 0): number {
  let pts = imageCount * 3;
  for (const op of ops) {
    pts += OP_WEIGHTS[op.op] || 1;
    if (op.op === "set_style" && op.mode === "full") pts += 3;
  }
  return pts;
}

export function aiEffortTier(points: number): AiEffortTier {
  if (points <= 6) return "small";
  if (points <= 14) return "medium";
  return "large";
}
