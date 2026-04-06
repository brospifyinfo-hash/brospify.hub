"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  DollarSign,
  Eye,
  MousePointerClick,
  TrendingUp,
  ArrowRight,
  BarChart3,
  Palette,
  Store,
  Sparkles,
  ShoppingCart,
  Activity,
  Crown,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { useI18n } from "@/lib/i18n";

interface SessionInfo {
  isLoggedIn: boolean;
  isAdmin: boolean;
  hasShopifyConnection: boolean;
  shopDomain?: string;
}

interface KPI {
  revenue: number;
  visitors: number;
  sessions: number;
  conversionRate: number;
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
  const { t } = useI18n();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [neueProdukte, setNeueProdukte] = useState<Produkt[]>([]);
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/session").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
    ])
      .then(([sess, prods]) => {
        if (!sess.isLoggedIn) { router.push("/"); return; }
        setSession(sess);
        const charts = prods.charts || [];
        const allProducts = charts.flatMap((m: { produkte: Produkt[] }) => m.produkte) || [];
        setNeueProdukte(allProducts.slice(0, 3));

        // If Shopify connected, fetch KPIs
        if (sess.hasShopifyToken || sess.hasShopifyConnection) {
          fetch("/api/shopify/kpi")
            .then((r) => r.ok ? r.json() : null)
            .then((data) => { if (data) setKpi(data); })
            .catch(() => {});
        }

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

  const shopDomain = session.shopDomain || "";

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  const kpiCards = [
    {
      label: t.nav.home === "Home" ? "Today's Revenue" : "Heutiger Umsatz",
      value: kpi ? `${kpi.revenue.toLocaleString("de-DE", { minimumFractionDigits: 2 })} \u20AC` : "\u2014",
      icon: DollarSign,
      color: "text-[#95BF47]",
      bg: "bg-[#95BF47]/10",
      border: "border-[#95BF47]/20",
      highlight: true,
    },
    {
      label: t.nav.home === "Home" ? "Live Visitors" : "Live Besucher",
      value: kpi ? kpi.visitors.toString() : "\u2014",
      icon: Eye,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/20",
    },
    {
      label: t.nav.home === "Home" ? "Sessions" : "Sitzungen",
      value: kpi ? kpi.sessions.toLocaleString("de-DE") : "\u2014",
      icon: Activity,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
    },
    {
      label: "Conversion Rate",
      value: kpi ? `${kpi.conversionRate.toFixed(2)}%` : "\u2014",
      icon: MousePointerClick,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
  ];

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      {/* Ambient glow */}
      <div className="fixed top-20 right-10 w-80 h-80 bg-[#95BF47]/8 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-20 left-10 w-60 h-60 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {t.nav.home === "Home" ? "Welcome back" : "Willkommen zur\u00FCck"} <span className="text-[#95BF47]">{"\u{1F44B}"}</span>
          </h1>
          <p className="text-zinc-400">
            {t.nav.home === "Home" ? "Your dashboard \u2014 everything at a glance." : "Dein Dashboard \u2014 alles Wichtige auf einen Blick."}
          </p>
        </motion.div>

        {/* ─── Phone Mockup + KPIs ─────────────────── */}
        <div className="grid lg:grid-cols-5 gap-8 mb-10">
          {/* Phone Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 flex justify-center"
          >
            <div className="relative w-[280px]">
              {/* iPhone Frame */}
              <div className="relative rounded-[3rem] border-[6px] border-zinc-700/80 bg-zinc-900 shadow-2xl shadow-black/50 overflow-hidden">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[28px] bg-zinc-900 rounded-b-2xl z-10" />

                {/* Screen */}
                <div className="aspect-[9/19.5] bg-white overflow-hidden">
                  {shopDomain ? (
                    <iframe
                      src={`https://${shopDomain}`}
                      className="w-[375px] h-[812px] origin-top-left border-0"
                      style={{ transform: "scale(0.747)", transformOrigin: "top left" }}
                      title="Shop Preview"
                      sandbox="allow-scripts allow-same-origin"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-100 text-zinc-400 px-8 text-center">
                      <Store className="w-10 h-10 mb-3 text-zinc-300" />
                      <p className="text-sm font-medium text-zinc-500">
                        {t.nav.home === "Home" ? "Connect your Shopify store to see a live preview" : "Verbinde deinen Shopify-Store f\u00FCr eine Live-Vorschau"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Home indicator bar */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[100px] h-[4px] bg-zinc-600 rounded-full" />
              </div>

              {/* Glow behind phone */}
              <div className="absolute -inset-8 bg-[#95BF47]/5 rounded-full blur-3xl pointer-events-none -z-10" />
            </div>
          </motion.div>

          {/* KPI Cards */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="lg:col-span-3 grid grid-cols-2 gap-4 content-start"
          >
            {kpiCards.map((card) => (
              <motion.div
                key={card.label}
                variants={item}
                className={`glass-strong rounded-2xl border ${card.border} p-5 backdrop-blur-xl ${
                  card.highlight ? "ring-1 ring-[#95BF47]/20" : ""
                }`}
              >
                <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center mb-3`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <p className="text-xs text-zinc-500 mb-1">{card.label}</p>
                <p className={`text-2xl font-bold ${card.highlight ? "text-[#95BF47]" : "text-white"}`}>
                  {card.value}
                </p>
              </motion.div>
            ))}

            {/* Shopify Status Mini */}
            <motion.div
              variants={item}
              className="col-span-2 glass rounded-2xl border border-white/10 p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Store className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Shopify Status</p>
                  {session.hasShopifyConnection ? (
                    <p className="text-emerald-400 text-xs flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {t.nav.home === "Home" ? "Connected" : "Verbunden"}
                    </p>
                  ) : (
                    <p className="text-zinc-500 text-xs">{t.nav.home === "Home" ? "Not connected" : "Nicht verbunden"}</p>
                  )}
                </div>
              </div>
              {!session.hasShopifyConnection && (
                <button
                  onClick={() => router.push("/setup")}
                  className="btn-accent px-4 py-2 rounded-xl text-xs font-semibold"
                >
                  {t.nav.home === "Home" ? "Connect" : "Verbinden"}
                </button>
              )}
            </motion.div>
          </motion.div>
        </div>

        {/* ─── Quick Actions ──────────────────────── */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid md:grid-cols-3 gap-5 mb-10"
        >
          <motion.div
            variants={item}
            onClick={() => router.push("/charts")}
            className="glass rounded-2xl p-6 cursor-pointer border border-white/10 hover:border-[#95BF47]/20 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-[#95BF47]/10 border border-[#95BF47]/20 flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-[#95BF47]" />
            </div>
            <h3 className="text-lg font-bold mb-1">Winning Charts</h3>
            <p className="text-zinc-400 text-sm mb-4">
              {t.nav.home === "Home" ? "Discover the best products with analytics & rankings." : "Entdecke die besten Produkte mit Analysen & Rankings."}
            </p>
            <div className="flex items-center gap-2 text-[#95BF47] text-sm font-medium group-hover:gap-3 transition-all">
              <span>{t.nav.home === "Home" ? "Open Charts" : "Charts \u00F6ffnen"}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </motion.div>

          <motion.div
            variants={item}
            onClick={() => router.push("/checkout")}
            className="glass rounded-2xl p-6 cursor-pointer border border-white/10 hover:border-purple-500/20 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
              <ShoppingCart className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-bold mb-1">Checkout Customizer</h3>
            <p className="text-zinc-400 text-sm mb-4">
              {t.nav.home === "Home" ? "Customize trust badges, timers & cross-sells." : "Trust Badges, Timer & Cross-Sells anpassen."}
            </p>
            <div className="flex items-center gap-2 text-purple-400 text-sm font-medium group-hover:gap-3 transition-all">
              <span>{t.nav.home === "Home" ? "Customize" : "Anpassen"}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </motion.div>

          <motion.div
            variants={item}
            onClick={() => router.push("/analytics")}
            className="glass rounded-2xl p-6 cursor-pointer border border-white/10 hover:border-emerald-500/20 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold mb-1">Analytics & Insights</h3>
            <p className="text-zinc-400 text-sm mb-4">
              {t.nav.home === "Home" ? "Deep store analytics, funnels & top products." : "Tiefe Store-Analysen, Funnels & Top-Produkte."}
            </p>
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium group-hover:gap-3 transition-all">
              <span>{t.nav.home === "Home" ? "View Analytics" : "Analytics anzeigen"}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </motion.div>
        </motion.div>

        {/* ─── Neue Produkte Section ──────────────── */}
        {neueProdukte.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#95BF47]" />
                {t.nav.home === "Home" ? "New Products" : "Neue Produkte"}
              </h2>
              <button onClick={() => router.push("/charts")} className="text-sm text-[#95BF47] hover:underline">
                {t.nav.home === "Home" ? "View all" : "Alle anzeigen"} &rarr;
              </button>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {neueProdukte.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="glass rounded-xl p-4 border border-white/10 hover:border-[#95BF47]/20 transition-all"
                >
                  <div className="flex items-start gap-4">
                    {p.bildUrl && (
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/5 shrink-0">
                        <img src={p.bildUrl} alt={p.titel} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm truncate">{p.titel}</h3>
                      <p className="text-zinc-500 text-xs mt-1">{p.monat}</p>
                      {p.extra?.stats?.trendScore && (
                        <div className="flex items-center gap-1 mt-2">
                          <TrendingUp className="w-3 h-3 text-[#95BF47]" />
                          <span className="text-xs text-[#95BF47] font-medium">Trend {p.extra.stats.trendScore}%</span>
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
