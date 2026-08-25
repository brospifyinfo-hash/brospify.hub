"use client";

// ─── Kopfzeile ───────────────────────────────────────────────────
// Über dem Hero liegt sie transparent auf dem Bild; sobald gescrollt
// wird, legt sie sich als getönte Leiste darüber. Auf dem Handy
// öffnet der Menü-Knopf eine Vollbild-Schublade — Zielgrößen für den
// Daumen statt Miniatur-Links in einer Zeile.

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { STUDIO } from "@/lib/studio";
import { useScrollProgress } from "./motion";

const NAV = [
  { href: "#arbeiten", label: "Arbeiten" },
  { href: "#handschrift", label: "Handschrift" },
  { href: "#studio", label: "Studio" },
  { href: "#fragen", label: "Fragen" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();
  const progress = useScrollProgress();

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 40));

  // Hintergrund darf nicht mitscrollen, solange die Schublade offen ist.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  // Escape schließt die Schublade — Tastaturbedienung kostet nichts.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-50 transition-colors duration-500"
        style={{
          background: scrolled ? "rgba(11,11,12,0.82)" : "transparent",
          backdropFilter: scrolled ? "blur(14px)" : "none",
          borderBottom: `1px solid ${scrolled ? "var(--ink-hair)" : "transparent"}`,
        }}
      >
        <div className="shell flex h-[68px] items-center justify-between gap-4 md:h-[76px]">
          <Link href="/" className="flex items-baseline gap-2" onClick={() => setOpen(false)}>
            <span className="display text-[1.35rem] leading-none tracking-[0.02em] md:text-[1.6rem]">
              {STUDIO.name.split(" ")[0]}
            </span>
            <span className="marker text-[1.05rem] leading-none" style={{ color: "var(--signal)" }}>
              Tattoo
            </span>
          </Link>

          <nav className="hidden items-center gap-9 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="group relative text-[0.8rem] font-medium uppercase tracking-[0.16em] transition-colors"
                style={{ color: "var(--bone-soft)" }}
              >
                {item.label}
                {/* Unterstrich wächst von links — reines Transform, kein Layout. */}
                <span
                  className="absolute -bottom-1.5 left-0 h-px w-full origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
                  style={{ background: "var(--signal)" }}
                />
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a href="#termin" className="btn btn-signal hidden md:inline-flex">
              Termin anfragen
            </a>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? "Menü schließen" : "Menü öffnen"}
              className="flex h-11 w-11 flex-col items-center justify-center gap-[5px] md:hidden"
            >
              <motion.span
                className="block h-[1.5px] w-6 origin-center"
                style={{ background: "var(--bone)" }}
                animate={open ? { rotate: 45, y: 3.25 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.3 }}
              />
              <motion.span
                className="block h-[1.5px] w-6 origin-center"
                style={{ background: "var(--bone)" }}
                animate={open ? { rotate: -45, y: -3.25 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.3 }}
              />
            </button>
          </div>
        </div>

        {/* Lesefortschritt — ein Haarstrich, der die Seitenlänge greifbar macht. */}
        <motion.div
          className="h-[2px] origin-left"
          style={{ background: "var(--signal)", scaleX: progress }}
        />
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 flex flex-col justify-center md:hidden"
            style={{ background: "var(--ink)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
          >
            <nav className="shell flex flex-col gap-1">
              {NAV.map((item, i) => (
                <motion.a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="display display-m py-3"
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.07 + i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  {item.label}
                </motion.a>
              ))}
              <motion.a
                href="#termin"
                onClick={() => setOpen(false)}
                className="btn btn-signal mt-8 self-start"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.34, duration: 0.4 }}
              >
                Termin anfragen
              </motion.a>
              <motion.a
                href={STUDIO.phoneHref}
                className="mt-6 text-sm"
                style={{ color: "var(--bone-dim)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.42 }}
              >
                Lieber anrufen? {STUDIO.phone}
              </motion.a>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
