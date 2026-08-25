// ─── Domänen-Modell für Portfolio + Terminbuchung ────────────────
// Diese Datei ist die Single Source of Truth für die Buchungs-Domäne:
// Server (Store, API-Routen) und Client (Kalender, Formular, Admin)
// importieren AUSSCHLIESSLICH von hier. Die Typen bilden 1:1 das
// SQL-Schema in docs/schema.sql ab — wer den Store später auf
// Supabase/Postgres umstellt, tauscht nur den Adapter, nicht die Typen.

// ─── Termin-Slots ────────────────────────────────────────────────
// Ein Slot ist ein vom Inhaber FREIGEGEBENER Zeitraum. Kunden sehen
// ausschließlich Slots mit Status "open" — es gibt bewusst keinen Weg,
// einen beliebigen Wunschtermin zu buchen.
//
//   open      → im Kundenkalender sichtbar und buchbar
//   requested → Kunde hat angefragt, Inhaber hat noch nicht bestätigt
//   booked    → vom Inhaber bestätigt, fest vergeben
//   blocked   → vom Inhaber gesperrt (Urlaub, Konvent, privat)
export type SlotStatus = "open" | "requested" | "booked" | "blocked";

// ─── Art des Termins ─────────────────────────────────────────────
// Der erste Termin ist grundsätzlich ein BERATUNGSTERMIN: Motiv, Größe,
// Stelle und Preis werden besprochen, gestochen wird noch nicht. Erst
// danach entsteht der eigentliche Sitzungstermin. Deshalb ist
// "consultation" überall der Standard — auch wenn ein Slot ohne Angabe
// aus einem älteren Datenbestand kommt.
export type SlotKind = "consultation" | "session";

export const SLOT_KINDS: SlotKind[] = ["consultation", "session"];

export const SLOT_KIND_LABEL: Record<SlotKind, string> = {
  consultation: "Beratung",
  session: "Sitzung",
};

/** Wie der Termin auf der Kundenseite heißt. */
export const SLOT_KIND_PUBLIC: Record<SlotKind, string> = {
  consultation: "Beratungstermin",
  session: "Tattoo-Sitzung",
};

export const SLOT_STATUSES: SlotStatus[] = ["open", "requested", "booked", "blocked"];

