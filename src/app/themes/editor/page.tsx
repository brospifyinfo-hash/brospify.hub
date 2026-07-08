"use client";

// ─── /themes/editor — Theme-Editor v2 ───────────────────────────────
// Produkt-zuerst-Flow: (1) Produkt aus Bilder-Grid wählen → (2) Split-Pane-
// Editor (Aufbau/Navigation links · Live-Vorschau + AI-Leiste Mitte · Einstellungen rechts). Alles lebt
// in EINEM ThemeDocument (Undo/Redo), das die Compile-Engine 1:1 in das
// Shopify-Theme übersetzt. Desktop nutzt die volle Breite; mobil gestapelt.

import { useEffect, useMemo, useReducer, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, Reorder, useDragControls } from "framer-motion";
import { gsap } from "gsap";
import {
  ArrowLeft, Download, Monitor, Smartphone, Plus, Redo2, Undo2,
  Sparkles, ShoppingCart, Package, ChevronRight, RefreshCw, Palette, Bookmark,
  Star, AlignLeft, Image as ImageIcon, Info, GripVertical, Eye, Layers,
  SlidersHorizontal, ZoomIn, ZoomOut, Maximize2, Trash2, UploadCloud, X,
  Pencil, Target, ChevronDown, ArrowDownUp,
  type LucideIcon,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { useI18n } from "@/lib/i18n";
import { useCredits } from "@/lib/credits";
import ThemePreview, { type PreviewData } from "@/components/ThemePreview";
import Inspector, { BlockIcon } from "@/components/theme-editor/Inspector";
import { getBuyboxMeta, BUYBOX_CANONICAL_ORDER } from "@/lib/theme-sections";
import SectionLibraryOverlay from "@/components/theme-editor/SectionLibraryOverlay";
import StyleGalleryOverlay from "@/components/theme-editor/StyleGalleryOverlay";
import DesignsOverlay from "@/components/theme-editor/DesignsOverlay";
import BuyboxGalleryOverlay from "@/components/theme-editor/BuyboxGalleryOverlay";
import FullPreviewOverlay from "@/components/theme-editor/FullPreviewOverlay";
import AiCopilot from "@/components/theme-editor/AiCopilot";
import { ACCENT, EDITOR_FONTS } from "@/components/theme-editor/editor-ui";
import {
  editorReducer, initialEditorState, type ThemeDocument, type EditorPage,
} from "@/lib/theme-doc";
import {
  buildInitialDocument, createLibraryInstance, getSectionDef, shuffleComposition,
  type BaseSectionInfo,
} from "@/lib/theme-library";
import { THEME_STYLES, DEFAULT_STYLE_ID, getThemeStyle, type StyleDesign } from "@/lib/theme-styles";
import { STYLE_GALLERY } from "@/lib/theme-library";

interface DrawnProduct { id: string; titel: string; bildUrl?: string }
/** Eigenes (selbst angelegtes) Produkt — alle Felder außer id optional. */
interface CustomProductLite { id: string; titel?: string; bildUrl?: string; preis?: string; beschreibung?: string }
interface PreviewResponse extends PreviewData {
  baseSections?: BaseSectionInfo[];
  homeSections?: BaseSectionInfo[];
  capabilities?: string[];
}

function randFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
function randomAccent(): string {
  return hslToHex(Math.floor(Math.random() * 360), 62 + Math.floor(Math.random() * 20), 45 + Math.floor(Math.random() * 12));
}

// Eine sortierbare Section-Zeile in der Aufbau-Leiste. Ziehen NUR am
// Greif-Symbol (dragListener=false + DragControls) — Klick wählt aus.
// Framer rastet die Zeile weich zwischen den anderen ein.
function RailSectionRow({
  uid, Ico, name, presetText, on, onClick, dragTitle, focused, onToggleFocus, focusTitle,
}: {
  uid: string; Ico: LucideIcon; name: string; presetText: string; on: boolean; onClick: () => void; dragTitle: string;
  focused: boolean; onToggleFocus: () => void; focusTitle: string;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={uid}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.02, zIndex: 30, boxShadow: "0 12px 26px -10px rgba(0,0,0,0.6)" }}
      transition={{ duration: 0.16 }}
      className={`list-none flex items-center gap-1 rounded-md border px-1 py-2 lg:py-1 ${
        on ? "border-[#95BF47]/50 bg-[#95BF47]/[0.12]" : focused ? "border-amber-400/40 bg-amber-400/[0.06]" : "border-transparent hover:bg-white/[0.05]"
      }`}
    >
      <span
        onPointerDown={(e) => controls.start(e)}
        title={dragTitle}
        style={{ touchAction: "none" }}
        className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300 shrink-0 p-1 -m-1 lg:p-0 lg:m-0"
      >
        <GripVertical className="w-3.5 h-3.5 lg:w-3 lg:h-3" />
      </span>
      <Ico className={`w-3.5 h-3.5 shrink-0 ${on ? "text-[#95BF47]" : "text-zinc-500"}`} />
      <button onClick={onClick} className="min-w-0 flex-1 text-left">
        <span className="block text-[13px] lg:text-[12px] font-medium text-white truncate leading-tight">{name}</span>
      </button>
      <span className="text-[10px] lg:text-[9px] text-zinc-600 shrink-0 truncate max-w-[64px] lg:max-w-[48px]">{presetText}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFocus(); }}
        title={focusTitle}
        aria-pressed={focused}
        className={`shrink-0 p-1 rounded transition ${focused ? "text-amber-400" : "text-zinc-600 hover:text-amber-300"}`}
      >
        <Target className="w-3.5 h-3.5" />
      </button>
    </Reorder.Item>
  );
}

// Eine Kaufbox-Baustein-Zeile im Kaufbox-Dropdown der Aufbau-Leiste (rechts).
// Klick wählt den Baustein aus (Einstellungen erscheinen links), Ziehen am
// Greif-Symbol sortiert, Papierkorb entfernt.
function BuyboxNavRow({
  type, name, iconName, on, onClick, onRemove, dragTitle, removeLabel,
}: {
  type: string; name: string; iconName: string; on: boolean; onClick: () => void; onRemove: () => void; dragTitle: string; removeLabel: string;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={type}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.02, zIndex: 30, boxShadow: "0 12px 26px -10px rgba(0,0,0,0.6)" }}
      transition={{ duration: 0.16 }}
      className={`list-none flex items-center gap-1 rounded-md border px-1 py-1.5 lg:py-1 ${
        on ? "border-[#95BF47]/50 bg-[#95BF47]/[0.12]" : "border-transparent hover:bg-white/[0.05]"
      }`}
    >
      <span
        onPointerDown={(e) => controls.start(e)}
        title={dragTitle}
        style={{ touchAction: "none" }}
        className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300 shrink-0 p-1 -m-1 lg:p-0 lg:m-0"
      >
        <GripVertical className="w-3.5 h-3.5 lg:w-3 lg:h-3" />
      </span>
      <BlockIcon name={iconName} className={`w-3.5 h-3.5 shrink-0 ${on ? "text-[#95BF47]" : "text-zinc-500"}`} />
      <button onClick={onClick} className="min-w-0 flex-1 text-left">
        <span className="block text-[12.5px] lg:text-[11.5px] font-medium text-white truncate leading-tight">{name}</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        title={removeLabel}
        aria-label={removeLabel}
        className="shrink-0 p-1 rounded text-zinc-600 hover:text-red-300 transition"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </Reorder.Item>
  );
}

