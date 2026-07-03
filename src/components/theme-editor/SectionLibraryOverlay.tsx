"use client";

// ─── Section-Galerie (Overlay) ──────────────────────────────────────
// Auswählbare Galerie mit großem Preview-Fenster: links die Section-Liste
// (nach Kategorien), rechts eine GROSSE Live-Vorschau der markierten Section
// mit dem echten Produktbild und den aktuellen Farben. Style-Arten werden
// als Chips gewechselt und sofort im Preview gezeigt — eingefügt wird erst
// per Klick auf „Einfügen".

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { X, Plus, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { GlobalStyles } from "@/lib/theme-doc";
import type { Locale } from "@/lib/i18n";
import {
  SECTION_LIBRARY,
  CATEGORY_LABELS,
  type SectionCategory,
} from "@/lib/theme-library";
import SectionReplica, { REPLICA_CSS, type ReplicaCtx } from "@/components/theme-editor/SectionReplica";
import { previewVars, ACCENT } from "@/components/theme-editor/editor-ui";

const CATEGORY_ORDER: SectionCategory[] = ["conversion", "social", "content", "media", "info"];
const PREVIEW_DESIGN_WIDTH = 860;

// Rendert Kinder bei fester Design-Breite und skaliert sie in den Container.
export function ScaledPreview({ children, maxHeight }: { children: ReactNode; maxHeight?: number }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 0.4, height: 200 });
  useLayoutEffect(() => {
    const outer = outerRef.current, inner = innerRef.current;
    if (!outer || !inner) return;
    const compute = () => {
      const scale = Math.min(1, outer.clientWidth / PREVIEW_DESIGN_WIDTH);
      const h = inner.offsetHeight * scale;
      setBox({ scale, height: maxHeight ? Math.min(maxHeight, h) : h });
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [maxHeight]);
  return (
    <div ref={outerRef} className="relative overflow-hidden" style={{ height: box.height }}>
      <div
        ref={innerRef}
        className="absolute top-0 left-0 pointer-events-none select-none"
        style={{ width: PREVIEW_DESIGN_WIDTH, transform: `scale(${box.scale})`, transformOrigin: "top left" }}
      >
        {children}
      </div>
    </div>
  );
}

export default function SectionLibraryOverlay({
  open, onClose, onInsert, ctx, global, lang, capabilities, title, subtitle,
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (type: string, presetId: string) => void;
  ctx: ReplicaCtx;
  global: GlobalStyles;
  lang: Locale;
  capabilities: string[];
  title: string;
  subtitle: string;
}) {
  const caps = new Set(capabilities);
  const available = useMemo(
    () => SECTION_LIBRARY.filter((s) => !caps.size || caps.has(s.type)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [capabilities.join("|")],
  );

  const [selType, setSelType] = useState<string>(available[0]?.type || "");
  const [presetId, setPresetId] = useState<string>("");

  useEffect(() => {
    if (open) {
      const first = available[0];
      if (first && !available.some((s) => s.type === selType)) {
        setSelType(first.type);
        setPresetId(first.presets[0]?.id || "");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, available]);

  const def = available.find((s) => s.type === selType) || available[0];
  const activePreset = def?.presets.find((p) => p.id === presetId) || def?.presets[0];

  function pick(type: string) {
    const d = available.find((s) => s.type === type);
    setSelType(type);
    setPresetId(d?.presets[0]?.id || "");
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 22, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.99 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-6xl h-[88vh] flex flex-col rounded-2xl border border-white/[0.1] bg-[#101014]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            <style>{REPLICA_CSS}</style>
            <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-white/[0.07] shrink-0">
              <div className="min-w-0 flex-1">
                <h2 className="text-[16px] font-bold text-white">{title}</h2>
                <p className="text-[11.5px] text-zinc-500">{subtitle}</p>
              </div>
              <button onClick={onClose} className="w-9 h-9 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white flex items-center justify-center transition" aria-label="Schließen">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
              {/* ── Galerie-Liste (links) ── */}
              <div className="lg:border-r border-white/[0.06] overflow-y-auto p-3 max-h-[32vh] lg:max-h-none shrink-0 lg:shrink">
                {CATEGORY_ORDER.map((c) => {
                  const items = available.filter((s) => s.category === c);
                  if (!items.length) return null;
                  return (
                    <div key={c} className="mb-3">
                      <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-zinc-500 px-1.5 mb-1.5">
                        {lang === "en" ? CATEGORY_LABELS[c].en : CATEGORY_LABELS[c].de}
                      </div>
                      <div className="space-y-1">
                        {items.map((s) => {
                          const on = s.type === def?.type;
                          return (
                            <button
                              key={s.type}
                              onClick={() => pick(s.type)}
                              className={`w-full flex items-center gap-2 text-left rounded-lg border px-2.5 py-2 transition ${
                                on ? "border-[#95BF47]/60 bg-[#95BF47]/10" : "border-transparent hover:bg-white/[0.05]"
                              }`}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block text-[12.5px] font-semibold text-white truncate">{lang === "en" ? s.labelEn : s.label}</span>
                                <span className="block text-[10px] text-zinc-500 truncate">{lang === "en" ? s.descEn : s.desc}</span>
                              </span>
                              <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${on ? "text-[#95BF47]" : "text-zinc-600"}`} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Preview-Fenster (rechts) ── */}
              {def && (
                <div className="flex-1 min-h-0 flex flex-col p-4 sm:p-5 gap-3 overflow-hidden">
                  {/* Style-Arten der Section */}
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {def.presets.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPresetId(p.id)}
                        title={p.hint}
                        className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                          p.id === (activePreset?.id || "") ? "border-[#95BF47]/70 bg-[#95BF47]/15 text-white" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white"
                        }`}
                      >
                        {lang === "en" ? p.labelEn : p.label}
                      </button>
                    ))}
                    {activePreset?.hint && <span className="text-[10.5px] text-zinc-500 ml-1">{activePreset.hint}</span>}
                  </div>

                  {/* Große Live-Vorschau */}
                  <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-white/[0.08]" style={previewVars(global)}>
                    <div style={{ background: global.colors.background, color: global.colors.text, fontFamily: "var(--pv-b)", padding: "14px 26px", minHeight: "100%" }}>
                      <ScaledPreview>
                        <SectionReplica
                          key={`${def.type}_${activePreset?.id || ""}`}
                          instance={{ uid: `gal_${def.type}`, type: def.type, presetId: activePreset?.id || "", source: "library", texts: {} }}
                          ctx={ctx}
                        />
                      </ScaledPreview>
                    </div>
                  </div>

                  <button
                    onClick={() => onInsert(def.type, activePreset?.id || "")}
                    className="shrink-0 flex items-center justify-center gap-2 rounded-xl text-[13.5px] font-bold px-4 py-3 transition text-white hover:brightness-110"
                    style={{ background: ACCENT }}
                  >
                    <Plus className="w-4 h-4" />
                    {lang === "en" ? "Insert section" : "Section einfügen"} · {lang === "en" ? def.labelEn : def.label}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
