"use client";

// ─── Bro-Maskottchen neben der AI-Leiste ────────────────────────────
// Kleiner, SEPARATER Kreis LINKS neben der Command-Leiste (Chat-Avatar-Stil) —
// frisst keine Höhe in der Leiste, steht extern daneben:
//  - idle  (AI macht nichts) → Default-Bilder
//  - thinking (AI plant)     → Nachdenk-Bilder + Sprechblase
//  - working (AI setzt um)   → Arbeits-Bilder + Sprechblase
// Je Zustand rotieren bis zu 3 vom Admin gesetzte Bilder „hin und wieder".
// Die Sprechblase schwebt WÄHREND der Arbeit über dem Kreis (opak, lesbar);
// bei „working" zwischendurch der echte aktuelle Schritt. Ohne Admin-Bilder
// zeigt Bro einen Emoji-Fallback — funktioniert also sofort.

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";

export type BroState = "idle" | "thinking" | "working";

interface BroCfg {
  idle: string[];
  thinking: string[];
  working: string[];
}

const FALLBACK: Record<BroState, string> = { idle: "🙂", thinking: "🤔", working: "🛠️" };

export function BroMascot({ state, stepTitle }: { state: BroState; stepTitle?: string }) {
  const { t } = useI18n();
  const [cfg, setCfg] = useState<BroCfg | null>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/bro-mascot", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && typeof d === "object") setCfg(d as BroCfg);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const pool = cfg ? cfg[state] || [] : [];
  const active = state === "thinking" || state === "working";

  // Bild „hin und wieder" wechseln, solange >1 Bild in der Gruppe ist.
  useEffect(() => {
    setImgIdx(0);
    if (pool.length < 2) return;
    const id = setInterval(() => {
      setImgIdx((i) => (i + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length);
    }, 2600 + Math.floor(Math.random() * 1000));
    return () => clearInterval(id);
  }, [state, pool.length]);

  // Sprechblasen-Sätze nur während der Arbeit rotieren.
  const lines: string[] = active
    ? state === "thinking"
      ? t.themes.broThinkingLines
      : t.themes.broWorkingLines
    : [];
  useEffect(() => {
    setLineIdx(0);
    if (!active || lines.length < 2) return;
    const id = setInterval(() => setLineIdx((i) => (i + 1) % lines.length), 2800);
    return () => clearInterval(id);
  }, [state, active, lines.length]);

  const url = pool.length ? pool[imgIdx % pool.length] : "";
  const bubble = active
    ? state === "working" && stepTitle && lineIdx % 2 === 1
      ? stepTitle
      : lines[lineIdx] || lines[0] || ""
    : "";

  return (
    <div className="relative shrink-0 self-end">
      {/* Sprechblase — nur während der Arbeit, schwebt über dem Kreis */}
      <AnimatePresence mode="wait">
        {bubble && (
          <motion.span
            key={bubble}
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 3, scale: 0.95 }}
            transition={{ duration: 0.22 }}
            className="absolute bottom-full left-0 mb-2 w-max max-w-[220px] truncate rounded-2xl rounded-bl-sm border border-white/12 bg-[#17171d] px-3 py-1.5 text-[11.5px] font-medium text-zinc-100 shadow-[0_12px_34px_-12px_rgba(0,0,0,0.85)]"
          >
            {bubble}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Bro-Avatar (kleiner separater Kreis) */}
      <span
        className={`relative block w-9 h-9 rounded-full overflow-hidden border flex items-center justify-center ${
          active ? "border-[#95BF47]/60" : "border-white/15"
        } bg-white/[0.05]`}
        title="Bro"
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={`${state}:${url || FALLBACK[state]}`}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.28 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="Bro" className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg leading-none">{FALLBACK[state]}</span>
            )}
          </motion.span>
        </AnimatePresence>
        {active && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute -inset-0.5 rounded-full border border-[#95BF47]/50"
            animate={{ opacity: [0.15, 0.6, 0.15] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
          />
        )}
      </span>
    </div>
  );
}
