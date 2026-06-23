"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Dices,
  Clapperboard,
  Mail,
  Camera,
  Scissors,
  ImageUp,
  Coins,
  UserCircle,
  Rocket,
  ChevronRight,
  ChevronLeft,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

// Interaktive Einführung beim Erstlogin: ein echter SPOTLIGHT, der die
// einzelnen Buttons/Tools auf der Home-Seite nacheinander hervorhebt,
// dorthin scrollt und jeweils erklärt, was das Tool macht.
//
// Die Anker sind data-tour-Attribute an den echten Elementen
// (app/home/page.tsx + components/Navigation.tsx). Findet ein Schritt
// sein Ziel nicht (z. B. weil das Element auf diesem Breakpoint nicht
// sichtbar ist), fällt er sauber auf eine zentrierte Karte zurück.

interface TourStep {
  /** CSS-Selektor des hervorzuhebenden Elements. Leer = zentrierte Karte. */
  target: string;
  icon: typeof Sparkles;
  color: string;
  titleKey: string;
  descKey: string;
}

const STEPS: TourStep[] = [
  { target: "", icon: Sparkles, color: "#95BF47", titleKey: "welcome", descKey: "welcomeDesc" },
  { target: "[data-tour='hero-drop']", icon: Dices, color: "#95BF47", titleKey: "heroDrop", descKey: "heroDropDesc" },
  { target: "[data-tour='tool-video-scout']", icon: Clapperboard, color: "#EC4899", titleKey: "toolVideo", descKey: "toolVideoDesc" },
  { target: "[data-tour='tool-email-templates']", icon: Mail, color: "#F43F5E", titleKey: "toolEmail", descKey: "toolEmailDesc" },
  { target: "[data-tour='tool-ai-studio']", icon: Camera, color: "#A855F7", titleKey: "toolStudio", descKey: "toolStudioDesc" },
  { target: "[data-tour='tool-background-remover']", icon: Scissors, color: "#F59E0B", titleKey: "toolBg", descKey: "toolBgDesc" },
  { target: "[data-tour='tool-hybrid-upscaler']", icon: ImageUp, color: "#06B6D4", titleKey: "toolUpscale", descKey: "toolUpscaleDesc" },
  { target: "[data-tour='credits']", icon: Coins, color: "#FACC15", titleKey: "credits", descKey: "creditsDesc" },
  { target: "[data-tour='account']", icon: UserCircle, color: "#818CF8", titleKey: "account", descKey: "accountDesc" },
  { target: "", icon: Rocket, color: "#95BF47", titleKey: "finishTitle", descKey: "finishDesc" },
];

const PAD = 8; // Spotlight-Polster um das Element

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function findVisible(selector: string): HTMLElement | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return (
    els.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }) || null
  );
}

interface Props {
  onComplete: () => void;
}

