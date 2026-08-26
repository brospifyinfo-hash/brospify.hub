"use client";

// ─── Vertrauensmerkmale ──────────────────────────────────────────
// Fünf Zusagen, die vor dem ersten Termin die Fragen beantworten, die
// niemand laut stellt: Ist das hier sauber? Bekomme ich etwas Eigenes?
// Kostet mich das Gespräch schon Geld?
//
// Was hier bewusst NICHT steht: Siegel, Sterne, Zertifikate. Die Texte
// sind Selbstauskunft über die Arbeitsweise (siehe TRUST_BADGES in
// src/lib/studio.ts) — nachprüfbar im Studio, nicht durch eine
// Prüfstelle. Ein erfundenes Siegel wäre schneller aufgeflogen, als es
// je genutzt hätte.
//
// Die Piktogramme sind Inline-SVG: kein zusätzlicher Request, kein
// Icon-Paket im Bundle, und sie nehmen die Textfarbe an.

import { motion, useReducedMotion } from "framer-motion";
import { TRUST_BADGES, type TrustBadge } from "@/lib/studio";
import { Reveal, RevealSection } from "./motion";

const EASE = [0.22, 1, 0.36, 1] as const;

// ─── Piktogramme ─────────────────────────────────────────────────
// `currentColor` und einheitliche Strichstärke — dadurch wirken sie
// wie aus einem Guss, obwohl jedes einzeln gezeichnet ist.
export function TrustIcon({ name, size = 26 }: { name: TrustBadge["icon"]; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "needle":
      return (
        <svg {...common}>
          <path d="M3 21l4.5-4.5" />
          <path d="M7.5 16.5L18 6a2.1 2.1 0 0 0-3-3L4.5 13.5z" />
          <path d="M13.5 7.5l3 3" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3l7 3v5.5c0 4.2-2.9 7.9-7 9.5-4.1-1.6-7-5.3-7-9.5V6z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "pencil":
      return (
        <svg {...common}>
          <path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z" />
          <path d="M14 6.5l3.5 3.5" />
          <path d="M4 20l4.5-1" />
        </svg>
      );
    case "chat":
      return (
        <svg {...common}>
          <path d="M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
          <path d="M8.5 10h7M8.5 13h4" />
        </svg>
      );
    case "id":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="11" r="2" />
          <path d="M6 16c.6-1.4 1.7-2 3-2s2.4.6 3 2" />
          <path d="M15 10h3.5M15 13h2.5" />
        </svg>
      );
  }
}

// ─── Kachelraster ────────────────────────────────────────────────
export function TrustBadges() {
  const reduced = useReducedMotion();

  return (
    <RevealSection className="hair-top" aria-labelledby="vertrauen">
      <div className="shell py-14 md:py-20">
        <Reveal className="mb-9 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <h2 id="vertrauen" className="eyebrow">
            Worauf du dich verlassen kannst
          </h2>
          <p className="text-sm" style={{ color: "var(--bone-dim)" }}>
            Keine Siegel — Zusagen, die im Studio nachprüfbar sind.
          </p>
        </Reveal>

        <ul className="grid gap-px sm:grid-cols-2 lg:grid-cols-5" style={{ background: "var(--ink-hair)" }}>
          {TRUST_BADGES.map((badge, i) => (
            <motion.li
              key={badge.title}
              className="group relative flex flex-col gap-3 p-5 md:p-6"
              style={{ background: "var(--ink)" }}
              initial={reduced ? false : { opacity: 0, y: 26 }}
              whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3, margin: "0px 0px -40px 0px" }}
              transition={{ duration: 0.7, delay: i * 0.08, ease: EASE }}
            >
              {/* Der gelbe Balken oben läuft beim Hover ein — die einzige
                  Farbe der Seite, sparsam eingesetzt. */}
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100"
                style={{ background: "var(--signal)" }}
              />
              <span
                className="transition-colors duration-500 group-hover:text-[var(--signal)]"
                style={{ color: "var(--bone-soft)" }}
              >
                <TrustIcon name={badge.icon} />
              </span>
              <span className="display text-[1.05rem] leading-tight">{badge.title}</span>
              <span className="text-[0.82rem] leading-relaxed" style={{ color: "var(--bone-soft)" }}>
                {badge.body}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
    </RevealSection>
  );
}

// ─── Kompakte Zeile ──────────────────────────────────────────────
// Für den Hero: drei kurze Zusagen statt einer Bilderleiste. Wer ganz
// oben auf der Seite landet, entscheidet in wenigen Sekunden, ob er hier
// bleibt — und dafür zählt „steril, eigener Entwurf, Beratung kostet
// nichts" mehr als fünf Briefmarken der Motive, die daneben ohnehin
// bildschirmhoch zu sehen sind.
export function TrustRow({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const reduced = useReducedMotion();
  const picks = TRUST_BADGES.filter((b) => b.inHero);

  return (
    <ul className={`grid grid-cols-1 gap-y-3 sm:grid-cols-3 sm:gap-x-4 ${className ?? ""}`} style={style}>
      {picks.map((badge, i) => (
        <motion.li
          key={badge.title}
          className="flex items-center gap-2 whitespace-nowrap"
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.62 + i * 0.08, ease: EASE }}
        >
          <span style={{ color: "var(--signal)" }}>
            <TrustIcon name={badge.icon} size={17} />
          </span>
          <span
            className="text-[0.66rem] uppercase tracking-[0.13em] md:text-[0.72rem]"
            style={{ color: "var(--bone-soft)" }}
          >
            {badge.heroTitle ?? badge.title}
          </span>
        </motion.li>
      ))}
    </ul>
  );
}
