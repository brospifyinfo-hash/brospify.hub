"use client";

// ─── Die Menschen hinter der Nadel ───────────────────────────────
// Zwei Artists, zwei Handschriften — und der Abschnitt, der bei einem
// Tattoostudio am meisten entscheidet: Wem lege ich mich für vier
// Stunden hin?
//
// Deshalb keine gestellten Portraits vor weißer Wand, sondern die
// Aufnahmen bei der Arbeit. Die Zeilen wechseln die Seite, damit beim
// Scrollen ein Rhythmus entsteht statt zweier gleicher Kästen
// untereinander.

import Image from "next/image";
import { ARTISTS, type Artist } from "@/lib/studio";
import { Parallax, Reveal } from "./motion";
import { SectionHead } from "./ui";

export function Artists({
  index,
  eyebrow = "Die Artists",
  title = "Zwei Handschriften unter einem Dach",
  lead = "Michi arbeitet in Schwarz-Grau mit weichen Verläufen, Gorilla in feinen Linien. Wer dein Motiv sticht, entscheidet sich im Vorgespräch — je nachdem, was es braucht.",
}: {
  index?: number;
  eyebrow?: string;
  title?: string;
  lead?: string;
}) {
  return (
    <section className="hair-top" aria-labelledby="artists">
      <div className="shell py-16 md:py-24">
        {/* Die Überschrift trägt die Kennung, auf die der Abschnitt
            verweist — sonst zeigt `aria-labelledby` ins Leere und der
            Abschnitt bleibt für Screenreader namenlos. */}
        <SectionHead
          index={index}
          eyebrow={eyebrow}
          title={<span id="artists">{title}</span>}
          lead={lead}
        />

        <div className="grid gap-14 md:gap-20">
          {ARTISTS.map((artist, i) => (
            <ArtistRow key={artist.slug} artist={artist} position={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Eine Zeile ──────────────────────────────────────────────────
function ArtistRow({ artist, position }: { artist: Artist; position: number }) {
  // Auf dem Desktop wechselt die Bildseite; auf dem Handy steht das
  // Bild immer oben — dort wäre jede Abweichung nur Verwirrung.
  const bildRechts = position % 2 === 1;

  return (
    <article className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
      <Reveal
        delay={0.05}
        className={bildRechts ? "lg:order-2" : undefined}
      >
        <Parallax distance={50}>
          <figure
            className="group relative overflow-hidden"
            style={{ border: "1px solid var(--ink-hair)" }}
          >
            <span className="relative block aspect-[4/5] overflow-hidden">
              <Image
                src={artist.src}
                alt={artist.alt}
                fill
                placeholder="blur"
                blurDataURL={artist.blur}
                sizes="(max-width: 1023px) 92vw, 46vw"
                className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                style={{ objectPosition: artist.focal }}
              />
            </span>

            {/* Verlauf nach unten: hält den handgeschriebenen Namen
                lesbar, egal wie hell die Aufnahme an der Stelle ist. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, rgba(8,8,9,0.92) 0%, rgba(8,8,9,0.25) 34%, transparent 62%)",
              }}
            />
            <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 md:p-6">
              <span className="marker text-2xl md:text-3xl" style={{ color: "var(--signal)" }}>
                {artist.name}
              </span>
              <span className="eyebrow">{artist.role}</span>
            </figcaption>
          </figure>
        </Parallax>
      </Reveal>

      <div className={bildRechts ? "lg:order-1" : undefined}>
        <Reveal>
          <span className="flex items-center gap-3">
            <span className="display text-[0.8rem] tabular-nums" style={{ color: "var(--signal)" }}>
              {String(position + 1).padStart(2, "0")}
            </span>
            <span aria-hidden className="h-px w-12" style={{ background: "var(--ink-hair-strong)" }} />
            <span className="eyebrow">{artist.role}</span>
          </span>

          <h3 className="display display-l mt-4">{artist.name}</h3>
        </Reveal>

        <Reveal delay={0.08}>
          <ul className="mt-6 flex flex-wrap gap-2">
            {artist.focus.map((item) => (
              <li
                key={item}
                className="rounded-full px-3 py-1.5 text-[0.72rem] uppercase tracking-[0.14em]"
                style={{ border: "1px solid var(--ink-hair-strong)", color: "var(--bone-soft)" }}
              >
                {item}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.14}>
          <p
            className="mt-7 max-w-[46ch] text-[1rem] leading-relaxed"
            style={{ color: "var(--bone-soft)" }}
          >
            {artist.bio}
          </p>
        </Reveal>
      </div>
    </article>
  );
}
