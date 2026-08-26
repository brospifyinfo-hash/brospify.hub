"use client";

// ─── Laufband ────────────────────────────────────────────────────
// Ein schmales Band, das die Stilrichtungen des Hauses vorbeiziehen
// lässt. Reine Zierde, aber mit Zweck: es trennt den Hero vom ersten
// Inhaltsblock und sagt in zwei Sekunden, was hier gestochen wird.
//
// Der Inhalt steht zweimal im DOM und die Animation schiebt genau um
// -50 % — dadurch schließt der Kreis nahtlos, ohne dass JavaScript
// Positionen nachrechnen müsste. Die Kopie ist `aria-hidden`, sonst
// läse ein Screenreader die Liste doppelt vor.

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
      className="hair-top overflow-hidden py-4"
      style={{ borderBottom: "1px solid var(--ink-hair)" }}
    >
      <div className="ticker-track" role="list" aria-label="Stilrichtungen">
        {[0, 1].map((lauf) => (
          <span key={lauf} className="flex shrink-0 items-center" aria-hidden={lauf === 1}>
            {WORDS.map((word) => (
              <span
                key={word}
                role={lauf === 0 ? "listitem" : undefined}
                className="display flex shrink-0 items-center whitespace-nowrap px-6 text-[1.1rem] md:px-9 md:text-[1.35rem]"
                style={{ color: "var(--bone-soft)" }}
              >
                {word}
                <span aria-hidden className="ml-6 text-[0.7em] md:ml-9" style={{ color: "var(--signal)" }}>
                  ✳
                </span>
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
