"use client";

// ─── Inspector (rechtes Editor-Panel) ───────────────────────────────
// Kontextabhängig: ausgewählte Section (Style-Art + Texte + Aktionen),
// Kaufbox (Baustein-Manager + Vorteile-Icons) oder — ohne Auswahl — das
// globale Theme-Design (Stil, Farben, Schriften/Ecken, Design).

import { useState, type ReactNode } from "react";
import { Reorder, useDragControls } from "framer-motion";
import {
  ChevronDown, ChevronUp, Trash2, Shuffle, MousePointerClick, Palette as PaletteIcon,
  Plus, ArrowDownUp, GripVertical,
  Type, Tag, SlidersHorizontal, Hash, ShoppingCart, Layers, Megaphone, Flame,
  PackageCheck, BatteryLow, Gift, Users, Star, ListChecks, ShieldCheck,
  BadgeCheck, CheckCheck, CreditCard, Truck, LayoutGrid, Sparkles, AlignLeft,
  ChevronsDownUp, PanelBottomOpen, PackagePlus, Pilcrow, Minus, Share2, Square,
  LayoutPanelTop,
  type LucideIcon,
} from "lucide-react";
import type { ThemeDocument, EditorAction } from "@/lib/theme-doc";
import type { PreviewData } from "@/components/ThemePreview";
import { getSectionDef, getBuyboxLib, GALLERY_PRESETS, getBuyboxControls, resolveBlockSettings } from "@/lib/theme-library";
import { THEME_STYLES } from "@/lib/theme-styles";
import { getBuyboxMeta, BUYBOX_CANONICAL_ORDER, BUYBOX_RUNTIME_ONLY } from "@/lib/theme-sections";
import { THEME_ICONS, DEFAULT_BENEFIT_ICONS, getIcon } from "@/lib/theme-icons";
import { useI18n } from "@/lib/i18n";
import { EDITOR_FONTS, segCls, ACCENT } from "@/components/theme-editor/editor-ui";
import { GroupTitle, PresetPill, FieldLabel, TextField, Segmented, ColorField, SliderField } from "@/components/theme-editor/ui";

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

// Eine Baustein-Zeile in der sortierbaren Liste. Drag startet NUR am
// Greif-Symbol (dragListener=false + eigene DragControls) — so bleiben
// Aufklappen/Entfernen klickbar. Framer animiert das Einrasten zwischen
// den Zeilen automatisch.
function BuyboxRow({
  type, expanded, iconName, label, isNew, hasConfig, onToggle, onRemove, dragTitle, removeLabel, children,
}: {
  type: string; expanded: boolean; iconName: string; label: string; isNew: boolean; hasConfig: boolean;
  onToggle: () => void; onRemove: () => void; dragTitle: string; removeLabel: string; children?: ReactNode;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={type}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.015, zIndex: 40, boxShadow: "0 12px 26px -10px rgba(0,0,0,0.6)" }}
      transition={{ duration: 0.16 }}
      className={`list-none rounded-lg border ${
        expanded ? "border-[#95BF47]/50 bg-[#95BF47]/[0.06]" : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="flex items-center gap-1 px-1.5 py-[3px]">
        <span
          onPointerDown={(e) => controls.start(e)}
          title={dragTitle}
          style={{ touchAction: "none" }}
          className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300 shrink-0"
        >
          <GripVertical className="w-3 h-3" />
        </span>
        <span className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${expanded ? "bg-[#95BF47]/20 text-[#cfe9a3]" : "bg-white/[0.05] text-zinc-400"}`}>
          <BlockIcon name={iconName} className="w-3 h-3" />
        </span>
        <button onClick={onToggle} className="flex-1 min-w-0 text-left">
          <span className="block text-[11px] font-semibold text-white truncate">
            {label}
            {isNew && <span className="ml-1 text-[8px] font-bold uppercase tracking-wider text-[#95BF47]/80 align-middle">Neu</span>}
          </span>
        </button>
        {hasConfig && (
          <button onClick={onToggle} aria-label="Einstellungen" className="text-zinc-400 hover:text-white shrink-0 p-0.5">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
        <button onClick={onRemove} aria-label={removeLabel} title={removeLabel} className="text-zinc-500 hover:text-red-300 shrink-0 p-0.5">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      {expanded && hasConfig && <div className="px-2 pb-2">{children}</div>}
    </Reorder.Item>
  );
}

