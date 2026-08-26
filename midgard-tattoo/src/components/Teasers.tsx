"use client";

// ─── Vorschauen auf der Startseite ───────────────────────────────
// Für jede Seite der Hauptnavigation genau ein Kapitel: es zeigt so
// viel, dass klar wird, was dort steht — und nicht mehr. Wer alles
// sehen will, klickt weiter; die Startseite bleibt eine Übersicht und
// wird nicht selbst zur Onepage.
//
// Die einzige Ausnahme ist die Buchung: die steht auf der Startseite
// vollständig unter der Galerie, weil genau dort die Entscheidung
// fällt. Sie kommt deshalb nicht aus dieser Datei, sondern direkt aus
// <BookingWidget />.

import Image from "next/image";
import Link from "next/link";
import type { DisplayImage } from "@/lib/gallery";
import { PRICE_ROWS } from "@/lib/content";
import { STUDIO, STUDIO_PHOTOS } from "@/lib/studio";
import type { Review } from "@/lib/types";
import { Parallax, Reveal, RevealSection } from "./motion";
import { formatDateShortDe, SectionHead, Stagger, Stars } from "./ui";

// ─── Galerie ─────────────────────────────────────────────────────
// Eine schmale Reihe gleich großer Kacheln statt einer Bildwand. Auf der
// Startseite ist die Galerie eine Andeutung, kein Auftritt: sechs Motive
// nebeneinander sagen „davon gibt es mehr" und geben den Kapiteln
// darunter — Termin, Artists, Preise — noch Luft. Groß angesehen werden
// die Arbeiten auf /galerie.
export function GalleryTeaser({ images, index }: { images: DisplayImage[]; index?: number }) {
  const picks = images.slice(0, 5);
  if (!picks.length) return null;

  return (
    <RevealSection className="hair-top" aria-labelledby="galerie-vorschau">
      <div className="shell py-14 md:py-20">
        <SectionHead
          index={index}
          eyebrow="Galerie"
          title={<span id="galerie-vorschau">Frisch gestochen</span>}
          lead="Jedes Bild direkt nach der Sitzung aufgenommen — deshalb die gerötete Haut. So sieht ein Tattoo am ersten Tag wirklich aus."
          action={<Link href="/galerie" className="btn btn-ghost">Alle Arbeiten</Link>}
        />

        {/* Drei nebeneinander auf dem Handy, sechs auf dem Desktop: eine
            Zeile, mehr nicht. */}
        <Stagger className="grid grid-cols-3 gap-2 sm:grid-cols-6 md:gap-3" step={0.06}>
          {[
            ...picks.map((piece) => <Kachel key={piece.id} piece={piece} />),
            <MehrKachel key="mehr" rest={Math.max(0, images.length - picks.length)} />,
          ]}
        </Stagger>
      </div>
    </RevealSection>
  );
}

