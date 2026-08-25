import type { Metadata } from "next";
import Link from "next/link";
import { PageHead } from "@/components/PageHead";
import { StudioSection } from "@/components/StudioSection";
import { Process, Specialties } from "@/components/Sections";
import { STUDIO } from "@/lib/studio";

export const metadata: Metadata = {
  title: "Studio",
  description: `${STUDIO.name} in der ${STUDIO.street}, ${STUDIO.zip} ${STUDIO.city}: Handschrift, Ablauf, Öffnungszeiten und Anfahrt.`,
  alternates: { canonical: "/studio" },
};

export default function StudioPage() {
  return (
    <>
      <PageHead
        eyebrow="Studio"
        title="Ein Platz, ein Artist"
        lead={`Kein Durchlauf, keine Hektik — wer hier auf der Liege liegt, hat den Raum für sich. ${STUDIO.doorNote}`}
      />
      <StudioSection />
      <Specialties />
      <Process />
      <section className="hair-top">
        <div className="shell flex flex-wrap items-center justify-between gap-6 py-14">
          <p className="max-w-[40ch] text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
            Der erste Schritt ist immer ein Gespräch — kostenlos und unverbindlich.
          </p>
          <Link href="/termin" className="btn btn-signal">Termin buchen</Link>
        </div>
      </section>
    </>
  );
}
