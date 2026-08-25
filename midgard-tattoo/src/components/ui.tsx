"use client";

// ─── Kleine, überall gebrauchte Bausteine ────────────────────────
// Reveal wird aus motion.tsx durchgereicht, damit Komponenten nur eine
// Adresse für „die üblichen Kleinteile" kennen müssen.

export { Reveal } from "./motion";

/** Sternebewertung. Die Zahl steht zusätzlich als Text da — Sterne
 *  allein sind für Screenreader nichts als eine Reihe Symbole. */
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
