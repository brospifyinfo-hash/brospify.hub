// ─── Galerie ─────────────────────────────────────────────────────
// Auf dieser Seite geht es ausschließlich um die Arbeiten: die Motive
// selbst und die Stilrichtungen, in denen sie entstehen. Keine Buchung
// (die steht auf der Startseite unter der Galerie und auf /termin),
// keine Preise, keine Studiofotos — Räume sind keine Arbeiten und
// gehören auf /studio.

import type { Metadata } from "next";
import { Gallery } from "@/components/Gallery";
import { PageHead } from "@/components/PageHead";
import { Specialties } from "@/components/Sections";
import { getGalleryImages } from "@/lib/gallery";
import { STUDIO } from "@/lib/studio";

export const metadata: Metadata = {
  title: "Galerie",
  description: `Black-and-Grey-Tattoos, Realistic, Fineline und Illustratives von ${STUDIO.artists} — Motive aus dem Studio in ${STUDIO.city}.`,
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
        meta={`${images.length} ${images.length === 1 ? "Motiv" : "Motive"}`}
      />
      <Gallery images={images} />
      <Specialties />
    </>
  );
}
