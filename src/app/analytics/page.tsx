"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Calendar,
  DollarSign,
  Eye,
  ShoppingCart,
  CreditCard,
  Package,
  ExternalLink,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import Navigation from "@/components/Navigation";
import { useI18n } from "@/lib/i18n";

// ─── Types ──────────────────────────────────────────────
interface AnalyticsData {
  revenueTimeline: { date: string; amount: number }[];
  totalRevenue: number;
  revenueChange: number;
  trafficSources: { label: string; value: number; color: string }[];
  topProducts: { title: string; revenue: number; quantity: number; image: string }[];
  funnel: { visitors: number; addToCart: number; checkout: number; purchased: number };
  orderCount: number;
  aov: number;
  days: number;
}

// ─── Custom Tooltip ─────────────────────────────────────
function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-xl border border-white/10 px-4 py-2.5 backdrop-blur-xl shadow-2xl">
      <p className="text-[10px] text-zinc-500 mb-0.5">{label}</p>
      <p className="text-sm font-bold text-[#95BF47]">
        {payload[0].value.toLocaleString("de-DE", { minimumFractionDigits: 2 })} &euro;
      </p>
    </div>
  );
}

function BarTooltip({ active, payload }: { active?: boolean; payload?: { payload: { title: string; revenue: number; quantity: number } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="glass-strong rounded-xl border border-white/10 px-4 py-2.5 backdrop-blur-xl shadow-2xl max-w-[200px]">
      <p className="text-xs font-semibold text-white truncate mb-0.5">{d.title}</p>
      <p className="text-sm font-bold text-[#95BF47]">
        {d.revenue.toLocaleString("de-DE", { minimumFractionDigits: 2 })} &euro;
      </p>
      <p className="text-[10px] text-zinc-500">{d.quantity}x sold</p>
    </div>
  );
}

// ─── Funnel Step ─────────────────────────────────────────
function FunnelStep({ label, value, total, color, icon: Icon, delay }: {
  label: string; value: number; total: number; color: string; icon: typeof Eye; delay: number;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="flex items-center gap-4"
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-zinc-400">{label}</span>
          <span className="text-xs font-bold text-white">{value.toLocaleString("de-DE")}</span>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ delay: delay + 0.2, duration: 0.8, ease: "easeOut" }}
          />
        </div>
        <p className="text-[10px] text-zinc-600 mt-0.5">{pct.toFixed(1)}%</p>
      </div>
    </motion.div>
  );
}

