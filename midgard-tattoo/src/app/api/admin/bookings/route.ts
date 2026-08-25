// ─── /api/admin/bookings ──────────────────────────────────
//   GET    alle Anfragen, neueste zuerst, inkl. Termin-Daten
//   PATCH  Anfrage bestätigen / ablehnen / stornieren (+ Notiz)
//   DELETE Anfrage endgültig löschen (DSGVO-Auskunft: Löschwunsch)

import { NextRequest, NextResponse } from "next/server";
import { isStudioAdmin } from "@/lib/auth";
import { deleteBooking, readData, setBookingStatus } from "@/lib/store";
import { notifyDecision } from "@/lib/notify";
import { BOOKING_STATUSES, slotEndTime, type BookingStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function guard(): Promise<NextResponse | null> {
  if (await isStudioAdmin()) return null;
  return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;

  const { slots, bookings } = await readData();
  const enriched = bookings
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((b) => {
      const slot = slots.find((s) => s.id === b.slotId);
      return {
        ...b,
        slot: slot
          ? {
              id: slot.id,
              date: slot.date,
              startTime: slot.startTime,
              endTime: slotEndTime(slot),
              status: slot.status,
            }
          : null,
      };
    });

  return NextResponse.json({ bookings: enriched });
}

export async function PATCH(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as
    | { id?: string; status?: string; adminNote?: string; notify?: boolean }
    | null;
  if (!body?.id || !body.status) {
    return NextResponse.json({ error: "Anfrage oder Status fehlt." }, { status: 400 });
  }
  if (!BOOKING_STATUSES.includes(body.status as BookingStatus)) {
    return NextResponse.json({ error: "Unbekannter Status." }, { status: 400 });
  }

  const booking = await setBookingStatus(
    body.id,
    body.status as BookingStatus,
    typeof body.adminNote === "string" ? body.adminNote.slice(0, 1000) : undefined,
  );
  if (!booking) return NextResponse.json({ error: "Anfrage nicht gefunden." }, { status: 404 });

  // Kunde benachrichtigen — nur bei einer echten Entscheidung und nur,
  // wenn der Inhaber es nicht ausdrücklich abwählt.
  if (body.notify !== false && (booking.status === "confirmed" || booking.status === "declined")) {
    const { slots } = await readData();
    const slot = slots.find((s) => s.id === booking.slotId);
    if (slot) await notifyDecision(booking, slot, booking.status);
  }

  return NextResponse.json({ booking });
}

export async function DELETE(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Anfrage fehlt." }, { status: 400 });
  const ok = await deleteBooking(id);
  if (!ok) return NextResponse.json({ error: "Anfrage nicht gefunden." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
