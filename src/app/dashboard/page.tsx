"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Check,
  Copy,
  X,
  LogOut,
  TrendingUp,
  ExternalLink,
  Settings,
  AlertCircle,
  Store,
  ChevronRight,
  ChevronLeft,
  Rocket,
  Crown,
  Medal,
  Award,
  Info,
  BarChart3,
  Zap,
  ShoppingBag,
  Target,
  PieChart,
  DollarSign,
  Link2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────

interface ProduktStats {
  trendScore: number;
  viralScore: number;
  impulseBuyFactor: number;
  problemSolverIndex: number;
  marketSaturation: number;
}

interface ProduktFinances {
  buyPrice: number;
  recommendedSellPrice: number;
  profitMargin: number;
}

interface Produkt {
  id: string;
  sku: string;
  monat: string;
  titel: string;
  bildUrl: string;
  beschreibung: string;
  preis: string;
  aliExpressLink: string;
  extra: {
    stats?: ProduktStats;
    finances?: ProduktFinances;
    images?: string[];
  };
}

interface MonthChart {
  monat: string;
  produkte: Produkt[];
}

// ─── Constants ───────────────────────────────────────────────────

const MONTH_NAMES: Record<string, string> = {
  "01": "Januar", "02": "Februar", "03": "März", "04": "April",
  "05": "Mai", "06": "Juni", "07": "Juli", "08": "August",
  "09": "September", "10": "Oktober", "11": "November", "12": "Dezember",
};

function formatMonth(monat: string): string {
  const [mm, yyyy] = monat.split("/");
  return `Charts ${MONTH_NAMES[mm] || mm} ${yyyy}`;
}

const RANK_STYLES: Record<number, { bg: string; border: string; text: string; glow: string; icon: typeof Crown }> = {
  1: { bg: "bg-amber-500/10", border: "border-amber-500/40", text: "text-amber-400", glow: "shadow-amber-500/20 shadow-lg", icon: Crown },
  2: { bg: "bg-slate-300/10", border: "border-slate-400/40", text: "text-slate-300", glow: "shadow-slate-400/15 shadow-lg", icon: Medal },
  3: { bg: "bg-orange-700/10", border: "border-orange-600/40", text: "text-orange-400", glow: "shadow-orange-500/15 shadow-lg", icon: Award },
};

// ─── Stat Bar Component ──────────────────────────────────────────

