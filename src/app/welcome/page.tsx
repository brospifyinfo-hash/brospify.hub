"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown,
  BarChart3,
  Rocket,
  Palette,
  Shield,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Check,
} from "lucide-react";

const STEPS = [
  {
    icon: Crown,
    color: "text-[#95BF47]",
    bg: "bg-[#95BF47]/10",
    border: "border-[#95BF47]/20",
    title: "Willkommen im brospify hub",
    subtitle: "Dein Managed Dropshipping Dashboard",
    description:
      "Alles was du brauchst, um deinen Shopify-Store professionell zu betreiben — Produkte, Themes, Legal-Seiten und KI-Tools.",
  },
  {
    icon: BarChart3,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    title: "Winning Product Charts",
    subtitle: "Monatlich neue Top-Produkte",
    description:
      "Erhalte jeden Monat handverlesene Winning Products mit detaillierten Analysen, Trend-Scores und 1-Klick-Import in deinen Shopify-Store.",
  },
  {
    icon: Sparkles,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    title: "KI-Optimierung",
    subtitle: "DeepSeek AI powered",
    description:
      "Lass die KI deine Produkttexte verkaufsstark umschreiben — SEO-optimiert, in deinem Brand-Tonfall, mit perfekten Tags.",
  },
  {
    icon: Palette,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    title: "Premium Themes",
    subtitle: "1-Klick Theme-Installation",
    description:
      "Installiere professionelle Shopify-Themes direkt aus dem Dashboard. Keine manuelle Konfiguration nötig.",
  },
  {
    icon: Shield,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    title: "DACH-Sicherheitspaket",
    subtitle: "Impressum, AGB, Datenschutz & Widerruf",
    description:
      "Generiere alle rechtlich notwendigen Seiten für den DACH-Raum automatisch und installiere sie in deinem Shop.",
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  function handleNext() {
    if (isLast) {
      router.push("/home");
    } else {
      setStep((s) => s + 1);
    }
  }

  function handleSkip() {
    router.push("/home");
  }

  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Progress Dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((_, i) => (
            <motion.div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step
                  ? "w-8 bg-[#95BF47]"
                  : i < step
                  ? "w-4 bg-[#95BF47]/40"
                  : "w-4 bg-white/10"
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35 }}
            className="glass rounded-2xl p-8 text-center"
          >
            {/* Icon */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, type: "spring" }}
              className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl ${current.bg} border ${current.border} mb-6`}
            >
              <current.icon className={`w-10 h-10 ${current.color}`} />
            </motion.div>

            <h2 className="text-2xl font-bold mb-1">{current.title}</h2>
            <p className={`text-sm font-medium ${current.color} mb-4`}>{current.subtitle}</p>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-sm mx-auto">
              {current.description}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Buttons */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-sm text-zinc-600 hover:text-zinc-400 transition px-4 py-2"
          >
            Überspringen
          </button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleNext}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition ${
              isLast
                ? "btn-accent"
                : "bg-white/5 border border-white/10 hover:bg-white/10"
            }`}
          >
            {isLast ? (
              <>
                <Rocket className="w-4 h-4" />
                Los geht&apos;s!
              </>
            ) : (
              <>
                Weiter
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </motion.button>
        </div>

        {/* Step Counter */}
        <p className="text-center text-white/20 text-xs mt-6">
          {step + 1} / {STEPS.length}
        </p>
      </div>
    </div>
  );
}
