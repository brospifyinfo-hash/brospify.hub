// ─── /api/admin/slots ─────────────────────────────────────
// Termin-Verwaltung des Inhabers.
//   GET    alle Slots eines Zeitraums, inkl. verknüpfter Anfragen
//   POST   einen oder viele Termine anlegen (Click-to-Add + Serie)
//   PATCH  Status/Notiz eines Termins ändern (z. B. sperren)
//   DELETE Termin löschen

import { NextRequest, NextResponse } from "next/server";
import { isStudioAdmin } from "@/lib/auth";
import { createSlots, deleteSlot, readData, updateSlot, type SlotInput } from "@/lib/store";
import {
  SLOT_KINDS, SLOT_STATUSES, slotEndTime, slotKind, slotSortKey,
  type SlotKind, type SlotStatus,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const MIN_MINUTES = 15;
const MAX_MINUTES = 720;

/** "14:00" → 840 */
function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Dauer aus dem ermitteln, was geschickt wurde: entweder direkt als
 *  Minutenzahl oder als Endzeit. Über Mitternacht wird bewusst NICHT
 *  gerechnet — ein Termin, der am Folgetag endet, ist im Studioalltag
 *  ein Tippfehler, kein gültiger Eintrag. */
function resolveDuration(raw: { durationMinutes?: unknown; endTime?: unknown }, startTime: string): number | null {
  if (typeof raw.endTime === "string" && TIME_RE.test(raw.endTime)) {
    const minutes = toMinutes(raw.endTime) - toMinutes(startTime);
    return minutes >= MIN_MINUTES && minutes <= MAX_MINUTES ? minutes : null;
  }
  const minutes = Math.round(Number(raw.durationMinutes));
  if (!Number.isFinite(minutes)) return null;
  return minutes >= MIN_MINUTES && minutes <= MAX_MINUTES ? minutes : null;
}

function parseKind(value: unknown): SlotKind | undefined {
  return SLOT_KINDS.includes(value as SlotKind) ? (value as SlotKind) : undefined;
}

async function guard(): Promise<NextResponse | null> {
  if (await isStudioAdmin()) return null;
  return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const { slots, bookings } = await readData();

  const filtered = slots
    .filter((s) => (!from || s.date >= from) && (!to || s.date <= to))
    .sort((a, b) => slotSortKey(a).localeCompare(slotSortKey(b)))
    .map((s) => ({
      ...s,
      kind: slotKind(s),
      endTime: slotEndTime(s),
      // Nur aktive Anfragen anhängen — abgelehnte Anfragen bleiben in der
      // Historie, sollen aber den Kalender nicht zumüllen.
      booking: bookings.find(
        (b) => b.slotId === s.id && (b.status === "pending" || b.status === "confirmed"),
      ) ?? null,
    }));

  return NextResponse.json({ slots: filtered });
}

export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as
    | {
        slots?: unknown[];
        dates?: unknown[];
        startTime?: string;
        endTime?: string;
        durationMinutes?: number;
        note?: string;
        kind?: string;
      }
    | null;
  if (!body) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });

  const inputs: SlotInput[] = [];

  // Variante A: fertige Slot-Objekte (Click-to-Add im Tagesraster).
  if (Array.isArray(body.slots)) {
    for (const raw of body.slots.slice(0, 200)) {
      const s = raw as Partial<SlotInput> & { endTime?: string };
      if (typeof s.date !== "string" || !DATE_RE.test(s.date)) continue;
      if (typeof s.startTime !== "string" || !TIME_RE.test(s.startTime)) continue;
      const duration = resolveDuration(s, s.startTime);
      if (duration === null) continue;
      inputs.push({
        date: s.date,
        startTime: s.startTime,
        durationMinutes: duration,
        kind: parseKind(s.kind),
        note: typeof s.note === "string" ? s.note.slice(0, 300) : undefined,
      });
    }
  }

  // Variante B: eine Uhrzeit auf mehrere Tage verteilen (Serientermin).
  if (Array.isArray(body.dates)) {
    const startTime = typeof body.startTime === "string" ? body.startTime : "";
    const duration = TIME_RE.test(startTime) ? resolveDuration(body, startTime) : null;
    if (duration !== null) {
      for (const raw of body.dates.slice(0, 200)) {
        if (typeof raw !== "string" || !DATE_RE.test(raw)) continue;
        inputs.push({
          date: raw,
          startTime,
          durationMinutes: duration,
          kind: parseKind(body.kind),
          note: typeof body.note === "string" ? body.note.slice(0, 300) : undefined,
        });
      }
    }
  }

  if (!inputs.length) {
    return NextResponse.json({ error: "Keine gültigen Termine übergeben." }, { status: 400 });
  }

  const created = await createSlots(inputs);
  return NextResponse.json({ created: created.length, skipped: inputs.length - created.length });
}

