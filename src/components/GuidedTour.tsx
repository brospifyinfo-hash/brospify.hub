"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown,
  BarChart3,
  Palette,
  User,
  ChevronRight,
  Rocket,
  Navigation as NavIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface TourStep {
  target: string;
  icon: typeof Crown;
  color: string;
  bg: string;
  titleKey: string;
  descKey: string;
  position: "bottom" | "center";
}

const TOUR_STEPS: TourStep[] = [
  { target: "", icon: Crown, color: "text-[#95BF47]", bg: "bg-[#95BF47]/10", titleKey: "welcome", descKey: "welcomeDesc", position: "center" },
  { target: "nav", icon: NavIcon, color: "text-indigo-400", bg: "bg-indigo-500/10", titleKey: "stepNav", descKey: "stepNavDesc", position: "bottom" },
  { target: "[data-tour='charts']", icon: BarChart3, color: "text-emerald-400", bg: "bg-emerald-500/10", titleKey: "stepCharts", descKey: "stepChartsDesc", position: "center" },
  { target: "[data-tour='themes']", icon: Palette, color: "text-amber-400", bg: "bg-amber-500/10", titleKey: "stepThemes", descKey: "stepThemesDesc", position: "center" },
  { target: "[data-tour='profile']", icon: User, color: "text-purple-400", bg: "bg-purple-500/10", titleKey: "stepProfile", descKey: "stepProfileDesc", position: "center" },
];

interface Props {
  onComplete: () => void;
}

export default function GuidedTour({ onComplete }: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  const updateSpotlight = useCallback(() => {
    if (!current.target) { setSpotlightRect(null); return; }
    const el = document.querySelector(current.target);
    if (el) setSpotlightRect(el.getBoundingClientRect());
    else setSpotlightRect(null);
  }, [current.target]);

  useEffect(() => {
    updateSpotlight();
    window.addEventListener("resize", updateSpotlight);
    return () => window.removeEventListener("resize", updateSpotlight);
  }, [updateSpotlight]);

  function handleNext() { isLast ? onComplete() : setStep((s) => s + 1); }

  const tooltipStyle: React.CSSProperties = {};
  if (spotlightRect && current.position === "bottom") {
    tooltipStyle.position = "fixed";
    tooltipStyle.top = spotlightRect.bottom + 16;
    tooltipStyle.left = Math.max(16, spotlightRect.left + spotlightRect.width / 2 - 200);
    tooltipStyle.maxWidth = 400;
  }

  const tourTexts = t.tour as Record<string, string>;

  return (
    <div className="fixed inset-0 z-[100]">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0" onClick={handleNext}>
        {spotlightRect ? (
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <mask id="spotlight-mask">
                <rect width="100%" height="100%" fill="white" />
                <rect x={spotlightRect.left - 8} y={spotlightRect.top - 8} width={spotlightRect.width + 16} height={spotlightRect.height + 16} rx="16" fill="black" />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.80)" mask="url(#spotlight-mask)" />
            <rect x={spotlightRect.left - 8} y={spotlightRect.top - 8} width={spotlightRect.width + 16} height={spotlightRect.height + 16} rx="16" fill="none" stroke="rgba(149,191,71,0.4)" strokeWidth="2" />
          </svg>
        ) : (
          <div className="w-full h-full bg-black/80 backdrop-blur-sm" />
        )}
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className={`${spotlightRect && current.position === "bottom" ? "" : "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"} z-[101] w-[90vw] max-w-md`}
          style={spotlightRect && current.position === "bottom" ? tooltipStyle : undefined}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5 md:p-6 shadow-2xl">
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-12 h-12 rounded-xl ${current.bg} border border-white/10 flex items-center justify-center shrink-0`}>
                <current.icon className={`w-6 h-6 ${current.color}`} />
              </div>
              <div>
                <h3 className="text-lg font-bold">{tourTexts[current.titleKey]}</h3>
                <p className="text-sm text-zinc-400 mt-0.5">{tourTexts[current.descKey]}</p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-5">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  {TOUR_STEPS.map((_, i) => (
                    <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? "w-6 bg-[#95BF47]" : i < step ? "w-3 bg-[#95BF47]/40" : "w-3 bg-white/10"}`} />
                  ))}
                </div>
                <span className="text-[10px] text-zinc-600 ml-1">{step + 1} {tourTexts.stepOf} {TOUR_STEPS.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={onComplete} className="text-xs text-zinc-600 hover:text-zinc-400 transition px-3 py-1.5">{tourTexts.skip}</button>
                <button onClick={handleNext} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition ${isLast ? "btn-accent" : "bg-white/5 border border-white/10 hover:bg-white/10 text-white"}`}>
                  {isLast ? (<><Rocket className="w-4 h-4" />{tourTexts.finish}</>) : (<>{tourTexts.next}<ChevronRight className="w-4 h-4" /></>)}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
