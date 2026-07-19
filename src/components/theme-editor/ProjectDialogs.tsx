"use client";

// ─── Projekt-Dialoge: Speichern/Umbenennen + Bestätigung ────────────────
// Kleine, fokussierte Modals im EXPLIZIT HELLEN Premium-Look des Editors
// (weiße Karte, getönte Icon-Kachel, klare Buttons) — statt
// window.confirm/prompt, die wie Fremdkörper wirken. SaveProjectDialog
// dient dem ersten Speichern, „Speichern unter" UND dem Umbenennen.
// Esc läuft in der CAPTURE-Phase (schließt nur diesen Dialog), Tab bleibt
// im Dialog gefangen, der Fokus kehrt beim Schließen zum Auslöser zurück.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, AlertTriangle } from "lucide-react";

const INK = "#1c1b22";
const INK_SOFT = "#5c5a66";
const INK_FAINT = "#8c8a96";
const LINE = "#ecece9";
const GREEN = "#95BF47";
const AMBER_DEEP = "#92600a";

const PANEL: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 22,
  border: `1px solid ${LINE}`,
  boxShadow: "0 8px 24px -12px rgba(20,18,26,0.18), 0 40px 90px -24px rgba(20,18,26,0.38)",
};

/** Getönte Icon-Kachel im Dialog-Kopf (grün = Aktion, amber = Warnung). */
function HeadIcon({ icon: Ico, toneAmber }: { icon: typeof Save; toneAmber?: boolean }) {
  return (
    <span
      className="flex items-center justify-center shrink-0"
      style={{
        width: 38, height: 38, borderRadius: 12,
        background: toneAmber
          ? "linear-gradient(135deg, #fbbf24, #f59e0b)"
          : `linear-gradient(135deg, ${GREEN}, #6f9a30)`,
        boxShadow: toneAmber
          ? "0 6px 16px -6px rgba(245,158,11,0.55)"
          : "0 6px 16px -6px rgba(149,191,71,0.55)",
      }}
    >
      <Ico style={{ width: 18, height: 18, color: "#ffffff" }} strokeWidth={2} />
    </span>
  );
}

function GhostButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="bspx-rail-slim"
      style={{
        borderRadius: 12, border: `1px solid ${LINE}`, background: "#ffffff",
        padding: "9px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function DialogFrame({
  open, onClose, children, labelledBy,
}: {
  open: boolean; onClose: () => void; children: React.ReactNode; labelledBy: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
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
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md overflow-hidden"
            style={PANEL}
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
  const [focused, setFocused] = useState(false);
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
      <div className="flex items-center gap-3" style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${LINE}` }}>
        <HeadIcon icon={Save} />
        <h2 id="proj-save-title" className="flex-1" style={{ fontSize: 16, fontWeight: 800, color: INK }}>{title}</h2>
        <button
          onClick={onClose}
          aria-label={cancelLabel}
          className="bspx-rail-slim flex items-center justify-center shrink-0"
          style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${LINE}`, background: "#fff", cursor: "pointer" }}
        >
          <X style={{ width: 15, height: 15 }} strokeWidth={2} />
        </button>
      </div>
      <div style={{ padding: "18px 20px 6px" }}>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder={placeholder}
          maxLength={60}
          className="w-full outline-none transition-all"
          style={{
            borderRadius: 12,
            border: `1.5px solid ${focused ? GREEN : "#e2e2df"}`,
            boxShadow: focused ? "0 0 0 3px rgba(149,191,71,0.18)" : "none",
            background: "#fafaf8", color: INK,
            padding: "11px 14px", fontSize: 13.5, fontWeight: 600,
          }}
        />
        <p style={{ marginTop: 9, fontSize: 11.5, color: INK_FAINT, lineHeight: 1.5 }}>{hint}</p>
        {error && <p style={{ marginTop: 8, fontSize: 12, color: AMBER_DEEP, lineHeight: 1.45, fontWeight: 600 }}>{error}</p>}
      </div>
      <div className="flex justify-end gap-2" style={{ padding: "14px 20px 18px" }}>
        <GhostButton onClick={onClose}>{cancelLabel}</GhostButton>
        <button
          onClick={submit}
          disabled={!name.trim() || busy}
          className="btn-deploy flex items-center gap-1.5 disabled:opacity-50"
          style={{ padding: "9px 18px", fontSize: 12.5 }}
        >
          <Save className={busy ? "animate-pulse" : ""} style={{ width: 14, height: 14 }} strokeWidth={2} />
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
      <div style={{ padding: "20px 20px 14px" }}>
        <div className="flex items-start gap-3.5">
          <HeadIcon icon={AlertTriangle} toneAmber />
          <div className="min-w-0" style={{ paddingTop: 2 }}>
            <h2 id="proj-confirm-title" style={{ fontSize: 15.5, fontWeight: 800, color: INK }}>{title}</h2>
            <p style={{ marginTop: 4, fontSize: 12.5, color: INK_SOFT, lineHeight: 1.5 }}>{text}</p>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2" style={{ padding: "0 20px 18px" }}>
        <GhostButton onClick={onClose}>{cancelLabel}</GhostButton>
        <button
          onClick={onConfirm}
          className="btn-deploy"
          style={{ padding: "9px 18px", fontSize: 12.5 }}
        >
          {confirmLabel}
        </button>
      </div>
    </DialogFrame>
  );
}