export async function PATCH(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as
    | {
        id?: string; status?: string; note?: string;
        startTime?: string; endTime?: string; durationMinutes?: number; kind?: string;
      }
    | null;
  if (!body?.id) return NextResponse.json({ error: "Termin fehlt." }, { status: 400 });

  const patch: Parameters<typeof updateSlot>[1] = {};
  if (body.status !== undefined) {
    if (!SLOT_STATUSES.includes(body.status as SlotStatus)) {
      return NextResponse.json({ error: "Unbekannter Status." }, { status: 400 });
    }
    // „requested"/„booked" gehören der Buchung — die setzt der Store,
    // sonst stünde ein Termin auf frei, obwohl eine Anfrage darauf liegt.
    if (body.status === "requested" || body.status === "booked") {
      return NextResponse.json(
        { error: "Dieser Status ergibt sich aus der Buchung." },
        { status: 400 },
      );
    }
    const { slots, bookings } = await readData();
    const slot = slots.find((s) => s.id === body.id);
    if (!slot) return NextResponse.json({ error: "Termin nicht gefunden." }, { status: 404 });
    const active = bookings.some(
      (b) => b.slotId === slot.id && (b.status === "pending" || b.status === "confirmed"),
    );
    if (active) {
      return NextResponse.json(
        { error: "Auf diesem Termin liegt eine Anfrage. Erst dort entscheiden." },
        { status: 409 },
      );
    }
    patch.status = body.status as SlotStatus;
  }
  if (typeof body.note === "string") patch.note = body.note.slice(0, 300);
  if (typeof body.startTime === "string" && TIME_RE.test(body.startTime)) {
    patch.startTime = body.startTime;
  }
  const kind = parseKind(body.kind);
  if (kind) patch.kind = kind;

  // Eine Endzeit ergibt nur zusammen mit der Startzeit einen Zeitraum.
  // Lieber eine klare Fehlermeldung als eine stillschweigend ignorierte
  // Änderung, die der Inhaber erst im Kalender bemerkt.
  if (body.endTime !== undefined && patch.startTime === undefined) {
    return NextResponse.json(
      { error: "Zu einer Endzeit gehört auch die Startzeit." },
      { status: 400 },
    );
  }
  if (body.endTime !== undefined || body.durationMinutes !== undefined) {
    const duration = resolveDuration(body, patch.startTime ?? "00:00");
    if (duration === null) {
      return NextResponse.json(
        { error: "Der Zeitraum muss zwischen 15 Minuten und 12 Stunden liegen." },
        { status: 400 },
      );
    }
    patch.durationMinutes = duration;
  }

  const slot = await updateSlot(body.id, patch);
  if (!slot) return NextResponse.json({ error: "Termin nicht gefunden." }, { status: 404 });
  return NextResponse.json({ slot });
}

export async function DELETE(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Termin fehlt." }, { status: 400 });
  const ok = await deleteSlot(id);
  if (!ok) return NextResponse.json({ error: "Termin nicht gefunden." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
