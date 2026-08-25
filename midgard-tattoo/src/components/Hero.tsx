"use client";

// ─── Hero mit Slideshow ──────────────────────────────────────────
// Bildschirmfüllender Auftakt. Die Bilder wechseln alle acht Sekunden
// mit einer weichen Blende; welche gezeigt werden, bestimmt der Inhaber
// im Dashboard über den Haken „Im Hero zeigen".
//
// Drei Regeln, an denen die Umsetzung hängt:
//  • Nur das aktive Bild ist sichtbar, alle liegen übereinander — so
//    gibt es kein Nachladen beim Wechsel und keinen Sprung im Layout.
//  • `prefers-reduced-motion` hält die Schau an und zeigt das erste
//    Bild; automatisch wechselnde Inhalte sind für manche Menschen
//    schlicht nicht benutzbar.
//  • Die Punkte unten sind echte Knöpfe mit Beschriftung, nicht nur
//    Dekoration — die Schau lässt sich damit steuern.

import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DisplayImage } from "@/lib/gallery";
import { STUDIO } from "@/lib/studio";

const EASE = [0.22, 1, 0.36, 1] as const;
const INTERVAL_MS = 8000;

export function Hero({ images, openSlots }: { images: DisplayImage[]; openSlots: number }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "16%"]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "-12%"]);
  const fade = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  const count = images.length;
  const advance = useCallback(() => setIndex((i) => (i + 1) % count), [count]);

  useEffect(() => {
    if (reduced || paused || count < 2) return;
    const id = setInterval(advance, INTERVAL_MS);
    return () => clearInterval(id);
  }, [advance, reduced, paused, count]);

  // Weiterschalten anhalten, solange der Tab im Hintergrund liegt —
  // sonst springt die Schau beim Zurückkommen um mehrere Bilder.
  useEffect(() => {
    const onVisibility = () => setPaused(document.visibilityState !== "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const rise = (delay: number) => ({
    initial: reduced ? false : { opacity: 0, y: 34 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.95, delay, ease: EASE },
  });

  const active = images[index] ?? images[0];

  return (
    <section
      ref={ref}
      className="relative flex min-h-[100svh] flex-col justify-end"
      style={{ isolation: "isolate" }}
    >
      {/* ── Slideshow ── */}
      <motion.div
        aria-hidden
        className="absolute inset-0 overflow-hidden"
        style={reduced ? undefined : { y: imageY }}
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={active?.id ?? "leer"}
            className="absolute inset-0"
            initial={reduced ? false : { opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            // Lange Blende, langsamer Zoom: der Wechsel soll auffallen,
            // ohne die Aufmerksamkeit vom Text zu ziehen.
            transition={{ opacity: { duration: 1.4 }, scale: { duration: 9, ease: "linear" } }}
          >
            {active && (
              <Image
                src={active.src}
                alt=""
                fill
                // Nur das erste Bild ist für den ersten Eindruck nötig;
                // die übrigen holt der Browser nebenbei.
                priority={index === 0}
                placeholder="blur"
                blurDataURL={active.blur}
                sizes="100vw"
                className="object-cover object-[62%_25%]"
              />
            )}
          </motion.div>
        </AnimatePresence>

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
          <Link href="/galerie" className="btn btn-ghost h-14 px-7 text-[0.8rem]">
            Galerie ansehen
          </Link>
        </motion.div>

        {/* ── Steuerung der Schau ── */}
        {count > 1 && (
          <motion.div className="mt-10 flex items-center gap-4" {...rise(0.56)}>
            <div className="flex items-center gap-2">
              {images.map((image, i) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Bild ${i + 1} von ${count}: ${image.title}`}
                  aria-current={i === index}
                  className="h-9 px-1"
                >
                  <span
                    className="block h-[3px] transition-all duration-500"
                    style={{
                      width: i === index ? "2.25rem" : "1rem",
                      background: i === index ? "var(--signal)" : "var(--ink-hair-strong)",
                    }}
                  />
                </button>
              ))}
            </div>
            <span className="text-[0.7rem] uppercase tracking-[0.16em]" style={{ color: "var(--bone-dim)" }}>
              {active?.title}
            </span>
          </motion.div>
        )}
      </motion.div>

      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-5 z-10 hidden justify-center md:flex"
        style={reduced ? undefined : { opacity: fade }}
      >
        <span className="flex flex-col items-center gap-2 text-[0.62rem] uppercase tracking-[0.24em]" style={{ color: "var(--bone-dim)" }}>
          Mehr
          <span className="h-8 w-px" style={{ background: "linear-gradient(to bottom, var(--bone-dim), transparent)" }} />
        </span>
      </motion.div>
    </section>
  );
}
