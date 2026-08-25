"use client";

// ─── Kopfzeile ───────────────────────────────────────────────────
// Echte Navigation über mehrere Seiten, nicht mehr Ankerlinks auf einer.
// Die aktive Seite ist markiert, und „Termin buchen" steht als einziger
// gelber Knopf immer sichtbar — auch auf dem Handy, weil das die
// Handlung ist, für die Leute überhaupt herkommen.

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { STUDIO } from "@/lib/studio";
import { useScrollProgress } from "./motion";

// Vier Punkte plus Knopf — mehr trägt eine Leiste nicht, ohne dass sie
// zur Linkliste wird. Alles Weitere steht in der Fußzeile.
const NAV = [
  { href: "/arbeiten", label: "Arbeiten" },
  { href: "/preise", label: "Preise" },
  { href: "/studio", label: "Studio" },
  { href: "/fragen", label: "Fragen" },
];

// Auf dem Handy ist Platz — dort zeigt die Schublade alles.
const NAV_MOBIL = [
  { href: "/", label: "Start" },
  ...NAV,
  { href: "/pflege", label: "Pflege" },
  { href: "/kontakt", label: "Kontakt" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();
  const progress = useScrollProgress();
  const pathname = usePathname();

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 40));

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Auf der Startseite liegt die Kopfzeile über dem dunklen Kopfbereich
  // und darf transparent bleiben; auf allen anderen Seiten beginnt der
  // Inhalt direkt darunter und braucht die getönte Leiste sofort.
  const onHome = pathname === "/";
  const solid = scrolled || !onHome;

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-50 transition-colors duration-500"
        style={{
          background: solid ? "rgba(11,11,12,0.86)" : "transparent",
          backdropFilter: solid ? "blur(14px)" : "none",
          borderBottom: `1px solid ${solid ? "var(--ink-hair)" : "transparent"}`,
        }}
      >
        <div className="shell flex h-[68px] items-center justify-between gap-4 md:h-[76px]">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="display text-[1.35rem] leading-none tracking-[0.02em] md:text-[1.6rem]">
              {STUDIO.name.split(" ")[0]}
            </span>
            <span className="marker text-[1.05rem] leading-none" style={{ color: "var(--signal)" }}>
              Tattoo
            </span>
          </Link>

          <nav className="hidden items-center gap-9 md:flex">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="group relative text-[0.8rem] font-medium uppercase tracking-[0.16em] transition-colors"
                  style={{ color: active ? "var(--bone)" : "var(--bone-soft)" }}
                >
                  {item.label}
                  <span
                    className={`absolute -bottom-1.5 left-0 h-px w-full origin-left transition-transform duration-300 ${
                      active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                    }`}
                    style={{ background: "var(--signal)" }}
                  />
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/termin" className="btn btn-signal h-11 px-4 text-[0.7rem] md:h-12 md:px-6 md:text-[0.75rem]">
              Termin buchen
            </Link>
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
              {NAV_MOBIL.map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.07 + i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="display block py-2 text-[1.6rem] leading-tight"
                    style={{ color: pathname === item.href ? "var(--signal)" : "var(--bone)" }}
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.34, duration: 0.4 }}
              >
                <Link href="/termin" onClick={() => setOpen(false)} className="btn btn-signal mt-6">
                  Termin buchen
                </Link>
              </motion.div>
              <motion.a
                href={STUDIO.phoneHref}
                className="mt-5 text-sm"
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
