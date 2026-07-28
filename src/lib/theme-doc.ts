// ─── ThemeDocument: EIN State-Objekt für den Theme-Editor ───────────
// Alles, was der Kunde im Editor einstellt, lebt in diesem serialisierbaren
// Dokument. Es bildet 1:1 auf die Shopify-Zieldateien ab:
//   global          → config/settings_data.json ("current")
//   sections        → templates/product.json (order + Section-Settings)
//   buybox          → main-product-Section (block_order/Sichtbarkeit/Icons)
// Vorschau UND Export lesen dasselbe Dokument → „Vorschau = Download".
// Client-safe (kein server-only Import).

import type { ColorPalette } from "@/lib/theme-placeholders";
import { monoPalette } from "@/lib/theme-color";
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
  /** Feineinstellungen (rohe Setting-Overrides über den Preset-Werten) —
   *  v. a. der Design-Layer: Hintergrund-Ton, Übergänge/Fades, Divider,
   *  Icon-Wahl. Werte dürfen Palette-Refs ("@accent" …) enthalten. */
  settings?: Record<string, string | number | boolean>;
}

/** Konfiguration EINES Kaufbox-Bausteins: Style-Art + kuratierte Texte +
 *  Feineinstellungen (rohe Setting-Overrides wie Farbe/Größe/Ausrichtung,
 *  die über die Preset-Werte gelegt werden). */
export interface BlockConfig {
  presetId: string;
  texts: Record<string, string>;
  settings?: Record<string, string | number | boolean>;
}

/** Ein Feature-Eintrag UNTER dem Produktbild (Icon + Text). */
export interface GalleryFeature {
  icon: string;
  text: string;
}

/** Produktgalerie (Bereich Produktbild + Thumbnails) — pg_*-Settings. */
export interface GalleryConfig {
  presetId: string;
  /** Badge-Text auf dem Hauptbild ("" = kein Badge). */
  badge: string;
  /** Feature-Liste UNTER dem Produktbild (Icon + Text, max. 4; [] = aus). */
  features?: GalleryFeature[];
}

export interface BuyboxConfig {
  order: string[];
  hidden: string[];
  benefitIcons: string[];
  /** Style-Art + Texte je Baustein-Typ (Key = Block-Typ). */
  blocks: Record<string, BlockConfig>;
  gallery: GalleryConfig;
  /** Vertikaler Abstand zwischen den Kaufbox-Bausteinen in px (4–40). */
  spacing?: number;
}

export interface ThemeDocument {
  version: 1;
  productId: string;
  global: GlobalStyles;
  /** Produktseiten-Sektionen unter der Kaufbox, in Anzeige-Reihenfolge. */
  sections: SectionInstance[];
  /** Startseiten-Sektionen (templates/index.json), in Anzeige-Reihenfolge.
   *  Leer/fehlend = Startseite bleibt im Basis-Zustand (Legacy-Verhalten). */
  home: SectionInstance[];
  buybox: BuyboxConfig;
}

export type EditorPage = "product" | "home";

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
    home: [],
    buybox: {
      order: [...BUYBOX_DEFAULT_ORDER],
      hidden: [],
      benefitIcons: [...DEFAULT_BENEFIT_ICONS],
      blocks: {},
      gallery: { presetId: "thumbs-unten", badge: "", features: [] },
      spacing: 15,
    },
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
  | { type: "addSection"; index: number; section: SectionInstance; page?: EditorPage }
  | { type: "removeSection"; uid: string }
  | { type: "moveSection"; uid: string; dir: -1 | 1 }
  | { type: "reorderSections"; page: EditorPage; order: string[] }
  | { type: "duplicateSection"; uid: string }
  | { type: "resetSection"; uid: string }
  | { type: "setPreset"; uid: string; presetId: string }
  | { type: "setText"; uid: string; field: string; value: string }
  | { type: "setSectionSetting"; uid: string; key: string; value: string | number | boolean }
  | { type: "mergeSectionSettings"; uid: string; patch: Record<string, string | number | boolean> }
  | { type: "setBuybox"; patch: Partial<BuyboxConfig> }
  | { type: "setBlockPreset"; blockType: string; presetId: string }
  | { type: "setBlockText"; blockType: string; field: string; value: string }
  | { type: "setBlockSetting"; blockType: string; key: string; value: string | number | boolean }
  | { type: "setGallery"; patch: Partial<GalleryConfig> }
  // Kaufbox-Baustein-Verwaltung (add/remove/reorder/arrange):
  | { type: "addBuyboxBlock"; blockType: string; index?: number }
  | { type: "removeBuyboxBlock"; blockType: string }
  | { type: "reorderBuybox"; order: string[] }
  | { type: "arrangeBuybox"; canonical: string[] }
  // AI Co-Pilot: Ops werden fürs Live-Gefühl einzeln angewandt, landen aber
  // als EIN History-Schritt (Ctrl+Z macht den ganzen AI-Lauf rückgängig).
  | { type: "aiApply"; doc: ThemeDocument }
  | { type: "aiBoundary" }
  // „Neues Projekt" / „Projekt öffnen": Dokument (leer bzw. geladen) UND
  // leere History in EINEM Schritt — kein Undo zurück ins alte Projekt
  // (das wäre ein verstecktes, halb kaputtes Comeback fremder Stände).
  | { type: "reset"; doc?: ThemeDocument }
  | { type: "undo" }
  | { type: "redo" };

