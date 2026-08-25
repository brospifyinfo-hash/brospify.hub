// ─── Startseite ──────────────────────────────────────────────────
// Hero über den ganzen Bildschirm, darunter je eine Vorschau auf jede
// Seite der Navigation. Die Startseite ist damit ein Inhaltsverzeichnis
// mit Bildern — sie wiederholt die Unterseiten nicht, sondern zeigt von
// jeder so viel, dass man weiterklicken will.

import type { Metadata } from "next";
import { Hero } from "@/components/Hero";
import {
  BookingTeaser, GalleryTeaser, PriceTeaser, ReviewTeaser, StudioTeaser,
} from "@/components/Teasers";
import { getGalleryImages, getHeroImages, getPublishedReviews } from "@/lib/gallery";
import { readData } from "@/lib/store";
import { todayKey } from "@/lib/types";

export const dynamic = "force-dynamic";

// Beim Teilen der Startseite soll das erste Hero-Bild als Vorschau
// erscheinen — sonst zeigt WhatsApp auch dann noch ein mitgeliefertes
// Motiv, wenn längst eigene Bilder hochgeladen sind. Der Rückfall im
// Root-Layout greift weiterhin, falls gar kein Bild gefunden wird.
export async function generateMetadata(): Promise<Metadata> {
  const [erstes] = await getHeroImages();
  if (!erstes) return {};
  return {
    openGraph: {
      images: [{ url: erstes.src, width: erstes.width, height: erstes.height, alt: erstes.alt }],
    },
  };
}

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
  const [openSlots, heroImages, gallery, reviews] = await Promise.all([
    countOpenSlots(),
    getHeroImages(),
    getGalleryImages(),
    getPublishedReviews(),
  ]);

  // Für die Studio-Vorschau das Schaufenster, sonst irgendein Bild.
  const studioImage =
    gallery.find((g) => g.id === "studio-altdorf") ?? gallery[gallery.length - 1] ?? null;

  return (
    <>
      <Hero images={heroImages} openSlots={openSlots} />
      <GalleryTeaser images={gallery} />
      <BookingTeaser openSlots={openSlots} />
      <PriceTeaser />
      <ReviewTeaser reviews={reviews} />
      <StudioTeaser image={studioImage} />
    </>
  );
}
