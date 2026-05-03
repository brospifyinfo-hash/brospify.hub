"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Palette,
  ImageIcon,
  Type,
  Package,
  MessageSquare,
  Bookmark,
  Save,
  Trash2,
  Coins,
} from "lucide-react";

// ─── Google Fonts (web-safe + curated list) ──────────────────────

export const FONT_FAMILIES = [
  { value: "Inter", label: "Inter", category: "Sans Modern", stack: '"Inter", system-ui, sans-serif' },
  { value: "Roboto", label: "Roboto", category: "Sans Classic", stack: '"Roboto", Helvetica, Arial, sans-serif' },
  { value: "Open Sans", label: "Open Sans", category: "Sans Classic", stack: '"Open Sans", Helvetica, Arial, sans-serif' },
  { value: "Montserrat", label: "Montserrat", category: "Sans Display", stack: '"Montserrat", system-ui, sans-serif' },
  { value: "Poppins", label: "Poppins", category: "Sans Friendly", stack: '"Poppins", system-ui, sans-serif' },
  { value: "Lato", label: "Lato", category: "Sans Classic", stack: '"Lato", system-ui, sans-serif' },
  { value: "Nunito", label: "Nunito", category: "Sans Friendly", stack: '"Nunito", system-ui, sans-serif' },
  { value: "Raleway", label: "Raleway", category: "Sans Display", stack: '"Raleway", system-ui, sans-serif' },
  { value: "Work Sans", label: "Work Sans", category: "Sans Modern", stack: '"Work Sans", system-ui, sans-serif' },
  { value: "DM Sans", label: "DM Sans", category: "Sans Modern", stack: '"DM Sans", system-ui, sans-serif' },
  { value: "Playfair Display", label: "Playfair Display", category: "Serif Display", stack: '"Playfair Display", Georgia, serif' },
  { value: "Merriweather", label: "Merriweather", category: "Serif Editorial", stack: '"Merriweather", Georgia, serif' },
  { value: "Lora", label: "Lora", category: "Serif Editorial", stack: '"Lora", Georgia, serif' },
  { value: "EB Garamond", label: "EB Garamond", category: "Serif Classic", stack: '"EB Garamond", Garamond, serif' },
  { value: "Cormorant Garamond", label: "Cormorant Garamond", category: "Serif Luxury", stack: '"Cormorant Garamond", Garamond, serif' },
  { value: "Bodoni Moda", label: "Bodoni Moda", category: "Serif Luxury", stack: '"Bodoni Moda", Didot, serif' },
  { value: "DM Serif Display", label: "DM Serif Display", category: "Serif Display", stack: '"DM Serif Display", Georgia, serif' },
  { value: "Space Grotesk", label: "Space Grotesk", category: "Sans Tech", stack: '"Space Grotesk", system-ui, sans-serif' },
  { value: "Bricolage Grotesque", label: "Bricolage Grotesque", category: "Sans Editorial", stack: '"Bricolage Grotesque", system-ui, sans-serif' },
  { value: "Manrope", label: "Manrope", category: "Sans Modern", stack: '"Manrope", system-ui, sans-serif' },
  { value: "Geist", label: "Geist", category: "Sans Tech", stack: '"Geist", system-ui, sans-serif' },
  { value: "JetBrains Mono", label: "JetBrains Mono", category: "Mono Tech", stack: '"JetBrains Mono", monospace' },
] as const;

export type FontFamily = typeof FONT_FAMILIES[number]["value"];

export function getFontStack(family: FontFamily): string {
  return FONT_FAMILIES.find((f) => f.value === family)?.stack ?? '"Inter", system-ui, sans-serif';
}

// ─── Types ──────────────────────────────────────────────────────────

export type Tonalität =
  | "luxuriös"
  | "nahbar"
  | "minimalistisch"
  | "aggressiv-sale"
  | "seriös"
  | "verspielt";

export interface EmailConfig {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  logoUrl: string;
  headerImageUrl: string;
  socialInstagram: string;
  socialTiktok: string;
  socialTwitter: string;
  tonalität: Tonalität;
  typographyStyle: "serif" | "sans-serif";
  fontFamily: FontFamily;
  addSocialLinks: boolean;
  addDiscountCode: boolean;
  discountCode: string;
  addTrustBadges: boolean;
  specialNotes: string;
}

