// ─── Persistenz für Slots + Buchungen ────────────────────────────
// Der komplette Datenbestand eines Studios ist ein einziges kleines
// JSON-Dokument (ein Artist, ein paar hundert Termine im Jahr). Genau
// dafür ist dieser Store gebaut — bewusst ohne externe Datenbank, damit
// die Seite ohne Fremd-Account startklar ist.
//
// Zwei Adapter, automatisch gewählt:
//   • blob → Vercel Blob (Produktion auf Vercel; erkannt an
//     BLOB_READ_WRITE_TOKEN)
//   • file → .data/tattoo-booking.json (lokale Entwicklung und jeder
//     Host mit beschreibbarer Platte)
//
// ⚠️ Datenschutz-Hinweis zum Blob-Adapter: Vercel Blob kennt nur
// öffentliche Objekte. Der Dateiname wird deshalb aus einem Server-
// Secret abgeleitet (HMAC) und ist ohne dieses Secret nicht zu erraten —
// aber "nicht erratbar" ist keine Zugriffskontrolle. Wer echte ACLs und
// Backups will, stellt auf Postgres/Supabase um: das Schema liegt fertig
// in docs/schema.sql, zu ersetzen ist nur `readRaw`/`writeRaw`.

import { createHmac, randomUUID } from "node:crypto";
import {
  EMPTY_DATA,
  type Booking, type MediaItem, type Review, type Slot, type SlotKind, type TattooData,
} from "./types";

// ─── Adapter-Wahl ────────────────────────────────────────────────
// NICHT `useBlob` nennen: ESLint hielte das für einen React-Hook.
function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

const FILE_PATH = process.env.TATTOO_DATA_FILE || ".data/tattoo-booking.json";

/** Unerratbarer, aber stabiler Blob-Key aus einem Server-Secret. */
function blobKey(): string {
  const secret =
    process.env.TATTOO_DATA_SECRET ||
    process.env.SESSION_SECRET ||
    "tattoo-booking-fallback-secret";
  const digest = createHmac("sha256", secret).update("tattoo-booking-store").digest("hex");
  return `tattoo/booking-${digest.slice(0, 32)}.json`;
}

// ─── Lesen ───────────────────────────────────────────────────────
async function readRaw(): Promise<TattooData> {
  if (blobConfigured()) {
    const { list } = await import("@vercel/blob");
    const key = blobKey();
    const { blobs } = await list({ prefix: key, limit: 1 });
    if (!blobs.length || !blobs[0].url) return { ...EMPTY_DATA };
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    if (!res.ok) return { ...EMPTY_DATA };
    return normalize(await res.json());
  }
  const fs = await import("node:fs/promises");
  try {
    return normalize(JSON.parse(await fs.readFile(FILE_PATH, "utf8")));
  } catch {
    // Noch nie geschrieben (ENOENT) oder kaputtes JSON → leerer Stand.
    return { ...EMPTY_DATA };
  }
}

// ─── Schreiben ───────────────────────────────────────────────────
async function writeRaw(data: TattooData): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  if (blobConfigured()) {
    const { put } = await import("@vercel/blob");
    await put(blobKey(), json, {
      access: "public",
      addRandomSuffix: false,
      // Fester Key → ohne dieses Flag wirft @vercel/blob v2 beim zweiten
      // Speichern "blob already exists".
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    });
    return;
  }
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
  // Erst temporär schreiben, dann umbenennen: ein Absturz mitten im
  // Schreiben darf die Termindatei nicht halbfertig zurücklassen.
  const tmp = `${FILE_PATH}.${process.pid}.tmp`;
  await fs.writeFile(tmp, json, "utf8");
  await fs.rename(tmp, FILE_PATH);
}

/** Fremd-JSON defensiv auf die erwartete Form bringen. */
function normalize(raw: unknown): TattooData {
  const data = (raw ?? {}) as Partial<TattooData>;
  return {
    slots: Array.isArray(data.slots) ? data.slots : [],
    bookings: Array.isArray(data.bookings) ? data.bookings : [],
    // media und reviews kamen später dazu — ältere Dateien haben sie nicht.
    media: Array.isArray(data.media) ? data.media : [],
    reviews: Array.isArray(data.reviews) ? data.reviews : [],
  };
}

