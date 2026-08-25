"use client";

// ─── Buchungs-Widget ─────────────────────────────────────────────
// Drei Schritte, immer in derselben Reihenfolge:
//   1. Tag im Monatskalender wählen (nur freigegebene Tage sind aktiv)
//   2. Uhrzeit wählen
//   3. Formular ausfüllen und absenden
//
// Zwei Entwurfsentscheidungen tragen das Ganze:
//
//  • Der Kalender kennt ausschließlich Termine, die das Studio
//    freigegeben hat. Es gibt bewusst KEINEN Weg, einen beliebigen
//    Wunschtermin einzutragen — der Kalender im Admin-Bereich ist die
//    einzige Quelle dessen, was hier buchbar ist.
//  • Auf dem Handy ist der Kalender die volle Breite und jede Zelle
//    mindestens 44 px hoch. Die Seite wird überwiegend am Telefon
//    bedient; ein Raster für die Maus wäre hier die falsche Vorlage.

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicSlot } from "@/app/api/slots/route";
import { STUDIO } from "@/lib/studio";
import {
  BUDGET_OPTIONS,
  COLOR_OPTIONS,
  MONTH_NAMES,
  PLACEMENT_OPTIONS,
  SIZE_OPTIONS,
  STYLE_OPTIONS,
  WEEKDAY_SHORT,
  daysInMonth,
  formatDateLong,
  mondayIndex,
  parseDate,
  toDateKey,
  todayKey,
  type Option,
} from "@/lib/types";
import { Reveal } from "./motion";

const EASE = [0.22, 1, 0.36, 1] as const;

interface FormState {
  name: string;
  email: string;
  phone: string;
  style: string;
  size: string;
  placement: string;
  colorMode: string;
  budget: string;
  idea: string;
  referenceUrl: string;
  isFirstTattoo: boolean;
  consent: boolean;
  website: string; // Honeypot — bleibt für Menschen unsichtbar und leer.
}

const EMPTY_FORM: FormState = {
  name: "", email: "", phone: "",
  style: "", size: "", placement: "", colorMode: "", budget: "",
  idea: "", referenceUrl: "",
  isFirstTattoo: false, consent: false, website: "",
};

