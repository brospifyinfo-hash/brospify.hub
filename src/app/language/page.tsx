"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Globe, Crown, ArrowRight } from "lucide-react";

const LANGUAGES = [
  { code: "de", label: "Deutsch", flag: "🇩🇪", desc: "Dashboard auf Deutsch nutzen" },
  { code: "en", label: "English", flag: "🇬🇧", desc: "Use dashboard in English" },
];

export default function LanguagePage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  function handleSelect(code: string) {
    setSelected(code);
    document.cookie = `locale=${code};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    setTimeout(() => router.push("/welcome"), 400);
  }

  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl glass mb-4"
          >
            <Crown className="w-8 h-8 text-[#95BF47]" />
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight">
            brospify <span className="text-[#95BF47]">hub</span>
          </h1>
        </div>

        {/* Language Card */}
        <div className="glass rounded-2xl p-8 space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 mb-3">
              <Globe className="w-6 h-6 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold">Sprache wählen</h2>
            <p className="text-sm text-zinc-500 mt-1">Choose your language</p>
          </div>

          <div className="space-y-3">
            {LANGUAGES.map((lang) => (
              <motion.button
                key={lang.code}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelect(lang.code)}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border transition-all ${
                  selected === lang.code
                    ? "bg-[#95BF47]/10 border-[#95BF47]/40 shadow-lg shadow-[#95BF47]/10"
                    : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20"
                }`}
              >
                <span className="text-3xl">{lang.flag}</span>
                <div className="flex-1 text-left">
                  <div className="font-semibold">{lang.label}</div>
                  <div className="text-xs text-zinc-500">{lang.desc}</div>
                </div>
                <ArrowRight className={`w-5 h-5 transition-colors ${selected === lang.code ? "text-[#95BF47]" : "text-zinc-600"}`} />
              </motion.button>
            ))}
          </div>
        </div>

        <p className="text-center text-white/20 text-xs mt-8">
          Du kannst die Sprache später in den Einstellungen ändern.
        </p>
      </motion.div>
    </div>
  );
}
