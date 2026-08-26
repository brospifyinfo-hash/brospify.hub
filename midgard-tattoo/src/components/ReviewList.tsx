"use client";

// ─── Bewertungen ─────────────────────────────────────────────────
// Zeigt ausschließlich, was der Inhaber im Dashboard eingetragen hat.
// Es gibt bewusst keine mitgelieferten Beispiele: erfundene
// Kundenstimmen sind Irreführung, und der Leerzustand unten ist die
// ehrlichere Antwort auf „noch keine Bewertungen".

import { motion } from "framer-motion";
import type { Review } from "@/lib/types";
import { formatDateShortDe, Reveal, Stars } from "./ui";
import { STUDIO } from "@/lib/studio";

// ─── Überblick ───────────────────────────────────────────────────
// Durchschnitt, Anzahl und die Verteilung auf die fünf Stufen. Die
// Verteilung ist keine Deko: ein Schnitt von 4,8 aus lauter Fünfen
// liest sich anders als derselbe Schnitt aus Fünfen und einer Zwei.
export function ReviewSummary({ reviews }: { reviews: Review[] }) {
  if (!reviews.length) return null;

  const schnitt = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  const stufen = [5, 4, 3, 2, 1].map((stufe) => ({
    stufe,
    anzahl: reviews.filter((r) => Math.round(r.rating) === stufe).length,
  }));

  return (
    <section className="hair-top">
      <div className="shell py-10 md:py-14">
        <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-center md:gap-14">
          <Reveal>
            <div className="flex items-end gap-5">
              <span className="display leading-none" style={{ fontSize: "clamp(3.5rem, 11vw, 6rem)", color: "var(--signal)" }}>
                {schnitt.toFixed(1)}
              </span>
              <span className="pb-2">
                <Stars rating={schnitt} size="1.15rem" />
                <span className="mt-2 block text-sm" style={{ color: "var(--bone-dim)" }}>
                  aus {reviews.length} {reviews.length === 1 ? "Bewertung" : "Bewertungen"}
                </span>
              </span>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <ul className="grid gap-2">
              {stufen.map(({ stufe, anzahl }) => {
                const anteil = anzahl / reviews.length;
                return (
                  <li key={stufe} className="flex items-center gap-3 text-sm">
                    <span className="w-14 shrink-0 tabular-nums" style={{ color: "var(--bone-dim)" }}>
                      {stufe} Sterne
                    </span>
                    <span
                      aria-hidden
                      className="h-1.5 flex-1 overflow-hidden rounded-full"
                      style={{ background: "var(--ink-hair)" }}
                    >
                      <motion.span
                        className="block h-full origin-left rounded-full"
                        style={{ background: stufe >= 4 ? "var(--signal)" : "var(--bone-dim)" }}
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: anteil }}
                        viewport={{ once: true, amount: 0.6 }}
                        transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </span>
                    <span className="w-8 shrink-0 text-right tabular-nums" style={{ color: "var(--bone-soft)" }}>
                      {anzahl}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

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
