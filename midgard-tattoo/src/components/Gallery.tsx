"use client";

// ─── Galerie ─────────────────────────────────────────────────────
// Masonry über CSS-Columns (siehe globals.css) — kein JavaScript
// rechnet hier Positionen aus, also gibt es auch nichts, was beim
// Drehen des Telefons springen könnte.
//
// Jede Kachel öffnet eine Leuchtkasten-Ansicht mit Pfeiltasten,
// Escape und Wischgesten. Der Fokus wandert beim Öffnen in den
// Dialog und beim Schließen zurück auf die Kachel — sonst landet
// man mit der Tastatur wieder ganz oben auf der Seite.

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { GALLERY, type GalleryPiece } from "@/lib/studio";
import { Reveal } from "./motion";

export function Gallery() {
  const [index, setIndex] = useState<number | null>(null);
  const reduced = useReducedMotion();
  // Merkt sich die auslösende Kachel, um den Fokus zurückzugeben.
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setIndex(null);
    triggerRef.current?.focus();
  }, []);

  const step = useCallback((delta: number) => {
    setIndex((current) => {
      if (current === null) return current;
      return (current + delta + GALLERY.length) % GALLERY.length;
    });
  }, []);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [index, close, step]);

  const active = index === null ? null : GALLERY[index];

  return (
    <section id="arbeiten" className="shell scroll-mt-24 py-8 md:py-10">
      <div className="masonry">
        {GALLERY.map((piece, i) => (
          <Reveal key={piece.slug} delay={(i % 3) * 0.08} as="figure">
            <GalleryTile
              piece={piece}
              onOpen={(el) => { triggerRef.current = el; setIndex(i); }}
            />
          </Reveal>
        ))}
      </div>

      <AnimatePresence>
        {active && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            style={{ background: "rgba(6,6,7,0.94)", backdropFilter: "blur(6px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            role="dialog"
            aria-modal="true"
            aria-label={active.title}
            onClick={close}
          >
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label="Schließen"
              className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full text-2xl"
              style={{ border: "1px solid var(--ink-hair-strong)", color: "var(--bone)" }}
            >
              ×
            </button>

            <motion.figure
              className="max-h-full w-full max-w-3xl"
              onClick={(e) => e.stopPropagation()}
              initial={reduced ? false : { scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduced ? undefined : { scale: 0.97, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              // Wischen zum Blättern — auf dem Handy die natürlichste Geste.
              drag={reduced ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={(_, info) => {
                if (info.offset.x < -80) step(1);
                if (info.offset.x > 80) step(-1);
              }}
            >
              <Image
                src={active.src}
                alt={active.alt}
                width={active.width}
                height={active.height}
                placeholder="blur"
                blurDataURL={active.blur}
                sizes="(max-width: 768px) 92vw, 768px"
                className="max-h-[74svh] w-full object-contain"
              />
              <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="display text-lg">{active.title}</span>
                <span style={{ color: "var(--bone-dim)" }}>
                  {active.style} · {active.placement}
                </span>
              </figcaption>
            </motion.figure>

            {/* Blätter-Knöpfe, auf dem Handy ausgeblendet (dort wird gewischt) */}
            {[-1, 1].map((delta) => (
              <button
                key={delta}
                type="button"
                onClick={(e) => { e.stopPropagation(); step(delta); }}
                aria-label={delta === 1 ? "Nächstes Motiv" : "Vorheriges Motiv"}
                className="absolute top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full text-xl md:flex"
                style={{
                  [delta === 1 ? "right" : "left"]: "1.5rem",
                  border: "1px solid var(--ink-hair-strong)",
                  color: "var(--bone)",
                }}
              >
                {delta === 1 ? "›" : "‹"}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ─── Einzelne Kachel ─────────────────────────────────────────────
function GalleryTile({
  piece,
  onOpen,
}: {
  piece: GalleryPiece;
  onOpen: (el: HTMLButtonElement) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => ref.current && onOpen(ref.current)}
      className="group relative block w-full overflow-hidden text-left"
      style={{ border: "1px solid var(--ink-hair)" }}
      aria-label={`${piece.title} vergrößern`}
    >
      <Image
        src={piece.src}
        alt={piece.alt}
        width={piece.width}
        height={piece.height}
        placeholder="blur"
        blurDataURL={piece.blur}
        sizes="(max-width: 639px) 46vw, (max-width: 1023px) 31vw, 23vw"
        className="w-full transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
      />
      {/* Abdunklung, damit die Bildunterschrift immer lesbar bleibt */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-500 group-hover:opacity-95"
        style={{ background: "linear-gradient(to top, rgba(8,8,9,0.92) 0%, transparent 48%)" }}
      />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 p-3 md:p-4">
        <span className="display block text-[0.95rem] leading-tight md:text-[1.05rem]">{piece.title}</span>
        <span
          className="mt-1 block translate-y-1 text-[0.65rem] uppercase tracking-[0.16em] opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100"
          style={{ color: "var(--signal)" }}
        >
          {piece.style} · {piece.placement}
        </span>
      </span>
    </button>
  );
}