const HISTORY_MAX = 60;

export function initialEditorState(doc?: ThemeDocument): EditorState {
  return { present: doc || emptyDocument(), past: [], future: [], lastTextTarget: null };
}

function apply(doc: ThemeDocument, action: EditorAction): ThemeDocument {
  switch (action.type) {
    case "replace":
    case "aiApply":
      return action.doc;
    case "setProduct":
      return { ...doc, productId: action.productId };
    case "setGlobal":
      return { ...doc, global: { ...doc.global, ...action.patch } };
    case "setColors":
      return { ...doc, global: { ...doc.global, colors: { ...doc.global.colors, ...action.patch } } };
    case "addSection": {
      // Ziel-Seite wählen (default Produktseite); uid-Actions unten arbeiten
      // seitenübergreifend, weil uids global eindeutig sind.
      const key = action.page === "home" ? "home" : "sections";
      const list = [...(doc[key] || [])];
      const i = Math.max(0, Math.min(list.length, action.index));
      list.splice(i, 0, action.section);
      return { ...doc, [key]: list };
    }
    case "removeSection":
      return {
        ...doc,
        sections: doc.sections.filter((s) => s.uid !== action.uid),
        home: (doc.home || []).filter((s) => s.uid !== action.uid),
      };
    case "moveSection": {
      for (const key of ["sections", "home"] as const) {
        const list = doc[key] || [];
        const i = list.findIndex((s) => s.uid === action.uid);
        if (i < 0) continue;
        const j = i + action.dir;
        if (j < 0 || j >= list.length) return doc;
        const next = [...list];
        [next[i], next[j]] = [next[j], next[i]];
        return { ...doc, [key]: next };
      }
      return doc;
    }
    case "reorderSections": {
      // Ganze Reihenfolge einer Seite setzen (Drag&Drop in der Aufbau-Leiste).
      // Nur eine Permutation der vorhandenen uids zulassen (Sicherheit).
      const key = action.page === "home" ? "home" : "sections";
      const list = doc[key] || [];
      const byUid = new Map(list.map((s) => [s.uid, s]));
      const next = action.order
        .map((uid) => byUid.get(uid))
        .filter((s): s is SectionInstance => !!s);
      if (next.length !== list.length) return doc;
      return { ...doc, [key]: next };
    }
    case "setPreset": {
      const mapList = (list: SectionInstance[]) =>
        list.map((s) => (s.uid === action.uid ? { ...s, presetId: action.presetId } : s));
      return { ...doc, sections: mapList(doc.sections), home: mapList(doc.home || []) };
    }
    case "duplicateSection": {
      // Klont die Instanz (neue uid, tiefe Kopie von texts/settings) und setzt
      // sie direkt unter das Original — seitenübergreifend (Produkt/Startseite).
      for (const key of ["sections", "home"] as const) {
        const list = doc[key] || [];
        const i = list.findIndex((s) => s.uid === action.uid);
        if (i < 0) continue;
        const src = list[i];
        const copy: SectionInstance = {
          ...src,
          uid: newSectionUid(),
          texts: { ...src.texts },
          settings: src.settings ? { ...src.settings } : undefined,
        };
        const next = [...list];
        next.splice(i + 1, 0, copy);
        return { ...doc, [key]: next };
      }
      return doc;
    }
    case "resetSection": {
      // Zurück auf den Auslieferungszustand: keine Style-Art, keine eigenen
      // Texte, kein Design-Layer (Feld-Defaults füllen die Vorschau/den Export).
      const mapList = (list: SectionInstance[]) =>
        list.map((s) => (s.uid === action.uid ? { ...s, presetId: "", texts: {}, settings: {} } : s));
      return { ...doc, sections: mapList(doc.sections), home: mapList(doc.home || []) };
    }
    case "setText": {
      const mapList = (list: SectionInstance[]) =>
        list.map((s) => (s.uid === action.uid ? { ...s, texts: { ...s.texts, [action.field]: action.value } } : s));
      return { ...doc, sections: mapList(doc.sections), home: mapList(doc.home || []) };
    }
    case "setSectionSetting": {
      const mapList = (list: SectionInstance[]) =>
        list.map((s) =>
          s.uid === action.uid ? { ...s, settings: { ...(s.settings || {}), [action.key]: action.value } } : s,
        );
      return { ...doc, sections: mapList(doc.sections), home: mapList(doc.home || []) };
    }
    case "mergeSectionSettings": {
      // Mehrere Design-Settings als EIN History-Schritt (z. B. Ton-Wechsel).
      const mapList = (list: SectionInstance[]) =>
        list.map((s) =>
          s.uid === action.uid ? { ...s, settings: { ...(s.settings || {}), ...action.patch } } : s,
        );
      return { ...doc, sections: mapList(doc.sections), home: mapList(doc.home || []) };
    }
    case "setBuybox":
      return { ...doc, buybox: { ...doc.buybox, ...action.patch } };
    case "setBlockPreset": {
      const prev = doc.buybox.blocks[action.blockType] || { presetId: "", texts: {} };
      return {
        ...doc,
        buybox: {
          ...doc.buybox,
          blocks: { ...doc.buybox.blocks, [action.blockType]: { ...prev, presetId: action.presetId } },
        },
      };
    }
    case "setBlockText": {
      const prev = doc.buybox.blocks[action.blockType] || { presetId: "", texts: {} };
      return {
        ...doc,
        buybox: {
          ...doc.buybox,
          blocks: {
            ...doc.buybox.blocks,
            [action.blockType]: { ...prev, texts: { ...prev.texts, [action.field]: action.value } },
          },
        },
      };
    }
    case "setBlockSetting": {
      const prev = doc.buybox.blocks[action.blockType] || { presetId: "", texts: {} };
      return {
        ...doc,
        buybox: {
          ...doc.buybox,
          blocks: {
            ...doc.buybox.blocks,
            [action.blockType]: { ...prev, settings: { ...(prev.settings || {}), [action.key]: action.value } },
          },
        },
      };
    }
    case "setGallery":
      return { ...doc, buybox: { ...doc.buybox, gallery: { ...doc.buybox.gallery, ...action.patch } } };
    case "addBuyboxBlock": {
      if (doc.buybox.order.includes(action.blockType)) return doc; // schon aktiv
      const order = [...doc.buybox.order];
      const at = typeof action.index === "number" ? Math.max(0, Math.min(order.length, action.index)) : order.length;
      order.splice(at, 0, action.blockType);
      return {
        ...doc,
        buybox: { ...doc.buybox, order, hidden: doc.buybox.hidden.filter((h) => h !== action.blockType) },
      };
    }
    case "removeBuyboxBlock":
      return {
        ...doc,
        buybox: {
          ...doc.buybox,
          order: doc.buybox.order.filter((t) => t !== action.blockType),
          // hidden führt entfernte Typen mit (für den statischen Compile-Pfad).
          hidden: doc.buybox.hidden.includes(action.blockType) ? doc.buybox.hidden : [...doc.buybox.hidden, action.blockType],
        },
      };
    case "reorderBuybox": {
      // Nur eine Permutation der aktuell aktiven Typen zulassen (Sicherheit).
      const cur = new Set(doc.buybox.order);
      const next = action.order.filter((t) => cur.has(t));
      if (next.length !== doc.buybox.order.length) return doc;
      return { ...doc, buybox: { ...doc.buybox, order: next } };
    }
    case "arrangeBuybox": {
      const active = new Set(doc.buybox.order);
      const inCanon = action.canonical.filter((t) => active.has(t));
      const rest = doc.buybox.order.filter((t) => !action.canonical.includes(t));
      return { ...doc, buybox: { ...doc.buybox, order: [...inCanon, ...rest] } };
    }
    default:
      return doc;
  }
}