function Group({ id, title, open, onToggle, children }: { id: string; title: string; open: boolean; onToggle: (id: string) => void; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <button onClick={() => onToggle(id)} className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-white/[0.02] transition">
        <span className="text-[9.5px] uppercase tracking-[0.12em] font-bold text-white">{title}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-2.5 pb-2.5 pt-1 border-t border-white/[0.05]">{children}</div>}
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
      <div className="space-y-1.5">
        {/* Kompakter Kopf: Icon + Name + Verschieben (eine Zeile) */}
        <div className="flex items-center gap-2 rounded-lg border border-[#95BF47]/25 bg-[#95BF47]/[0.08] px-2 py-1.5">
          <span className="w-7 h-7 shrink-0 rounded-md flex items-center justify-center" style={{ background: "rgba(149,191,71,0.14)", color: ACCENT }}>
            <LayoutPanelTop className="w-4 h-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-bold text-white truncate leading-tight">{def ? (lang === "en" ? def.labelEn : def.label) : section.type}</div>
            <div className="text-[9.5px] text-zinc-400 truncate leading-tight">{def ? (lang === "en" ? def.descEn : def.desc) : ""}</div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={() => dispatch({ type: "moveSection", uid: section.uid, dir: -1 })} disabled={idx <= 0} className="w-6 h-6 rounded border border-white/10 bg-white/[0.05] text-zinc-300 hover:text-white disabled:opacity-25 flex items-center justify-center" aria-label="hoch"><ChevronUp className="w-3.5 h-3.5" /></button>
            <button onClick={() => dispatch({ type: "moveSection", uid: section.uid, dir: 1 })} disabled={idx >= sectionList.length - 1} className="w-6 h-6 rounded border border-white/10 bg-white/[0.05] text-zinc-300 hover:text-white disabled:opacity-25 flex items-center justify-center" aria-label="runter"><ChevronDown className="w-3.5 h-3.5" /></button>
            <button onClick={() => { dispatch({ type: "removeSection", uid: section.uid }); onClearSelect(); }} className="w-6 h-6 rounded border border-red-400/25 bg-red-500/[0.08] text-red-300 hover:bg-red-500/[0.16] flex items-center justify-center" aria-label={t.themes.editorRemove}><Trash2 className="w-3 h-3" /></button>
          </div>
        </div>

        {/* Style-Arten als kompakte Pillen (mehrere pro Zeile) */}
        {def && def.presets.length > 0 && (
          <div>
            <GroupTitle>{t.themes.editorPreset}</GroupTitle>
            <div className="flex flex-wrap gap-1">
              {def.presets.map((p) => (
                <PresetPill
                  key={p.id}
                  label={lang === "en" ? p.labelEn : p.label}
                  hint={p.hint}
                  active={p.id === section.presetId || (!section.presetId && p.id === def.presets[0].id)}
                  onClick={() => dispatch({ type: "setPreset", uid: section.uid, presetId: p.id })}
                />
              ))}
            </div>
          </div>
        )}

        {/* Kuratierte Texte */}
        {def && def.fields.length > 0 && (
          <div>
            <GroupTitle>{t.themes.editorTexts}</GroupTitle>
            <div className="space-y-1.5">
              {def.fields.map((f) => (
                <label key={f.id} className="block">
                  <FieldLabel>{lang === "en" ? f.labelEn : f.label}</FieldLabel>
                  <TextField
                    value={section.texts[f.id] ?? ""}
                    placeholder={f.def}
                    textarea={f.kind === "textarea"}
                    onChange={(v) => dispatch({ type: "setText", uid: section.uid, field: f.id, value: v })}
                  />
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Kaufbox ausgewählt (Panel oder einzelner Baustein via "blk:<typ>") ──
  const blkSelected = selected && selected.startsWith("blk:") ? selected.slice(4) : null;
  if (selected === "__buybox" || blkSelected) {
    const expandedType = blkSelected;

    // Konfiguration EINES Bausteins: Style-Arten + Texte + Feineinstellungen.
    const blockConfig = (type: string) => {
      const lib = getBuyboxLib(type);
      const controls = getBuyboxControls(type);
      if (!lib || (!lib.presets.length && !lib.fields.length && !controls.length)) return null;
      const cfg = doc.buybox.blocks[type];
      const eff = resolveBlockSettings(type, cfg, doc.global.colors, doc.global.design);
      const val = (k: string) => cfg?.settings?.[k] ?? eff[k];
      const colorCtrls = controls.filter((c) => c.kind === "color");
      const otherCtrls = controls.filter((c) => c.kind !== "color");
      const renderCtrl = (c: (typeof controls)[number]) => (
        <div key={c.key}>
          {c.kind === "slider" ? (
            <FieldLabel right={`${Math.round(Number(val(c.key)) || c.min || 0)}${c.suffix || ""}`}>{lang === "en" ? c.labelEn : c.label}</FieldLabel>
          ) : (
            <FieldLabel>{lang === "en" ? c.labelEn : c.label}</FieldLabel>
          )}
          {c.kind === "color" && (
            <ColorField value={String(val(c.key) ?? "#888888")} onChange={(v) => dispatch({ type: "setBlockSetting", blockType: type, key: c.key, value: v })} />
          )}
          {c.kind === "slider" && (
            <SliderField value={Math.round(Number(val(c.key)) || c.min || 0)} min={c.min || 0} max={c.max || 100} step={c.step || 1} suffix={c.suffix} onChange={(v) => dispatch({ type: "setBlockSetting", blockType: type, key: c.key, value: v })} />
          )}
          {c.kind === "segment" && c.options && (
            <Segmented
              options={c.options.map((o) => [o.value, lang === "en" ? o.labelEn : o.label] as const)}
              value={String(val(c.key) ?? c.options[0].value)}
              onChange={(v) => dispatch({ type: "setBlockSetting", blockType: type, key: c.key, value: v })}
            />
          )}
        </div>
      );
      return (
        <div className="mt-1 pt-1.5 border-t border-white/[0.06] space-y-1">
          {lib.presets.length > 0 && (
            <div>
              <FieldLabel>{t.themes.editorPreset}</FieldLabel>
              <div className="flex flex-wrap gap-1">
                {lib.presets.map((p) => (
                  <PresetPill
                    key={p.id}
                    label={lang === "en" ? p.labelEn : p.label}
                    hint={p.hint}
                    active={cfg?.presetId === p.id}
                    onClick={() => dispatch({ type: "setBlockPreset", blockType: type, presetId: p.id })}
                  />
                ))}
              </div>
            </div>
          )}
          {lib.fields.map((f) =>
            f.kind === "textarea" ? (
              <label key={f.id} className="block">
                <FieldLabel>{lang === "en" ? f.labelEn : f.label}</FieldLabel>
                <TextField
                  value={cfg?.texts?.[f.id] ?? ""}
                  placeholder={f.def || (lang === "en" ? f.labelEn : f.label)}
                  textarea
                  onChange={(v) => dispatch({ type: "setBlockText", blockType: type, field: f.id, value: v })}
                />
              </label>
            ) : (
              // Kurzes Feld: Label links, Eingabe rechts (platzsparend bei Listen)
              <label key={f.id} className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-400 w-14 shrink-0 truncate" title={lang === "en" ? f.labelEn : f.label}>{lang === "en" ? f.labelEn : f.label}</span>
                <span className="flex-1 min-w-0">
                  <TextField
                    value={cfg?.texts?.[f.id] ?? ""}
                    placeholder={f.def || (lang === "en" ? f.labelEn : f.label)}
                    onChange={(v) => dispatch({ type: "setBlockText", blockType: type, field: f.id, value: v })}
                  />
                </span>
              </label>
            )
          )}
          {otherCtrls.length > 0 && <div className="space-y-1.5">{otherCtrls.map(renderCtrl)}</div>}
          {colorCtrls.length > 0 && <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">{colorCtrls.map(renderCtrl)}</div>}
        </div>
      );
    };

    return (
      <div className="space-y-1.5">
        <div className="rounded-lg border border-[#95BF47]/25 bg-[#95BF47]/[0.06] px-2.5 py-1.5">
          <div className="text-[12px] font-bold text-white leading-tight">{t.themes.editorBuybox}</div>
          <div className="text-[10px] text-zinc-500">{t.themes.builderBlocks}</div>
        </div>

        {/* Produktgalerie: Style-Art + Bild-Badge */}
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
          <div className="text-[11px] font-semibold text-white mb-1">{t.themes.editorGallery}</div>
          <div className="flex flex-wrap gap-1">
            {GALLERY_PRESETS.map((p) => {
              const on = (doc.buybox.gallery?.presetId || GALLERY_PRESETS[0].id) === p.id;
              return (
                <button
                  key={p.id}
                  title={p.hint}
                  onClick={() => dispatch({ type: "setGallery", patch: { presetId: p.id } })}
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition ${
                    on ? "border-[#95BF47]/70 bg-[#95BF47]/15 text-white" : "border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white"
                  }`}
                >
                  {lang === "en" ? p.labelEn : p.label}
                </button>
              );
            })}
          </div>
          <label className="block mt-1.5">
            <FieldLabel>{t.themes.editorGalleryBadge}</FieldLabel>
            <TextField
              value={doc.buybox.gallery?.badge ?? ""}
              placeholder="BESTSELLER"
              onChange={(v) => dispatch({ type: "setGallery", patch: { badge: v } })}
            />
          </label>
        </div>

        {/* Abstand zwischen den Bausteinen */}
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
          <FieldLabel right={`${doc.buybox.spacing ?? 15}px`}>{t.themes.editorBuyboxSpacing}</FieldLabel>
          <SliderField
            value={doc.buybox.spacing ?? 15}
            min={4}
            max={40}
            suffix="px"
            onChange={(v) => dispatch({ type: "setBuybox", patch: { spacing: v } })}
          />
        </div>

        {/* Aktionsleiste: Baustein hinzufügen + automatisch anordnen */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={onOpenBuyboxGallery}
            className="flex items-center justify-center gap-1.5 rounded-md text-[11.5px] font-bold px-2 py-2 text-white hover:brightness-110 transition"
            style={{ background: "#95BF47" }}
          >
            <Plus className="w-3.5 h-3.5" /> {t.themes.editorBuyboxAdd}
          </button>
          <button
            onClick={() => dispatch({ type: "arrangeBuybox", canonical: BUYBOX_CANONICAL_ORDER })}
            title={t.themes.editorBuyboxArrangeHint}
            className="flex items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] text-[11.5px] font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.08] transition"
          >
            <ArrowDownUp className="w-3.5 h-3.5" /> {t.themes.editorBuyboxArrange}
          </button>
        </div>
        <p className="text-[10px] text-zinc-500 -mt-0.5">{t.themes.editorBuyboxDragHint}</p>

        {/* Baustein-Liste: Ziehen am Greif-Symbol rastet zwischen den Zeilen ein */}
        <Reorder.Group
          axis="y"
          values={doc.buybox.order}
          onReorder={(order) => dispatch({ type: "reorderBuybox", order })}
          className="space-y-[3px]"
        >
          {doc.buybox.order.map((type) => {
            const expanded = expandedType === type;
            const lib = getBuyboxLib(type);
            const hasConfig = (!!lib && ((lib.presets.length || 0) > 0 || (lib.fields.length || 0) > 0)) || getBuyboxControls(type).length > 0;
            const meta = getBuyboxMeta(type);
            return (
              <BuyboxRow
                key={type}
                type={type}
                expanded={expanded}
                iconName={meta.icon}
                label={lang === "en" ? meta.labelEn : meta.label}
                isNew={BUYBOX_RUNTIME_ONLY.has(type)}
                hasConfig={hasConfig}
                onToggle={() => onSelectBlock(expanded ? "__buybox" : `blk:${type}`)}
                onRemove={() => { dispatch({ type: "removeBuyboxBlock", blockType: type }); if (expanded) onSelectBlock("__buybox"); }}
                dragTitle={t.themes.editorBuyboxDragHint}
                removeLabel={t.themes.editorBuyboxRemove}
              >
                {expanded && hasConfig ? blockConfig(type) : null}
              </BuyboxRow>
            );
          })}
        </Reorder.Group>

        {/* Vorteile-Icons */}
        <div>
          <GroupTitle>{t.themes.builderBenefitIcons}</GroupTitle>
          <div className="space-y-1">
            {[0, 1, 2, 3].map((i) => {
              const bLabel = previewData?.benefits?.[i]?.text || `Vorteil ${i + 1}`;
              const cur = doc.buybox.benefitIcons[i] || DEFAULT_BENEFIT_ICONS[i] || "check";
              return (
                <div key={i} className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIconPickerFor(iconPickerFor === i ? null : i)}
                      className="w-7 h-7 shrink-0 rounded-md border border-white/15 bg-white/[0.05] text-white flex items-center justify-center hover:border-[#95BF47]/50 transition"
                      aria-label={`Icon für ${bLabel}`}
                    >
                      <IconSvg id={cur} size={15} />
                    </button>
                    <span className="text-[11px] text-zinc-300 flex-1 min-w-0 truncate">{bLabel}</span>
                  </div>
                  {iconPickerFor === i && (
                    <div className="grid grid-cols-7 gap-1 mt-1.5 pt-1.5 border-t border-white/[0.06]">
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
    <div className="space-y-1.5">
      <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-2 flex items-start gap-2">
        <MousePointerClick className="w-3.5 h-3.5 text-[#95BF47] shrink-0 mt-0.5" />
        <div>
          <div className="text-[11.5px] font-semibold text-white">{t.themes.editorInspectorEmpty}</div>
          <div className="text-[10px] text-zinc-500 leading-snug mt-0.5">{t.themes.editorInspectorEmptySub}</div>
        </div>
      </div>

      <Group id="stil" title={t.themes.builderStyle} open={!!openG.stil} onToggle={toggleG}>
        {(() => {
          const cur = THEME_STYLES.find((s) => s.id === g.styleId);
          return (
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 mb-1.5">
              <span className="flex -space-x-1 shrink-0">
                <span className="w-3 h-3 rounded-full border border-black/30" style={{ background: g.colors.accent }} />
                <span className="w-3 h-3 rounded-full border border-black/30" style={{ background: g.colors.button }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11.5px] font-semibold text-white leading-tight">{cur?.label || g.styleId}</span>
                <span className="block text-[9.5px] text-zinc-500 truncate">{cur?.hint || ""}</span>
              </span>
            </div>
          );
        })()}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={onOpenStyles}
            className="flex items-center justify-center gap-1.5 rounded-md border border-[#95BF47]/40 bg-[#95BF47]/10 text-[11px] font-semibold text-[#cfe9a3] hover:text-white hover:bg-[#95BF47]/20 px-2 py-1.5 transition"
          >
            <PaletteIcon className="w-3 h-3" /> {t.themes.editorStyleGallery}
          </button>
          <button
            onClick={onRandomize}
            title={t.themes.builderRandomHint}
            className="flex items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] text-[11px] font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.07] px-2 py-1.5 transition"
          >
            <Shuffle className="w-3 h-3" /> {t.themes.builderRandom}
          </button>
        </div>
      </Group>

      <Group id="farben" title={t.themes.builderColors} open={!!openG.farben} onToggle={toggleG}>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
          {COLOR_FIELDS.map((f) => (
            <div key={f.key}>
              <FieldLabel>{f.label}</FieldLabel>
              <ColorField
                value={g.colors[f.key]}
                onChange={(v) => dispatch({ type: "setColors", patch: { [f.key]: v } })}
              />
            </div>
          ))}
        </div>
      </Group>

      <Group id="typo" title={t.themes.builderTypography} open={!!openG.typo} onToggle={toggleG}>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <FieldLabel>{t.themes.builderFontHeading}</FieldLabel>
            <select
              value={g.headingFont}
              onChange={(e) => dispatch({ type: "setGlobal", patch: { headingFont: e.target.value } })}
              className="w-full bg-black/25 border border-white/[0.1] rounded-md px-1.5 py-1 text-[11.5px] text-white outline-none focus:border-[#95BF47]/50"
            >
              {EDITOR_FONTS.map((f) => <option key={f.value} value={f.value} className="bg-zinc-900">{f.label}</option>)}
            </select>
          </label>
          <label className="block">
            <FieldLabel>{t.themes.builderFontBody}</FieldLabel>
            <select
              value={g.bodyFont}
              onChange={(e) => dispatch({ type: "setGlobal", patch: { bodyFont: e.target.value } })}
              className="w-full bg-black/25 border border-white/[0.1] rounded-md px-1.5 py-1 text-[11.5px] text-white outline-none focus:border-[#95BF47]/50"
            >
              {EDITOR_FONTS.map((f) => <option key={f.value} value={f.value} className="bg-zinc-900">{f.label}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-2">
          <FieldLabel right={`${g.radius}px`}>{t.themes.builderCorners}</FieldLabel>
          <SliderField value={g.radius} min={0} max={40} suffix="px" onChange={(v) => dispatch({ type: "setGlobal", patch: { radius: v } })} />
        </div>
      </Group>

      <Group id="design" title={t.themes.builderDesign} open={!!openG.design} onToggle={toggleG}>
        <div className="space-y-2">
          <div>
            <FieldLabel>{t.themes.builderShadow}</FieldLabel>
            <div className="grid grid-cols-3 gap-1">
              {([[0, "Aus"], [1, "Weich"], [2, "Stark"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => dispatch({ type: "setGlobal", patch: { design: { ...g.design, shadow: v } } })} className={segCls(g.design.shadow === v)}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>{t.themes.builderBorder}</FieldLabel>
            <div className="grid grid-cols-2 gap-1">
              {([[1, "Dünn"], [2, "Dick"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => dispatch({ type: "setGlobal", patch: { design: { ...g.design, border: v } } })} className={segCls(g.design.border === v)}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>{t.themes.builderIcons}</FieldLabel>
            <div className="grid grid-cols-3 gap-1">
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
