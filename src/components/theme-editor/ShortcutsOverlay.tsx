"use client";

// ─── Tastaturkürzel-Overlay ─────────────────────────────────────────────
// Kleines Hilfe-Fenster wie in Profi-Programmen: Kürzel-Liste mit <kbd>-
// Kacheln + „Gut zu wissen"-Tipps. Öffnet über die linke Leiste oder „?".

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard, Lightbulb } from "lucide-react";
import { ACCENT } from "@/components/theme-editor/editor-ui";

export interface ShortcutsT {
  title: string;
  sub: string;
  /** Lokalisierte Modifier-Taste („Strg" auf deutschen Tastaturen). */
  ctrl: string;
  undo: string;
  redo: string;
  save: string;
  help: string;
  esc: string;
  tipsTitle: string;
  tips: string[];
  close: string;
}

function Key({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[26px] h-[24px] px-1.5 rounded-md border border-white/15 bg-white/[0.06] text-[11px] font-bold text-white shadow-[0_1px_0_rgba(0,0,0,0.25)]">
      {children}
    </kbd>
  );
}

function Row({ keys, label }: { keys: string[][]; label: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="flex items-center gap-1.5 shrink-0">
        {keys.map((combo, i) => (
          <span key={i} className="flex items-center gap-0.5">
            {i > 0 && <span className="text-[10px] text-zinc-500 mx-0.5">/</span>}
            {combo.map((k, j) => (
              <span key={j} className="flex items-center gap-0.5">
                {j > 0 && <span className="text-[10px] text-zinc-500">+</span>}
                <Key>{k}</Key>
              </span>
            ))}
          </span>
        ))}
      </span>
      <span className="text-[12.5px] text-zinc-300 min-w-0">{label}</span>
    </div>
  );
}

export default function ShortcutsOverlay({ open, onClose, t }: { open: boolean; onClose: () => void; t: ShortcutsT }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // Esc in der CAPTURE-Phase: läuft VOR den Bubble-Listenern darunter
  // liegender Overlays (Start-Fenster, Vollbild-Vorschau) — Esc schließt so
  // NUR dieses Overlay, nicht den ganzen Stapel. Fokus wandert beim Öffnen
  // auf den Schließen-Knopf und beim Schließen zurück zum Auslöser.
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => closeRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      prev?.focus?.();
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcuts-title"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#101014]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-2.5 px-5 pt-4 pb-3 border-b border-white/[0.07]">
              <Keyboard className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />
              <div className="min-w-0 flex-1">
                <h2 id="shortcuts-title" className="text-[15px] font-bold text-white">{t.title}</h2>
                <p className="text-[11px] text-zinc-500">{t.sub}</p>
              </div>
              <button ref={closeRef} onClick={onClose} className="w-8 h-8 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white flex items-center justify-center transition" aria-label={t.close}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-3.5">
              <Row keys={[[t.ctrl, "Z"]]} label={t.undo} />
              <Row keys={[[t.ctrl, "Shift", "Z"], [t.ctrl, "Y"]]} label={t.redo} />
              <Row keys={[[t.ctrl, "S"]]} label={t.save} />
              <Row keys={[["?"]]} label={t.help} />
              <Row keys={[["Esc"]]} label={t.esc} />
            </div>
            <div className="px-5 pb-4">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Lightbulb className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                  <span className="text-[11px] uppercase tracking-[0.12em] font-bold text-zinc-400">{t.tipsTitle}</span>
                </div>
                <ul className="space-y-1">
                  {t.tips.map((tip, i) => (
                    <li key={i} className="text-[12px] text-zinc-400 leading-snug flex gap-1.5">
                      <span className="shrink-0 mt-[7px] w-1 h-1 rounded-full" style={{ background: ACCENT }} aria-hidden />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
