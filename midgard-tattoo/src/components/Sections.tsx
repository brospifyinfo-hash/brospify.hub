"use client";

// ─── Inhaltsabschnitte ───────────────────────────────────────────
// Handschrift (Stilrichtungen), Ablauf, häufige Fragen und Fußzeile.
// Alle vier sind reine Inhaltsflächen: sie holen ihre Texte aus
// src/lib/studio.ts, damit Änderungen an einer Stelle passieren.

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { FAQ, OPENING_HOURS, SPECIALTIES, STUDIO } from "@/lib/studio";
import { Reveal, SplitHeadline } from "./motion";

// ─── Handschrift ─────────────────────────────────────────────────
export function Specialties() {
  return (
    <section id="handschrift" className="shell scroll-mt-24 py-24 md:py-32">
      <Reveal className="mb-14 max-w-[22ch]">
        <p className="eyebrow mb-4">Handschrift</p>
        <h2 className="display display-l">
          <SplitHeadline text="Worauf hier" />{" "}
          <span style={{ color: "var(--signal)" }}><SplitHeadline text="spezialisiert" delay={0.12} /></span>{" "}
          <SplitHeadline text="wird" delay={0.24} />
        </h2>
      </Reveal>

      <div className="grid gap-px" style={{ background: "var(--ink-hair)" }}>
        {SPECIALTIES.map((item, i) => (
          <Reveal key={item.title} delay={i * 0.06} as="article">
            <div
              className="group grid gap-4 px-1 py-8 transition-colors duration-500 md:grid-cols-[auto_1fr_2fr] md:items-baseline md:gap-10 md:py-10"
              style={{ background: "var(--ink)" }}
            >
              <span
                className="display text-sm tabular-nums transition-colors duration-500 group-hover:text-[var(--signal)]"
                style={{ color: "var(--bone-dim)" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="display display-m leading-none transition-transform duration-500 md:group-hover:translate-x-2">
                {item.title}
              </h3>
              <p className="max-w-[52ch] text-[0.95rem] leading-relaxed" style={{ color: "var(--bone-soft)" }}>
                {item.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ─── Ablauf ──────────────────────────────────────────────────────
const STEPS = [
  { title: "Anfragen", body: "Termin im Kalender wählen, Formular ausfüllen. Der Termin ist ab diesem Moment für dich reserviert." },
  { title: "Besprechen", body: "Rückmeldung per Mail oder Telefon: Motiv, Größe, Stelle, Preis. Ehrlich, auch wenn eine Idee so nicht funktioniert." },
  { title: "Zeichnen", body: "Der Entwurf entsteht individuell. Wir gehen ihn gemeinsam durch, bis er sitzt — vorher wird nicht gestochen." },
  { title: "Stechen & Pflegen", body: "Am Termin selbst zählt nur noch Ruhe. Danach bekommst du die Pflegeanleitung schriftlich mit nach Hause." },
];

export function Process() {
  return (
    <section className="hair-top">
      <div className="shell py-24 md:py-32">
        <Reveal className="mb-14">
          <p className="eyebrow mb-4">Ablauf</p>
          <h2 className="display display-l max-w-[16ch]">Von der Idee zur fertigen Arbeit</h2>
        </Reveal>

        <ol className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.08} as="li">
              <div className="card h-full p-6">
                <span className="marker text-2xl" style={{ color: "var(--signal)" }}>0{i + 1}</span>
                <h3 className="display mt-4 text-xl">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
                  {step.body}
                </p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ─── Häufige Fragen ──────────────────────────────────────────────
export function FaqSection() {
  // Nur ein Eintrag gleichzeitig offen: das hält die Liste überschaubar
  // und man muss nicht scrollen, um die nächste Frage zu finden.
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="fragen" className="scroll-mt-24">
      <div className="shell max-w-[70ch] py-8 md:py-12">
        <Reveal>
          <ul>
            {FAQ.map((item, i) => {
              const isOpen = open === i;
              return (
                <li key={item.q} className="hair-top">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-${i}`}
                    className="flex w-full items-center justify-between gap-6 py-5 text-left"
                  >
                    <span className="text-[1.02rem] font-medium">{item.q}</span>
                    <motion.span
                      className="shrink-0 text-xl leading-none"
                      style={{ color: isOpen ? "var(--signal)" : "var(--bone-dim)" }}
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      +
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`faq-${i}`}
                        // `height: auto` animiert framer-motion korrekt aus,
                        // ohne dass wir die Höhe selbst messen müssten.
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        style={{ overflow: "hidden" }}
                      >
                        <p className="max-w-[62ch] pb-6 text-[0.95rem] leading-relaxed" style={{ color: "var(--bone-soft)" }}>
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Fußzeile ────────────────────────────────────────────────────
export function SiteFooter() {
  return (
    <footer className="hair-top">
      <div className="shell py-16 md:py-20">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="display text-3xl">{STUDIO.name.split(" ")[0]}</span>
              <span className="marker text-xl" style={{ color: "var(--signal)" }}>Tattoo</span>
            </div>
            <p className="mt-4 max-w-[34ch] text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
              {STUDIO.doorNote}
            </p>
            <Link href="/termin" className="btn btn-signal mt-6 h-11 px-5 text-[0.7rem]">
              Termin buchen
            </Link>
          </div>

          <div>
            <p className="eyebrow mb-4">Seiten</p>
            <ul className="space-y-2 text-sm" style={{ color: "var(--bone-soft)" }}>
              {[
                { href: "/", label: "Start" },
                { href: "/termin", label: "Termin buchen" },
                { href: "/arbeiten", label: "Arbeiten" },
                { href: "/preise", label: "Preise" },
                { href: "/studio", label: "Studio" },
              ].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="underline-offset-4 hover:underline">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="eyebrow mb-4">Mehr</p>
            <ul className="space-y-2 text-sm" style={{ color: "var(--bone-soft)" }}>
              {[
                { href: "/pflege", label: "Tattoo-Pflege" },
                { href: "/fragen", label: "Häufige Fragen" },
                { href: "/kontakt", label: "Kontakt & Anfahrt" },
                { href: "/impressum", label: "Impressum" },
                { href: "/datenschutz", label: "Datenschutz" },
              ].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="underline-offset-4 hover:underline">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="eyebrow mb-4">Kontakt</p>
            <ul className="space-y-2 text-sm" style={{ color: "var(--bone-soft)" }}>
              <li>{STUDIO.street}</li>
              <li>{STUDIO.zip} {STUDIO.city}</li>
              <li><a href={STUDIO.phoneHref} className="underline underline-offset-4">{STUDIO.phone}</a></li>
              <li><a href={`mailto:${STUDIO.email}`} className="underline underline-offset-4">{STUDIO.email}</a></li>
            </ul>
          </div>

          <div>
            <p className="eyebrow mb-4">Öffnungszeiten</p>
            <ul className="space-y-1.5 text-sm" style={{ color: "var(--bone-soft)" }}>
              {OPENING_HOURS.map((d) => (
                <li key={d.day} className="flex justify-between gap-4">
                  <span>{d.day.slice(0, 2)}</span>
                  <span style={{ color: d.hours ? "var(--bone-soft)" : "var(--bone-dim)" }}>
                    {d.hours ?? "geschlossen"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="hair-top mt-12 flex flex-wrap items-center justify-between gap-4 pt-6 text-xs" style={{ color: "var(--bone-dim)" }}>
          <span>© {new Date().getFullYear()} {STUDIO.name} · Artist: {STUDIO.artist}</span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Tätowierungen erst ab 18 Jahren. Ausweis mitbringen.</span>
            <Link
              href="/admin"
              className="underline-offset-4 hover:underline"
              style={{ color: "var(--bone-dim)" }}
            >
              Studio-Login
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
