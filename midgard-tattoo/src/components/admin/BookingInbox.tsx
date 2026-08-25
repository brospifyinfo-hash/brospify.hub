"use client";

// ─── Posteingang für Anfragen ────────────────────────────────────
// Links die Liste, rechts die gewählte Anfrage im Detail. Auf dem
// Handy stapelt sich das: erst die Liste, nach dem Antippen die
// Detailansicht mit „Zurück"-Knopf.
//
// Die zwei wichtigen Knöpfe (Bestätigen / Ablehnen) sitzen immer an
// derselben Stelle und sind die einzigen farbigen Elemente der Karte.

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  budgetLabel,
  colorLabel,
  formatDateLong,
  formatTimestamp,
  placementLabel,
  SLOT_KIND_LABEL,
  sizeLabel,
  styleLabel,
  type BookingStatus,
} from "@/lib/types";
import type { AdminBooking } from "./types";

const EASE = [0.22, 1, 0.36, 1] as const;

const STATUS_TONE: Record<BookingStatus, { bg: string; fg: string; label: string }> = {
  pending: { bg: "rgba(255,210,0,0.13)", fg: "var(--signal)", label: "offen" },
  confirmed: { bg: "rgba(111,191,122,0.14)", fg: "var(--ok)", label: "bestätigt" },
  declined: { bg: "rgba(226,86,74,0.12)", fg: "var(--danger)", label: "abgelehnt" },
  cancelled: { bg: "rgba(237,233,227,0.06)", fg: "var(--bone-dim)", label: "storniert" },
};

const FILTERS: { key: "open" | "all"; label: string }[] = [
  { key: "open", label: "Offen" },
  { key: "all", label: "Alle" },
];

