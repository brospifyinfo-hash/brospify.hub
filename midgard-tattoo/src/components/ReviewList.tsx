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

  const beispiele = reviews.filter((r) => r.isExample).length;

  return (
    <section>
      <div className="shell py-8 md:py-12">
        {/* Solange Platzhalter dabei sind, sagt die Seite das deutlich.
            Erfundene Kundenstimmen dürfen nicht als echte durchgehen —
            der Hinweis verschwindet, sobald die Beispiele gelöscht sind. */}
        {beispiele > 0 && (
          <Reveal className="mb-6">
            <p
              className="rounded p-4 text-sm leading-relaxed"
              style={{
                background: "rgba(255,210,0,0.06)",
                border: "1px solid rgba(255,210,0,0.35)",
                color: "var(--bone)",
              }}
            >
              <strong style={{ color: "var(--signal)" }}>Beispieldaten:</strong>{" "}
              {beispiele === reviews.length
                ? "Diese Bewertungen sind Platzhalter, um die Seite im Aufbau zu zeigen."
                : `${beispiele} der ${reviews.length} Bewertungen sind Platzhalter.`}{" "}
              Sie stammen nicht von echten Kundinnen und Kunden und werden ersetzt,
              sobald echte Rückmeldungen eingetragen sind.
            </p>
          </Reveal>
        )}

        {/* Masonry-Spalten: Bewertungen sind unterschiedlich lang, ein
            starres Raster würde überall Löcher lassen. */}
        <div className="masonry-reviews">
          {reviews.map((review, i) => (
            <Reveal key={review.id} delay={(i % 3) * 0.06}>
              <figure className="card p-6">
                <div className="flex items-center justify-between gap-4">
                  <Stars rating={review.rating} />
                  <span className="flex items-center gap-2 text-xs" style={{ color: "var(--bone-dim)" }}>
                    {review.isExample && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.1em]"
                        style={{ background: "rgba(255,210,0,0.12)", color: "var(--signal)" }}
                      >
                        Beispiel
                      </span>
                    )}
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
