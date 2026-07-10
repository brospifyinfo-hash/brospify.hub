"use client";

// ─── Start-Fenster des Theme-Editors ────────────────────────────────
// Erscheint beim Betreten des Editors (solange kein Produkt gewählt ist):
// drei große Wege — „Eigenes Produkt" (Intake-Formular + echte AI),
// „Beispiel-Produkt" (inszenierte Live-Demo des Admin-Designs) und
// „Von 0 starten" (leerer Shop). Aufwendig animiert: gestaffelte Karten-
// Entrances, Glow-Hover, atmender Demo-Puls — gleiche Overlay-Mechanik
// wie die übrigen Editor-Overlays (AnimatePresence, z-[70]).

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PackagePlus, Play, LayoutTemplate, Sparkles, ArrowRight, Clock } from "lucide-react";
import { ACCENT } from "@/components/theme-editor/editor-ui";

export interface StartChoiceTexts {
  title: string;
  sub: string;
  ownTitle: string;
  ownSub: string;
  ownBadge: string;
  demoTitle: string;
  demoSub: string;
  demoBadge: string;
  demoNotReady: string;
  blankTitle: string;
  blankSub: string;
  skip: string;
  go: string;
}

export default function StartChoiceOverlay({
  open, demoReady, onOwn, onDemo, onBlank, onSkip, t,
}: {
  open: boolean;
  /** false = Admin hat noch kein Beispiel-Design hinterlegt → Karte gesperrt. */
  demoReady: boolean;
  onOwn: () => void;
  onDemo: () => void;
  onBlank: () => void;
  /** „Direkt zum klassischen Editor" (Produkt-Grid wie bisher). */
  onSkip: () => void;
  t: StartChoiceTexts;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Fokus-Management (Haus-Muster wie FullPreviewOverlay): initialer Fokus
  // auf die erste Karte, Tab bleibt im Dialog gefangen, ESC = „klassischer
  // Editor" (derselbe Ausweg wie der Link unten).
  useEffect(() => {
    if (!open) return;
    const focusables = () =>
      [...(panelRef.current?.querySelectorAll<HTMLElement>("button, [href]") || [])].filter(
        (el) => !el.hasAttribute("disabled"),
      );
    requestAnimationFrame(() => focusables()[0]?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onSkip();
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusables();
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!panelRef.current?.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onSkip]);

  const cards = [
    {
      key: "own",
      icon: PackagePlus,
      title: t.ownTitle,
      sub: t.ownSub,
      badge: t.ownBadge,
      badgeCls: "border-[#95BF47]/50 bg-[#95BF47]/15 text-[#cfe9a3]",
      disabled: false,
      onClick: onOwn,
      primary: true,
    },
    {
      key: "demo",
      icon: Play,
      title: t.demoTitle,
      sub: t.demoSub,
      badge: demoReady ? t.demoBadge : undefined,
      badgeCls: "border-sky-400/40 bg-sky-400/10 text-sky-200",
      disabled: !demoReady,
      onClick: onDemo,
      primary: false,
    },
    {
      key: "blank",
      icon: LayoutTemplate,
      title: t.blankTitle,
      sub: t.blankSub,
      badge: undefined,
      badgeCls: "",
      disabled: false,
      onClick: onBlank,
      primary: false,
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
        >
          {/* Backdrop — bewusst OHNE Klick-Close: der Nutzer soll einen Weg wählen
              (unten gibt es den „klassischen Editor"-Ausweg). */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />

          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 26, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={t.title}
            className="relative w-full max-w-3xl rounded-3xl border border-white/[0.1] bg-[#101014]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            {/* dezenter Glow oben */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 w-[560px] h-[240px] rounded-full opacity-25 blur-3xl"
              style={{ background: `radial-gradient(ellipse, ${ACCENT}, transparent 70%)` }}
            />

            <div className="relative p-6 sm:p-9">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.35 }}
                className="text-center mb-6 sm:mb-8"
              >
                <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] font-bold mb-2.5" style={{ color: ACCENT }}>
                  <Sparkles className="w-3.5 h-3.5" /> Theme-Editor
                </span>
                <h2 className="text-[22px] sm:text-[28px] font-bold tracking-tight text-white font-sf-display">{t.title}</h2>
                <p className="mt-1.5 text-[12.5px] sm:text-[13.5px] text-zinc-400 max-w-md mx-auto">{t.sub}</p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {cards.map((c, i) => (
                  <motion.button
                    key={c.key}
                    initial={{ opacity: 0, y: 22 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.16 + i * 0.09, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={c.disabled ? undefined : { y: -5, transition: { duration: 0.18 } }}
                    whileTap={c.disabled ? undefined : { scale: 0.98 }}
                    onClick={c.disabled ? undefined : c.onClick}
                    disabled={c.disabled}
                    className={`group relative text-left rounded-2xl border p-4 sm:p-5 min-h-[190px] flex flex-col transition ${
                      c.disabled
                        ? "border-white/[0.06] bg-white/[0.015] cursor-not-allowed"
                        : c.primary
                          ? "border-[#95BF47]/45 bg-[#95BF47]/[0.06] hover:border-[#95BF47]/80 hover:bg-[#95BF47]/[0.1] hover:shadow-[0_18px_50px_-18px_rgba(149,191,71,0.45)]"
                          : "border-white/[0.1] bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06] hover:shadow-[0_18px_50px_-20px_rgba(0,0,0,0.8)]"
                    }`}
                  >
                    {c.badge && (
                      <span className={`absolute top-3 right-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${c.badgeCls}`}>
                        {c.key === "demo" && (
                          <motion.span
                            aria-hidden
                            className="block w-1.5 h-1.5 rounded-full bg-sky-300"
                            animate={{ opacity: [0.4, 1, 0.4], scale: [0.85, 1.15, 0.85] }}
                            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                          />
                        )}
                        {c.badge}
                      </span>
                    )}
                    <span
                      className={`inline-flex w-11 h-11 rounded-xl items-center justify-center mb-3 border transition-transform duration-300 group-hover:scale-110 ${
                        c.disabled
                          ? "border-white/[0.06] bg-white/[0.03] text-zinc-600"
                          : c.primary
                            ? "border-[#95BF47]/40 bg-[#95BF47]/15 text-[#cfe9a3]"
                            : "border-white/12 bg-white/[0.06] text-zinc-200"
                      }`}
                    >
                      <c.icon className="w-5 h-5" />
                    </span>
                    <span className={`block text-[15px] font-bold leading-snug ${c.disabled ? "text-zinc-500" : "text-white"}`}>{c.title}</span>
                    <span className={`block mt-1.5 text-[11.5px] leading-relaxed flex-1 ${c.disabled ? "text-zinc-600" : "text-zinc-400"}`}>
                      {c.disabled ? (
                        <span className="inline-flex items-start gap-1.5">
                          <Clock className="w-3.5 h-3.5 shrink-0 mt-[1px]" /> {t.demoNotReady}
                        </span>
                      ) : (
                        c.sub
                      )}
                    </span>
                    {!c.disabled && (
                      <span className={`mt-3 inline-flex items-center gap-1 text-[11.5px] font-bold transition-all duration-200 group-hover:gap-2 ${c.primary ? "text-[#cfe9a3]" : "text-zinc-300"}`}>
                        {t.go} <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </motion.button>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55, duration: 0.35 }}
                className="text-center mt-6"
              >
                <button
                  onClick={onSkip}
                  className="text-[11.5px] text-zinc-500 hover:text-white underline underline-offset-4 transition"
                >
                  {t.skip}
                </button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