// ─── Serialisierung ──────────────────────────────────────────────
// Lesen-Ändern-Schreiben auf einem einzelnen Dokument: zwei parallele
// Anfragen würden sich sonst gegenseitig überschreiben (verlorene
// Buchung). Die Kette hält alle Mutationen dieses Prozesses in einer
// Reihe. Über mehrere Serverless-Instanzen hinweg greift sie NICHT —
// für ein Ein-Personen-Studio ist das Risiko vernachlässigbar, für
// mehr Volumen ist Postgres mit Transaktionen die richtige Antwort.
let chain: Promise<unknown> = Promise.resolve();

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  // Fehler dürfen die Kette nicht vergiften, aber auch nicht unbemerkt
  // als "unhandled rejection" auflaufen.
  chain = next.catch(() => {});
  return next;
}

/** Atomare Mutation: liest, lässt `mutate` verändern, schreibt zurück. */
export function mutate<T>(fn: (data: TattooData) => T | Promise<T>): Promise<T> {
  return serialize(async () => {
    const data = await readRaw();
    const result = await fn(data);
    await writeRaw(data);
    return result;
  });
}

export function readData(): Promise<TattooData> {
  return readRaw();
}

// ─── Slots ───────────────────────────────────────────────────────
export interface SlotInput {
  date: string;
  startTime: string;
  durationMinutes: number;
  note?: string;
  status?: Slot["status"];
  /** Beratung (Standard) oder Sitzung. */
  kind?: SlotKind;
}

export async function createSlots(inputs: SlotInput[]): Promise<Slot[]> {
  return mutate((data) => {
    const now = new Date().toISOString();
    const created: Slot[] = [];
    for (const input of inputs) {
      // Doppelte Termine (gleicher Tag + gleiche Uhrzeit) still überspringen —
      // der Inhaber klickt im Kalender schnell, ein Doppelklick darf keinen
      // zweiten identischen Slot anlegen.
      const clash = data.slots.some(
        (s) => s.date === input.date && s.startTime === input.startTime,
      );
      if (clash) continue;
      const slot: Slot = {
        id: randomUUID(),
        date: input.date,
        startTime: input.startTime,
        durationMinutes: input.durationMinutes,
        status: input.status ?? "open",
        // Ohne Angabe ist es ein Beratungstermin — das ist der Regelfall.
        kind: input.kind ?? "consultation",
        note: input.note?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };
      data.slots.push(slot);
      created.push(slot);
    }
    return created;
  });
}

export async function updateSlot(
  id: string,
  patch: Partial<Pick<Slot, "status" | "note" | "startTime" | "durationMinutes" | "date" | "kind">>,
): Promise<Slot | null> {
  return mutate((data) => {
    const slot = data.slots.find((s) => s.id === id);
    if (!slot) return null;
    Object.assign(slot, patch, { updatedAt: new Date().toISOString() });
    return slot;
  });
}

/** Löscht einen Slot samt zugehöriger Anfragen. */
export async function deleteSlot(id: string): Promise<boolean> {
  return mutate((data) => {
    const before = data.slots.length;
    data.slots = data.slots.filter((s) => s.id !== id);
    data.bookings = data.bookings.filter((b) => b.slotId !== id);
    return data.slots.length < before;
  });
}

// ─── Buchungen ───────────────────────────────────────────────────
export type BookingInput = Omit<
  Booking,
  "id" | "status" | "createdAt" | "updatedAt" | "consentAt" | "adminNote"
>;

export type BookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "slot-not-found" | "slot-taken" };

/** Legt eine Anfrage an und reserviert den Slot in EINER Mutation —
 *  zwei gleichzeitige Anfragen auf denselben Termin können sich so
 *  nicht überholen. */
export async function createBooking(input: BookingInput): Promise<BookingResult> {
  return mutate<BookingResult>((data) => {
    const slot = data.slots.find((s) => s.id === input.slotId);
    if (!slot) return { ok: false, reason: "slot-not-found" };
    if (slot.status !== "open") return { ok: false, reason: "slot-taken" };

    const now = new Date().toISOString();
    const booking: Booking = {
      ...input,
      id: randomUUID(),
      status: "pending",
      consentAt: now,
      createdAt: now,
      updatedAt: now,
    };
    data.bookings.push(booking);
    slot.status = "requested";
    slot.updatedAt = now;
    return { ok: true, booking };
  });
}

/** Statuswechsel durch den Inhaber — hält den Slot-Status konsistent:
 *  bestätigen belegt den Termin, ablehnen/stornieren gibt ihn frei. */