export interface Slot {
  id: string;
  /** Kalendertag in lokaler Studiozeit, ISO "YYYY-MM-DD". Bewusst als
   *  reines Datum gespeichert (nicht als UTC-Zeitstempel): der Kalender
   *  eines Studios denkt in Tagen der eigenen Zeitzone, und so kann
   *  keine Sommerzeit-Umstellung einen Termin auf den Vortag schieben. */
  date: string;
  /** Startzeit "HH:MM" (24 h, lokale Studiozeit). */
  startTime: string;
  /** Dauer in Minuten — bestimmt die im Kalender angezeigte Endzeit. */
  durationMinutes: number;
  status: SlotStatus;
  /** Beratung oder Sitzung. Fehlt der Wert (Datenbestand von vor der
   *  Einführung), gilt "consultation" — siehe `slotKind()`. */
  kind?: SlotKind;
  /** Interne Notiz des Inhabers, für Kunden NIE sichtbar. */
  note?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Buchungsanfragen ────────────────────────────────────────────
//   pending   → eingegangen, wartet auf Antwort des Inhabers
//   confirmed → bestätigt, Termin steht
//   declined  → abgelehnt (Slot wird wieder freigegeben)
//   cancelled → vom Kunden/Inhaber nachträglich abgesagt
export type BookingStatus = "pending" | "confirmed" | "declined" | "cancelled";

export const BOOKING_STATUSES: BookingStatus[] = ["pending", "confirmed", "declined", "cancelled"];

export interface Booking {
  id: string;
  slotId: string;
  status: BookingStatus;
  // ── Kontakt
  name: string;
  email: string;
  phone: string;
  // ── Tattoo-Wunsch (Dropdown-Werte, siehe Kataloge unten)
  style: string;
  size: string;
  placement: string;
  colorMode: string;
  budget: string;
  isFirstTattoo: boolean;
  /** Freitext-Beschreibung des Motivs. */
  idea: string;
  /** Optionale Links auf Referenzbilder (Pinterest, Instagram …). */
  referenceUrl?: string;
  /** Zeitpunkt der Datenschutz-Zustimmung (DSGVO-Nachweis). */
  consentAt: string;
  /** Interne Notiz des Inhabers. */
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

/** Kompletter Datenbestand — genau das liegt als JSON im Store. */
export interface TattooData {
  slots: Slot[];
  bookings: Booking[];
}

export const EMPTY_DATA: TattooData = { slots: [], bookings: [] };

// ─── Auswahl-Kataloge für das Anfrage-Formular ───────────────────
// `value` landet in der Datenbank, `label` steht im Dropdown, `hint`
// erklärt die Option (Kunden wissen selten, was "Fineline" heißt).
export interface Option {
  value: string;
  label: string;
  hint?: string;
}

export const STYLE_OPTIONS: Option[] = [
  { value: "black-and-grey", label: "Black & Grey", hint: "Schwarz-Grau mit weichen Verläufen" },
  { value: "realistic", label: "Realistic", hint: "Fotorealistisch, z. B. Tiere & Portraits" },
  { value: "fineline", label: "Fineline", hint: "Feine, dünne Linien" },
  { value: "sketch", label: "Sketch / Illustrativ", hint: "Zeichnerisch, offene Linien" },
  { value: "floral", label: "Florales / Natur", hint: "Blüten, Blätter, Insekten" },
  { value: "lettering", label: "Lettering & Schriftzüge" },
  { value: "old-school", label: "Old School / Traditional" },
  { value: "cover-up", label: "Cover-Up", hint: "Bestehendes Tattoo überarbeiten" },
  { value: "unsure", label: "Noch nicht sicher", hint: "Klären wir im Beratungsgespräch" },
];

export const SIZE_OPTIONS: Option[] = [
  { value: "xs", label: "Sehr klein — bis 5 cm" },
  { value: "s", label: "Klein — 5 bis 10 cm" },
  { value: "m", label: "Mittel — 10 bis 20 cm" },
  { value: "l", label: "Groß — 20 bis 35 cm" },
  { value: "xl", label: "Sehr groß — ab 35 cm" },
  { value: "sleeve", label: "Sleeve / großflächig", hint: "Mehrere Sitzungen" },
  { value: "unsure", label: "Noch nicht sicher", hint: "Klären wir im Beratungsgespräch" },
];

export const PLACEMENT_OPTIONS: Option[] = [
  { value: "forearm", label: "Unterarm" },
  { value: "upper-arm", label: "Oberarm" },
  { value: "shoulder", label: "Schulter" },
  { value: "chest", label: "Brust" },
  { value: "back", label: "Rücken" },
  { value: "ribs", label: "Rippen / Seite" },
  { value: "thigh", label: "Oberschenkel" },
  { value: "calf", label: "Wade" },
  { value: "hand-foot", label: "Hand / Fuß" },
  { value: "neck-head", label: "Hals / Kopf" },
  { value: "other", label: "Andere Stelle" },
  { value: "unsure", label: "Noch nicht sicher", hint: "Klären wir im Beratungsgespräch" },
];

export const COLOR_OPTIONS: Option[] = [
  { value: "black-grey", label: "Schwarz & Grau" },
  { value: "color", label: "Farbig" },
  { value: "black-with-accents", label: "Schwarz mit Farbakzenten" },
  { value: "unsure", label: "Noch nicht sicher", hint: "Klären wir im Beratungsgespräch" },
];

export const BUDGET_OPTIONS: Option[] = [
  { value: "till-150", label: "bis 150 €" },
  { value: "150-300", label: "150 – 300 €" },
  { value: "300-600", label: "300 – 600 €" },
  { value: "600-1000", label: "600 – 1.000 €" },
  { value: "1000-plus", label: "über 1.000 €" },
  { value: "open", label: "Nach Absprache" },
  { value: "unsure", label: "Noch nicht sicher", hint: "Klären wir im Beratungsgespräch" },
];

// ─── Label-Auflösung (Admin-Ansicht, E-Mails) ────────────────────
function labelFrom(options: Option[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

/** Art eines Termins, mit Beratung als Rückfallwert. */
export function slotKind(slot: { kind?: SlotKind }): SlotKind {
  return slot.kind === "session" ? "session" : "consultation";
}

export const styleLabel = (v: string) => labelFrom(STYLE_OPTIONS, v);
export const sizeLabel = (v: string) => labelFrom(SIZE_OPTIONS, v);
export const placementLabel = (v: string) => labelFrom(PLACEMENT_OPTIONS, v);
export const colorLabel = (v: string) => labelFrom(COLOR_OPTIONS, v);
export const budgetLabel = (v: string) => labelFrom(BUDGET_OPTIONS, v);

// ─── Zeit-Helfer (zeitzonenfrei, rein auf "YYYY-MM-DD"/"HH:MM") ──
// Bewusst KEIN `new Date(...)` für Kalenderlogik: Date interpretiert
// je nach Format mal UTC, mal lokal — der Kalender würde in negativen
// Zeitzonen einen Tag verrutschen. Wir rechnen auf den Strings.

/** "2026-03-14" → 2026-03-14 als reine Zahlen. */
export function parseDate(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

export function toDateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Endzeit eines Slots als "HH:MM" (rollt über Mitternacht sauber um). */
export function slotEndTime(slot: Pick<Slot, "startTime" | "durationMinutes">): string {
  const [h, min] = slot.startTime.split(":").map(Number);
  const total = h * 60 + min + slot.durationMinutes;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
}

/** Sortierschlüssel Datum+Zeit, lexikografisch vergleichbar. */
export function slotSortKey(slot: Pick<Slot, "date" | "startTime">): string {
  return `${slot.date}T${slot.startTime}`;
}

export const STUDIO_TIME_ZONE = "Europe/Berlin";

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

export const MONTH_NAMES = MONTHS;
/** Kalender startet montags (DE-Konvention). */
export const WEEKDAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** "2026-03-14" → "Samstag, 14. März 2026" */
export function formatDateLong(date: string): string {
  const { y, m, d } = parseDate(date);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday}, ${d}. ${MONTHS[m - 1]} ${y}`;
}

/** ISO-Zeitstempel → "14. März 2026, 18:42" in der Zeitzone des Studios.
 *  Bewusst NICHT `createdAt.slice(0,10)`: das wäre das UTC-Datum, und eine
 *  Anfrage von 23:30 Uhr Ortszeit stünde im Dashboard mit dem Vortag. */
export function formatTimestamp(iso: string, timeZone = STUDIO_TIME_ZONE): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone, day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}. ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")}`;
}

/** Heutiges Datum als "YYYY-MM-DD" in der Zeitzone des Studios. */
export function todayKey(timeZone = STUDIO_TIME_ZONE): string {
  // `en-CA` liefert exakt das ISO-Format YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

/** Wochentagsindex montagsbasiert (Mo = 0 … So = 6). */
export function mondayIndex(y: number, m: number, d: number): number {
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