function Kachel({ piece }: { piece: DisplayImage }) {
  return (
    <Link
      href="/galerie"
      className="group relative block overflow-hidden"
      style={{ border: "1px solid var(--ink-hair)" }}
      aria-label={`${piece.title} — zur Galerie`}
    >
      <span className="relative block aspect-[3/4] overflow-hidden">
        <Image
          src={piece.src}
          alt=""
          fill
          placeholder="blur"
          blurDataURL={piece.blur}
          sizes="(max-width: 639px) 31vw, 16vw"
          // Zurückgenommen im Ruhezustand, voll beim Darüberfahren — so
          // drängt sich die Reihe nicht in den Vordergrund.
          className="object-cover opacity-80 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06] group-hover:opacity-100"
          style={{ objectPosition: piece.focal }}
        />
      </span>

      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "linear-gradient(to top, rgba(8,8,9,0.9) 0%, transparent 58%)" }}
      />
      {/* Der Titel erscheint erst beim Darüberfahren. Für Screenreader
          steht er im aria-label des Links, das Bild bleibt deshalb
          alt="" — sonst wäre der Name zweimal da. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-1 p-2 text-[0.6rem] uppercase leading-tight tracking-[0.12em] opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100"
        style={{ color: "var(--bone)" }}
      >
        {piece.title}
      </span>
    </Link>
  );
}

function MehrKachel({ rest }: { rest: number }) {
  return (
    <Link
      href="/galerie"
      className="group flex aspect-[3/4] flex-col items-start justify-end p-2.5 transition-colors duration-500"
      style={{ border: "1px solid var(--ink-hair)", background: "var(--ink-card)" }}
    >
      {rest > 0 && (
        <span className="display text-[1.1rem] leading-none" style={{ color: "var(--bone-soft)" }}>
          +{rest}
        </span>
      )}
      <span
        className="mt-1 text-[0.6rem] uppercase leading-tight tracking-[0.12em] transition-transform duration-500 group-hover:translate-x-1"
        style={{ color: "var(--signal)" }}
      >
        Alle<br />Arbeiten →
      </span>
    </Link>
  );
}

// ─── Preise ──────────────────────────────────────────────────────
export function PriceTeaser({ index }: { index?: number }) {
  const picks = PRICE_ROWS.slice(0, 3);

  return (
    <RevealSection className="hair-top" aria-labelledby="preise-vorschau">
      <div className="shell py-16 md:py-24">
        <SectionHead
          index={index}
          eyebrow="Preise"
          title={<span id="preise-vorschau">Was kostet das?</span>}
          lead="Ehrliche Richtwerte statt Fantasiepreise. Die konkrete Zahl für dein Motiv gibt es im Beratungstermin."
          action={<Link href="/preise" className="btn btn-ghost">Alle Preise</Link>}
        />

        <dl className="grid gap-px" style={{ background: "var(--ink-hair)" }}>
          {picks.map((row, i) => (
            <Reveal key={row.label} delay={i * 0.07}>
              <div
                className="group flex flex-wrap items-baseline justify-between gap-4 py-5"
                style={{ background: "var(--ink)" }}
              >
                <dt className="flex items-baseline gap-4">
                  <span className="display text-[0.75rem] tabular-nums" style={{ color: "var(--bone-dim)" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[1.05rem] transition-transform duration-500 md:group-hover:translate-x-1.5">
                    {row.label}
                  </span>
                </dt>
                <dd className="display text-[1.5rem] tabular-nums md:text-[1.8rem]" style={{ color: "var(--signal)" }}>
                  {row.price}
                </dd>
              </div>
            </Reveal>
          ))}
        </dl>

        <Reveal delay={0.22}>
          <p className="mt-6 max-w-[54ch] text-sm leading-relaxed" style={{ color: "var(--bone-dim)" }}>
            Richtwerte inklusive Mehrwertsteuer. Was den Preis am Ende bewegt — Stelle,
            Detailgrad, Cover-Up — steht auf der Preisseite.
          </p>
        </Reveal>
      </div>
    </RevealSection>
  );
}

// ─── Bewertungen ─────────────────────────────────────────────────
export function ReviewTeaser({ reviews, index }: { reviews: Review[]; index?: number }) {
  // Ohne Bewertungen bleibt das Kapitel weg. Ein Platzhalter mit
  // erfundenen Stimmen wäre Irreführung, ein leerer Kasten nur Ballast.
  if (!reviews.length) return null;

  const picks = reviews.slice(0, 2);
  const schnitt = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return (
    <RevealSection className="hair-top" aria-labelledby="bewertungen-vorschau">
      <div className="shell py-16 md:py-24">
        <SectionHead
          index={index}
          eyebrow="Bewertungen"
          title={<span id="bewertungen-vorschau">Was Kunden sagen</span>}
          lead={
            <span className="flex flex-wrap items-center gap-3">
              <Stars rating={schnitt} />
              <span>
                {schnitt.toFixed(1)} von 5 · {reviews.length}{" "}
                {reviews.length === 1 ? "Bewertung" : "Bewertungen"}
              </span>
            </span>
          }
          action={<Link href="/bewertungen" className="btn btn-ghost">Alle Bewertungen</Link>}
        />

        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          {picks.map((review, i) => (
            <Reveal key={review.id} delay={i * 0.09}>
              <figure className="card relative h-full p-6 md:p-8">
                {/* Anführungszeichen als Marke im Hintergrund — nimmt der
                    Kachel das Formularhafte. */}
                <span
                  aria-hidden
                  className="marker pointer-events-none absolute right-5 top-2 text-6xl leading-none"
                  style={{ color: "var(--ink-hair-strong)" }}
                >
                  &ldquo;
                </span>
                <div className="flex items-center justify-between gap-3">
                  <Stars rating={review.rating} />
                  {review.isExample && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.1em]"
                      style={{ background: "rgba(255,210,0,0.12)", color: "var(--signal)" }}
                    >
                      Beispiel
                    </span>
                  )}
                </div>
                <blockquote className="mt-5 text-[1rem] leading-relaxed" style={{ color: "var(--bone-soft)" }}>
                  &bdquo;{review.text}&ldquo;
                </blockquote>
                <figcaption className="mt-6 text-sm" style={{ color: "var(--bone-dim)" }}>
                  <span style={{ color: "var(--bone)" }}>{review.name}</span> ·{" "}
                  {formatDateShortDe(review.date)}
                  {review.source && ` · ${review.source}`}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </RevealSection>
  );
}

