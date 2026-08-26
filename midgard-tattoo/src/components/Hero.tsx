"use client";

// ─── Hero mit Slideshow ──────────────────────────────────────────
// Bildschirmfüllender Auftakt. Die Bilder wechseln von selbst alle
// sieben Sekunden mit einer weichen Blende; welche gezeigt werden,
// bestimmt der Inhaber im Dashboard über den Haken „Im Hero zeigen".
//
// Vier Regeln, an denen die Umsetzung hängt:
//  • Nur das aktive Bild ist im DOM, alle liegen an derselben Stelle —
//    so gibt es kein Nachladen beim Wechsel und keinen Sprung im Layout.
//  • Jedes Motiv bringt seinen eigenen Bildausschnitt mit (`focal`).
//    Ein Hochformat bildschirmfüllend zu zeigen heißt, den Großteil
//    wegzuschneiden; welcher Teil stehen bleibt, ist der Unterschied
//    zwischen Motiv und Hautausschnitt.
//  • Der Fortschritt ist sichtbar: unter dem aktiven Vorschaubild läuft
//    ein Balken ab. Wer eine Schau nicht steuern kann, muss wenigstens
//    sehen, wann sie weiterspringt.
//  • `prefers-reduced-motion` hält alles an und zeigt das erste Bild;
//    automatisch wechselnde Inhalte sind für manche Menschen schlicht
//    nicht benutzbar.

import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DisplayImage } from "@/lib/gallery";
import { STUDIO } from "@/lib/studio";

const EASE = [0.22, 1, 0.36, 1] as const;
const INTERVAL_MS = 7000;

export function Hero({ images, openSlots }: { images: DisplayImage[]; openSlots: number }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Zählt bei jedem Wechsel hoch — auch wenn dasselbe Bild noch einmal
  // drankommt. Der Fortschrittsbalken hängt daran und startet dadurch
  // zuverlässig neu, statt beim Klick auf das aktive Bild stehenzubleiben.
  const [runde, setRunde] = useState(0);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "16%"]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "-12%"]);
  const fade = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  const count = images.length;

  const gehZu = useCallback((next: number) => {
    setIndex(next);
    setRunde((r) => r + 1);
  }, []);

  useEffect(() => {
    if (reduced || paused || count < 2) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % count);
      setRunde((r) => r + 1);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [reduced, paused, count]);

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
            key={`${active?.id ?? "leer"}-${runde}`}
            className="absolute inset-0"
            initial={reduced ? false : { opacity: 0, scale: 1.07 }}
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
                className="object-cover"
                style={{ objectPosition: active.focal }}
              />
            )}
          </motion.div>
        </AnimatePresence>

        <div className="absolute inset-0" style={{ background: "rgba(11,11,12,0.44)" }} />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, var(--ink) 0%, rgba(11,11,12,0.88) 28%, rgba(11,11,12,0.32) 64%, rgba(11,11,12,0.62) 100%)",
          }}
        />
        {/* Zweiter Verlauf von links: gibt der Schrift überall Grund,
            auch wenn das Motiv gerade hell in die linke Hälfte ragt. */}
        <div
          className="absolute inset-0 hidden md:block"
          style={{
            background:
              "linear-gradient(to right, rgba(11,11,12,0.78) 0%, rgba(11,11,12,0.25) 46%, transparent 72%)",
          }}
        />
      </motion.div>

      {/* ── Aussage ── */}
      <motion.div
        className="shell relative z-10 pb-14 pt-32 md:pb-20"
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
          Beratung — von {STUDIO.artists} in der {STUDIO.street}. Jedes Motiv
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

        {count > 1 && (
          <motion.div {...rise(0.56)}>
            <SlideControls
              images={images}
              index={index}
              runde={runde}
              laufend={!reduced && !paused}
              onSelect={gehZu}
            />
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

// ─── Steuerung der Schau ─────────────────────────────────────────
// Vorschaubilder statt Punkten: man sieht, was als Nächstes kommt, und
// kann gezielt hinspringen. Unter dem aktiven Bild läuft der Balken bis
// zum nächsten Wechsel ab — genau die Sekunden, die `INTERVAL_MS`
// vorgibt, damit die Anzeige nicht bloß Dekoration ist.
function SlideControls({
  images,
  index,
  runde,
  laufend,
  onSelect,
}: {
  images: DisplayImage[];
  index: number;
  runde: number;
  laufend: boolean;
  onSelect: (next: number) => void;
}) {
  const active = images[index];

  return (
    <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-4">
      <ul className="flex items-end gap-2.5">
        {images.map((image, i) => {
          const istAktiv = i === index;
          return (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-label={`Bild ${i + 1} von ${images.length}: ${image.title}`}
                aria-current={istAktiv}
                className="group block"
              >
                <span
                  className="relative block overflow-hidden transition-all duration-500"
                  style={{
                    width: istAktiv ? "4rem" : "2.75rem",
                    aspectRatio: "1 / 1",
                    border: `1px solid ${istAktiv ? "var(--signal)" : "var(--ink-hair-strong)"}`,
                    opacity: istAktiv ? 1 : 0.55,
                  }}
                >
                  <Image
                    src={image.src}
                    alt=""
                    fill
                    placeholder="blur"
                    blurDataURL={image.blur}
                    sizes="64px"
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                    style={{ objectPosition: image.focal }}
                  />
                </span>

                {/* Ablaufbalken: nur unter dem aktiven Bild, und nur
                    solange die Schau wirklich läuft. Steht sie still
                    (reduzierte Bewegung, Tab im Hintergrund), bleibt der
                    Balken voll — eine ablaufende Anzeige ohne Ablauf
                    wäre gelogen. */}
                <span
                  aria-hidden
                  className="mt-1.5 block h-[3px] overflow-hidden transition-all duration-500"
                  style={{
                    width: istAktiv ? "4rem" : "2.75rem",
                    background: "var(--ink-hair-strong)",
                  }}
                >
                  {istAktiv && (
                    <motion.span
                      key={runde}
                      className="block h-full origin-left"
                      style={{ background: "var(--signal)" }}
                      initial={{ scaleX: laufend ? 0 : 1 }}
                      animate={{ scaleX: 1 }}
                      transition={
                        laufend
                          ? { duration: INTERVAL_MS / 1000, ease: "linear" }
                          : { duration: 0 }
                      }
                    />
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <span className="flex items-baseline gap-3 text-[0.7rem] uppercase tracking-[0.16em]">
        <span className="display tabular-nums" style={{ color: "var(--signal)" }}>
          {String(index + 1).padStart(2, "0")}
        </span>
        <span style={{ color: "var(--bone-dim)" }}>/ {String(images.length).padStart(2, "0")}</span>
        <span style={{ color: "var(--bone-soft)" }}>{active?.title}</span>
      </span>
    </div>
  );
}
