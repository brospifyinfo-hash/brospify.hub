"use client";

import { useState, useEffect, useRef } from "react";
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
  ChevronDown,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { useI18n } from "@/lib/i18n";

// ─── Spline Chart (SVG) ─────────────────────────────────
function SplineChart({ data, color, height = 200 }: { data: number[]; color: string; height?: number }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 100;
  const h = 100;
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / range) * (h * 0.85) - h * 0.05,
    value: v,
  }));

  // Build smooth spline path using Catmull-Rom
  function catmullRom(pts: { x: number; y: number }[]) {
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  }

  const linePath = catmullRom(points);
  const areaPath = `${linePath} L ${w},${h} L 0,${h} Z`;

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(xRatio * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, idx)));
  }

  return (
    <div className="relative" style={{ height }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="spline-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#spline-grad)" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="0.8" strokeLinecap="round" />
        {/* Hover dot */}
        {hover !== null && points[hover] && (
          <>
            <line x1={points[hover].x} y1={0} x2={points[hover].x} y2={h} stroke={color} strokeWidth="0.3" strokeDasharray="1.5" opacity="0.4" />
            <circle cx={points[hover].x} cy={points[hover].y} r="1.5" fill={color} stroke="#000" strokeWidth="0.4" />
          </>
        )}
      </svg>
      {/* Tooltip */}
      {hover !== null && points[hover] && (
        <div
          className="absolute top-2 px-3 py-1.5 rounded-lg text-xs font-bold pointer-events-none glass-strong border border-white/10 whitespace-nowrap"
          style={{ left: `${(hover / (data.length - 1)) * 100}%`, transform: "translateX(-50%)" }}
        >
          {points[hover].value.toLocaleString("de-DE", { minimumFractionDigits: 2 })} &euro;
        </div>
      )}
    </div>
  );
}