export function BookingWidget() {
  const [slots, setSlots] = useState<PublicSlot[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<PublicSlot | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const today = todayKey();
  const [cursor, setCursor] = useState(() => {
    const { y, m } = parseDate(today);
    return { year: y, month: m };
  });
  const formRef = useRef<HTMLDivElement>(null);

  // ── Freie Termine laden ───────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/slots", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { slots: PublicSlot[] };
      setSlots(data.slots ?? []);
      setLoadError(false);
    } catch {
      setSlots([]);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    // Erstes Laden. Das `await` steht bewusst hier statt in einem
    // synchronen `void load()`: so ist sichtbar, dass jeder setState
    // erst nach der Antwort passiert — nicht schon beim Rendern.
    void (async () => {
      await load();
    })();
  }, [load]);

  // ── Termine nach Tag gruppieren ───────────────────────────────
  const byDate = useMemo(() => {
    const map = new Map<string, PublicSlot[]>();
    for (const slot of slots ?? []) {
      const list = map.get(slot.date);
      if (list) list.push(slot);
      else map.set(slot.date, [slot]);
    }
    return map;
  }, [slots]);

  // Springt beim ersten Laden auf den Monat des nächsten freien Termins —
  // sonst starrt man im Januar auf einen leeren Kalender, obwohl im
  // März Termine frei wären.
  const jumpedRef = useRef(false);
  useEffect(() => {
    if (jumpedRef.current || !slots?.length) return;
    jumpedRef.current = true;
    const { y, m } = parseDate(slots[0].date);
    setCursor({ year: y, month: m });
  }, [slots]);

  // ── Kalenderraster des angezeigten Monats ─────────────────────
  const grid = useMemo(() => {
    const { year, month } = cursor;
    const lead = mondayIndex(year, month, 1);
    const total = daysInMonth(year, month);
    const cells: (string | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= total; d += 1) cells.push(toDateKey(year, month, d));
    // Auf volle Wochen auffüllen, damit das Raster nicht ausfranst.
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const monthKey = `${cursor.year}-${String(cursor.month).padStart(2, "0")}`;
  const hasEarlier = useMemo(
    () => monthKey > today.slice(0, 7),
    [monthKey, today],
  );
  const hasLater = useMemo(
    () => (slots ?? []).some((s) => s.date.slice(0, 7) > monthKey),
    [slots, monthKey],
  );

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const next = c.month + delta;
      if (next < 1) return { year: c.year - 1, month: 12 };
      if (next > 12) return { year: c.year + 1, month: 1 };
      return { year: c.year, month: next };
    });
  }

  function pickDate(date: string) {
    setSelectedDate(date);
    const times = byDate.get(date) ?? [];
    // Gibt es an dem Tag nur einen Termin, ist die Uhrzeitwahl reine
    // Klickarbeit — dann direkt weiter zum Formular.
    setSelectedSlot(times.length === 1 ? times[0] : null);
    setBanner(null);
  }

  function pickSlot(slot: PublicSlot) {
    setSelectedSlot(slot);
    setBanner(null);
    // Auf dem Handy liegt das Formular unterhalb der Faltkante — ohne
    // diesen Sprung wirkt der Klick, als sei nichts passiert.
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key as string] ? { ...e, [key]: "" } : e));
  }

  // ── Absenden ──────────────────────────────────────────────────
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedSlot || submitting) return;

    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, slotId: selectedSlot.id }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        errors?: Record<string, string>;
        error?: string;
        reason?: string;
      };

      if (res.ok && data.ok) {
        setSubmitted(true);
        return;
      }
      if (data.errors) {
        setErrors(data.errors);
        setBanner("Bitte prüf die markierten Felder.");
        return;
      }
      // Termin ist inzwischen weg → Liste neu laden, damit der Kunde
      // nicht auf einen Geist klickt.
      if (res.status === 409) {
        setSelectedSlot(null);
        await load();
      }
      setBanner(data.error ?? "Das hat nicht geklappt. Bitte versuch es erneut.");
    } catch {
      setBanner("Keine Verbindung zum Studio. Bitte versuch es gleich noch einmal.");
    } finally {
      setSubmitting(false);
    }
  }

  const dayTimes = selectedDate ? byDate.get(selectedDate) ?? [] : [];

  // ── Bestätigung ───────────────────────────────────────────────
  if (submitted && selectedSlot) {
    return (
      <section id="termin" className="scroll-mt-24 hair-top">
        <div className="shell py-24 md:py-32">
          <motion.div
            className="card mx-auto max-w-xl p-8 text-center md:p-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <span className="marker text-3xl" style={{ color: "var(--signal)" }}>Danke!</span>
            <h2 className="display display-m mt-4">Anfrage ist raus</h2>
            <p className="mt-5 text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
              Dein Wunschtermin am{" "}
              <strong style={{ color: "var(--bone)" }}>
                {formatDateLong(selectedSlot.date)} um {selectedSlot.startTime} Uhr
              </strong>{" "}
              ist reserviert. {STUDIO.artist} meldet sich in der Regel innerhalb von
              zwei Werktagen — danach ist der Termin fest.
            </p>
            <p className="mt-4 text-xs" style={{ color: "var(--bone-dim)" }}>
              Eine Bestätigungsmail ist unterwegs. Nichts angekommen? Schau kurz im
              Spam-Ordner oder ruf an: {STUDIO.phone}
            </p>
          </motion.div>
        </div>
      </section>
    );
  }

  return (
    <section id="termin" className="scroll-mt-24 hair-top">
      <div className="shell py-24 md:py-32">
        <Reveal className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow mb-4">Termin</p>
            <h2 className="display display-l">Freie Termine</h2>
          </div>
          <p className="max-w-[38ch] text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
            Hier stehen ausschließlich Termine, die {STUDIO.artist} freigegeben hat.
            Wähl einen aus, erzähl kurz von deiner Idee — den Rest klären wir persönlich.
          </p>
        </Reveal>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr] lg:gap-12">
          {/* ── Schritt 1 + 2: Kalender ── */}
          <div>
            <div className="card p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  disabled={!hasEarlier}
                  aria-label="Vorheriger Monat"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-lg disabled:opacity-25"
                  style={{ border: "1px solid var(--ink-hair)" }}
                >
                  ‹
                </button>
                <div className="text-center">
                  <span className="display text-xl">{MONTH_NAMES[cursor.month - 1]}</span>
                  <span className="ml-2 text-sm" style={{ color: "var(--bone-dim)" }}>{cursor.year}</span>
                </div>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  disabled={!hasLater}
                  aria-label="Nächster Monat"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-lg disabled:opacity-25"
                  style={{ border: "1px solid var(--ink-hair)" }}
                >
                  ›
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {WEEKDAY_SHORT.map((d) => (
                  <span key={d} className="pb-1 text-center text-[0.65rem] uppercase tracking-[0.1em]" style={{ color: "var(--bone-dim)" }}>
                    {d}
                  </span>
                ))}
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={monthKey}
                  className="grid grid-cols-7 gap-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  {grid.map((date, i) => {
                    if (!date) return <span key={`pad-${i}`} className="aspect-square" />;
                    const count = byDate.get(date)?.length ?? 0;
                    const free = count > 0;
                    const isSelected = date === selectedDate;
                    const { d } = parseDate(date);
                    return (
                      <button
                        key={date}
                        type="button"
                        disabled={!free}
                        onClick={() => pickDate(date)}
                        aria-label={
                          free
                            ? `${formatDateLong(date)} — ${count} ${count === 1 ? "freier Termin" : "freie Termine"}`
                            : `${formatDateLong(date)} — kein freier Termin`
                        }
                        aria-pressed={isSelected}
                        className="relative flex aspect-square min-h-[44px] items-center justify-center rounded text-sm transition-colors duration-200"
                        style={{
                          background: isSelected ? "var(--signal)" : free ? "rgba(255,210,0,0.07)" : "transparent",
                          color: isSelected ? "#131200" : free ? "var(--bone)" : "var(--bone-dim)",
                          border: `1px solid ${isSelected ? "var(--signal)" : free ? "rgba(255,210,0,0.24)" : "transparent"}`,
                          cursor: free ? "pointer" : "default",
                          opacity: free || date >= today ? 1 : 0.3,
                          fontWeight: free ? 600 : 400,
                        }}
                      >
                        {d}
                        {free && !isSelected && (
                          <span
                            aria-hidden
                            className="absolute bottom-1.5 h-1 w-1 rounded-full"
                            style={{ background: "var(--signal)" }}
                          />
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              </AnimatePresence>

              {/* Zustandshinweise unter dem Raster */}
              {slots === null && (
                <p className="mt-4 text-center text-sm" style={{ color: "var(--bone-dim)" }}>
                  Termine werden geladen …
                </p>
              )}
              {loadError && (
                <p className="mt-4 text-center text-sm" style={{ color: "var(--danger)" }}>
                  Der Kalender lässt sich gerade nicht laden. Ruf gern an: {STUDIO.phone}
                </p>
              )}
              {slots?.length === 0 && !loadError && (
                <p className="mt-4 text-center text-sm" style={{ color: "var(--bone-dim)" }}>
                  Aktuell sind alle Termine vergeben. Ruf an, dann kommst du auf die Warteliste:{" "}
                  <a href={STUDIO.phoneHref} className="underline underline-offset-4">{STUDIO.phone}</a>
                </p>
              )}
            </div>

            {/* ── Uhrzeiten des gewählten Tages ── */}
            <AnimatePresence initial={false}>
              {selectedDate && dayTimes.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  style={{ overflow: "hidden" }}
                >
                  <div className="pt-4">
                    <p className="eyebrow mb-3">{formatDateLong(selectedDate)}</p>
                    <div className="flex flex-wrap gap-2">
                      {dayTimes.map((slot) => {
                        const active = selectedSlot?.id === slot.id;
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => pickSlot(slot)}
                            aria-pressed={active}
                            className="min-h-[44px] rounded px-4 text-sm transition-colors duration-200"
                            style={{
                              background: active ? "var(--signal)" : "transparent",
                              color: active ? "#131200" : "var(--bone)",
                              border: `1px solid ${active ? "var(--signal)" : "var(--ink-hair-strong)"}`,
                              fontWeight: active ? 600 : 400,
                            }}
                          >
                            {slot.startTime} – {slot.endTime}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Schritt 3: Formular ── */}
          <div ref={formRef} className="scroll-mt-24">
            <AnimatePresence mode="wait" initial={false}>
              {!selectedSlot ? (
                <motion.div
                  key="placeholder"
                  className="card flex h-full min-h-[280px] flex-col items-center justify-center p-8 text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <span className="marker text-2xl" style={{ color: "var(--signal)" }}>
                    Schritt 1
                  </span>
                  <p className="mt-3 max-w-[30ch] text-sm" style={{ color: "var(--bone-soft)" }}>
                    Wähl links einen gelb markierten Tag — danach öffnet sich hier das
                    Formular für deine Idee.
                  </p>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  onSubmit={submit}
                  className="card p-5 sm:p-7"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  noValidate
                >
                  <div
                    className="mb-6 flex flex-wrap items-center justify-between gap-3 pb-5"
                    style={{ borderBottom: "1px solid var(--ink-hair)" }}
                  >
                    <div>
                      <p className="eyebrow mb-1">Dein Termin</p>
                      <p className="text-[1.02rem] font-medium">
                        {formatDateLong(selectedSlot.date)}
                      </p>
                      <p className="text-sm" style={{ color: "var(--signal)" }}>
                        {selectedSlot.startTime} – {selectedSlot.endTime} Uhr
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedSlot(null); setSelectedDate(null); }}
                      className="text-xs underline underline-offset-4"
                      style={{ color: "var(--bone-dim)" }}
                    >
                      Anderen Termin wählen
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Name" error={errors.name} className="sm:col-span-2">
                      <input
                        className={`field ${errors.name ? "field-error" : ""}`}
                        value={form.name}
                        onChange={(e) => update("name", e.target.value)}
                        autoComplete="name"
                        placeholder="Vor- und Nachname"
                      />
                    </Field>

                    <Field label="E-Mail" error={errors.email}>
                      <input
                        type="email"
                        inputMode="email"
                        className={`field ${errors.email ? "field-error" : ""}`}
                        value={form.email}
                        onChange={(e) => update("email", e.target.value)}
                        autoComplete="email"
                        placeholder="du@beispiel.de"
                      />
                    </Field>

                    <Field label="Telefon" error={errors.phone}>
                      <input
                        type="tel"
                        inputMode="tel"
                        className={`field ${errors.phone ? "field-error" : ""}`}
                        value={form.phone}
                        onChange={(e) => update("phone", e.target.value)}
                        autoComplete="tel"
                        placeholder="0171 1234567"
                      />
                    </Field>

                    <Select
                      label="Stil" error={errors.style} options={STYLE_OPTIONS}
                      value={form.style} onChange={(v) => update("style", v)}
                      placeholder="Welche Richtung?"
                    />
                    <Select
                      label="Größe" error={errors.size} options={SIZE_OPTIONS}
                      value={form.size} onChange={(v) => update("size", v)}
                      placeholder="Wie groß ungefähr?"
                    />
                    <Select
                      label="Körperstelle" error={errors.placement} options={PLACEMENT_OPTIONS}
                      value={form.placement} onChange={(v) => update("placement", v)}
                      placeholder="Wohin soll es?"
                    />
                    <Select
                      label="Farbe" error={errors.colorMode} options={COLOR_OPTIONS}
                      value={form.colorMode} onChange={(v) => update("colorMode", v)}
                      placeholder="Schwarz-Grau oder bunt?"
                    />
                    <Select
                      label="Budgetrahmen" error={errors.budget} options={BUDGET_OPTIONS}
                      value={form.budget} onChange={(v) => update("budget", v)}
                      placeholder="Woran orientieren wir uns?"
                      className="sm:col-span-2"
                    />

                    <Field
                      label="Deine Idee" error={errors.idea} className="sm:col-span-2"
                      hint="Motiv, Bedeutung, Details — je konkreter, desto besser der Entwurf."
                    >
                      <textarea
                        rows={4}
                        className={`field ${errors.idea ? "field-error" : ""}`}
                        style={{ resize: "vertical" }}
                        value={form.idea}
                        onChange={(e) => update("idea", e.target.value)}
                        placeholder="Zum Beispiel: Kolibri über einer Lotusblüte, feine Schattierungen, ungefähr handtellergroß …"
                      />
                    </Field>

                    <Field
                      label="Referenz-Link" error={errors.referenceUrl} className="sm:col-span-2"
                      hint="Optional — Pinterest-Board, Instagram-Post, Cloud-Ordner."
                    >
                      <input
                        type="url"
                        inputMode="url"
                        className={`field ${errors.referenceUrl ? "field-error" : ""}`}
                        value={form.referenceUrl}
                        onChange={(e) => update("referenceUrl", e.target.value)}
                        placeholder="https://…"
                      />
                    </Field>
                  </div>

                  {/* Honeypot: für Menschen unsichtbar, für Bots verlockend.
                      `aria-hidden` + tabIndex halten ihn aus Screenreader
                      und Tabreihenfolge heraus. */}
                  <div aria-hidden className="absolute h-0 w-0 overflow-hidden opacity-0">
                    <label>
                      Website
                      <input
                        tabIndex={-1}
                        autoComplete="off"
                        value={form.website}
                        onChange={(e) => update("website", e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="mt-6 space-y-3">
                    <Check
                      checked={form.isFirstTattoo}
                      onChange={(v) => update("isFirstTattoo", v)}
                      label="Das wird mein erstes Tattoo"
                    />
                    <Check
                      checked={form.consent}
                      onChange={(v) => update("consent", v)}
                      error={errors.consent}
                      label="Meine Angaben dürfen zur Bearbeitung dieser Anfrage gespeichert und verwendet werden."
                    />
                  </div>

                  <AnimatePresence>
                    {banner && (
                      <motion.p
                        className="mt-5 rounded p-3 text-sm"
                        style={{ background: "rgba(226,86,74,0.1)", color: "var(--danger)" }}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        role="alert"
                      >
                        {banner}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <button type="submit" disabled={submitting} className="btn btn-signal mt-6 w-full">
                    {submitting ? "Wird gesendet …" : "Termin anfragen"}
                  </button>
                  <p className="mt-3 text-center text-xs" style={{ color: "var(--bone-dim)" }}>
                    Unverbindlich — fest wird der Termin erst mit der Bestätigung.
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Formular-Bausteine ──────────────────────────────────────────
function Field({
  label, error, hint, className, children,
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="eyebrow mb-2 block">{label}</span>
      {children}
      {hint && !error && (
        <span className="mt-1.5 block text-xs" style={{ color: "var(--bone-dim)" }}>{hint}</span>
      )}
      {error && (
        <span className="mt-1.5 block text-xs" style={{ color: "var(--danger)" }} role="alert">{error}</span>
      )}
    </label>
  );
}

function Select({
  label, options, value, onChange, placeholder, error, className,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
  className?: string;
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <Field label={label} error={error} hint={selected?.hint} className={className}>
      <select
        className={`field ${error ? "field-error" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </Field>
  );
}

function Check({
  checked, onChange, label, error,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  error?: string;
}) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[var(--signal)]"
        />
        <span className="text-sm leading-snug" style={{ color: "var(--bone-soft)" }}>{label}</span>
      </label>
      {error && (
        <span className="mt-1 block pl-8 text-xs" style={{ color: "var(--danger)" }} role="alert">{error}</span>
      )}
    </div>
  );
}
