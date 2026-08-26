"use client";

// ─── Kopf einer Unterseite ───────────────────────────────────────
// Einheitlicher Auftakt für alle Seiten außer der Startseite: Rubrik,
// Titel, ein Satz Einordnung und optional eine Kennzahl. Hält die
// Seiten als Familie zusammen, ohne dass jede ihren eigenen Kopf
// erfindet.
//
// Der Titel steigt wortweise aus einer Maske auf. Das kostet nichts
// (nur transform), sagt aber sofort: hier fängt etwas an. Bei
// reduzierter Bewegung steht er einfach da.

import { Reveal, SplitHeadline } from "./motion";

export function PageHead({
  eyebrow,
  title,
  lead,
  meta,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  /** Kurze Kennzahl rechts oben — „12 Motive", „4,9 von 5". Bleibt weg,
   *  wenn es nichts zu zählen gibt; eine erfundene Zahl wäre schlimmer
   *  als eine leere Stelle. */
  meta?: string;
}) {
  return (
    <header className="relative hair-top overflow-hidden">
      {/* Sehr zurückhaltender Lichtschein hinter der Überschrift — gibt
          dem Seitenanfang Tiefe, ohne dass ein Bild geladen wird. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[42rem] -translate-x-1/2 opacity-60"
        style={{
          background: "radial-gradient(closest-side, rgba(255,210,0,0.07), transparent)",
        }}
      />

      <div className="shell relative pb-4 pt-24 md:pb-6 md:pt-28">
        <Reveal className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
          <span className="flex items-center gap-4">
            <span aria-hidden className="h-px w-10" style={{ background: "var(--signal)" }} />
            <span className="eyebrow">{eyebrow}</span>
          </span>
          {meta && (
            <span className="text-[0.72rem] uppercase tracking-[0.16em]" style={{ color: "var(--bone-dim)" }}>
              {meta}
            </span>
          )}
        </Reveal>

        <h1 className="display display-l mt-6 max-w-[16ch]">
          <SplitHeadline text={title} />
        </h1>

        {lead && (
          <Reveal delay={0.14}>
            <p
              className="mt-6 max-w-[58ch] text-[1.02rem] leading-relaxed"
              style={{ color: "var(--bone-soft)" }}
            >
              {lead}
            </p>
          </Reveal>
        )}
      </div>
    </header>
  );
}
