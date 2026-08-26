"use client";

// ─── Vorschauen auf der Startseite ───────────────────────────────
// Für jede Seite der Hauptnavigation genau ein Block: er zeigt so viel,
// dass klar wird, was dort steht — und nicht mehr. Wer alles sehen will,
// klickt weiter; die Startseite bleibt eine Übersicht und wird nicht
// selbst zur Onepage.

import Image from "next/image";
import Link from "next/link";
import type { DisplayImage } from "@/lib/gallery";
import { PRICE_ROWS } from "@/lib/content";
import { STUDIO } from "@/lib/studio";
import type { Review } from "@/lib/types";
import { formatDateShortDe, Reveal, Stars } from "./ui";

// ─── Galerie ─────────────────────────────────────────────────────
export function GalleryTeaser({ images }: { images: DisplayImage[] }) {
  const picks = images.slice(0, 3);
  if (!picks.length) return null;

  return (
    <TeaserSection eyebrow="Galerie" title="Ein paar Motive" href="/galerie" cta="Alle Arbeiten">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {picks.map((piece, i) => (
          <Reveal key={piece.id} delay={i * 0.07}>
            <Link
              href="/galerie"
              className="group block overflow-hidden"
              style={{ border: "1px solid var(--ink-hair)" }}
            >
              <span className="relative block aspect-[4/5] overflow-hidden">
                <Image
                  src={piece.src}
                  alt={piece.alt}
                  fill
                  placeholder="blur"
                  blurDataURL={piece.blur}
                  sizes="(max-width: 767px) 45vw, 23vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                />
              </span>
              <span className="block p-3 text-[0.78rem]" style={{ color: "var(--bone-soft)" }}>
                {piece.title}
              </span>
            </Link>
          </Reveal>
        ))}

        <Reveal delay={0.21}>
          <Link
            href="/galerie"
            className="group flex h-full min-h-[160px] flex-col items-start justify-end p-4"
            style={{ border: "1px solid var(--ink-hair)", background: "var(--ink-card)" }}
          >
            <span className="display text-[1.4rem] leading-tight">
              Alle<br />Arbeiten
            </span>
            <span
              className="mt-2 text-[0.75rem] uppercase tracking-[0.16em] transition-transform duration-300 group-hover:translate-x-1"
              style={{ color: "var(--signal)" }}
            >
              Ansehen →
            </span>
          </Link>
        </Reveal>
      </div>
    </TeaserSection>
  );
}

// ─── Termin ──────────────────────────────────────────────────────
export function BookingTeaser({ openSlots }: { openSlots: number }) {
  return (
    <TeaserSection eyebrow="Termin" title="Erst reden, dann stechen" href="/termin" cta="Freie Termine">
      <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr] md:gap-10">
        <Reveal>
          <p className="max-w-[52ch] text-[1rem] leading-relaxed" style={{ color: "var(--bone-soft)" }}>
            Jeder Termin, den du hier buchen kannst, ist ein{" "}
            <strong style={{ color: "var(--bone)" }}>Beratungstermin</strong> — kostenlos
            und unverbindlich. Wir gehen dein Motiv durch, klären Größe, Stelle und
            Preis. Gestochen wird erst danach, mit einem Entwurf, den du vorher gesehen hast.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/termin" className="btn btn-signal">Termin buchen</Link>
            <a href={STUDIO.phoneHref} className="btn btn-ghost">{STUDIO.phone}</a>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="card flex h-full flex-col justify-center p-6">
            <span className="display text-5xl" style={{ color: openSlots > 0 ? "var(--signal)" : "var(--bone-dim)" }}>
              {openSlots}
            </span>
            <span className="eyebrow mt-2 block">
              {openSlots === 1 ? "freier Termin" : "freie Termine"}
            </span>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
              {openSlots > 0
                ? "Im Kalender stehen nur Termine, die wirklich freigegeben sind."
                : "Gerade ist alles vergeben. Ruf an, dann kommst du auf die Warteliste."}
            </p>
          </div>
        </Reveal>
      </div>
    </TeaserSection>
  );
}

