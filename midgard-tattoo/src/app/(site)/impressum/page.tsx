import type { Metadata } from "next";
import { PageHead } from "@/components/PageHead";
import { Reveal, RevealSection } from "@/components/motion";
import { IMPRINT_FIELDS } from "@/lib/content";
import { STUDIO } from "@/lib/studio";

export const metadata: Metadata = {
  title: "Impressum",
  description: `Impressum und Anbieterkennzeichnung von ${STUDIO.name}.`,
  alternates: { canonical: "/impressum" },
  // Pflichtseite, aber kein Suchergebnis, das jemand sucht.
  robots: { index: false, follow: true },
};

export default function ImpressumPage() {
  const offen = IMPRINT_FIELDS.filter((f) => f.todo).length;

  return (
    <>
      <PageHead eyebrow="Rechtliches" title="Impressum" />

      <RevealSection>
        <div className="shell py-8 md:py-12"><div className="max-w-[72ch]">
          {/* Der Hinweis steht bewusst auf der Seite und nicht nur im Code:
              solange Pflichtangaben fehlen, muss das ins Auge springen. */}
          {offen > 0 && (
            <Reveal>
              <div
                className="card mb-10 p-5"
                style={{ borderColor: "rgba(255,210,0,0.4)", background: "rgba(255,210,0,0.05)" }}
              >
                <p className="text-sm leading-relaxed" style={{ color: "var(--bone)" }}>
                  <strong style={{ color: "var(--signal)" }}>Noch zu ergänzen:</strong>{" "}
                  {offen} Pflichtangaben fehlen — unten in eckigen Klammern markiert.
                  Ein unvollständiges Impressum ist abmahnfähig. Die Werte stehen in{" "}
                  <code style={{ color: "var(--signal)" }}>src/lib/content.ts</code>.
                </p>
              </div>
            </Reveal>
          )}

          <Reveal delay={0.05}>
            <h2 className="display text-xl">Angaben gemäß § 5 DDG</h2>
            <dl className="mt-6 grid gap-px" style={{ background: "var(--ink-hair)" }}>
              {IMPRINT_FIELDS.map((field) => (
                <div
                  key={field.label}
                  className="grid gap-1 py-4 sm:grid-cols-[minmax(0,15rem)_1fr] sm:gap-6"
                  style={{ background: "var(--ink)" }}
                >
                  <dt className="eyebrow">{field.label}</dt>
                  <dd
                    className="text-[0.95rem] leading-relaxed"
                    style={{ color: field.todo ? "var(--signal)" : "var(--bone-soft)" }}
                  >
                    {field.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal delay={0.1}>
            <h2 className="display mt-12 text-xl">Streitschlichtung</h2>
            <p className="mt-4 text-[0.95rem] leading-relaxed" style={{ color: "var(--bone-soft)" }}>
              Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungs­verfahren
              vor einer Verbraucher­schlichtungsstelle teilzunehmen.
            </p>

            <h2 className="display mt-12 text-xl">Haftung für Inhalte</h2>
            <p className="mt-4 text-[0.95rem] leading-relaxed" style={{ color: "var(--bone-soft)" }}>
              Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach
              den allgemeinen Gesetzen verantwortlich. Wir sind jedoch nicht
              verpflichtet, übermittelte oder gespeicherte fremde Informationen zu
              überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
              Tätigkeit hinweisen.
            </p>

            <h2 className="display mt-12 text-xl">Bildnachweis</h2>
            <p className="mt-4 text-[0.95rem] leading-relaxed" style={{ color: "var(--bone-soft)" }}>
              Alle gezeigten Tattoo-Motive und Studioaufnahmen stammen aus dem Studio
              und werden mit Einverständnis der abgebildeten Personen veröffentlicht.
            </p>
          </Reveal>
        </div></div>
      </RevealSection>
    </>
  );
}