export default function ThemeEditorPage() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const credits = useCredits();
  // Admin-Konten haben KEIN Credit-Konto (/api/profile 401 → credits.loading
  // bleibt dauerhaft true). Damit der Editor-Chip nicht ewig „…" zeigt, holen
  // wir isAdmin und zeigen dann „∞" — genau wie das globale Credits-Pill.
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setIsAdmin(!!d?.isAdmin))
      .catch(() => {});
  }, []);

  const [state, dispatch] = useReducer(editorReducer, undefined, () => initialEditorState());
  const doc = state.present;

  const [products, setProducts] = useState<DrawnProduct[] | null>(null);
  // Eigene Produkte (kein Katalog-Zwang) + Anlege-Formular (alles optional).
  const [customProducts, setCustomProducts] = useState<CustomProductLite[]>([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [customForm, setCustomForm] = useState({ titel: "", preis: "", beschreibung: "", bildUrl: "" });
  const [customUploading, setCustomUploading] = useState(false);
  const [customSaving, setCustomSaving] = useState(false);
  const [customDrag, setCustomDrag] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [baseSections, setBaseSections] = useState<BaseSectionInfo[]>([]);
  const [homeSections, setHomeSections] = useState<BaseSectionInfo[]>([]);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [page, setPage] = useState<EditorPage>("product");
  const [selected, setSelected] = useState<string | null>(null);
  // Kaufbox-Dropdown in der Aufbau-Leiste auf/zu (manuell); ist automatisch
  // offen, wenn die Kaufbox oder ein Baustein ausgewählt ist.
  const [buyboxOpen, setBuyboxOpen] = useState(false);
  // Inline-Text-Bearbeitung in der Vorschau (Klick → Text direkt bearbeiten).
  const [editTexts, setEditTexts] = useState(true);
  // Für die AI fokussierte uids: Section-uid ODER "__buybox" (Kaufbox).
  const [aiFocus, setAiFocus] = useState<string[]>([]);
  // Fokus-Auswahl-Modus: Klick auf Sections/Kaufbox in der Vorschau fokussiert.
  const [focusPick, setFocusPick] = useState(false);
  const handleEditText = useCallback(
    (uid: string, field: string, value: string) => dispatch({ type: "setText", uid, field, value }),
    [dispatch],
  );
  const handleEditBlockText = useCallback(
    (blockType: string, field: string, value: string) => dispatch({ type: "setBlockText", blockType, field, value }),
    [dispatch],
  );
  const toggleFocus = useCallback(
    (uid: string) => setAiFocus((f) => (f.includes(uid) ? f.filter((x) => x !== uid) : [...f, uid])),
    [],
  );
  // Fokus entrümpeln, wenn Sections entfernt/ersetzt werden (z. B. Stilwechsel).
  // "__buybox" ist keine Section und bleibt immer erhalten.
  useEffect(() => {
    setAiFocus((f) => {
      const ids = new Set([...doc.sections, ...(doc.home || [])].map((s) => s.uid));
      const next = f.filter((u) => u === "__buybox" || ids.has(u));
      return next.length === f.length ? f : next;
    });
  }, [doc.sections, doc.home]);
  // Mobil: genau EIN Bereich sichtbar (Vorschau ODER Aufbau ODER Einstellungen),
  // umgeschaltet über eine sticky 3-Tab-Leiste — Desktop zeigt alles nebeneinander.
  const [mobileTab, setMobileTab] = useState<"vorschau" | "aufbau" | "einstellungen">("vorschau");
  // Vorschau-Zoom (Regler): multipliziert die Einpass-Skalierung (50–200 %).
  const [zoom, setZoom] = useState(1);
  // Fast-Vollbild-Vorschau (Overlay, reine Ansicht).
  const [fullPreviewOpen, setFullPreviewOpen] = useState(false);
  const [libraryAt, setLibraryAt] = useState<number | null>(null);
  const [styleOpen, setStyleOpen] = useState(false);
  const [buyboxGalleryOpen, setBuyboxGalleryOpen] = useState(false);
  const [designsOpen, setDesignsOpen] = useState(false);
  /** Aktuell geladener/gespeicherter Speicherstand (Code = Live-Sync-Code). */
  const [activeDesign, setActiveDesign] = useState<{ code: string; name: string } | null>(null);
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cost, setCost] = useState<number | null>(null);
  const [building, setBuilding] = useState(false);
  const [syncing, setSyncing] = useState(false);
  /** true, solange der AI Co-Pilot Ops anwendet — Editor-Eingriffe (Undo,
   *  Leisten, Download/Sync) sind dann gesperrt, damit kein Animations-
   *  Schritt eine parallele Nutzer-Änderung überschreibt. */
  const [aiBusy, setAiBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);

  // Klick auf eine Section/Baustein → auf schmalen Screens automatisch auf den
  // Einstellungen-Tab wechseln und ihn sanft in den Blick scrollen.
  useEffect(() => {
    if (selected && typeof window !== "undefined" && window.innerWidth < 1024) {
      setMobileTab("einstellungen");
      requestAnimationFrame(() => inspectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, [selected]);

  // Produkte (gezogene) + Kosten laden.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/charts/draw?lang=${lang}`, { cache: "no-store" })
      .then((r) => {
        if (r.status === 401) { router.push("/"); return null; }
        return r.json();
      })
      .then((d) => {
        if (cancelled || !d) return;
        const list = Array.isArray(d.drawn)
          ? (d.drawn as DrawnProduct[]).map((p) => ({ id: p.id, titel: p.titel, bildUrl: p.bildUrl }))
          : [];
        setProducts(list);
      })
      .catch(() => { if (!cancelled) setProducts([]); });
    fetch("/api/credit-config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { const c = d?.costs?.THEME_EXPORT; setCost(Number.isFinite(c) ? c : 100); } })
      .catch(() => setCost(100));
    fetch("/api/custom-products", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && Array.isArray(d?.products)) setCustomProducts(d.products as CustomProductLite[]); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [lang, router]);

  // Produkt wählen → Vorschau-Daten + Basis-Manifest laden; beim ersten Mal
  // initiales Dokument aus der Stil-Komposition bauen.
  const pickProduct = useCallback((productId: string) => {
    setPickerOpen(false);
    setPreviewLoading(true);
    fetch(`/api/theme-export/preview?productId=${encodeURIComponent(productId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: PreviewResponse | null) => {
        if (!d || typeof d.title !== "string") return;
        setPreviewData(d);
        const bs = Array.isArray(d.baseSections) ? d.baseSections : [];
        const hs = Array.isArray(d.homeSections) ? d.homeSections : [];
        const caps = Array.isArray(d.capabilities) ? d.capabilities : [];
        setBaseSections(bs);
        setHomeSections(hs);
        setCapabilities(caps);
        dispatch(
          doc.sections.length === 0
            ? { type: "replace", doc: buildInitialDocument(productId, doc.global.styleId || DEFAULT_STYLE_ID, bs, caps, hs) }
            : { type: "setProduct", productId },
        );
        // Speicherstände sind produktgebunden — bei Produktwechsel entkoppeln.
        setActiveDesign((prev) => (doc.productId && doc.productId !== productId ? null : prev));
      })
      .catch(() => {})
      .finally(() => setPreviewLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.sections.length, doc.global.styleId]);

  // Stil wechseln = neue Seiten-Architektur (Komposition des Stils).
  // shuffle=true mischt die Komposition zu einer individuellen Variante
  // (Anker bleibt, Mitte permutiert + 1–2 stil-passende Extra-Sections).
  const pickStyle = useCallback((styleId: string, shuffle = false) => {
    const composition = shuffle ? shuffleComposition(styleId) : undefined;
    dispatch({ type: "replace", doc: buildInitialDocument(doc.productId, styleId, baseSections, capabilities, homeSections, composition) });
    setSelected(null);
  }, [doc.productId, baseSections, capabilities, homeSections]);

  const randomize = useCallback(() => {
    const s = randFrom(THEME_STYLES);
    // Zufalls-Look = Stil + individuell gemischte Section-Anordnung.
    const next = buildInitialDocument(doc.productId, s.id, baseSections, capabilities, homeSections, shuffleComposition(s.id));
    next.global.colors = { ...next.global.colors, accent: randomAccent() };
    next.global.headingFont = randFrom(EDITOR_FONTS).value;
    next.global.bodyFont = randFrom(EDITOR_FONTS).value;
    next.global.radius = randFrom([0, 4, 8, 14, 22, 30]);
    next.global.design = {
      shadow: randFrom([0, 1, 2]) as StyleDesign["shadow"],
      border: randFrom([1, 2]) as StyleDesign["border"],
      iconStyle: randFrom(["dark", "accent", "outline"]) as StyleDesign["iconStyle"],
    };
    dispatch({ type: "replace", doc: next });
    setSelected(null);
  }, [doc.productId, baseSections, capabilities, homeSections]);

  // Aktive Seiten-Liste (Produktseite oder Startseite).
  const currentSections = page === "home" ? doc.home || [] : doc.sections;

  // Stil NACHTRÄGLICH anwenden: „Nur Design" behält Aufbau/Texte (nur Farben,
  // Schriften, Ecken, Design, Galerie-Look); „Kompletter Stil" baut beide
  // Seiten nach der Stil-Komposition neu.
  const applyStyle = useCallback((styleId: string, full: boolean, shuffle = false) => {
    setStyleOpen(false);
    if (full) {
      pickStyle(styleId, shuffle);
      return;
    }
    const s = getThemeStyle(styleId);
    dispatch({
      type: "replace",
      doc: {
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
      },
    });
    setSelected(null);
  }, [doc, pickStyle]);

  // Section einfügen (aus Bibliothek) + GSAP-Puls auf der neuen Section.
  const insertSection = useCallback((type: string, presetId: string) => {
    const instance = createLibraryInstance(type, presetId);
    const index = libraryAt ?? currentSections.length;
    dispatch({ type: "addSection", index, section: instance, page });
    setLibraryAt(null);
    setSelected(instance.uid);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-section-uid="${instance.uid}"]`);
      if (el) {
        gsap.fromTo(el, { opacity: 0.15, scale: 0.975 }, { opacity: 1, scale: 1, duration: 0.55, ease: "power3.out" });
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryAt, currentSections.length, page]);

  // Undo/Redo — Buttons + Tastatur (Ctrl/Cmd+Z, Shift für Redo).
  // In der Fast-Vollbild-Vorschau (reine Ansicht) bewusst AUS — sonst würde
  // Ctrl+Z das Dokument dort unsichtbar mutieren.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (fullPreviewOpen || aiBusy) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      // Native Undo/Redo in Eingabefeldern UND während der Inline-Text-
      // Bearbeitung (contentEditable) nicht durch Dokument-Undo verdrängen.
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if (e.key.toLowerCase() === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullPreviewOpen, aiBusy]);

  // Sanfter Einstieg des Editor-Shells (GSAP statt Layout-Sprung).
  useEffect(() => {
    if (doc.productId && shellRef.current) {
      gsap.fromTo(shellRef.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" });
    }
  }, [doc.productId]);

  async function handleDownload() {
    if (!doc.productId || building) return;
    setBuilding(true);
    setMsg(null);
    try {
      const res = await fetch("/api/theme-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ document: doc satisfies ThemeDocument, designCode: activeDesign?.code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const text = res.status === 402 ? data?.error || t.themes.builderNotEnough : data?.error || t.themes.builderErr;
        setMsg({ kind: "err", text });
        return;
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      const cd = res.headers.get("Content-Disposition") || "";
      const fileMatch = cd.match(/filename="(.+?)"/);
      a.download = fileMatch ? fileMatch[1] : "theme.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      setMsg({ kind: "ok", text: t.themes.builderDone });
    } catch {
      setMsg({ kind: "err", text: t.themes.builderErr });
    } finally {
      setBuilding(false);
    }
  }

  // Design live in den Shop pushen (gleicher Sync-Code, kein neues ZIP).
  async function handleSyncUpdate() {
    if (!doc.productId || syncing) return;
    setSyncing(true);
    setMsg(null);
    try {
      const res = await fetch("/api/buybox/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ document: doc satisfies ThemeDocument, code: activeDesign?.code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg({ kind: "ok", text: t.themes.editorSyncUpdated });
      } else if (res.status === 404 && data?.needsExport) {
        setMsg({ kind: "err", text: t.themes.editorSyncNeedsDownload });
      } else {
        setMsg({ kind: "err", text: data?.error || t.themes.builderErr });
      }
    } catch {
      setMsg({ kind: "err", text: t.themes.builderErr });
    } finally {
      setSyncing(false);
    }
  }

  // ── Eigene Produkte: Bild hochladen, anlegen, entfernen ──
  const uploadCustomImage = useCallback(async (file: File | null | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    setCustomUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (res.ok && typeof d?.url === "string") {
        setCustomForm((f) => ({ ...f, bildUrl: d.url as string }));
      } else {
        setMsg({ kind: "err", text: d?.error || t.themes.builderErr });
      }
    } catch {
      setMsg({ kind: "err", text: t.themes.builderErr });
    } finally {
      setCustomUploading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.themes.builderErr]);

  async function handleCreateCustom() {
    if (customSaving) return;
    setCustomSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/custom-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(customForm),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d?.product?.id) {
        setMsg({ kind: "err", text: d?.error || t.themes.builderErr });
        return;
      }
      setCustomProducts(Array.isArray(d.products) ? (d.products as CustomProductLite[]) : [d.product, ...customProducts]);
      setCustomOpen(false);
      setCustomForm({ titel: "", preis: "", beschreibung: "", bildUrl: "" });
      pickProduct(d.product.id as string);
    } catch {
      setMsg({ kind: "err", text: t.themes.builderErr });
    } finally {
      setCustomSaving(false);
    }
  }

  async function handleDeleteCustom(id: string) {
    if (id === doc.productId) return; // aktives Produkt nicht entfernen
    try {
      const res = await fetch(`/api/custom-products?id=${encodeURIComponent(id)}`, { method: "DELETE", cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setCustomProducts(Array.isArray(d.products) ? (d.products as CustomProductLite[]) : customProducts.filter((p) => p.id !== id));
      }
    } catch {
      /* Anzeige bleibt — nächster Reload räumt auf */
    }
  }

  const activeProduct = useMemo(() => {
    const drawn = (products || []).find((p) => p.id === doc.productId);
    if (drawn) return drawn;
    const custom = customProducts.find((p) => p.id === doc.productId);
    return custom ? { id: custom.id, titel: custom.titel || t.themes.editorCustomUntitled, bildUrl: custom.bildUrl } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, customProducts, doc.productId]);
  const sectionLabel = (type: string) => {
    const def = getSectionDef(type);
    return def ? (lang === "en" ? def.labelEn : def.label) : type;
  };
  const presetLabel = (type: string, presetId: string) => {
    const def = getSectionDef(type);
    const p = def?.presets.find((x) => x.id === presetId) || def?.presets[0];
    return p ? (lang === "en" ? p.labelEn : p.label) : "";
  };
  // Fokus-Chips (Sections ODER Kaufbox) für den AI Co-Pilot + die aktuell
  // ausgewählte, noch nicht fokussierte Section/Kaufbox (Schnell-Fokus).
  const secTypeByUid = new Map([...doc.sections, ...(doc.home || [])].map((s) => [s.uid, s.type]));
  const focusLabel = (uid: string): string | null =>
    uid === "__buybox" ? t.themes.editorBuybox : secTypeByUid.has(uid) ? sectionLabel(secTypeByUid.get(uid)!) : null;
  const focusChips = aiFocus.map((u) => ({ uid: u, label: focusLabel(u) })).filter((c): c is { uid: string; label: string } => c.label !== null);
  const selectedFocusUid = selected && (selected === "__buybox" || secTypeByUid.has(selected)) ? selected : null;
  const selectedFocusable =
    selectedFocusUid && !aiFocus.includes(selectedFocusUid)
      ? { uid: selectedFocusUid, label: focusLabel(selectedFocusUid)! }
      : null;
  // Icon je Section-Kategorie (für die Aufbau-Karten).
  const CAT_ICON: Record<string, LucideIcon> = {
    conversion: ShoppingCart, social: Star, content: AlignLeft, media: ImageIcon, info: Info,
  };
  const sectionIcon = (type: string): LucideIcon => CAT_ICON[getSectionDef(type)?.category || "info"] || Info;

  // ── Schritt 1: Produkt wählen (Bilder-Grid) ──
  const showPicker = !doc.productId || pickerOpen;

  return (
    <>
      {/* Globales Menü NUR beim Produkt-Picker (noch kein Produkt). Im Editor
          ist es ausgeblendet — die dünne Editor-Toolbar sitzt ganz oben. */}
      {!doc.productId && <Navigation />}
      <main className={`min-h-screen bg-mesh font-sf ${showPicker ? "" : "lg:min-h-0"}`}>
        {/* Im Editor-Modus (Desktop) wird die Seite zur App-Shell: exakt Viewport-
            Höhe, nichts scrollt außen — Leisten & Vorschau scrollen INTERN und
            reichen dadurch immer bis ganz unten. Mobil: normaler Fluss + Platz
            für die untere Navigations-Leiste. */}
        <div className={`mx-auto px-3 sm:px-5 lg:px-7 py-4 sm:py-6 max-w-5xl lg:max-w-none xl:max-w-[1840px] ${
          showPicker ? "pb-24 md:pb-6" : "pb-6 lg:h-screen lg:flex lg:flex-col lg:overflow-hidden lg:py-2"
        }`}>

          {/* ── Top-Bar (edle Glas-Toolbar) ──
              Desktop: EINE Zeile, die nie umbricht (Labels blenden stufenweise
              aus, Produkt-Chip schrumpft). Mobil: zwei feste, aufgeräumte
              Reihen — Reihe 1 Navigation/Undo, Reihe 2 Aktionen (scrollt
              horizontal statt untereinander zu stapeln). */}
          <div className="glass-strong rounded-xl border border-white/[0.08] px-2 py-1.5 lg:py-[3px] mb-2 lg:mb-1.5 shrink-0">

            {/* Desktop-Zeile — bewusst SEHR DÜNN (schmale Paddings/Fonts), damit
                die Leiste ganz oben nur eine feine Zeile bildet. */}
            <div className="hidden lg:flex items-center gap-1.5 flex-nowrap min-w-0">
              <button
                onClick={() => router.push("/themes")}
                title={t.themes.editorBack}
                className="shrink-0 flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11.5px] font-semibold text-zinc-300 hover:text-white transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <div className="shrink-0 flex items-center gap-1.5 text-[12px] font-bold text-white">
                <Sparkles className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                <span className="hidden xl:inline">{t.themes.editorTitle}</span>
              </div>

              {activeProduct && (
                <button
                  onClick={() => setPickerOpen(true)}
                  className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] pl-1 pr-2 py-1 hover:border-[#95BF47]/40 transition min-w-0 shrink"
                  title={t.themes.editorChangeProduct}
                >
                  {activeProduct.bildUrl
                    ? <img src={activeProduct.bildUrl} alt="" className="w-5.5 h-5.5 rounded object-cover shrink-0" />
                    : <span className="w-5.5 h-5.5 rounded bg-white/[0.06] shrink-0" />}
                  <span className="text-[11.5px] font-medium text-white truncate max-w-[220px]">{activeProduct.titel}</span>
                  <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" />
                </button>
              )}

              <div className="flex items-center gap-1.5 ml-auto shrink-0">
                {/* Credits — im Editor sichtbar, da das globale Menü aus ist */}
                <a
                  href="/credits"
                  title={`${isAdmin ? "∞" : credits.loading ? "…" : credits.balance} Credits`}
                  className="shrink-0 inline-flex items-center gap-1 rounded-md border border-[#95BF47]/25 bg-[#95BF47]/[0.06] px-2 py-1 text-[11.5px] font-bold text-[#cfe9a3] hover:text-white hover:bg-[#95BF47]/15 transition"
                >
                  <span className="text-[12px] leading-none">{credits.creditIcon}</span>
                  <span className="tabular-nums">{isAdmin ? "∞" : credits.loading ? "…" : credits.balance}</span>
                </a>
                {/* Gesamt-Stil jederzeit änderbar */}
                {doc.productId && (
                  <button
                    onClick={() => setStyleOpen(true)}
                    disabled={aiBusy}
                    title={t.themes.editorStyleGallery}
                    className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11.5px] font-semibold text-zinc-300 hover:text-white hover:border-[#95BF47]/40 transition disabled:opacity-40"
                  >
                    <Palette className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                    <span className="hidden xl:inline">{t.themes.editorStyleGallery}</span>
                  </button>
                )}
                {/* Design-Speicherstände (mit Sync-Codes) */}
                {doc.productId && (
                  <button
                    onClick={() => setDesignsOpen(true)}
                    disabled={aiBusy}
                    title={t.themes.editorDesigns}
                    className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11.5px] font-semibold text-zinc-300 hover:text-white hover:border-[#95BF47]/40 transition disabled:opacity-40"
                  >
                    <Bookmark className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                    <span className="hidden xl:inline">{t.themes.editorDesigns}</span>
                    {activeDesign && <span className="text-[10px] text-zinc-500 hidden 2xl:inline truncate max-w-[100px]">· {activeDesign.name}</span>}
                  </button>
                )}
                {/* Undo / Redo */}
                <div className="inline-flex rounded-md border border-white/10 bg-white/[0.03] p-0.5">
                  <button
                    onClick={() => dispatch({ type: "undo" })}
                    disabled={!state.past.length || aiBusy}
                    title={`${t.themes.editorUndo} (Ctrl+Z)`}
                    className="px-1.5 py-1 rounded text-zinc-300 hover:text-white disabled:opacity-25 transition"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => dispatch({ type: "redo" })}
                    disabled={!state.future.length || aiBusy}
                    title={`${t.themes.editorRedo} (Ctrl+Shift+Z)`}
                    className="px-1.5 py-1 rounded text-zinc-300 hover:text-white disabled:opacity-25 transition"
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  onClick={handleDownload}
                  disabled={building || !doc.productId || aiBusy}
                  title={cost !== null && cost > 0 ? t.themes.editorFreeNote.replace("{n}", String(cost)) : undefined}
                  className="btn-deploy flex items-center gap-1.5 px-3 py-1 text-[12px] disabled:opacity-50 whitespace-nowrap"
                >
                  {building ? <Sparkles className="w-3.5 h-3.5 animate-pulse" /> : <Download className="w-3.5 h-3.5" />}
                  <span>{building ? t.themes.builderBuilding : "Download"}</span>
                </button>
                {/* Design live in installierte Shops pushen (Sync-Code, kostenlos) */}
                <button
                  onClick={handleSyncUpdate}
                  disabled={syncing || !doc.productId || aiBusy}
                  title={t.themes.editorSyncHint}
                  className="flex items-center gap-1.5 rounded-md border border-[#95BF47]/40 bg-[#95BF47]/10 px-2.5 py-1 text-[11.5px] font-semibold text-[#cfe9a3] hover:text-white hover:bg-[#95BF47]/20 disabled:opacity-50 transition whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                  <span className="hidden xl:inline">{t.themes.editorSyncUpdate}</span>
                </button>
              </div>
            </div>

            {/* Mobil/Tablet: 2 Reihen */}
            <div className="lg:hidden space-y-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => router.push("/themes")}
                  title={t.themes.editorBack}
                  className="shrink-0 flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] w-9 h-9 text-zinc-300 hover:text-white transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                {activeProduct ? (
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="flex-1 min-w-0 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] pl-1.5 pr-2 py-1.5 hover:border-[#95BF47]/40 transition"
                    title={t.themes.editorChangeProduct}
                  >
                    {activeProduct.bildUrl
                      ? <img src={activeProduct.bildUrl} alt="" className="w-6 h-6 rounded-md object-cover shrink-0" />
                      : <span className="w-6 h-6 rounded-md bg-white/[0.06] shrink-0" />}
                    <span className="text-[12px] font-medium text-white truncate min-w-0 flex-1 text-left">{activeProduct.titel}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  </button>
                ) : (
                  <div className="flex-1 min-w-0 flex items-center gap-1.5 text-[13px] font-bold text-white">
                    <Sparkles className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />
                    <span className="truncate">{t.themes.editorTitle}</span>
                  </div>
                )}
                <a
                  href="/credits"
                  title={`${isAdmin ? "∞" : credits.loading ? "…" : credits.balance} Credits`}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-[#95BF47]/25 bg-[#95BF47]/[0.06] px-2 py-1.5 text-[12px] font-bold text-[#cfe9a3]"
                >
                  <span className="leading-none">{credits.creditIcon}</span>
                  <span className="tabular-nums">{isAdmin ? "∞" : credits.loading ? "…" : credits.balance}</span>
                </a>
                <div className="shrink-0 inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
                  <button
                    onClick={() => dispatch({ type: "undo" })}
                    disabled={!state.past.length || aiBusy}
                    title={t.themes.editorUndo}
                    className="px-2.5 py-1.5 rounded-md text-zinc-300 hover:text-white disabled:opacity-25 transition"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => dispatch({ type: "redo" })}
                    disabled={!state.future.length || aiBusy}
                    title={t.themes.editorRedo}
                    className="px-2.5 py-1.5 rounded-md text-zinc-300 hover:text-white disabled:opacity-25 transition"
                  >
                    <Redo2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {doc.productId && (
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    <button
                      onClick={() => setStyleOpen(true)}
                      disabled={aiBusy}
                      className="shrink-0 flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-zinc-300 hover:text-white transition whitespace-nowrap disabled:opacity-40"
                    >
                      <Palette className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                      {t.themes.editorStyleGallery}
                    </button>
                    <button
                      onClick={() => setDesignsOpen(true)}
                      disabled={aiBusy}
                      className="shrink-0 flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-zinc-300 hover:text-white transition whitespace-nowrap disabled:opacity-40"
                    >
                      <Bookmark className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                      {t.themes.editorDesigns}
                    </button>
                  </div>
                  <button
                    onClick={handleDownload}
                    disabled={building || aiBusy}
                    className="shrink-0 btn-deploy flex items-center gap-1.5 px-3 py-2 text-[12px] disabled:opacity-50 whitespace-nowrap"
                  >
                    {building ? <Sparkles className="w-4 h-4 animate-pulse" /> : <Download className="w-4 h-4" />}
                    <span>Download</span>
                  </button>
                  <button
                    onClick={handleSyncUpdate}
                    disabled={syncing || aiBusy}
                    title={t.themes.editorSyncUpdate}
                    className="shrink-0 self-stretch flex items-center justify-center rounded-lg border border-[#95BF47]/40 bg-[#95BF47]/10 w-10 text-[#cfe9a3] hover:text-white hover:bg-[#95BF47]/20 disabled:opacity-50 transition"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Kosten-Hinweis lebt jetzt platzsparend als Tooltip am Download-
              Button — nur echte Meldungen (ok/Fehler) bekommen eine Zeile. */}
          {msg && (
            <p className={`mb-2 text-[12px] shrink-0 ${msg.kind === "ok" ? "text-[#cfe9a3]" : "text-amber-300/90"}`}>{msg.text}</p>
          )}
          {!msg && cost !== null && cost > 0 && showPicker && (
            <p className="mb-3 text-[11.5px] text-zinc-500 shrink-0 text-center">{t.themes.editorFreeNote.replace("{n}", String(cost))}</p>
          )}

          {/* ── Schritt 1: Produkt-Bilder-Grid ── */}
          {showPicker ? (
            <div className="max-w-4xl mx-auto">
              <header className="text-center mb-6 mt-4 sm:mt-8">
                <div className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] font-semibold mb-2" style={{ color: ACCENT }}>
                  <ShoppingCart className="w-3 h-3" /> Schritt 1
                </div>
                <h1 className="text-[22px] sm:text-[30px] font-bold tracking-tight text-white font-sf-display">{t.themes.editorStepProduct}</h1>
                <p className="mt-1.5 text-[12.5px] sm:text-sm text-zinc-400 max-w-md mx-auto">{t.themes.editorStepProductSub}</p>
              </header>

              {products === null ? (
                <div className="glass-strong rounded-2xl border border-white/[0.08] p-10 text-center text-sm text-zinc-400">{t.themes.loading}</div>
              ) : products.length === 0 ? (
                <div className="glass-strong rounded-2xl border border-white/[0.08] p-10 text-center">
                  <Package className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
                  <p className="text-[13px] text-zinc-400 max-w-sm mx-auto">{t.themes.builderNoProducts}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {products.map((p, i) => (
                    <motion.button
                      key={p.id}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.35, ease: "easeOut" }}
                      onClick={() => pickProduct(p.id)}
                      className={`group text-left rounded-2xl border overflow-hidden transition ${
                        p.id === doc.productId
                          ? "border-[#95BF47]/70 bg-[#95BF47]/[0.07]"
                          : "border-white/[0.08] bg-white/[0.02] hover:border-[#95BF47]/40 hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="aspect-square bg-white/[0.04] overflow-hidden">
                        {p.bildUrl
                          ? <img src={p.bildUrl} alt="" className="w-full h-full object-cover group-hover:scale-[1.04] transition duration-300" />
                          : <div className="w-full h-full flex items-center justify-center"><Package className="w-7 h-7 text-zinc-600" /></div>}
                      </div>
                      <div className="p-2.5">
                        <div className="text-[12px] font-semibold text-white leading-snug line-clamp-2">{p.titel}</div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
              {/* ── Eigene Produkte: kein Katalog-Zwang, alles optional ── */}
              <div className="mt-9">
                <div className="flex items-center gap-2 mb-1">
                  <span className="h-3 w-[3px] rounded-full" style={{ background: ACCENT }} />
                  <h2 className="text-[15px] font-bold text-white">{t.themes.editorCustomHeading}</h2>
                </div>
                <p className="text-[11.5px] text-zinc-500 mb-3">{t.themes.editorCustomHint}</p>

                {customOpen && (
                  <div className="glass-strong rounded-2xl border border-white/[0.1] p-4 mb-3 max-w-2xl mx-auto">
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="w-4 h-4" style={{ color: ACCENT }} />
                      <span className="text-[13px] font-bold text-white flex-1">{t.themes.editorCustomCreate}</span>
                      <button onClick={() => setCustomOpen(false)} className="p-1 rounded text-zinc-400 hover:text-white transition" aria-label={t.themes.editorCustomCancel}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-3">
                      {/* Bild-Dropzone (optional) */}
                      <label
                        onDragOver={(e) => { e.preventDefault(); setCustomDrag(true); }}
                        onDragLeave={() => setCustomDrag(false)}
                        onDrop={(e) => { e.preventDefault(); setCustomDrag(false); uploadCustomImage(e.dataTransfer.files?.[0]); }}
                        className={`relative flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed aspect-square cursor-pointer overflow-hidden transition ${
                          customDrag ? "border-[#95BF47] bg-[#95BF47]/[0.1]" : "border-white/20 bg-white/[0.03] hover:border-[#95BF47]/50"
                        }`}
                      >
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { uploadCustomImage(e.target.files?.[0]); e.target.value = ""; }} />
                        {customForm.bildUrl ? (
                          <img src={customForm.bildUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <>
                            <UploadCloud className={`w-5 h-5 ${customUploading ? "animate-pulse" : ""} text-zinc-400`} />
                            <span className="text-[10px] text-zinc-500 text-center px-2 leading-snug">{t.themes.editorCustomImageDrop}</span>
                          </>
                        )}
                        {customUploading && <span className="absolute inset-0 bg-black/50 flex items-center justify-center text-[11px] text-white">…</span>}
                      </label>
                      <div className="space-y-2">
                        <input
                          value={customForm.titel}
                          onChange={(e) => setCustomForm((f) => ({ ...f, titel: e.target.value }))}
                          placeholder={t.themes.editorCustomName}
                          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder:text-zinc-600 focus:border-[#95BF47]/60 outline-none transition"
                        />
                        <input
                          value={customForm.preis}
                          onChange={(e) => setCustomForm((f) => ({ ...f, preis: e.target.value }))}
                          placeholder={t.themes.editorCustomPrice}
                          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder:text-zinc-600 focus:border-[#95BF47]/60 outline-none transition"
                        />
                        <textarea
                          value={customForm.beschreibung}
                          onChange={(e) => setCustomForm((f) => ({ ...f, beschreibung: e.target.value }))}
                          placeholder={t.themes.editorCustomDesc}
                          rows={3}
                          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder:text-zinc-600 focus:border-[#95BF47]/60 outline-none transition resize-none"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-3">
                      <button onClick={() => setCustomOpen(false)} className="rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[12px] font-semibold text-zinc-300 hover:text-white transition">
                        {t.themes.editorCustomCancel}
                      </button>
                      <button
                        onClick={handleCreateCustom}
                        disabled={customSaving || customUploading}
                        className="btn-deploy flex items-center gap-1.5 px-4 py-2 text-[12.5px] disabled:opacity-50"
                      >
                        {customSaving ? <Sparkles className="w-3.5 h-3.5 animate-pulse" /> : <Plus className="w-3.5 h-3.5" />}
                        {t.themes.editorCustomSave}
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {!customOpen && (
                    <button
                      onClick={() => setCustomOpen(true)}
                      className="rounded-2xl border border-dashed border-[#95BF47]/40 bg-[#95BF47]/[0.05] hover:bg-[#95BF47]/[0.12] transition flex flex-col items-center justify-center gap-2 min-h-[160px] aspect-square sm:aspect-auto"
                    >
                      <Plus className="w-6 h-6" style={{ color: ACCENT }} />
                      <span className="text-[12px] font-semibold text-[#cfe9a3] text-center px-3 leading-snug">{t.themes.editorCustomCreate}</span>
                    </button>
                  )}
                  {customProducts.map((p) => {
                    const isActive = p.id === doc.productId;
                    return (
                      <div
                        key={p.id}
                        className={`group relative text-left rounded-2xl border overflow-hidden transition cursor-pointer ${
                          isActive
                            ? "border-[#95BF47]/70 bg-[#95BF47]/[0.07]"
                            : "border-white/[0.08] bg-white/[0.02] hover:border-[#95BF47]/40 hover:bg-white/[0.05]"
                        }`}
                        onClick={() => pickProduct(p.id)}
                      >
                        <div className="aspect-square bg-white/[0.04] overflow-hidden">
                          {p.bildUrl
                            ? <img src={p.bildUrl} alt="" className="w-full h-full object-cover group-hover:scale-[1.04] transition duration-300" />
                            : <div className="w-full h-full flex items-center justify-center"><Package className="w-7 h-7 text-zinc-600" /></div>}
                        </div>
                        <span className="absolute top-2 left-2 rounded-full bg-black/55 backdrop-blur px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#cfe9a3]">
                          {t.themes.editorCustomBadge}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteCustom(p.id); }}
                          disabled={isActive}
                          title={isActive ? t.themes.editorCustomActiveHint : t.themes.editorCustomDeleteHint}
                          className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-black/55 backdrop-blur text-zinc-300 hover:text-red-300 disabled:opacity-30 flex items-center justify-center transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="p-2.5">
                          <div className="text-[12px] font-semibold text-white leading-snug line-clamp-2">{p.titel || t.themes.editorCustomUntitled}</div>
                          {p.preis && <div className="text-[10.5px] text-zinc-500 mt-0.5">{p.preis}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {doc.productId && (
                <div className="text-center mt-5">
                  <button onClick={() => setPickerOpen(false)} className="text-[12px] text-zinc-400 hover:text-white underline underline-offset-4 transition">
                    {lang === "en" ? "Keep current product" : "Aktuelles Produkt behalten"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ── Split-Pane-Editor ── */
            /* Rechte Leiste bewusst schmal (300/316px) — der gewonnene Platz
               geht komplett an die Live-Vorschau in der Mitte. */
            <div ref={shellRef} className="flex flex-col lg:grid lg:grid-cols-[300px_minmax(0,1fr)_300px] xl:grid-cols-[320px_minmax(0,1fr)_316px] lg:grid-rows-[minmax(0,1fr)] lg:gap-4 lg:items-stretch lg:flex-1 lg:min-h-0">

              {/* Mobil: sticky 3-Tab-Leiste (Vorschau · Aufbau · Einstellungen) —
                  klebt unter der App-Navigation, damit man jederzeit umschalten
                  kann, ohne nach oben zu scrollen. */}
              <div className="order-1 lg:hidden sticky top-0 z-30 pt-1.5 pb-2.5 mb-1">
                <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 glass-strong p-1 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)]">
                  {([
                    ["vorschau", t.themes.editorTabPreview, Eye],
                    ["aufbau", t.themes.editorTabStructure, Layers],
                    ["einstellungen", t.themes.editorSettings, SlidersHorizontal],
                  ] as const).map(([tab, label, Ico]) => (
                    <button
                      key={tab}
                      onClick={() => setMobileTab(tab)}
                      className={`flex items-center justify-center gap-1.5 px-1 py-2.5 rounded-lg text-[12px] font-semibold transition ${mobileTab === tab ? "bg-[#95BF47] text-[#0a0a0a]" : "text-zinc-300 hover:text-white"}`}
                    >
                      <Ico className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Aufbau/Navigation (links) — Desktop: volle Höhe bis ganz unten,
                  scrollt intern. Sektionsliste + Kaufbox-Dropdown; während der
                  AI-Umsetzung gesperrt. Der AI Co-Pilot sitzt jetzt als Leiste
                  MITTIG unter der Vorschau (nicht mehr hier). */}
              <aside className={`order-3 lg:order-1 mb-4 lg:mb-0 lg:h-full lg:min-h-0 ${mobileTab === "aufbau" ? "" : "hidden"} lg:flex lg:flex-col`}>
                <div className={`glass-strong rounded-xl border border-white/[0.08] p-2.5 lg:flex-1 lg:min-h-0 lg:overflow-y-auto ${aiBusy ? "pointer-events-none opacity-60" : ""}`}>
                  {/* Allgemeines Design (global) — kein „Sektion", aber zentral
                      erreichbar; ohne Auswahl bleibt links alles leer. */}
                  <button
                    onClick={() => setSelected(selected === "__global" ? null : "__global")}
                    className={`w-full flex items-center gap-1.5 rounded-md border px-2 py-2 lg:py-1.5 mb-2 transition ${
                      selected === "__global"
                        ? "border-[#95BF47]/50 bg-[#95BF47]/[0.12]"
                        : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}
                  >
                    <Palette className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT }} />
                    <span className="text-[12.5px] lg:text-[12px] font-semibold text-white flex-1 text-left truncate">{t.themes.editorGlobalEntry}</span>
                  </button>

                  {/* Seiten-Umschalter: Produktseite ↔ Startseite (kompakt) */}
                  <div className="flex rounded-md border border-white/10 bg-black/25 p-0.5 mb-2">
                    {([["product", t.themes.builderPageProduct], ["home", t.themes.builderPageHome]] as const).map(([p, l]) => (
                      <button
                        key={p}
                        onClick={() => { setPage(p); setSelected(null); }}
                        className={`flex-1 px-2 py-2 lg:py-1 rounded text-[12px] lg:text-[11px] font-semibold transition ${page === p ? "bg-[#95BF47] text-[#0a0a0a]" : "text-zinc-400 hover:text-white"}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
                    <span className="h-2.5 w-[3px] rounded-full" style={{ background: ACCENT }} />
                    <span className="text-[9.5px] uppercase tracking-[0.14em] font-bold text-zinc-400">{t.themes.editorStructure}</span>
                  </div>

                  {/* Kaufbox als DROPDOWN: Kopf wählt die Kaufbox (Panel links),
                      Chevron klappt die Bausteinliste auf/zu. */}
                  {page === "product" && (() => {
                    const bbOpen = buyboxOpen || selected === "__buybox" || (selected?.startsWith("blk:") ?? false);
                    return (
                    <div className="mb-1">
                      <div
                        className={`w-full flex items-center gap-1 rounded-md border px-2 py-2.5 lg:py-1.5 transition ${
                          selected === "__buybox" || selected?.startsWith("blk:")
                            ? "border-[#95BF47]/50 bg-[#95BF47]/[0.12]"
                            : aiFocus.includes("__buybox")
                              ? "border-amber-400/40 bg-amber-400/[0.06]"
                              : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]"
                        }`}
                      >
                        <button
                          onClick={() => setBuyboxOpen(!bbOpen)}
                          className="shrink-0 p-0.5 -m-0.5 text-zinc-400 hover:text-white"
                          title={t.themes.editorBuyboxToggle}
                          aria-label={t.themes.editorBuyboxToggle}
                          aria-expanded={bbOpen}
                        >
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${bbOpen ? "" : "-rotate-90"}`} />
                        </button>
                        <ShoppingCart className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT }} />
                        <button
                          onClick={() => { setSelected("__buybox"); setBuyboxOpen(true); }}
                          className="text-[13px] lg:text-[12px] font-semibold text-white flex-1 text-left truncate"
                        >
                          {t.themes.editorBuybox}
                        </button>
                        <span className="text-[9.5px] text-zinc-500 shrink-0">{doc.buybox.order.length}</span>
                        <button
                          onClick={() => toggleFocus("__buybox")}
                          title={t.themes.editorFocusHint}
                          aria-pressed={aiFocus.includes("__buybox")}
                          className={`shrink-0 p-1 rounded transition ${aiFocus.includes("__buybox") ? "text-amber-400" : "text-zinc-600 hover:text-amber-300"}`}
                        >
                          <Target className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {bbOpen && (
                        <div className="mt-1 ml-2 pl-2 border-l border-white/10">
                          <Reorder.Group
                            axis="y"
                            values={doc.buybox.order}
                            onReorder={(order) => dispatch({ type: "reorderBuybox", order })}
                            className="space-y-1"
                          >
                            {doc.buybox.order.map((bt) => {
                              const meta = getBuyboxMeta(bt);
                              return (
                                <BuyboxNavRow
                                  key={bt}
                                  type={bt}
                                  name={lang === "en" ? meta.labelEn : meta.label}
                                  iconName={meta.icon}
                                  on={selected === `blk:${bt}`}
                                  onClick={() => setSelected(selected === `blk:${bt}` ? "__buybox" : `blk:${bt}`)}
                                  onRemove={() => { dispatch({ type: "removeBuyboxBlock", blockType: bt }); if (selected === `blk:${bt}`) setSelected("__buybox"); }}
                                  dragTitle={t.themes.editorBuyboxDragHint}
                                  removeLabel={t.themes.editorBuyboxRemove}
                                />
                              );
                            })}
                          </Reorder.Group>
                          <div className="grid grid-cols-2 gap-1 mt-1">
                            <button
                              onClick={() => setBuyboxGalleryOpen(true)}
                              className="flex items-center justify-center gap-1 rounded-md border border-[#95BF47]/40 bg-[#95BF47]/[0.08] text-[#cfe9a3] hover:text-white hover:bg-[#95BF47]/[0.16] text-[11px] font-semibold px-1.5 py-1.5 transition"
                            >
                              <Plus className="w-3 h-3" /> {t.themes.editorBuyboxAdd}
                            </button>
                            <button
                              onClick={() => dispatch({ type: "arrangeBuybox", canonical: BUYBOX_CANONICAL_ORDER })}
                              title={t.themes.editorBuyboxArrangeHint}
                              className="flex items-center justify-center gap-1 rounded-md border border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white hover:bg-white/[0.08] text-[11px] font-semibold px-1.5 py-1.5 transition"
                            >
                              <ArrowDownUp className="w-3 h-3" /> {t.themes.editorBuyboxArrange}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  })()}

                  {/* Sektionsliste (Produkt- oder Startseite) */}
                  <Reorder.Group
                    axis="y"
                    values={currentSections.map((s) => s.uid)}
                    onReorder={(order) => dispatch({ type: "reorderSections", page, order })}
                    className="space-y-1"
                  >
                    {currentSections.map((s) => {
                      const Ico = sectionIcon(s.type);
                      const on = selected === s.uid;
                      return (
                        <RailSectionRow
                          key={s.uid}
                          uid={s.uid}
                          Ico={Ico}
                          name={sectionLabel(s.type)}
                          presetText={presetLabel(s.type, s.presetId)}
                          on={on}
                          onClick={() => setSelected(on ? null : s.uid)}
                          dragTitle={t.themes.editorBuyboxDragHint}
                          focused={aiFocus.includes(s.uid)}
                          onToggleFocus={() => toggleFocus(s.uid)}
                          focusTitle={t.themes.editorFocusHint}
                        />
                      );
                    })}
                  </Reorder.Group>
                  {currentSections.length === 0 && (
                    <p className="text-[10.5px] text-zinc-500 text-center py-2.5 px-2">{t.themes.editorRailEmpty}</p>
                  )}
                  <button
                    onClick={() => setLibraryAt(currentSections.length)}
                    className="w-full mt-1.5 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-[#95BF47]/40 bg-[#95BF47]/[0.06] text-[#cfe9a3] hover:text-white hover:bg-[#95BF47]/[0.14] text-[12.5px] lg:text-[11.5px] font-semibold px-3 py-2.5 lg:py-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> {t.themes.editorAddSection}
                  </button>
                </div>
              </aside>

              {/* Live-Vorschau (Mitte) — mit eigener Toolbar: PC/Handy-Umschalter
                  + Zoom-Regler. Desktop: volle Höhe, Vorschau scrollt intern. */}
              <div className={`order-2 mb-4 lg:mb-0 lg:h-full lg:min-h-0 ${mobileTab === "vorschau" ? "" : "hidden"} lg:flex lg:flex-col`}>
                <div className="glass-strong rounded-lg border border-white/[0.08] px-1.5 py-1 mb-2 flex items-center gap-1.5 shrink-0">
                  {/* PC / Handy */}
                  <div className="inline-flex rounded-md border border-white/10 bg-white/[0.03] p-0.5 shrink-0">
                    <button
                      onClick={() => setViewMode("desktop")}
                      title={t.themes.builderViewDesktop}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[10.5px] font-medium transition ${viewMode === "desktop" ? "bg-white/12 text-white" : "text-zinc-400 hover:text-white"}`}
                    >
                      <Monitor className="w-3 h-3" /> <span className="hidden xl:inline">{t.themes.builderViewDesktop}</span>
                    </button>
                    <button
                      onClick={() => setViewMode("mobile")}
                      title={t.themes.builderViewMobile}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[10.5px] font-medium transition ${viewMode === "mobile" ? "bg-white/12 text-white" : "text-zinc-400 hover:text-white"}`}
                    >
                      <Smartphone className="w-3 h-3" /> <span className="hidden xl:inline">{t.themes.builderViewMobile}</span>
                    </button>
                  </div>
                  {/* Fast-Vollbild-Vorschau */}
                  <button
                    onClick={() => setFullPreviewOpen(true)}
                    title={t.themes.editorFullPreviewHint}
                    className="shrink-0 flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10.5px] font-semibold text-zinc-300 hover:text-white hover:border-[#95BF47]/40 transition"
                  >
                    <Maximize2 className="w-3 h-3" style={{ color: ACCENT }} />
                    <span className="hidden xl:inline">{t.themes.editorFullPreview}</span>
                  </button>
                  {/* Inline-Text-Bearbeitung an/aus */}
                  <button
                    onClick={() => setEditTexts((v) => !v)}
                    title={t.themes.editorEditTextsHint}
                    aria-pressed={editTexts}
                    className={`shrink-0 flex items-center gap-1 rounded-md border px-2 py-1 text-[10.5px] font-semibold transition ${
                      editTexts
                        ? "border-[#95BF47]/60 bg-[#95BF47]/10 text-white"
                        : "border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Pencil className="w-3 h-3" style={editTexts ? { color: ACCENT } : undefined} />
                    <span className="hidden xl:inline">{t.themes.editorEditTexts}</span>
                  </button>
                  {/* Zoom-Regler — der Slider ist das EINZIGE flexible Element
                      der Zeile (flex-1 + min-w), damit die Toolbar auch in der
                      schmalen lg-Spalte (~272px) nie überläuft. */}
                  <div className="flex items-center gap-1 ml-auto flex-1 min-w-0 justify-end" title={t.themes.editorZoom}>
                    <button
                      onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
                      disabled={zoom <= 0.5}
                      className="shrink-0 p-1 rounded text-zinc-400 hover:text-white disabled:opacity-25 transition"
                      aria-label={`${t.themes.editorZoom} −`}
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="range"
                      min={50}
                      max={200}
                      step={5}
                      value={Math.round(zoom * 100)}
                      onChange={(e) => setZoom(Number(e.target.value) / 100)}
                      className="flex-1 min-w-[36px] max-w-[170px] accent-[#95BF47] cursor-pointer"
                      aria-label={t.themes.editorZoom}
                    />
                    <button
                      onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10))}
                      disabled={zoom >= 2}
                      className="shrink-0 p-1 rounded text-zinc-400 hover:text-white disabled:opacity-25 transition"
                      aria-label={`${t.themes.editorZoom} +`}
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setZoom(1)}
                      title={t.themes.editorZoomReset}
                      className="shrink-0 w-[38px] text-right text-[10.5px] font-semibold tabular-nums text-zinc-300 hover:text-white transition"
                    >
                      {Math.round(zoom * 100)}%
                    </button>
                  </div>
                </div>
                <div className={`lg:flex-1 lg:min-h-0 lg:overflow-y-auto ${aiBusy ? "pointer-events-none" : ""}`} onClick={() => setSelected(null)}>
                  <ThemePreview
                    data={previewData}
                    colors={doc.global.colors}
                    headingFont={doc.global.headingFont}
                    bodyFont={doc.global.bodyFont}
                    radius={doc.global.radius}
                    loading={previewLoading}
                    label={page === "home" ? t.themes.builderPageHome : t.themes.builderPageProduct}
                    viewMode={viewMode}
                    zoom={zoom}
                    buyboxOrder={doc.buybox.order}
                    hiddenBlocks={doc.buybox.hidden}
                    shadow={doc.global.design.shadow}
                    border={doc.global.design.border}
                    iconStyle={doc.global.design.iconStyle}
                    benefitIcons={doc.buybox.benefitIcons}
                    buyboxCfg={doc.buybox.blocks}
                    gallery={doc.buybox.gallery}
                    spacing={doc.buybox.spacing}
                    docSections={currentSections}
                    page={page}
                    selectedUid={selected}
                    onSelectSection={(uid) => setSelected(uid)}
                    onInsertAt={(i) => setLibraryAt(i)}
                    editTexts={editTexts && !aiBusy}
                    onEditText={handleEditText}
                    onEditBlockText={handleEditBlockText}
                    focusUids={aiFocus}
                    focusPick={focusPick && !aiBusy}
                    onToggleFocus={toggleFocus}
                  />
                </div>
                {/* AI Co-Pilot — längliche Command-Leiste MITTIG unter der Vorschau */}
                <div className="mt-2 shrink-0">
                  <AiCopilot
                    doc={doc}
                    dispatch={dispatch}
                    baseSections={baseSections}
                    capabilities={capabilities}
                    homeSections={homeSections}
                    productTitle={activeProduct?.titel}
                    onBusyChange={setAiBusy}
                    focus={focusChips}
                    onRemoveFocus={toggleFocus}
                    onSelectFocus={(uid) => setSelected(uid)}
                    selectedFocusable={selectedFocusable}
                    onFocusSelected={() => selectedFocusable && toggleFocus(selectedFocusable.uid)}
                    focusPick={focusPick}
                    onToggleFocusPick={() => setFocusPick((v) => !v)}
                    onClearFocus={() => setAiFocus([])}
                  />
                </div>
              </div>

              {/* Inspector/Einstellungen (rechts) — Desktop: volle Höhe bis ganz unten, scrollt intern */}
              <aside ref={inspectorRef} className={`order-4 lg:order-3 scroll-mt-28 lg:h-full lg:min-h-0 ${mobileTab === "einstellungen" ? "" : "hidden"} lg:flex lg:flex-col ${aiBusy ? "pointer-events-none opacity-60" : ""}`}>
                <div className="glass-strong rounded-xl border border-white/[0.08] p-2.5 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
                  <Inspector
                    doc={doc}
                    dispatch={dispatch}
                    selected={selected}
                    onClearSelect={() => setSelected(null)}
                    onOpenStyles={() => setStyleOpen(true)}
                    onRandomize={randomize}
                    previewData={previewData}
                  />
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>

      {/* Design-Speicherstände — Codes immer sichtbar, Design-Wechsel per Code */}
      {doc.productId && (
        <DesignsOverlay
          open={designsOpen}
          onClose={() => setDesignsOpen(false)}
          productId={doc.productId}
          doc={doc}
          activeCode={activeDesign?.code || null}
          lang={lang}
          onLoaded={(loadedDoc, code, name) => {
            dispatch({ type: "replace", doc: loadedDoc });
            setActiveDesign({ code, name });
            setSelected(null);
            setMsg({ kind: "ok", text: `${t.themes.editorDesignLoaded} „${name}"` });
          }}
          onSaved={(code, name) => {
            setActiveDesign({ code, name });
            setMsg({ kind: "ok", text: t.themes.editorDesignSaved.replace("{c}", code) });
          }}
          t={{
            title: t.themes.editorDesigns,
            subtitle: t.themes.editorDesignsSub,
            saveNew: t.themes.editorDesignSaveNew,
            namePlaceholder: t.themes.editorDesignName,
            load: t.themes.editorDesignLoad,
            update: t.themes.editorDesignUpdate,
            codeHint: t.themes.editorDesignCodeHint,
            empty: t.themes.editorDesignsEmpty,
            saved: t.themes.editorDesignCopied,
          }}
        />
      )}

      {/* Fast-Vollbild-Vorschau — Website groß ansehen, ohne zu bearbeiten */}
      {previewData && (
        <FullPreviewOverlay
          open={fullPreviewOpen}
          onClose={() => setFullPreviewOpen(false)}
          data={previewData}
          doc={doc}
          sections={currentSections}
          page={page}
          label={page === "home" ? t.themes.builderPageHome : t.themes.builderPageProduct}
          initialViewMode={viewMode}
          viewDesktop={t.themes.builderViewDesktop}
          viewMobile={t.themes.builderViewMobile}
          zoomResetTitle={t.themes.editorZoomReset}
          zoomLabel={t.themes.editorZoom}
          closeLabel={t.themes.editorClose}
        />
      )}

      {/* Kaufbox-Baustein-Galerie — Baustein mit großer Vorschau hinzufügen */}
      {previewData && (
        <BuyboxGalleryOverlay
          open={buyboxGalleryOpen}
          onClose={() => setBuyboxGalleryOpen(false)}
          onAdd={(type, presetId) => {
            // Galerie bleibt offen — so lassen sich mehrere Bausteine
            // nacheinander hinzufügen. Feineinstellungen danach im Inspector.
            dispatch({ type: "addBuyboxBlock", blockType: type });
            if (presetId) dispatch({ type: "setBlockPreset", blockType: type, presetId });
            setSelected("__buybox");
          }}
          activeTypes={doc.buybox.order}
          previewData={previewData}
          global={doc.global}
          lang={lang}
          title={t.themes.editorBuyboxGalleryTitle}
          subtitle={t.themes.editorBuyboxGallerySub}
        />
      )}

      {/* Stil-Galerie — Gesamt-Stil jederzeit nachträglich änderbar */}
      {previewData && (
        <StyleGalleryOverlay
          open={styleOpen}
          onClose={() => setStyleOpen(false)}
          currentStyleId={doc.global.styleId}
          ctx={{ images: previewData.images, title: previewData.title, price: previewData.price }}
          onApply={applyStyle}
          title={t.themes.editorStyleGallery}
          modeDesign={t.themes.editorStyleModeDesign}
          modeDesignSub={t.themes.editorStyleModeDesignSub}
          modeFull={t.themes.editorStyleModeFull}
          modeFullSub={t.themes.editorStyleModeFullSub}
          applyLabel={t.themes.editorStyleApply}
          shuffleLabel={t.themes.editorStyleShuffle}
          shuffleSub={t.themes.editorStyleShuffleSub}
        />
      )}

      {/* Section-Bibliothek */}
      {previewData && (
        <SectionLibraryOverlay
          open={libraryAt !== null}
          onClose={() => setLibraryAt(null)}
          onInsert={insertSection}
          ctx={{ images: previewData.images, title: previewData.title, price: previewData.price, palette: doc.global.colors }}
          global={doc.global}
          lang={lang}
          capabilities={capabilities}
          title={t.themes.editorLibraryTitle}
          subtitle={t.themes.editorLibrarySub}
        />
      )}
    </>
  );
}
