"use client";

// ─── Inspector (rechtes Editor-Panel) ───────────────────────────────
// Kontextabhängig: ausgewählte Section (Style-Art + Texte + Aktionen),
// Kaufbox (Baustein-Manager + Vorteile-Icons) oder — ohne Auswahl — das
// globale Theme-Design (Stil, Farben, Schriften/Ecken, Design).

import { useState, type ReactNode } from "react";
import {
  ChevronDown, ChevronUp, Trash2, Shuffle, MousePointerClick, Palette as PaletteIcon,
  Plus, ArrowDownUp, GripVertical,
  Type, Tag, SlidersHorizontal, Hash, ShoppingCart, Layers, Megaphone, Flame,
  PackageCheck, BatteryLow, Gift, Users, Star, ListChecks, ShieldCheck,
  BadgeCheck, CheckCheck, CreditCard, Truck, LayoutGrid, Sparkles, AlignLeft,
  ChevronsDownUp, PanelBottomOpen, PackagePlus, Pilcrow, Minus, Share2, Square,
  type LucideIcon,
} from "lucide-react";
import type { ThemeDocument, EditorAction } from "@/lib/theme-doc";
import type { PreviewData } from "@/components/ThemePreview";
import { getSectionDef, getBuyboxLib, GALLERY_PRESETS } from "@/lib/theme-library";
import { THEME_STYLES } from "@/lib/theme-styles";
import { getBuyboxMeta, BUYBOX_CANONICAL_ORDER, BUYBOX_RUNTIME_ONLY } from "@/lib/theme-sections";
import { THEME_ICONS, DEFAULT_BENEFIT_ICONS, getIcon } from "@/lib/theme-icons";
import { useI18n } from "@/lib/i18n";
import { EDITOR_FONTS, segCls } from "@/components/theme-editor/editor-ui";

const BLOCK_ICONS: Record<string, LucideIcon> = {
  Type, Tag, SlidersHorizontal, Hash, ShoppingCart, Layers, Megaphone, Flame,
  PackageCheck, BatteryLow, Gift, Users, Star, ListChecks, ShieldCheck,
  BadgeCheck, CheckCheck, CreditCard, Truck, LayoutGrid, Sparkles, AlignLeft,
  ChevronsDownUp, PanelBottomOpen, PackagePlus, Pilcrow, Minus, Share2, Square,
};
function BlockIcon({ name, className }: { name: string; className?: string }) {
  const C = BLOCK_ICONS[name] || Square;
  return <C className={className} />;
}

