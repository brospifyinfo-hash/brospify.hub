"use client";

// ─── Inspector (rechtes Editor-Panel) ───────────────────────────────
// Kontextabhängig: ausgewählte Section (Style-Art + Texte + Aktionen),
// Kaufbox (Baustein-Manager + Vorteile-Icons) oder — ohne Auswahl — das
// globale Theme-Design (Stil, Farben, Schriften/Ecken, Design).

import { useState, type ReactNode } from "react";
import {
  ChevronDown, ChevronUp, Trash2, Shuffle, MousePointerClick, Palette as PaletteIcon,
  Copy, Paintbrush, Pencil, Image as ImageIcon,
  Type, Tag, SlidersHorizontal, Hash, ShoppingCart, Layers, Megaphone, Flame,
  PackageCheck, BatteryLow, Gift, Users, Star, ListChecks, ShieldCheck,
  BadgeCheck, CheckCheck, CreditCard, Truck, LayoutGrid, Sparkles, AlignLeft,
  ChevronsDownUp, PanelBottomOpen, PackagePlus, Pilcrow, Minus, Share2, Square,
  LayoutPanelTop, Clock, Award, Table,
  Boxes, Quote, Timer, RotateCcw, UserCheck, Scale, Ticket, Calculator,
  type LucideIcon,
} from "lucide-react";
import type { ThemeDocument, EditorAction } from "@/lib/theme-doc";
import type { PreviewData } from "@/components/ThemePreview";
import {
  getSectionDef, getBuyboxLib, GALLERY_PRESETS, getBuyboxControls, resolveBlockSettings,
  sectionSupportsDesign, sectionToneSettings, CATEGORY_LABELS, type SectionTone,
} from "@/lib/theme-library";
import { THEME_STYLES } from "@/lib/theme-styles";
import { getBuyboxMeta } from "@/lib/theme-sections";
import { DEFAULT_BENEFIT_ICONS } from "@/lib/theme-icons";
import { getIconAny, searchIcons } from "@/lib/theme-icon-resolver";
import { DIVIDER_PATHS, DIVIDER_TOP_PATHS, DIVIDER_SHAPES, DIVIDER_LABELS } from "@/lib/theme-frame";
import { useI18n } from "@/lib/i18n";
import { EDITOR_FONTS, segCls, ACCENT } from "@/components/theme-editor/editor-ui";
import { PresetPill, FieldLabel, TextField, Segmented, ColorField, SliderField } from "@/components/theme-editor/ui";
import { ImageUploadField } from "@/components/theme-editor/ImageUploadField";

const BLOCK_ICONS: Record<string, LucideIcon> = {
  Type, Tag, SlidersHorizontal, Hash, ShoppingCart, Layers, Megaphone, Flame,
  PackageCheck, BatteryLow, Gift, Users, Star, ListChecks, ShieldCheck,
  BadgeCheck, CheckCheck, CreditCard, Truck, LayoutGrid, Sparkles, AlignLeft,
  ChevronsDownUp, PanelBottomOpen, PackagePlus, Pilcrow, Minus, Share2, Square,
  Clock, Award, Table,
  Boxes, Quote, Timer, RotateCcw, UserCheck, Scale, Ticket, Calculator,
};
export function BlockIcon({ name, className }: { name: string; className?: string }) {
  const C = BLOCK_ICONS[name] || Square;
  return <C className={className} />;
}

