// Formen, die die Admin-Endpunkte zurückgeben — angereichert um die
// Felder, die der Server bereits ausrechnet (Endzeit, verknüpfte
// Anfrage), damit der Client nichts nachrechnen muss.
import type { Booking, Slot, SlotKind } from "@/lib/types";

export interface AdminSlot extends Slot {
  /** Vom Server aufgelöst — nie undefined, anders als auf dem Rohdatensatz. */
  kind: SlotKind;
  endTime: string;
  booking: Booking | null;
}

export interface AdminBooking extends Booking {
  slot: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: Slot["status"];
    kind?: SlotKind;
  } | null;
}
