import type { Metadata } from "next";
import { PageHead } from "@/components/PageHead";
import { Reveal } from "@/components/motion";
import { AFTERCARE_STEPS, AFTERCARE_WARNINGS } from "@/lib/content";
import { STUDIO } from "@/lib/studio";

export const metadata: Metadata = {
  title: "Tattoo-Pflege",
  description: "Wie du dein frisches Tattoo pflegst: die ersten Stunden, die erste Woche, Abheilung — und wann du anrufen solltest.",
  alternates: { canonical: "/pflege" },
};

export default function PflegePage() {
  return (
    <>
      <PageHead
        eyebrow="Nach dem Termin"
        title="Tattoo-Pflege"
        lead="Wie gut ein Tattoo aussieht, entscheidet sich zur Hälfte in den zwei Wochen danach. Das Wichtigste in der Reihenfolge, in der es passiert."
      />

      <section>
        <div className="shell py-8 md:py-12"><div className="max-w-[72ch]">
          <ol className="grid gap-px" style={{ background: "var(--ink-hair)" }}>
            {AFTERCARE_STEPS.map((step, i) => (
              <Reveal key={step.when} delay={i * 0.05} as="li">
                <div className="py-6" style={{ background: "var(--ink)" }}>
                  <div className="flex items-baseline gap-4">
                    <span className="marker text-xl" style={{ color: "var(--signal)" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h2 className="display text-lg">{step.when}</h2>
                  </div>
                  <p className="mt-3 pl-[3.1rem] text-[0.95rem] leading-relaxed" style={{ color: "var(--bone-soft)" }}>
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div></div>
      </section>

      {/* Warnzeichen bewusst abgesetzt und in der Signalfarbe der Gefahr —
          das ist der einzige Abschnitt, bei dem ein Anruf zählt. */}
      <section className="hair-top">
        <div className="shell py-12 md:py-16"><div className="max-w-[72ch]">
          <Reveal>
            <div className="card p-6" style={{ borderColor: "rgba(226,86,74,0.35)" }}>
              <h2 className="display text-lg" style={{ color: "var(--danger)" }}>
                Wann du anrufen solltest
              </h2>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
                Ein frisches Tattoo ist eine Wunde. Etwas Rötung, Wärme und Spannen
                in den ersten Tagen sind normal. Melde dich, wenn eines davon
                dazukommt:
              </p>
              <ul className="mt-4 space-y-2">
                {AFTERCARE_WARNINGS.map((w) => (
                  <li key={w} className="flex gap-3 text-sm" style={{ color: "var(--bone)" }}>
                    <span aria-hidden style={{ color: "var(--danger)" }}>·</span>
                    {w}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm" style={{ color: "var(--bone-soft)" }}>
                Im Zweifel lieber einmal zu früh anrufen:{" "}
                <a href={STUDIO.phoneHref} className="underline underline-offset-4" style={{ color: "var(--signal)" }}>
                  {STUDIO.phone}
                </a>
                . Bei Fieber oder stark zunehmenden Beschwerden bitte direkt zum Arzt.
              </p>
            </div>
          </Reveal>
        </div></div>
      </section>
    </>
  );
}
