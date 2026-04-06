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
  ExternalLink,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { useI18n } from "@/lib/i18n";

interface SessionInfo {
  isLoggedIn: boolean;
  isAdmin: boolean;
  hasShopifyConnection: boolean;
  hasShopifyToken: boolean;
  shopDomain?: string;
}

interface KPI {
  revenue: number;
  revenueMonth?: number;
  visitors: number;
  sessions: number;
  conversionRate: number;
  ordersToday: number;
  ordersThisMonth: number;
  aov: number;
  error?: string;
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

        // Fetch KPIs if Shopify connected
        if (sess.hasShopifyToken || sess.hasShopifyConnection) {
          fetch("/api/shopify/kpi")
            .then((r) => r.ok ? r.json() : null)
            .then((data) => { if (data && !data.error) setKpi(data); })
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

  const de = t.nav.home !== "Home";
  const shopDomain = session.shopDomain || "";
  const shopConnected = session.hasShopifyConnection || session.hasShopifyToken;

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
      label: de ? "Heutiger Umsatz" : "Today's Revenue",
      value: kpi ? `${kpi.revenue.toLocaleString("de-DE", { minimumFractionDigits: 2 })} \u20AC` : "\u2014",
      icon: DollarSign,
      color: "text-[#95BF47]",
      bg: "bg-[#95BF47]/10",
      border: "border-[#95BF47]/20",
      highlight: true,
    },
    {
      label: de ? "Bestellungen (Monat)" : "Orders (Month)",
      value: kpi ? kpi.ordersThisMonth.toLocaleString("de-DE") : "\u2014",
      icon: ShoppingCart,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/20",
    },
    {
      label: "AOV",
      value: kpi ? `${kpi.aov.toLocaleString("de-DE", { minimumFractionDigits: 2 })} \u20AC` : "\u2014",
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
            {de ? "Willkommen zur\u00FCck" : "Welcome back"} <span className="text-[#95BF47]">{"\u{1F44B}"}</span>
          </h1>
          <p className="text-zinc-400">
            {de ? "Dein Dashboard \u2014 alles Wichtige auf einen Blick." : "Your dashboard \u2014 everything at a glance."}
          </p>
        </motion.div>

        {/* ─── Live Shop Preview + KPIs ──────────────── */}
        <div className="grid lg:grid-cols-5 gap-8 mb-10">
          {/* Live Shop Preview Card (replaces iframe) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 flex justify-center"
          >
            <div className="w-full max-w-[320px]">
              <div className="glass-strong rounded-2xl border border-white/10 p-6 backdrop-blur-xl text-center">
                {/* Store visual */}
                <div className="relative w-full aspect-[9/16] rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 mb-5 overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="relative z-10 flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-[#95BF47]/15 border border-[#95BF47]/25 flex items-center justify-center">
                      <Store className="w-8 h-8 text-[#95BF47]" />
                    </div>
                    {shopDomain ? (
                      <>
                        <p className="text-sm font-semibold text-white">{shopDomain}</p>
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-xs text-emerald-400">Live</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-zinc-500 px-4">
                        {de ? "Kein Shop verbunden" : "No shop connected"}
                      </p>
                    )}
                  </div>
                </div>

                {/* CTA Button */}
                {shopDomain ? (
                  <button
                    onClick={() => window.open(`https://${shopDomain}`, "_blank", "noopener,noreferrer")}
                    className="w-full py-3.5 rounded-xl font-bold text-sm bg-[#95BF47] text-black hover:brightness-110 transition-all flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {de ? "Live Shop Vorschau \u00F6ffnen" : "Open Live Shop Preview"}
                  </button>
                ) : (
                  <button
                    onClick={() => router.push("/setup")}
                    className="w-full py-3.5 rounded-xl font-bold text-sm bg-white/10 text-white hover:bg-white/15 transition-all flex items-center justify-center gap-2"
                  >
                    <Store className="w-4 h-4" />
                    {de ? "Shop verbinden" : "Connect Shop"}
                  </button>
                )}
              </div>

              {/* Glow */}
              <div className="w-40 h-40 bg-[#95BF47]/5 rounded-full blur-3xl mx-auto -mt-16 pointer-events-none" />
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

            {/* Monthly Revenue */}
            {kpi && kpi.revenueMonth !== undefined && (
              <motion.div
                variants={item}
                className="col-span-2 glass rounded-2xl border border-white/10 p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#95BF47]/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-[#95BF47]" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{de ? "Monatsumsatz" : "Monthly Revenue"}</p>
                    <p className="text-[#95BF47] text-lg font-bold">
                      {kpi.revenueMonth.toLocaleString("de-DE", { minimumFractionDigits: 2 })} &euro;
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs text-zinc-500">
                  {kpi.ordersThisMonth} {de ? "Bestellungen" : "orders"}
                </div>
              </motion.div>
            )}

            {/* Shopify Status */}
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
                  {shopConnected ? (
                    <p className="text-emerald-400 text-xs flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {de ? "Verbunden" : "Connected"} {shopDomain && `\u2014 ${shopDomain}`}
                    </p>
                  ) : (
                    <p className="text-zinc-500 text-xs">{de ? "Nicht verbunden" : "Not connected"}</p>
                  )}
                </div>
              </div>
              {!shopConnected && (
                <button
                  onClick={() => router.push("/setup")}
                  className="btn-accent px-4 py-2 rounded-xl text-xs font-semibold"
                >
                  {de ? "Verbinden" : "Connect"}
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
              {de ? "Entdecke die besten Produkte mit Analysen & Rankings." : "Discover the best products with analytics & rankings."}
            </p>
            <div className="flex items-center gap-2 text-[#95BF47] text-sm font-medium group-hover:gap-3 transition-all">
              <span>{de ? "Charts \u00F6ffnen" : "Open Charts"}</span>
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
            <h3 className="text-lg font-bold mb-1">{de ? "Warenkorb Optimierer" : "Cart Optimizer"}</h3>
            <p className="text-zinc-400 text-sm mb-4">
              {de ? "Trust Badges, Timer & Cross-Sells f\u00FCr deinen Warenkorb." : "Trust badges, timers & cross-sells for your cart."}
            </p>
            <div className="flex items-center gap-2 text-purple-400 text-sm font-medium group-hover:gap-3 transition-all">
              <span>{de ? "Anpassen" : "Customize"}</span>
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
              {de ? "Tiefe Store-Analysen, Funnels & Top-Produkte." : "Deep store analytics, funnels & top products."}
            </p>
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium group-hover:gap-3 transition-all">
              <span>{de ? "Analytics anzeigen" : "View Analytics"}</span>
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
                {de ? "Neue Produkte" : "New Products"}
              </h2>
              <button onClick={() => router.push("/charts")} className="text-sm text-[#95BF47] hover:underline">
                {de ? "Alle anzeigen" : "View all"} &rarr;
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
