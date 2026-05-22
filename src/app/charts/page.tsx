"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  Info,
  BarChart3,
  Zap,
  ShoppingBag,
  Target,
  PieChart,
  DollarSign,
  Link2,
  Sparkles,
  ArrowRight,
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

// Uniform styling — no aggressive top-3 highlighting

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
          <button onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 rounded-full">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setIdx((i) => (i + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 rounded-full">
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)} className={`w-2 h-2 rounded-full ${i === idx ? "bg-white" : "bg-white/30"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Copy Field ──────────────────────────────────────────────────

function CopyField({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">{label}</div>
        <div className="text-xs text-zinc-200 font-mono truncate">{text}</div>
      </div>
      <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="shrink-0 flex items-center gap-1 px-2 py-1 bg-white/5 rounded-lg text-xs">
        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-zinc-400" />}
      </button>
    </div>
  );
}

// ─── Main Charts Page ────────────────────────────────────────────

export default function ChartsPage() {
  const router = useRouter();
  const [produkte, setProdukte] = useState<Produkt[]>([]);
  const [loading, setLoading] = useState(true);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState<{ open: boolean; aliExpressLink: string }>({ open: false, aliExpressLink: "" });
  const [infoModal, setInfoModal] = useState<{ open: boolean; produkt: Produkt | null }>({ open: false, produkt: null });
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [hasShopifyToken, setHasShopifyToken] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highMarginOnly, setHighMarginOnly] = useState(false);

  // AI Import Modal
  const [aiModal, setAiModal] = useState<{ open: boolean; produkt: Produkt | null }>({ open: false, produkt: null });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ title: string; body_html: string; tags?: string } | null>(null);
  const [aiImporting, setAiImporting] = useState(false);
  const [aiError, setAiError] = useState("");

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      if (res.status === 401) { router.push("/"); return; }
      const data = await res.json();
      setProdukte(data.produkte || []);
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

  // Apply search + filter — must run BEFORE any early return
  // (Rules of Hooks: useMemo can't be called conditionally)
  const filteredProdukte = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return produkte.filter((pr) => {
      if (q && !pr.titel.toLowerCase().includes(q)) return false;
      if (highMarginOnly && (pr.extra?.finances?.profitMargin ?? 0) < 15) return false;
      return true;
    });
  }, [produkte, searchTerm, highMarginOnly]);
  const totalProducts = produkte.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const p = infoModal.produkt;
  const allImages = p ? [...new Set([p.bildUrl, ...(p.extra?.images || [])].filter(Boolean))] : [];

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      <main className="max-w-6xl mx-auto px-3 sm:px-5 py-3 sm:py-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#95BF47] shrink-0" />
              <span className="truncate">Winning Charts</span>
            </h1>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Top-Dropshipping-Produkte · Rankings · 1-Klick-Import
            </p>
          </div>
          {totalProducts > 0 && (
            <div className="text-right shrink-0">
              <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">Produkte</div>
              <div className="text-sm font-bold text-[#95BF47] tabular-nums">{totalProducts}</div>
            </div>
          )}
        </div>

        {/* Search + filter */}
        {produkte.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <BarChart3 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Produkt suchen…"
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg pl-7 pr-3 py-1.5 text-[12px] outline-none focus:border-white/25 transition placeholder:text-zinc-600"
              />
            </div>
            <button
              onClick={() => setHighMarginOnly((v) => !v)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition shrink-0 ${
                highMarginOnly
                  ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300"
                  : "bg-white/[0.03] border-white/10 text-zinc-400"
              }`}
            >
              <DollarSign className="w-3 h-3" />
              Top-Marge
            </button>
          </div>
        )}

        {/* Token banner — slim on mobile */}
        {!hasShopifyToken && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 px-3 py-2.5 rounded-xl">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <p className="flex-1 text-[11px] leading-snug">
              <span className="font-semibold">Shop nicht verbunden.</span>{" "}
              <span className="hidden sm:inline">1-Klick-Import deaktiviert.</span>
            </p>
            <button onClick={() => router.push("/setup")} className="shrink-0 btn-accent px-2.5 py-1.5 rounded-lg text-[11px] font-medium">
              Verbinden
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/10 border border-red-500/20 px-3 py-2 rounded-xl">
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError("")}><X className="w-3 h-3" /></button>
          </div>
        )}

        {filteredProdukte.length === 0 ? (
          <div className="text-center py-12">
            <TrendingUp className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
            <h2 className="text-base font-semibold text-zinc-400">
              {produkte.length === 0 ? "Noch keine Produkte" : "Nichts gefunden"}
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              {produkte.length === 0
                ? "Deine Winning Product Charts erscheinen hier."
                : "Probier einen anderen Suchbegriff oder deaktiviere den Filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredProdukte.map((produkt, idx) => {
              const rank = idx + 1;
              return (
                <div
                  key={produkt.id}
                  className="flex items-center gap-2 border border-white/10 bg-white/[0.03] rounded-lg px-2 py-2 backdrop-blur-md hover:bg-white/[0.06] transition"
                >
                        {/* Rank */}
                        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-white/5">
                          <span className="text-[11px] font-bold text-zinc-400 tabular-nums">{rank}</span>
                        </div>

                        {/* Thumbnail */}
                        <div className="w-10 h-10 rounded-md bg-white/5 overflow-hidden shrink-0">
                          {produkt.bildUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={produkt.bildUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                              <ShoppingBag className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>

                        {/* Title & Stats */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-[12px] truncate text-zinc-200 leading-tight">{produkt.titel}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-sm font-bold text-[#95BF47] tabular-nums">
                              {produkt.extra?.finances?.recommendedSellPrice || produkt.preis}€
                            </span>
                            {produkt.extra?.stats?.trendScore && (
                              <span className="flex items-center gap-0.5 text-[9px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">
                                <Zap className="w-2.5 h-2.5" />
                                {produkt.extra.stats.trendScore}%
                              </span>
                            )}
                            {produkt.extra?.finances?.profitMargin && (
                              <span className="hidden sm:flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                                <DollarSign className="w-3 h-3" />
                                +{produkt.extra.finances.profitMargin.toFixed(2)}€
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setInfoModal({ open: true, produkt })}
                            className="p-1.5 text-zinc-400 bg-white/5 border border-white/10 rounded-md"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                          {hasShopifyToken ? (
                            <button
                              onClick={() => { setAiModal({ open: true, produkt }); setAiResult(null); setAiError(""); }}
                              className="btn-accent px-2 py-1.5 text-xs font-medium rounded-md flex items-center gap-1"
                            >
                              <Rocket className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Import</span>
                            </button>
                          ) : (
                            <div className="p-1.5 text-zinc-500 bg-white/5 border border-white/10 rounded-md">
                              <AlertCircle className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ─── INFO MODAL ───────────────────────────────────────── */}
      <AnimatePresence>
        {infoModal.open && p && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={() => setInfoModal({ open: false, produkt: null })}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl relative max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setInfoModal({ open: false, produkt: null })} className="absolute top-4 right-4 z-10 p-1.5 bg-zinc-800 rounded-full"><X className="w-4 h-4" /></button>

              <div className="p-4 pb-0"><ImageSlideshow images={allImages} /></div>

              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-xl font-bold leading-tight">{p.titel}</h3>
                  {p.beschreibung && <div className="text-sm text-zinc-400 mt-2 leading-relaxed [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-zinc-200 [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:font-semibold [&_h3]:text-zinc-200 [&_h3]:mt-2 [&_strong]:font-semibold [&_strong]:text-zinc-200" dangerouslySetInnerHTML={{ __html: p.beschreibung }} />}
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
                  <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-3">
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
                  <a href={p.aliExpressLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-orange-400">
                    <Link2 className="w-4 h-4" />AliExpress Supplier öffnen<ExternalLink className="w-3 h-3" />
                  </a>
                )}

                <p className="text-[11px] text-zinc-600 leading-relaxed border-t border-zinc-800 pt-4">
                  Hinweis: Alle dargestellten Metriken, Margen und Scores basieren auf unseren internen Marktanalysen und aktuellen E-Commerce-Trends. Da der Markt dynamisch ist, können reale Einkaufspreise, Verfügbarkeiten und die Marktsättigung variieren. Diese Daten dienen als strategische Empfehlung und stellen keine Garantie für spezifische Umsätze oder Profite dar.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── AI IMPORT MODAL ─────────────────────────────────── */}
      <AnimatePresence>
        {aiModal.open && aiModal.produkt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={() => { if (!aiLoading && !aiImporting) setAiModal({ open: false, produkt: null }); }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg relative max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => { if (!aiLoading && !aiImporting) setAiModal({ open: false, produkt: null }); }} className="absolute top-4 right-4 z-10 p-1.5 bg-zinc-800 rounded-full"><X className="w-4 h-4" /></button>

              <div className="p-6 space-y-5">
                {/* Product Preview */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-white/5 overflow-hidden shrink-0">
                    {aiModal.produkt.bildUrl ? <img src={aiModal.produkt.bildUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-600"><ShoppingBag className="w-6 h-6" /></div>}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold truncate">{aiResult?.title || aiModal.produkt.titel}</h3>
                    <p className="text-sm text-[#95BF47] font-semibold">{aiModal.produkt.extra?.finances?.recommendedSellPrice || aiModal.produkt.preis}&euro;</p>
                  </div>
                </div>

                {aiError && (
                  <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />{aiError}
                  </div>
                )}

                {/* AI Result Preview */}
                {aiResult && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-purple-400">
                      <Sparkles className="w-4 h-4" />KI-optimierter Text
                    </div>
                    <div className="bg-zinc-800/80 border border-zinc-700 rounded-xl p-4 max-h-60 overflow-y-auto">
                      <h4 className="font-bold text-sm mb-2">{aiResult.title}</h4>
                      <div className="text-xs text-zinc-400 leading-relaxed prose-invert" dangerouslySetInnerHTML={{ __html: aiResult.body_html }} />
                    </div>
                    {aiResult.tags && (
                      <div className="flex flex-wrap gap-1.5">
                        {aiResult.tags.split(",").map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 bg-purple-500/10 text-purple-300 text-[10px] rounded-full">{tag.trim()}</span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={async () => {
                        setAiImporting(true); setAiError("");
                        try {
                          const res = await fetch("/api/products/import", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ produktId: aiModal.produkt!.id, optimizedTitle: aiResult.title, optimizedBodyHtml: aiResult.body_html }),
                          });
                          const data = await res.json();
                          if (!res.ok) { setAiError(data.error || "Import fehlgeschlagen"); return; }
                          setAiModal({ open: false, produkt: null });
                          setSuccessModal({ open: true, aliExpressLink: data.aliExpressLink || aiModal.produkt!.aliExpressLink || "" });
                        } catch { setAiError("Import fehlgeschlagen."); }
                        finally { setAiImporting(false); }
                      }}
                      disabled={aiImporting}
                      className="w-full btn-accent py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {aiImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Rocket className="w-4 h-4" />KI-Text importieren</>}
                    </button>
                  </div>
                )}

                {/* Action Buttons (before AI result) */}
                {!aiResult && (
                  <div className="space-y-3">
                    <button
                      onClick={async () => {
                        setAiLoading(true); setAiError("");
                        try {
                          const res = await fetch("/api/products/ai-optimize", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ produktId: aiModal.produkt!.id }),
                          });
                          const data = await res.json();
                          if (!res.ok) { setAiError(data.error || "KI-Optimierung fehlgeschlagen"); return; }
                          setAiResult(data.optimized);
                        } catch { setAiError("Verbindung fehlgeschlagen."); }
                        finally { setAiLoading(false); }
                      }}
                      disabled={aiLoading || aiImporting}
                      className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2.5 bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 transition disabled:opacity-50"
                    >
                      {aiLoading ? (
                        <><Loader2 className="w-5 h-5 animate-spin" />KI analysiert Produkt...</>
                      ) : (
                        <><Sparkles className="w-5 h-5" />KI-Optimierung<ArrowRight className="w-4 h-4" /></>
                      )}
                    </button>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800" /></div>
                      <div className="relative flex justify-center text-xs"><span className="px-3 bg-zinc-900 text-zinc-600">oder</span></div>
                    </div>

                    <button
                      onClick={async () => {
                        setAiImporting(true); setAiError("");
                        try {
                          const res = await fetch("/api/products/import", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ produktId: aiModal.produkt!.id }),
                          });
                          const data = await res.json();
                          if (!res.ok) { setAiError(data.error || "Import fehlgeschlagen"); return; }
                          setAiModal({ open: false, produkt: null });
                          setSuccessModal({ open: true, aliExpressLink: data.aliExpressLink || aiModal.produkt!.aliExpressLink || "" });
                        } catch { setAiError("Import fehlgeschlagen."); }
                        finally { setAiImporting(false); }
                      }}
                      disabled={aiLoading || aiImporting}
                      className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2.5 glass border border-white/10 text-zinc-300 hover:bg-white/5 transition disabled:opacity-50"
                    >
                      {aiImporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Rocket className="w-5 h-5" />Direkt-Import (Skip AI)</>}
                    </button>

                    <p className="text-[10px] text-zinc-600 text-center">KI-Optimierung nutzt DeepSeek AI, um Titel &amp; Beschreibung verkaufsstark zu formulieren. (3x pro Monat verfügbar)</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── SUCCESS MODAL ────────────────────────────────────── */}
      <AnimatePresence>
        {successModal.open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md relative">
              <button onClick={() => setSuccessModal({ open: false, aliExpressLink: "" })} className="absolute top-4 right-4 text-zinc-500"><X className="w-5 h-5" /></button>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 mb-4"><Check className="w-7 h-7 text-emerald-400" /></div>
                <h3 className="text-lg font-bold">Produkt erfolgreich importiert!</h3>
                <p className="text-zinc-400 text-sm mt-2">Kopiere den Link und füge ihn in DSers ein:</p>
              </div>
              {successModal.aliExpressLink && (
                <>
                  <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-xl p-3">
                    <input type="text" value={successModal.aliExpressLink} readOnly className="flex-1 bg-transparent text-sm text-zinc-300 outline-none truncate" />
                    <button onClick={() => { navigator.clipboard.writeText(successModal.aliExpressLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="shrink-0 p-2 rounded-lg">
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-400" />}
                    </button>
                  </div>
                  <a href={successModal.aliExpressLink} target="_blank" rel="noopener noreferrer" className="mt-3 w-full py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl font-medium text-sm flex items-center justify-center gap-2 text-zinc-300">
                    <ExternalLink className="w-4 h-4" />Link öffnen
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
