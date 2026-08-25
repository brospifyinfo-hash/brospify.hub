"use client";

// ─── Termin-Kalender des Inhabers ────────────────────────────────
// Die Bedienung ist bewusst auf einen einzigen Satz reduzierbar:
// „Tag antippen, Uhrzeit antippen, fertig."
//
//   • Tag antippen        → Tagesansicht mit allen Terminen
//   • Uhrzeit antippen    → Termin ist freigegeben und sofort online
//   • Termin antippen     → sperren, wieder freigeben oder löschen
//   • Mehrfach-Modus      → dieselbe Uhrzeit auf viele Tage verteilen
//
// Kein Fachbegriff, keine Formulare mit zehn Feldern, kein Speichern-
// Knopf, der vergessen werden kann: jede Aktion schreibt sofort.

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MONTH_NAMES,
  SLOT_KIND_LABEL,
  SLOT_KINDS,
  WEEKDAY_SHORT,
  daysInMonth,
  formatDateLong,
  mondayIndex,
  parseDate,
  toDateKey,
  todayKey,
  type SlotKind,
} from "@/lib/types";
import type { AdminSlot } from "./types";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Uhrzeiten, die ein Studio-Tag üblicherweise hergibt. Reine Abkürzung —
 *  alles andere geht über die freie Eingabe darunter. */
const TIME_PRESETS = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const DURATIONS = [
  { minutes: 60, label: "1 Std" },
  { minutes: 120, label: "2 Std" },
  { minutes: 180, label: "3 Std" },
  { minutes: 240, label: "4 Std" },
  { minutes: 360, label: "6 Std" },
];