function StatBar({ label, value, icon: Icon, color, delay }: {
  label: string; value: number; icon: typeof Zap; color: string; delay: number;
}) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-zinc-400">
          <Icon className={`w-4 h-4 ${color}`} />
          {label}
        </span>
        <span className="font-bold text-white">{value}%</span>
      </div>
      <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${
            value >= 80 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
            value >= 50 ? "bg-gradient-to-r from-amber-500 to-amber-400" :
            "bg-gradient-to-r from-red-500 to-red-400"
          }`}
          initial={{ width: 0 }}
          animate={{ width: animated ? `${value}%` : 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ─── Image Slideshow ─────────────────────────────────────────────

function ImageSlideshow({ images }: { images: string[] }) {
  const [idx, setIdx] = useState(0);
  if (images.length === 0) return <div className="aspect-video bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-600">Kein Bild</div>;

  return (
    <div className="relative aspect-video bg-zinc-800 rounded-xl overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.img
          key={idx}
          src={images[idx]}
          alt={`Slide ${idx + 1}`}
          className="w-full h-full object-contain"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.3 }}
        />
      </AnimatePresence>
      {images.length > 1 && (
        <>
          <button onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full transition">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setIdx((i) => (i + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full transition">
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)} className={`w-2 h-2 rounded-full transition ${i === idx ? "bg-white" : "bg-white/30"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── CopyButton (for settings modal) ────────────────────────────

function CopyField({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 bg-zinc-800/80 border border-zinc-700 rounded-xl px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">{label}</div>
        <div className="text-xs text-zinc-200 font-mono truncate">{text}</div>
      </div>
      <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="shrink-0 flex items-center gap-1 px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition text-xs">
        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-zinc-400" />}
      </button>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [charts, setCharts] = useState<MonthChart[]>([]);
  const [loading, setLoading] = useState(true);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState<{ open: boolean; aliExpressLink: string }>({ open: false, aliExpressLink: "" });
  const [infoModal, setInfoModal] = useState<{ open: boolean; produkt: Produkt | null }>({ open: false, produkt: null });
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [hasShopifyToken, setHasShopifyToken] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [shopDomain, setShopDomain] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState("");

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      if (res.status === 401) { router.push("/"); return; }
      const data = await res.json();
      setCharts(data.charts || []);
    } catch { setError("Fehler beim Laden der Produkte."); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => {
    fetch("/api/auth/session").then(r => r.json()).then(data => {
      setHasShopifyToken(data.hasShopifyToken || false);
      if (data.shopDomain) setShopDomain(data.shopDomain);
    });
    loadProducts();
  }, [loadProducts]);

  async function handleImport(produkt: Produkt) {
    if (!hasShopifyToken) return;
    setImportingId(produkt.id);
    setError("");
    try {
      const res = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produktId: produkt.id }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccessModal({ open: true, aliExpressLink: data.aliExpressLink || produkt.aliExpressLink || "" });
    } catch { setError("Import fehlgeschlagen."); }
    finally { setImportingId(null); }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  async function connectShop() {
    if (!shopDomain.trim() || !clientId.trim() || !clientSecret.trim()) { setConnectError("Bitte alle Felder ausfüllen."); return; }
    setConnectLoading(true); setConnectError("");
    try {
      const res = await fetch("/api/setup/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopDomain: shopDomain.trim(), clientId: clientId.trim(), clientSecret: clientSecret.trim() }) });
      const data = await res.json();
      if (!res.ok) { setConnectError(data.error || "Fehler."); setConnectLoading(false); return; }
      window.location.href = data.authUrl;
    } catch { setConnectError("Verbindungsfehler."); setConnectLoading(false); }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>;

  const p = infoModal.produkt;
  const allImages = p ? [p.bildUrl, ...(p.extra?.images || [])].filter(Boolean) : [];

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800/60 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Shopify Logo Green */}
            <svg viewBox="0 0 109 124" className="w-6 h-6" fill="none"><path d="M94.77 24.58a1 1 0 0 0-.92-.84c-.38 0-8.39-.16-8.39-.16s-5.58-5.48-6.2-6.1a1.88 1.88 0 0 0-1.4-.5l-3.06 94.3 23.2-5.04S94.88 25.24 94.77 24.58z" fill="#95BF47"/><path d="M78.26 17c-.62-.62-1.41-.5-1.41-.5s-6.8 1.5-8.75 1.94c-.52-1.5-1.17-3.14-2.01-4.83C63 7.47 58.94 4.4 54.12 4.4h-.26c-.71-.9-1.58-1.3-2.35-1.3-7.32 0-10.86 9.15-11.96 13.8-2.86.89-4.9 1.52-5.15 1.6-1.6.5-1.65.55-1.86 2.06C32.34 22 25 82.2 25 82.2l52.8 9.88 3.06-94.3c-.05-.02-1.97-1.16-2.6-1.78zM59.81 22.47l-7.4 2.29c.72-2.74 2.07-5.47 3.72-7.26a10.67 10.67 0 0 1 3.88-2.79c.76 2.36 1.14 5.31.8 7.76zM54 6.58c1.25 0 2.3.43 3.23 1.28-3.64 1.72-7.55 6.05-9.2 14.69l-5.87 1.82C43.76 18.6 47.1 6.58 54 6.58z" fill="#95BF47"/><path d="M94.77 24.58a1 1 0 0 0-.92-.84c-.38 0-8.39-.16-8.39-.16s-5.58-5.48-6.2-6.1a1.07 1.07 0 0 0-.58-.35l-4.29 82.05 23.2-5.04S94.88 25.24 94.77 24.58z" fill="#5E8E3E"/><path d="M56.27 40.74l-3.95 11.76s-3.47-1.85-7.7-1.85c-6.23 0-6.54 3.9-6.54 4.89 0 5.37 14 7.42 14 20 0 9.89-6.27 16.25-14.73 16.25-10.15 0-15.35-6.32-15.35-6.32l2.72-8.97s5.33 4.58 9.84 4.58a4 4 0 0 0 4.18-4.03c0-7.03-11.48-7.34-11.48-18.84 0-9.7 6.95-19.07 20.96-19.07 5.4 0 8.05 1.55 8.05 1.55z" fill="#fff"/></svg>
            <h1 className="text-lg font-bold tracking-tight">BrospifyHub</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSettings(true)} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition" title="Einstellungen"><Settings className="w-4 h-4" /></button>
            <button onClick={handleLogout} className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition px-3 py-2 hover:bg-zinc-800 rounded-lg"><LogOut className="w-4 h-4" /><span className="hidden sm:inline">Abmelden</span></button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* No Token Banner */}
        {!hasShopifyToken && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 px-5 py-4 rounded-xl mb-8">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Shopify-Verbindung erforderlich</p>
              <p className="text-xs text-amber-400/70 mt-0.5">1-Klick-Import deaktiviert. Verbinde deinen Shop in den Einstellungen.</p>
            </div>
            <button onClick={() => setShowSettings(true)} className="shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-medium text-white transition">Verbinden</button>
          </motion.div>
        )}

        {error && <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 px-4 py-3 rounded-xl mb-6"><AlertCircle className="w-4 h-4" /><span>{error}</span></div>}

        {charts.length === 0 ? (
          <div className="text-center py-20">
            <TrendingUp className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-zinc-400">Noch keine Produkte</h2>
            <p className="text-zinc-500 mt-2">Deine Winning Product Charts erscheinen hier.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {charts.map((chart) => (
              <section key={chart.monat}>
                <motion.h2 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="text-xl font-bold mb-6 flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-lg"><TrendingUp className="w-5 h-5 text-indigo-400" /></div>
                  {formatMonth(chart.monat)}
                  <span className="text-sm font-normal text-zinc-500 ml-auto">{chart.produkte.length} Produkte</span>
                </motion.h2>

                <div className="space-y-2">
                  {chart.produkte.map((produkt, idx) => {
                    const rank = idx + 1;
                    const style = RANK_STYLES[rank];
                    const isTop3 = rank <= 3;

                    return (
                      <motion.div
                        key={produkt.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.06, duration: 0.4, ease: "easeOut" }}
                        className={`group flex items-center gap-4 border rounded-xl px-4 py-3 transition-all duration-300 hover:scale-[1.01] ${
                          isTop3
                            ? `${style.bg} ${style.border} ${style.glow}`
                            : "border-zinc-800/60 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700"
                        }`}
                      >
                        {/* Rank */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isTop3 ? style.bg : "bg-zinc-800"}`}>
                          {isTop3 ? (
                            <style.icon className={`w-5 h-5 ${style.text}`} />
                          ) : (
                            <span className="text-sm font-bold text-zinc-500">{rank}</span>
                          )}
                        </div>

                        {/* Thumbnail */}
                        <div className="w-12 h-12 rounded-lg bg-zinc-800 overflow-hidden shrink-0">
                          {produkt.bildUrl ? (
                            <img src={produkt.bildUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600"><ShoppingBag className="w-5 h-5" /></div>
                          )}
                        </div>

                        {/* Title & Stats */}
                        <div className="flex-1 min-w-0">
                          <h3 className={`font-semibold text-sm truncate ${isTop3 ? "text-white" : "text-zinc-200"}`}>{produkt.titel}</h3>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-lg font-bold text-indigo-400">{produkt.extra?.finances?.recommendedSellPrice || produkt.preis}&euro;</span>
                            {produkt.extra?.stats?.trendScore && (
                              <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                                <Zap className="w-3 h-3" />
                                Trend {produkt.extra.stats.trendScore}%
                              </span>
                            )}
                            {produkt.extra?.finances?.profitMargin && (
                              <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full hidden sm:flex">
                                <DollarSign className="w-3 h-3" />
                                +{produkt.extra.finances.profitMargin.toFixed(2)}&euro;
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setInfoModal({ open: true, produkt })}
                            className="px-3 py-2 text-sm text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition flex items-center gap-1.5"
                          >
                            <Info className="w-4 h-4" />
                            <span className="hidden sm:inline">Informationen</span>
                          </button>
                          {hasShopifyToken ? (
                            <button
                              onClick={() => handleImport(produkt)}
                              disabled={importingId === produkt.id}
                              className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition flex items-center gap-1.5"
                            >
                              {importingId === produkt.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Rocket className="w-4 h-4" /><span className="hidden sm:inline">Produkt importieren</span></>}
                            </button>
                          ) : (
                            <div className="px-4 py-2 text-sm text-zinc-500 bg-zinc-800 border border-zinc-700 rounded-lg flex items-center gap-1.5">
                              <AlertCircle className="w-4 h-4" />
                              <span className="hidden sm:inline">Nicht verbunden</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* ─── INFO MODAL ───────────────────────────────────────── */}
      <AnimatePresence>
        {infoModal.open && p && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={() => setInfoModal({ open: false, produkt: null })}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl relative max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close */}
              <button onClick={() => setInfoModal({ open: false, produkt: null })} className="absolute top-4 right-4 z-10 p-1.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-full transition"><X className="w-4 h-4" /></button>

              {/* Image Slideshow */}
              <div className="p-4 pb-0"><ImageSlideshow images={allImages} /></div>

              <div className="p-6 space-y-6">
                {/* Title & Price */}
                <div>
                  <h3 className="text-xl font-bold leading-tight">{p.titel}</h3>
                  {p.beschreibung && <div className="text-sm text-zinc-400 mt-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: p.beschreibung }} />}
                </div>

                {/* Stats */}
                {p.extra?.stats && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-400" />Premium Analytics</h4>
                    <div className="space-y-3">
                      <StatBar label="Viralitäts-Score" value={p.extra.stats.viralScore} icon={Zap} color="text-purple-400" delay={100} />
                      <StatBar label="Impulskauf-Faktor" value={p.extra.stats.impulseBuyFactor} icon={ShoppingBag} color="text-amber-400" delay={250} />
                      <StatBar label="Problemlöser-Index" value={p.extra.stats.problemSolverIndex} icon={Target} color="text-emerald-400" delay={400} />
                      <StatBar label="Marktsättigung" value={p.extra.stats.marketSaturation} icon={PieChart} color="text-red-400" delay={550} />
                    </div>
                  </div>
                )}

                {/* Finances */}
                {p.extra?.finances && (
                  <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-400" />Marge & Finanzen</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <div className="text-xs text-zinc-500 mb-1">Einkauf</div>
                        <div className="text-lg font-bold text-red-400">{p.extra.finances.buyPrice.toFixed(2)}&euro;</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-zinc-500 mb-1">Verkauf</div>
                        <div className="text-lg font-bold text-white">{p.extra.finances.recommendedSellPrice.toFixed(2)}&euro;</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-zinc-500 mb-1">Marge</div>
                        <div className="text-lg font-bold text-emerald-400">+{p.extra.finances.profitMargin.toFixed(2)}&euro;</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* AliExpress Link */}
                {p.aliExpressLink && (
                  <a href={p.aliExpressLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 transition">
                    <Link2 className="w-4 h-4" />AliExpress Supplier öffnen<ExternalLink className="w-3 h-3" />
                  </a>
                )}

                {/* Disclaimer */}
                <p className="text-[11px] text-zinc-600 leading-relaxed border-t border-zinc-800 pt-4">
                  Hinweis: Alle dargestellten Metriken, Margen und Scores basieren auf unseren internen Marktanalysen und aktuellen E-Commerce-Trends. Da der Markt dynamisch ist, können reale Einkaufspreise, Verfügbarkeiten und die Marktsättigung variieren. Diese Daten dienen als strategische Empfehlung und stellen keine Garantie für spezifische Umsätze oder Profite dar.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── SUCCESS MODAL ────────────────────────────────────── */}
      <AnimatePresence>
        {successModal.open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md relative">
              <button onClick={() => setSuccessModal({ open: false, aliExpressLink: "" })} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition"><X className="w-5 h-5" /></button>
              <div className="text-center mb-6">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }} className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 mb-4"><Check className="w-7 h-7 text-emerald-400" /></motion.div>
                <h3 className="text-lg font-bold">Produkt erfolgreich importiert!</h3>
                <p className="text-zinc-400 text-sm mt-2">Kopiere den Link und füge ihn in DSers ein:</p>
              </div>
              {successModal.aliExpressLink && (
                <>
                  <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-xl p-3">
                    <input type="text" value={successModal.aliExpressLink} readOnly className="flex-1 bg-transparent text-sm text-zinc-300 outline-none truncate" />
                    <button onClick={() => { navigator.clipboard.writeText(successModal.aliExpressLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="shrink-0 p-2 hover:bg-zinc-700 rounded-lg transition">
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-400" />}
                    </button>
                  </div>
                  <a href={successModal.aliExpressLink} target="_blank" rel="noopener noreferrer" className="mt-3 w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl font-medium transition text-sm flex items-center justify-center gap-2 text-zinc-300">
                    <ExternalLink className="w-4 h-4" />Link öffnen
                  </a>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── SETTINGS MODAL ───────────────────────────────────── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={() => { setShowSettings(false); setConnectError(""); }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-lg relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <button onClick={() => { setShowSettings(false); setConnectError(""); }} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition"><X className="w-5 h-5" /></button>
              <div className="mb-5">
                <h3 className="text-lg font-bold flex items-center gap-2"><Settings className="w-5 h-5 text-indigo-400" />Einstellungen</h3>
                <p className="text-zinc-400 text-sm mt-1">Shopify-Verbindung verwalten.</p>
              </div>
              {hasShopifyToken && <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-xl mb-4 text-sm"><Check className="w-4 h-4" />Shop verbunden{shopDomain ? `: ${shopDomain}` : ""}</div>}
              <div className="space-y-2 mb-4">
                <CopyField text={appUrl || "https://brospify-hub.vercel.app"} label="Hub-URL" />
                <CopyField text={`${appUrl || "https://brospify-hub.vercel.app"}/api/auth/shopify/callback`} label="Redirect-URL" />
                <CopyField text="read_products, write_products" label="Bereiche" />
              </div>
              <div className="space-y-3 mb-5">
                <div><label className="block text-xs text-zinc-400 mb-1.5 font-medium">Shop Domain</label><input type="text" value={shopDomain} onChange={e => setShopDomain(e.target.value)} placeholder="dein-shop.myshopify.com" className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm" /></div>
                <div><label className="block text-xs text-zinc-400 mb-1.5 font-medium">Client-ID</label><input type="text" value={clientId} onChange={e => setClientId(e.target.value)} placeholder="a1b2c3d4e5f6..." className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm font-mono" /></div>
                <div><label className="block text-xs text-zinc-400 mb-1.5 font-medium">Schlüssel (Client Secret)</label><input type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} placeholder="shpss_..." className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm font-mono" /></div>
              </div>
              {connectError && <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 px-4 py-3 rounded-xl mb-4"><AlertCircle className="w-4 h-4 shrink-0" /><span>{connectError}</span></div>}
              <button onClick={connectShop} disabled={connectLoading} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-medium transition text-sm flex items-center justify-center gap-2">
                {connectLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Store className="w-4 h-4" />Shop verbinden</>}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