export const DEFAULT_CONFIG: EmailConfig = {
  primaryColor: "#95BF47",
  secondaryColor: "#1a1a1a",
  backgroundColor: "#ffffff",
  logoUrl: "",
  headerImageUrl: "",
  socialInstagram: "",
  socialTiktok: "",
  socialTwitter: "",
  tonalität: "seriös",
  typographyStyle: "sans-serif",
  fontFamily: "Inter",
  addSocialLinks: false,
  addDiscountCode: false,
  discountCode: "",
  addTrustBadges: false,
  specialNotes: "",
};

// ─── Local Style Presets (localStorage) ──────────────────────────

export interface StylePreset {
  id: string;
  name: string;
  createdAt: number;
  config: Pick<
    EmailConfig,
    | "primaryColor"
    | "secondaryColor"
    | "backgroundColor"
    | "logoUrl"
    | "headerImageUrl"
    | "socialInstagram"
    | "socialTiktok"
    | "socialTwitter"
    | "fontFamily"
    | "typographyStyle"
  >;
}

const PRESETS_STORAGE_KEY = "brospify.emailStylePresets.v1";

export function loadPresets(): StylePreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePresets(presets: StylePreset[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch {
    /* quota / serialisation issues — silently ignore */
  }
}

// ─── Tonality definitions ────────────────────────────────────────────

const TONALITÄTEN: { value: Tonalität; label: string; hint: string }[] = [
  { value: "luxuriös", label: "Luxuriös", hint: "Edel, exklusiv, kein Ausrufezeichen" },
  { value: "nahbar", label: "Nahbar", hint: "Herzlich, persönlich, Du-Form" },
  { value: "minimalistisch", label: "Minimalistisch", hint: "Wenig Text, viel Luft" },
  { value: "aggressiv-sale", label: "Sale-Push", hint: "Direkt, Urgency, große CTAs" },
  { value: "seriös", label: "Seriös", hint: "Sachlich, strukturiert, per Sie" },
  { value: "verspielt", label: "Verspielt", hint: "Farbenfroh, energetisch, Emoji" },
];

// ─── Sub-components ──────────────────────────────────────────────────

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-medium text-white/50 uppercase tracking-[0.1em]">
        {label}
      </label>
      <div className="flex items-center gap-2.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded-xl cursor-pointer border border-white/10 bg-transparent shrink-0"
          style={{ padding: "2px" }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) onChange(e.target.value);
          }}
          className="input-glass flex-1 font-mono text-[13px] py-2 h-9"
          spellCheck={false}
          maxLength={7}
        />
      </div>
    </div>
  );
}

function UrlInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-medium text-white/50 uppercase tracking-[0.1em]">
        {label}
      </label>
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-glass w-full text-[13px] py-2"
      />
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  badge,
  children,
  defaultOpen = true,
}: {
  icon: LucideIcon;
  title: string;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="glass-email overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Icon className="w-3.5 h-3.5 text-white/50" strokeWidth={1.8} />
          <span className="text-[13px] font-semibold text-white/85">{title}</span>
          {badge && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/[0.06] text-white/40 border border-white/[0.06]">
              {badge}
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-white/30" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-white/30" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 space-y-4 border-t border-white/[0.04]">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export function ConfigPanel({
  config,
  setConfig,
  onGenerate,
  generating,
  generateCost = 30,
  insufficientCredits = false,
}: {
  config: EmailConfig;
  setConfig: (c: EmailConfig) => void;
  onGenerate: () => void;
  generating: boolean;
  generateCost?: number;
  insufficientCredits?: boolean;
}) {
  function update<K extends keyof EmailConfig>(key: K, value: EmailConfig[K]) {
    setConfig({ ...config, [key]: value });
  }

  // ── Style Presets state ─────────────────────────────────────
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const [newPresetName, setNewPresetName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  useEffect(() => {
    setPresets(loadPresets());
  }, []);

  function handleSavePreset() {
    const name = newPresetName.trim();
    if (!name) return;
    const next: StylePreset = {
      id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      createdAt: Date.now(),
      config: {
        primaryColor: config.primaryColor,
        secondaryColor: config.secondaryColor,
        backgroundColor: config.backgroundColor,
        logoUrl: config.logoUrl,
        headerImageUrl: config.headerImageUrl,
        socialInstagram: config.socialInstagram,
        socialTiktok: config.socialTiktok,
        socialTwitter: config.socialTwitter,
        fontFamily: config.fontFamily,
        typographyStyle: config.typographyStyle,
      },
    };
    const updated = [next, ...presets].slice(0, 30);
    setPresets(updated);
    savePresets(updated);
    setNewPresetName("");
    setShowSaveInput(false);
  }

  function handleLoadPreset(id: string) {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setConfig({ ...config, ...p.config });
  }

  function handleDeletePreset(id: string) {
    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated);
    savePresets(updated);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onGenerate();
      }}
      className="space-y-2.5"
    >
      {/* ── Section 0: Style Presets ─────────────────── */}
      <Section
        icon={Bookmark}
        title="Design-Vorlagen"
        badge={presets.length > 0 ? `${presets.length} gespeichert` : "neu"}
        defaultOpen={presets.length > 0}
      >
        {presets.length > 0 ? (
          <div className="space-y-1">
            {presets.map((p) => (
              <div
                key={p.id}
                className="group flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] transition px-2 py-1.5"
              >
                <button
                  type="button"
                  onClick={() => handleLoadPreset(p.id)}
                  className="flex-1 flex items-center gap-2.5 text-left min-w-0"
                  title="Diese Vorlage anwenden"
                >
                  <div className="flex shrink-0 items-center gap-0.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full ring-1 ring-black/30"
                      style={{ background: p.config.primaryColor }}
                    />
                    <span
                      className="w-3.5 h-3.5 rounded-full ring-1 ring-black/30 -ml-1"
                      style={{ background: p.config.secondaryColor }}
                    />
                  </div>
                  <span
                    className="text-[12.5px] font-medium text-white/85 truncate"
                    style={{ fontFamily: getFontStack(p.config.fontFamily) }}
                  >
                    {p.name}
                  </span>
                  <span className="ml-auto text-[10px] text-white/35 shrink-0">
                    {p.config.fontFamily}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeletePreset(p.id)}
                  className="opacity-0 group-hover:opacity-100 transition p-1.5 text-white/30 hover:text-red-400"
                  title="Löschen"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-white/40 leading-relaxed">
            Speichere deine aktuelle Konfiguration als Vorlage und lade sie für
            jede neue E-Mail mit einem Klick.
          </p>
        )}

        {showSaveInput ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              autoFocus
              placeholder="z. B. „Sommer-Kollektion"
              className="input-glass flex-1 text-[13px] py-2"
              maxLength={48}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSavePreset();
                } else if (e.key === "Escape") {
                  setShowSaveInput(false);
                  setNewPresetName("");
                }
              }}
            />
            <button
              type="button"
              onClick={handleSavePreset}
              disabled={!newPresetName.trim()}
              className="btn-accent inline-flex items-center justify-center px-3 rounded-xl text-[12.5px] font-semibold disabled:opacity-40"
            >
              <Save className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowSaveInput(true)}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[12.5px] font-medium text-white/70 hover:text-white border border-dashed border-white/[0.08] hover:border-white/[0.18] hover:bg-white/[0.02] transition"
          >
            <Save className="w-3.5 h-3.5" />
            Aktuelle Konfiguration speichern
          </button>
        )}
      </Section>

      {/* ── Section 1: Brand Design ─────────────────── */}
      <Section icon={Palette} title="Brand Design" defaultOpen>
        <ColorInput
          label="Primärfarbe"
          value={config.primaryColor}
          onChange={(v) => update("primaryColor", v)}
        />
        <ColorInput
          label="Sekundärfarbe"
          value={config.secondaryColor}
          onChange={(v) => update("secondaryColor", v)}
        />
        <ColorInput
          label="Hintergrundfarbe"
          value={config.backgroundColor}
          onChange={(v) => update("backgroundColor", v)}
        />
      </Section>

      {/* ── Section 2: Media ─────────────────────────── */}
      <Section icon={ImageIcon} title="Media & Bilder" badge="optional" defaultOpen={false}>
        <UrlInput
          label="Shop Logo URL"
          placeholder="https://dein-shop.com/logo.png"
          value={config.logoUrl}
          onChange={(v) => update("logoUrl", v)}
        />
        <UrlInput
          label="Header-Bild URL"
          placeholder="https://dein-shop.com/header.jpg"
          value={config.headerImageUrl}
          onChange={(v) => update("headerImageUrl", v)}
        />
        <UrlInput
          label="Instagram URL"
          placeholder="https://instagram.com/dein-shop"
          value={config.socialInstagram}
          onChange={(v) => update("socialInstagram", v)}
        />
        <UrlInput
          label="TikTok URL"
          placeholder="https://tiktok.com/@dein-shop"
          value={config.socialTiktok}
          onChange={(v) => update("socialTiktok", v)}
        />
        <UrlInput
          label="Twitter / X URL"
          placeholder="https://x.com/dein-shop"
          value={config.socialTwitter}
          onChange={(v) => update("socialTwitter", v)}
        />
      </Section>

      {/* ── Section 3: Tonalität & Stil ──────────────── */}
      <Section icon={Type} title="Tonalität & Stil" defaultOpen>
        {/* Tone grid */}
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-white/50 uppercase tracking-[0.1em]">
            Schreibstil
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {TONALITÄTEN.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => update("tonalität", t.value)}
                title={t.hint}
                className={`px-3 py-2.5 rounded-xl text-left transition-all duration-200 border ${
                  config.tonalität === t.value
                    ? "bg-white/[0.09] border-white/[0.15] text-white"
                    : "bg-white/[0.02] border-white/[0.05] text-white/50 hover:text-white/80 hover:border-white/10"
                }`}
              >
                <span className="block text-[12px] font-semibold">{t.label}</span>
                <span className="block text-[10px] text-white/35 mt-0.5 leading-tight">
                  {t.hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Typography toggle */}
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-white/50 uppercase tracking-[0.1em]">
            Typografie-Stil
          </p>
          <div className="flex gap-2">
            {(["sans-serif", "serif"] as const).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => {
                  update("typographyStyle", style);
                  // sync sensible default font family when style switches
                  if (style === "serif" && !config.fontFamily.toLowerCase().includes("serif") && !["Playfair Display","Merriweather","Lora","EB Garamond","Cormorant Garamond","Bodoni Moda","DM Serif Display"].includes(config.fontFamily)) {
                    update("fontFamily", "Playfair Display" as FontFamily);
                  }
                  if (style === "sans-serif" && ["Playfair Display","Merriweather","Lora","EB Garamond","Cormorant Garamond","Bodoni Moda","DM Serif Display"].includes(config.fontFamily)) {
                    update("fontFamily", "Inter" as FontFamily);
                  }
                }}
                className={`flex-1 py-2.5 rounded-xl text-[13px] font-medium border transition-all duration-200 ${
                  config.typographyStyle === style
                    ? "bg-white/[0.09] border-white/[0.15] text-white"
                    : "bg-white/[0.02] border-white/[0.05] text-white/50 hover:text-white/80"
                }`}
                style={{ fontFamily: style === "serif" ? "Georgia, serif" : "inherit" }}
              >
                {style === "serif" ? "Serif" : "Sans-Serif"}
              </button>
            ))}
          </div>
        </div>

        {/* Font family dropdown */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium text-white/50 uppercase tracking-[0.1em]">
            Schriftart
          </label>
          <div className="relative">
            <select
              value={config.fontFamily}
              onChange={(e) => update("fontFamily", e.target.value as FontFamily)}
              className="input-glass w-full appearance-none pr-9 text-[13px] py-2.5 cursor-pointer"
              style={{ fontFamily: getFontStack(config.fontFamily) }}
            >
              {Object.entries(
                FONT_FAMILIES.reduce<Record<string, typeof FONT_FAMILIES[number][]>>(
                  (acc, f) => {
                    (acc[f.category] ??= []).push(f);
                    return acc;
                  },
                  {},
                ),
              ).map(([cat, fonts]) => (
                <optgroup key={cat} label={cat}>
                  {fonts.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
          </div>
          <p
            className="px-3 py-2.5 rounded-lg bg-white/[0.025] border border-white/[0.04] text-[14px] text-white/70 leading-snug"
            style={{ fontFamily: getFontStack(config.fontFamily) }}
          >
            The quick brown fox jumps over the lazy dog
          </p>
        </div>
      </Section>

      {/* ── Section 4: Zusätzlicher Inhalt ───────────── */}
      <Section icon={Package} title="Zusätzlicher Inhalt" badge="optional" defaultOpen={false}>
        {/* Checkbox: Social Links */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={config.addSocialLinks}
            onChange={(e) => update("addSocialLinks", e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded cursor-pointer accent-[#95BF47] shrink-0"
          />
          <div>
            <span className="block text-[13px] text-white/80 group-hover:text-white transition-colors">
              Social-Media-Links im Footer
            </span>
            <span className="block text-[11px] text-white/35 mt-0.5">
              Instagram, TikTok, Twitter/X
            </span>
          </div>
        </label>

        {/* Checkbox: Trust Badges */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={config.addTrustBadges}
            onChange={(e) => update("addTrustBadges", e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded cursor-pointer accent-[#95BF47] shrink-0"
          />
          <div>
            <span className="block text-[13px] text-white/80 group-hover:text-white transition-colors">
              Trust-Badges
            </span>
            <span className="block text-[11px] text-white/35 mt-0.5">
              SSL, sichere Zahlung, Rückgabe
            </span>
          </div>
        </label>

        {/* Checkbox: Discount Code */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={config.addDiscountCode}
            onChange={(e) => update("addDiscountCode", e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded cursor-pointer accent-[#95BF47] shrink-0"
          />
          <div>
            <span className="block text-[13px] text-white/80 group-hover:text-white transition-colors">
              Rabattcode für nächsten Einkauf
            </span>
            <span className="block text-[11px] text-white/35 mt-0.5">
              Wird prominent im Email eingebaut
            </span>
          </div>
        </label>

        {config.addDiscountCode && (
          <div className="pl-7 space-y-1.5">
            <label className="block text-[11px] font-medium text-white/50 uppercase tracking-[0.1em]">
              Rabattcode
            </label>
            <input
              type="text"
              value={config.discountCode}
              onChange={(e) => update("discountCode", e.target.value.toUpperCase())}
              placeholder="z. B. WELCOME10"
              className="input-glass w-full font-mono text-[13px] py-2"
              maxLength={20}
            />
          </div>
        )}
      </Section>

      {/* ── Section 5: Individuelle Hinweise ─────────── */}
      <Section icon={MessageSquare} title="Individuelle Hinweise" badge="optional" defaultOpen={false}>
        <textarea
          value={config.specialNotes}
          onChange={(e) => update("specialNotes", e.target.value)}
          rows={4}
          placeholder='z. B. "30 Tage Rückgaberecht hervorheben" oder "Produkt-Empfehlungen einfügen"'
          className="input-glass w-full resize-none text-[13px]"
          maxLength={600}
        />
        <p className="text-[11px] text-white/30 text-right">{config.specialNotes.length} / 600</p>
      </Section>

      {/* ── Generate Button ───────────────────────────── */}
      <div className="space-y-2 pt-1">
        <button
          type="submit"
          disabled={generating || insufficientCredits}
          className="w-full btn-accent inline-flex items-center justify-center gap-2.5 px-5 py-4 rounded-2xl text-[15px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all relative"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              KI generiert…
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Template mit KI generieren
              <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/15 text-[11px] font-mono">
                <Coins className="w-3 h-3" />
                -{generateCost}
              </span>
            </>
          )}
        </button>
        {insufficientCredits && (
          <p className="text-[11.5px] text-amber-300/85 leading-snug px-1">
            Nicht genügend Credits — du benötigst {generateCost} Credits.{" "}
            <a
              href="/credits"
              className="text-[#95BF47] hover:underline font-semibold"
            >
              Jetzt aufladen →
            </a>
          </p>
        )}
      </div>
    </form>
  );
}
