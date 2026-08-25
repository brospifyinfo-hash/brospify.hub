"use client";

// ─── Anreißer auf der Startseite ─────────────────────────────────
// Jeder Anreißer zeigt so viel, dass man weiterklicken will, und nicht
// mehr. Die vollständigen Inhalte stehen auf ihren eigenen Seiten.

import Image from "next/image";
import Link from "next/link";
import { GALLERY, SPECIALTIES, STUDIO } from "@/lib/studio";
import { Reveal } from "./motion";

// ─── Arbeiten ────────────────────────────────────────────────────
export function GalleryTeaser() {
  // Drei Motive reichen als Kostprobe — die vierte Kachel führt weiter.
  const picks = GALLERY.filter((p) => p.slug !== "studio-altdorf").slice(0, 3);

  return (
    <section className="hair-top">
      <div className="shell py-20 md:py-24">
        <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow mb-4">Arbeiten</p>
            <h2 className="display display-m">Ein paar Motive</h2>
          </div>
          <Link href="/arbeiten" className="btn btn-ghost">Alle Arbeiten</Link>
        </Reveal>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {picks.map((piece, i) => (
            <Reveal key={piece.slug} delay={i * 0.07}>
              <Link
                href="/arbeiten"
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
              href="/arbeiten"
              className="group flex h-full min-h-[160px] flex-col items-start justify-end p-4 transition-colors"
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
      </div>
    </section>
  );
}

// ─── Studio ──────────────────────────────────────────────────────
export function StudioTeaser() {
  return (
    <section className="hair-top">
      <div className="shell grid gap-10 py-20 md:py-24 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <p className="eyebrow mb-4">Handschrift</p>
          <h2 className="display display-m max-w-[16ch]">
            Schwarz, Grau und viel Luft dazwischen
          </h2>
          <ul className="mt-8 grid gap-px" style={{ background: "var(--ink-hair)" }}>
            {SPECIALTIES.slice(0, 3).map((item) => (
              <li key={item.title} className="py-3" style={{ background: "var(--ink)" }}>
                <span className="text-[0.95rem] font-medium">{item.title}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/studio" className="btn btn-ghost">Über das Studio</Link>
            <Link href="/termin" className="btn btn-signal">Termin buchen</Link>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <Link href="/studio" className="group block overflow-hidden" style={{ border: "1px solid var(--ink-hair)" }}>
            <span className="relative block aspect-[16/10] overflow-hidden">
              <Image
                src="/studio-altdorf.webp"
                alt={`Schaufenster des Studios in der ${STUDIO.street}`}
                fill
                placeholder="blur"
                blurDataURL={GALLERY.find((g) => g.slug === "studio-altdorf")!.blur}
                sizes="(max-width: 1023px) 92vw, 46vw"
                className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              />
            </span>
            <span className="flex items-center justify-between gap-3 p-4 text-sm">
              <span style={{ color: "var(--bone-soft)" }}>
                {STUDIO.street} · {STUDIO.zip} {STUDIO.city}
              </span>
              <span style={{ color: "var(--signal)" }}>→</span>
            </span>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
