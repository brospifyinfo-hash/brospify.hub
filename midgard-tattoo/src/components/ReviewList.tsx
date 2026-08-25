"use client";

// ─── Bewertungen ─────────────────────────────────────────────────
// Zeigt ausschließlich, was der Inhaber im Dashboard eingetragen hat.
// Es gibt bewusst keine mitgelieferten Beispiele: erfundene
// Kundenstimmen sind Irreführung, und der Leerzustand unten ist die
// ehrlichere Antwort auf „noch keine Bewertungen".

import type { Review } from "@/lib/types";
import { formatDateShortDe, Reveal, Stars } from "./ui";
import { STUDIO } from "@/lib/studio";

export function ReviewList({ reviews }: { reviews: Review[] }) {
  if (!reviews.length) {
    return (
      <section>
        <div className="shell max-w-[60ch] py-12 md:py-16">
          <Reveal>
            <div className="card p-8 text-center">
              <span className="marker text-2xl" style={{ color: "var(--signal)" }}>
                Noch nichts hier
              </span>
              <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
                Auf dieser Seite stehen echte Rückmeldungen von Kundinnen und Kunden.
                Solange keine eingetragen sind, bleibt sie leer — erfundene
                Bewertungen kommen hier nicht hin.
              </p>
              <p className="mt-5 text-sm" style={{ color: "var(--bone-dim)" }}>
                Du warst schon da? Ruf an oder schreib uns:{" "}
                <a href={STUDIO.phoneHref} className="underline underline-offset-4">
                  {STUDIO.phone}
                </a>
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="shell py-8 md:py-12">
        {/* Masonry-Spalten: Bewertungen sind unterschiedlich lang, ein
            starres Raster würde überall Löcher lassen. */}
        <div className="masonry-reviews">
          {reviews.map((review, i) => (
            <Reveal key={review.id} delay={(i % 3) * 0.06}>
              <figure className="card p-6">
                <div className="flex items-center justify-between gap-4">
                  <Stars rating={review.rating} />
                  <span className="text-xs" style={{ color: "var(--bone-dim)" }}>
                    {formatDateShortDe(review.date)}
                  </span>
                </div>
                <blockquote
                  className="mt-4 whitespace-pre-wrap text-[0.98rem] leading-relaxed"
                  style={{ color: "var(--bone-soft)" }}
                >
                  &bdquo;{review.text}&ldquo;
                </blockquote>
                <figcaption className="mt-5 text-sm">
                  <span style={{ color: "var(--bone)" }}>{review.name}</span>
                  {review.source && (
                    <span style={{ color: "var(--bone-dim)" }}> · über {review.source}</span>
                  )}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
