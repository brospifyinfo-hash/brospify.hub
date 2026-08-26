"use client";

// ─── Wiederkehrende Bausteine ────────────────────────────────────
// Was auf mehr als einer Seite vorkommt, steht hier — damit die Seiten
// als Familie zusammenhalten und nicht jede ihren eigenen Kopf erfindet.

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export { Parallax, Reveal, RevealSection, SplitHeadline } from "./motion";
import { Reveal } from "./motion";

const EASE = [0.22, 1, 0.36, 1] as const;

// ─── Abschnittskopf ──────────────────────────────────────────────
// Rubrik, Titel, optionaler Nebentext und optionaler Weg-Knopf. Die
// laufende Nummer ist keine Deko: sie zeigt, dass die Startseite eine
// geordnete Folge von Kapiteln ist, kein Haufen Kästen.
export function SectionHead({
  index,
  eyebrow,
  title,
  lead,
  action,
  className,
}: {
  index?: number;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Reveal className={`mb-10 md:mb-12 ${className ?? ""}`}>
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="min-w-0">
          <span className="flex items-center gap-3">
            {index !== undefined && (
              <span
                className="display text-[0.8rem] tabular-nums"
                style={{ color: "var(--signal)" }}
              >
                {String(index).padStart(2, "0")}
              </span>
            )}
            <span className="eyebrow">{eyebrow}</span>
            {/* Haarlinie, die den Kopf mit dem Rand verbindet — nimmt der
                Überschrift das Freischwebende. */}
            <span
              aria-hidden
              className="hidden h-px w-16 sm:block"
              style={{ background: "var(--ink-hair-strong)" }}
            />
          </span>
          <h2 className="display display-m mt-4 max-w-[20ch]" style={{ textWrap: "balance" }}>
            {title}
          </h2>
        </div>

        {lead && (
          <p
            className="max-w-[42ch] text-[0.95rem] leading-relaxed"
            style={{ color: "var(--bone-soft)" }}
          >
            {lead}
          </p>
        )}
        {action}
      </div>
    </Reveal>
  );
}

// ─── Gestaffelte Einblendung ─────────────────────────────────────
// Für Listen: die Kinder laufen nacheinander ein statt alle zugleich.
// Wirkt geordnet statt hektisch — und zeigt beiläufig, dass es mehrere
// Dinge sind.
export function Stagger({
  children,
  className,
  step = 0.07,
}: {
  children: ReactNode[];
  className?: string;
  step?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <div className={className}>
      {children.map((child, i) => (
        <motion.div
          key={i}
          initial={reduced ? false : { opacity: 0, y: 24 }}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2, margin: "0px 0px -60px 0px" }}
          transition={{ duration: 0.7, delay: i * step, ease: EASE }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}

// ─── Trennlinie mit Zeichen ──────────────────────────────────────
export function Rule({ label }: { label?: string }) {
  return (
    <Reveal className="flex items-center gap-4 py-2">
      <span aria-hidden className="h-px flex-1" style={{ background: "var(--ink-hair)" }} />
      {label && (
        <span className="eyebrow shrink-0">{label}</span>
      )}
      <span aria-hidden className="h-px flex-1" style={{ background: "var(--ink-hair)" }} />
    </Reveal>
  );
}

// ─── Sterne ──────────────────────────────────────────────────────
/** Die Zahl steht zusätzlich als Text da — Sterne allein sind für
 *  Screenreader nichts als eine Reihe Symbole. */
export function Stars({ rating, size = "1rem" }: { rating: number; size?: string }) {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="flex items-center gap-1" role="img" aria-label={`${full} von 5 Sternen`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            fontSize: size,
            lineHeight: 1,
            color: i < full ? "var(--signal)" : "var(--ink-hair-strong)",
          }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

const MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/** "2026-03-14" → "März 2026". Bei Bewertungen reicht der Monat; ein
 *  tagesgenaues Datum lädt nur dazu ein, Kunden zuzuordnen. */
export function formatDateShortDe(date: string): string {
  const [year, month] = date.split("-").map(Number);
  if (!year || !month) return date;
  return `${MONATE[month - 1]} ${year}`;
}