export function BookingInbox({
  bookings,
  selectedId,
  onSelect,
  onChanged,
}: {
  bookings: AdminBooking[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChanged: () => Promise<void> | void;
}) {
  const [filter, setFilter] = useState<"open" | "all">("open");

  const visible = useMemo(
    () => (filter === "open" ? bookings.filter((b) => b.status === "pending") : bookings),
    [bookings, filter],
  );

  const selected = bookings.find((b) => b.id === selectedId) ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:gap-8">
      {/* ── Liste ── */}
      <div className={`card p-4 sm:p-5 ${selected ? "hidden lg:block" : ""}`}>
        <div className="mb-4 flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className="min-h-[40px] rounded px-4 text-sm transition-colors"
              style={{
                background: filter === f.key ? "var(--signal)" : "transparent",
                color: filter === f.key ? "#131200" : "var(--bone-soft)",
                border: `1px solid ${filter === f.key ? "var(--signal)" : "var(--ink-hair)"}`,
                fontWeight: filter === f.key ? 600 : 400,
              }}
            >
              {f.label}
              {f.key === "open" && (
                <span className="ml-2 opacity-70">
                  {bookings.filter((b) => b.status === "pending").length}
                </span>
              )}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: "var(--bone-dim)" }}>
            {filter === "open" ? "Keine offenen Anfragen." : "Noch keine Anfragen."}
          </p>
        ) : (
          <ul className="space-y-2">
            {visible.map((booking) => {
              const tone = STATUS_TONE[booking.status];
              const active = booking.id === selectedId;
              return (
                <li key={booking.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(booking.id)}
                    className="w-full rounded p-3 text-left transition-colors"
                    style={{
                      background: active ? "rgba(255,210,0,0.07)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${active ? "var(--signal)" : "var(--ink-hair)"}`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium">{booking.name}</span>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.1em]"
                        style={{ background: tone.bg, color: tone.fg }}
                      >
                        {tone.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs" style={{ color: "var(--bone-dim)" }}>
                      {booking.slot
                        ? `${formatDateLong(booking.slot.date)} · ${booking.slot.startTime} Uhr · ${SLOT_KIND_LABEL[booking.slot.kind ?? "consultation"]}`
                        : "Termin gelöscht"}
                    </p>
                    <p className="mt-1 truncate text-xs" style={{ color: "var(--bone-soft)" }}>
                      {styleLabel(booking.style)} · {placementLabel(booking.placement)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Detail ── */}
      <AnimatePresence mode="wait" initial={false}>
        {selected ? (
          <BookingDetail
            key={selected.id}
            booking={selected}
            onSelect={onSelect}
            onChanged={onChanged}
          />
        ) : (
          <motion.div
            key="empty"
            className="card hidden items-center justify-center p-10 text-center lg:flex"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <p className="max-w-[28ch] text-sm" style={{ color: "var(--bone-dim)" }}>
              Wähl links eine Anfrage aus, um Details zu sehen und zu antworten.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Detailkarte einer Anfrage ───────────────────────────────────
// Bewusst eine eigene Komponente mit `key={booking.id}` am Aufrufort:
// beim Wechsel der Anfrage baut React sie neu auf, und das Notizfeld
// startet über den useState-Initialwert automatisch mit dem
// gespeicherten Text. Früher tat das ein Effekt — der schrieb bei
// jedem Wechsel synchron State und löste eine zusätzliche Render-Runde
// aus. Der Aufbau hier kommt ohne aus.
function BookingDetail({
  booking,
  onSelect,
  onChanged,
}: {
  booking: AdminBooking;
  onSelect: (id: string | null) => void;
  onChanged: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [adminNote, setAdminNote] = useState(booking.adminNote ?? "");
  const [note, setNote] = useState<string | null>(null);

  // Hinweiszeile nach vier Sekunden ausblenden, damit sie sich nicht stapelt.
  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(id);
  }, [note]);

  async function decide(status: BookingStatus) {
    if (busy) return;
    if (status === "declined" && !window.confirm("Anfrage ablehnen? Der Termin wird wieder freigegeben.")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: booking.id, status, adminNote }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setNote(data.error ?? "Das hat nicht geklappt."); return; }
      await onChanged();
      setNote(
        status === "confirmed"
          ? "Bestätigt — der Kunde bekommt eine Mail."
          : status === "declined"
            ? "Abgelehnt — der Termin ist wieder frei."
            : "Gespeichert.",
      );
    } catch {
      setNote("Keine Verbindung zum Server.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    if (!window.confirm("Anfrage endgültig löschen? Die Kundendaten sind danach weg.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/bookings?id=${encodeURIComponent(booking.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) { setNote("Löschen fehlgeschlagen."); return; }
      onSelect(null);
      await onChanged();
      setNote("Anfrage gelöscht.");
    } catch {
      setNote("Keine Verbindung zum Server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      className="card p-5 sm:p-7"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: EASE }}
    >
      <button
        type="button"
        onClick={() => onSelect(null)}
        className="mb-4 text-xs underline underline-offset-4 lg:hidden"
        style={{ color: "var(--bone-dim)" }}
      >
        ‹ Zurück zur Liste
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="display text-2xl">{booking.name}</h3>
          <p className="mt-1 text-sm" style={{ color: "var(--signal)" }}>
            {booking.slot
              ? `${SLOT_KIND_LABEL[booking.slot.kind ?? "consultation"]} · ${formatDateLong(booking.slot.date)} · ${booking.slot.startTime} – ${booking.slot.endTime} Uhr`
              : "Der zugehörige Termin wurde gelöscht"}
          </p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-[0.65rem] uppercase tracking-[0.1em]"
          style={{ background: STATUS_TONE[booking.status].bg, color: STATUS_TONE[booking.status].fg }}
        >
          {STATUS_TONE[booking.status].label}
        </span>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <a href={`mailto:${booking.email}`} className="btn btn-ghost h-11 px-4 text-[0.7rem]">
          {booking.email}
        </a>
        <a href={`tel:${booking.phone.replace(/\s/g, "")}`} className="btn btn-ghost h-11 px-4 text-[0.7rem]">
          {booking.phone}
        </a>
      </div>

      <dl className="mt-7 grid gap-px" style={{ background: "var(--ink-hair)" }}>
        <Row label="Stil" value={styleLabel(booking.style)} />
        <Row label="Größe" value={sizeLabel(booking.size)} />
        <Row label="Stelle" value={placementLabel(booking.placement)} />
        <Row label="Farbe" value={colorLabel(booking.colorMode)} />
        <Row label="Budget" value={budgetLabel(booking.budget)} />
        <Row label="Erstes Tattoo" value={booking.isFirstTattoo ? "Ja" : "Nein"} />
        {booking.referenceUrl && (
          <Row
            label="Referenz"
            value={
              <a
                href={booking.referenceUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline underline-offset-4"
                style={{ color: "var(--skin)" }}
              >
                Link öffnen
              </a>
            }
          />
        )}
      </dl>

      <div className="mt-6">
        <p className="eyebrow mb-2">Die Idee</p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
          {booking.idea}
        </p>
      </div>

      <label className="mt-6 block">
        <span className="eyebrow mb-2 block">Notiz an den Kunden</span>
        <textarea
          rows={3}
          className="field"
          style={{ resize: "vertical" }}
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          placeholder="Wird in der Bestätigungs- oder Absage-Mail mitgeschickt. Kann leer bleiben."
        />
      </label>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || booking.status === "confirmed"}
          onClick={() => decide("confirmed")}
          className="btn btn-signal flex-1"
        >
          {booking.status === "confirmed" ? "Bereits bestätigt" : "Termin bestätigen"}
        </button>
        <button
          type="button"
          disabled={busy || booking.status === "declined"}
          onClick={() => decide("declined")}
          className="btn btn-ghost"
          style={{ borderColor: "rgba(226,86,74,0.4)", color: "var(--danger)" }}
        >
          Ablehnen
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-5" style={{ borderTop: "1px solid var(--ink-hair)" }}>
        <span className="text-xs" style={{ color: "var(--bone-dim)" }}>
          Eingegangen am {formatTimestamp(booking.createdAt)} Uhr
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={remove}
          className="text-xs underline underline-offset-4"
          style={{ color: "var(--bone-dim)" }}
        >
          Anfrage löschen
        </button>
      </div>

      <AnimatePresence>
        {note && (
          <motion.p
            className="mt-4 rounded p-3 text-xs"
            style={{ background: "rgba(255,210,0,0.08)", color: "var(--signal)" }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="status"
          >
            {note}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[130px_1fr] sm:gap-4" style={{ background: "var(--ink-card)" }}>
      <dt className="eyebrow">{label}</dt>
      <dd className="text-sm" style={{ color: "var(--bone-soft)" }}>{value}</dd>
    </div>
  );
}