/** MONO-Klammer: das Dokument trägt IMMER eine Mono-Palette (weiße oder
 *  schwarze Seite, neutraler Fließtext). Greift auch bei geladenen Alt-
 *  Designs und AI-Ergebnissen. Ist schon alles mono, bleibt die Referenz
 *  identisch — kein unnötiges Re-Render. */
function withMonoPalette(doc: ThemeDocument): ThemeDocument {
  const colors = monoPalette(doc.global.colors);
  if (colors.background === doc.global.colors.background && colors.text === doc.global.colors.text) return doc;
  return { ...doc, global: { ...doc.global, colors } };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  // Grenze zwischen zwei AI-Läufen: beendet nur die Koaleszenz (kein Doc-
  // Change, kein History-Eintrag) — der nächste aiApply beginnt einen
  // frischen History-Schritt.
  if (action.type === "aiBoundary") {
    return state.lastTextTarget === null ? state : { ...state, lastTextTarget: null };
  }
  if (action.type === "reset") {
    return initialEditorState(action.doc ? withMonoPalette(action.doc) : undefined);
  }
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

  const next = withMonoPalette(apply(state.present, action));
  if (next === state.present) return state;

  // Tipp-Serien im selben Feld nicht als einzelne History-Schritte stapeln
  // (gilt für Section-Texte, Block-Texte, das Galerie-Badge und die
  // Schritt-für-Schritt angewandten Ops EINES AI-Laufs).
  const isGalleryTyping = action.type === "setGallery" && (action.patch.badge !== undefined || action.patch.features !== undefined) && action.patch.presetId === undefined;
  if (action.type === "setText" || action.type === "setBlockText" || isGalleryTyping || action.type === "aiApply") {
    const target =
      action.type === "setText"
        ? `sec|${action.uid}|${action.field}`
        : action.type === "setBlockText"
          ? `blk|${action.blockType}|${action.field}`
          : action.type === "aiApply"
            ? "ai|batch"
            : action.type === "setGallery" && action.patch.features !== undefined
              ? "gallery|features"
              : "gallery|badge";
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
