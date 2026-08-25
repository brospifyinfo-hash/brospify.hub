"use client";

// ─── Kopfbereich der Startseite ──────────────────────────────────
// Ein großer Header, der in einem Blick beantwortet: wer, wo — und wann
// kann ich kommen. Die Buchung steht deshalb NICHT weiter unten auf der
// Seite, sondern direkt hier: Kalender und Formular ohne einen einzigen
// Zwischenklick.
//
// Das Motiv liegt bewusst als ruhiger Hintergrund darunter statt als
// großes Bild daneben — die Terminwahl ist der Inhalt dieses Bereichs,
// nicht die Deko.

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { BookingWidget } from "./BookingWidget";
import { HERO_PIECE, STUDIO } from "@/lib/studio";

const EASE = [0.22, 1, 0.36, 1] as const;

export function Hero({ openSlots }: { openSlots: number }) {
  const reduced = useReducedMotion();

  const rise = (delay: number) => ({
    initial: reduced ? false : { opacity: 0, y: 26 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.85, delay, ease: EASE },
  });

  return (
    <section className="relative pt-[68px] md:pt-[76px]">
      {/* Hintergrund: das Motiv stark abgedunkelt, damit Schrift und
          Kalender darauf mühelos lesbar bleiben. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <Image
          src={HERO_PIECE.src}
          alt=""
          fill
          priority
          placeholder="blur"
          blurDataURL={HERO_PIECE.blur}
          sizes="100vw"
          className="object-cover object-[70%_25%] opacity-[0.18]"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(11,11,12,0.72) 0%, rgba(11,11,12,0.88) 45%, var(--ink) 100%), radial-gradient(90% 60% at 80% 0%, rgba(255,210,0,0.09) 0%, transparent 60%)",
          }}
        />
      </div>

      <div className="shell relative z-10 grid gap-10 py-14 md:py-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-14">
        {/* ── Ansage ── */}
        <div className="lg:sticky lg:top-28">
          <motion.div className="mb-5 flex flex-wrap items-center gap-3" {...rise(0.05)}>
            <span className="eyebrow">{STUDIO.zip} {STUDIO.city} · Nürnberger Land</span>
            {openSlots > 0 && (
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.14em]"
                style={{ background: "var(--signal-glow)", color: "var(--signal)" }}
              >
                <span className="pulse-dot h-1.5 w-1.5 rounded-full" style={{ background: "var(--signal)" }} />
                {openSlots} {openSlots === 1 ? "freier Termin" : "freie Termine"}
              </span>
            )}
          </motion.div>

          <motion.h1 className="display display-hero" {...rise(0.1)}>
            <span className="block">Termin</span>
            <span className="block" style={{ color: "var(--signal)" }}>buchen</span>
          </motion.h1>

          <motion.p
            className="mt-6 max-w-[42ch] text-[1rem] leading-relaxed md:text-[1.06rem]"
            style={{ color: "var(--bone-soft)" }}
            {...rise(0.22)}
          >
            Such dir einen freien Tag aus — das ist immer ein{" "}
            <strong style={{ color: "var(--bone)" }}>Beratungstermin</strong>, kostenlos
            und unverbindlich. Wir gehen dein Motiv durch, klären Größe, Stelle und
            Preis. Gestochen wird erst danach.
          </motion.p>

          <motion.p className="mt-6 text-sm" style={{ color: "var(--bone-dim)" }} {...rise(0.32)}>
            <span className="marker" style={{ color: "var(--signal)" }}>Lieber direkt?</span>{" "}
            <a href={STUDIO.phoneHref} className="underline underline-offset-4">{STUDIO.phone}</a>
          </motion.p>
        </div>

        {/* ── Buchung ── */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.18, ease: EASE }}
        >
          <BookingWidget variant="hero" />
        </motion.div>
      </div>
    </section>
  );
}
