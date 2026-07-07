"use client";

// ─── Stil-Galerie (Overlay) ─────────────────────────────────────────
// Grid-Galerie wie bei den Kaufbox-Bausteinen: ALLE Theme-Stile gleichzeitig
// sichtbar, jede Karte mit einer großen, detailreichen Live-Vorschau der
// Stil-Architektur (mehrere Sections der Komposition, echte Palette/Schriften
// und das echte Produktbild). Oben die Anwenden-Modi:
//   „Nur Design"      → Farben/Schriften/Ecken/Design/Galerie-Look — der
//                        eigene Seitenaufbau und alle Texte BLEIBEN.
//   „Kompletter Stil" → baut Produkt- & Startseite nach der Stil-Komposition
//                        neu (eigene Anpassungen gehen verloren).
// Zusätzlich „Zufalls-Anordnung": mischt die Sections des Stils individuell
// (nur im Modus „Kompletter Stil").

import { useMemo, useState, type CSSProperties } from "react";
import { X, Palette, Check, Dices, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { THEME_STYLES, getThemeStyle, DEFAULT_DESIGN, type ThemeStyle } from "@/lib/theme-styles";
import { STYLE_COMPOSITIONS } from "@/lib/theme-library";
import type { GlobalStyles } from "@/lib/theme-doc";
import SectionReplica, { REPLICA_CSS, type ReplicaCtx } from "@/components/theme-editor/SectionReplica";
import { previewVars, ACCENT, FONT_FAMILY } from "@/components/theme-editor/editor-ui";
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

/** Eine Stil-Karte mit detailreicher Live-Miniatur der Komposition. */
function StyleCard({
  style, ctx, isCurrent, isSelected, onSelect,
}: {
  style: ThemeStyle;
  ctx: Omit<ReplicaCtx, "palette">;
  isCurrent: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const g = useMemo(() => globalsForStyle(style.id), [style.id]);
  const composition = STYLE_COMPOSITIONS[style.id] || [];
  return (
    <button
      onClick={onSelect}
      className={`group text-left rounded-xl border overflow-hidden transition flex flex-col ${
        isSelected
          ? "border-[#95BF47]/70 bg-[#95BF47]/[0.07] ring-1 ring-[#95BF47]/40"
          : "border-white/[0.08] bg-white/[0.02] hover:border-[#95BF47]/40 hover:bg-white/[0.04]"
      }`}
    >
      {/* Detailreiche Live-Vorschau: mehrere Sections der Stil-Komposition,
          bei 860px gerendert und in die Karte skaliert. */}
      <div
        className="relative h-[275px] overflow-hidden shrink-0"
        style={{ ...previewVars(g), background: g.colors.background, contentVisibility: "auto", containIntrinsicSize: "275px" } as CSSProperties}
      >
        <div style={{ color: g.colors.text, fontFamily: "var(--pv-b)", padding: "8px 18px" }}>
          <ScaledPreview>
            <div>
              {composition.slice(0, 4).map((entry, i) => (
                <SectionReplica
                  key={`${style.id}_${entry.type}_${i}`}
                  instance={{ uid: `sty_${style.id}_${i}`, type: entry.type, presetId: entry.presetId, source: "library", texts: {} }}
                  ctx={{ ...ctx, palette: g.colors }}
                />
              ))}
            </div>
          </ScaledPreview>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#101014] to-transparent pointer-events-none" />
        {isCurrent && (
          <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-[#95BF47] text-[#0a0a0a] text-[9.5px] font-bold px-2 py-0.5">
            <Check className="w-3 h-3" /> Aktiv
          </span>
        )}
      </div>
      {/* Fuß: Palette + Name + Hint + Schrift-Kostprobe */}
      <div className="p-2.5 flex items-center gap-2.5">
        <span className="flex -space-x-1 shrink-0">
          <span className="w-4 h-4 rounded-full border border-black/40" style={{ background: style.palette.accent }} />
          <span className="w-4 h-4 rounded-full border border-black/40" style={{ background: style.palette.button }} />
          <span className="w-4 h-4 rounded-full border border-black/40" style={{ background: style.palette.background }} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-bold text-white leading-tight truncate" style={{ fontFamily: `${FONT_FAMILY[style.headingFont] || "'Work Sans'"}, sans-serif` }}>
            {style.label}
          </span>
          <span className="block text-[10px] text-zinc-500 truncate">{style.hint}</span>
        </span>
        <span
          className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition ${
            isSelected ? "border-[#95BF47] bg-[#95BF47]" : "border-white/20 bg-transparent group-hover:border-white/40"
          }`}
        >
          {isSelected && <Check className="w-3.5 h-3.5 text-[#0a0a0a]" />}
        </span>
      </div>
    </button>
  );
}

export default function StyleGalleryOverlay({
  open, onClose, currentStyleId, ctx, onApply,
  title, modeDesign, modeDesignSub, modeFull, modeFullSub, applyLabel,
  shuffleLabel, shuffleSub,
}: {
  open: boolean;
  onClose: () => void;
  currentStyleId: string;
  /** Produktbild/Titel/Preis für die Vorschau (Palette wird je Stil ersetzt). */
  ctx: Omit<ReplicaCtx, "palette">;
  onApply: (styleId: string, full: boolean, shuffle: boolean) => void;
  title: string;
  modeDesign: string;
  modeDesignSub: string;
  modeFull: string;
  modeFullSub: string;
  applyLabel: string;
  shuffleLabel: string;
  shuffleSub: string;
}) {
  const [selId, setSelId] = useState(currentStyleId);
  const [full, setFull] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  // Das Overlay bleibt gemountet (open steuert nur die Sichtbarkeit) —
  // bei jeder Öffnung Auswahl + Modi auf den AKTUELLEN Stand zurücksetzen,
  // sonst würde eine alte Auswahl/„Kompletter Stil" versehentlich angewandt.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSelId(currentStyleId);
      setFull(false);
      setShuffle(false);
    }
  }
  const sel = getThemeStyle(selId);

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
            className="relative w-full max-w-7xl h-[90vh] flex flex-col rounded-2xl border border-white/[0.1] bg-[#101014]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            <style>{REPLICA_CSS}</style>
            <div className="flex items-center gap-3 px-4 sm:px-6 py-3.5 border-b border-white/[0.07] shrink-0">
              <Palette className="w-4.5 h-4.5" style={{ color: ACCENT }} />
              <h2 className="text-[16px] font-bold text-white flex-1">{title}</h2>
              <span className="hidden sm:inline text-[11px] text-zinc-500">{THEME_STYLES.length} Styles</span>
              <button onClick={onClose} className="w-9 h-9 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white flex items-center justify-center transition" aria-label="Schließen">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* ── Stil-Grid: alle Styles auf einmal, je mit Live-Vorschau ── */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {THEME_STYLES.map((s) => (
                  <StyleCard
                    key={s.id}
                    style={s}
                    ctx={ctx}
                    isCurrent={s.id === currentStyleId}
                    isSelected={s.id === selId}
                    onSelect={() => setSelId(s.id)}
                  />
                ))}
              </div>
            </div>

            {/* ── Anwenden-Leiste (Modus + Zufalls-Anordnung + Anwenden) ── */}
            <div className="border-t border-white/[0.07] p-3 sm:px-4 shrink-0 grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto_auto] gap-2 items-stretch">
              {([[false, modeDesign, modeDesignSub], [true, modeFull, modeFullSub]] as const).map(([v, l, sub]) => (
                <button
                  key={String(v)}
                  onClick={() => setFull(v)}
                  className={`text-left rounded-xl border px-3 py-2 transition ${
                    full === v ? "border-[#95BF47]/60 bg-[#95BF47]/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="block text-[12px] font-bold text-white">{l}</span>
                  <span className="block text-[10px] text-zinc-500 leading-snug mt-0.5">{sub}</span>
                </button>
              ))}
              <button
                onClick={() => setShuffle((x) => !x)}
                disabled={!full}
                title={shuffleSub}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition disabled:opacity-35 ${
                  shuffle && full ? "border-[#95BF47]/60 bg-[#95BF47]/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <Dices className="w-4 h-4 shrink-0" style={{ color: shuffle && full ? ACCENT : undefined }} />
                <span className="text-left">
                  <span className="block text-[12px] font-bold text-white">{shuffleLabel}</span>
                  <span className="hidden sm:block text-[10px] text-zinc-500 leading-snug">{shuffleSub}</span>
                </span>
              </button>
              <button
                onClick={() => onApply(sel.id, full, full && shuffle)}
                className="flex items-center justify-center gap-2 rounded-xl text-[13.5px] font-bold px-5 py-2 transition text-white hover:brightness-110"
                style={{ background: ACCENT }}
              >
                {full && shuffle ? <Sparkles className="w-4 h-4" /> : <Palette className="w-4 h-4" />}
                {applyLabel} · {sel.label}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
