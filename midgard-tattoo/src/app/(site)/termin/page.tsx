import type { Metadata } from "next";
import { BookingWidget } from "@/components/BookingWidget";
import { PageHead } from "@/components/PageHead";
import { FAQ, STUDIO } from "@/lib/studio";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Termin buchen",
  description: `Freie Beratungstermine bei ${STUDIO.name} in ${STUDIO.city} online ansehen und unverbindlich anfragen.`,
  alternates: { canonical: "/termin" },
};

export default function TerminPage() {
  return (
    <>
      <PageHead
        eyebrow="Termin"
        title="Termin buchen"
        lead="Im Kalender stehen ausschließlich Termine, die freigegeben wurden. Jeder davon ist ein kostenloser Beratungstermin — gestochen wird an dem Tag noch nicht."
      />
      <BookingWidget />

      {/* Genau die Fragen, die beim Buchen aufkommen — nicht die ganze
          FAQ-Seite, sondern die drei, die hier hingehören. */}
      <section className="hair-top">
        <div className="shell py-16 md:py-20">
          <h2 className="eyebrow mb-8">Gut zu wissen</h2>
          <dl className="grid gap-8 md:grid-cols-3">
            {FAQ.slice(0, 3).map((item) => (
              <div key={item.q}>
                <dt className="text-[0.98rem] font-medium">{item.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
