// ─── Startseite ──────────────────────────────────────────────────
// Hero über den ganzen Bildschirm, darunter eine nummerierte Folge von
// Kapiteln — eines je Seite der Navigation. Die Startseite ist damit
// ein Inhaltsverzeichnis mit Bildern: sie wiederholt die Unterseiten
// nicht, sondern zeigt von jeder so viel, dass man weiterklicken will.
//
// Die eine Ausnahme ist Kapitel 02: dort steht die Terminbuchung nicht
// als Vorschau, sondern vollständig. Direkt unter der Galerie — wer
// sich gerade durch die Motive gesehen hat, ist genau jetzt so weit,
// und ein Klick auf eine andere Seite wäre die Hürde, an der es
// scheitert.

import type { Metadata } from "next";
import { Artists } from "@/components/Artists";
import { BookingWidget } from "@/components/BookingWidget";
import { Hero } from "@/components/Hero";
import { Marquee } from "@/components/Marquee";
import { GalleryTeaser, PriceTeaser, ReviewTeaser, StudioTeaser } from "@/components/Teasers";
import { TrustBadges } from "@/components/Trust";
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

  return (
    <>
      <Hero images={heroImages} openSlots={openSlots} />
      <Marquee />

      <GalleryTeaser images={gallery} index={1} />
      <BookingWidget index={2} />
      <Artists index={3} />
      <TrustBadges />
      <PriceTeaser index={4} />
      <ReviewTeaser reviews={reviews} index={5} />
      <StudioTeaser index={6} />
    </>
  );
}
