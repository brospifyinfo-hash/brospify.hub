// ─── Startseite ──────────────────────────────────────────────────
// Hero über den ganzen Bildschirm, direkt darunter die Buchung — wer
// einen Termin will, ist nach einem Scroll da. Danach kurze Anreißer
// auf die eigenen Seiten.

import { Hero } from "@/components/Hero";
import { BookingWidget } from "@/components/BookingWidget";
import { GalleryTeaser, StudioTeaser } from "@/components/Teasers";
import { readData } from "@/lib/store";
import { todayKey } from "@/lib/types";

export const dynamic = "force-dynamic";

async function countOpenSlots(): Promise<number> {
  try {
    const { slots } = await readData();
    const today = todayKey();
    return slots.filter((s) => s.status === "open" && s.date >= today).length;
  } catch {
    // Der Zähler ist Beiwerk — er darf die Seite niemals verhindern.
    return 0;
  }
}

export default async function HomePage() {
  const openSlots = await countOpenSlots();
  return (
    <>
      <Hero openSlots={openSlots} />
      <BookingWidget />
      <GalleryTeaser />
      <StudioTeaser />
    </>
  );
}