function IconSvg({ id, size = 16 }: { id: string; size?: number }) {
  const ic = getIcon(id);
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {ic.paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

function Group({ id, title, open, onToggle, children }: { id: string; title: string; open: boolean; onToggle: (id: string) => void; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <button onClick={() => onToggle(id)} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.02] transition">
        <span className="text-[11px] uppercase tracking-[0.13em] font-semibold text-white">{title}</span>
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-3 pb-3.5 pt-1 border-t border-white/[0.05]">{children}</div>}
    </div>
  );
}

export default function Inspector({
  doc, dispatch, selected, onClearSelect, onSelectBlock, onOpenStyles, onRandomize, onOpenBuyboxGallery, previewData,
}: {
  doc: ThemeDocument;
  dispatch: (a: EditorAction) => void;
  selected: string | null;
  onClearSelect: () => void;
  /** Auswahl umschalten: "__buybox" (Panel) oder "blk:<typ>" (Baustein offen). */
  onSelectBlock: (sel: string) => void;
  /** Öffnet die Stil-Galerie (Stil-Wechsel läuft nur noch darüber). */
  onOpenStyles: () => void;
  onRandomize: () => void;
  /** Öffnet die Kaufbox-Baustein-Galerie (Baustein hinzufügen). */
  onOpenBuyboxGallery: () => void;
  previewData: PreviewData | null;
}) {
  const { t, lang } = useI18n();
  const [openG, setOpenG] = useState<Record<string, boolean>>({ stil: true });
  const toggleG = (id: string) => setOpenG((o) => ({ ...o, [id]: !o[id] }));
  const [iconPickerFor, setIconPickerFor] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  // ── Section ausgewählt (Produktseite ODER Startseite — uids sind global) ──
  const sectionList =
    selected && doc.sections.some((s) => s.uid === selected)
      ? doc.sections
      : selected && (doc.home || []).some((s) => s.uid === selected)
        ? doc.home || []
        : null;
  const section = sectionList ? sectionList.find((s) => s.uid === selected) : null;
  if (section && sectionList) {
    const def = getSectionDef(section.type);
    const idx = sectionList.findIndex((s) => s.uid === section.uid);
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-[#95BF47]/25 bg-[#95BF47]/[0.06] px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-white truncate">{def ? (lang === "en" ? def.labelEn : def.label) : section.type}</div>
              <div className="text-[10.5px] text-zinc-500">{def ? (lang === "en" ? def.descEn : def.desc) : ""}</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => dispatch({ type: "moveSection", uid: section.uid, dir: -1 })} disabled={idx <= 0} className="w-7 h-7 rounded-md border border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white disabled:opacity-25 flex items-center justify-center" aria-label={t.themes.editorUndo}>
                <ChevronUp className="w-4 h-4" />
              </button>
              <button onClick={() => dispatch({ type: "moveSection", uid: section.uid, dir: 1 })} disabled={idx >= sectionList.length - 1} className="w-7 h-7 rounded-md border border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white disabled:opacity-25 flex items-center justify-center" aria-label="runter">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Style-Arten */}
        {def && def.presets.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-[0.13em] font-semibold text-zinc-400 mb-2">{t.themes.editorPreset}</div>
            <div className="grid grid-cols-1 gap-1.5">
              {def.presets.map((p) => {
                const on = p.id === section.presetId || (!section.presetId && p.id === def.presets[0].id);
                return (
                  <button
                    key={p.id}
                    onClick={() => dispatch({ type: "setPreset", uid: section.uid, presetId: p.id })}
                    className={`text-left rounded-lg border px-3 py-2 transition ${on ? "border-[#95BF47]/60 bg-[#95BF47]/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"}`}
                  >
                    <span className="block text-[12.5px] font-semibold text-white">{lang === "en" ? p.labelEn : p.label}</span>
                    <span className="block text-[10px] text-zinc-500 leading-tight">{p.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Kuratierte Texte */}
        {def && def.fields.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-[0.13em] font-semibold text-zinc-400 mb-2">{t.themes.editorTexts}</div>
            <div className="space-y-2">
              {def.fields.map((f) => (
                <label key={f.id} className="block">
                  <span className="block text-[10.5px] text-zinc-500 mb-1">{lang === "en" ? f.labelEn : f.label}</span>
                  {f.kind === "textarea" ? (
                    <textarea
                      value={section.texts[f.id] ?? ""}
                      placeholder={f.def}
                      rows={2}
                      onChange={(e) => dispatch({ type: "setText", uid: section.uid, field: f.id, value: e.target.value })}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-md px-2.5 py-1.5 text-[12px] text-white placeholder:text-zinc-600 outline-none focus:border-[#95BF47]/40 resize-y"
                    />
                  ) : (
                    <input
                      value={section.texts[f.id] ?? ""}
                      placeholder={f.def}
                      onChange={(e) => dispatch({ type: "setText", uid: section.uid, field: f.id, value: e.target.value })}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-md px-2.5 py-1.5 text-[12px] text-white placeholder:text-zinc-600 outline-none focus:border-[#95BF47]/40"
                    />
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => { dispatch({ type: "removeSection", uid: section.uid }); onClearSelect(); }}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-red-400/25 bg-red-500/[0.07] text-red-300 hover:bg-red-500/[0.14] text-[12px] font-semibold px-3 py-2 transition"
        >
          <Trash2 className="w-3.5 h-3.5" /> {t.themes.editorRemove}
        </button>
      </div>
    );
  }

  // ── Kaufbox ausgewählt (Panel oder einzelner Baustein via "blk:<typ>") ──
  const blkSelected = selected && selected.startsWith("blk:") ? selected.slice(4) : null;
  if (selected === "__buybox" || blkSelected) {
    const expandedType = blkSelected;

    // Konfiguration EINES Bausteins: Style-Arten + kuratierte Texte.
    const blockConfig = (type: string) => {
      const lib = getBuyboxLib(type);
      if (!lib || (!lib.presets.length && !lib.fields.length)) return null;
      const cfg = doc.buybox.blocks[type];
      return (
        <div className="mt-2 pt-2 border-t border-white/[0.06] space-y-2.5">
          {lib.presets.length > 0 && (
            <div>
              <span className="block text-[10px] uppercase tracking-[0.12em] font-semibold text-zinc-500 mb-1.5">{t.themes.editorPreset}</span>
              <div className="flex flex-wrap gap-1.5">
                {lib.presets.map((p) => {
                  const on = cfg?.presetId ? cfg.presetId === p.id : false;
                  return (
                    <button
                      key={p.id}
                      title={p.hint}
                      onClick={() => dispatch({ type: "setBlockPreset", blockType: type, presetId: p.id })}
                      className={`rounded-full border px-2.5 py-1 text-[10.5px] font-semibold transition ${
                        on ? "border-[#95BF47]/70 bg-[#95BF47]/15 text-white" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white"
                      }`}
                    >
                      {lang === "en" ? p.labelEn : p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {lib.fields.length > 0 && (
            <div className="space-y-1.5">
              {lib.fields.map((f) => (
                <label key={f.id} className="block">
                  <span className="block text-[10px] text-zinc-500 mb-0.5">{lang === "en" ? f.labelEn : f.label}</span>
                  {f.kind === "textarea" ? (
                    <textarea
                      value={cfg?.texts?.[f.id] ?? ""}
                      placeholder={f.def || (lang === "en" ? f.labelEn : f.label)}
                      rows={2}
                      onChange={(e) => dispatch({ type: "setBlockText", blockType: type, field: f.id, value: e.target.value })}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-md px-2 py-1.5 text-[11.5px] text-white placeholder:text-zinc-600 outline-none focus:border-[#95BF47]/40 resize-y"
                    />
                  ) : (
                    <input
                      value={cfg?.texts?.[f.id] ?? ""}
                      placeholder={f.def || (lang === "en" ? f.labelEn : f.label)}
                      onChange={(e) => dispatch({ type: "setBlockText", blockType: type, field: f.id, value: e.target.value })}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-md px-2 py-1.5 text-[11.5px] text-white placeholder:text-zinc-600 outline-none focus:border-[#95BF47]/40"
                    />
                  )}
                </label>
              ))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-[#95BF47]/25 bg-[#95BF47]/[0.06] px-3 py-2.5">
          <div className="text-[13px] font-bold text-white">{t.themes.editorBuybox}</div>
          <div className="text-[10.5px] text-zinc-500">{t.themes.builderBlocks}</div>
        </div>

        {/* Produktgalerie: Style-Art + Bild-Badge */}
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
          <div className="text-[12px] font-semibold text-white mb-1.5">{t.themes.editorGallery}</div>
          <div className="flex flex-wrap gap-1.5">
            {GALLERY_PRESETS.map((p) => {
              const on = (doc.buybox.gallery?.presetId || GALLERY_PRESETS[0].id) === p.id;
              return (
                <button
                  key={p.id}
                  title={p.hint}
                  onClick={() => dispatch({ type: "setGallery", patch: { presetId: p.id } })}
                  className={`rounded-full border px-2.5 py-1 text-[10.5px] font-semibold transition ${
                    on ? "border-[#95BF47]/70 bg-[#95BF47]/15 text-white" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white"
                  }`}
                >
                  {lang === "en" ? p.labelEn : p.label}
                </button>
              );
            })}
          </div>
          <label className="block mt-2">
            <span className="block text-[10px] text-zinc-500 mb-0.5">{t.themes.editorGalleryBadge}</span>
            <input
              value={doc.buybox.gallery?.badge ?? ""}
              placeholder="BESTSELLER"
              onChange={(e) => dispatch({ type: "setGallery", patch: { badge: e.target.value } })}
              className="w-full bg-white/[0.04] border border-white/10 rounded-md px-2 py-1.5 text-[11.5px] text-white placeholder:text-zinc-600 outline-none focus:border-[#95BF47]/40"
            />
          </label>
        </div>

        {/* Abstand zwischen den Bausteinen */}
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] font-semibold text-white">{t.themes.editorBuyboxSpacing}</span>
            <span className="text-[11px] font-mono text-zinc-400">{doc.buybox.spacing ?? 15}px</span>
          </div>
          <input
            type="range"
            min={4}
            max={40}
            step={1}
            value={doc.buybox.spacing ?? 15}
            onChange={(e) => dispatch({ type: "setBuybox", patch: { spacing: Number(e.target.value) } })}
            className="w-full accent-[#95BF47] cursor-pointer"
          />
        </div>

        {/* Aktionsleiste: Baustein hinzufügen + automatisch anordnen */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onOpenBuyboxGallery}
            className="flex items-center justify-center gap-1.5 rounded-lg text-[12px] font-bold px-3 py-2.5 text-white hover:brightness-110 transition"
            style={{ background: "#95BF47" }}
          >
            <Plus className="w-4 h-4" /> {t.themes.editorBuyboxAdd}
          </button>
          <button
            onClick={() => dispatch({ type: "arrangeBuybox", canonical: BUYBOX_CANONICAL_ORDER })}
            title={t.themes.editorBuyboxArrangeHint}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] text-[12px] font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.08] transition"
          >
            <ArrowDownUp className="w-3.5 h-3.5" /> {t.themes.editorBuyboxArrange}
          </button>
        </div>
        <p className="text-[10.5px] text-zinc-500 -mt-1">{t.themes.editorBuyboxDragHint}</p>

        {/* Baustein-Liste: Drag & Drop zum Verschieben, Karte öffnet Einstellungen */}
        <div className="space-y-1.5">
          {doc.buybox.order.map((type, i) => {
            const expanded = expandedType === type;
            const lib = getBuyboxLib(type);
            const hasConfig = !!lib && ((lib.presets.length || 0) > 0 || (lib.fields.length || 0) > 0);
            const meta = getBuyboxMeta(type);
            const isOver = overIdx === i && dragIdx !== null && dragIdx !== i;
            return (
              <div
                key={type}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => { e.preventDefault(); if (overIdx !== i) setOverIdx(i); }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIdx === null || dragIdx === i) { setDragIdx(null); setOverIdx(null); return; }
                  const order = [...doc.buybox.order];
                  const [moved] = order.splice(dragIdx, 1);
                  order.splice(i, 0, moved);
                  dispatch({ type: "reorderBuybox", order });
                  setDragIdx(null); setOverIdx(null);
                }}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                className={`rounded-lg border transition ${
                  expanded ? "border-[#95BF47]/50 bg-[#95BF47]/[0.06]" : "border-white/10 bg-white/[0.03]"
                } ${isOver ? "border-[#95BF47]/70 border-dashed" : ""} ${dragIdx === i ? "opacity-40" : ""}`}
              >
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <span className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300 shrink-0" title={t.themes.editorBuyboxDragHint}>
                    <GripVertical className="w-4 h-4" />
                  </span>
                  <span className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${expanded ? "bg-[#95BF47]/20 text-[#cfe9a3]" : "bg-white/[0.05] text-zinc-400"}`}>
                    <BlockIcon name={meta.icon} className="w-3.5 h-3.5" />
                  </span>
                  <button
                    onClick={() => onSelectBlock(expanded ? "__buybox" : `blk:${type}`)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <span className="block text-[12px] font-semibold text-white truncate">
                      {lang === "en" ? meta.labelEn : meta.label}
                      {BUYBOX_RUNTIME_ONLY.has(type) && <span className="ml-1 text-[8.5px] font-bold uppercase tracking-wider text-[#95BF47]/80 align-middle">Neu</span>}
                    </span>
                  </button>
                  {hasConfig && (
                    <button
                      onClick={() => onSelectBlock(expanded ? "__buybox" : `blk:${type}`)}
                      aria-label="Einstellungen"
                      className="text-zinc-400 hover:text-white shrink-0"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </button>
                  )}
                  <button
                    onClick={() => { dispatch({ type: "removeBuyboxBlock", blockType: type }); if (expanded) onSelectBlock("__buybox"); }}
                    aria-label={t.themes.editorBuyboxRemove}
                    title={t.themes.editorBuyboxRemove}
                    className="text-zinc-500 hover:text-red-300 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {expanded && hasConfig && <div className="px-2.5 pb-2.5">{blockConfig(type)}</div>}
              </div>
            );
          })}
        </div>

        {/* Vorteile-Icons */}
        <div>
          <div className="text-[11px] uppercase tracking-[0.13em] font-semibold text-zinc-400 mb-2">{t.themes.builderBenefitIcons}</div>
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => {
              const bLabel = previewData?.benefits?.[i]?.text || `Vorteil ${i + 1}`;
              const cur = doc.buybox.benefitIcons[i] || DEFAULT_BENEFIT_ICONS[i] || "check";
              return (
                <div key={i} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIconPickerFor(iconPickerFor === i ? null : i)}
                      className="w-8 h-8 shrink-0 rounded-md border border-white/15 bg-white/[0.05] text-white flex items-center justify-center hover:border-[#95BF47]/50 transition"
                      aria-label={`Icon für ${bLabel}`}
                    >
                      <IconSvg id={cur} size={17} />
                    </button>
                    <span className="text-[12px] text-zinc-300 flex-1 min-w-0 truncate">{bLabel}</span>
                  </div>
                  {iconPickerFor === i && (
                    <div className="grid grid-cols-6 gap-1.5 mt-2 pt-2 border-t border-white/[0.06]">
                      {THEME_ICONS.map((ic) => (
                        <button
                          key={ic.id}
                          title={ic.label}
                          onClick={() => {
                            const icons = [...doc.buybox.benefitIcons];
                            while (icons.length < 4) icons.push(DEFAULT_BENEFIT_ICONS[icons.length]);
                            icons[i] = ic.id;
                            dispatch({ type: "setBuybox", patch: { benefitIcons: icons } });
                            setIconPickerFor(null);
                          }}
                          className={`aspect-square rounded-md border flex items-center justify-center transition ${
                            cur === ic.id ? "border-[#95BF47]/60 bg-[#95BF47]/10 text-white" : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08]"
                          }`}
                        >
                          <IconSvg id={ic.id} size={16} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Nichts ausgewählt: globales Theme-Design ──
  const g = doc.global;
  const COLOR_FIELDS: { key: keyof typeof g.colors; label: string }[] = [
    { key: "button", label: t.themes.builderColorButton },
    { key: "buttonText", label: t.themes.builderColorButtonText },
    { key: "background", label: t.themes.builderColorBackground },
    { key: "text", label: t.themes.builderColorText },
    { key: "accent", label: t.themes.builderColorAccent },
  ];

  return (
    <div className="space-y-2.5">
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3 flex items-start gap-2.5">
        <MousePointerClick className="w-4 h-4 text-[#95BF47] shrink-0 mt-0.5" />
        <div>
          <div className="text-[12.5px] font-semibold text-white">{t.themes.editorInspectorEmpty}</div>
          <div className="text-[10.5px] text-zinc-500 leading-snug mt-0.5">{t.themes.editorInspectorEmptySub}</div>
        </div>
      </div>

      <Group id="stil" title={t.themes.builderStyle} open={!!openG.stil} onToggle={toggleG}>
        {(() => {
          const cur = THEME_STYLES.find((s) => s.id === g.styleId);
          return (
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 mb-2">
              <span className="flex -space-x-1 shrink-0">
                <span className="w-3.5 h-3.5 rounded-full border border-black/30" style={{ background: g.colors.accent }} />
                <span className="w-3.5 h-3.5 rounded-full border border-black/30" style={{ background: g.colors.button }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold text-white">{cur?.label || g.styleId}</span>
                <span className="block text-[10px] text-zinc-500 truncate">{cur?.hint || ""}</span>
              </span>
            </div>
          );
        })()}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onOpenStyles}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-[#95BF47]/40 bg-[#95BF47]/10 text-[12px] font-semibold text-[#cfe9a3] hover:text-white hover:bg-[#95BF47]/20 px-3 py-2.5 transition"
          >
            <PaletteIcon className="w-3.5 h-3.5" /> {t.themes.editorStyleGallery}
          </button>
          <button
            onClick={onRandomize}
            title={t.themes.builderRandomHint}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-[12px] font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.07] px-3 py-2.5 transition"
          >
            <Shuffle className="w-3.5 h-3.5" /> {t.themes.builderRandom}
          </button>
        </div>
      </Group>

      <Group id="farben" title={t.themes.builderColors} open={!!openG.farben} onToggle={toggleG}>
        <div className="grid grid-cols-2 gap-2">
          {COLOR_FIELDS.map((f) => (
            <div key={f.key}>
              <span className="block text-[10px] text-zinc-500 mb-1">{f.label}</span>
              <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-lg px-1.5 py-1">
                <input
                  type="color"
                  value={g.colors[f.key]}
                  onChange={(e) => dispatch({ type: "setColors", patch: { [f.key]: e.target.value } })}
                  className="w-7 h-7 rounded bg-transparent border-0 p-0 cursor-pointer shrink-0"
                />
                <input
                  type="text"
                  value={g.colors[f.key]}
                  onChange={(e) => dispatch({ type: "setColors", patch: { [f.key]: e.target.value } })}
                  className="w-full min-w-0 bg-transparent text-[11px] text-white outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      </Group>

      <Group id="typo" title={t.themes.builderTypography} open={!!openG.typo} onToggle={toggleG}>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] text-zinc-500 mb-1">{t.themes.builderFontHeading}</span>
            <select
              value={g.headingFont}
              onChange={(e) => dispatch({ type: "setGlobal", patch: { headingFont: e.target.value } })}
              className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2 py-2 text-sm text-white outline-none focus:border-[#95BF47]/40"
            >
              {EDITOR_FONTS.map((f) => <option key={f.value} value={f.value} className="bg-zinc-900">{f.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] text-zinc-500 mb-1">{t.themes.builderFontBody}</span>
            <select
              value={g.bodyFont}
              onChange={(e) => dispatch({ type: "setGlobal", patch: { bodyFont: e.target.value } })}
              className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2 py-2 text-sm text-white outline-none focus:border-[#95BF47]/40"
            >
              {EDITOR_FONTS.map((f) => <option key={f.value} value={f.value} className="bg-zinc-900">{f.label}</option>)}
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between mt-3 mb-1">
          <span className="text-[11px] text-zinc-500">{t.themes.builderCorners}</span>
          <span className="text-[11px] font-mono text-zinc-400">{g.radius}px</span>
        </div>
        <input
          type="range"
          min={0}
          max={40}
          step={1}
          value={g.radius}
          onChange={(e) => dispatch({ type: "setGlobal", patch: { radius: Number(e.target.value) } })}
          className="w-full accent-[#95BF47] cursor-pointer"
        />
      </Group>

      <Group id="design" title={t.themes.builderDesign} open={!!openG.design} onToggle={toggleG}>
        <div className="space-y-2.5">
          <div>
            <span className="block text-[10px] text-zinc-500 mb-1">{t.themes.builderShadow}</span>
            <div className="grid grid-cols-3 gap-1.5">
              {([[0, "Aus"], [1, "Weich"], [2, "Stark"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => dispatch({ type: "setGlobal", patch: { design: { ...g.design, shadow: v } } })} className={segCls(g.design.shadow === v)}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="block text-[10px] text-zinc-500 mb-1">{t.themes.builderBorder}</span>
            <div className="grid grid-cols-2 gap-1.5">
              {([[1, "Dünn"], [2, "Dick"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => dispatch({ type: "setGlobal", patch: { design: { ...g.design, border: v } } })} className={segCls(g.design.border === v)}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="block text-[10px] text-zinc-500 mb-1">{t.themes.builderIcons}</span>
            <div className="grid grid-cols-3 gap-1.5">
              {([["dark", "Dunkel"], ["accent", "Akzent"], ["outline", "Umriss"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => dispatch({ type: "setGlobal", patch: { design: { ...g.design, iconStyle: v } } })} className={segCls(g.design.iconStyle === v)}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      </Group>
    </div>
  );
}
