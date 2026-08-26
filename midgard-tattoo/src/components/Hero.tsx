"use client";

// ─── Hero mit Slideshow ──────────────────────────────────────────
// Bildschirmfüllender Auftakt. Die Motive wechseln von selbst alle
// sieben Sekunden; welche gezeigt werden, bestimmt der Inhaber im
// Dashboard über den Haken „Im Hero zeigen".
//
// Die tragende Entscheidung: das Motiv liegt auf breiten Schirmen NICHT
// als Hintergrund hinter dem Text. Tattoo-Aufnahmen sind hochkant, ein
// 16:9-Ausschnitt schneidet davon zwei Drittel weg — vom Löwen bleibt
// ein Auge übrig, und die beste Arbeit sieht aus wie eine Textur.
//
// Stattdessen ist der Hero geteilt: links der Text, rechts eine Fläche
// über die volle Höhe des Bildschirms, die bis an den rechten Rand
// läuft. Sie ist rund 46 % breit und 100 svh hoch — ein Verhältnis von
// etwa 3:4, also praktisch das der Aufnahmen selbst. Das Bild wird damit
// so groß wie irgend möglich gezeigt UND fast nichts davon
// weggeschnitten. Der Text sitzt trotzdem exakt auf der Rasterkante der
// übrigen Seite; dafür sorgt `.shell-left`.
//
// Den Grund hinter allem macht dieselbe Aufnahme als 12-px-Version aus
// dem Blur-Platzhalter, weich hochskaliert: kostet keinen einzigen
// zusätzlichen Ladevorgang und gibt der Fläche die Farbe des Motivs.
//
// Auf dem Handy ist der Bildschirm selbst hochkant — dort passt die
// Aufnahme, also läuft sie wie gehabt bildschirmfüllend hinter dem Text.
//
// Weitere Regeln:
//  • Jedes Motiv bringt über `focal` seinen Bildausschnitt mit.
//  • Der Fortschritt ist sichtbar: unter dem aktiven Vorschaubild läuft
//    ein Balken ab. Wer eine Schau nicht steuern kann, muss wenigstens
//    sehen, wann sie weiterspringt.
//  • `prefers-reduced-motion` hält alles an und zeigt das erste Bild.

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
  const backdropY = useTransform(scrollYProgress, [0, 1], ["0%", "14%"]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "-10%"]);
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
      className="relative flex min-h-[100svh] flex-col justify-end lg:justify-center"
      style={{ isolation: "isolate" }}
    >
      {/* ── Hintergrund ── */}
      <motion.div
        aria-hidden
        className="absolute inset-0 overflow-hidden"
        style={reduced ? undefined : { y: backdropY }}
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={`${active?.id ?? "leer"}-${runde}`}
            className="absolute inset-0"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.3 }}
          >
            {active && (
              <>
                {/* Handy: das Motiv selbst, der Bildschirm ist hochkant. */}
                <Image
                  src={active.src}
                  alt=""
                  fill
                  priority={index === 0}
                  placeholder="blur"
                  blurDataURL={active.blur}
                  sizes="100vw"
                  className="object-cover lg:hidden"
                  style={{ objectPosition: active.focal }}
                />
                {/* Breite Schirme: nur Farbe und Stimmung. Das ist der
                    12-px-Platzhalter, hochskaliert — deshalb weich, ohne
                    einen Filter zu berechnen oder etwas nachzuladen. */}
                <motion.div
                  className="absolute inset-0 hidden lg:block"
                  style={{
                    backgroundImage: `url(${active.blur})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                  initial={reduced ? false : { scale: 1.12 }}
                  animate={{ scale: 1.04 }}
                  transition={{ duration: 9, ease: "linear" }}
                />
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Auf dem Handy liegt der Text auf dem Motiv und braucht die
            volle Abdunklung. Auf breiten Schirmen ist der Hintergrund
            ohnehin nur Farbe — dort darf man sie auch sehen. */}
        <div className="absolute inset-0 lg:hidden" style={{ background: "rgba(11,11,12,0.46)" }} />
        <div className="absolute inset-0 hidden lg:block" style={{ background: "rgba(11,11,12,0.26)" }} />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, var(--ink) 0%, rgba(11,11,12,0.88) 26%, rgba(11,11,12,0.34) 64%, rgba(11,11,12,0.62) 100%)",
          }}
        />
        <div
          className="absolute inset-0 hidden md:block"
          style={{
            background:
              "linear-gradient(to right, rgba(11,11,12,0.82) 0%, rgba(11,11,12,0.42) 48%, rgba(11,11,12,0.30) 100%)",
          }}
        />
      </motion.div>

      {/* ── Inhalt ── */}
      <div className="shell-left relative z-10 grid min-h-[100svh] items-center pr-5 lg:grid-cols-[1fr_46%] lg:pr-0">
        <motion.div
          className="w-full pb-14 pt-32 md:pb-20 lg:py-28 lg:pr-14"
          style={reduced ? undefined : { y: textY }}
        >
          <div className="mx-auto w-full max-w-[var(--shell-max)] lg:mx-0 lg:max-w-[34rem]">
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

            <h1 className="display display-hero">
              <motion.span className="block" {...rise(0.16)}>Tinte,</motion.span>
              <motion.span className="block" style={{ color: "var(--skin)" }} {...rise(0.26)}>
                die bleibt
              </motion.span>
            </h1>

            <motion.p
              className="mt-7 max-w-[44ch] text-[1.02rem] leading-relaxed md:text-[1.1rem]"
              style={{ color: "var(--bone-soft)" }}
              {...rise(0.38)}
            >
              Schwarz-Grau-Arbeiten mit weichen Verläufen, feine Linien und ehrliche
              Beratung — von {STUDIO.artists} in der {STUDIO.street}. Jedes Motiv
              entsteht für genau eine Person.
            </motion.p>

            <motion.div className="mt-9 flex flex-wrap items-center gap-3" {...rise(0.48)}>
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
          </div>
        </motion.div>

        {/* ── Das Motiv, bildschirmhoch ── */}
        {active && <SlidePanel image={active} runde={runde} reduced={Boolean(reduced)} />}
      </div>

      <motion.div
        aria-hidden
        className="pointer-events-none absolute bottom-5 left-0 right-0 z-10 hidden justify-center md:flex lg:right-[46%]"
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

// ─── Die Bildfläche ──────────────────────────────────────────────
// Volle Höhe, bis an den rechten Rand. Der Ausschnitt ist damit rund
// 3:4 — praktisch das Format, in dem die Aufnahmen gemacht wurden, also
// bleibt fast alles stehen. `focal` entscheidet, welcher Rest wegfällt.
function SlidePanel({
  image,
  runde,
  reduced,
}: {
  image: DisplayImage;
  runde: number;
  reduced: boolean;
}) {
  return (
    <figure className="relative hidden self-stretch overflow-hidden lg:block">
      <AnimatePresence initial={false}>
        <motion.div
          key={`${image.id}-${runde}`}
          className="absolute inset-0"
          initial={reduced ? false : { opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 1.2 }, scale: { duration: 9, ease: "linear" } }}
        >
          <Image
            src={image.src}
            alt={image.alt}
            fill
            priority
            placeholder="blur"
            blurDataURL={image.blur}
            sizes="(max-width: 1023px) 0px, 46vw"
            className="object-cover"
            style={{ objectPosition: image.focal }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Weiche linke Kante: ohne sie klebt die Fläche wie ein
          aufgeklebtes Rechteck neben dem Text. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(to right, var(--ink) 0%, rgba(11,11,12,0.35) 12%, transparent 30%)" }}
      />
      {/* Oben abdunkeln, damit die Navigation über dem Bild lesbar
          bleibt; unten, damit es die Bildunterschrift trägt. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(11,11,12,0.62) 0%, transparent 16%, transparent 62%, rgba(8,8,9,0.9) 100%)",
        }}
      />

      <figcaption className="absolute inset-x-0 bottom-0 flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1 px-8 pb-10 xl:px-10">
        <span className="display text-[1.4rem] leading-none xl:text-[1.7rem]">{image.title}</span>
        <span className="text-[0.68rem] uppercase tracking-[0.16em]" style={{ color: "var(--bone-soft)" }}>
          {image.style} · {image.placement}
        </span>
      </figcaption>
    </figure>
  );
}

// ─── Steuerung der Schau ─────────────────────────────────────────
// Vorschaubilder in einer Größe, in der man das Motiv erkennt — Punkte
// oder Briefmarken sagen nichts darüber, was als Nächstes kommt. Unter
// dem aktiven Bild läuft der Balken bis zum nächsten Wechsel ab, genau
// die Sekunden, die `INTERVAL_MS` vorgibt.
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
    <div className="mt-10">
      <ul className="flex items-end gap-2.5 md:gap-3">
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
                {/* Breite über Klassen statt Inline-Stil: auf dem Handy
                    müssen alle Vorschaubilder nebeneinander in eine Zeile
                    passen, sonst bricht die letzte allein um. */}
                <span
                  className={`relative block overflow-hidden transition-all duration-500 ${
                    istAktiv ? "w-[4.25rem] md:w-[6rem]" : "w-[3.5rem] md:w-[4.75rem]"
                  }`}
                  style={{
                    aspectRatio: "4 / 5",
                    border: `1px solid ${istAktiv ? "var(--signal)" : "var(--ink-hair-strong)"}`,
                    opacity: istAktiv ? 1 : 0.6,
                  }}
                >
                  <Image
                    src={image.src}
                    alt=""
                    fill
                    placeholder="blur"
                    blurDataURL={image.blur}
                    sizes="96px"
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
                  className={`mt-2 block h-[3px] overflow-hidden transition-all duration-500 ${
                    istAktiv ? "w-[4.25rem] md:w-[6rem]" : "w-[3.5rem] md:w-[4.75rem]"
                  }`}
                  style={{ background: "var(--ink-hair-strong)" }}
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

      {/* Auf dem Handy steht der Titel hier, weil es dort keinen Rahmen
          mit Bildunterschrift gibt. */}
      <span className="mt-4 flex items-baseline gap-3 text-[0.7rem] uppercase tracking-[0.16em]">
        <span className="display tabular-nums" style={{ color: "var(--signal)" }}>
          {String(index + 1).padStart(2, "0")}
        </span>
        <span style={{ color: "var(--bone-dim)" }}>/ {String(images.length).padStart(2, "0")}</span>
        <span className="lg:hidden" style={{ color: "var(--bone-soft)" }}>{active?.title}</span>
      </span>
    </div>
  );
}
