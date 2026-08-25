import type { Metadata } from "next";
import Link from "next/link";
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
      <section className="hair-top">
        <div className="shell flex flex-wrap items-center justify-between gap-6 py-14">
          <p className="max-w-[40ch] text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
            Etwas dabei, das in deine Richtung geht? Im Beratungstermin schauen wir,
            was daraus für dich werden kann.
          </p>
          <Link href="/termin" className="btn btn-signal">Termin buchen</Link>
        </div>
      </section>
    </>
  );
}
