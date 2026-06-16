"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Rocket, Eye, ArrowRight, Zap } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<"quick" | "full" | null>(null);

  async function handleChoice(mode: "quick" | "full") {
    setLoading(mode);
    try {
      const res = await fetch("/api/onboarding/choice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (data.redirect) {
        router.push(data.redirect);
      }
    } catch {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center p-4">
      {/* Ambient glow */}
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-[#95BF47]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-[#95BF47]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Willkommen bei deinem{" "}
            <span className="text-[#95BF47]">Dashboard</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto">
            Leg direkt los und finde dein n&auml;chstes Winning-Produkt.
          </p>
        </motion.div>

        {/* Single Start Card */}
        <div className="max-w-md mx-auto">
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            onClick={() => handleChoice("quick")}
            disabled={loading !== null}
            className="w-full glass-strong rounded-2xl p-8 text-left cursor-pointer border border-[#95BF47]/30 relative overflow-hidden disabled:opacity-70"
          >
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-[#95BF47]/15 border border-[#95BF47]/25 flex items-center justify-center mb-6">
                <Rocket className="w-8 h-8 text-[#95BF47]" />
              </div>

              <h2 className="text-2xl font-bold mb-2">Loslegen</h2>
              <p className="text-[#95BF47] text-sm font-medium mb-4">Direkt ins Dashboard</p>

              <ul className="space-y-3 mb-8 text-zinc-400">
                <li className="flex items-start gap-3">
                  <Zap className="w-4 h-4 text-[#95BF47] mt-1 shrink-0" />
                  <span>Zugang zum Produkt-Generator &amp; allen AI-Tools</span>
                </li>
                <li className="flex items-start gap-3">
                  <Zap className="w-4 h-4 text-[#95BF47] mt-1 shrink-0" />
                  <span>Produkt-Analysen, Stats &amp; Finanzdaten einsehen</span>
                </li>
                <li className="flex items-start gap-3">
                  <Eye className="w-4 h-4 text-[#95BF47] mt-1 shrink-0" />
                  <span>Kein Shopify-Account n&ouml;tig</span>
                </li>
              </ul>

              <div className="flex items-center gap-2 text-[#95BF47] font-semibold">
                {loading === "quick" ? (
                  <div className="w-5 h-5 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Loslegen</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </div>
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
