"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store,
  Package,
  Check,
  ChevronRight,
  Sparkles,
  PenTool,
  Plus,
  Loader2,
  X,
  Upload,
  Trash2,
  Newspaper,
  FileText,
  ImageUp,
  Coins,
  AlertTriangle,
  Scissors,
  Camera,
  BarChart3,
  Mail,
  Palette,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  Target,
  ShoppingBag,
  Play,
  Pencil,
  Eye,
  EyeOff,
  Megaphone,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { useCredits } from "@/lib/credits";

// ─── Types ───────────────────────────────────────────────────────

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
  dropshipping_app?: boolean;
  aliexpress_link?: boolean;
  legal_texts_generated?: boolean;
  theme_pushed?: boolean;
}

interface NewsPost {
  rowIndex: number;
  id: string;
  type: "text" | "video";
  title: string;
  body: string;
  imageUrl: string;
  youtubeUrl: string;
  previewImageUrl: string;
  active: boolean;
  createdAt: string;
}

interface Insights {
  connected: boolean;
  window?: { since: string; until: string; totalOrders: number };
  conversionTrend?: { date: string; value: number }[];
  aovWeeks?: { label: string; aov: number }[];
  hotspots?: { hour: number; count: number }[];
  productRanking?: { id: number; title: string; units: number; revenue: number; estimatedProfit: number }[];
  missedRevenue?: { amount: number; count: number; trendPct: number };
  returning?: { ratePct: number; customers: number; trend: { label: string; rate: number }[] };
  bestHour?: { hour: number; label: string; sharePct: number; recommendation: string };
}

const SETUP_STEPS: { key: keyof Checklist; label: string }[] = [
  { key: "setup_complete", label: "Shop verbinden" },
  { key: "product_imported", label: "Produkt importieren" },
  { key: "dropshipping_app", label: "Dropshipping-App" },
  { key: "aliexpress_link", label: "AliExpress-Link" },
  { key: "legal_texts_generated", label: "Rechtstexte" },
  { key: "theme_pushed", label: "Theme installieren" },
];

const QUICK_TILES = [
  { title: "Shop bearbeiten", desc: "Theme & Layout", href: "/themes", icon: Palette, color: "#EC4899" },
  { title: "Produkte importieren", desc: "Winning Charts", href: "/charts", icon: Package, color: "#8B5CF6" },
  { title: "Blog schreiben", desc: "KI-Artikel", href: "/blog", icon: PenTool, color: "#A855F7" },
  { title: "Analytics & SEO", desc: "Audit & Score", href: "/seo", icon: BarChart3, color: "#06B6D4" },
  { title: "AI Studio", desc: "Produktfotos", href: "/ai-tools/ai-studio", icon: Camera, color: "#F59E0B" },
  { title: "Hintergrund weg", desc: "Pixelgenau", href: "/ai-tools/background-remover", icon: Scissors, color: "#F43F5E" },
  { title: "Bilder skalieren", desc: "4× Upscale", href: "/ai-tools/hybrid-upscaler", icon: ImageUp, color: "#95BF47" },
  { title: "Shopify-Mails", desc: "10 Templates", href: "/email-templates", icon: Mail, color: "#10B981" },
];