function IconSvg({ id, size = 16 }: { id: string; size?: number }) {
  const ic = getIconAny(id);
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {ic.paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

// Divider-Formen-Auswahl mit Mini-Vorschau der SVG-Form (7 Optionen).
// `top` zeigt die Oberkanten-Variante der Form (gespiegelte Pfade) — das
// Thumbnail entspricht damit exakt dem, was gerendert wird.
function DividerPicker({ value, onChange, lang, top }: { value: string; onChange: (v: string) => void; lang: string; top?: boolean }) {
  const paths = top ? DIVIDER_TOP_PATHS : DIVIDER_PATHS;
  const label = (k: string) =>
    lang === "en"
      ? ({ none: "Off", wave: "Wave", waves: "Waves", zigzag: "Zigzag", slant: "Slant", curve: "Curve", peaks: "Peaks" }[k] || k)
      : (DIVIDER_LABELS[k] || k);
  return (
    <div className="grid grid-cols-4 gap-1">
      {["none", ...DIVIDER_SHAPES].map((k) => (
        <button
          key={k}
          type="button"
          className={segCls(value === k)}
          onClick={() => onChange(k)}
          title={label(k)}
        >
          {k === "none" ? (
            <span className="block text-center leading-[14px]">{label(k)}</span>
          ) : (
            <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="block h-[14px] w-full opacity-90" aria-label={label(k)}>
              <path d={paths[k]} fill="currentColor" />
            </svg>
          )}
        </button>
      ))}
    </div>
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

/** Kleiner Hilfetext — erklärt in einem Satz, was ein Bereich tut. */
function HelpText({ children }: { children: ReactNode }) {
  return <p className="text-[9.5px] leading-relaxed text-zinc-500 mb-2">{children}</p>;
}

/** Klar abgegrenzte Editor-Gruppe mit Icon, Titel und optionalem Hilfetext.
 *  Macht den Inspector verständlicher — jeder Bereich sagt, wofür er da ist. */
function SecGroup({ icon, title, help, right, children }: { icon: ReactNode; title: string; help?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.015] p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[#95BF47] shrink-0 flex">{icon}</span>
        <span className="text-[9.5px] font-bold uppercase tracking-[0.11em] text-white flex-1">{title}</span>
        {right}
      </div>
      {help && <HelpText>{help}</HelpText>}
      {children}
    </div>
  );
}

/** Vorteile-Icons je Kaufbox-Vorteil (1.700+ durchsuchbar). Wohnt jetzt
 *  KONTEXTUELL im „Vorteile-Liste"-Baustein statt lose unter der Bausteinliste. */
function BenefitIconsEditor({ icons, labels, onPick }: { icons: string[]; labels: string[]; onPick: (i: number, id: string) => void }) {
  const { lang } = useI18n();
  const [openFor, setOpenFor] = useState<number | null>(null);
  const [q, setQ] = useState("");
  return (
    <div className="space-y-1">
      {[0, 1, 2, 3].map((i) => {
        const cur = icons[i] || DEFAULT_BENEFIT_ICONS[i] || "check";
        const label = labels[i] || `${lang === "en" ? "Benefit" : "Vorteil"} ${i + 1}`;
        return (
          <div key={i} className="rounded-md border border-white/10 bg-white/[0.03] p-1.5">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOpenFor(openFor === i ? null : i)}
                className="w-7 h-7 shrink-0 rounded-md border border-white/15 bg-white/[0.05] text-white flex items-center justify-center hover:border-[#95BF47]/50 transition"
                aria-label={label}
              >
                <IconSvg id={cur} size={15} />
              </button>
              <span className="text-[11px] text-zinc-300 flex-1 min-w-0 truncate">{label}</span>
            </div>
            {openFor === i && (
              <div className="mt-1.5 pt-1.5 border-t border-white/[0.06]">
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={lang === "en" ? "Search 1,700+ icons…" : "1.700+ Icons durchsuchen…"}
                  className="w-full mb-1.5 rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 text-[11px] text-white placeholder:text-zinc-500 focus:border-[#95BF47]/50 focus:outline-none"
                />
                <div className="grid grid-cols-7 gap-1 max-h-44 overflow-y-auto">
                  {searchIcons(q, 63).map((ic) => (
                    <button
                      key={ic.id}
                      title={ic.label}
                      onClick={() => { onPick(i, ic.id); setOpenFor(null); }}
                      className={`aspect-square rounded-md border flex items-center justify-center transition ${
                        cur === ic.id ? "border-[#95BF47]/60 bg-[#95BF47]/10 text-white" : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08]"
                      }`}
                    >
                      <IconSvg id={ic.id} size={16} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Inspector({
  doc, dispatch, selected, onClearSelect, onOpenStyles, onRandomize, previewData,
}: {
  doc: ThemeDocument;
  dispatch: (a: EditorAction) => void;
  selected: string | null;
  onClearSelect: () => void;
  /** Öffnet die Stil-Galerie (Stil-Wechsel läuft nur noch darüber). */
  onOpenStyles: () => void;
  onRandomize: () => void;
  previewData: PreviewData | null;
}) {
  const { t, lang } = useI18n();
  const [openG, setOpenG] = useState<Record<string, boolean>>({ stil: true });
  const toggleG = (id: string) => setOpenG((o) => ({ ...o, [id]: !o[id] }));

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
    const cat = def ? CATEGORY_LABELS[def.category] : null;
    const toneVal = String(section.settings?.sec_tone || (section.settings?.sec_bg ? "custom" : "none"));
    return (
      <div className="space-y-2.5">
        {/* Kopf: Icon + Name + Beschreibung + Kategorie, dazu Verschieben */}
        <div className="rounded-lg border border-[#95BF47]/25 bg-gradient-to-b from-[#95BF47]/[0.12] to-transparent px-2 py-2">
          <div className="flex items-start gap-2">
            <span className="w-7 h-7 shrink-0 rounded-md flex items-center justify-center" style={{ background: "rgba(149,191,71,0.14)", color: ACCENT }}>
              <LayoutPanelTop className="w-4 h-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-bold text-white truncate leading-tight">{def ? (lang === "en" ? def.labelEn : def.label) : section.type}</div>
              <div className="text-[9.5px] text-zinc-400 leading-snug mt-0.5">{def ? (lang === "en" ? def.descEn : def.desc) : ""}</div>
              {cat && (
                <span className="inline-block mt-1 rounded-full border border-white/10 bg-white/[0.05] px-1.5 py-[1px] text-[8.5px] font-semibold uppercase tracking-wider text-zinc-400">
                  {lang === "en" ? cat.en : cat.de}
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button onClick={() => dispatch({ type: "moveSection", uid: section.uid, dir: -1 })} disabled={idx <= 0} className="w-6 h-6 rounded border border-white/10 bg-white/[0.05] text-zinc-300 hover:text-white disabled:opacity-25 flex items-center justify-center" aria-label={lang === "en" ? "Up" : "Hoch"}><ChevronUp className="w-3.5 h-3.5" /></button>
              <button onClick={() => dispatch({ type: "moveSection", uid: section.uid, dir: 1 })} disabled={idx >= sectionList.length - 1} className="w-6 h-6 rounded border border-white/10 bg-white/[0.05] text-zinc-300 hover:text-white disabled:opacity-25 flex items-center justify-center" aria-label={lang === "en" ? "Down" : "Runter"}><ChevronDown className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          {/* Schnell-Aktionen: Duplizieren · Zurücksetzen · Entfernen */}
          <div className="grid grid-cols-3 gap-1 mt-1.5">
            <button onClick={() => dispatch({ type: "duplicateSection", uid: section.uid })} title={t.themes.editorSecDuplicateHint} className="flex items-center justify-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-1 py-1 text-[10px] font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.08] transition">
              <Copy className="w-3 h-3" /> {t.themes.editorSecDuplicate}
            </button>
            <button onClick={() => dispatch({ type: "resetSection", uid: section.uid })} title={t.themes.editorSecResetHint} className="flex items-center justify-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-1 py-1 text-[10px] font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.08] transition">
              <RotateCcw className="w-3 h-3" /> {t.themes.editorSecReset}
            </button>
            <button onClick={() => { dispatch({ type: "removeSection", uid: section.uid }); onClearSelect(); }} title={t.themes.editorRemove} className="flex items-center justify-center gap-1 rounded-md border border-red-400/25 bg-red-500/[0.08] px-1 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-500/[0.16] transition">
              <Trash2 className="w-3 h-3" /> {t.themes.editorRemove}
            </button>
          </div>
        </div>

        {/* Look / Style-Art */}
        {def && def.presets.length > 0 && (
          <SecGroup icon={<LayoutGrid className="w-3 h-3" />} title={t.themes.editorPreset} help={t.themes.editorPresetHelp}>
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
          </SecGroup>
        )}

        {/* Hintergrund & Übergang (Design-Layer) mit Live-Vorschau */}
        {sectionSupportsDesign(section.type) && (
          <SecGroup icon={<Paintbrush className="w-3 h-3" />} title={t.themes.editorSecDesign} help={t.themes.editorSecDesignHelp}>
            <div className="space-y-2.5">
              <div>
                <FieldLabel>{t.themes.editorSecTone}</FieldLabel>
                <Segmented
                  options={[["none", lang === "en" ? "Off" : "Aus"], ["tint", "Tint"], ["soft", "Soft"], ["wash", lang === "en" ? "Gray" : "Grau"], ["deep", lang === "en" ? "Dark" : "Dunkel"]]}
                  value={toneVal}
                  onChange={(tone) =>
                    dispatch({
                      type: "mergeSectionSettings",
                      uid: section.uid,
                      patch: sectionToneSettings(tone as SectionTone, doc.global.colors, {
                        divider: (section.settings?.sec_divider as never) || undefined,
                        dividerTop: (section.settings?.sec_divider_top as never) || undefined,
                      }),
                    })
                  }
                />
                {(() => {
                  const bg1 = String(section.settings?.sec_bg || "");
                  const bg2 = String(section.settings?.sec_bg2 || "");
                  const base = bg1 ? (bg2 ? `linear-gradient(150deg, ${bg1}, ${bg2})` : bg1) : doc.global.colors.background;
                  return <div className="mt-1 h-4 rounded border border-white/10" style={{ background: base }} title={t.themes.editorSecTonePreview} />;
                })()}
              </div>
              <div>
                <FieldLabel>{t.themes.editorSecDividerTop}</FieldLabel>
                <DividerPicker
                  top
                  value={String(section.settings?.sec_divider_top || "none")}
                  onChange={(v) => dispatch({ type: "setSectionSetting", uid: section.uid, key: "sec_divider_top", value: v })}
                  lang={lang}
                />
              </div>
              <div>
                <FieldLabel>{t.themes.editorSecDivider}</FieldLabel>
                <DividerPicker
                  value={String(section.settings?.sec_divider || "none")}
                  onChange={(v) => dispatch({ type: "setSectionSetting", uid: section.uid, key: "sec_divider", value: v })}
                  lang={lang}
                />
              </div>
            </div>
          </SecGroup>
        )}

        {/* Texte werden NICHT mehr hier bearbeitet — nur noch direkt in der
            Vorschau anklicken (klarer Schnitt: Einstellungen = Look/Design). */}
        {def && def.fields.length > 0 && (
          <div className="flex items-start gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.015] px-2 py-1.5">
            <Pencil className="w-3 h-3 shrink-0 mt-[1px] text-[#95BF47]/70" />
            <p className="text-[9.5px] leading-snug text-zinc-500">{t.themes.editorTextInlineTip}</p>
          </div>
        )}
      </div>
    );
  }

  // ── Kaufbox ausgewählt (Panel oder einzelner Baustein via "blk:<typ>") ──
  const blkSelected = selected && selected.startsWith("blk:") ? selected.slice(4) : null;
  if (selected === "__buybox" || blkSelected) {
    // Konfiguration EINES Bausteins: Style-Arten + Feineinstellungen (KEINE
    // Texte mehr — die bearbeitet man direkt in der Vorschau).
    const blockConfig = (type: string) => {
      const lib = getBuyboxLib(type);
      const controls = getBuyboxControls(type);
      // Texte werden NICHT mehr hier bearbeitet (nur inline in der Vorschau) —
      // ein Baustein hat nur dann ein Panel, wenn er Style-Arten/Regler oder die
      // Vorteile-Icons hat.
      if (!lib || (!lib.presets.length && !controls.length && type !== "benefits_list")) return null;
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
          {c.kind === "image" && (
            <ImageUploadField
              value={String(val(c.key) ?? "")}
              round={c.round}
              onChange={(v) => dispatch({ type: "setBlockSetting", blockType: type, key: c.key, value: v })}
            />
          )}
        </div>
      );
      return (
        <div className="space-y-2.5">
          {lib.presets.length > 0 && (
            <SecGroup icon={<LayoutGrid className="w-3 h-3" />} title={t.themes.editorPreset} help={t.themes.editorPresetHelp}>
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
            </SecGroup>
          )}
          {(otherCtrls.length > 0 || colorCtrls.length > 0) && (
            <SecGroup icon={<SlidersHorizontal className="w-3 h-3" />} title={t.themes.editorFineTune}>
              {controls.some((c) => c.kind === "image") && <HelpText>{t.themes.editorBlockPhotoHelp}</HelpText>}
              {otherCtrls.length > 0 && <div className="space-y-2.5">{otherCtrls.map(renderCtrl)}</div>}
              {colorCtrls.length > 0 && <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 mt-1.5">{colorCtrls.map(renderCtrl)}</div>}
            </SecGroup>
          )}
          {type === "benefits_list" && (
            <SecGroup icon={<Sparkles className="w-3 h-3" />} title={t.themes.builderBenefitIcons} help={t.themes.builderBenefitIconsHelp}>
              <BenefitIconsEditor
                icons={doc.buybox.benefitIcons}
                labels={[0, 1, 2, 3].map((i) => previewData?.benefits?.[i]?.text || "")}
                onPick={(i, id) => {
                  const arr = [...doc.buybox.benefitIcons];
                  while (arr.length < 4) arr.push(DEFAULT_BENEFIT_ICONS[arr.length]);
                  arr[i] = id;
                  dispatch({ type: "setBuybox", patch: { benefitIcons: arr } });
                }}
              />
            </SecGroup>
          )}
        </div>
      );
    };

    // Einzelner Baustein ausgewählt → NUR seine Einstellungen (die Baustein-
    // Liste selbst lebt jetzt rechts in der Aufbau-Leiste als Kaufbox-Dropdown).
    if (blkSelected) {
      const meta = getBuyboxMeta(blkSelected);
      const cfgJsx = blockConfig(blkSelected);
      return (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 rounded-lg border border-[#95BF47]/25 bg-gradient-to-b from-[#95BF47]/[0.12] to-transparent px-2 py-2">
            <span className="w-7 h-7 shrink-0 rounded-md flex items-center justify-center" style={{ background: "rgba(149,191,71,0.14)", color: ACCENT }}>
              <BlockIcon name={meta.icon} className="w-4 h-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-bold text-white truncate leading-tight">{lang === "en" ? meta.labelEn : meta.label}</div>
              <div className="text-[9.5px] text-zinc-400 truncate leading-tight">{t.themes.editorBuybox}</div>
            </div>
            <button
              onClick={() => { dispatch({ type: "removeBuyboxBlock", blockType: blkSelected }); onClearSelect(); }}
              title={t.themes.editorBuyboxRemove}
              aria-label={t.themes.editorBuyboxRemove}
              className="w-6 h-6 shrink-0 rounded border border-red-400/25 bg-red-500/[0.08] text-red-300 hover:bg-red-500/[0.16] flex items-center justify-center"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
          {cfgJsx || (
            <div className="flex items-start gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.015] px-2 py-1.5">
              <Pencil className="w-3 h-3 shrink-0 mt-[1px] text-[#95BF47]/70" />
              <p className="text-[9.5px] leading-snug text-zinc-500">{t.themes.editorTextInlineTip}</p>
            </div>
          )}
        </div>
      );
    }

    // Kaufbox-Panel (__buybox) → nur kaufbox-WEITE Einstellungen.
    return (
      <div className="space-y-2.5">
        <div className="rounded-lg border border-[#95BF47]/25 bg-gradient-to-b from-[#95BF47]/[0.1] to-transparent px-2.5 py-2">
          <div className="text-[12px] font-bold text-white leading-tight">{t.themes.editorBuybox}</div>
          <p className="mt-0.5 text-[9.5px] leading-snug text-zinc-500">{t.themes.editorBuyboxPanelHelp}</p>
        </div>

        <SecGroup icon={<ImageIcon className="w-3 h-3" />} title={t.themes.editorGallery}>
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
        </SecGroup>

        <SecGroup
          icon={<SlidersHorizontal className="w-3 h-3" />}
          title={t.themes.editorBuyboxSpacing}
          right={<span className="text-[9px] font-mono text-zinc-500">{doc.buybox.spacing ?? 15}px</span>}
        >
          <SliderField
            value={doc.buybox.spacing ?? 15}
            min={4}
            max={40}
            suffix="px"
            onChange={(v) => dispatch({ type: "setBuybox", patch: { spacing: v } })}
          />
        </SecGroup>
      </div>
    );
  }

  // ── Nichts ausgewählt → KEINE Einstellungen (nur ein Hinweis) ──
  if (selected !== "__global") {
    return (
      <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-5 flex flex-col items-center text-center gap-2">
        <MousePointerClick className="w-5 h-5 text-[#95BF47]/70" />
        <div className="text-[11.5px] font-semibold text-white">{t.themes.editorNothingSelected}</div>
        <div className="text-[10px] text-zinc-500 leading-snug">{t.themes.editorNothingSelectedSub}</div>
      </div>
    );
  }

  // ── "Allgemeines Design" (__global) → globales Theme-Design ──
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
      <div className="rounded-lg border border-[#95BF47]/25 bg-gradient-to-b from-[#95BF47]/[0.1] to-transparent px-2.5 py-2 flex items-start gap-2">
        <PaletteIcon className="w-4 h-4 text-[#95BF47] shrink-0 mt-0.5" />
        <div>
          <div className="text-[12.5px] font-bold text-white leading-tight">{t.themes.editorGlobalTitle}</div>
          <div className="text-[9.5px] text-zinc-500 leading-snug mt-0.5">{t.themes.editorGlobalSub}</div>
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
