"use client";

// ─── Kaufbox-Baustein-Galerie (Overlay) ─────────────────────────────
// RASTER-Galerie: zeigt viele Bausteine GLEICHZEITIG als Karten mit
// echter Live-Mini-Vorschau (aktuelle Farben/Schriften/Produktdaten),
// gruppiert nach Kategorie. Direkt „Hinzufügen" pro Karte — kein
// Namen-erst-Anklicken nötig. Style-Art wählt man danach im Inspector.

import { useMemo } from "react";
import {
  X, Plus, Check,
  Type, Tag, SlidersHorizontal, Hash, ShoppingCart, Layers, Megaphone, Flame,
  PackageCheck, BatteryLow, Gift, Users, Star, ListChecks, ShieldCheck,
  BadgeCheck, CheckCheck, CreditCard, Truck, LayoutGrid, Sparkles, AlignLeft,
  ChevronsDownUp, PanelBottomOpen, PackagePlus, Pilcrow, Minus, Share2, Square,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { GlobalStyles } from "@/lib/theme-doc";
import type { Locale } from "@/lib/i18n";
import {
  BUYBOX_BLOCKS, BUYBOX_CATEGORY_LABELS, getBuyboxMeta,
  type BuyboxCategory,
} from "@/lib/theme-sections";
import { getBuyboxLib } from "@/lib/theme-library";
import ThemePreview, { type PreviewData } from "@/components/ThemePreview";
import { ACCENT } from "@/components/theme-editor/editor-ui";

const ICONS: Record<string, LucideIcon> = {
  Type, Tag, SlidersHorizontal, Hash, ShoppingCart, Layers, Megaphone, Flame,
  PackageCheck, BatteryLow, Gift, Users, Star, ListChecks, ShieldCheck,
  BadgeCheck, CheckCheck, CreditCard, Truck, LayoutGrid, Sparkles, AlignLeft,
  ChevronsDownUp, PanelBottomOpen, PackagePlus, Pilcrow, Minus, Share2, Square,
};
function Ic({ name, className }: { name: string; className?: string }) {
  const C = ICONS[name] || Square;
  return <C className={className} />;
}

const CAT_ORDER: BuyboxCategory[] = ["kern", "conversion", "vertrauen", "info"];

export default function BuyboxGalleryOverlay({
  open, onClose, onAdd, activeTypes, previewData, global, lang, title, subtitle,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (type: string, presetId: string) => void;
  /** Bereits aktive Bausteine (werden mit Häkchen markiert). */
  activeTypes: string[];
  previewData: PreviewData | null;
  global: GlobalStyles;
  lang: Locale;
  title: string;
  subtitle: string;
}) {
  const all = useMemo(() => BUYBOX_BLOCKS.map((b) => b.type), []);
  const active = new Set(activeTypes);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-6"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 22, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14, scale: 0.99 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-6xl h-[88vh] flex flex-col rounded-2xl border border-white/[0.1] bg-[#101014]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            {/* Kopf */}
            <div className="flex items-center gap-3 px-4 sm:px-6 py-3.5 border-b border-white/[0.07] shrink-0">
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-bold text-white">{title}</h2>
                <p className="text-[11px] text-zinc-500">{subtitle}</p>
              </div>
              <button onClick={onClose} className="w-9 h-9 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white flex items-center justify-center transition" aria-label="Schließen">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Raster aller Bausteine, nach Kategorie */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 space-y-5">
              {CAT_ORDER.map((c) => {
                const items = all.filter((t) => getBuyboxMeta(t).category === c);
                if (!items.length) return null;
                return (
                  <section key={c}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="h-2.5 w-[3px] rounded-full" style={{ background: ACCENT }} />
                      <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-zinc-400">
                        {lang === "en" ? BUYBOX_CATEGORY_LABELS[c].en : BUYBOX_CATEGORY_LABELS[c].de}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                      {items.map((t) => {
                        const m = getBuyboxMeta(t);
                        const lib = getBuyboxLib(t);
                        const firstPreset = lib?.presets?.[0]?.id || "";
                        const added = active.has(t);
                        return (
                          <div
                            key={t}
                            className={`group rounded-xl border overflow-hidden flex flex-col transition ${
                              added ? "border-[#95BF47]/45 bg-[#95BF47]/[0.05]" : "border-white/[0.09] bg-white/[0.02] hover:border-white/20"
                            }`}
                          >
                            {/* Live-Mini-Vorschau */}
                            <div className="relative h-[132px] overflow-hidden border-b border-white/[0.06] bg-white/[0.015]">
                              <div className="pointer-events-none absolute inset-x-0 top-0 p-2">
                                {previewData ? (
                                  <ThemePreview
                                    data={previewData}
                                    colors={global.colors}
                                    headingFont={global.headingFont}
                                    bodyFont={global.bodyFont}
                                    radius={global.radius}
                                    loading={false}
                                    label=""
                                    shadow={global.design.shadow}
                                    border={global.design.border}
                                    iconStyle={global.design.iconStyle}
                                    benefitIcons={[]}
                                    buyboxCfg={{ [t]: { presetId: firstPreset, texts: {} } }}
                                    previewBlock={t}
                                  />
                                ) : (
                                  <div className="h-full flex items-center justify-center text-[11px] text-zinc-600">…</div>
                                )}
                              </div>
                              {/* sanfter Verlauf unten, damit lange Bausteine nicht hart abschneiden */}
                              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#101014] to-transparent" />
                              {added && (
                                <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#95BF47] text-[#0a0a0a] flex items-center justify-center shadow">
                                  <Check className="w-3 h-3" strokeWidth={3} />
                                </span>
                              )}
                            </div>
                            {/* Fußzeile: Icon + Name + Hinzufügen */}
                            <div className="flex items-center gap-2 p-2">
                              <span className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${added ? "bg-[#95BF47]/20 text-[#cfe9a3]" : "bg-white/[0.05] text-zinc-400"}`}>
                                <Ic name={m.icon} className="w-3.5 h-3.5" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[11.5px] font-semibold text-white truncate leading-tight">{lang === "en" ? m.labelEn : m.label}</span>
                                <span className="block text-[9.5px] text-zinc-500 truncate">{lang === "en" ? m.descEn : m.desc}</span>
                              </span>
                              <button
                                onClick={() => onAdd(t, firstPreset)}
                                disabled={added}
                                title={added ? (lang === "en" ? "Already added" : "Bereits hinzugefügt") : (lang === "en" ? "Add" : "Hinzufügen")}
                                className={`shrink-0 flex items-center justify-center gap-1 rounded-md text-[10.5px] font-bold px-2 py-1.5 transition ${
                                  added
                                    ? "border border-[#95BF47]/40 text-[#95BF47] cursor-default"
                                    : "text-[#0a0a0a] hover:brightness-110"
                                }`}
                                style={added ? undefined : { background: ACCENT }}
                              >
                                {added ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <><Plus className="w-3.5 h-3.5" /> {lang === "en" ? "Add" : "Add"}</>}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
              <p className="text-[10.5px] text-zinc-500 text-center pt-1">
                {lang === "en"
                  ? "Add several blocks, then pick each block's style in the inspector on the right."
                  : "Mehrere Bausteine hinzufügen — die Style-Art jedes Bausteins wählst du danach rechts im Inspector."}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
