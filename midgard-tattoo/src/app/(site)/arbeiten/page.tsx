import type { Metadata } from "next";
import Link from "next/link";
import { Gallery } from "@/components/Gallery";
import { PageHead } from "@/components/PageHead";
import { STUDIO } from "@/lib/studio";

export const metadata: Metadata = {
  title: "Arbeiten",
  description: `Black-and-Grey-Tattoos, Realistic, Fineline und Illustratives von ${STUDIO.artist} — Motive aus dem Studio in ${STUDIO.city}.`,
  alternates: { canonical: "/arbeiten" },
};

export default function ArbeitenPage() {
  return (
    <>
      <PageHead
        eyebrow="Arbeiten"
        title="Motive aus dem Studio"
        lead="Frisch gestochen, direkt nach der Sitzung fotografiert — deshalb die gerötete Haut. So sieht ein Tattoo am ersten Tag wirklich aus."
      />
      <Gallery />
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