// ─── Main Page ───────────────────────────────────────────
export default function AnalyticsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("30d");
  const [shopConnected, setShopConnected] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [fetchingAnalytics, setFetchingAnalytics] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.isLoggedIn) { router.push("/"); return; }
        const connected = !!(data.hasShopifyToken || data.hasShopifyConnection);
        setShopConnected(connected);
        setLoading(false);
      })
      .catch(() => router.push("/"));
  }, [router]);

  // Fetch analytics when connected and dateRange changes
  useEffect(() => {
    if (!shopConnected || loading) return;
    setFetchingAnalytics(true);
    fetch(`/api/shopify/analytics?range=${dateRange}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setAnalyticsData(data);
      })
      .catch(() => {})
      .finally(() => setFetchingAnalytics(false));
  }, [shopConnected, dateRange, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const de = t.nav.home !== "Home";

  const totalRevenue = analyticsData?.totalRevenue || 0;
  const revenueChange = analyticsData?.revenueChange || 0;
  const trafficSources = analyticsData?.trafficSources || [];
  const topProducts = analyticsData?.topProducts || [];
  const funnel = analyticsData?.funnel || { visitors: 0, addToCart: 0, checkout: 0, purchased: 0 };
  const orderCount = analyticsData?.orderCount || 0;
  const aov = analyticsData?.aov || 0;

  // Format timeline data for recharts
  const chartData = (analyticsData?.revenueTimeline || []).map((d) => ({
    date: d.date.slice(5), // "MM-DD"
    amount: d.amount,
  }));

  const rangeLabel = dateRange === "7d" ? (de ? "Letzte 7 Tage" : "Last 7 days") : dateRange === "90d" ? (de ? "Letzte 90 Tage" : "Last 90 days") : (de ? "Letzte 30 Tage" : "Last 30 days");

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      <div className="fixed top-40 right-10 w-72 h-72 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-emerald-400" />
              Analytics & Insights
            </h1>
            <p className="text-zinc-400">
              {de ? "Tiefgehende Analyse deines Shopify-Stores." : "Deep analytics for your Shopify store."}
            </p>
          </div>

          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="input-glass pr-10 appearance-none cursor-pointer"
            >
              <option value="7d">{de ? "Letzte 7 Tage" : "Last 7 days"}</option>
              <option value="30d">{de ? "Letzte 30 Tage" : "Last 30 days"}</option>
              <option value="90d">{de ? "Letzte 90 Tage" : "Last 90 days"}</option>
            </select>
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          </div>
        </motion.div>

        {/* Not connected banner */}
        {!shopConnected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong rounded-2xl border border-amber-500/20 p-5 mb-6 backdrop-blur-xl flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <ExternalLink className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm">{de ? "Shopify nicht verbunden" : "Shopify not connected"}</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                {de ? "Verbinde deinen Shop im Profil, um Echtzeit-Analytics zu sehen." : "Connect your shop in Profile to see real-time analytics."}
              </p>
            </div>
            <button onClick={() => router.push("/profile")} className="px-4 py-2 rounded-xl bg-[#95BF47] text-black text-xs font-bold shrink-0">
              {de ? "Verbinden" : "Connect"}
            </button>
          </motion.div>
        )}

        {/* Loading */}
        {fetchingAnalytics && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!fetchingAnalytics && (
          <>
            {/* ─── KPI Summary Row ─────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: de ? "Umsatz" : "Revenue", value: `${totalRevenue.toLocaleString("de-DE", { minimumFractionDigits: 2 })} \u20AC`, icon: DollarSign, color: "#95BF47" },
                { label: de ? "Bestellungen" : "Orders", value: orderCount.toLocaleString("de-DE"), icon: ShoppingCart, color: "#6366f1" },
                { label: "AOV", value: `${aov.toLocaleString("de-DE", { minimumFractionDigits: 2 })} \u20AC`, icon: CreditCard, color: "#f59e0b" },
                { label: "Conversion", value: funnel.visitors > 0 ? `${((funnel.purchased / funnel.visitors) * 100).toFixed(1)}%` : "\u2014", icon: Eye, color: "#a855f7" },
              ].map((kpi, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.03 }}
                  className="glass-strong rounded-xl border border-white/10 p-5 backdrop-blur-xl"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${kpi.color}15` }}>
                      <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                    </div>
                    <span className="text-[11px] text-zinc-500">{kpi.label}</span>
                  </div>
                  <p className="text-xl font-bold">{kpi.value}</p>
                </motion.div>
              ))}
            </div>

            {/* ─── Revenue Area Chart (Recharts) ─────────── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-strong rounded-2xl border border-white/10 p-6 mb-6 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-bold text-lg flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-[#95BF47]" />
                    {de ? "Umsatzentwicklung" : "Revenue Trend"}
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">{rangeLabel}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-[#95BF47]">
                    {totalRevenue.toLocaleString("de-DE", { minimumFractionDigits: 2 })} &euro;
                  </p>
                  {revenueChange !== 0 && (
                    <p className={`text-xs flex items-center gap-1 justify-end ${revenueChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      <TrendingUp className={`w-3 h-3 ${revenueChange < 0 ? "rotate-180" : ""}`} />
                      {revenueChange >= 0 ? "+" : ""}{revenueChange.toFixed(1)}% vs. {de ? "Vorperiode" : "prev. period"}
                    </p>
                  )}
                </div>
              </div>

              {chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#95BF47" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#95BF47" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#71717a", fontSize: 10 }}
                      axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                      tickLine={false}
                      interval={Math.max(0, Math.floor(chartData.length / 6))}
                    />
                    <YAxis
                      tick={{ fill: "#71717a", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `${v.toLocaleString("de-DE")} \u20AC`}
                    />
                    <Tooltip content={<RevenueTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#95BF47"
                      strokeWidth={2.5}
                      fill="url(#revenueGrad)"
                      animationDuration={1200}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-zinc-600 text-sm">
                  {de ? "Keine Umsatzdaten vorhanden." : "No revenue data available."}
                </div>
              )}
            </motion.div>

            {/* ─── Two Column: Traffic Donut + Funnel ──── */}
            <div className="grid lg:grid-cols-2 gap-6 mb-6">
              {/* Traffic Sources - Recharts PieChart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="glass-strong rounded-2xl border border-white/10 p-6 backdrop-blur-xl"
              >
                <h2 className="font-bold mb-5 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-indigo-400" />
                  {de ? "Traffic-Quellen" : "Traffic Sources"}
                </h2>
                {trafficSources.length > 0 ? (
                  <div className="flex items-center gap-6">
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie
                          data={trafficSources}
                          cx="50%"
                          cy="50%"
                          innerRadius={38}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="value"
                          animationDuration={800}
                        >
                          {trafficSources.map((entry, i) => (
                            <Cell key={i} fill={entry.color} stroke="transparent" />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2.5 flex-1 min-w-0">
                      {trafficSources.map((seg, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                          <span className="text-zinc-400 truncate flex-1">{seg.label}</span>
                          <span className="font-bold text-white">{seg.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-600 py-8 text-center">{de ? "Keine Daten." : "No data."}</p>
                )}
              </motion.div>

              {/* Conversion Funnel */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-strong rounded-2xl border border-white/10 p-6 backdrop-blur-xl"
              >
                <h2 className="font-bold mb-5 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-purple-400" />
                  Conversion Funnel
                </h2>
                <div className="space-y-4">
                  <FunnelStep label={de ? "Besucher" : "Visitors"} value={funnel.visitors} total={funnel.visitors} color="#6366f1" icon={Eye} delay={0.25} />
                  <FunnelStep label="Add to Cart" value={funnel.addToCart} total={funnel.visitors} color="#a855f7" icon={ShoppingCart} delay={0.3} />
                  <FunnelStep label="Checkout" value={funnel.checkout} total={funnel.visitors} color="#f59e0b" icon={CreditCard} delay={0.35} />
                  <FunnelStep label={de ? "Gekauft" : "Purchased"} value={funnel.purchased} total={funnel.visitors} color="#95BF47" icon={Package} delay={0.4} />
                </div>
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Overall Conversion</span>
                  <span className="font-bold text-[#95BF47]">
                    {funnel.visitors > 0 ? ((funnel.purchased / funnel.visitors) * 100).toFixed(1) : "0.0"}%
                  </span>
                </div>
              </motion.div>
            </div>

            {/* ─── Top Products Bar Chart (Recharts) ───── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="glass-strong rounded-2xl border border-white/10 p-6 backdrop-blur-xl"
            >
              <h2 className="font-bold mb-5 flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                Top {de ? "Produkte" : "Products"}
              </h2>
              {topProducts.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={topProducts.map((p) => ({ ...p, shortTitle: p.title.length > 18 ? p.title.slice(0, 18) + "..." : p.title }))}
                      margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#95BF47" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#95BF47" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis
                        dataKey="shortTitle"
                        tick={{ fill: "#71717a", fontSize: 10 }}
                        axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#71717a", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => `${v.toLocaleString("de-DE")} \u20AC`}
                      />
                      <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                      <Bar dataKey="revenue" fill="url(#barGrad)" radius={[6, 6, 0, 0]} animationDuration={1000} />
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Product list below chart */}
                  <div className="mt-4 space-y-2">
                    {topProducts.map((prod, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.02] transition">
                        <span className="text-zinc-600 font-mono text-xs w-5">{i + 1}</span>
                        {prod.image ? (
                          <img src={prod.image} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                            <Package className="w-3.5 h-3.5 text-zinc-600" />
                          </div>
                        )}
                        <span className="text-sm truncate flex-1">{prod.title}</span>
                        <span className="text-sm font-bold text-[#95BF47]">
                          {prod.revenue.toLocaleString("de-DE", { minimumFractionDigits: 2 })} &euro;
                        </span>
                        <span className="text-xs text-zinc-500">{prod.quantity}x</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-zinc-600 py-8 text-center">
                  {de ? "Keine Produktdaten vorhanden." : "No product data available."}
                </p>
              )}
            </motion.div>

            {/* Footer */}
            {shopConnected && analyticsData && (
              <p className="text-[10px] text-zinc-600 text-center mt-6">
                {de
                  ? `Basierend auf ${orderCount} Bestellungen der ${rangeLabel.toLowerCase()}.`
                  : `Based on ${orderCount} orders from the ${rangeLabel.toLowerCase()}.`}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