// ─── Page ─────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const credits = useCredits();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [checklist, setChecklist] = useState<Checklist>({});
  const [loading, setLoading] = useState(true);

  const [insights, setInsights] = useState<Insights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);

  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [newsAdminOpen, setNewsAdminOpen] = useState(false);
  const [activePost, setActivePost] = useState<NewsPost | null>(null);

  const loadPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/news");
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadInsights = useCallback(async () => {
    setInsightsLoading(true);
    try {
      const res = await fetch("/api/shopify/insights");
      if (res.ok) {
        const data = await res.json();
        setInsights(data);
      } else {
        setInsights({ connected: false });
      }
    } catch {
      setInsights({ connected: false });
    } finally {
      setInsightsLoading(false);
    }
  }, []);

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
        if (sess.hasShopifyToken || sess.hasShopifyConnection) {
          cl.setup_complete = true;
        }
        setChecklist(cl);
        setLoading(false);
      })
      .catch(() => router.push("/"));

    loadPosts();
    loadInsights();
  }, [router, loadPosts, loadInsights]);

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const completed = SETUP_STEPS.filter((s) => checklist[s.key]).length;
  const progress = (completed / SETUP_STEPS.length) * 100;
  const allDone = completed === SETUP_STEPS.length;
  const shopConnected = !!(session.hasShopifyToken || session.hasShopifyConnection);

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      <div className="fixed top-20 right-10 w-72 h-72 bg-[#95BF47]/6 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-20 left-10 w-60 h-60 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-10 space-y-6">

        {/* ─── Header ─────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold leading-tight">
                {allDone ? "Willkommen zurück" : "Willkommen"}
                {" "}
                <span className="text-[#95BF47]">{allDone ? "\u{1F44B}" : "\u{1F44B}"}</span>
              </h1>
              {session.shopDomain && (
                <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5">
                  <Store className="w-3 h-3" />
                  {session.shopDomain}
                </p>
              )}
            </div>
            <CreditsChip balance={credits.balance} loading={credits.loading} />
          </div>
        </motion.div>

        {/* ─── Compact Setup Progress ───────────────────── */}
        <CompactProgress
          completed={completed}
          total={SETUP_STEPS.length}
          progress={progress}
          allDone={allDone}
          steps={SETUP_STEPS.map((s) => ({ label: s.label, done: !!checklist[s.key] }))}
          onClick={() => router.push("/setup")}
        />

        {/* ─── Quick Access Tiles ─────────────────────── */}
        <section>
          <SectionHeader icon={Sparkles} title="Schnellzugriff" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {QUICK_TILES.map((tile, i) => (
              <motion.button
                key={tile.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.03 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => router.push(tile.href)}
                className="group relative flex flex-col gap-3 p-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04] transition-all text-left overflow-hidden"
              >
                <div
                  className="absolute -top-8 -right-8 w-20 h-20 rounded-full opacity-25 blur-2xl group-hover:opacity-40 transition"
                  style={{ background: tile.color }}
                />
                <div
                  className="relative w-9 h-9 rounded-xl flex items-center justify-center border"
                  style={{ backgroundColor: `${tile.color}15`, borderColor: `${tile.color}30` }}
                >
                  <tile.icon className="w-4.5 h-4.5" style={{ color: tile.color, width: 18, height: 18 }} />
                </div>
                <div className="relative">
                  <div className="text-sm font-semibold text-white">{tile.title}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{tile.desc}</div>
                </div>
              </motion.button>
            ))}
          </div>
        </section>

        {/* ─── Shop Insights ───────────────────────── */}
        <section>
          <SectionHeader
            icon={TrendingUp}
            title="Shop-Insights"
            sub={shopConnected ? "Eigene Berechnungen aus deinen Shopify-Daten" : "Verbinde deinen Shop, um Live-Daten zu sehen"}
          />
          <InsightsGrid
            insights={insights}
            loading={insightsLoading}
            shopConnected={shopConnected}
            onConnect={() => router.push("/setup")}
          />
        </section>

        {/* ─── News Section ──────────────────────── */}
        {(posts.length > 0 || session.isAdmin) && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <SectionHeader icon={Newspaper} title="News & Updates" inline />
              {session.isAdmin && (
                <button
                  onClick={() => setNewsAdminOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-300 hover:bg-white/[0.08] transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Verwalten
                </button>
              )}
            </div>

            {posts.length === 0 && session.isAdmin ? (
              <button
                onClick={() => setNewsAdminOpen(true)}
                className="w-full p-6 rounded-2xl border border-dashed border-white/10 text-zinc-500 hover:text-zinc-300 hover:border-white/20 transition flex items-center justify-center gap-2 text-sm"
              >
                <Plus className="w-4 h-4" /> Erste News-Card erstellen
              </button>
            ) : (
              <NewsRow posts={posts.filter((p) => p.active)} onOpenText={(p) => setActivePost(p)} />
            )}
          </section>
        )}

      </div>

      {/* ─── Modals ──────────────────────────── */}
      <AnimatePresence>
        {newsAdminOpen && (
          <NewsAdminModal
            posts={posts}
            onClose={() => setNewsAdminOpen(false)}
            onRefresh={loadPosts}
          />
        )}
        {activePost && activePost.type === "text" && (
          <NewsTextDetail post={activePost} onClose={() => setActivePost(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────

function SectionHeader({ icon: Icon, title, sub, inline }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub?: string;
  inline?: boolean;
}) {
  return (
    <div className={inline ? "" : "mb-3"}>
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-[#95BF47]/15 border border-[#95BF47]/25 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-[#95BF47]" />
        </div>
        <h2 className="text-sm font-bold text-zinc-200">{title}</h2>
      </div>
      {sub && <p className="text-[11px] text-zinc-500 mt-1 ml-8">{sub}</p>}
    </div>
  );
}

// ─── Credits chip (compact) ───────────────────────────────────

function CreditsChip({ balance, loading }: { balance: number; loading: boolean }) {
  const empty = balance <= 0 && !loading;
  const low = !empty && balance < 20 && !loading;
  const color = empty ? "#ef4444" : low ? "#fbbf24" : "#95BF47";
  return (
    <button
      onClick={() => (window.location.href = "/credits")}
      className="flex items-center gap-2 px-3 py-2 rounded-xl border transition hover:bg-white/[0.04]"
      style={{ borderColor: `${color}30`, backgroundColor: `${color}10` }}
    >
      {empty ? (
        <AlertTriangle className="w-4 h-4" style={{ color }} />
      ) : (
        <Coins className="w-4 h-4" style={{ color }} />
      )}
      <div className="leading-none text-left">
        <div className="text-[9px] uppercase tracking-widest text-white/40 font-semibold">Credits</div>
        <div className="text-sm font-bold tabular-nums" style={{ color }}>
          {loading ? "…" : balance.toLocaleString("de-DE")}
        </div>
      </div>
      <Plus className="w-3.5 h-3.5 text-white/40" />
    </button>
  );
}

// ─── Compact progress card ────────────────────────────────────

function CompactProgress({ completed, total, progress, allDone, steps, onClick }: {
  completed: number;
  total: number;
  progress: number;
  allDone: boolean;
  steps: { label: string; done: boolean }[];
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      className="w-full glass-strong rounded-2xl border border-white/10 p-4 text-left group"
    >
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-[#95BF47] shrink-0" />
          <span className="text-sm font-semibold truncate">
            {allDone ? "Setup abgeschlossen" : "Setup-Fortschritt"}
          </span>
          <span className="text-[10px] text-zinc-500">·</span>
          <span className="text-xs font-bold text-[#95BF47] tabular-nums">{completed}/{total}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-zinc-400 group-hover:text-white transition">
          <span className="hidden sm:inline">Zum Setup</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
      </div>

      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#95BF47] to-[#B8D96E]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {steps.map((s) => (
          <span
            key={s.label}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${
              s.done
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                : "border-white/10 bg-white/[0.03] text-zinc-500"
            }`}
          >
            {s.done && <Check className="w-2.5 h-2.5" />}
            {s.label}
          </span>
        ))}
      </div>
    </motion.button>
  );
}

// ─── Insights grid ────────────────────────────────────────────

function InsightsGrid({ insights, loading, shopConnected, onConnect }: {
  insights: Insights | null;
  loading: boolean;
  shopConnected: boolean;
  onConnect: () => void;
}) {
  if (!shopConnected) {
    return <InsightsPlaceholder onConnect={onConnect} />;
  }
  if (loading || !insights) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 h-32 animate-pulse" />
        ))}
      </div>
    );
  }
  if (insights.connected === false) {
    return <InsightsPlaceholder onConnect={onConnect} />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <ConversionTrendCard data={insights.conversionTrend || []} />
      <AovBarsCard data={insights.aovWeeks || []} />
      <HotspotsCard data={insights.hotspots || []} />
      <ProductRankingCard data={insights.productRanking || []} />
      <MissedRevenueCard data={insights.missedRevenue} />
      <ReturningCard data={insights.returning} />
      <BestHourCard data={insights.bestHour} />
    </div>
  );
}

function InsightsPlaceholder({ onConnect }: { onConnect: () => void }) {
  const stub = ["Conversion-Trend", "Bestellwert", "Hotspots", "Top-Produkte", "Verpasster Umsatz", "Wiederkehrer"];
  return (
    <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 overflow-hidden">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5 opacity-40 pointer-events-none">
        {stub.map((s) => (
          <div key={s} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 h-24 flex flex-col justify-end">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">{s}</div>
            <div className="h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
              <div className="h-full w-1/2 bg-zinc-600 rounded-full" />
            </div>
          </div>
        ))}
      </div>
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#95BF47]/15 border border-[#95BF47]/25 mb-3">
          <Store className="w-5 h-5 text-[#95BF47]" />
        </div>
        <h3 className="text-base font-bold mb-1">Verbinde deinen Shopify-Store</h3>
        <p className="text-xs text-zinc-500 mb-4 max-w-md mx-auto">
          Wir berechnen Conversion-Trends, Hotspots und versteckten Umsatz aus deinen Bestelldaten — direkt von der Shopify-API.
        </p>
        <button
          onClick={onConnect}
          className="btn-accent px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 mx-auto"
        >
          <Store className="w-4 h-4" />
          Shop verbinden
        </button>
      </div>
    </div>
  );
}

// ─── Insight cards ────────────────────────────────────────────

function InsightCard({ icon: Icon, title, accent = "#95BF47", children }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 flex flex-col gap-3 min-h-[10rem]"
    >
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center border"
          style={{ backgroundColor: `${accent}15`, borderColor: `${accent}30` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">{title}</span>
      </div>
      {children}
    </motion.div>
  );
}

function ConversionTrendCard({ data }: { data: { date: string; value: number }[] }) {
  const avg = data.length > 0 ? data.reduce((a, b) => a + b.value, 0) / data.length : 0;
  const last = data.at(-1)?.value ?? 0;
  const first = data[0]?.value ?? 0;
  const trend = last - first;
  return (
    <InsightCard icon={Target} title="Conversion-Trend" accent="#10B981">
      <div className="flex items-baseline gap-2">
        <div className="text-2xl font-bold tabular-nums">{avg.toFixed(1)}%</div>
        <div className={`text-xs font-semibold flex items-center gap-0.5 ${trend >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {trend >= 0 ? "+" : ""}{trend.toFixed(1)}pp
        </div>
      </div>
      <SparkLine data={data.map((d) => d.value)} color="#10B981" />
      <div className="text-[10px] text-zinc-500">14 Tage · Bestellungen ÷ (Bestellungen + abgebrochene Checkouts)</div>
    </InsightCard>
  );
}

function AovBarsCard({ data }: { data: { label: string; aov: number }[] }) {
  const max = Math.max(...data.map((d) => d.aov), 1);
  const last = data.at(-1)?.aov ?? 0;
  return (
    <InsightCard icon={ShoppingBag} title="Bestellwert (AOV)" accent="#8B5CF6">
      <div className="flex items-baseline gap-2">
        <div className="text-2xl font-bold tabular-nums">{last.toFixed(2)} €</div>
        <div className="text-xs text-zinc-500">aktuelle Woche</div>
      </div>
      <div className="flex items-end gap-1 h-12">
        {data.map((d) => (
          <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t-sm bg-gradient-to-t from-[#8B5CF6] to-[#A78BFA]"
              style={{ height: `${Math.max(2, (d.aov / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="text-[10px] text-zinc-500">8 Wochen · Trend deines durchschnittlichen Warenkorbwerts</div>
    </InsightCard>
  );
}

function HotspotsCard({ data }: { data: { hour: number; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <InsightCard icon={Clock} title="Verkaufs-Hotspots" accent="#F59E0B">
      <div className="text-[11px] text-zinc-400">Bestellungen pro Uhrzeit (60d)</div>
      <div className="flex items-end gap-[2px] h-14 mt-1">
        {data.map((d) => (
          <div
            key={d.hour}
            title={`${d.hour}:00 — ${d.count} Bestellungen`}
            className="flex-1 rounded-t-sm bg-gradient-to-t from-[#F59E0B] to-[#FBBF24] opacity-80 hover:opacity-100 transition"
            style={{ height: `${Math.max(2, (d.count / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-zinc-600 tabular-nums">
        <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
      </div>
    </InsightCard>
  );
}

function ProductRankingCard({ data }: { data: { id: number; title: string; estimatedProfit: number; units: number }[] }) {
  const max = Math.max(...data.map((d) => d.estimatedProfit), 1);
  return (
    <InsightCard icon={Package} title="Top-Produkte (Gewinn)" accent="#EC4899">
      {data.length === 0 ? (
        <div className="text-xs text-zinc-500 mt-2">Noch keine Bestellungen im Zeitraum.</div>
      ) : (
        <div className="space-y-1.5">
          {data.slice(0, 5).map((p, i) => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-zinc-500 w-3 tabular-nums">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-[11px] truncate">{p.title}</span>
                  <span className="text-[10px] font-semibold tabular-nums text-zinc-300 shrink-0">
                    {p.estimatedProfit.toFixed(0)} €
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#EC4899] to-[#F472B6]"
                    style={{ width: `${(p.estimatedProfit / max) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="text-[10px] text-zinc-500 mt-auto">Geschätzter Gewinn (≈ 65% Marge) · 60 Tage</div>
    </InsightCard>
  );
}

function MissedRevenueCard({ data }: { data?: Insights["missedRevenue"] }) {
  if (!data) return null;
  const trendPositive = data.trendPct < 0; // less missed = good
  return (
    <InsightCard icon={AlertTriangle} title="Verpasster Umsatz" accent="#EF4444">
      <div>
        <div className="text-2xl font-bold tabular-nums text-red-400">
          {data.amount.toFixed(0)} €
        </div>
        <div className="text-[11px] text-zinc-400 mt-0.5">
          {data.count} abgebrochene Checkouts (30 Tage)
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold ${
            trendPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
          }`}
        >
          {trendPositive ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
          {data.trendPct > 0 ? "+" : ""}{data.trendPct}%
        </div>
        <span className="text-[10px] text-zinc-500">vs. Vorperiode</span>
      </div>
      <div className="text-[10px] text-zinc-500 mt-auto">Tipp: E-Mail-Erinnerungen an Cart-Abandoners senden.</div>
    </InsightCard>
  );
}

function ReturningCard({ data }: { data?: Insights["returning"] }) {
  if (!data) return null;
  return (
    <InsightCard icon={Users} title="Wiederkehrer-Rate" accent="#06B6D4">
      <div className="flex items-baseline gap-2">
        <div className="text-2xl font-bold tabular-nums">{data.ratePct}%</div>
        <div className="text-[11px] text-zinc-500">{data.customers} Kunden gesamt</div>
      </div>
      <SparkLine data={data.trend.map((t) => t.rate)} color="#06B6D4" />
      <div className="text-[10px] text-zinc-500">6 Wochen · Anteil mit ≥ 2 Bestellungen</div>
    </InsightCard>
  );
}

function BestHourCard({ data }: { data?: Insights["bestHour"] }) {
  if (!data) return null;
  return (
    <InsightCard icon={Clock} title="Beste Conversion-Zeit" accent="#A855F7">
      <div className="flex items-baseline gap-2">
        <div className="text-3xl font-bold tabular-nums text-purple-300">{data.label}</div>
        <div className="text-[11px] text-zinc-500">{data.sharePct}% aller Orders</div>
      </div>
      <div className="text-[11px] leading-snug text-zinc-300 bg-purple-500/10 border border-purple-500/20 rounded-lg p-2.5">
        <Sparkles className="w-3 h-3 inline mr-1 text-purple-400" />
        {data.recommendation}
      </div>
    </InsightCard>
  );
}

// ─── SparkLine (SVG, no deps) ─────────────────────────────────

function SparkLine({ data, color }: { data: number[]; color: string }) {
  const w = 200;
  const h = 40;
  const path = useMemo(() => {
    if (data.length === 0) return "";
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = Math.max(max - min, 1);
    const step = w / Math.max(data.length - 1, 1);
    return data
      .map((v, i) => {
        const x = i * step;
        const y = h - ((v - min) / range) * (h - 4) - 2;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [data]);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10">
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {path && (
        <>
          <path d={`${path} L${w},${h} L0,${h} Z`} fill={`url(#grad-${color.replace("#", "")})`} />
          <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

// ─── News row ────────────────────────────────────────────────

function NewsRow({ posts, onOpenText }: {
  posts: NewsPost[];
  onOpenText: (p: NewsPost) => void;
}) {
  if (posts.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {posts.map((p) => (
        <NewsCard key={p.id} post={p} onOpenText={onOpenText} />
      ))}
    </div>
  );
}

function NewsCard({ post, onOpenText }: {
  post: NewsPost;
  onOpenText: (p: NewsPost) => void;
}) {
  const isVideo = post.type === "video" && post.youtubeUrl;
  const cover = isVideo ? (post.previewImageUrl || post.imageUrl) : post.imageUrl;
  const [open, setOpen] = useState(false);

  function handleClick() {
    if (isVideo) setOpen(true);
    else onOpenText(post);
  }

  return (
    <>
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleClick}
        className="group relative rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04] transition overflow-hidden text-left"
      >
        {cover ? (
          <div className="relative h-40 overflow-hidden">
            <img src={cover} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            {isVideo && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center group-hover:scale-110 transition">
                  <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" />
                </div>
              </div>
            )}
            <div className="absolute top-3 left-3">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest border ${
                isVideo
                  ? "bg-rose-500/20 border-rose-500/30 text-rose-300"
                  : "bg-[#95BF47]/20 border-[#95BF47]/30 text-[#95BF47]"
              }`}>
                {isVideo ? <Play className="w-2.5 h-2.5" /> : <FileText className="w-2.5 h-2.5" />}
                {isVideo ? "Video" : "News"}
              </span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h3 className="text-sm font-bold text-white leading-tight line-clamp-2">{post.title}</h3>
            </div>
          </div>
        ) : (
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Megaphone className="w-4 h-4 text-[#95BF47]" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#95BF47]">News</span>
            </div>
            <h3 className="text-sm font-bold leading-snug">{post.title}</h3>
            {post.body && (
              <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2">{post.body.slice(0, 140)}</p>
            )}
          </div>
        )}
      </motion.button>

      <AnimatePresence>
        {open && isVideo && (
          <VideoModal url={post.youtubeUrl} title={post.title} onClose={() => setOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── News text detail modal ─────────────────────────────────

function NewsTextDetail({ post, onClose }: { post: NewsPost; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0c0c0c] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-hidden shadow-2xl flex flex-col"
      >
        {post.imageUrl && (
          <div className="relative h-56 shrink-0">
            <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0c] to-transparent" />
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-2 rounded-lg bg-black/60 border border-white/10 text-white hover:bg-black/80 transition backdrop-blur-sm"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="p-6 overflow-y-auto">
          {!post.imageUrl && (
            <div className="flex items-center justify-end mb-2">
              <button onClick={onClose} className="p-1.5 hover:bg-white/[0.05] rounded-lg transition">
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>
          )}
          <h2 className="text-xl md:text-2xl font-bold leading-tight mb-3">{post.title}</h2>
          <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{post.body}</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Video modal (YouTube embed) ────────────────────────────

function youtubeEmbedUrl(url: string): string {
  // Accepts youtu.be/<id>, watch?v=<id>, or already an embed URL
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "");
      return `https://www.youtube.com/embed/${id}?autoplay=1`;
    }
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}?autoplay=1`;
      if (u.pathname.startsWith("/embed/")) return `${url}${url.includes("?") ? "&" : "?"}autoplay=1`;
    }
  } catch { /* fallthrough */ }
  return url;
}

function VideoModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl bg-black rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-semibold truncate">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/[0.05] rounded-lg transition shrink-0 ml-2">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
        <div className="aspect-video bg-black">
          <iframe
            src={youtubeEmbedUrl(url)}
            title={title}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── News admin modal ───────────────────────────────────────

function NewsAdminModal({ posts, onClose, onRefresh }: {
  posts: NewsPost[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState<NewsPost | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0c0c0c] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="text-base font-bold flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-[#95BF47]" />
            News verwalten
          </h3>
          <div className="flex items-center gap-2">
            {!creating && !editing && (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#95BF47] text-black font-semibold text-xs hover:brightness-110 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Neu
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-white/[0.05] rounded-lg transition">
              <X className="w-4 h-4 text-zinc-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {creating ? (
            <NewsForm
              onCancel={() => setCreating(false)}
              onSaved={() => { setCreating(false); onRefresh(); }}
            />
          ) : editing ? (
            <NewsForm
              initial={editing}
              onCancel={() => setEditing(null)}
              onSaved={() => { setEditing(null); onRefresh(); }}
            />
          ) : (
            <NewsList posts={posts} onEdit={setEditing} onRefresh={onRefresh} />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function NewsList({ posts, onEdit, onRefresh }: {
  posts: NewsPost[];
  onEdit: (p: NewsPost) => void;
  onRefresh: () => void;
}) {
  async function handleDelete(rowIndex: number) {
    if (!confirm("News-Card löschen?")) return;
    try {
      await fetch("/api/admin/news", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex }),
      });
      onRefresh();
    } catch { /* ignore */ }
  }

  async function toggleActive(p: NewsPost) {
    try {
      await fetch("/api/admin/news", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex: p.rowIndex, active: !p.active }),
      });
      onRefresh();
    } catch { /* ignore */ }
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500 text-sm">
        Noch keine News-Cards angelegt. Klick oben auf „Neu&ldquo;, um die erste zu erstellen.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {posts.map((p) => (
        <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          {(p.imageUrl || p.previewImageUrl) ? (
            <img
              src={p.imageUrl || p.previewImageUrl}
              alt=""
              className="w-14 h-14 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-zinc-600" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${
                p.type === "video"
                  ? "bg-rose-500/15 text-rose-300"
                  : "bg-[#95BF47]/15 text-[#95BF47]"
              }`}>
                {p.type === "video" ? "Video" : "Text"}
              </span>
              {!p.active && <span className="text-[9px] text-zinc-500 uppercase">inaktiv</span>}
            </div>
            <div className="text-sm font-semibold truncate">{p.title}</div>
            {p.body && <div className="text-[10px] text-zinc-500 truncate">{p.body.slice(0, 90)}</div>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => toggleActive(p)}
              className="p-2 text-zinc-500 hover:text-white hover:bg-white/[0.05] rounded-lg transition"
              title={p.active ? "Verstecken" : "Aktivieren"}
            >
              {p.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              onClick={() => onEdit(p)}
              className="p-2 text-zinc-500 hover:text-white hover:bg-white/[0.05] rounded-lg transition"
              title="Bearbeiten"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(p.rowIndex)}
              className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
              title="Löschen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function NewsForm({ initial, onCancel, onSaved }: {
  initial?: NewsPost;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<"text" | "video">(initial?.type || "text");
  const [title, setTitle] = useState(initial?.title || "");
  const [body, setBody] = useState(initial?.body || "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || "");
  const [youtubeUrl, setYoutubeUrl] = useState(initial?.youtubeUrl || "");
  const [previewImageUrl, setPreviewImageUrl] = useState(initial?.previewImageUrl || "");
  const [saving, setSaving] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const previewInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingPreview, setUploadingPreview] = useState(false);

  async function uploadFile(file: File, setUrl: (u: string) => void, setBusy: (b: boolean) => void) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setUrl(data.url);
      }
    } catch { /* ignore */ }
    finally { setBusy(false); }
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (initial) {
        await fetch("/api/admin/news", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rowIndex: initial.rowIndex, type, title, body, imageUrl, youtubeUrl, previewImageUrl,
          }),
        });
      } else {
        await fetch("/api/admin/news", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, title, body, imageUrl, youtubeUrl, previewImageUrl }),
        });
      }
      onSaved();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
        {initial ? "Card bearbeiten" : "Neue Card"}
      </div>

      {/* Type toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setType("text")}
          className={`p-3 rounded-xl border text-sm font-semibold transition flex items-center justify-center gap-2 ${
            type === "text"
              ? "bg-[#95BF47]/15 border-[#95BF47]/40 text-[#95BF47]"
              : "bg-white/[0.03] border-white/10 text-zinc-400 hover:bg-white/[0.05]"
          }`}
        >
          <FileText className="w-4 h-4" /> Text-News
        </button>
        <button
          onClick={() => setType("video")}
          className={`p-3 rounded-xl border text-sm font-semibold transition flex items-center justify-center gap-2 ${
            type === "video"
              ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
              : "bg-white/[0.03] border-white/10 text-zinc-400 hover:bg-white/[0.05]"
          }`}
        >
          <Play className="w-4 h-4" /> Video-Card
        </button>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titel *"
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#95BF47]/40 transition placeholder:text-zinc-600"
      />

      {type === "text" ? (
        <>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Text-Inhalt (wird im Detail-Modal angezeigt)"
            rows={6}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#95BF47]/40 transition placeholder:text-zinc-600 resize-y"
          />
          <FileUploadField
            label="Cover-Bild"
            url={imageUrl}
            setUrl={setImageUrl}
            inputRef={imageInputRef}
            uploading={uploadingImage}
            onPick={(f) => uploadFile(f, setImageUrl, setUploadingImage)}
          />
        </>
      ) : (
        <>
          <input
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="YouTube-URL (z.B. https://youtu.be/abc123)"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-rose-500/40 transition placeholder:text-zinc-600"
          />
          <FileUploadField
            label="Vorschaubild"
            url={previewImageUrl}
            setUrl={setPreviewImageUrl}
            inputRef={previewInputRef}
            uploading={uploadingPreview}
            onPick={(f) => uploadFile(f, setPreviewImageUrl, setUploadingPreview)}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Beschreibung (optional)"
            rows={2}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-rose-500/40 transition placeholder:text-zinc-600 resize-y"
          />
        </>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-zinc-300 hover:bg-white/[0.08] transition"
        >
          Abbrechen
        </button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#95BF47] text-black font-bold text-sm disabled:opacity-40 transition"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {initial ? "Speichern" : "Erstellen"}
        </motion.button>
      </div>
    </div>
  );
}

function FileUploadField({ label, url, setUrl, inputRef, uploading, onPick }: {
  label: string;
  url: string;
  setUrl: (u: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  uploading: boolean;
  onPick: (f: File) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">{label}</div>
      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL (oder hochladen)"
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-white/20 transition placeholder:text-zinc-600"
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.08] transition shrink-0"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }}
        />
      </div>
      {url && (
        <div className="relative">
          <img src={url} alt="Preview" className="w-full h-32 object-cover rounded-lg border border-white/10" />
          <button
            onClick={() => setUrl("")}
            className="absolute top-2 right-2 p-1 rounded-md bg-black/70 border border-white/10 text-white hover:bg-black/90 transition"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
