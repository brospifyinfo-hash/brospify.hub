"use client";

// ─── AI Prompt Form ──────────────────────────────────────────────
// Minimal Apple-style form. Two inputs are required by the spec:
//  · brand tone (preset dropdown)
//  · special notes (free-text)
// We add an optional brand color for the deploy CTA inside the email.

import { Sparkles, Loader2 } from "lucide-react";
import { BrandTone } from "@/lib/ai-email-generator";

interface AIPromptFormProps {
  brandTone: BrandTone;
  setBrandTone: (t: BrandTone) => void;
  specialNotes: string;
  setSpecialNotes: (n: string) => void;
  primaryColor: string;
  setPrimaryColor: (c: string) => void;
  onGenerate: () => void;
  generating: boolean;
}

const TONES: { value: BrandTone; label: string; hint: string }[] = [
  { value: "seriös", label: "Seriös", hint: "Per Sie, sachlich, vertrauensvoll" },
  { value: "locker", label: "Locker", hint: "Per Du, freundlich, alltagsnah" },
  { value: "luxuriös", label: "Luxuriös", hint: "Distinguiert, exklusiv" },
  { value: "verspielt", label: "Verspielt", hint: "Emoji, Energie, Crew-Vibe" },
  { value: "minimalistisch", label: "Minimalistisch", hint: "Knappe Sätze, viel Whitespace" },
];

export function AIPromptForm({
  brandTone,
  setBrandTone,
  specialNotes,
  setSpecialNotes,
  primaryColor,
  setPrimaryColor,
  onGenerate,
  generating,
}: AIPromptFormProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onGenerate();
      }}
      className="glass-email p-6 sm:p-7 space-y-6"
    >
      <div>
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
          <Sparkles className="w-3 h-3" />
          KI Eingabe
        </div>
        <h2 className="mt-2 font-sf-display text-[22px] font-semibold tracking-tight">
          Beschreibe deinen Markenton
        </h2>
        <p className="mt-1 text-[13px] text-white/55">
          Diese Hinweise steuern Wortwahl, Anrede und Aufbau der Mail.
        </p>
      </div>

      {/* Tone */}
      <div className="space-y-2">
        <label className="block text-[12px] font-medium text-white/65">
          Tonfall der Marke
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {TONES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setBrandTone(t.value)}
              title={t.hint}
              className={`relative px-3 py-2.5 rounded-xl text-[13px] font-medium border transition-all duration-300 ${
                brandTone === t.value
                  ? "bg-white/10 border-white/15 text-white"
                  : "bg-white/[0.02] border-white/5 text-white/55 hover:text-white/85 hover:border-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-white/35 mt-1">
          {TONES.find((t) => t.value === brandTone)?.hint}
        </p>
      </div>

      {/* Special notes */}
      <div className="space-y-2">
        <label htmlFor="notes" className="block text-[12px] font-medium text-white/65">
          Besondere Hinweise <span className="text-white/35">(optional)</span>
        </label>
        <textarea
          id="notes"
          value={specialNotes}
          onChange={(e) => setSpecialNotes(e.target.value)}
          rows={3}
          placeholder='z. B. "Rabattcode WELCOME10 für nächsten Einkauf einfügen" oder "Hinweis auf 30 Tage Rückgaberecht ergänzen"'
          className="input-glass w-full resize-none"
        />
      </div>

      {/* Brand color */}
      <div className="space-y-2">
        <label className="block text-[12px] font-medium text-white/65">
          Akzentfarbe im Mailing
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="w-12 h-12 rounded-xl bg-transparent border border-white/10 cursor-pointer"
          />
          <input
            type="text"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="input-glass flex-1 font-mono"
            spellCheck={false}
          />
        </div>
      </div>

      {/* Generate */}
      <button
        type="submit"
        disabled={generating}
        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-white text-black font-semibold text-[14px] hover:bg-white/90 disabled:opacity-50 transition"
      >
        {generating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            KI generiert…
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Mail generieren
          </>
        )}
      </button>
    </form>
  );
}
