"use client";

// ─── Section-Bibliothek (Overlay) ───────────────────────────────────
// Glass-Overlay mit allen einfügbaren Sections, gruppiert nach Kategorie.
// Jede Karte zeigt eine LIVE-Miniatur (Replica mit echtem Produktbild und
// aktuellen Farben) — der Kunde sieht exakt, was er einfügt, bevor er klickt.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { X, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { GlobalStyles } from "@/lib/theme-doc";
import type { Locale } from "@/lib/i18n";
import {
  SECTION_LIBRARY,
  CATEGORY_LABELS,
  type SectionCategory,
  type SectionDef,
} from "@/lib/theme-library";
import SectionReplica, { REPLICA_CSS, type ReplicaCtx } from "@/components/theme-editor/SectionReplica";
import { previewVars, ACCENT } from "@/components/theme-editor/editor-ui";

const CATEGORY_ORDER: SectionCategory[] = ["conversion", "social", "content", "media", "info"];
const THUMB_DESIGN_WIDTH = 860;

// Rendert Kinder bei fester Design-Breite und skaliert sie in die Karte.
function ScaledThumb({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 0.3, height: 120 });
  useLayoutEffect(() => {
    const outer = outerRef.current, inner = innerRef.current;
    if (!outer || !inner) return;
    const compute = () => {
      const scale = Math.min(1, outer.clientWidth / THUMB_DESIGN_WIDTH);
      setBox({ scale, height: Math.min(190, inner.offsetHeight * scale) });
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={outerRef} className="relative overflow-hidden rounded-lg" style={{ height: box.height }}>
      <div
        ref={innerRef}
        className="absolute top-0 left-0 pointer-events-none select-none"
        style={{ width: THUMB_DESIGN_WIDTH, transform: `scale(${box.scale})`, transformOrigin: "top left" }}
      >
        {children}
      </div>
    </div>
  );
}

function LibraryCard({
  def, ctx, global, lang, onInsert,
}: {
  def: SectionDef; ctx: ReplicaCtx; global: GlobalStyles; lang: Locale;
  onInsert: (type: string, presetId: string) => void;
}) {
  const [presetId, setPresetId] = useState(def.presets[0]?.id || "");
  const preset = def.presets.find((p) => p.id === presetId) || def.presets[0];
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden hover:border-[#95BF47]/40 transition group">
      <div className="p-2 pb-0" style={previewVars(global)}>
        <div className="rounded-lg overflow-hidden" style={{ background: global.colors.background, color: global.colors.text, fontFamily: "var(--pv-b)", padding: "6px 14px" }}>
          <ScaledThumb>
            <SectionReplica
              instance={{ uid: `thumb_${def.type}`, type: def.type, presetId, source: "library", texts: {} }}
              ctx={ctx}
            />
          </ScaledThumb>
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-white">{lang === "en" ? def.labelEn : def.label}</div>
            <div className="text-[10.5px] text-zinc-500 leading-snug mt-0.5">{lang === "en" ? def.descEn : def.desc}</div>
          </div>
          <button
            onClick={() => onInsert(def.type, presetId)}
            className="shrink-0 flex items-center gap-1 rounded-lg bg-[#95BF47] text-white text-[11.5px] font-bold px-2.5 py-1.5 hover:brightness-110 transition"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        {/* Style-Arten der Section — Auswahl aktualisiert die Miniatur live */}
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {def.presets.map((p) => (
            <button
              key={p.id}
              onClick={() => setPresetId(p.id)}
              title={p.hint}
              className={`rounded-full border px-2.5 py-1 text-[10.5px] font-semibold transition ${
                p.id === (preset?.id || "") ? "border-[#95BF47]/70 bg-[#95BF47]/15 text-white" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white"
              }`}
            >
              {lang === "en" ? p.labelEn : p.label}
            </button>
          ))}
        </div>
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
  const [cat, setCat] = useState<SectionCategory | "all">("all");
  useEffect(() => {
    if (open) setCat("all");
  }, [open]);

  const caps = new Set(capabilities);
  const available = SECTION_LIBRARY.filter((s) => !caps.size || caps.has(s.type));
  const visible = cat === "all" ? available : available.filter((s) => s.category === cat);

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
            className="relative w-full max-w-6xl max-h-[88vh] flex flex-col rounded-2xl border border-white/[0.1] bg-[#101014]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            <style>{REPLICA_CSS}</style>
            <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-white/[0.07]">
              <div className="min-w-0 flex-1">
                <h2 className="text-[16px] font-bold text-white">{title}</h2>
                <p className="text-[11.5px] text-zinc-500">{subtitle}</p>
              </div>
              <button onClick={onClose} className="w-9 h-9 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white flex items-center justify-center transition" aria-label="Schließen">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Kategorien */}
            <div className="flex gap-1.5 px-4 sm:px-6 py-3 border-b border-white/[0.06] overflow-x-auto">
              <button
                onClick={() => setCat("all")}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition ${cat === "all" ? "text-white" : "text-zinc-400 hover:text-white"}`}
                style={cat === "all" ? { background: `${ACCENT}22`, border: `1px solid ${ACCENT}55` } : { border: "1px solid rgba(255,255,255,.08)" }}
              >
                {lang === "en" ? "All" : "Alle"} · {available.length}
              </button>
              {CATEGORY_ORDER.map((c) => {
                const n = available.filter((s) => s.category === c).length;
                if (!n) return null;
                return (
                  <button
                    key={c}
                    onClick={() => setCat(c)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition ${cat === c ? "text-white" : "text-zinc-400 hover:text-white"}`}
                    style={cat === c ? { background: `${ACCENT}22`, border: `1px solid ${ACCENT}55` } : { border: "1px solid rgba(255,255,255,.08)" }}
                  >
                    {lang === "en" ? CATEGORY_LABELS[c].en : CATEGORY_LABELS[c].de} · {n}
                  </button>
                );
              })}
            </div>

            {/* Karten-Grid mit Live-Miniaturansichten */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {visible.map((def) => (
                  <LibraryCard key={def.type} def={def} ctx={ctx} global={global} lang={lang} onInsert={onInsert} />
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
