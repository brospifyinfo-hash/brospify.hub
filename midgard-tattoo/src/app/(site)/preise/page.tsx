// ─── Preise ──────────────────────────────────────────────────────
// Auf dieser Seite geht es ausschließlich ums Geld: Richtwerte, was
// darin enthalten ist und woran es liegt, wenn zwei gleich große
// Motive verschieden viel kosten. Keine Galerie, keine Buchungsstrecke.

import type { Metadata } from "next";
import { PageHead } from "@/components/PageHead";
import { Reveal, RevealSection, SectionHead, Stagger } from "@/components/ui";
import { PRICE_FACTORS, PRICE_INCLUDES, PRICE_ROWS } from "@/lib/content";
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
        meta={`Mindestpreis ${PRICE_ROWS[0].price}`}
      />

      {/* ── Richtwerte ── */}
      <RevealSection>
        <div className="shell py-10 md:py-14">
          <dl className="grid gap-px" style={{ background: "var(--ink-hair)" }}>
            {PRICE_ROWS.map((row, i) => (
              <Reveal key={row.label} delay={i * 0.06}>
                <div
                  className="group grid gap-2 py-6 md:grid-cols-[auto_1fr_auto] md:items-baseline md:gap-8"
                  style={{ background: "var(--ink)" }}
                >
                  <span
                    className="display hidden text-[0.75rem] tabular-nums md:block"
                    style={{ color: "var(--bone-dim)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="transition-transform duration-500 md:group-hover:translate-x-1.5">
                    <dt className="display text-[1.3rem] md:text-[1.6rem]">{row.label}</dt>
                    {row.note && (
                      <p className="mt-2 max-w-[52ch] text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
                        {row.note}
                      </p>
                    )}
                  </div>
                  <dd
                    className="display text-[1.7rem] tabular-nums md:text-right md:text-[2.1rem]"
                    style={{ color: "var(--signal)" }}
                  >
                    {row.price}
                  </dd>
                </div>
              </Reveal>
            ))}
          </dl>

          <Reveal delay={0.1}>
            <p className="mt-7 max-w-[62ch] text-sm leading-relaxed" style={{ color: "var(--bone-dim)" }}>
              Alle Angaben sind Richtwerte inklusive Mehrwertsteuer. Für größere
              Projekte fällt eine Anzahlung an, die den Termin sichert und mit dem
              Endpreis verrechnet wird.
            </p>
          </Reveal>
        </div>
      </RevealSection>

      {/* ── Was drinsteckt ── */}
      <RevealSection className="hair-top" aria-labelledby="enthalten">
        <div className="shell py-16 md:py-24">
          <SectionHead
            eyebrow="Ohne Aufpreis"
            title={<span id="enthalten">Das steckt im Preis</span>}
            lead="Es gibt keine Position, die am Ende noch dazukommt. Was hier steht, ist Teil jedes Termins."
          />

          <Stagger className="grid gap-px sm:grid-cols-2 lg:grid-cols-3" step={0.06}>
            {PRICE_INCLUDES.map((item) => (
              <div
                key={item}
                className="flex h-full items-start gap-3 p-5"
                style={{ background: "var(--ink)", outline: "1px solid var(--ink-hair)" }}
              >
                <span aria-hidden className="mt-0.5 shrink-0" style={{ color: "var(--signal)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12.5l5 5L20 6.5" />
                  </svg>
                </span>
                <span className="text-[0.95rem] leading-relaxed">{item}</span>
              </div>
            ))}
          </Stagger>
        </div>
      </RevealSection>

      {/* ── Woran es liegt ── */}
      <RevealSection className="hair-top" aria-labelledby="faktoren">
        <div className="shell py-16 md:py-24">
          <SectionHead
            eyebrow="Woran es liegt"
            title={<span id="faktoren">Warum zwei gleich große Motive unterschiedlich kosten</span>}
          />

          <div className="grid gap-px md:grid-cols-2 lg:grid-cols-4" style={{ background: "var(--ink-hair)" }}>
            {PRICE_FACTORS.map((factor, i) => (
              <Reveal key={factor.title} delay={i * 0.07}>
                <div className="group h-full p-6" style={{ background: "var(--ink)" }}>
                  <span className="marker text-2xl" style={{ color: "var(--signal)" }}>
                    0{i + 1}
                  </span>
                  <h3 className="display mt-4 text-xl leading-tight transition-transform duration-500 md:group-hover:translate-x-1">
                    {factor.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
                    {factor.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </RevealSection>
    </>
  );
}
