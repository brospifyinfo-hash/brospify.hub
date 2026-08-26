"use client";

// ─── Der Laden ───────────────────────────────────────────────────
// Beweis, dass es das Studio wirklich gibt: das Schaufenster bei Tag
// und derselbe Raum am Abend von innen. Genau diese beiden Aufnahmen
// gehören hierher und ausdrücklich NICHT in die Galerie — dort geht es
// um Arbeiten, nicht um Räume.
//
// Daneben die vier Fakten, die vor dem ersten Termin zählen. Sie stehen
// als Liste und nicht als Fließtext, weil sie so beim Überfliegen
// funktionieren.

import Image from "next/image";
import { STUDIO, STUDIO_PHOTOS } from "@/lib/studio";
import { Parallax, Reveal } from "./motion";

const [TAG, ABEND] = STUDIO_PHOTOS;

const FACTS = [
  { label: "Ein Platz", value: "Ein Termin nach dem anderen — kein Durchlauf, keine Zuschauer" },
  { label: "Hygiene", value: "Einwegnadeln, sterile Arbeitsflächen, geprüfte Farben" },
  { label: "Entwurf", value: "Individuell gezeichnet, keine Vorlagen von der Wand" },
  { label: "Anfahrt", value: "Direkt an der Nürnberger Straße, Parken vor der Tür" },
];

export function StudioSection() {
  return (
    <section id="studio" className="relative scroll-mt-24">
      <div className="shell grid items-center gap-10 py-10 md:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <Reveal>
          {/* Geschütztes Leerzeichen vor der Hausnummer: in der sehr
              großen Versalschrift würde die „7" sonst allein in die
              nächste Zeile rutschen. */}
          <h2 className="display display-m max-w-[14ch]">
            {STUDIO.street.replace(/\s(\d+\w*)$/, "\u00A0$1")}
          </h2>

          <dl className="mt-8 grid gap-px" style={{ background: "var(--ink-hair)" }}>
            {FACTS.map((fact) => (
              <div
                key={fact.label}
                className="grid gap-1 py-4 sm:grid-cols-[130px_1fr] sm:gap-6"
                style={{ background: "var(--ink)" }}
              >
                <dt className="eyebrow">{fact.label}</dt>
                <dd className="text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-9 flex flex-wrap gap-3">
            <a href={STUDIO.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
              Route öffnen
            </a>
            <a href={STUDIO.phoneHref} className="btn btn-ghost">{STUDIO.phone}</a>
          </div>
        </Reveal>

        {/* Zwei Aufnahmen versetzt übereinander: die kleinere schiebt
            sich beim Scrollen etwas anders als die große, dadurch
            entsteht Tiefe statt zweier flacher Kacheln. */}
        <Reveal delay={0.12}>
          <div className="grid grid-cols-5 items-end gap-4 md:gap-6">
            <div className="col-span-3">
              <Parallax distance={54}>
                <Foto piece={TAG} sizes="(max-width: 1023px) 56vw, 32vw" priority />
              </Parallax>
            </div>
            <div className="col-span-2">
              <Parallax distance={92}>
                <Foto piece={ABEND} sizes="(max-width: 1023px) 38vw, 22vw" />
              </Parallax>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Foto({
  piece,
  sizes,
  priority,
}: {
  piece: (typeof STUDIO_PHOTOS)[number];
  sizes: string;
  priority?: boolean;
}) {
  return (
    <figure className="group overflow-hidden" style={{ border: "1px solid var(--ink-hair)" }}>
      <span className="relative block overflow-hidden">
        <Image
          src={piece.src}
          alt={piece.alt}
          width={piece.width}
          height={piece.height}
          placeholder={piece.blur ? "blur" : "empty"}
          blurDataURL={piece.blur || undefined}
          sizes={sizes}
          priority={priority}
          className="w-full transition-transform duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
        />
      </span>
      <figcaption
        className="flex items-baseline justify-between gap-3 px-3 py-2.5 text-[0.72rem] uppercase tracking-[0.14em]"
        style={{ background: "var(--ink-card)", color: "var(--bone-dim)" }}
      >
        <span style={{ color: "var(--bone-soft)" }}>{piece.title}</span>
        <span>{piece.placement}</span>
      </figcaption>
    </figure>
  );
}
