// ─── Startseite ──────────────────────────────────────────────────
// Kopfbereich mit direkter Buchung, darunter nur kurze Anreißer, die
// auf die eigenen Seiten führen. Der Rest der Inhalte lebt jetzt dort —
// wer bloß einen Termin will, muss an nichts vorbeiscrollen.

import { Hero } from "@/components/Hero";
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
      <GalleryTeaser />
      <StudioTeaser />
    </>
  );
}
