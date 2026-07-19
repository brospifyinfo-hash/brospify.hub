"use client";

// ─── Tastaturkürzel-Overlay ─────────────────────────────────────────────
// Hilfe-Fenster im EXPLIZIT HELLEN Premium-Look des Editors: echte helle
// Keycaps (wie Tasten einer Tastatur), klare Zeilen, „Gut zu wissen"-Karte.
// Öffnet über die linke Leiste, das Profil-Menü oder „?". Esc läuft in der
// CAPTURE-Phase (schließt NUR dieses Overlay), Fokus kehrt zurück.

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard, Lightbulb } from "lucide-react";

const INK = "#1c1b22";
const INK_SOFT = "#5c5a66";
const INK_FAINT = "#8c8a96";
const LINE = "#ecece9";
const GREEN = "#95BF47";

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
    <kbd
      className="inline-flex items-center justify-center"
      style={{
        minWidth: 28, height: 26, padding: "0 8px",
        borderRadius: 8, border: "1px solid #d9d9d4", borderBottomWidth: 2.5, borderBottomColor: "#c9c9c3",
        background: "linear-gradient(180deg, #ffffff, #f4f4f1)",
        fontSize: 11, fontWeight: 800, color: INK, fontFamily: "inherit",
      }}
    >
      {children}
    </kbd>
  );
}

function Row({ keys, label }: { keys: string[][]; label: string }) {
  return (
    <div className="flex items-center gap-3" style={{ padding: "7px 0" }}>
      <span className="flex items-center gap-1.5 shrink-0" style={{ minWidth: 168 }}>
        {keys.map((combo, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span style={{ fontSize: 10, color: INK_FAINT, margin: "0 2px" }}>/</span>}
            {combo.map((k, j) => (
              <span key={j} className="flex items-center gap-1">
                {j > 0 && <span style={{ fontSize: 10, color: INK_FAINT }}>+</span>}
                <Key>{k}</Key>
              </span>
            ))}
          </span>
        ))}
      </span>
      <span className="min-w-0" style={{ fontSize: 12.5, color: INK_SOFT, fontWeight: 600 }}>{label}</span>
    </div>
  );
}

export default function ShortcutsOverlay({ open, onClose, t }: { open: boolean; onClose: () => void; t: ShortcutsT }) {
  const closeRef = useRef<HTMLButtonElement>(null);
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
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md overflow-hidden"
            style={{
              background: "#ffffff",
              borderRadius: 22,
              border: `1px solid ${LINE}`,
              boxShadow: "0 8px 24px -12px rgba(20,18,26,0.18), 0 40px 90px -24px rgba(20,18,26,0.38)",
            }}
          >
            <div className="flex items-center gap-3" style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${LINE}` }}>
              <span
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 38, height: 38, borderRadius: 12,
                  background: `linear-gradient(135deg, ${GREEN}, #6f9a30)`,
                  boxShadow: "0 6px 16px -6px rgba(149,191,71,0.55)",
                }}
              >
                <Keyboard style={{ width: 18, height: 18, color: "#ffffff" }} strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="shortcuts-title" style={{ fontSize: 16, fontWeight: 800, color: INK }}>{t.title}</h2>
                <p style={{ fontSize: 11.5, color: INK_FAINT }}>{t.sub}</p>
              </div>
              <button
                ref={closeRef}
                onClick={onClose}
                aria-label={t.close}
                className="bspx-rail-slim flex items-center justify-center shrink-0"
                style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${LINE}`, background: "#fff", cursor: "pointer" }}
              >
                <X style={{ width: 15, height: 15 }} strokeWidth={2} />
              </button>
            </div>
            <div style={{ padding: "12px 20px 6px" }}>
              <Row keys={[[t.ctrl, "Z"]]} label={t.undo} />
              <Row keys={[[t.ctrl, "Shift", "Z"], [t.ctrl, "Y"]]} label={t.redo} />
              <Row keys={[[t.ctrl, "S"]]} label={t.save} />
              <Row keys={[["?"]]} label={t.help} />
              <Row keys={[["Esc"]]} label={t.esc} />
            </div>
            <div style={{ padding: "10px 20px 18px" }}>
              <div style={{ borderRadius: 14, border: `1px solid ${LINE}`, background: "#fafaf8", padding: "12px 14px" }}>
                <div className="flex items-center gap-1.5" style={{ marginBottom: 7 }}>
                  <Lightbulb style={{ width: 13, height: 13, color: "#6f9a30" }} strokeWidth={2.2} />
                  <span className="uppercase" style={{ fontSize: 10, letterSpacing: "0.14em", fontWeight: 800, color: INK_FAINT }}>
                    {t.tipsTitle}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {t.tips.map((tip, i) => (
                    <li key={i} className="flex gap-2" style={{ fontSize: 12, color: INK_SOFT, lineHeight: 1.5 }}>
                      <span className="shrink-0 rounded-full" style={{ marginTop: 6, width: 4, height: 4, background: GREEN }} aria-hidden />
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
