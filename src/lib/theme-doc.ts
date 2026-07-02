// ─── ThemeDocument: EIN State-Objekt für den Theme-Editor ───────────
// Alles, was der Kunde im Editor einstellt, lebt in diesem serialisierbaren
// Dokument. Es bildet 1:1 auf die Shopify-Zieldateien ab:
//   global          → config/settings_data.json ("current")
//   sections        → templates/product.json (order + Section-Settings)
//   buybox          → main-product-Section (block_order/Sichtbarkeit/Icons)
// Vorschau UND Export lesen dasselbe Dokument → „Vorschau = Download".
// Client-safe (kein server-only Import).

import type { ColorPalette } from "@/lib/theme-placeholders";
import { DEFAULT_DESIGN, type StyleDesign } from "@/lib/theme-styles";
import { BUYBOX_DEFAULT_ORDER } from "@/lib/theme-sections";
import { DEFAULT_BENEFIT_ICONS } from "@/lib/theme-icons";

export interface GlobalStyles {
  /** Gewählter Theme-Stil (Architektur-Preset aus theme-styles). */
  styleId: string;
  colors: ColorPalette;
  headingFont: string;
  bodyFont: string;
  /** Ecken-Radius in px (0–40) → buttons/card/media/inputs/badge-Radius. */
  radius: number;
  design: StyleDesign;
}

export interface SectionInstance {
  /** Section-ID im Template: bestehende Basis-ID oder "hub_…" (neu instanziiert). */
  uid: string;
  /** Echter Liquid-Section-Typ (z. B. "qanda", "bro-cta-banner"). */
  type: string;
  /** Gewählte Style-Art (Preset-ID der Bibliothek); "" = Basis-Zustand. */
  presetId: string;
  /** template = existiert in der Theme-Basis · library = wird neu eingefügt. */
  source: "template" | "library";
  /** Kuratierte editierbare Texte (Feld-ID → Wert), s. theme-library fields. */
  texts: Record<string, string>;
}

export interface BuyboxConfig {
  order: string[];
  hidden: string[];
  benefitIcons: string[];
}

export interface ThemeDocument {
  version: 1;
  productId: string;
  global: GlobalStyles;
  /** Produktseiten-Sektionen unter der Kaufbox, in Anzeige-Reihenfolge. */
  sections: SectionInstance[];
  buybox: BuyboxConfig;
}

export function emptyDocument(): ThemeDocument {
  return {
    version: 1,
    productId: "",
    global: {
      styleId: "modern",
      colors: { button: "#111111", buttonText: "#ffffff", background: "#ffffff", text: "#1a1a1a", accent: "#2f6bff" },
      headingFont: "inter_n4",
      bodyFont: "inter_n4",
      radius: 8,
      design: DEFAULT_DESIGN,
    },
    sections: [],
    buybox: { order: [...BUYBOX_DEFAULT_ORDER], hidden: [], benefitIcons: [...DEFAULT_BENEFIT_ICONS] },
  };
}

let uidCounter = 0;
/** Eindeutige ID für neu eingefügte Sections (wird Section-Key im Template). */
export function newSectionUid(): string {
  uidCounter += 1;
  return `hub_${Date.now().toString(36)}${uidCounter.toString(36)}`;
}

// ─── Reducer mit Undo/Redo-History ─────────────────────────────────

export interface EditorState {
  present: ThemeDocument;
  past: ThemeDocument[];
  future: ThemeDocument[];
  /** Ziel der letzten Text-Eingabe ("uid|feld") — Tipp-Serien werden zu EINEM History-Schritt zusammengefasst. */
  lastTextTarget: string | null;
}

export type EditorAction =
  | { type: "replace"; doc: ThemeDocument }
  | { type: "setProduct"; productId: string }
  | { type: "setGlobal"; patch: Partial<GlobalStyles> }
  | { type: "setColors"; patch: Partial<ColorPalette> }
  | { type: "addSection"; index: number; section: SectionInstance }
  | { type: "removeSection"; uid: string }
  | { type: "moveSection"; uid: string; dir: -1 | 1 }
  | { type: "setPreset"; uid: string; presetId: string }
  | { type: "setText"; uid: string; field: string; value: string }
  | { type: "setBuybox"; patch: Partial<BuyboxConfig> }
  | { type: "undo" }
  | { type: "redo" };

const HISTORY_MAX = 60;

export function initialEditorState(doc?: ThemeDocument): EditorState {
  return { present: doc || emptyDocument(), past: [], future: [], lastTextTarget: null };
}

function apply(doc: ThemeDocument, action: EditorAction): ThemeDocument {
  switch (action.type) {
    case "replace":
      return action.doc;
    case "setProduct":
      return { ...doc, productId: action.productId };
    case "setGlobal":
      return { ...doc, global: { ...doc.global, ...action.patch } };
    case "setColors":
      return { ...doc, global: { ...doc.global, colors: { ...doc.global.colors, ...action.patch } } };
    case "addSection": {
      const sections = [...doc.sections];
      const i = Math.max(0, Math.min(sections.length, action.index));
      sections.splice(i, 0, action.section);
      return { ...doc, sections };
    }
    case "removeSection":
      return { ...doc, sections: doc.sections.filter((s) => s.uid !== action.uid) };
    case "moveSection": {
      const i = doc.sections.findIndex((s) => s.uid === action.uid);
      const j = i + action.dir;
      if (i < 0 || j < 0 || j >= doc.sections.length) return doc;
      const sections = [...doc.sections];
      [sections[i], sections[j]] = [sections[j], sections[i]];
      return { ...doc, sections };
    }
    case "setPreset":
      return {
        ...doc,
        sections: doc.sections.map((s) => (s.uid === action.uid ? { ...s, presetId: action.presetId } : s)),
      };
    case "setText":
      return {
        ...doc,
        sections: doc.sections.map((s) =>
          s.uid === action.uid ? { ...s, texts: { ...s.texts, [action.field]: action.value } } : s,
        ),
      };
    case "setBuybox":
      return { ...doc, buybox: { ...doc.buybox, ...action.patch } };
    default:
      return doc;
  }
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  if (action.type === "undo") {
    if (!state.past.length) return state;
    const past = [...state.past];
    const prev = past.pop()!;
    return { present: prev, past, future: [state.present, ...state.future], lastTextTarget: null };
  }
  if (action.type === "redo") {
    if (!state.future.length) return state;
    const [next, ...future] = state.future;
    return { present: next, past: [...state.past, state.present], future, lastTextTarget: null };
  }

  const next = apply(state.present, action);
  if (next === state.present) return state;

  // Tipp-Serien im selben Feld nicht als einzelne History-Schritte stapeln.
  if (action.type === "setText") {
    const target = `${action.uid}|${action.field}`;
    if (state.lastTextTarget === target) {
      return { ...state, present: next, future: [], lastTextTarget: target };
    }
    return {
      present: next,
      past: [...state.past, state.present].slice(-HISTORY_MAX),
      future: [],
      lastTextTarget: target,
    };
  }

  return {
    present: next,
    past: [...state.past, state.present].slice(-HISTORY_MAX),
    future: [],
    lastTextTarget: null,
  };
}
