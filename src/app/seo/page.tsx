"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Shield,
  AlertTriangle,
  CheckCircle,
  ImageIcon,
  FileText,
  Type,
  Loader2,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Link2,
  BarChart3,
  Sparkles,
  X,
} from "lucide-react";
import Navigation from "@/components/Navigation";

interface SEOMetrics {
  missingAltTexts: number;
  missingMetaDescriptions: number;
  shortDescriptions: number;
  missingTitles: number;
  badUrlHandles: number;
  lowKeywordDensity: number;
}

interface ProductIssue {
  productId: number;
  productTitle: string;
  handle: string;
  problems: { type: string; detail: string }[];
}

interface AuditResult {
  score: number;
  totalProducts: number;
  totalImages: number;
  metrics: SEOMetrics;
  issues: ProductIssue[];
  message?: string;
}

export default function SEOPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [auditing, setAuditing] = useState(false);
  const [healing, setHealing] = useState(false);
  const [healingUrls, setHealingUrls] = useState(false);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
  const [shopDomain, setShopDomain] = useState("");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.isLoggedIn) { router.push("/"); return; }
        setShopDomain(data.shopDomain || "");
        setLoading(false);
      })
      .catch(() => router.push("/"));
  }, [router]);

  const runAudit = useCallback(async () => {
    setAuditing(true);
    setError("");
    setAudit(null);
    try {
      const res = await fetch("/api/shopify/seo-audit");
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Audit fehlgeschlagen."); return; }
      setAudit(data);
    } catch { setError("Verbindungsfehler."); }
    finally { setAuditing(false); }
  }, []);

  async function handleHeal() {
    if (!audit || audit.issues.length === 0) return;
    setHealing(true);
    setError("");
    setSuccess("");

    const fixes: Record<string, unknown>[] = [];
    for (const issue of audit.issues) {
      for (const problem of issue.problems) {
        if (problem.type === "missing_alt") {
          const imageIdMatch = problem.detail.match(/Bild (\d+)/);
          if (imageIdMatch) {
            fixes.push({
              type: "missing_alt",
              productId: issue.productId,
              imageId: Number(imageIdMatch[1]),
              productTitle: issue.productTitle,
              altText: issue.productTitle,
            });
          }
        } else if (problem.type === "missing_meta_description") {
          fixes.push({
            type: "missing_meta_description",
            productId: issue.productId,
            metaDescription: `${issue.productTitle} - Jetzt online kaufen. Schneller Versand, beste Qualität.`,
          });
        }
      }
    }

    if (fixes.length === 0) {
      setSuccess("Keine automatisch reparierbaren Alt-Text/Meta Fehler gefunden.");
      setHealing(false);
      return;
    }

    try {
      const res = await fetch("/api/shopify/seo-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixes }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`${data.fixed} von ${data.total} Problemen repariert!`);
        setTimeout(() => runAudit(), 2000);
      } else { setError(data.error || "Reparatur fehlgeschlagen."); }
    } catch { setError("Verbindungsfehler."); }
    finally { setHealing(false); }
  }

  async function handleHealUrls() {
    if (!audit) return;
    setHealingUrls(true);
    setError("");
    setSuccess("");

    const urlFixes: Record<string, unknown>[] = [];
    for (const issue of audit.issues) {
      for (const problem of issue.problems) {
        if (problem.type === "bad_url") {
          const cleanHandle = issue.handle
            .toLowerCase()
            .replace(/_/g, "-")
            .replace(/--+/g, "-")
            .replace(/[^a-z0-9-]/g, "")
            .slice(0, 60);
          urlFixes.push({
            type: "bad_url",
            productId: issue.productId,
            handle: cleanHandle,
          });
        }
      }
    }

    if (urlFixes.length === 0) {
      setSuccess("Keine URL-Probleme gefunden.");
      setHealingUrls(false);
      return;
    }

    // URL fixes via Shopify REST API
    try {
      const res = await fetch("/api/shopify/seo-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixes: urlFixes }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`${data.fixed} URLs optimiert!`);
        setTimeout(() => runAudit(), 2000);
      } else { setError(data.error || "URL-Optimierung fehlgeschlagen."); }
    } catch { setError("Verbindungsfehler."); }
    finally { setHealingUrls(false); }
  }

  function toggleProduct(productId: number) {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function getScoreColor(score: number) {
    if (score >= 80) return "text-emerald-400";
    if (score >= 50) return "text-amber-400";
    return "text-red-400";
  }

  function getScoreGradient(score: number) {
    if (score >= 80) return "from-emerald-500/15 to-emerald-500/[0.03]";
    if (score >= 50) return "from-amber-500/15 to-amber-500/[0.03]";
    return "from-red-500/15 to-red-500/[0.03]";
  }

  function getScoreBorder(score: number) {
    if (score >= 80) return "border-emerald-500/15";
    if (score >= 50) return "border-amber-500/15";
    return "border-red-500/15";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
          <p className="text-[11px] text-zinc-600 tracking-widest uppercase">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      {/* Ambient */}
      <div className="fixed top-32 right-8 w-60 h-60 bg-blue-500/[0.03] rounded-full blur-[100px] pointer-events-none" />

      {/* Toasts */}
      <AnimatePresence>
        {(error || success) && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className={`fixed top-20 right-4 left-4 md:left-auto md:w-[400px] z-50 px-4 py-3 rounded-xl border text-[13px] flex items-center gap-2.5 backdrop-blur-2xl shadow-xl ${
              error
                ? "bg-red-500/10 border-red-500/12 text-red-300"
                : "bg-emerald-500/10 border-emerald-500/12 text-emerald-300"
            }`}
          >
            {error ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
            <span className="flex-1 text-xs">{error || success}</span>
            <button onClick={() => { setError(""); setSuccess(""); }} className="p-0.5 hover:bg-white/10 rounded transition">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#95BF47]/15 to-[#95BF47]/[0.04] border border-[#95BF47]/12 flex items-center justify-center">
                <Search className="w-5 h-5 text-[#95BF47]" />
              </div>
              SEO Audit 2.0
            </h1>
            <p className="text-sm text-zinc-500 mt-1.5">
              Deep-Analyse: Alt-Texte, Meta-Tags, URL-Struktur & Keyword-Dichte
              {shopDomain && <span className="text-zinc-600"> &middot; {shopDomain}</span>}
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={runAudit}
            disabled={auditing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#95BF47] text-black font-bold text-sm disabled:opacity-50 transition shrink-0 shadow-lg shadow-[#95BF47]/15"
          >
            {auditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {auditing ? "Analysiere..." : "Audit starten"}
          </motion.button>
        </div>

        {/* No audit yet */}
        {!audit && !auditing && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center mx-auto mb-5">
              <Shield className="w-10 h-10 text-zinc-800" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-400 mb-2">SEO Deep Audit</h3>
            <p className="text-sm text-zinc-600 max-w-md mx-auto mb-6">
              Analysiert deine echten Shopify-Daten: Alt-Texte, Meta-Tags, URL-Handles, Keyword-Dichte und mehr.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={runAudit}
              className="px-6 py-3 rounded-xl bg-[#95BF47] text-black font-bold text-sm shadow-lg shadow-[#95BF47]/15"
            >
              Jetzt analysieren
            </motion.button>
          </motion.div>
        )}

        {/* Loading */}
        {auditing && (
          <div className="flex flex-col items-center py-20 gap-4">
            <div className="w-12 h-12 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-zinc-500">Deep-Analyse läuft...</p>
          </div>
        )}

        {/* Results */}
        {audit && !auditing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Score Card */}
            <div className={`rounded-2xl border ${getScoreBorder(audit.score)} bg-gradient-to-br ${getScoreGradient(audit.score)} p-6 md:p-8`}>
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="text-center">
                  <div className={`text-6xl md:text-7xl font-black tabular-nums ${getScoreColor(audit.score)}`}>
                    {audit.score}
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">SEO Score</p>
                </div>
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
                  {[
                    { label: "Produkte", value: audit.totalProducts },
                    { label: "Bilder", value: audit.totalImages },
                    { label: "Probleme", value: audit.issues.length },
                    { label: "Fehlerfrei", value: audit.totalProducts - audit.issues.length, color: "text-emerald-400" },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center p-3 rounded-xl bg-black/20 border border-white/[0.03]">
                      <p className={`text-2xl font-bold ${stat.color || "text-zinc-200"}`}>{stat.value}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Metrics Grid — Now 6 cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: "Fehlende Alt-Texte", value: audit.metrics.missingAltTexts, icon: ImageIcon, color: "text-orange-400", bg: "bg-orange-500/8 border-orange-500/8" },
                { label: "Keine Meta-Desc.", value: audit.metrics.missingMetaDescriptions, icon: FileText, color: "text-red-400", bg: "bg-red-500/8 border-red-500/8" },
                { label: "Kurze Beschreib.", value: audit.metrics.shortDescriptions, icon: Type, color: "text-amber-400", bg: "bg-amber-500/8 border-amber-500/8" },
                { label: "Schwache Titel", value: audit.metrics.missingTitles, icon: AlertTriangle, color: "text-pink-400", bg: "bg-pink-500/8 border-pink-500/8" },
                { label: "Schlechte URLs", value: audit.metrics.badUrlHandles, icon: Link2, color: "text-violet-400", bg: "bg-violet-500/8 border-violet-500/8" },
                { label: "Niedrige Keywords", value: audit.metrics.lowKeywordDensity, icon: BarChart3, color: "text-cyan-400", bg: "bg-cyan-500/8 border-cyan-500/8" },
              ].map((metric) => (
                <div key={metric.label} className={`rounded-xl border ${metric.bg} p-4`}>
                  <div className="flex items-center gap-2 mb-2">
                    <metric.icon className={`w-4 h-4 ${metric.color}`} />
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">{metric.label}</span>
                  </div>
                  <p className={`text-3xl font-black ${metric.value > 0 ? metric.color : "text-emerald-400"}`}>
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Action Buttons Section */}
            {audit.issues.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1-Click SEO Healer */}
                <div className="rounded-2xl border border-[#95BF47]/12 bg-[#95BF47]/[0.04] p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#95BF47]/15 border border-[#95BF47]/20 flex items-center justify-center shrink-0">
                      <Zap className="w-5 h-5 text-[#95BF47]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold mb-0.5">Alt-Texte & Meta-Tags reparieren</h3>
                      <p className="text-[11px] text-zinc-500 mb-3">
                        Fehlende Alt-Texte und Meta-Descriptions automatisch generieren.
                      </p>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleHeal}
                        disabled={healing}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#95BF47] text-black font-bold text-xs disabled:opacity-50 transition shadow-md shadow-[#95BF47]/15"
                      >
                        {healing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                        {healing ? "Repariere..." : "Jetzt reparieren"}
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* URL Optimizer */}
                {audit.metrics.badUrlHandles > 0 && (
                  <div className="rounded-2xl border border-violet-500/12 bg-violet-500/[0.04] p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
                        <Link2 className="w-5 h-5 text-violet-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold mb-0.5">URLs jetzt optimieren</h3>
                        <p className="text-[11px] text-zinc-500 mb-3">
                          {audit.metrics.badUrlHandles} URL-Handles bereinigen (Lowercase, Bindestriche).
                        </p>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={handleHealUrls}
                          disabled={healingUrls}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500 text-white font-bold text-xs disabled:opacity-50 transition shadow-md shadow-violet-500/15"
                        >
                          {healingUrls ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                          {healingUrls ? "Optimiere..." : "URLs optimieren"}
                        </motion.button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Keyword Booster */}
                {audit.metrics.lowKeywordDensity > 0 && (
                  <div className="rounded-2xl border border-cyan-500/12 bg-cyan-500/[0.04] p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5 text-cyan-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold mb-0.5">Keyword-Dichte verbessern</h3>
                        <p className="text-[11px] text-zinc-500 mb-3">
                          {audit.metrics.lowKeywordDensity} Produkte mit zu niedriger Keyword-Dichte. Nutze den Blog-Generator.
                        </p>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => router.push("/blog")}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 text-black font-bold text-xs transition shadow-md shadow-cyan-500/15"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Zum Blog-Generator
                        </motion.button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Issue List */}
            {audit.issues.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wider">
                  Betroffene Produkte ({audit.issues.length})
                </h3>
                <div className="space-y-2">
                  {audit.issues.map((issue) => (
                    <div key={issue.productId} className="rounded-xl border border-white/[0.04] bg-white/[0.02] overflow-hidden">
                      <button
                        onClick={() => toggleProduct(issue.productId)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition text-left"
                      >
                        {expandedProducts.has(issue.productId) ? (
                          <ChevronDown className="w-4 h-4 text-zinc-600 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
                        )}
                        <span className="text-sm font-medium text-zinc-300 flex-1 truncate">
                          {issue.productTitle}
                        </span>
                        <span className="text-[10px] bg-red-500/8 text-red-400 px-2 py-0.5 rounded-full font-medium shrink-0">
                          {issue.problems.length} {issue.problems.length === 1 ? "Problem" : "Probleme"}
                        </span>
                        {shopDomain && (
                          <a
                            href={`https://${shopDomain}/products/${issue.handle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-zinc-600 hover:text-[#95BF47] transition p-1"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </button>
                      <AnimatePresence>
                        {expandedProducts.has(issue.productId) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-3 space-y-1.5 border-t border-white/[0.03] pt-2">
                              {issue.problems.map((p, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs">
                                  <AlertTriangle className={`w-3 h-3 mt-0.5 shrink-0 ${
                                    p.type === "bad_url" ? "text-violet-400" :
                                    p.type === "low_keyword_density" ? "text-cyan-400" : "text-amber-400"
                                  }`} />
                                  <span className="text-zinc-400">{p.detail}</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All good */}
            {audit.issues.length === 0 && (
              <div className="text-center py-10">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-emerald-400">Perfekt!</h3>
                <p className="text-sm text-zinc-500 mt-1">Alle Produkte sind SEO-optimiert.</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
