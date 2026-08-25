// ─── GET /api/slots ───────────────────────────────────────
// Öffentliche Termin-Liste für den Kundenkalender. Liefert bewusst NUR
// freie Termine ab heute und NUR die Felder, die der Kalender braucht —
// keine internen Notizen, keine belegten oder gesperrten Termine, aus
// denen sich Rückschlüsse auf andere Kunden ziehen ließen.

import { NextResponse } from "next/server";
import { readData } from "@/lib/store";
import { slotEndTime, slotSortKey, todayKey } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface PublicSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export async function GET() {
  try {
    const { slots } = await readData();
    const today = todayKey();
    const open: PublicSlot[] = slots
      .filter((s) => s.status === "open" && s.date >= today)
      .sort((a, b) => slotSortKey(a).localeCompare(slotSortKey(b)))
      .map((s) => ({
        id: s.id,
        date: s.date,
        startTime: s.startTime,
        endTime: slotEndTime(s),
        durationMinutes: s.durationMinutes,
      }));
    return NextResponse.json({ slots: open });
  } catch (error) {
    console.error("[slots] GET failed", error);
    return NextResponse.json({ slots: [], error: "unavailable" }, { status: 500 });
  }
}
