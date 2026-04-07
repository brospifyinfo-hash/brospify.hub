"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Store,
  Package,
  Scale,
  Palette,
  Check,
  ChevronRight,
  Sparkles,
  Crown,
  Rocket,
} from "lucide-react";
import Navigation from "@/components/Navigation";

interface SessionInfo {
  isLoggedIn: boolean;
  isAdmin: boolean;
  hasShopifyConnection: boolean;
  hasShopifyToken: boolean;
  shopDomain?: string;
}

interface Checklist {
  setup_complete?: boolean;
  product_imported?: boolean;
  legal_texts_generated?: boolean;
  theme_pushed?: boolean;
}

const STEPS = [
  {
    key: "setup_complete" as const,
    title: "Shopify verbinden",
    description: "Verknüpfe deinen Shopify-Store, um alle Funktionen freizuschalten.",
    icon: Store,
    color: "#95BF47",
    href: "/setup",
    ctaText: "Shop verbinden",
  },
  {
    key: "product_imported" as const,
    title: "Produkt importieren",
    description: "Importiere dein erstes Winning Product mit einem Klick in deinen Shop.",
    icon: Package,
    color: "#8B5CF6",
    href: "/charts",
    ctaText: "Zu den Charts",
  },
  {
    key: "legal_texts_generated" as const,
    title: "Rechtstexte generieren",
    description: "Erstelle DACH-konforme Rechtstexte und pushe sie direkt in deinen Shop.",
    icon: Scale,
    color: "#3B82F6",
    href: "/legal",
    ctaText: "Rechtstexte erstellen",
  },
  {
    key: "theme_pushed" as const,
    title: "Theme installieren",
    description: "Installiere das Premium-Theme für maximale Conversion in deinem Shop.",
    icon: Palette,
    color: "#EC4899",
    href: "/themes",
    ctaText: "Theme installieren",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [checklist, setChecklist] = useState<Checklist>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/session").then((r) => r.json()),
      fetch("/api/profile").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([sess, profileData]) => {
        if (!sess.isLoggedIn) {
          router.push("/");
          return;
        }
        setSession(sess);

        const profile = profileData?.profile || {};
        const cl = profile.onboarding_checklist || {};

        // Auto-detect setup completion from session
        if (sess.hasShopifyToken || sess.hasShopifyConnection) {
          cl.setup_complete = true;
        }

        setChecklist(cl);
        setLoading(false);
      })
      .catch(() => router.push("/"));
  }, [router]);

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const completedCount = STEPS.filter((s) => checklist[s.key]).length;
  const progress = (completedCount / STEPS.length) * 100;
  const allDone = completedCount === STEPS.length;

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
  };
  const item = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
  };

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      {/* Ambient glows */}
      <div className="fixed top-20 right-10 w-72 h-72 bg-[#95BF47]/6 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-20 left-10 w-60 h-60 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 md:py-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-2xl bg-[#95BF47]/15 border border-[#95BF47]/25 flex items-center justify-center">
              <Crown className="w-6 h-6 text-[#95BF47]" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                {allDone ? "Alles erledigt!" : "Willkommen"}{" "}
                <span className="text-[#95BF47]">{allDone ? "\u{1F389}" : "\u{1F44B}"}</span>
              </h1>
              <p className="text-zinc-400 text-sm">
                {allDone
                  ? "Dein Shop ist vollständig eingerichtet."
                  : "Richte deinen Shop in 4 einfachen Schritten ein."}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Progress Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-strong rounded-2xl border border-white/10 p-5 mb-6"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#95BF47]" />
              <span className="text-sm font-semibold">Setup-Fortschritt</span>
            </div>
            <span className="text-sm font-bold text-[#95BF47]">
              {completedCount}/{STEPS.length}
            </span>
          </div>
          <div className="h-3 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#95BF47] to-[#B8D96E]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
            />
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            {allDone
              ? "Perfekt! Du kannst jetzt loslegen."
              : `Noch ${STEPS.length - completedCount} ${STEPS.length - completedCount === 1 ? "Schritt" : "Schritte"} bis zum Start.`}
          </p>
        </motion.div>

        {/* Checklist Steps */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-3"
        >
          {STEPS.map((step, idx) => {
            const done = !!checklist[step.key];
            const isNext = !done && STEPS.slice(0, idx).every((s) => checklist[s.key]);

            return (
              <motion.div
                key={step.key}
                variants={item}
                className={`group relative rounded-2xl border backdrop-blur-md transition-all duration-300 overflow-hidden ${
                  done
                    ? "border-emerald-500/25 bg-emerald-500/[0.04]"
                    : isNext
                    ? "border-white/15 bg-white/[0.06] hover:border-white/25"
                    : "border-white/8 bg-white/[0.02] opacity-60"
                }`}
              >
                {/* Active glow for next step */}
                {isNext && (
                  <div
                    className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: `linear-gradient(135deg, ${step.color}15, transparent 60%)`,
                    }}
                  />
                )}

                <div className="relative p-4 md:p-5 flex items-start gap-4">
                  {/* Step Number / Check */}
                  <div className="shrink-0 mt-0.5">
                    <motion.div
                      className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${
                        done
                          ? "bg-emerald-500/20 border border-emerald-500/30"
                          : `border`
                      }`}
                      style={
                        done
                          ? undefined
                          : { backgroundColor: `${step.color}15`, borderColor: `${step.color}30` }
                      }
                      animate={done ? { scale: [1, 1.15, 1] } : {}}
                      transition={{ duration: 0.4 }}
                    >
                      {done ? (
                        <motion.div
                          initial={{ scale: 0, rotate: -45 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 15 }}
                        >
                          <Check className="w-5 h-5 text-emerald-400" />
                        </motion.div>
                      ) : (
                        <step.icon className="w-5 h-5" style={{ color: step.color }} />
                      )}
                    </motion.div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                        Schritt {idx + 1}
                      </span>
                      {done && (
                        <motion.span
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="text-[10px] font-bold uppercase tracking-widest text-emerald-400"
                        >
                          Erledigt
                        </motion.span>
                      )}
                    </div>
                    <h3
                      className={`font-semibold text-sm md:text-base transition-all ${
                        done ? "text-zinc-400 line-through decoration-emerald-500/40" : "text-white"
                      }`}
                    >
                      {step.title}
                    </h3>
                    <p className="text-xs md:text-sm text-zinc-500 mt-0.5 leading-relaxed">
                      {step.description}
                    </p>

                    {/* CTA Button */}
                    {!done && (
                      <motion.button
                        onClick={() => router.push(step.href)}
                        className={`mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all ${
                          isNext
                            ? "text-black hover:brightness-110"
                            : "bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10"
                        }`}
                        style={isNext ? { backgroundColor: step.color } : undefined}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {step.ctaText}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* All Done CTA */}
        {allDone && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-8"
          >
            <div className="glass-strong rounded-2xl border border-[#95BF47]/20 p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#95BF47]/15 border border-[#95BF47]/25 flex items-center justify-center mx-auto mb-4">
                <Rocket className="w-7 h-7 text-[#95BF47]" />
              </div>
              <h3 className="text-lg font-bold mb-2">Dein Shop ist startklar!</h3>
              <p className="text-zinc-400 text-sm mb-5">
                Alle Schritte abgeschlossen. Entdecke jetzt neue Produkte oder besuche die Community.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => router.push("/charts")}
                  className="btn-accent px-6 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <Package className="w-4 h-4" />
                  Winning Charts
                </button>
                <button
                  onClick={() => router.push("/chats")}
                  className="glass px-6 py-3 rounded-xl font-semibold text-sm text-zinc-300 hover:bg-white/10 transition flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Community
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
