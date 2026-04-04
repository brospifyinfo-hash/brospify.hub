"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  Palette,
  TrendingUp,
  Package,
  ArrowRight,
  Store,
  Sparkles,
  Crown,
} from "lucide-react";
import Navigation from "@/components/Navigation";

interface SessionInfo {
  isLoggedIn: boolean;
  isAdmin: boolean;
  hasShopifyConnection: boolean;
  sku: string | null;
}

interface Produkt {
  id: string;
  titel: string;
  bildUrl: string;
  monat: string;
  extra: {
    stats?: { trendScore: number };
  };
}

export default function HomePage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [neueProdukte, setNeueProdukte] = useState<Produkt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/session").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
    ])
      .then(([sess, prods]) => {
        if (!sess.isLoggedIn) {
          router.push("/");
          return;
        }
        setSession(sess);
        // Get latest 3 products
        const allProducts = prods.flatMap?.((m: { produkte: Produkt[] }) => m.produkte) || [];
        setNeueProdukte(allProducts.slice(0, 3));
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

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };
  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      {/* Ambient glow */}
      <div className="fixed top-20 right-10 w-80 h-80 bg-[#95BF47]/8 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-20 left-10 w-80 h-80 bg-[#95BF47]/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Willkommen zur&uuml;ck <span className="text-[#95BF47]">&#x1F44B;</span>
          </h1>
          <p className="text-zinc-400">
            Dein Dashboard &mdash; alles Wichtige auf einen Blick.
          </p>
        </motion.div>

        {/* Quick Action Cards */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid md:grid-cols-3 gap-6 mb-10"
        >
          {/* Charts Card */}
          <motion.div
            variants={item}
            onClick={() => router.push("/charts")}
            className="glass rounded-2xl p-6 cursor-pointer group hover:border-[#95BF47]/30 border border-white/10 transition-all duration-300"
          >
            <div className="w-12 h-12 rounded-xl bg-[#95BF47]/10 border border-[#95BF47]/20 flex items-center justify-center mb-4 group-hover:bg-[#95BF47]/20 transition-colors">
              <BarChart3 className="w-6 h-6 text-[#95BF47]" />
            </div>
            <h3 className="text-lg font-bold mb-1">Winning Charts</h3>
            <p className="text-zinc-400 text-sm mb-4">
              Entdecke die besten Produkte des Monats mit Analysen &amp; Rankings.
            </p>
            <div className="flex items-center gap-2 text-[#95BF47] text-sm font-medium group-hover:gap-3 transition-all">
              <span>Charts &ouml;ffnen</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </motion.div>

          {/* Themes Card */}
          <motion.div
            variants={item}
            onClick={() => router.push("/themes")}
            className="glass rounded-2xl p-6 cursor-pointer group hover:border-[#95BF47]/30 border border-white/10 transition-all duration-300"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
              <Palette className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-bold mb-1">Themes</h3>
            <p className="text-zinc-400 text-sm mb-4">
              Lade das aktuelle Shopify-Theme herunter oder pushe es direkt.
            </p>
            <div className="flex items-center gap-2 text-purple-400 text-sm font-medium group-hover:gap-3 transition-all">
              <span>Themes ansehen</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </motion.div>

          {/* Shopify Status Card */}
          <motion.div
            variants={item}
            className="glass rounded-2xl p-6 border border-white/10"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <Store className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold mb-1">Shopify Status</h3>
            {session.hasShopifyConnection ? (
              <>
                <p className="text-emerald-400 text-sm mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Verbunden
                </p>
                <p className="text-zinc-500 text-xs">
                  1-Klick Import &amp; Theme-Push aktiv
                </p>
              </>
            ) : (
              <>
                <p className="text-zinc-400 text-sm mb-4">
                  Noch nicht verbunden
                </p>
                <button
                  onClick={() => router.push("/setup")}
                  className="text-[#95BF47] text-sm font-medium hover:underline"
                >
                  Jetzt verbinden &rarr;
                </button>
              </>
            )}
          </motion.div>
        </motion.div>

        {/* Neue Produkte Section */}
        {neueProdukte.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#95BF47]" />
                Neue Produkte
              </h2>
              <button
                onClick={() => router.push("/charts")}
                className="text-sm text-[#95BF47] hover:underline"
              >
                Alle anzeigen &rarr;
              </button>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {neueProdukte.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="glass rounded-xl p-4 border border-white/10 hover:border-[#95BF47]/20 transition-all group"
                >
                  <div className="flex items-start gap-4">
                    {p.bildUrl && (
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/5 shrink-0">
                        <img
                          src={p.bildUrl}
                          alt={p.titel}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm truncate">{p.titel}</h3>
                      <p className="text-zinc-500 text-xs mt-1">{p.monat}</p>
                      {p.extra?.stats?.trendScore && (
                        <div className="flex items-center gap-1 mt-2">
                          <TrendingUp className="w-3 h-3 text-[#95BF47]" />
                          <span className="text-xs text-[#95BF47] font-medium">
                            Trend {p.extra.stats.trendScore}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