// ─── Donut Chart (SVG) ───────────────────────────────────
function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  let cumAngle = -90;

  function describeArc(startAngle: number, endAngle: number, r: number, R: number) {
    const start1 = polarToCart(R, startAngle);
    const end1 = polarToCart(R, endAngle);
    const start2 = polarToCart(r, endAngle);
    const end2 = polarToCart(r, startAngle);
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${start1.x} ${start1.y} A ${R} ${R} 0 ${large} 1 ${end1.x} ${end1.y} L ${start2.x} ${start2.y} A ${r} ${r} 0 ${large} 0 ${end2.x} ${end2.y} Z`;
  }

  function polarToCart(r: number, angle: number) {
    const rad = (angle * Math.PI) / 180;
    return { x: 50 + r * Math.cos(rad), y: 50 + r * Math.sin(rad) };
  }

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="w-40 h-40 shrink-0">
        {segments.map((seg, i) => {
          const angle = (seg.value / total) * 360;
          const startAngle = cumAngle;
          const endAngle = cumAngle + angle;
          cumAngle = endAngle;
          const isHover = hoverIdx === i;
          return (
            <path
              key={i}
              d={describeArc(startAngle + 0.5, endAngle - 0.5, 28, isHover ? 46 : 42)}
              fill={seg.color}
              opacity={hoverIdx !== null && !isHover ? 0.4 : 1}
              className="transition-all duration-200 cursor-pointer"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          );
        })}
        <circle cx="50" cy="50" r="24" fill="#0a0a0a" />
        {hoverIdx !== null && (
          <text x="50" y="52" textAnchor="middle" className="fill-white text-[7px] font-bold">
            {((segments[hoverIdx].value / total) * 100).toFixed(0)}%
          </text>
        )}
      </svg>
      <div className="space-y-2 flex-1 min-w-0">
        {segments.map((seg, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-xs cursor-pointer"
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-zinc-400 truncate flex-1">{seg.label}</span>
            <span className="font-bold text-white">{((seg.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
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

// ─── Demo Data ───────────────────────────────────────────
const DEMO_REVENUE = [
  120, 180, 95, 210, 340, 280, 420, 390, 510, 480, 620, 580, 750, 690, 820,
  780, 910, 850, 1020, 980, 1100, 1050, 1180, 1120, 1290, 1250, 1380, 1320, 1450, 1400,
];

const DEMO_TRAFFIC = [
  { label: "Direct", value: 38, color: "#95BF47" },
  { label: "Google / Organic", value: 27, color: "#6366f1" },
  { label: "Social Media", value: 18, color: "#a855f7" },
  { label: "Paid Ads", value: 12, color: "#f59e0b" },
  { label: "Referral", value: 5, color: "#ec4899" },
];

const DEMO_PRODUCTS = [
  { name: "Ergonomic Posture Belt", img: "", revenue: 4280, margin: 68 },
  { name: "LED Galaxy Projector", img: "", revenue: 3150, margin: 72 },
  { name: "Smart Massage Gun Pro", img: "", revenue: 2890, margin: 61 },
  { name: "Portable Blender 2.0", img: "", revenue: 2340, margin: 65 },
  { name: "Magnetic Phone Mount", img: "", revenue: 1920, margin: 74 },
];

const DEMO_FUNNEL = { visitors: 12400, addToCart: 3720, checkout: 1488, purchased: 744 };

// ─── Main Page ───────────────────────────────────────────
export default function AnalyticsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("30d");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.isLoggedIn) { router.push("/"); return; }
        setLoading(false);
      })
      .catch(() => router.push("/"));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const de = t.nav.home !== "Home";

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

          {/* Date Picker */}
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

        {/* ─── Revenue Chart ──────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-strong rounded-2xl border border-white/10 p-6 mb-6 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-[#95BF47]" />
                {de ? "Umsatzentwicklung" : "Revenue Trend"}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {de ? "Letzte 30 Tage" : "Last 30 days"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-[#95BF47]">
                {DEMO_REVENUE.reduce((a, b) => a + b, 0).toLocaleString("de-DE")} &euro;
              </p>
              <p className="text-xs text-emerald-400 flex items-center gap-1 justify-end">
                <TrendingUp className="w-3 h-3" /> +23.4%
              </p>
            </div>
          </div>
          <SplineChart data={DEMO_REVENUE} color="#95BF47" height={220} />
          <div className="flex justify-between text-[10px] text-zinc-600 mt-2 px-1">
            <span>1. {de ? "Apr" : "Apr"}</span>
            <span>10.</span>
            <span>20.</span>
            <span>30.</span>
          </div>
        </motion.div>

        {/* ─── Two Column: Donut + Funnel ─────────── */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Traffic Sources */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-strong rounded-2xl border border-white/10 p-6 backdrop-blur-xl"
          >
            <h2 className="font-bold mb-5 flex items-center gap-2">
              <Eye className="w-5 h-5 text-indigo-400" />
              {de ? "Traffic-Quellen" : "Traffic Sources"}
            </h2>
            <DonutChart segments={DEMO_TRAFFIC} />
          </motion.div>

          {/* Conversion Funnel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-strong rounded-2xl border border-white/10 p-6 backdrop-blur-xl"
          >
            <h2 className="font-bold mb-5 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-purple-400" />
              Conversion Funnel
            </h2>
            <div className="space-y-4">
              <FunnelStep label={de ? "Besucher" : "Visitors"} value={DEMO_FUNNEL.visitors} total={DEMO_FUNNEL.visitors} color="#6366f1" icon={Eye} delay={0.2} />
              <FunnelStep label="Add to Cart" value={DEMO_FUNNEL.addToCart} total={DEMO_FUNNEL.visitors} color="#a855f7" icon={ShoppingCart} delay={0.3} />
              <FunnelStep label="Checkout" value={DEMO_FUNNEL.checkout} total={DEMO_FUNNEL.visitors} color="#f59e0b" icon={CreditCard} delay={0.4} />
              <FunnelStep label={de ? "Gekauft" : "Purchased"} value={DEMO_FUNNEL.purchased} total={DEMO_FUNNEL.visitors} color="#95BF47" icon={Package} delay={0.5} />
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
              <span className="text-zinc-500">Overall Conversion</span>
              <span className="font-bold text-[#95BF47]">{((DEMO_FUNNEL.purchased / DEMO_FUNNEL.visitors) * 100).toFixed(1)}%</span>
            </div>
          </motion.div>
        </div>

        {/* ─── Top 5 Products ─────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-strong rounded-2xl border border-white/10 p-6 backdrop-blur-xl"
        >
          <h2 className="font-bold mb-5 flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-400" />
            Top 5 Winning Products
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500 border-b border-white/5">
                  <th className="pb-3 pl-2">#</th>
                  <th className="pb-3">{de ? "Produkt" : "Product"}</th>
                  <th className="pb-3 text-right">{de ? "Umsatz" : "Revenue"}</th>
                  <th className="pb-3 text-right">{de ? "Marge" : "Margin"}</th>
                  <th className="pb-3 text-right">{de ? "Trend" : "Trend"}</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_PRODUCTS.map((prod, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.05 }}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition"
                  >
                    <td className="py-3.5 pl-2 text-zinc-500 font-mono text-xs">{i + 1}</td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4 text-zinc-500" />
                        </div>
                        <span className="font-medium truncate max-w-[200px]">{prod.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 text-right font-bold text-[#95BF47]">
                      {prod.revenue.toLocaleString("de-DE")} &euro;
                    </td>
                    <td className="py-3.5 text-right">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400">
                        {prod.margin}%
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      <TrendingUp className="w-4 h-4 text-emerald-400 inline" />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Disclaimer */}
        <p className="text-[10px] text-zinc-600 text-center mt-6">
          {de
            ? "Demo-Daten. Verbinde deinen Shopify-Store f\u00FCr Echtzeit-Analytics."
            : "Demo data. Connect your Shopify store for real-time analytics."}
        </p>
      </div>
    </div>
  );
}