/** "14:00" → 840 */
function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** 840 → "14:00" (nur innerhalb eines Tages) */
function toTime(minutes: number): string {
  const m = Math.max(0, Math.min(23 * 60 + 59, minutes));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** 150 → "2 Std 30 Min" */
function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} Min`;
  return m ? `${h} Std ${m} Min` : `${h} Std`;
}

const STATUS_STYLE: Record<AdminSlot["status"], { bg: string; fg: string; label: string }> = {
  open: { bg: "rgba(255,210,0,0.12)", fg: "var(--signal)", label: "frei" },
  requested: { bg: "rgba(214,177,149,0.15)", fg: "var(--skin)", label: "angefragt" },
  booked: { bg: "rgba(111,191,122,0.14)", fg: "var(--ok)", label: "vergeben" },
  blocked: { bg: "rgba(237,233,227,0.06)", fg: "var(--bone-dim)", label: "gesperrt" },
};

export function AdminCalendar({
  slots,
  onChanged,
  onOpenBooking,
}: {
  slots: AdminSlot[];
  onChanged: () => Promise<void> | void;
  onOpenBooking: (bookingId: string) => void;
}) {
  const today = todayKey();
  const [cursor, setCursor] = useState(() => {
    const { y, m } = parseDate(today);
    return { year: y, month: m };
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(today);
  const [duration, setDuration] = useState(120);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Art des Termins, den die nächsten Klicks anlegen. Beratung ist der
  // Regelfall — der erste Kontakt ist immer ein Gespräch.
  const [kind, setKind] = useState<SlotKind>("consultation");
  // Freie Eingabe: der Inhaber denkt in „von 14 bis 17 Uhr", nicht in
  // Minuten. Die Dauer ergibt sich, statt gewählt zu werden.
  const [fromTime, setFromTime] = useState("14:00");
  const [toTimeValue, setToTimeValue] = useState("16:00");

  // Mehrfach-Modus: erst Tage sammeln, dann einmal eine Uhrzeit setzen.
  const [multi, setMulti] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const byDate = useMemo(() => {
    const map = new Map<string, AdminSlot[]>();
    for (const slot of slots) {
      const list = map.get(slot.date);
      if (list) list.push(slot);
      else map.set(slot.date, [slot]);
    }
    for (const list of map.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  }, [slots]);

  const grid = useMemo(() => {
    const { year, month } = cursor;
    const cells: (string | null)[] = Array(mondayIndex(year, month, 1)).fill(null);
    const total = daysInMonth(year, month);
    for (let d = 1; d <= total; d += 1) cells.push(toDateKey(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  // Hinweis-Zeile wieder ausblenden, damit sie sich nicht stapelt.
  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(id);
  }, [note]);

  const call = useCallback(
    async (input: RequestInfo, init: RequestInit, successNote: string) => {
      setBusy(true);
      try {
        const res = await fetch(input, init);
        const data = (await res.json().catch(() => ({}))) as { error?: string; created?: number };
        if (!res.ok) {
          setNote(data.error ?? "Das hat nicht geklappt.");
          return false;
        }
        await onChanged();
        setNote(successNote);
        return true;
      } catch {
        setNote("Keine Verbindung zum Server.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [onChanged],
  );

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const next = c.month + delta;
      if (next < 1) return { year: c.year - 1, month: 12 };
      if (next > 12) return { year: c.year + 1, month: 1 };
      return { year: c.year, month: next };
    });
  }

  function tapDay(date: string) {
    if (multi) {
      setPicked((p) => (p.includes(date) ? p.filter((d) => d !== date) : [...p, date]));
      return;
    }
    setSelectedDay(date);
  }

  async function addSlot(date: string, startTime: string) {
    await call(
      "/api/admin/slots",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: [{ date, startTime, durationMinutes: duration, kind }] }),
      },
      `${SLOT_KIND_LABEL[kind]} am ${formatDateLong(date)} um ${startTime} Uhr ist online.`,
    );
  }

  /** Termin aus der freien Eingabe „von … bis …". */
  async function addCustomSlot() {
    if (!selectedDay) return;
    const minutes = toMinutes(toTimeValue) - toMinutes(fromTime);
    if (minutes < 15) {
      setNote("Die Endzeit muss mindestens 15 Minuten nach der Startzeit liegen.");
      return;
    }
    if (minutes > 720) {
      setNote("Ein Termin kann höchstens 12 Stunden dauern.");
      return;
    }
    await call(
      "/api/admin/slots",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Die Endzeit geht direkt mit — der Server rechnet die Dauer aus,
        // damit Anzeige und Datenbestand nicht auseinanderlaufen können.
        body: JSON.stringify({ slots: [{ date: selectedDay, startTime: fromTime, endTime: toTimeValue, kind }] }),
      },
      `${SLOT_KIND_LABEL[kind]} am ${formatDateLong(selectedDay)}, ${fromTime} – ${toTimeValue} Uhr ist online.`,
    );
  }

  async function addToPickedDays(startTime: string) {
    if (!picked.length) return;
    const ok = await call(
      "/api/admin/slots",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: picked, startTime, durationMinutes: duration, kind }),
      },
      `${SLOT_KIND_LABEL[kind]} um ${startTime} Uhr an ${picked.length} ${picked.length === 1 ? "Tag" : "Tagen"} freigegeben.`,
    );
    if (ok) { setPicked([]); setMulti(false); }
  }

  async function toggleBlock(slot: AdminSlot) {
    const next = slot.status === "blocked" ? "open" : "blocked";
    await call(
      "/api/admin/slots",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: slot.id, status: next }),
      },
      next === "blocked" ? "Termin gesperrt — Kunden sehen ihn nicht mehr." : "Termin ist wieder online.",
    );
  }

  async function removeSlot(slot: AdminSlot) {
    const warning = slot.booking
      ? "Auf diesem Termin liegt eine Anfrage. Beim Löschen verschwindet auch sie. Wirklich löschen?"
      : "Diesen Termin löschen?";
    if (!window.confirm(warning)) return;
    await call(
      `/api/admin/slots?id=${encodeURIComponent(slot.id)}`,
      { method: "DELETE" },
      "Termin gelöscht.",
    );
  }

  const daySlots = selectedDay ? byDate.get(selectedDay) ?? [] : [];
  const takenTimes = new Set(daySlots.map((s) => s.startTime));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:gap-8">
      {/* ── Monatsraster ── */}
      <div className="card p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button" onClick={() => shiftMonth(-1)} aria-label="Vorheriger Monat"
              className="flex h-11 w-11 items-center justify-center rounded-full text-lg"
              style={{ border: "1px solid var(--ink-hair)" }}
            >‹</button>
            <button
              type="button" onClick={() => shiftMonth(1)} aria-label="Nächster Monat"
              className="flex h-11 w-11 items-center justify-center rounded-full text-lg"
              style={{ border: "1px solid var(--ink-hair)" }}
            >›</button>
            <span className="display ml-2 text-xl">
              {MONTH_NAMES[cursor.month - 1]} <span style={{ color: "var(--bone-dim)" }}>{cursor.year}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => { setMulti((m) => !m); setPicked([]); }}
            className="btn btn-ghost h-11 px-4 text-[0.7rem]"
            style={multi ? { borderColor: "var(--signal)", color: "var(--signal)" } : undefined}
          >
            {multi ? "Mehrfach beenden" : "Mehrere Tage"}
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_SHORT.map((d) => (
            <span key={d} className="pb-2 text-center text-[0.65rem] uppercase tracking-[0.1em]" style={{ color: "var(--bone-dim)" }}>
              {d}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grid.map((date, i) => {
            if (!date) return <span key={`pad-${i}`} className="min-h-[64px]" />;
            const list = byDate.get(date) ?? [];
            const isPast = date < today;
            const isToday = date === today;
            const isPicked = picked.includes(date);
            const isSelected = !multi && date === selectedDay;
            const { d } = parseDate(date);
            const open = list.filter((s) => s.status === "open").length;
            const active = list.filter((s) => s.status === "requested" || s.status === "booked").length;

            return (
              <button
                key={date}
                type="button"
                onClick={() => tapDay(date)}
                aria-label={`${formatDateLong(date)} — ${list.length} ${list.length === 1 ? "Termin" : "Termine"}`}
                aria-pressed={isSelected || isPicked}
                className="flex min-h-[64px] flex-col items-center justify-start gap-1 rounded p-1.5 transition-colors duration-200"
                style={{
                  background: isPicked
                    ? "var(--signal)"
                    : isSelected
                      ? "rgba(255,210,0,0.1)"
                      : "transparent",
                  border: `1px solid ${
                    isPicked || isSelected ? "var(--signal)" : isToday ? "var(--ink-hair-strong)" : "var(--ink-hair)"
                  }`,
                  opacity: isPast && !list.length ? 0.35 : 1,
                  color: isPicked ? "#131200" : "var(--bone)",
                }}
              >
                <span className="text-sm" style={{ fontWeight: isToday ? 700 : 400 }}>{d}</span>
                {/* Ein Punkt je Termin: gelb = frei, grün = vergeben. */}
                <span className="flex flex-wrap justify-center gap-[3px]">
                  {Array.from({ length: Math.min(open, 4) }).map((_, k) => (
                    <span key={`o${k}`} className="h-1.5 w-1.5 rounded-full" style={{ background: isPicked ? "#131200" : "var(--signal)" }} />
                  ))}
                  {Array.from({ length: Math.min(active, 4) }).map((_, k) => (
                    <span key={`a${k}`} className="h-1.5 w-1.5 rounded-full" style={{ background: isPicked ? "#131200" : "var(--ok)" }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs" style={{ color: "var(--bone-dim)" }}>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--signal)" }} /> frei
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ok)" }} /> angefragt oder vergeben
          </span>
        </div>
      </div>

      {/* ── Seitenspalte: Tag bearbeiten oder Mehrfach-Modus ── */}
      <div className="card flex flex-col p-4 sm:p-6">
        {/* ── Art des Termins ── */}
        <div className="mb-5">
          <span className="eyebrow mb-2 block">Art des Termins</span>
          <div className="flex flex-wrap gap-2">
            {SLOT_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className="min-h-[40px] rounded px-3 text-sm transition-colors"
                style={{
                  background: kind === k ? "var(--signal)" : "transparent",
                  color: kind === k ? "#131200" : "var(--bone-soft)",
                  border: `1px solid ${kind === k ? "var(--signal)" : "var(--ink-hair)"}`,
                  fontWeight: kind === k ? 600 : 400,
                }}
              >
                {SLOT_KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs" style={{ color: "var(--bone-dim)" }}>
            {kind === "consultation"
              ? "Erstgespräch: Motiv, Größe, Stelle und Preis. Es wird nicht gestochen."
              : "Termin zum Tätowieren — für Kunden, mit denen alles schon besprochen ist."}
          </p>
        </div>

        <div className="mb-5">
          <span className="eyebrow mb-2 block">Dauer je Termin</span>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d.minutes}
                type="button"
                onClick={() => setDuration(d.minutes)}
                className="min-h-[40px] rounded px-3 text-sm transition-colors"
                style={{
                  background: duration === d.minutes ? "var(--signal)" : "transparent",
                  color: duration === d.minutes ? "#131200" : "var(--bone-soft)",
                  border: `1px solid ${duration === d.minutes ? "var(--signal)" : "var(--ink-hair)"}`,
                  fontWeight: duration === d.minutes ? 600 : 400,
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {multi ? (
          <div>
            <p className="eyebrow mb-2">Mehrere Tage</p>
            <p className="mb-4 text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
              {picked.length
                ? `${picked.length} ${picked.length === 1 ? "Tag" : "Tage"} ausgewählt. Jetzt eine Uhrzeit antippen — sie wird auf allen gesetzt.`
                : "Tippe im Kalender die Tage an, die dieselbe Uhrzeit bekommen sollen."}
            </p>
            <div className="flex flex-wrap gap-2">
              {TIME_PRESETS.map((time) => (
                <button
                  key={time}
                  type="button"
                  disabled={!picked.length || busy}
                  onClick={() => addToPickedDays(time)}
                  className="min-h-[44px] rounded px-3 text-sm disabled:opacity-30"
                  style={{ border: "1px solid var(--ink-hair-strong)", color: "var(--bone)" }}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <p className="eyebrow mb-1">{selectedDay ? formatDateLong(selectedDay) : "Kein Tag gewählt"}</p>
            <p className="mb-4 text-sm" style={{ color: "var(--bone-soft)" }}>
              Uhrzeit antippen = Termin ist sofort online.
            </p>

            <div className="mb-6 flex flex-wrap gap-2">
              {TIME_PRESETS.map((time) => {
                const taken = takenTimes.has(time);
                return (
                  <button
                    key={time}
                    type="button"
                    disabled={!selectedDay || taken || busy}
                    onClick={() => selectedDay && addSlot(selectedDay, time)}
                    title={taken ? "Für diese Uhrzeit gibt es schon einen Termin" : undefined}
                    className="min-h-[44px] rounded px-3 text-sm transition-colors disabled:opacity-30"
                    style={{ border: "1px solid var(--ink-hair-strong)", color: taken ? "var(--bone-dim)" : "var(--bone)" }}
                  >
                    {taken ? `${time} ✓` : `+ ${time}`}
                  </button>
                );
              })}
            </div>

            {/* ── Freie Zeitspanne ──
                Für alles, was nicht ins Stundenraster passt: Feierabend-
                termin um 18:45, Sitzung von 12 bis 17:30. */}
            <details className="mb-6" style={{ borderTop: "1px solid var(--ink-hair)", paddingTop: "1rem" }}>
              <summary className="cursor-pointer text-sm" style={{ color: "var(--bone-soft)" }}>
                Andere Uhrzeit eintragen
              </summary>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="flex-1">
                  <span className="eyebrow mb-1 block">Von</span>
                  <input
                    type="time"
                    step={300}
                    className="field"
                    value={fromTime}
                    onChange={(e) => {
                      setFromTime(e.target.value);
                      // Endzeit mitziehen, damit sie nie vor dem Start liegt.
                      if (toMinutes(e.target.value) >= toMinutes(toTimeValue)) {
                        setToTimeValue(toTime(toMinutes(e.target.value) + duration));
                      }
                    }}
                  />
                </label>
                <label className="flex-1">
                  <span className="eyebrow mb-1 block">Bis</span>
                  <input
                    type="time"
                    step={300}
                    className="field"
                    value={toTimeValue}
                    onChange={(e) => setToTimeValue(e.target.value)}
                  />
                </label>
              </div>
              <p className="mt-2 text-xs" style={{ color: "var(--bone-dim)" }}>
                {toMinutes(toTimeValue) > toMinutes(fromTime)
                  ? `Dauer: ${durationLabel(toMinutes(toTimeValue) - toMinutes(fromTime))}`
                  : "Die Endzeit muss nach der Startzeit liegen."}
              </p>
              <button
                type="button"
                disabled={!selectedDay || busy || toMinutes(toTimeValue) <= toMinutes(fromTime)}
                onClick={addCustomSlot}
                className="btn btn-ghost mt-3 h-11 w-full text-[0.7rem]"
              >
                Termin eintragen
              </button>
            </details>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {daySlots.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--bone-dim)" }}>
                  An diesem Tag ist noch nichts eingetragen.
                </p>
              ) : (
                <ul className="space-y-2">
                  <AnimatePresence initial={false}>
                    {daySlots.map((slot) => {
                      const tone = STATUS_STYLE[slot.status];
                      return (
                        <motion.li
                          key={slot.id}
                          layout
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25, ease: EASE }}
                          className="rounded p-3"
                          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--ink-hair)" }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium">{slot.startTime} – {slot.endTime}</span>
                            <span
                              className="rounded-full px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.1em]"
                              style={{ background: tone.bg, color: tone.fg }}
                            >
                              {tone.label}
                            </span>
                          </div>
                          <p className="mt-1 text-[0.7rem]" style={{ color: "var(--bone-dim)" }}>
                            {SLOT_KIND_LABEL[slot.kind ?? "consultation"]} ·{" "}
                            {durationLabel(slot.durationMinutes)}
                          </p>

                          {slot.booking && (
                            <button
                              type="button"
                              onClick={() => onOpenBooking(slot.booking!.id)}
                              className="mt-2 block text-left text-xs underline underline-offset-4"
                              style={{ color: "var(--skin)" }}
                            >
                              {slot.booking.name} — Anfrage ansehen
                            </button>
                          )}

                          <div className="mt-3 flex flex-wrap gap-2">
                            {!slot.booking && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => toggleBlock(slot)}
                                className="min-h-[36px] rounded px-3 text-xs"
                                style={{ border: "1px solid var(--ink-hair-strong)", color: "var(--bone-soft)" }}
                              >
                                {slot.status === "blocked" ? "Wieder freigeben" : "Sperren"}
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => removeSlot(slot)}
                              className="min-h-[36px] rounded px-3 text-xs"
                              style={{ border: "1px solid rgba(226,86,74,0.35)", color: "var(--danger)" }}
                            >
                              Löschen
                            </button>
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          </div>
        )}

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
      </div>
    </div>
  );
}
