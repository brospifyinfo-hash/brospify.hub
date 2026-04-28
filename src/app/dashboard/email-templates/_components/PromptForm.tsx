"use client";

/**
 * PromptForm — Eingabe-Maske für den KI-Agenten.
 *
 * Felder:
 *   - Tonfall (Pillen-Auswahl, 4 Optionen)
 *   - Markenname (optional, Override für {{ shop.name }})
 *   - Besondere Hinweise (Textarea, max 500 Zeichen)
 *
 * Submit triggert `onGenerate(input)` und disabled sich für `loading`.
 */

import { Sparkles, Loader2 } from "lucide-react";
import type { BrandTone } from "@/lib/ai-email-generator";

const TONES: { key: BrandTone; label: string; sub: string }[] = [
  { key: "serioes", label: "Seriös", sub: "Klassisch & präzise" },
  { key: "freundlich", label: "Freundlich", sub: "Warmherzig & nah" },
  { key: "locker", label: "Locker", sub: "Modern & du-Form" },
  { key: "luxurioes", label: "Luxuriös", sub: "Elegant & exklusiv" },
];

interface Props {
  tone: BrandTone;
  setTone: (t: BrandTone) => void;
  brandName: string;
  setBrandName: (s: string) => void;
  notes: string;
  setNotes: (s: string) => void;
  loading: boolean;
  onGenerate: () => void;
}

export default function PromptForm({
  tone,
  setTone,
  brandName,
  setBrandName,
  notes,
  setNotes,
  loading,
  onGenerate,
}: Props) {
  return (
    <div className="space-y-7">
      {/* Tonfall */}
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-white/50 mb-3">
          Tonfall der Marke
        </label>
        <div className="grid grid-cols-2 gap-2">
          {TONES.map((t) => {
            const active = tone === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTone(t.key)}
                disabled={loading}
                className={[
                  "text-left px-4 py-3 rounded-2xl border transition cursor-pointer disabled:opacity-50",
                  active
                    ? "bg-white/10 border-white/30"
                    : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20",
                ].join(" ")}
              >
                <div className="text-[14px] font-medium text-white">
                  {t.label}
                </div>
                <div className="text-[11px] text-white/45 mt-0.5">{t.sub}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Brand-Name */}
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-white/50 mb-2">
          Markenname (optional)
        </label>
        <input
          type="text"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          placeholder="z. B. Aurelia & Co."
          maxLength={80}
          disabled={loading}
          className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-2xl text-[14px] text-white placeholder-white/30 outline-none focus:bg-white/[0.07] focus:border-white/25 transition disabled:opacity-50"
        />
      </div>

      {/* Notizen */}
      <div>
        <label className="block text-[11px] uppercase tracking-wider text-white/50 mb-2">
          Besondere Hinweise
          <span className="ml-2 normal-case tracking-normal text-white/30">
            {notes.length}/500
          </span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, 500))}
          placeholder="z. B. „Rabattcode WELCOME10 für die nächste Bestellung einfügen, freundlich auf nachhaltige Verpackung hinweisen."
          rows={4}
          disabled={loading}
          className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-2xl text-[14px] leading-relaxed text-white placeholder-white/30 outline-none focus:bg-white/[0.07] focus:border-white/25 transition disabled:opacity-50 resize-none"
        />
      </div>

      {/* Generate-Button */}
      <button
        onClick={onGenerate}
        disabled={loading}
        className="w-full py-3.5 rounded-2xl bg-white text-black font-medium text-[14px] tracking-tight hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 cursor-pointer"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.2} />
            KI generiert...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" strokeWidth={2} />
            Mit KI generieren
          </>
        )}
      </button>
    </div>
  );
}