// ─── Preise ──────────────────────────────────────────────────────
export function PriceTeaser() {
  const picks = PRICE_ROWS.slice(0, 3);
  return (
    <TeaserSection eyebrow="Preise" title="Was kostet das?" href="/preise" cta="Alle Preise">
      <Reveal>
        <dl className="grid gap-px" style={{ background: "var(--ink-hair)" }}>
          {picks.map((row) => (
            <div
              key={row.label}
              className="flex flex-wrap items-baseline justify-between gap-4 py-4"
              style={{ background: "var(--ink)" }}
            >
              <dt className="text-[1rem]">{row.label}</dt>
              <dd className="display text-[1.4rem] tabular-nums" style={{ color: "var(--signal)" }}>
                {row.price}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 max-w-[54ch] text-sm leading-relaxed" style={{ color: "var(--bone-dim)" }}>
          Richtwerte inklusive Mehrwertsteuer. Die konkrete Zahl für dein Motiv gibt
          es im Beratungstermin.
        </p>
      </Reveal>
    </TeaserSection>
  );
}

// ─── Bewertungen ─────────────────────────────────────────────────
export function ReviewTeaser({ reviews }: { reviews: Review[] }) {
  // Ohne echte Bewertungen bleibt der Block weg. Ein Platzhalter mit
  // erfundenen Stimmen wäre Irreführung, ein leerer Kasten nur Ballast.
  if (!reviews.length) return null;
  const picks = reviews.slice(0, 2);

  return (
    <TeaserSection eyebrow="Bewertungen" title="Was Kunden sagen" href="/bewertungen" cta="Alle Bewertungen">
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        {picks.map((review, i) => (
          <Reveal key={review.id} delay={i * 0.08}>
            <figure className="card h-full p-6">
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
              <blockquote className="mt-4 text-[0.98rem] leading-relaxed" style={{ color: "var(--bone-soft)" }}>
                &bdquo;{review.text}&ldquo;
              </blockquote>
              <figcaption className="mt-5 text-sm" style={{ color: "var(--bone-dim)" }}>
                {review.name} · {formatDateShortDe(review.date)}
                {review.source && ` · ${review.source}`}
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </TeaserSection>
  );
}

// ─── Studio ──────────────────────────────────────────────────────
export function StudioTeaser({ image }: { image: DisplayImage | null }) {
  return (
    <TeaserSection eyebrow="Studio" title={`${STUDIO.street}, ${STUDIO.city}`} href="/studio" cta="Studio & Anfahrt">
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
        <Reveal>
          <p className="max-w-[46ch] text-[1rem] leading-relaxed" style={{ color: "var(--bone-soft)" }}>
            Ein Platz, ein Artist, ein Termin nach dem anderen. Kein Durchlauf, keine
            Hektik — wer hier auf der Liege liegt, hat den Raum für sich. {STUDIO.doorNote}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/studio" className="btn btn-ghost">Anfahrt & Öffnungszeiten</Link>
          </div>
        </Reveal>

        {image && (
          <Reveal delay={0.1}>
            <Link href="/studio" className="group block overflow-hidden" style={{ border: "1px solid var(--ink-hair)" }}>
              <span className="relative block aspect-[16/10] overflow-hidden">
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  placeholder="blur"
                  blurDataURL={image.blur}
                  sizes="(max-width: 1023px) 92vw, 46vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
              </span>
            </Link>
          </Reveal>
        )}
      </div>
    </TeaserSection>
  );
}

// ─── Gemeinsamer Rahmen ──────────────────────────────────────────
function TeaserSection({
  eyebrow, title, href, cta, children,
}: {
  eyebrow: string;
  title: string;
  href: string;
  cta: string;
  children: React.ReactNode;
}) {
  return (
    <section className="hair-top">
      <div className="shell py-16 md:py-20">
        <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow mb-3">{eyebrow}</p>
            <h2 className="display display-m">{title}</h2>
          </div>
          <Link href={href} className="btn btn-ghost">{cta}</Link>
        </Reveal>
        {children}
      </div>
    </section>
  );
}
