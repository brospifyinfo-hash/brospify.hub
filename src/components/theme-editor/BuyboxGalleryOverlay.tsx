"use client";

// ─── Kaufbox-Baustein-Galerie (Overlay) ─────────────────────────────
// Auswählbare Galerie für die Bausteine der Kaufbox: links die verfügbaren
// Bausteine (nach Kategorie, mit Icon + Beschreibung), rechts eine GROSSE
// Live-Vorschau des markierten Bausteins mit echten Produktdaten und den
// aktuellen Farben. Style-Arten als Chips, Einfügen per Button.

import { useEffect, useMemo, useState } from "react";
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
  /** Bereits aktive Bausteine (werden ausgegraut/mit Häkchen markiert). */
  activeTypes: string[];
  previewData: PreviewData | null;
  global: GlobalStyles;
  lang: Locale;
  title: string;
  subtitle: string;
}) {
  // Alle Bausteine, die eine sinnvolle Vorschau haben (kein reiner Struktur-
  // Block ohne Optik wie divider zeigen wir trotzdem — sieht man ja).
  const all = useMemo(() => BUYBOX_BLOCKS.map((b) => b.type), []);
  const [sel, setSel] = useState(all[0]);
  const [presetId, setPresetId] = useState("");
  const active = new Set(activeTypes);

  useEffect(() => {
    if (open) {
      const first = all.find((t) => !active.has(t)) || all[0];
      setSel(first);
      setPresetId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const lib = getBuyboxLib(sel);
  const meta = getBuyboxMeta(sel);
  const presets = lib?.presets || [];
  const activePreset = presetId || presets[0]?.id || "";
  const alreadyAdded = active.has(sel);

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
            className="relative w-full max-w-5xl h-[88vh] flex flex-col rounded-2xl border border-white/[0.1] bg-[#101014]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
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
              {/* Liste (links) */}
              <div className="lg:border-r border-white/[0.06] overflow-y-auto p-3 max-h-[34vh] lg:max-h-none shrink-0 lg:shrink">
                {CAT_ORDER.map((c) => {
                  const items = all.filter((t) => getBuyboxMeta(t).category === c);
                  if (!items.length) return null;
                  return (
                    <div key={c} className="mb-3">
                      <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-zinc-500 px-1.5 mb-1.5">
                        {lang === "en" ? BUYBOX_CATEGORY_LABELS[c].en : BUYBOX_CATEGORY_LABELS[c].de}
                      </div>
                      <div className="space-y-1">
                        {items.map((t) => {
                          const m = getBuyboxMeta(t);
                          const on = t === sel;
                          const added = active.has(t);
                          return (
                            <button
                              key={t}
                              onClick={() => { setSel(t); setPresetId(""); }}
                              className={`w-full flex items-center gap-2.5 text-left rounded-lg border px-2.5 py-2 transition ${
                                on ? "border-[#95BF47]/60 bg-[#95BF47]/10" : "border-transparent hover:bg-white/[0.05]"
                              }`}
                            >
                              <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${on ? "bg-[#95BF47]/20 text-[#cfe9a3]" : "bg-white/[0.05] text-zinc-400"}`}>
                                <Ic name={m.icon} className="w-4 h-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[12.5px] font-semibold text-white truncate">{lang === "en" ? m.labelEn : m.label}</span>
                                <span className="block text-[10px] text-zinc-500 truncate">{lang === "en" ? m.descEn : m.desc}</span>
                              </span>
                              {added && <Check className="w-3.5 h-3.5 text-[#95BF47] shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Vorschau (rechts) */}
              <div className="flex-1 min-h-0 flex flex-col p-4 sm:p-5 gap-3 overflow-hidden">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-9 h-9 rounded-lg bg-[#95BF47]/15 text-[#cfe9a3] flex items-center justify-center shrink-0">
                    <Ic name={meta.icon} className="w-4.5 h-4.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold text-white truncate">{lang === "en" ? meta.labelEn : meta.label}</div>
                    <div className="text-[11px] text-zinc-500 truncate">{lang === "en" ? meta.descEn : meta.desc}</div>
                  </div>
                </div>

                {presets.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {presets.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPresetId(p.id)}
                        title={p.hint}
                        className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                          p.id === activePreset ? "border-[#95BF47]/70 bg-[#95BF47]/15 text-white" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white"
                        }`}
                      >
                        {lang === "en" ? p.labelEn : p.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 flex items-start justify-center">
                  <div className="w-full max-w-[460px]">
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
                        buyboxCfg={{ [sel]: { presetId: activePreset, texts: {} } }}
                        previewBlock={sel}
                      />
                    ) : (
                      <p className="text-[12px] text-zinc-500 text-center py-8">…</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => { onAdd(sel, activePreset); }}
                  disabled={alreadyAdded}
                  className="shrink-0 flex items-center justify-center gap-2 rounded-xl text-[13.5px] font-bold px-4 py-3 transition text-white hover:brightness-110 disabled:opacity-40"
                  style={{ background: ACCENT }}
                >
                  <Plus className="w-4 h-4" />
                  {alreadyAdded
                    ? (lang === "en" ? "Already in the buy box" : "Bereits in der Kaufbox")
                    : `${lang === "en" ? "Add" : "Hinzufügen"} · ${lang === "en" ? meta.labelEn : meta.label}`}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
