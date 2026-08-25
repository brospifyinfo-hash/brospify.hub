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
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useRef, type ReactNode } from "react";

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
  const words = text.split(" ");

  if (reduced) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className} aria-label={text}>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          aria-hidden
          style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom" }}
        >
          <motion.span
            style={{ display: "inline-block" }}
            initial={{ y: "108%" }}
            whileInView={{ y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.85, delay: delay + i * 0.07, ease: EASE }}
          >
            {word}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