export async function setBookingStatus(
  id: string,
  status: Booking["status"],
  adminNote?: string,
): Promise<Booking | null> {
  return mutate((data) => {
    const booking = data.bookings.find((b) => b.id === id);
    if (!booking) return null;
    const now = new Date().toISOString();
    booking.status = status;
    if (adminNote !== undefined) booking.adminNote = adminNote.trim() || undefined;
    booking.updatedAt = now;

    const slot = data.slots.find((s) => s.id === booking.slotId);
    if (slot) {
      if (status === "confirmed") slot.status = "booked";
      // Freigeben nur, wenn keine ANDERE aktive Anfrage auf dem Termin liegt.
      if (status === "declined" || status === "cancelled") {
        const otherActive = data.bookings.some(
          (b) => b.slotId === slot.id && b.id !== booking.id &&
            (b.status === "pending" || b.status === "confirmed"),
        );
        if (!otherActive) slot.status = "open";
      }
      slot.updatedAt = now;
    }
    return booking;
  });
}

export async function deleteBooking(id: string): Promise<boolean> {
  return mutate((data) => {
    const booking = data.bookings.find((b) => b.id === id);
    if (!booking) return false;
    data.bookings = data.bookings.filter((b) => b.id !== id);
    const slot = data.slots.find((s) => s.id === booking.slotId);
    if (slot && slot.status === "requested") {
      const otherActive = data.bookings.some(
        (b) => b.slotId === slot.id && (b.status === "pending" || b.status === "confirmed"),
      );
      if (!otherActive) {
        slot.status = "open";
        slot.updatedAt = new Date().toISOString();
      }
    }
    return true;
  });
}

// ─── Bilder ──────────────────────────────────────────────────────
export type MediaInput = Omit<MediaItem, "id" | "createdAt" | "sortIndex">;

export async function addMedia(input: MediaInput): Promise<MediaItem> {
  return mutate((data) => {
    const item: MediaItem = {
      ...input,
      id: randomUUID(),
      // Neue Bilder ans Ende — der Inhaber sortiert danach selbst.
      sortIndex: data.media.reduce((max, m) => Math.max(max, m.sortIndex), -1) + 1,
      createdAt: new Date().toISOString(),
    };
    data.media.push(item);
    return item;
  });
}

export async function updateMedia(
  id: string,
  patch: Partial<Pick<MediaItem, "title" | "style" | "placement" | "alt" | "inGallery" | "inHero" | "sortIndex">>,
): Promise<MediaItem | null> {
  return mutate((data) => {
    const item = data.media.find((m) => m.id === id);
    if (!item) return null;
    Object.assign(item, patch);
    return item;
  });
}

/** Verschiebt ein Bild um eine Position. Arbeitet auf der sortierten
 *  Liste und schreibt danach lückenlose Indizes zurück — sonst driften
 *  die Zahlen nach ein paar Verschiebungen auseinander. */
export async function moveMedia(id: string, direction: -1 | 1): Promise<boolean> {
  return mutate((data) => {
    const sorted = data.media.slice().sort((a, b) => a.sortIndex - b.sortIndex);
    const index = sorted.findIndex((m) => m.id === id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= sorted.length) return false;
    [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
    sorted.forEach((m, i) => { m.sortIndex = i; });
    return true;
  });
}

/** Entfernt den Eintrag und meldet zurück, welche Datei dazu gehörte —
 *  der Aufrufer räumt den Speicher auf. */
export async function deleteMedia(id: string): Promise<string | null> {
  return mutate((data) => {
    const item = data.media.find((m) => m.id === id);
    if (!item) return null;
    data.media = data.media.filter((m) => m.id !== id);
    return item.url;
  });
}

// ─── Bewertungen ─────────────────────────────────────────────────
export type ReviewInput = Omit<Review, "id" | "createdAt">;

export async function addReview(input: ReviewInput): Promise<Review> {
  return mutate((data) => {
    const review: Review = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    data.reviews.push(review);
    return review;
  });
}

export async function updateReview(
  id: string,
  patch: Partial<Omit<Review, "id" | "createdAt">>,
): Promise<Review | null> {
  return mutate((data) => {
    const review = data.reviews.find((r) => r.id === id);
    if (!review) return null;
    Object.assign(review, patch);
    return review;
  });
}

export async function deleteReview(id: string): Promise<boolean> {
  return mutate((data) => {
    const before = data.reviews.length;
    data.reviews = data.reviews.filter((r) => r.id !== id);
    return data.reviews.length < before;
  });
}
