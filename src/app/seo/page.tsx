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
} from "lucide-react";
import Navigation from "@/components/Navigation";

interface SEOMetrics {
  missingAltTexts: number;
  missingMetaDescriptions: number;
  shortDescriptions: number;
  missingTitles: number;
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
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
  const [shopDomain, setShopDomain] = useState("");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.isLoggedIn) {
          router.push("/");
          return;
        }
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
      if (!res.ok) {
        setError(data.error || "Audit fehlgeschlagen.");
        return;
      }
      setAudit(data);
    } catch {
      setError("Verbindungsfehler. Bitte versuche es erneut.");
    } finally {
      setAuditing(false);
    }
  }, []);

  async function handleHeal() {
    if (!audit || audit.issues.length === 0) return;
    setHealing(true);
    setError("");
    setSuccess("");

    // Build fixes from audit issues
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
      setSuccess("Keine automatisch reparierbaren Fehler gefunden.");
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
        // Re-run audit after healing
        setTimeout(() => runAudit(), 2000);
      } else {
        setError(data.error || "Reparatur fehlgeschlagen.");
      }
    } catch {
      setError("Verbindungsfehler.");
    } finally {
      setHealing(false);
    }
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
    if (score >= 80) return "from-emerald-500/20 to-emerald-500/5";
    if (score >= 50) return "from-amber-500/20 to-amber-500/5";
    return "from-red-500/20 to-red-500/5";
  }

  function getScoreBorder(score: number) {
    if (score >= 80) return "border-emerald-500/20";
    if (score >= 50) return "border-amber-500/20";
    return "border-red-500/20";
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

      {/* Toasts */}
      <AnimatePresence>
        {(error || success) && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className={`fixed top-20 right-4 left-4 md:left-auto md:w-[400px] z-50 px-4 py-3 rounded-xl border text-[13px] flex items-center gap-2.5 backdrop-blur-2xl shadow-xl ${
              error
                ? "bg-red-500/10 border-red-500/15 text-red-300"
                : "bg-emerald-500/10 border-emerald-500/15 text-emerald-300"
            }`}
          >
            {error ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
            <span className="flex-1 text-xs">{error || success}</span>
            <button onClick={() => { setError(""); setSuccess(""); }} className="p-0.5 hover:bg-white/10 rounded transition">
              <span className="text-xs">&times;</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#95BF47]/20 to-[#95BF47]/5 border border-[#95BF47]/15 flex items-center justify-center">
                <Search className="w-5 h-5 text-[#95BF47]" />
              </div>
              SEO Audit
            </h1>
            <p className="text-sm text-zinc-500 mt-1.5">
              Echte SEO-Analyse deines Shopify-Shops
              {shopDomain && <span className="text-zinc-600"> &middot; {shopDomain}</span>}
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={runAudit}
            disabled={auditing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#95BF47] text-black font-bold text-sm disabled:opacity-50 transition shrink-0"
          >
            {auditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {auditing ? "Analysiere..." : "Audit starten"}
          </motion.button>
        </div>

        {/* No audit yet */}
        {!audit && !auditing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-5">
              <Shield className="w-10 h-10 text-zinc-800" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-400 mb-2">
              SEO Health Check
            </h3>
            <p className="text-sm text-zinc-600 max-w-md mx-auto mb-6">
              Analysiert deine echten Shopify-Produktdaten: Alt-Texte, Meta-Descriptions, Beschreibungslängen und mehr.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={runAudit}
              className="px-6 py-3 rounded-xl bg-[#95BF47] text-black font-bold text-sm"
            >
              Jetzt analysieren
            </motion.button>
          </motion.div>
        )}

        {/* Loading */}
        {auditing && (
          <div className="flex flex-col items-center py-20 gap-4">
            <div className="w-12 h-12 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-zinc-500">Produkte werden analysiert...</p>
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
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                  <div className="text-center p-3 rounded-xl bg-black/20">
                    <p className="text-2xl font-bold text-zinc-200">{audit.totalProducts}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Produkte</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-black/20">
                    <p className="text-2xl font-bold text-zinc-200">{audit.totalImages}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Bilder</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-black/20">
                    <p className="text-2xl font-bold text-zinc-200">{audit.issues.length}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Probleme</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-black/20">
                    <p className="text-2xl font-bold text-emerald-400">
                      {audit.totalProducts - audit.issues.length}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Fehlerfrei</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Fehlende Alt-Texte", value: audit.metrics.missingAltTexts, icon: ImageIcon, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/10" },
                { label: "Keine Meta-Desc.", value: audit.metrics.missingMetaDescriptions, icon: FileText, color: "text-red-400", bg: "bg-red-500/10 border-red-500/10" },
                { label: "Kurze Beschreib.", value: audit.metrics.shortDescriptions, icon: Type, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/10" },
                { label: "Schwache Titel", value: audit.metrics.missingTitles, icon: AlertTriangle, color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/10" },
              ].map((metric) => (
                <div key={metric.label} className={`rounded-xl border ${metric.bg} p-4`}>
                  <div className="flex items-center gap-2 mb-2">
                    <metric.icon className={`w-4 h-4 ${metric.color}`} />
                    <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">{metric.label}</span>
                  </div>
                  <p className={`text-3xl font-black ${metric.value > 0 ? metric.color : "text-emerald-400"}`}>
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>

            {/* 1-Click SEO Healer */}
            {audit.issues.length > 0 && (
              <div className="rounded-2xl border border-[#95BF47]/15 bg-[#95BF47]/5 p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold flex items-center gap-2">
                      <Zap className="w-5 h-5 text-[#95BF47]" />
                      1-Klick SEO Healer
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1">
                      Repariert automatisch fehlende Alt-Texte und Meta-Descriptions basierend auf dem Audit.
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleHeal}
                    disabled={healing}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#95BF47] text-black font-bold text-sm disabled:opacity-50 transition shrink-0"
                  >
                    {healing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {healing ? "Repariere..." : "Jetzt reparieren"}
                  </motion.button>
                </div>
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
                    <div
                      key={issue.productId}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
                    >
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
                        <span className="text-[11px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-medium shrink-0">
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
                            <div className="px-4 pb-3 space-y-1.5 border-t border-white/[0.04] pt-2">
                              {issue.problems.map((p, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs">
                                  <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
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
                <p className="text-sm text-zinc-500 mt-1">
                  Alle Produkte sind SEO-optimiert.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