export default function GuidedTour({ onComplete }: Props) {
  const { t } = useI18n();
  const tourTexts = t.tour as Record<string, string>;
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [vp, setVp] = useState({ w: 1280, h: 800 });

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const next = useCallback(() => {
    if (isLast) onComplete();
    else setIndex((i) => i + 1);
  }, [isLast, onComplete]);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Viewport-Maße (für Karten-Positionierung + SVG-Größe).
  useEffect(() => {
    const update = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Pro Schritt: Ziel finden, hinscrollen, Position verfolgen.
  useEffect(() => {
    if (!step.target) {
      setRect(null);
      return;
    }
    const el = findVisible(step.target);
    if (!el) {
      setRect(null);
      return;
    }

    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });

    const measure = () => {
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top - PAD,
        left: r.left - PAD,
        width: r.width + PAD * 2,
        height: r.height + PAD * 2,
      });
    };

    // Während des Smooth-Scrolls ~700ms lang mitmessen, danach auf
    // Scroll/Resize live nachführen.
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      measure();
      if (performance.now() - start < 700) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [index, step.target]);

  // Tastatur: Pfeile + Enter weiter, Esc beendet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      else if (e.key === "ArrowLeft") back();
      else if (e.key === "Escape") onComplete();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, onComplete]);

  // Karten-Position relativ zum hervorgehobenen Element berechnen.
  const cardW = Math.min(380, vp.w - 24);
  let cardStyle: React.CSSProperties;
  if (!rect) {
    cardStyle = {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: cardW,
    };
  } else {
    const left = clamp(rect.left + rect.width / 2 - cardW / 2, 12, vp.w - cardW - 12);
    const margin = 16;
    const centerY = rect.top + rect.height / 2;
    const placeBelow = centerY < vp.h * 0.55;
    cardStyle = placeBelow
      ? { position: "fixed", top: rect.top + rect.height + margin, left, width: cardW }
      : { position: "fixed", bottom: vp.h - rect.top + margin, left, width: cardW };
  }

  const Icon = step.icon;
  const spring = { type: "spring" as const, stiffness: 280, damping: 30 };

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Abdunkelung mit Cutout um das Ziel (oder voll, wenn kein Ziel). */}
      <svg className="fixed inset-0" width={vp.w} height={vp.h} style={{ pointerEvents: "auto" }}>
        <defs>
          <mask id="tour-spot">
            <rect x={0} y={0} width={vp.w} height={vp.h} fill="white" />
            {rect && (
              <motion.rect
                initial={false}
                animate={{ x: rect.left, y: rect.top, width: rect.width, height: rect.height }}
                transition={spring}
                rx={16}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x={0}
          y={0}
          width={vp.w}
          height={vp.h}
          fill="rgba(6,8,5,0.80)"
          mask={rect ? "url(#tour-spot)" : undefined}
        />
      </svg>

      {/* Leuchtender Rahmen + Puls um das hervorgehobene Element. */}
      {rect && (
        <motion.div
          className="fixed pointer-events-none rounded-2xl"
          initial={false}
          animate={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          transition={spring}
          style={{
            boxShadow: `0 0 0 2px ${step.color}, 0 0 0 6px ${step.color}33, 0 0 36px 4px ${step.color}66`,
          }}
        >
          <span
            className="absolute inset-0 rounded-2xl animate-ping opacity-40"
            style={{ boxShadow: `0 0 0 2px ${step.color}` }}
          />
        </motion.div>
      )}

      {/* Tooltip-Karte */}
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.22 }}
          style={cardStyle}
          className="z-[101]"
        >
          <div
            className="relative rounded-2xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl shadow-2xl overflow-hidden"
            style={{ boxShadow: `0 24px 70px -28px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.05)` }}
          >
            {/* Akzent-Streifen oben */}
            <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${step.color}, transparent)` }} />

            <button
              onClick={onComplete}
              aria-label="Tour beenden"
              className="absolute top-2.5 right-2.5 p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{ background: `${step.color}1f`, borderColor: `${step.color}40` }}
                >
                  <Icon className="w-[22px] h-[22px]" style={{ color: step.color }} />
                </div>
                <h3 className="text-[16px] font-bold text-white leading-tight pr-6">
                  {tourTexts[step.titleKey]}
                </h3>
              </div>

              <p className="text-[13.5px] text-zinc-300 leading-relaxed">
                {tourTexts[step.descKey]}
              </p>

              <div className="flex items-center justify-between mt-5">
                {/* Fortschritt */}
                <div className="flex items-center gap-1.5">
                  {STEPS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setIndex(i)}
                      aria-label={`Schritt ${i + 1}`}
                      className="rounded-full transition-all duration-300"
                      style={{
                        width: i === index ? 18 : 6,
                        height: 6,
                        background: i === index ? s.color : i < index ? `${STEPS[index].color}66` : "rgba(255,255,255,0.12)",
                      }}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  {index > 0 && (
                    <button
                      onClick={back}
                      className="flex items-center gap-0.5 text-[13px] text-zinc-400 hover:text-white transition px-2 py-1.5"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      {tourTexts.back}
                    </button>
                  )}
                  <button
                    onClick={next}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold text-black transition active:scale-95"
                    style={{ background: step.color }}
                  >
                    {isLast ? (
                      <>
                        <Rocket className="w-4 h-4" />
                        {tourTexts.finish}
                      </>
                    ) : (
                      <>
                        {tourTexts.next}
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Überspringen + Zähler */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.06]">
                <button
                  onClick={onComplete}
                  className="text-[11.5px] text-zinc-500 hover:text-zinc-300 transition"
                >
                  {tourTexts.skip}
                </button>
                <span className="text-[11px] text-zinc-600 tabular-nums">
                  {index + 1} {tourTexts.stepOf} {STEPS.length}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
