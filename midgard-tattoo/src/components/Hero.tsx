"use client";

// ─── Hero ────────────────────────────────────────────────────────
// Die Startfläche macht in drei Sekunden drei Aussagen klar: WAS
// (Black & Grey), WO (Altdorf) und WAS JETZT (Termin anfragen). Alles
// andere ist Atmosphäre.
//
// Aufbau: übergroße Versalien links, das Motiv rechts in einer
// Parallax-Ebene, dazwischen ein gelber Marker-Akzent — genau die
// Aufteilung, die auch die Schaufensterscheibe des Studios hat.

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { HERO_PIECE, STUDIO } from "@/lib/studio";
import { Parallax } from "./motion";

const EASE = [0.22, 1, 0.36, 1] as const;

const TICKER = [
  "Black & Grey", "Realistic", "Fineline", "Florales",
  "Sketch", "Lettering", "Cover-Up", "Custom Work",
];

export function Hero({ openSlots }: { openSlots: number }) {
  const reduced = useReducedMotion();

  // Beim ersten Laden gibt es noch keinen Scroll, an dem sich etwas
  // aufhängen ließe — hier laufen die Elemente deshalb zeitversetzt
  // von selbst ein.
  const rise = (delay: number) => ({
    initial: reduced ? false : { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.9, delay, ease: EASE },
  });

  return (
    <section className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden pt-[68px]">
      {/* Lichtstimmung: ein warmer Kegel oben rechts, wie das Fenster
          des Studios, plus ein Ausblenden nach unten in die Sektion. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 78% 8%, rgba(255,210,0,0.10) 0%, transparent 55%), radial-gradient(80% 60% at 10% 90%, rgba(214,177,149,0.07) 0%, transparent 60%)",
        }}
      />

      <div className="shell relative z-10 grid flex-1 items-center gap-10 pb-14 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-24">
        {/* ── Text ── */}
        <div>
          <motion.div className="mb-6 flex flex-wrap items-center gap-3" {...rise(0.05)}>
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

          <h1 className="display display-xl">
            <motion.span className="block" {...rise(0.1)}>Tinte,</motion.span>
            <motion.span className="block" style={{ color: "var(--skin)" }} {...rise(0.18)}>
              die bleibt
            </motion.span>
          </h1>

          <motion.p
            className="mt-7 max-w-[46ch] text-[1.02rem] leading-relaxed md:text-[1.12rem]"
            style={{ color: "var(--bone-soft)" }}
            {...rise(0.3)}
          >
            Schwarz-Grau-Arbeiten mit weichen Verläufen, feine Linien und
            ehrliche Beratung — von {STUDIO.artist} in der {STUDIO.street}.
            Jedes Motiv entsteht für genau eine Person.
          </motion.p>

          <motion.div className="mt-9 flex flex-wrap items-center gap-3" {...rise(0.4)}>
            <a href="#termin" className="btn btn-signal">Freie Termine ansehen</a>
            <a href="#arbeiten" className="btn btn-ghost">Arbeiten</a>
          </motion.div>

          <motion.p className="mt-7 text-sm" style={{ color: "var(--bone-dim)" }} {...rise(0.5)}>
            <span className="marker" style={{ color: "var(--signal)" }}>Lieber direkt?</span>{" "}
            <a href={STUDIO.phoneHref} className="underline underline-offset-4">{STUDIO.phone}</a>
          </motion.p>
        </div>

        {/* ── Motiv ── */}
        <motion.div
          initial={reduced ? false : { opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.3, ease: EASE }}
        >
          <Parallax distance={reduced ? 0 : 70} className="relative">
            <div className="relative mx-auto aspect-[3/4] w-full max-w-[420px] overflow-hidden lg:max-w-none">
              <Image
                src={HERO_PIECE.src}
                alt={HERO_PIECE.alt}
                fill
                // Das Hero-Bild ist das LCP-Element: `priority` lädt es
                // vorrangig, statt es hinter die JS-Bundles zu stellen.
                priority
                placeholder="blur"
                blurDataURL={HERO_PIECE.blur}
                sizes="(max-width: 1023px) 90vw, 46vw"
                className="object-cover"
                style={{ objectPosition: "50% 30%" }}
              />
              {/* Unterkante weich in den Seitenhintergrund auslaufen lassen */}
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-1/3"
                style={{ background: "linear-gradient(to top, var(--ink), transparent)" }}
              />
            </div>
            <p className="mt-3 text-center text-[0.72rem] uppercase tracking-[0.2em] lg:text-left" style={{ color: "var(--bone-dim)" }}>
              {HERO_PIECE.title} · {HERO_PIECE.placement}
            </p>
          </Parallax>
        </motion.div>
      </div>

      {/* ── Laufschrift der Stilrichtungen ──
          Zweimal derselbe Inhalt: die Animation schiebt exakt eine
          Hälfte weg und springt dann unsichtbar zurück auf null. */}
      <div className="relative z-10 hair-top overflow-hidden py-4">
        <div className="ticker-track" aria-hidden>
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0">
              {TICKER.map((word) => (
                <span
                  key={`${copy}-${word}`}
                  className="display flex items-center gap-8 px-8 text-[0.95rem] tracking-[0.18em]"
                  style={{ color: "var(--bone-dim)" }}
                >
                  {word}
                  <span className="h-1 w-1 rounded-full" style={{ background: "var(--signal)" }} />
                </span>
              ))}
            </div>
          ))}
        </div>
        <span className="sr-only-visually">Stilrichtungen: {TICKER.join(", ")}</span>
      </div>
    </section>
  );
}
