"use client";

// ─── Laufband ────────────────────────────────────────────────────
// Ein schmales Band, das die Stilrichtungen des Hauses vorbeiziehen
// lässt. Es trennt den Hero vom ersten Kapitel und sagt in zwei Sekunden,
// was hier gestochen wird.
//
// Drei Dinge entscheiden, ob so ein Band billig oder gut aussieht:
//
//  1. Die Ränder. Ein Text, der an der Fensterkante hart abgeschnitten
//     wird, wirkt wie ein Fehler. Eine Maske lässt ihn an beiden Seiten
//     ausblenden, als liefe er hinter der Seite weiter.
//  2. Der Ton. Nicht laut: gedämpfte Schrift in Versalien, weiter
//     Buchstabenabstand, und als Trenner eine kleine Raute in der
//     Signalfarbe statt eines Sternchens in Textgröße.
//  3. Das Tempo. Langsam genug, dass man mitliest, statt es als Flimmern
//     wahrzunehmen.
//
// Der Inhalt steht zweimal im DOM und die Animation schiebt genau um
// -50 % — dadurch schließt der Kreis nahtlos, ohne dass JavaScript
// Positionen nachrechnen müsste. Die Kopie ist `aria-hidden`, sonst läse
// ein Screenreader die Liste doppelt vor.

const WORDS = [
  "Black & Grey",
  "Realistic",
  "Fineline",
  "Cover-Up",
  "Lettering",
  "Florales",
  "Sketch",
  "Eigene Entwürfe",
];

export function Marquee() {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: "var(--ink-raise)",
        borderTop: "1px solid var(--ink-hair)",
        borderBottom: "1px solid var(--ink-hair)",
      }}
    >
      <div
        className="ticker-mask py-3.5 md:py-4"
        role="list"
        aria-label="Stilrichtungen"
      >
        <div className="ticker-track">
          {[0, 1].map((lauf) => (
            <span key={lauf} className="flex shrink-0 items-center" aria-hidden={lauf === 1}>
              {WORDS.map((word) => (
                <span
                  key={word}
                  role={lauf === 0 ? "listitem" : undefined}
                  className="flex shrink-0 items-center whitespace-nowrap text-[0.7rem] uppercase tracking-[0.3em] md:text-[0.76rem]"
                  style={{ color: "var(--bone-soft)" }}
                >
                  {word}
                  <span
                    aria-hidden
                    className="mx-7 inline-block h-[5px] w-[5px] rotate-45 md:mx-10"
                    style={{ background: "var(--signal)", opacity: 0.85 }}
                  />
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
