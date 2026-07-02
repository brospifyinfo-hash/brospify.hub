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
  Sparkles, ShoppingCart, Package, ChevronRight,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { useI18n } from "@/lib/i18n";
import ThemePreview, { type PreviewData } from "@/components/ThemePreview";
import Inspector from "@/components/theme-editor/Inspector";
import SectionLibraryOverlay from "@/components/theme-editor/SectionLibraryOverlay";
import { ACCENT, EDITOR_FONTS } from "@/components/theme-editor/editor-ui";
import {
  editorReducer, initialEditorState, type ThemeDocument,
} from "@/lib/theme-doc";
import {
  buildInitialDocument, createLibraryInstance, getSectionDef,
  type BaseSectionInfo,
} from "@/lib/theme-library";
import { THEME_STYLES, DEFAULT_STYLE_ID, type StyleDesign } from "@/lib/theme-styles";

interface DrawnProduct { id: string; titel: string; bildUrl?: string }
interface PreviewResponse extends PreviewData {
  baseSections?: BaseSectionInfo[];
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
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [libraryAt, setLibraryAt] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cost, setCost] = useState<number | null>(null);
  const [building, setBuilding] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);

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
        const caps = Array.isArray(d.capabilities) ? d.capabilities : [];
        setBaseSections(bs);
        setCapabilities(caps);
        dispatch(
          doc.sections.length === 0
            ? { type: "replace", doc: buildInitialDocument(productId, doc.global.styleId || DEFAULT_STYLE_ID, bs, caps) }
            : { type: "setProduct", productId },
        );
      })
      .catch(() => {})
      .finally(() => setPreviewLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.sections.length, doc.global.styleId]);

  // Stil wechseln = neue Seiten-Architektur (Komposition des Stils).
  const pickStyle = useCallback((styleId: string) => {
    dispatch({ type: "replace", doc: buildInitialDocument(doc.productId, styleId, baseSections, capabilities) });
    setSelected(null);
  }, [doc.productId, baseSections, capabilities]);

  const randomize = useCallback(() => {
    const s = randFrom(THEME_STYLES);
    const next = buildInitialDocument(doc.productId, s.id, baseSections, capabilities);
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
  }, [doc.productId, baseSections, capabilities]);

  // Section einfügen (aus Bibliothek) + GSAP-Puls auf der neuen Section.
  const insertSection = useCallback((type: string, presetId: string) => {
    const instance = createLibraryInstance(type, presetId);
    const index = libraryAt ?? doc.sections.length;
    dispatch({ type: "addSection", index, section: instance });
    setLibraryAt(null);
    setSelected(instance.uid);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-section-uid="${instance.uid}"]`);
      if (el) {
        gsap.fromTo(el, { opacity: 0.15, scale: 0.975 }, { opacity: 1, scale: 1, duration: 0.55, ease: "power3.out" });
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }, [libraryAt, doc.sections.length]);

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
        body: JSON.stringify({ document: doc satisfies ThemeDocument }),
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

  // ── Schritt 1: Produkt wählen (Bilder-Grid) ──
  const showPicker = !doc.productId || pickerOpen;

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-mesh font-sf">
        <div className="mx-auto px-3 sm:px-5 py-4 sm:py-6 max-w-5xl lg:max-w-none xl:max-w-[1800px]">

          {/* ── Top-Bar ── */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap mb-4">
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
                {cost !== null && cost > 0 && <span className="hidden sm:inline text-[10.5px] opacity-80">· {cost} Cr.</span>}
              </button>
            </div>
          </div>

          {msg && (
            <p className={`mb-3 text-[12px] ${msg.kind === "ok" ? "text-[#cfe9a3]" : "text-amber-300/90"}`}>{msg.text}</p>
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
            <div ref={shellRef} className="flex flex-col lg:grid lg:grid-cols-[262px_minmax(0,1fr)_336px] lg:gap-4 lg:items-start">

              {/* Aufbau (links) */}
              <aside className="order-2 lg:order-1 lg:sticky lg:top-4 mb-4 lg:mb-0">
                <div className="glass-strong rounded-2xl border border-white/[0.08] p-3">
                  <div className="text-[11px] uppercase tracking-[0.13em] font-semibold text-zinc-400 px-1 mb-2">{t.themes.editorStructure}</div>
                  <button
                    onClick={() => setSelected(selected === "__buybox" ? null : "__buybox")}
                    className={`w-full text-left rounded-lg border px-2.5 py-2 mb-1.5 transition ${
                      selected === "__buybox" ? "border-[#95BF47]/60 bg-[#95BF47]/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <ShoppingCart className="w-3.5 h-3.5 text-[#95BF47] shrink-0" />
                      <span className="text-[12px] font-semibold text-white">{t.themes.editorBuybox}</span>
                    </span>
                  </button>
                  <div className="space-y-1.5">
                    {doc.sections.map((s) => (
                      <button
                        key={s.uid}
                        onClick={() => setSelected(selected === s.uid ? null : s.uid)}
                        className={`w-full text-left rounded-lg border px-2.5 py-2 transition ${
                          selected === s.uid ? "border-[#95BF47]/60 bg-[#95BF47]/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
                        }`}
                      >
                        <span className="block text-[12px] font-semibold text-white truncate">{sectionLabel(s.type)}</span>
                        <span className="block text-[9.5px] text-zinc-500 uppercase tracking-wider">{presetLabel(s.type, s.presetId)}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setLibraryAt(doc.sections.length)}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#95BF47]/40 bg-[#95BF47]/[0.05] text-[#cfe9a3] hover:text-white hover:bg-[#95BF47]/[0.12] text-[12px] font-semibold px-3 py-2.5 transition"
                  >
                    <Plus className="w-4 h-4" /> {t.themes.editorAddSection}
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
                  label={t.themes.builderPageProduct}
                  viewMode={viewMode}
                  buyboxOrder={doc.buybox.order}
                  hiddenBlocks={doc.buybox.hidden}
                  shadow={doc.global.design.shadow}
                  border={doc.global.design.border}
                  iconStyle={doc.global.design.iconStyle}
                  benefitIcons={doc.buybox.benefitIcons}
                  docSections={doc.sections}
                  selectedUid={selected}
                  onSelectSection={(uid) => setSelected(uid)}
                  onInsertAt={(i) => setLibraryAt(i)}
                />
              </div>

              {/* Inspector (rechts) */}
              <aside className="order-3 lg:sticky lg:top-4">
                <div className="glass-strong rounded-2xl border border-white/[0.08] p-3 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto">
                  <Inspector
                    doc={doc}
                    dispatch={dispatch}
                    selected={selected}
                    onClearSelect={() => setSelected(null)}
                    onPickStyle={pickStyle}
                    onRandomize={randomize}
                    previewData={previewData}
                  />
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>

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
