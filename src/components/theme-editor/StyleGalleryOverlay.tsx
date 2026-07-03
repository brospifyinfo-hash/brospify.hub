"use client";

// ─── Stil-Galerie (Overlay) ─────────────────────────────────────────
// Der Gesamt-Stil des Themes ist JEDERZEIT nachträglich änderbar: links die
// 12 Stile, rechts eine große Live-Vorschau der Stil-Architektur (Sections
// der Stil-Komposition mit Palette/Schriften des Stils und dem echten
// Produktbild). Zwei Anwenden-Modi:
//   „Nur Design"      → Farben/Schriften/Ecken/Design/Galerie-Look — der
//                        eigene Seitenaufbau und alle Texte BLEIBEN.
//   „Kompletter Stil" → baut Produkt- & Startseite nach der Stil-Komposition
//                        neu (eigene Anpassungen gehen verloren).

import { useState } from "react";
import { X, Palette, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { THEME_STYLES, getThemeStyle, DEFAULT_DESIGN } from "@/lib/theme-styles";
import { STYLE_COMPOSITIONS } from "@/lib/theme-library";
import type { GlobalStyles } from "@/lib/theme-doc";
import SectionReplica, { REPLICA_CSS, type ReplicaCtx } from "@/components/theme-editor/SectionReplica";
import { previewVars, ACCENT } from "@/components/theme-editor/editor-ui";
import { ScaledPreview } from "@/components/theme-editor/SectionLibraryOverlay";

function globalsForStyle(styleId: string): GlobalStyles {
  const s = getThemeStyle(styleId);
  return {
    styleId: s.id,
    colors: { ...s.palette },
    headingFont: s.headingFont,
    bodyFont: s.bodyFont,
    radius: typeof s.settingOverrides.buttons_radius === "number" ? s.settingOverrides.buttons_radius : 8,
    design: s.design ? { ...s.design } : DEFAULT_DESIGN,
  };
}

export default function StyleGalleryOverlay({
  open, onClose, currentStyleId, ctx, onApply,
  title, modeDesign, modeDesignSub, modeFull, modeFullSub, applyLabel,
}: {
  open: boolean;
  onClose: () => void;
  currentStyleId: string;
  /** Produktbild/Titel/Preis für die Vorschau (Palette wird je Stil ersetzt). */
  ctx: Omit<ReplicaCtx, "palette">;
  onApply: (styleId: string, full: boolean) => void;
  title: string;
  modeDesign: string;
  modeDesignSub: string;
  modeFull: string;
  modeFullSub: string;
  applyLabel: string;
}) {
  const [selId, setSelId] = useState(currentStyleId);
  const [full, setFull] = useState(false);
  const sel = getThemeStyle(selId);
  const g = globalsForStyle(sel.id);
  const composition = STYLE_COMPOSITIONS[sel.id] || [];

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
              <Palette className="w-4.5 h-4.5" style={{ color: ACCENT }} />
              <h2 className="text-[16px] font-bold text-white flex-1">{title}</h2>
              <button onClick={onClose} className="w-9 h-9 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white flex items-center justify-center transition" aria-label="Schließen">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
              {/* ── Stil-Liste ── */}
              <div className="lg:border-r border-white/[0.06] overflow-y-auto p-3 max-h-[30vh] lg:max-h-none shrink-0 lg:shrink space-y-1.5">
                {THEME_STYLES.map((s) => {
                  const on = s.id === selId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelId(s.id)}
                      className={`w-full text-left rounded-lg border px-3 py-2.5 transition ${
                        on ? "border-[#95BF47]/60 bg-[#95BF47]/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.06]"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="flex -space-x-1 shrink-0">
                          <span className="w-3.5 h-3.5 rounded-full border border-black/30" style={{ background: s.palette.accent }} />
                          <span className="w-3.5 h-3.5 rounded-full border border-black/30" style={{ background: s.palette.button }} />
                          <span className="w-3.5 h-3.5 rounded-full border border-black/30" style={{ background: s.palette.background }} />
                        </span>
                        <span className="text-[13px] font-semibold text-white flex-1">{s.label}</span>
                        {s.id === currentStyleId && <Check className="w-3.5 h-3.5 text-[#95BF47] shrink-0" />}
                      </span>
                      <span className="block text-[10px] text-zinc-500 mt-0.5">{s.hint}</span>
                    </button>
                  );
                })}
              </div>

              {/* ── Große Stil-Vorschau + Anwenden ── */}
              <div className="flex-1 min-h-0 flex flex-col p-4 sm:p-5 gap-3 overflow-hidden">
                <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-white/[0.08]" style={previewVars(g)}>
                  <div style={{ background: g.colors.background, color: g.colors.text, fontFamily: "var(--pv-b)", padding: "10px 26px", minHeight: "100%" }}>
                    <ScaledPreview>
                      <div key={sel.id}>
                        {composition.map((entry, i) => (
                          <SectionReplica
                            key={`${sel.id}_${entry.type}_${i}`}
                            instance={{ uid: `sty_${i}`, type: entry.type, presetId: entry.presetId, source: "library", texts: {} }}
                            ctx={{ ...ctx, palette: g.colors }}
                          />
                        ))}
                      </div>
                    </ScaledPreview>
                  </div>
                </div>

                {/* Anwenden-Modus */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 shrink-0">
                  {([[false, modeDesign, modeDesignSub], [true, modeFull, modeFullSub]] as const).map(([v, l, sub]) => (
                    <button
                      key={String(v)}
                      onClick={() => setFull(v)}
                      className={`text-left rounded-xl border px-3 py-2.5 transition ${
                        full === v ? "border-[#95BF47]/60 bg-[#95BF47]/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                      }`}
                    >
                      <span className="block text-[12.5px] font-bold text-white">{l}</span>
                      <span className="block text-[10.5px] text-zinc-500 leading-snug mt-0.5">{sub}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => onApply(sel.id, full)}
                  className="shrink-0 flex items-center justify-center gap-2 rounded-xl text-[13.5px] font-bold px-4 py-3 transition text-white hover:brightness-110"
                  style={{ background: ACCENT }}
                >
                  <Palette className="w-4 h-4" />
                  {applyLabel} · {sel.label}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

