import type { Metadata } from "next";
import Link from "next/link";
import { PageHead } from "@/components/PageHead";
import { Reveal } from "@/components/motion";
import { OPENING_HOURS, STUDIO } from "@/lib/studio";
import { todayKey } from "@/lib/types";

export const metadata: Metadata = {
  title: "Kontakt & Anfahrt",
  description: `${STUDIO.name}, ${STUDIO.street}, ${STUDIO.zip} ${STUDIO.city}. Telefon, E-Mail, Öffnungszeiten und Anfahrt.`,
  alternates: { canonical: "/kontakt" },
};

export const dynamic = "force-dynamic";

export default function KontaktPage() {
  // Welcher Wochentag heute ist, damit die aktuelle Zeile hervorsticht —
  // in der Zeitzone des Studios, nicht der des Servers.
  const heute = new Date(`${todayKey()}T12:00:00Z`).getUTCDay();
  const heuteIndex = (heute + 6) % 7;

  return (
    <>
      <PageHead
        eyebrow="Kontakt"
        title="So erreichst du uns"
        lead={STUDIO.doorNote}
      />

      <section>
        <div className="shell grid gap-10 py-8 md:py-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <dl className="grid gap-px" style={{ background: "var(--ink-hair)" }}>
              <div className="py-4" style={{ background: "var(--ink)" }}>
                <dt className="eyebrow mb-2">Adresse</dt>
                <dd className="text-[1.05rem]">
                  {STUDIO.name}<br />
                  {STUDIO.street}<br />
                  {STUDIO.zip} {STUDIO.city}
                </dd>
              </div>
              <div className="py-4" style={{ background: "var(--ink)" }}>
                <dt className="eyebrow mb-2">Telefon</dt>
                <dd>
                  <a href={STUDIO.phoneHref} className="text-[1.05rem] underline underline-offset-4">
                    {STUDIO.phone}
                  </a>
                </dd>
              </div>
              <div className="py-4" style={{ background: "var(--ink)" }}>
                <dt className="eyebrow mb-2">E-Mail</dt>
                <dd>
                  <a href={`mailto:${STUDIO.email}`} className="text-[1.05rem] underline underline-offset-4">
                    {STUDIO.email}
                  </a>
                </dd>
              </div>
            </dl>

            <div className="mt-8 flex flex-wrap gap-3">
              <a href={STUDIO.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                Route öffnen
              </a>
              <Link href="/termin" className="btn btn-signal">Termin buchen</Link>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <h2 className="eyebrow mb-4">Öffnungszeiten</h2>
            <ul className="grid gap-px" style={{ background: "var(--ink-hair)" }}>
              {OPENING_HOURS.map((tag, i) => {
                const istHeute = i === heuteIndex;
                return (
                  <li
                    key={tag.day}
                    className="flex items-baseline justify-between gap-4 py-3"
                    style={{ background: "var(--ink)" }}
                  >
                    <span
                      className="text-[0.95rem]"
                      style={{ color: istHeute ? "var(--signal)" : "var(--bone)", fontWeight: istHeute ? 600 : 400 }}
                    >
                      {tag.day}
                      {istHeute && <span className="ml-2 text-[0.7rem] uppercase tracking-[0.14em]">heute</span>}
                    </span>
                    <span
                      className="text-[0.95rem] tabular-nums"
                      style={{ color: tag.hours ? "var(--bone-soft)" : "var(--bone-dim)" }}
                    >
                      {tag.hours ?? "geschlossen"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-5 max-w-[46ch] text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
              Innerhalb dieser Zeiten wird tätowiert — und zwar nach Vereinbarung.
              Für ein Gespräch ohne Termin ruf am besten vorher kurz an, damit
              niemand vor verschlossener Tür steht.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
