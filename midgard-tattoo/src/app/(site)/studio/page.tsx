// ─── Studio & Anfahrt ────────────────────────────────────────────
// Auf dieser Seite geht es ausschließlich um den Ort und die Menschen
// darin: die beiden Aufnahmen des Ladens, die zwei Artists, Adresse,
// Öffnungszeiten und Karte. Keine Preise, keine Galerie, keine
// Buchungsstrecke.

import type { Metadata } from "next";
import { Artists } from "@/components/Artists";
import { MapPreview } from "@/components/MapPreview";
import { PageHead } from "@/components/PageHead";
import { StudioSection } from "@/components/StudioSection";
import { Reveal, RevealSection, SectionHead } from "@/components/ui";
import { OPENING_HOURS, STUDIO } from "@/lib/studio";
import { todayKey } from "@/lib/types";

export const metadata: Metadata = {
  title: "Studio & Anfahrt",
  description: `${STUDIO.name} in der ${STUDIO.street}, ${STUDIO.zip} ${STUDIO.city}: der Laden, die Artists ${STUDIO.artists}, Öffnungszeiten, Kontakt und Anfahrt.`,
  alternates: { canonical: "/studio" },
};

// Wegen der Hervorhebung des heutigen Wochentags.
export const dynamic = "force-dynamic";

export default function StudioPage() {
  const heuteIndex = (new Date(`${todayKey()}T12:00:00Z`).getUTCDay() + 6) % 7;
  const heute = OPENING_HOURS[heuteIndex];

  return (
    <>
      <PageHead
        eyebrow="Studio"
        title="Ein Platz, ein Artist"
        lead={`Kein Durchlauf, keine Hektik — wer hier auf der Liege liegt, hat den Raum für sich. ${STUDIO.doorNote}`}
        meta={heute?.hours ? `Heute ${heute.hours}` : "Heute geschlossen"}
      />

      <StudioSection />

      <Artists
        eyebrow="Wer hier tätowiert"
        title="Michi und Gorilla"
        lead="Beide arbeiten im selben Raum, aber nicht in derselben Handschrift. Wer dein Motiv sticht, entscheidet sich im Vorgespräch."
      />

      {/* ── Kontakt, Zeiten und Karte ── */}
      <RevealSection className="hair-top" aria-labelledby="anfahrt">
        <div className="shell py-16 md:py-24">
          <SectionHead
            eyebrow="Anfahrt"
            title={<span id="anfahrt">So findest du uns</span>}
            lead="Die Karte lädt erst auf Klick — bis dahin verlässt kein Datenpaket diese Seite."
          />

          <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-14">
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

              <h3 className="eyebrow mb-3 mt-8">Öffnungszeiten</h3>
              <ul className="grid gap-px" style={{ background: "var(--ink-hair)" }}>
                {OPENING_HOURS.map((tag, i) => {
                  const istHeute = i === heuteIndex;
                  return (
                    <li
                      key={tag.day}
                      className="flex items-baseline justify-between gap-4 py-2.5"
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
              <p className="mt-4 max-w-[44ch] text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
                Innerhalb dieser Zeiten wird tätowiert — und zwar nach Vereinbarung.
                Für ein Gespräch ohne Termin ruf am besten vorher kurz an.
              </p>
            </Reveal>

            <Reveal delay={0.1}>
              <MapPreview />
              <p className="mt-4 max-w-[46ch] text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
                Direkt an der Nürnberger Straße, Parken vor der Tür. Von der B14
                kommend liegt das Studio auf der rechten Seite; mit der S-Bahn sind
                es vom Bahnhof Altdorf etwa zehn Minuten zu Fuß.
              </p>
            </Reveal>
          </div>
        </div>
      </RevealSection>
    </>
  );
}
