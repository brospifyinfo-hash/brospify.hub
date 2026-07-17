"use client";

// ─── Designs-Overlay: Speicherstände mit sichtbaren Sync-Codes ──────
// Jedes gespeicherte Design hat einen EIGENEN Sync-Code. Der Kunde sieht
// alle Codes jederzeit, kopiert sie per Klick und wechselt das Live-Design
// im Shop, indem er einen anderen Code in den Shopify-Block einträgt —
// ohne neues ZIP. Laden holt den Speicherstand zurück in den Editor.

import { useCallback, useEffect, useState } from "react";
import { X, BookmarkPlus, Copy, Check, Trash2, FolderOpen, RefreshCw, Bookmark } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ThemeDocument } from "@/lib/theme-doc";
import type { Locale } from "@/lib/i18n";
import { ACCENT } from "@/components/theme-editor/editor-ui";

export interface DesignMeta {
  code: string;
  productId: string;
  name: string;
  updatedAt: string;
}

function fmtDate(iso: string, lang: Locale): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(lang === "en" ? "en-GB" : "de-DE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function DesignsOverlay({
  open, onClose, productId, doc, activeCode, lang,
  onLoaded, onSaved, t,
}: {
  open: boolean;
  onClose: () => void;
  productId: string;
  doc: ThemeDocument;
  /** Code des aktuell geladenen Designs (wird markiert). */
  activeCode: string | null;
  lang: Locale;
  /** Design wurde in den Editor geladen. */
  onLoaded: (doc: ThemeDocument, code: string, name: string) => void;
  /** Design wurde (neu) gespeichert. */
  onSaved: (code: string, name: string) => void;
  t: {
    title: string; subtitle: string; saveNew: string; namePlaceholder: string;
    load: string; update: string; codeHint: string; empty: string; saved: string;
  };
}) {
  const [designs, setDesigns] = useState<DesignMeta[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // Code oder "new"
  const [copied, setCopied] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const refresh = useCallback(() => {
    setDesigns(null);
    fetch(`/api/theme-designs?productId=${encodeURIComponent(productId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { designs: [] }))
      .then((d) => setDesigns(Array.isArray(d.designs) ? d.designs : []))
      .catch(() => setDesigns([]));
  }, [productId]);

  useEffect(() => {
    if (open && productId) {
      setErr("");
      refresh();
    }
  }, [open, productId, refresh]);

  async function save(code?: string, existingName?: string) {
    const n = code ? existingName || "Design" : name.trim();
    if (!n) return;
    setBusy(code || "new");
    setErr("");
    try {
      const res = await fetch("/api/theme-designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ name: n, document: doc, code }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Aktive-Designs-Limit des Plans erreicht → verständlicher Hinweis.
        if (res.status === 403 && d?.error === "design_limit") {
          setErr(
            `Projekt-Limit erreicht (${d.used}/${d.limit}). Für mehr aktive Projekte brauchst du ein größeres Abo — öffne oben dein Konto.`,
          );
          return;
        }
        setErr(d?.error || "Fehler");
        return;
      }
      if (!code) setName("");
      onSaved(d.code, n);
      refresh();
    } catch {
      setErr("Verbindungsfehler.");
    } finally {
      setBusy(null);
    }
  }

  async function load(code: string) {
    setBusy(code);
    setErr("");
    try {
      const res = await fetch(`/api/theme-designs/${encodeURIComponent(code)}`, { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.document) {
        setErr(d?.error || "Fehler");
        return;
      }
      onLoaded(d.document as ThemeDocument, code, d.name || "");
      onClose();
    } catch {
      setErr("Verbindungsfehler.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(code: string) {
    setBusy(code);
    try {
      await fetch(`/api/theme-designs/${encodeURIComponent(code)}`, { method: "DELETE", cache: "no-store" });
      refresh();
    } finally {
      setBusy(null);
    }
  }

  function copy(code: string) {
    try {
      navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* Clipboard blockiert */
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 22, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.99 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-2xl max-h-[86vh] flex flex-col rounded-2xl border border-white/[0.1] bg-[#101014]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-white/[0.07] shrink-0">
              <Bookmark className="w-4.5 h-4.5" style={{ color: ACCENT }} />
              <div className="min-w-0 flex-1">
                <h2 className="text-[16px] font-bold text-white">{t.title}</h2>
                <p className="text-[11.5px] text-zinc-500">{t.subtitle}</p>
              </div>
              <button onClick={onClose} className="w-9 h-9 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white flex items-center justify-center transition" aria-label="Schließen">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Neues Design speichern */}
            <div className="px-4 sm:px-6 py-3 border-b border-white/[0.06] shrink-0 flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") save(); }}
                placeholder={t.namePlaceholder}
                className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-zinc-600 outline-none focus:border-[#95BF47]/40"
              />
              <button
                onClick={() => save()}
                disabled={!name.trim() || busy === "new"}
                className="shrink-0 flex items-center gap-1.5 rounded-lg text-[12.5px] font-bold px-3.5 py-2 text-white disabled:opacity-40 hover:brightness-110 transition"
                style={{ background: ACCENT }}
              >
                <BookmarkPlus className="w-4 h-4" /> {t.saveNew}
              </button>
            </div>

            {err && <p className="px-6 pt-2 text-[12px] text-amber-300/90 shrink-0">{err}</p>}

            {/* Liste */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5">
              {designs === null ? (
                <p className="text-[12.5px] text-zinc-500 text-center py-6">…</p>
              ) : designs.length === 0 ? (
                <p className="text-[12.5px] text-zinc-500 text-center py-6">{t.empty}</p>
              ) : (
                designs.map((d) => {
                  const isActive = d.code === activeCode;
                  return (
                    <div key={d.code} className={`rounded-xl border p-3 ${isActive ? "border-[#95BF47]/50 bg-[#95BF47]/[0.06]" : "border-white/[0.08] bg-white/[0.02]"}`}>
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13.5px] font-bold text-white truncate">
                            {d.name} {isActive && <span className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#95BF47]/15 text-[#cfe9a3] border border-[#95BF47]/25 ml-1 align-middle">Aktiv</span>}
                          </span>
                          <span className="block text-[10.5px] text-zinc-500">{fmtDate(d.updatedAt, lang)}</span>
                        </span>
                        <button
                          onClick={() => load(d.code)}
                          disabled={busy === d.code}
                          className="shrink-0 flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11.5px] font-semibold text-zinc-300 hover:text-white transition"
                        >
                          <FolderOpen className="w-3.5 h-3.5" /> {t.load}
                        </button>
                        <button
                          onClick={() => save(d.code, d.name)}
                          disabled={busy === d.code}
                          title={t.update}
                          className="shrink-0 flex items-center gap-1 rounded-lg border border-[#95BF47]/30 bg-[#95BF47]/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-[#cfe9a3] hover:text-white transition"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> {t.update}
                        </button>
                        <button
                          onClick={() => remove(d.code)}
                          disabled={busy === d.code}
                          aria-label="löschen"
                          className="shrink-0 w-8 h-8 rounded-lg border border-white/10 bg-white/[0.03] text-zinc-500 hover:text-red-300 hover:border-red-400/30 flex items-center justify-center transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {/* Sync-Code — immer sichtbar, per Klick kopieren */}
                      <button
                        onClick={() => copy(d.code)}
                        title={t.codeHint}
                        className="mt-2 w-full flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-1.5 hover:border-[#95BF47]/40 transition"
                      >
                        <span className="font-mono text-[11.5px] text-[#cfe9a3] truncate flex-1 text-left">{d.code}</span>
                        {copied === d.code
                          ? <span className="flex items-center gap-1 text-[10.5px] font-bold text-[#95BF47] shrink-0"><Check className="w-3.5 h-3.5" /> {t.saved}</span>
                          : <Copy className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <p className="px-4 sm:px-6 py-3 border-t border-white/[0.06] text-[10.5px] text-zinc-500 leading-snug shrink-0">
              {t.codeHint}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
