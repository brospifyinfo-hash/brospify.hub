"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Check,
  Copy,
  X,
  TrendingUp,
  ExternalLink,
  AlertCircle,
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
import Navigation from "@/components/Navigation";

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
  1: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", glow: "shadow-amber-500/20 shadow-lg", icon: Crown },
  2: { bg: "bg-slate-300/10", border: "border-slate-400/30", text: "text-slate-300", glow: "shadow-slate-400/15 shadow-lg", icon: Medal },
  3: { bg: "bg-orange-700/10", border: "border-orange-600/30", text: "text-orange-400", glow: "shadow-orange-500/15 shadow-lg", icon: Award },
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
      <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
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
  if (images.length === 0) return <div className="aspect-video bg-white/5 rounded-xl flex items-center justify-center text-zinc-600">Kein Bild</div>;

  return (
    <div className="relative aspect-video bg-white/5 rounded-xl overflow-hidden">
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
          <button onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 glass rounded-full transition hover:bg-white/10">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setIdx((i) => (i + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 glass rounded-full transition hover:bg-white/10">
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

// ─── Main Charts Page ────────────────────────────────────────────

export default function ChartsPage() {
  const router = useRouter();
  const [charts, setCharts] = useState<MonthChart[]>([]);
  const [loading, setLoading] = useState(true);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState<{ open: boolean; aliExpressLink: string }>({ open: false, aliExpressLink: "" });
  const [infoModal, setInfoModal] = useState<{ open: boolean; produkt: Produkt | null }>({ open: false, produkt: null });
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [hasShopifyToken, setHasShopifyToken] = useState(false);

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
      if (!data.isLoggedIn) { router.push("/"); return; }
      setHasShopifyToken(data.hasShopifyToken || false);
    });
    loadProducts();
  }, [loadProducts, router]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const p = infoModal.produkt;
  const allImages = p ? [p.bildUrl, ...(p.extra?.images || [])].filter(Boolean) : [];

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      {/* Ambient glow */}
      <div className="fixed top-40 left-10 w-72 h-72 bg-[#95BF47]/8 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-20 right-20 w-80 h-80 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-[#95BF47]" />
            Winning Product Charts
          </h1>
          <p className="text-zinc-400">
            Die besten Dropshipping-Produkte mit Rankings, Analysen &amp; 1-Klick Import.
          </p>
        </motion.div>

        {/* No Token Banner */}
        {!hasShopifyToken && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 glass border border-amber-500/20 text-amber-300 px-5 py-4 rounded-xl mb-8">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Shopify nicht verbunden</p>
              <p className="text-xs text-amber-400/70 mt-0.5">1-Klick-Import deaktiviert. Verbinde deinen Shop unter Setup.</p>
            </div>
            <button onClick={() => router.push("/setup")} className="shrink-0 btn-accent px-4 py-2 rounded-lg text-sm font-medium">Verbinden</button>
          </motion.div>
        )}

        {error && <div className="flex items-center gap-2 text-red-400 text-sm glass border border-red-500/20 px-4 py-3 rounded-xl mb-6"><AlertCircle className="w-4 h-4" /><span>{error}</span></div>}

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
                  <div className="p-2 bg-[#95BF47]/10 rounded-lg border border-[#95BF47]/20"><TrendingUp className="w-5 h-5 text-[#95BF47]" /></div>
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
                        className={`group flex items-center gap-4 border rounded-xl px-4 py-3 transition-all duration-300 hover:scale-[1.01] backdrop-blur-md ${
                          isTop3
                            ? `${style.bg} ${style.border} ${style.glow}`
                            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20"
                        }`}
                      >
                        {/* Rank */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isTop3 ? style.bg : "bg-white/5"}`}>
                          {isTop3 ? (
                            <style.icon className={`w-5 h-5 ${style.text}`} />
                          ) : (
                            <span className="text-sm font-bold text-zinc-500">{rank}</span>
                          )}
                        </div>

                        {/* Thumbnail */}
                        <div className="w-12 h-12 rounded-lg bg-white/5 overflow-hidden shrink-0">
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
                            <span className="text-lg font-bold text-[#95BF47]">{produkt.extra?.finances?.recommendedSellPrice || produkt.preis}&euro;</span>
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
                            className="px-3 py-2 text-sm text-zinc-400 hover:text-white glass hover:bg-white/10 border border-white/10 rounded-lg transition flex items-center gap-1.5"
                          >
                            <Info className="w-4 h-4" />
                            <span className="hidden sm:inline">Info</span>
                          </button>
                          {hasShopifyToken ? (
                            <button
                              onClick={() => handleImport(produkt)}
                              disabled={importingId === produkt.id}
                              className="btn-accent px-4 py-2 text-sm font-medium rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                            >
                              {importingId === produkt.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Rocket className="w-4 h-4" /><span className="hidden sm:inline">Import</span></>}
                            </button>
                          ) : (
                            <div className="px-4 py-2 text-sm text-zinc-500 glass border border-white/10 rounded-lg flex items-center gap-1.5">
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
              className="glass-strong border border-white/10 rounded-2xl w-full max-w-xl relative max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setInfoModal({ open: false, produkt: null })} className="absolute top-4 right-4 z-10 p-1.5 glass hover:bg-white/10 rounded-full transition"><X className="w-4 h-4" /></button>

              <div className="p-4 pb-0"><ImageSlideshow images={allImages} /></div>

              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-xl font-bold leading-tight">{p.titel}</h3>
                  {p.beschreibung && <div className="text-sm text-zinc-400 mt-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: p.beschreibung }} />}
                </div>

                {p.extra?.stats && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-[#95BF47]" />Premium Analytics</h4>
                    <div className="space-y-3">
                      <StatBar label="Viralitäts-Score" value={p.extra.stats.viralScore} icon={Zap} color="text-purple-400" delay={100} />
                      <StatBar label="Impulskauf-Faktor" value={p.extra.stats.impulseBuyFactor} icon={ShoppingBag} color="text-amber-400" delay={250} />
                      <StatBar label="Problemlöser-Index" value={p.extra.stats.problemSolverIndex} icon={Target} color="text-emerald-400" delay={400} />
                      <StatBar label="Marktsättigung" value={p.extra.stats.marketSaturation} icon={PieChart} color="text-red-400" delay={550} />
                    </div>
                  </div>
                )}

                {p.extra?.finances && (
                  <div className="glass border border-white/10 rounded-xl p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-400" />Marge &amp; Finanzen</h4>
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

                {p.aliExpressLink && (
                  <a href={p.aliExpressLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 transition">
                    <Link2 className="w-4 h-4" />AliExpress Supplier &ouml;ffnen<ExternalLink className="w-3 h-3" />
                  </a>
                )}

                <p className="text-[11px] text-zinc-600 leading-relaxed border-t border-white/10 pt-4">
                  Hinweis: Alle dargestellten Metriken, Margen und Scores basieren auf unseren internen Marktanalysen und aktuellen E-Commerce-Trends. Da der Markt dynamisch ist, k&ouml;nnen reale Einkaufspreise, Verf&uuml;gbarkeiten und die Marks&auml;ttigung variieren. Diese Daten dienen als strategische Empfehlung und stellen keine Garantie f&uuml;r spezifische Ums&auml;tze oder Profite dar.
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
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="glass-strong border border-white/10 rounded-2xl p-6 w-full max-w-md relative">
              <button onClick={() => setSuccessModal({ open: false, aliExpressLink: "" })} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition"><X className="w-5 h-5" /></button>
              <div className="text-center mb-6">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }} className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 mb-4"><Check className="w-7 h-7 text-emerald-400" /></motion.div>
                <h3 className="text-lg font-bold">Produkt erfolgreich importiert!</h3>
                <p className="text-zinc-400 text-sm mt-2">Kopiere den Link und f&uuml;ge ihn in DSers ein:</p>
              </div>
              {successModal.aliExpressLink && (
                <>
                  <div className="flex items-center gap-2 glass border border-white/10 rounded-xl p-3">
                    <input type="text" value={successModal.aliExpressLink} readOnly className="flex-1 bg-transparent text-sm text-zinc-300 outline-none truncate" />
                    <button onClick={() => { navigator.clipboard.writeText(successModal.aliExpressLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="shrink-0 p-2 hover:bg-white/10 rounded-lg transition">
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-400" />}
                    </button>
                  </div>
                  <a href={successModal.aliExpressLink} target="_blank" rel="noopener noreferrer" className="mt-3 w-full py-2.5 glass hover:bg-white/10 border border-white/10 rounded-xl font-medium transition text-sm flex items-center justify-center gap-2 text-zinc-300">
                    <ExternalLink className="w-4 h-4" />Link &ouml;ffnen
                  </a>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
