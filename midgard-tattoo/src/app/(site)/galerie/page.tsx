import type { Metadata } from "next";
import { BookingWidget } from "@/components/BookingWidget";
import { Gallery } from "@/components/Gallery";
import { PageHead } from "@/components/PageHead";
import { getGalleryImages } from "@/lib/gallery";
import { STUDIO } from "@/lib/studio";

export const metadata: Metadata = {
  title: "Galerie",
  description: `Black-and-Grey-Tattoos, Realistic, Fineline und Illustratives von ${STUDIO.artist} — Motive aus dem Studio in ${STUDIO.city}.`,
  alternates: { canonical: "/galerie" },
};

// Die Bilder pflegt der Inhaber im Dashboard — die Seite darf deshalb
// nicht auf einem Stand von der letzten Veröffentlichung festhängen.
export const dynamic = "force-dynamic";

export default async function GaleriePage() {
  const images = await getGalleryImages();

  return (
    <>
      <PageHead
        eyebrow="Galerie"
        title="Motive aus dem Studio"
        lead="Frisch gestochen, direkt nach der Sitzung fotografiert — deshalb die gerötete Haut. So sieht ein Tattoo am ersten Tag wirklich aus."
      />
      <Gallery images={images} />

      {/* Buchung direkt unter der Galerie: Wer sich gerade durch die
          Motive geklickt hat, ist genau jetzt in Stimmung für einen
          Termin — ein Link auf eine andere Seite wäre eine Hürde zu
          viel. Dieselbe Komponente steht auch auf /termin; Zustand und
          Absenden laufen dort wie hier über dieselbe Logik. */}
      <BookingWidget />
    </>
  );
}
