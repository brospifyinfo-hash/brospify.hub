import type { Metadata } from "next";
import { PageHead } from "@/components/PageHead";
import { Reveal } from "@/components/motion";
import { PRIVACY_SECTIONS } from "@/lib/content";
import { STUDIO } from "@/lib/studio";

export const metadata: Metadata = {
  title: "Datenschutz",
  description: `Datenschutzerklärung von ${STUDIO.name}: welche Daten bei einer Terminanfrage verarbeitet werden und welche Rechte du hast.`,
  alternates: { canonical: "/datenschutz" },
  robots: { index: false, follow: true },
};

export default function DatenschutzPage() {
  const offen = PRIVACY_SECTIONS.filter((s) => s.todo).length;

  return (
    <>
      <PageHead
        eyebrow="Rechtliches"
        title="Datenschutz"
        lead="Was mit deinen Angaben passiert, wenn du einen Termin anfragst — und was nicht passiert."
      />

      <section>
        <div className="shell max-w-[70ch] py-8 md:py-12">
          {offen > 0 && (
            <Reveal>
              <div
                className="card mb-10 p-5"
                style={{ borderColor: "rgba(255,210,0,0.4)", background: "rgba(255,210,0,0.05)" }}
              >
                <p className="text-sm leading-relaxed" style={{ color: "var(--bone)" }}>
                  <strong style={{ color: "var(--signal)" }}>Entwurf:</strong> In{" "}
                  {offen} Abschnitten fehlen noch die konkret eingesetzten
                  Dienstleister — unten in eckigen Klammern markiert. Der Text ist ein
                  ausgefülltes Gerüst und ersetzt keine Rechtsberatung; bitte vor dem
                  Live-Gang prüfen lassen. Die Texte stehen in{" "}
                  <code style={{ color: "var(--signal)" }}>src/lib/content.ts</code>.
                </p>
              </div>
            </Reveal>
          )}

          {PRIVACY_SECTIONS.map((section, i) => (
            <Reveal key={section.title} delay={i * 0.04}>
              <section className={i > 0 ? "mt-12" : ""}>
                <h2 className="display text-xl">{section.title}</h2>
                {section.body.map((paragraph) => (
                  <p
                    key={paragraph.slice(0, 40)}
                    className="mt-4 text-[0.95rem] leading-relaxed"
                    style={{
                      // Offene Stellen heben sich ab, statt sich im Fließtext
                      // zu verstecken.
                      color: paragraph.startsWith("[") ? "var(--signal)" : "var(--bone-soft)",
                    }}
                  >
                    {paragraph}
                  </p>
                ))}
              </section>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
