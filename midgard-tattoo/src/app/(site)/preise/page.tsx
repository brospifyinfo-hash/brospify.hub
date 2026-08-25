import type { Metadata } from "next";
import Link from "next/link";
import { PageHead } from "@/components/PageHead";
import { Reveal } from "@/components/motion";
import { PRICE_FACTORS, PRICE_ROWS } from "@/lib/content";
import { STUDIO } from "@/lib/studio";

export const metadata: Metadata = {
  title: "Preise",
  description: `Was ein Tattoo bei ${STUDIO.name} in ${STUDIO.city} kostet: Mindestpreis, Richtwerte nach Größe, Tagessatz und was den Preis beeinflusst.`,
  alternates: { canonical: "/preise" },
};

export default function PreisePage() {
  return (
    <>
      <PageHead
        eyebrow="Preise"
        title="Was kostet das?"
        lead="Ehrliche Richtwerte statt Fantasiepreise. Was dein Motiv wirklich kostet, sagen wir dir im Beratungstermin — vorher wird nichts fest."
      />

      <section>
        <div className="shell py-8 md:py-12">
          <Reveal>
            <dl className="grid gap-px" style={{ background: "var(--ink-hair)" }}>
              {PRICE_ROWS.map((row) => (
                <div
                  key={row.label}
                  className="grid gap-2 py-5 md:grid-cols-[1fr_auto] md:items-baseline md:gap-8"
                  style={{ background: "var(--ink)" }}
                >
                  <div>
                    <dt className="text-[1.05rem] font-medium">{row.label}</dt>
                    {row.note && (
                      <p className="mt-1 max-w-[52ch] text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
                        {row.note}
                      </p>
                    )}
                  </div>
                  <dd
                    className="display text-[1.6rem] tabular-nums md:text-[1.9rem] md:text-right"
                    style={{ color: "var(--signal)" }}
                  >
                    {row.price}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal delay={0.08}>
            <p className="mt-6 max-w-[62ch] text-sm leading-relaxed" style={{ color: "var(--bone-dim)" }}>
              Alle Angaben sind Richtwerte inklusive Mehrwertsteuer. Für größere
              Projekte fällt eine Anzahlung an, die den Termin sichert und mit dem
              Endpreis verrechnet wird.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="hair-top">
        <div className="shell py-14 md:py-20">
          <Reveal className="mb-10">
            <p className="eyebrow mb-4">Woran es liegt</p>
            <h2 className="display display-m max-w-[18ch]">Warum zwei gleich große Motive unterschiedlich kosten</h2>
          </Reveal>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {PRICE_FACTORS.map((factor, i) => (
              <Reveal key={factor.title} delay={i * 0.07}>
                <div className="card h-full p-5">
                  <h3 className="display text-lg">{factor.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
                    {factor.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="hair-top">
        <div className="shell flex flex-wrap items-center justify-between gap-6 py-14">
          <p className="max-w-[42ch] text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
            Konkrete Zahl für dein Motiv? Die gibt es im Beratungstermin — kostenlos
            und unverbindlich.
          </p>
          <Link href="/termin" className="btn btn-signal">Termin buchen</Link>
        </div>
      </section>
    </>
  );
}
