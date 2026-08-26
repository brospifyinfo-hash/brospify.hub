"use client";

// ─── Bewegungs-Bausteine ─────────────────────────────────────────
// Drei Primitive, aus denen die gesamte Seite ihre Animationen bezieht.
// Zwei Regeln gelten überall:
//
//  1. Animiert werden ausschließlich `transform` und `opacity`. Beide
//     laufen im Compositor, lösen also weder Layout noch Repaint aus —
//     das ist der Unterschied zwischen 60 fps und einer ruckelnden
//     Seite auf einem drei Jahre alten Android.
//  2. `prefers-reduced-motion` schaltet jede Bewegung ab und zeigt den
//     Endzustand sofort. Nicht Kür, sondern Pflicht: für Menschen mit
//     vestibulären Beschwerden ist Parallax-Scrolling körperlich
//     unangenehm.

import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Fragment, useRef, type ReactNode } from "react";

// Eine ruhige, leicht bremsende Kurve — nichts federt oder wippt.
const EASE = [0.22, 1, 0.36, 1] as const;

// ─── Reveal ──────────────────────────────────────────────────────
// Einblenden beim Hereinscrollen. `once` verhindert das nervige
// Wieder-Ausblenden beim Zurückscrollen, `amount: 0.25` löst aus,
// sobald ein Viertel des Elements sichtbar ist.
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article" | "header" | "figure";
}) {
  const reduced = useReducedMotion();
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.75, delay, ease: EASE }}
    >
      {children}
    </Tag>
  );
}

// ─── Parallax ────────────────────────────────────────────────────
// Verschiebt den Inhalt langsamer als den Scroll. `distance` ist der
// gesamte Weg in Pixeln über die volle Sichtbarkeit des Elements —
// mehr als ~120 px wirkt schnell wie ein Fehler statt wie Tiefe.
export function Parallax({
  children,
  distance = 80,
  className,
}: {
  children: ReactNode;
  distance?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  // Die Feder glättet das Scroll-Signal; ohne sie klebt die Bewegung
  // hart am Scrollrad und wirkt nervös.
  const smooth = useSpring(scrollYProgress, { stiffness: 90, damping: 26, mass: 0.4 });
  const y = useTransform(smooth, [0, 1], [distance / 2, -distance / 2]);

  return (
    <div ref={ref} className={className}>
      <motion.div style={reduced ? undefined : { y }}>{children}</motion.div>
    </div>
  );
}

/** Fortschritt des Seiten-Scrolls, 0…1 — für die Fortschrittsleiste. */
export function useScrollProgress(): MotionValue<number> {
  const { scrollYProgress } = useScroll();
  return useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
}

// ─── Wort-für-Wort-Überschrift ───────────────────────────────────
// Jedes Wort steigt einzeln aus einer Maske auf. Der Text bleibt ein
// zusammenhängender String im DOM (`aria-label`), damit Screenreader
// die Überschrift am Stück vorlesen statt Wort für Wort.
//
// Wichtig: der Auslöser hängt am äußeren Element, nicht an den Wörtern.
// Ein `whileInView` direkt am Wort feuert nie — im Startzustand liegt
// das Wort vollständig außerhalb seiner Maske, und ein
// IntersectionObserver rechnet die Überdeckung durch `overflow: hidden`
// mit ein. Die Schnittmenge bleibt 0, die Überschrift damit unsichtbar.
export function SplitHeadline({
  text,
  className,
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const sichtbar = useInView(ref, { once: true, amount: 0.35 });
  const words = text.split(" ");

  if (reduced) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span ref={ref} className={className} aria-label={text}>
      {words.map((word, i) => (
        // Das Leerzeichen steht ZWISCHEN den Masken, nicht darin: am Rand
        // eines inline-block fällt es weg, und aus „Termin buchen" würde
        // „Terminbuchen".
        <Fragment key={`${word}-${i}`}>
          <span
            aria-hidden
            // Die Maske bekommt oben und unten Luft. Ohne sie schneidet
            // sie bei `line-height: 0.88` genau das weg, was über die
            // Versalhöhe hinausragt: unten Komma und Unterlängen („Ein
            // Platz," verliert sein Komma), oben die Punkte auf Ä, Ö, Ü
            // („Häufige Fragen" wird zu „Haufige Fragen"). Die negativen
            // Außenabstände nehmen die Luft aus dem Layout wieder heraus,
            // damit sich die Zeilenhöhe nicht ändert. Der Startversatz ist
            // größer als die Maske hoch ist, damit durch die Luft unten
            // kein Buchstabenrand hervorlugt.
            style={{
              display: "inline-block",
              overflow: "hidden",
              verticalAlign: "bottom",
              paddingTop: "0.16em",
              marginTop: "-0.16em",
              paddingBottom: "0.18em",
              marginBottom: "-0.18em",
            }}
          >
            <motion.span
              style={{ display: "inline-block" }}
              initial={{ y: "135%" }}
              animate={sichtbar ? { y: 0 } : { y: "135%" }}
              transition={{ duration: 0.85, delay: delay + i * 0.07, ease: EASE }}
            >
              {word}
            </motion.span>
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </span>
  );
}
