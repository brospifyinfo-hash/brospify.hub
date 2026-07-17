"use client";

// ─── Projekt-Dialoge: Speichern/Umbenennen + Bestätigung ────────────────
// Kleine, fokussierte Modals im Editor-Look (statt window.confirm/prompt —
// die wirken wie Fremdkörper in einem Programm). SaveProjectDialog dient
// dem ersten Speichern, „Speichern unter" UND dem Umbenennen (initialName).

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, AlertTriangle } from "lucide-react";
import { ACCENT } from "@/components/theme-editor/editor-ui";

function DialogFrame({
  open, onClose, children, labelledBy,
}: {
  open: boolean; onClose: () => void; children: React.ReactNode; labelledBy: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Esc in der CAPTURE-Phase (schließt NUR diesen Dialog, nicht darunter
  // liegende Overlays), Tab bleibt im Dialog gefangen, Fokus wandert beim
  // Öffnen hinein und beim Schließen zurück zum Auslöser.
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => {
      if (!panelRef.current || panelRef.current.contains(document.activeElement)) return;
      panelRef.current.querySelector<HTMLElement>("input, button")?.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab" || !panelRef.current) return;
      const list = [...panelRef.current.querySelectorAll<HTMLElement>("button, input, select, textarea, [href]")]
        .filter((el) => !el.hasAttribute("disabled"));
      if (!list.length) return;
      const first = list[0], last = list[list.length - 1];
      const active = document.activeElement;
      const inside = panelRef.current.contains(active);
      if (e.shiftKey && (active === first || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !inside)) { e.preventDefault(); first.focus(); }
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
          aria-labelledby={labelledBy}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#101014]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Projekt (neu) speichern oder umbenennen — ein Name, ein Knopf. */
export function SaveProjectDialog({
  open, onClose, onSave, busy, error, initialName, title, hint, placeholder, saveLabel, cancelLabel,
}: {
  open: boolean;
  onClose: () => void;
  /** Wird mit dem getrimmten Namen aufgerufen; Schließen macht der Aufrufer nach Erfolg. */
  onSave: (name: string) => void;
  busy: boolean;
  error: string;
  /** Vorbelegter Name (Umbenennen) — leer beim ersten Speichern. */
  initialName?: string;
  title: string;
  hint: string;
  placeholder: string;
  saveLabel: string;
  cancelLabel: string;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // Bei jeder Öffnen-Flanke frisch vorbelegen (Render-Sync statt Effekt —
  // der Dialog bleibt dauerhaft gemountet) …
  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setName(initialName || "");
  }
  // … und das Namensfeld fokussieren/markieren.
  useEffect(() => {
    if (open) requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.select(); });
  }, [open]);
  const submit = () => { const n = name.trim(); if (n && !busy) onSave(n); };
  return (
    <DialogFrame open={open} onClose={onClose} labelledBy="proj-save-title">
      <div className="flex items-center gap-2.5 px-5 pt-4 pb-3 border-b border-white/[0.07]">
        <Save className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />
        <h2 id="proj-save-title" className="text-[15px] font-bold text-white flex-1">{title}</h2>
        <button onClick={onClose} className="w-8 h-8 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white flex items-center justify-center transition" aria-label={cancelLabel}>
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-5 py-4">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder={placeholder}
          maxLength={60}
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[13.5px] text-white placeholder:text-zinc-600 outline-none focus:border-[#95BF47]/60 transition"
        />
        <p className="mt-2 text-[11.5px] text-zinc-500 leading-snug">{hint}</p>
        {error && <p className="mt-2 text-[12px] text-amber-300/90 leading-snug">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 px-5 pb-4">
        <button onClick={onClose} className="rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[12.5px] font-semibold text-zinc-300 hover:text-white transition">
          {cancelLabel}
        </button>
        <button
          onClick={submit}
          disabled={!name.trim() || busy}
          className="btn-deploy flex items-center gap-1.5 px-4 py-2 text-[12.5px] disabled:opacity-50"
        >
          <Save className={`w-3.5 h-3.5 ${busy ? "animate-pulse" : ""}`} />
          {saveLabel}
        </button>
      </div>
    </DialogFrame>
  );
}

/** Kompakte Ja/Nein-Bestätigung (z. B. „Neues Projekt trotz ungespeicherter Änderungen?"). */
export function ConfirmDialog({
  open, onClose, onConfirm, title, text, confirmLabel, cancelLabel,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  text: string;
  confirmLabel: string;
  cancelLabel: string;
}) {
  return (
    <DialogFrame open={open} onClose={onClose} labelledBy="proj-confirm-title">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start gap-3">
          <span className="shrink-0 w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-400" />
          </span>
          <div className="min-w-0">
            <h2 id="proj-confirm-title" className="text-[15px] font-bold text-white">{title}</h2>
            <p className="mt-1 text-[12.5px] text-zinc-400 leading-snug">{text}</p>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 px-5 pb-4">
        <button onClick={onClose} className="rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[12.5px] font-semibold text-zinc-300 hover:text-white transition">
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          className="rounded-lg px-4 py-2 text-[12.5px] font-bold text-white hover:brightness-110 transition"
          style={{ background: ACCENT }}
        >
          {confirmLabel}
        </button>
      </div>
    </DialogFrame>
  );
}
