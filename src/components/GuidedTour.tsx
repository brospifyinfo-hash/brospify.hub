"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Dices,
  Wand2,
  FolderHeart,
  Users,
  Coins,
  LifeBuoy,
  User,
  Rocket,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

// Interaktive Einführung beim Erstlogin. Bewusst als zentrierte Karten-
// Sequenz umgesetzt (kein DOM-Spotlight auf Nav-Elemente) — das ist robust
// über alle Breakpoints und fasst das (laut Vorgabe perfekte) Mobile-Layout
// nicht an.

interface TourStep {
  icon: typeof Sparkles;
  color: string;
  bg: string;
  titleKey: string;
  descKey: string;
}

const TOUR_STEPS: TourStep[] = [
  { icon: Sparkles, color: "text-[#95BF47]", bg: "bg-[#95BF47]/12", titleKey: "welcome", descKey: "welcomeDesc" },
  { icon: Dices, color: "text-emerald-400", bg: "bg-emerald-500/12", titleKey: "drop", descKey: "dropDesc" },
  { icon: Wand2, color: "text-indigo-400", bg: "bg-indigo-500/12", titleKey: "tools", descKey: "toolsDesc" },
  { icon: FolderHeart, color: "text-pink-400", bg: "bg-pink-500/12", titleKey: "library", descKey: "libraryDesc" },
  { icon: Users, color: "text-sky-400", bg: "bg-sky-500/12", titleKey: "community", descKey: "communityDesc" },
  { icon: Coins, color: "text-amber-400", bg: "bg-amber-500/12", titleKey: "credits", descKey: "creditsDesc" },
  { icon: LifeBuoy, color: "text-rose-400", bg: "bg-rose-500/12", titleKey: "support", descKey: "supportDesc" },
  { icon: User, color: "text-purple-400", bg: "bg-purple-500/12", titleKey: "profile", descKey: "profileDesc" },
  { icon: Rocket, color: "text-[#95BF47]", bg: "bg-[#95BF47]/12", titleKey: "finishTitle", descKey: "finishDesc" },
];

interface Props {
  onComplete: () => void;
}

export default function GuidedTour({ onComplete }: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;
  const tourTexts = t.tour as Record<string, string>;

  function next() {
    if (isLast) onComplete();
    else setStep((s) => s + 1);
  }
  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => {}}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.96 }}
          transition={{ duration: 0.28 }}
          className="relative z-[101] w-full max-w-md"
        >
          <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-start gap-4 mb-5">
              <div className={`w-14 h-14 rounded-2xl ${current.bg} border border-white/10 flex items-center justify-center shrink-0`}>
                <current.icon className={`w-7 h-7 ${current.color}`} />
              </div>
              <div className="pt-0.5">
                <h3 className="text-lg font-bold leading-tight">{tourTexts[current.titleKey]}</h3>
              </div>
            </div>

            <p className="text-[14px] text-zinc-300 leading-relaxed mb-6">
              {tourTexts[current.descKey]}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  {TOUR_STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === step ? "w-5 bg-[#95BF47]" : i < step ? "w-2 bg-[#95BF47]/40" : "w-2 bg-white/10"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-zinc-600 ml-1 hidden sm:inline">
                  {step + 1} {tourTexts.stepOf} {TOUR_STEPS.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {step > 0 && !isLast && (
                  <button
                    onClick={back}
                    className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition px-2 py-1.5"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {tourTexts.back}
                  </button>
                )}
                {!isLast && (
                  <button
                    onClick={onComplete}
                    className="text-xs text-zinc-600 hover:text-zinc-400 transition px-2 py-1.5"
                  >
                    {tourTexts.skip}
                  </button>
                )}
                <button
                  onClick={next}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                    isLast ? "btn-accent" : "bg-white/5 border border-white/10 hover:bg-white/10 text-white"
                  }`}
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
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
