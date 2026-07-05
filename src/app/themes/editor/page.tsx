"use client";

// ─── /themes/editor — Theme-Editor v2 ───────────────────────────────
// Produkt-zuerst-Flow: (1) Produkt aus Bilder-Grid wählen → (2) Split-Pane-
// Editor (Aufbau links · Live-Vorschau Mitte · Inspector rechts). Alles lebt
// in EINEM ThemeDocument (Undo/Redo), das die Compile-Engine 1:1 in das
// Shopify-Theme übersetzt. Desktop nutzt die volle Breite; mobil gestapelt.

import { useEffect, useMemo, useReducer, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import {
  ArrowLeft, Download, Monitor, Smartphone, Plus, Redo2, Undo2,
  Sparkles, ShoppingCart, Package, ChevronRight, RefreshCw, Palette, Bookmark,
  Star, AlignLeft, Image as ImageIcon, Info, GripVertical, type LucideIcon,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { useI18n } from "@/lib/i18n";
import ThemePreview, { type PreviewData } from "@/components/ThemePreview";
import Inspector from "@/components/theme-editor/Inspector";
import SectionLibraryOverlay from "@/components/theme-editor/SectionLibraryOverlay";
import StyleGalleryOverlay from "@/components/theme-editor/StyleGalleryOverlay";
import DesignsOverlay from "@/components/theme-editor/DesignsOverlay";
import BuyboxGalleryOverlay from "@/components/theme-editor/BuyboxGalleryOverlay";
import { ACCENT, EDITOR_FONTS } from "@/components/theme-editor/editor-ui";
import {
  editorReducer, initialEditorState, type ThemeDocument, type EditorPage,
} from "@/lib/theme-doc";
import {
  buildInitialDocument, createLibraryInstance, getSectionDef,
  type BaseSectionInfo,
} from "@/lib/theme-library";
import { THEME_STYLES, DEFAULT_STYLE_ID, getThemeStyle, type StyleDesign } from "@/lib/theme-styles";
import { STYLE_GALLERY } from "@/lib/theme-library";

interface DrawnProduct { id: string; titel: string; bildUrl?: string }
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

export default function ThemeEditorPage() {
  const router = useRouter();
  const { t, lang } = useI18n();

  const [state, dispatch] = useReducer(editorReducer, undefined, () => initialEditorState());
  const doc = state.present;

  const [products, setProducts] = useState<DrawnProduct[] | null>(null);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [baseSections, setBaseSections] = useState<BaseSectionInfo[]>([]);
  const [homeSections, setHomeSections] = useState<BaseSectionInfo[]>([]);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [page, setPage] = useState<EditorPage>("product");
  const [selected, setSelected] = useState<string | null>(null);
  // Mobil: nur EIN Panel (Aufbau ODER Einstellungen) unter der Vorschau
  // zeigen — auf dem Desktop stehen beide nebeneinander (Umschalter versteckt).
  const [mobileTab, setMobileTab] = useState<"aufbau" | "einstellungen">("aufbau");
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
  const pickStyle = useCallback((styleId: string) => {
    dispatch({ type: "replace", doc: buildInitialDocument(doc.productId, styleId, baseSections, capabilities, homeSections) });
    setSelected(null);
  }, [doc.productId, baseSections, capabilities, homeSections]);

  const randomize = useCallback(() => {
    const s = randFrom(THEME_STYLES);
    const next = buildInitialDocument(doc.productId, s.id, baseSections, capabilities, homeSections);
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
  const applyStyle = useCallback((styleId: string, full: boolean) => {
    setStyleOpen(false);
    if (full) {
      pickStyle(styleId);
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
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
  }, []);

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

  const activeProduct = useMemo(
    () => (products || []).find((p) => p.id === doc.productId) || null,
    [products, doc.productId],
  );
  const sectionLabel = (type: string) => {
    const def = getSectionDef(type);
    return def ? (lang === "en" ? def.labelEn : def.label) : type;
  };
  const presetLabel = (type: string, presetId: string) => {
    const def = getSectionDef(type);
    const p = def?.presets.find((x) => x.id === presetId) || def?.presets[0];
    return p ? (lang === "en" ? p.labelEn : p.label) : "";
  };
  // Icon je Section-Kategorie (für die Aufbau-Karten).
  const CAT_ICON: Record<string, LucideIcon> = {
    conversion: ShoppingCart, social: Star, content: AlignLeft, media: ImageIcon, info: Info,
  };
  const sectionIcon = (type: string): LucideIcon => CAT_ICON[getSectionDef(type)?.category || "info"] || Info;

  // ── Schritt 1: Produkt wählen (Bilder-Grid) ──
  const showPicker = !doc.productId || pickerOpen;

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-mesh font-sf">
        <div className="mx-auto px-3 sm:px-5 lg:px-7 py-4 sm:py-6 max-w-5xl lg:max-w-none xl:max-w-[1840px]">

          {/* ── Top-Bar (edle Glas-Toolbar) ── */}
          <div className="glass-strong rounded-2xl border border-white/[0.08] px-2.5 py-2 mb-4 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => router.push("/themes")}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-zinc-300 hover:text-white transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t.themes.editorBack}</span>
            </button>
            <div className="flex items-center gap-1.5 text-[13px] font-bold text-white">
              <Sparkles className="w-4 h-4" style={{ color: ACCENT }} />
              {t.themes.editorTitle}
            </div>

            {activeProduct && (
              <button
                onClick={() => setPickerOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] pl-1.5 pr-2.5 py-1.5 hover:border-[#95BF47]/40 transition min-w-0"
                title={t.themes.editorChangeProduct}
              >
                {activeProduct.bildUrl
                  ? <img src={activeProduct.bildUrl} alt="" className="w-7 h-7 rounded-md object-cover shrink-0" />
                  : <span className="w-7 h-7 rounded-md bg-white/[0.06] shrink-0" />}
                <span className="text-[12px] font-medium text-white truncate max-w-[140px] sm:max-w-[240px]">{activeProduct.titel}</span>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              </button>
            )}

            <div className="flex items-center gap-1.5 ml-auto">
              {/* Gesamt-Stil jederzeit änderbar */}
              {doc.productId && (
                <button
                  onClick={() => setStyleOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-zinc-300 hover:text-white hover:border-[#95BF47]/40 transition"
                >
                  <Palette className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                  <span className="hidden sm:inline">{t.themes.editorStyleGallery}</span>
                  <span className="text-[10.5px] text-zinc-500 hidden md:inline">· {getThemeStyle(doc.global.styleId).label}</span>
                </button>
              )}
              {/* Design-Speicherstände (mit Sync-Codes) */}
              {doc.productId && (
                <button
                  onClick={() => setDesignsOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-zinc-300 hover:text-white hover:border-[#95BF47]/40 transition"
                >
                  <Bookmark className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                  <span className="hidden sm:inline">{t.themes.editorDesigns}</span>
                  {activeDesign && <span className="text-[10.5px] text-zinc-500 hidden md:inline truncate max-w-[110px]">· {activeDesign.name}</span>}
                </button>
              )}
              {/* Undo / Redo */}
              <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
                <button
                  onClick={() => dispatch({ type: "undo" })}
                  disabled={!state.past.length}
                  title={`${t.themes.editorUndo} (Ctrl+Z)`}
                  className="px-2 py-1.5 rounded-md text-zinc-300 hover:text-white disabled:opacity-25 transition"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => dispatch({ type: "redo" })}
                  disabled={!state.future.length}
                  title={`${t.themes.editorRedo} (Ctrl+Shift+Z)`}
                  className="px-2 py-1.5 rounded-md text-zinc-300 hover:text-white disabled:opacity-25 transition"
                >
                  <Redo2 className="w-4 h-4" />
                </button>
              </div>
              {/* PC / Handy */}
              <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
                <button
                  onClick={() => setViewMode("desktop")}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition ${viewMode === "desktop" ? "bg-white/12 text-white" : "text-zinc-400 hover:text-white"}`}
                >
                  <Monitor className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t.themes.builderViewDesktop}</span>
                </button>
                <button
                  onClick={() => setViewMode("mobile")}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition ${viewMode === "mobile" ? "bg-white/12 text-white" : "text-zinc-400 hover:text-white"}`}
                >
                  <Smartphone className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t.themes.builderViewMobile}</span>
                </button>
              </div>
              <button
                onClick={handleDownload}
                disabled={building || !doc.productId}
                className="btn-deploy flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-[12.5px] disabled:opacity-50"
              >
                {building ? <Sparkles className="w-4 h-4 animate-pulse" /> : <Download className="w-4 h-4" />}
                <span>{building ? t.themes.builderBuilding : "Download"}</span>
              </button>
              {/* Design live in installierte Shops pushen (Sync-Code, kostenlos) */}
              <button
                onClick={handleSyncUpdate}
                disabled={syncing || !doc.productId}
                title={t.themes.editorSyncHint}
                className="flex items-center gap-1.5 rounded-lg border border-[#95BF47]/40 bg-[#95BF47]/10 px-3 py-2 text-[12px] font-semibold text-[#cfe9a3] hover:text-white hover:bg-[#95BF47]/20 disabled:opacity-50 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{t.themes.editorSyncUpdate}</span>
              </button>
            </div>
          </div>

          {msg && (
            <p className={`mb-3 text-[12px] ${msg.kind === "ok" ? "text-[#cfe9a3]" : "text-amber-300/90"}`}>{msg.text}</p>
          )}
          {!msg && cost !== null && cost > 0 && !showPicker && (
            <p className="mb-3 text-[11.5px] text-zinc-500">{t.themes.editorFreeNote.replace("{n}", String(cost))}</p>
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
            <div ref={shellRef} className="flex flex-col lg:grid lg:grid-cols-[300px_minmax(0,1fr)_364px] xl:grid-cols-[320px_minmax(0,1fr)_384px] lg:gap-5 lg:items-start">

              {/* Mobil-Umschalter: Aufbau ↔ Einstellungen (Desktop versteckt) */}
              <div className="order-2 lg:hidden mb-3">
                <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                  {([["aufbau", t.themes.editorStructure], ["einstellungen", t.themes.editorSettings]] as const).map(([tab, label]) => (
                    <button
                      key={tab}
                      onClick={() => setMobileTab(tab)}
                      className={`px-3 py-2.5 rounded-lg text-[12.5px] font-semibold transition ${mobileTab === tab ? "bg-[#95BF47] text-[#0a0a0a]" : "text-zinc-300 hover:text-white"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aufbau (links) */}
              <aside className={`order-3 lg:order-1 lg:sticky lg:top-4 mb-4 lg:mb-0 ${mobileTab === "aufbau" ? "" : "hidden"} lg:block`}>
                <div className="glass-strong rounded-xl border border-white/[0.08] p-2 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto">
                  {/* Seiten-Umschalter: Produktseite ↔ Startseite (kompakt) */}
                  <div className="flex rounded-md border border-white/10 bg-black/25 p-0.5 mb-2">
                    {([["product", t.themes.builderPageProduct], ["home", t.themes.builderPageHome]] as const).map(([p, l]) => (
                      <button
                        key={p}
                        onClick={() => { setPage(p); setSelected(null); }}
                        className={`flex-1 px-2 py-1.5 rounded text-[11px] font-semibold transition ${page === p ? "bg-[#95BF47] text-[#0a0a0a]" : "text-zinc-400 hover:text-white"}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
                    <span className="h-2.5 w-[3px] rounded-full" style={{ background: ACCENT }} />
                    <span className="text-[9.5px] uppercase tracking-[0.14em] font-bold text-zinc-400">{t.themes.editorStructure}</span>
                  </div>
                  {page === "product" && (
                  <button
                    onClick={() => setSelected(selected === "__buybox" ? null : "__buybox")}
                    className={`w-full flex items-center gap-2 rounded-md border px-2 py-1.5 mb-1 transition ${
                      selected === "__buybox" || selected?.startsWith("blk:")
                        ? "border-[#95BF47]/50 bg-[#95BF47]/[0.12]"
                        : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}
                  >
                    <ShoppingCart className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT }} />
                    <span className="text-[12px] font-semibold text-white flex-1 text-left truncate">{t.themes.editorBuybox}</span>
                    <span className="text-[9.5px] text-zinc-500 shrink-0">{doc.buybox.order.length}</span>
                  </button>
                  )}
                  <div className="space-y-0.5">
                    {currentSections.map((s) => {
                      const Ico = sectionIcon(s.type);
                      const on = selected === s.uid;
                      return (
                        <button
                          key={s.uid}
                          onClick={() => setSelected(on ? null : s.uid)}
                          className={`w-full flex items-center gap-2 rounded-md border px-2 py-1.5 transition ${
                            on ? "border-[#95BF47]/50 bg-[#95BF47]/[0.12]" : "border-transparent hover:bg-white/[0.05]"
                          }`}
                        >
                          <Ico className={`w-3.5 h-3.5 shrink-0 ${on ? "text-[#95BF47]" : "text-zinc-500"}`} />
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block text-[12px] font-medium text-white truncate leading-tight">{sectionLabel(s.type)}</span>
                          </span>
                          <span className="text-[9px] text-zinc-600 shrink-0 truncate max-w-[70px]">{presetLabel(s.type, s.presetId)}</span>
                        </button>
                      );
                    })}
                    {currentSections.length === 0 && (
                      <p className="text-[10.5px] text-zinc-500 text-center py-2.5 px-2">{t.themes.editorRailEmpty}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setLibraryAt(currentSections.length)}
                    className="w-full mt-1.5 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-[#95BF47]/40 bg-[#95BF47]/[0.06] text-[#cfe9a3] hover:text-white hover:bg-[#95BF47]/[0.14] text-[11.5px] font-semibold px-3 py-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> {t.themes.editorAddSection}
                  </button>
                </div>
              </aside>

              {/* Live-Vorschau (Mitte) */}
              <div className="order-1 lg:order-2 mb-4 lg:mb-0 lg:sticky lg:top-4" onClick={() => setSelected(null)}>
                <ThemePreview
                  data={previewData}
                  colors={doc.global.colors}
                  headingFont={doc.global.headingFont}
                  bodyFont={doc.global.bodyFont}
                  radius={doc.global.radius}
                  loading={previewLoading}
                  label={page === "home" ? t.themes.builderPageHome : t.themes.builderPageProduct}
                  viewMode={viewMode}
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
                />
              </div>

              {/* Inspector (rechts) */}
              <aside ref={inspectorRef} className={`order-4 lg:order-3 lg:sticky lg:top-4 scroll-mt-4 ${mobileTab === "einstellungen" ? "" : "hidden"} lg:block`}>
                <div className="glass-strong rounded-xl border border-white/[0.08] p-2 lg:max-h-[calc(100vh-104px)] lg:overflow-y-auto">
                  <Inspector
                    doc={doc}
                    dispatch={dispatch}
                    selected={selected}
                    onClearSelect={() => setSelected(null)}
                    onSelectBlock={setSelected}
                    onOpenStyles={() => setStyleOpen(true)}
                    onOpenBuyboxGallery={() => setBuyboxGalleryOpen(true)}
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
