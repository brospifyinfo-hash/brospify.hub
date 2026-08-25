"use client";

// ─── Bewertungen verwalten ───────────────────────────────────────
// Der Inhaber trägt hier ein, was Kunden ihm gesagt oder bei Google
// hinterlassen haben. Die Seite erfindet nichts — was nicht hier steht,
// steht auch nicht auf der Website.
//
// „Sichtbar" ist bewusst ein eigener Schalter: So lässt sich eine
// Bewertung vorbereiten oder vorübergehend zurückziehen, ohne sie zu
// verlieren.

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Stars } from "@/components/ui";
import { todayKey } from "@/lib/types";
import type { Review } from "@/lib/types";

const EASE = [0.22, 1, 0.36, 1] as const;

const LEER = { name: "", rating: 5, text: "", date: "", source: "" };

export function ReviewManager({
  reviews,
  onChanged,
}: {
  reviews: Review[];
  onChanged: () => Promise<void> | void;
}) {
  const [form, setForm] = useState({ ...LEER, date: todayKey() });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(id);
  }, [note]);

  async function eintragen(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors({});
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => ({}))) as {
        errors?: Record<string, string>; error?: string;
      };
      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        else setNote(data.error ?? "Das hat nicht geklappt.");
        return;
      }
      setForm({ ...LEER, date: todayKey() });
      await onChanged();
      setNote("Bewertung eingetragen.");
    } catch {
      setNote("Keine Verbindung zum Server.");
    } finally {
      setBusy(false);
    }
  }

  async function aendern(id: string, patch: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) { setNote("Änderung fehlgeschlagen."); return; }
      await onChanged();
    } catch {
      setNote("Keine Verbindung zum Server.");
    } finally {
      setBusy(false);
    }
  }

  async function loeschen(review: Review) {
    if (!window.confirm(`Bewertung von ${review.name} löschen?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/reviews?id=${encodeURIComponent(review.id)}`, { method: "DELETE" });
      if (!res.ok) { setNote("Löschen fehlgeschlagen."); return; }
      await onChanged();
      setNote("Bewertung gelöscht.");
    } catch {
      setNote("Keine Verbindung zum Server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-8">
      {/* ── Neu eintragen ── */}
      <form onSubmit={eintragen} className="card h-fit p-5 sm:p-6" noValidate>
        <h3 className="display text-lg">Bewertung eintragen</h3>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
          Nur echte Rückmeldungen. Erfundene Bewertungen sind Irreführung und können
          teuer werden.
        </p>

        <label className="mt-5 block">
          <span className="eyebrow mb-2 block">Name</span>
          <input
            className={`field ${errors.name ? "field-error" : ""}`}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="z. B. Lena K."
          />
          {errors.name && <span className="mt-1 block text-xs" style={{ color: "var(--danger)" }}>{errors.name}</span>}
        </label>

        <div className="mt-4">
          <span className="eyebrow mb-2 block">Sterne</span>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setForm({ ...form, rating: n })}
                aria-label={`${n} von 5 Sternen`}
                aria-pressed={form.rating === n}
                className="text-2xl leading-none"
                style={{ color: n <= form.rating ? "var(--signal)" : "var(--ink-hair-strong)" }}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 block">
          <span className="eyebrow mb-2 block">Text</span>
          <textarea
            rows={4}
            className={`field ${errors.text ? "field-error" : ""}`}
            style={{ resize: "vertical" }}
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            placeholder="Was hat der Kunde gesagt?"
          />
          {errors.text && <span className="mt-1 block text-xs" style={{ color: "var(--danger)" }}>{errors.text}</span>}
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="eyebrow mb-2 block">Datum</span>
            <input
              type="date"
              className={`field ${errors.date ? "field-error" : ""}`}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="eyebrow mb-2 block">Quelle</span>
            <input
              className="field"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              placeholder="Google, persönlich …"
            />
          </label>
        </div>

        <button type="submit" disabled={busy} className="btn btn-signal mt-5 w-full">
          {busy ? "Moment …" : "Eintragen"}
        </button>

        <AnimatePresence>
          {note && (
            <motion.p
              className="mt-4 rounded p-3 text-xs"
              style={{ background: "rgba(255,210,0,0.08)", color: "var(--signal)" }}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              role="status"
            >
              {note}
            </motion.p>
          )}
        </AnimatePresence>
      </form>

      {/* ── Bestand ── */}
      <div>
        {reviews.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm" style={{ color: "var(--bone-dim)" }}>
              Noch keine Bewertungen. Solange hier nichts steht, zeigt die Seite
              /bewertungen einen Hinweis statt einer leeren Liste.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {reviews.map((review) => (
                <motion.li
                  key={review.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="card p-5"
                  style={{ opacity: review.published ? 1 : 0.55 }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="flex items-center gap-3">
                      <Stars rating={review.rating} />
                      <span className="text-sm font-medium">{review.name}</span>
                    </span>
                    <span className="text-xs" style={{ color: "var(--bone-dim)" }}>
                      {review.date}
                      {review.source && ` · ${review.source}`}
                    </span>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
                    {review.text}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={review.published}
                        disabled={busy}
                        onChange={(e) => void aendern(review.id, { published: e.target.checked })}
                        className="h-5 w-5 cursor-pointer"
                        style={{ accentColor: "var(--signal)" }}
                      />
                      <span className="text-sm" style={{ color: "var(--bone-soft)" }}>
                        Auf der Website sichtbar
                      </span>
                    </label>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void loeschen(review)}
                      className="ml-auto min-h-[36px] rounded px-3 text-xs"
                      style={{ border: "1px solid rgba(226,86,74,0.35)", color: "var(--danger)" }}
                    >
                      Löschen
                    </button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
