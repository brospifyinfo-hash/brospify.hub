"use client";

import { useState } from "react";
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
} from "lucide-react";

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
  addSocialLinks: false,
  addDiscountCode: false,
  discountCode: "",
  addTrustBadges: false,
  specialNotes: "",
};

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
}: {
  config: EmailConfig;
  setConfig: (c: EmailConfig) => void;
  onGenerate: () => void;
  generating: boolean;
}) {
  function update<K extends keyof EmailConfig>(key: K, value: EmailConfig[K]) {
    setConfig({ ...config, [key]: value });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onGenerate();
      }}
      className="space-y-2.5"
    >
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
            Typografie
          </p>
          <div className="flex gap-2">
            {(["sans-serif", "serif"] as const).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => update("typographyStyle", style)}
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
      <button
        type="submit"
        disabled={generating}
        className="w-full btn-accent inline-flex items-center justify-center gap-2.5 px-5 py-4 rounded-2xl text-[15px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {generating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            KI generiert…
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Mail generieren
          </>
        )}
      </button>
    </form>
  );
}