// ─── Studio ──────────────────────────────────────────────────────
export function StudioTeaser({ index }: { index?: number }) {
  const [foto] = STUDIO_PHOTOS;

  return (
    <RevealSection className="hair-top" aria-labelledby="studio-vorschau">
      <div className="shell py-16 md:py-24">
        <SectionHead
          index={index}
          eyebrow="Studio"
          title={<span id="studio-vorschau">{STUDIO.street}, {STUDIO.city}</span>}
          lead={`Ein Platz, ein Artist, ein Termin nach dem anderen. ${STUDIO.doorNote}`}
          action={<Link href="/studio" className="btn btn-ghost">Studio &amp; Anfahrt</Link>}
        />

        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
          <Reveal>
            <Parallax distance={44}>
              <Link href="/studio" className="group block overflow-hidden" style={{ border: "1px solid var(--ink-hair)" }}>
                <span className="relative block aspect-[16/10] overflow-hidden">
                  <Image
                    src={foto.src}
                    alt={foto.alt}
                    fill
                    placeholder="blur"
                    blurDataURL={foto.blur}
                    sizes="(max-width: 1023px) 92vw, 54vw"
                    className="object-cover transition-transform duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                  />
                </span>
              </Link>
            </Parallax>
          </Reveal>

          <Reveal delay={0.1}>
            <dl className="grid gap-px" style={{ background: "var(--ink-hair)" }}>
              <div className="py-4" style={{ background: "var(--ink)" }}>
                <dt className="eyebrow mb-2">Adresse</dt>
                <dd className="text-[1.02rem]">
                  {STUDIO.street}, {STUDIO.zip} {STUDIO.city}
                </dd>
              </div>
              <div className="py-4" style={{ background: "var(--ink)" }}>
                <dt className="eyebrow mb-2">Telefon</dt>
                <dd>
                  <a href={STUDIO.phoneHref} className="text-[1.02rem] underline underline-offset-4">
                    {STUDIO.phone}
                  </a>
                </dd>
              </div>
              <div className="py-4" style={{ background: "var(--ink)" }}>
                <dt className="eyebrow mb-2">Termine</dt>
                <dd className="text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
                  Nach Vereinbarung. Öffnungszeiten, Anfahrt und Karte stehen auf der
                  Studio-Seite.
                </dd>
              </div>
            </dl>
          </Reveal>
        </div>
      </div>
    </RevealSection>
  );
}
