// ─── Startseite ──────────────────────────────────────────────────
// Server-Komponente: sie zählt die freien Termine schon beim Rendern,
// damit im Hero sofort „3 freie Termine" steht, statt erst nach dem
// ersten Client-Fetch nachzuflackern. Alles Interaktive darunter sind
// Client-Komponenten.

import { Hero } from "@/components/Hero";
import { Gallery } from "@/components/Gallery";
import { StudioSection } from "@/components/StudioSection";
import { BookingWidget } from "@/components/BookingWidget";
import { SiteHeader } from "@/components/SiteHeader";
import { FaqSection, Process, SiteFooter, Specialties } from "@/components/Sections";
import { readData } from "@/lib/store";
import { todayKey } from "@/lib/types";

// Die Termine ändern sich, sobald der Inhaber im Dashboard klickt —
// eine statisch vorgerenderte Seite würde veraltete Zahlen zeigen.
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
      <SiteHeader />
      <main>
        <Hero openSlots={openSlots} />
        <Gallery />
        <Specialties />
        <Process />
        <BookingWidget />
        <StudioSection />
        <FaqSection />
      </main>
      <SiteFooter />
    </>
  );
}
