"use client";

// ─── Hero ────────────────────────────────────────────────────────
// Bildschirmfüllender Auftakt: ein Motiv über die ganze Breite, darüber
// die Aussage in Versalien, unten die zwei Wege weiter. Erst darunter
// folgt die Buchung — der Hero verkauft, der Kalender wickelt ab.
//
// Das Bild liegt als Hintergrund über die volle Fläche statt als Kachel
// daneben: so ist es groß, ohne dass eine „Bilderwand" entsteht.

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { HERO_PIECE, STUDIO } from "@/lib/studio";

const EASE = [0.22, 1, 0.36, 1] as const;

export function Hero({ openSlots }: { openSlots: number }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);

  // Das Bild zieht beim Scrollen langsamer mit als der Text darüber.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "-12%"]);
  const fade = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  const rise = (delay: number) => ({
    initial: reduced ? false : { opacity: 0, y: 34 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.95, delay, ease: EASE },
  });

  return (
    <section
      ref={ref}
      className="relative flex min-h-[100svh] flex-col justify-end"
      // `isolate` hält die Ebenen dieses Abschnitts beisammen, damit der
      // Verlauf unten nicht über die nächste Sektion läuft.
      style={{ isolation: "isolate" }}
    >
      {/* ── Motiv ── */}
      <motion.div
        aria-hidden
        className="absolute inset-0 overflow-hidden"
        style={reduced ? undefined : { y: imageY }}
      >
        <Image
          src={HERO_PIECE.src}
          alt=""
          fill
          priority
          placeholder="blur"
          blurDataURL={HERO_PIECE.blur}
          sizes="100vw"
          className="object-cover object-[62%_22%]"
        />
        {/* Zwei Ebenen: eine allgemeine Abdunklung, damit Schrift überall
            hält, und ein kräftiger Verlauf nach unten, aus dem die
            Überschrift heraussteigt. */}
        <div className="absolute inset-0" style={{ background: "rgba(11,11,12,0.42)" }} />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, var(--ink) 0%, rgba(11,11,12,0.86) 26%, rgba(11,11,12,0.34) 62%, rgba(11,11,12,0.60) 100%)",
          }}
        />
      </motion.div>

      {/* ── Aussage ── */}
      <motion.div
        className="shell relative z-10 pb-16 pt-32 md:pb-24"
        style={reduced ? undefined : { y: textY }}
      >
        <motion.div className="mb-6 flex flex-wrap items-center gap-3" {...rise(0.1)}>
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
          <motion.span className="block" {...rise(0.16)}>Tinte,</motion.span>
          <motion.span className="block" style={{ color: "var(--skin)" }} {...rise(0.26)}>
            die bleibt
          </motion.span>
        </h1>

        <motion.p
          className="mt-8 max-w-[48ch] text-[1.05rem] leading-relaxed md:text-[1.15rem]"
          style={{ color: "var(--bone-soft)" }}
          {...rise(0.38)}
        >
          Schwarz-Grau-Arbeiten mit weichen Verläufen, feine Linien und ehrliche
          Beratung — von {STUDIO.artist} in der {STUDIO.street}. Jedes Motiv
          entsteht für genau eine Person.
        </motion.p>

        <motion.div className="mt-10 flex flex-wrap items-center gap-3" {...rise(0.48)}>
          <Link href="/termin" className="btn btn-signal h-14 px-8 text-[0.8rem]">
            Termin buchen
          </Link>
          <Link href="/arbeiten" className="btn btn-ghost h-14 px-7 text-[0.8rem]">
            Arbeiten ansehen
          </Link>
        </motion.div>
      </motion.div>

      {/* ── Scroll-Hinweis ──
          Blendet beim Scrollen aus, statt stur stehen zu bleiben. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-5 z-10 hidden justify-center md:flex"
        style={reduced ? undefined : { opacity: fade }}
      >
        <span className="flex flex-col items-center gap-2 text-[0.62rem] uppercase tracking-[0.24em]" style={{ color: "var(--bone-dim)" }}>
          Freie Termine
          <span className="h-8 w-px" style={{ background: "linear-gradient(to bottom, var(--bone-dim), transparent)" }} />
        </span>
      </motion.div>
    </section>
  );
}
