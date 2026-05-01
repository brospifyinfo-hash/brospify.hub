"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, ShoppingCart, Truck, RefreshCw, UserPlus, AlertCircle,
  XCircle, KeyRound, UserCheck, Package, FileText,
  Wand2, Eye, Code2, Monitor, Smartphone, Rocket,
  Check, Loader2, Copy, ChevronRight, Zap, Sparkles,
  RotateCcw, Download, X,
} from "lucide-react";
import Navigation from "@/components/Navigation";

// ─── Template Definitions ───────────────────────────────────────────────────

interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  badge: string;
}

const TEMPLATES: EmailTemplate[] = [
  {
    id: "order_confirmation",
    name: "Bestellbestätigung",
    description: "Sofort nach jedem Kauf",
    icon: ShoppingCart,
    color: "#95BF47",
    badge: "Häufig",
  },
  {
    id: "shipping_confirmation",
    name: "Versandbestätigung",
    description: "Tracking-Link & Status",
    icon: Truck,
    color: "#3B82F6",
    badge: "Wichtig",
  },
  {
    id: "abandoned_checkout",
    name: "Checkout Recovery",
    description: "Warenkorbabbrecher zurückholen",
    icon: ShoppingCart,
    color: "#F59E0B",
    badge: "Revenue",
  },
  {
    id: "customer_welcome",
    name: "Willkommens-Mail",
    description: "Erster Eindruck zählt",
    icon: UserPlus,
    color: "#8B5CF6",
    badge: "Retention",
  },
  {
    id: "refund_notification",
    name: "Rückerstattung",
    description: "Vertrauen durch Transparenz",
    icon: RefreshCw,
    color: "#EC4899",
    badge: "Service",
  },
  {
    id: "order_cancelled",
    name: "Stornierung",
    description: "Klar & professionell",
    icon: XCircle,
    color: "#EF4444",
    badge: "Service",
  },
  {
    id: "password_reset",
    name: "Passwort Reset",
    description: "Sicher & schnell",
    icon: KeyRound,
    color: "#6366F1",
    badge: "Account",
  },
  {
    id: "account_activation",
    name: "Konto aktivieren",
    description: "Willkommen an Bord",
    icon: UserCheck,
    color: "#10B981",
    badge: "Account",
  },
  {
    id: "fulfillment_request",
    name: "Lieferbestätigung",
    description: "Fulfillment-Status",
    icon: Package,
    color: "#F97316",
    badge: "Logistik",
  },
  {
    id: "invoice",
    name: "Rechnungsentwurf",
    description: "Pro-forma & Invoices",
    icon: FileText,
    color: "#A78BFA",
    badge: "Finanzen",
  },
];

const TONES = [
  { id: "professional", label: "Professional", emoji: "🏢", desc: "Sachlich & präzise" },
  { id: "friendly", label: "Friendly", emoji: "😊", desc: "Herzlich & persönlich" },
  { id: "bold", label: "Bold", emoji: "⚡", desc: "Kraftvoll & direkt" },
  { id: "luxury", label: "Luxury", emoji: "✨", desc: "Exklusiv & edel" },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function EmailsPage() {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Session
  const [session, setSession] = useState<{ isLoggedIn: boolean; isAdmin: boolean } | null>(null);

  // Selection
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate>(TEMPLATES[0]);

  // Form
  const [tone, setTone] = useState("professional");
  const [brandName, setBrandName] = useState("");
  const [extraInfo, setExtraInfo] = useState("");

  // Generation
  const [generating, setGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [genError, setGenError] = useState("");

  // Preview
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");

  // Deploy
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [deployError, setDeployError] = useState("");

  // Copy
  const [copied, setCopied] = useState(false);

  // Auth
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.isLoggedIn) { router.push("/"); return; }
        setSession(data);
      })
      .catch(() => router.push("/"));
  }, [router]);

  // Sync preview to iframe
  useEffect(() => {
    if (!iframeRef.current || !generatedHtml) return;
    const doc = iframeRef.current.contentDocument;
    if (doc) {
      doc.open();
      doc.write(generatedHtml);
      doc.close();
    }
  }, [generatedHtml, previewMode, viewMode]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setGenError("");
    setGeneratedHtml("");
    setDeployed(false);
    setDeployError("");

    try {
      const res = await fetch("/api/emails/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedTemplate.id,
          tone,
          brandName,
          extraInfo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenError(data.error || "Generierung fehlgeschlagen.");
        return;
      }
      setGeneratedHtml(data.html);
      setViewMode("preview");
    } catch {
      setGenError("Verbindungsfehler. Bitte erneut versuchen.");
    } finally {
      setGenerating(false);
    }
  }, [selectedTemplate.id, tone, brandName, extraInfo]);

  async function handleDeploy() {
    if (!generatedHtml) return;
    setDeploying(true);
    setDeployError("");
    setDeployed(false);

    try {
      const res = await fetch("/api/emails/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selectedTemplate.id, html: generatedHtml }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDeployError(data.error || "Deployment fehlgeschlagen.");
        return;
      }
      setDeployed(true);
      setTimeout(() => setDeployed(false), 4000);
    } catch {
      setDeployError("Verbindungsfehler beim Deployment.");
    } finally {
      setDeploying(false);
    }
  }

  function handleCopy() {
    if (!generatedHtml) return;
    navigator.clipboard.writeText(generatedHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    if (!generatedHtml) return;
    const blob = new Blob([generatedHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedTemplate.id}_email.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      {/* Ambient glows */}
      <div className="fixed top-32 right-0 w-[500px] h-[500px] rounded-full blur-[160px] pointer-events-none opacity-30"
        style={{ background: `radial-gradient(circle, ${selectedTemplate.color}18, transparent 70%)` }} />
      <div className="fixed bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-[140px] pointer-events-none opacity-20"
        style={{ background: "radial-gradient(circle, #95BF4720, transparent 70%)" }} />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 md:py-8">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-7 flex items-start justify-between gap-4 flex-wrap"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: `${selectedTemplate.color}18`, border: `1px solid ${selectedTemplate.color}30` }}>
              <Mail className="w-5 h-5" style={{ color: selectedTemplate.color }} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                Email Engine
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#95BF47]/15 text-[#95BF47] border border-[#95BF47]/20 ml-1">
                  AI
                </span>
              </h1>
              <p className="text-zinc-500 text-sm mt-0.5">Generiere & deploye Shopify-E-Mails mit KI</p>
            </div>
          </div>

          {generatedHtml && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2"
            >
              <button onClick={handleCopy}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-white/[0.04] border border-white/[0.08] text-zinc-300 hover:bg-white/[0.07] transition">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Kopiert!" : "Code kopieren"}
              </button>
              <button onClick={handleDownload}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-white/[0.04] border border-white/[0.08] text-zinc-300 hover:bg-white/[0.07] transition">
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
            </motion.div>
          )}
        </motion.div>

        {/* ── Three-column Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_380px_1fr] gap-4 items-start">

          {/* ── LEFT: Template Selector ── */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 }}
            className="glass-strong rounded-2xl border border-white/[0.08] overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-white/[0.05]">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Templates</h2>
              <p className="text-[11px] text-zinc-600 mt-0.5">10 Notification-Typen</p>
            </div>

            <div className="p-2">
              {TEMPLATES.map((tpl, i) => {
                const isActive = selectedTemplate.id === tpl.id;
                const Icon = tpl.icon;
                return (
                  <motion.button
                    key={tpl.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.03 }}
                    onClick={() => {
                      setSelectedTemplate(tpl);
                      setDeployed(false);
                      setDeployError("");
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 group ${
                      isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                    }`}
                    style={isActive ? { border: `1px solid ${tpl.color}25` } : { border: "1px solid transparent" }}
                  >
                    {/* Icon */}
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all"
                      style={{
                        background: isActive ? `${tpl.color}18` : "rgba(255,255,255,0.04)",
                        border: `1px solid ${isActive ? tpl.color + "30" : "rgba(255,255,255,0.06)"}`,
                      }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: isActive ? tpl.color : "#6b7280" }} />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-[13px] font-medium truncate transition ${isActive ? "text-white" : "text-zinc-400 group-hover:text-zinc-300"}`}>
                        {tpl.name}
                      </div>
                      <div className="text-[10px] text-zinc-600 truncate">{tpl.description}</div>
                    </div>

                    {/* Badge */}
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0"
                      style={{
                        color: isActive ? tpl.color : "#4b5563",
                        background: isActive ? `${tpl.color}15` : "rgba(255,255,255,0.03)",
                      }}>
                      {tpl.badge}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* ── CENTER: Configuration ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-strong rounded-2xl border border-white/[0.08] overflow-hidden"
          >
            {/* Selected template header */}
            <div className="p-5 border-b border-white/[0.05]"
              style={{ background: `linear-gradient(135deg, ${selectedTemplate.color}08, transparent)` }}>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: `${selectedTemplate.color}20`, border: `1px solid ${selectedTemplate.color}35` }}>
                  <selectedTemplate.icon className="w-4.5 h-4.5" style={{ color: selectedTemplate.color }} />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{selectedTemplate.name}</div>
                  <div className="text-[11px] text-zinc-500">{selectedTemplate.description}</div>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-5">

              {/* Brand Tone */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2.5 uppercase tracking-wider">
                  Brand Tone
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {TONES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTone(t.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-sm transition-all ${
                        tone === t.id
                          ? "bg-[#95BF47]/15 border border-[#95BF47]/30 text-white"
                          : "bg-white/[0.03] border border-white/[0.05] text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-300"
                      }`}
                    >
                      <span className="text-base leading-none">{t.emoji}</span>
                      <div>
                        <div className="text-[12px] font-semibold leading-tight">{t.label}</div>
                        <div className="text-[10px] text-zinc-600 leading-tight">{t.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Brand Name */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
                  Brand Name
                </label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="z.B. FitFlow Store"
                  className="input-glass w-full text-sm"
                />
              </div>

              {/* Extra Info */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">
                  Zusatz-Kontext für die KI
                </label>
                <textarea
                  value={extraInfo}
                  onChange={(e) => setExtraInfo(e.target.value)}
                  placeholder="z.B. Wir verkaufen Sportprodukte. Füge einen 10%-Rabattcode ein. Erwähne kostenlosen Versand ab 50€."
                  rows={3}
                  className="input-glass w-full text-sm resize-none leading-relaxed"
                />
                <p className="text-[10px] text-zinc-600 mt-1.5">Je mehr Kontext, desto besser das Ergebnis</p>
              </div>

              {/* Error */}
              <AnimatePresence>
                {genError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-2 text-red-300 text-xs bg-red-500/10 border border-red-500/15 px-3.5 py-3 rounded-xl"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{genError}</span>
                    <button onClick={() => setGenError("")} className="ml-auto shrink-0"><X className="w-3 h-3" /></button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Generate Button */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleGenerate}
                disabled={generating}
                className="w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5 disabled:opacity-60 transition-all"
                style={{
                  background: generating
                    ? "rgba(149,191,71,0.3)"
                    : "linear-gradient(135deg, #95BF47, #7aad32)",
                  color: "#000",
                  boxShadow: generating ? "none" : "0 4px 20px rgba(149,191,71,0.25)",
                }}
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>KI generiert...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span>Template generieren</span>
                    <Sparkles className="w-3.5 h-3.5 opacity-70" />
                  </>
                )}
              </motion.button>

              {/* Deploy section */}
              <AnimatePresence>
                {generatedHtml && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="border-t border-white/[0.06] pt-4 space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px] text-emerald-400 font-medium">Template bereit zum Deployment</span>
                    </div>

                    {deployError && (
                      <div className="flex items-start gap-2 text-red-300 text-xs bg-red-500/10 border border-red-500/15 px-3.5 py-3 rounded-xl">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{deployError}</span>
                      </div>
                    )}

                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleDeploy}
                      disabled={deploying || deployed}
                      className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5 transition-all disabled:opacity-60 glass border"
                      style={{
                        borderColor: deployed ? "#10B98130" : "rgba(255,255,255,0.1)",
                        background: deployed ? "rgba(16,185,129,0.1)" : undefined,
                        color: deployed ? "#10B981" : "#d1d5db",
                      }}
                    >
                      {deploying ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />In Shopify pushen...</>
                      ) : deployed ? (
                        <><Check className="w-4 h-4" />Erfolgreich live geschaltet!</>
                      ) : (
                        <><Rocket className="w-4 h-4" />In Shopify live schalten<ChevronRight className="w-3.5 h-3.5 ml-auto" /></>
                      )}
                    </motion.button>

                    <button
                      onClick={handleGenerate}
                      className="w-full py-2 rounded-xl text-xs text-zinc-500 hover:text-zinc-300 flex items-center justify-center gap-1.5 transition"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Neu generieren
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* ── RIGHT: Live Preview ── */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-strong rounded-2xl border border-white/[0.08] overflow-hidden flex flex-col"
            style={{ minHeight: "calc(100vh - 200px)" }}
          >
            {/* Preview Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05] shrink-0">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setViewMode("preview")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    viewMode === "preview"
                      ? "bg-white/[0.07] text-white border border-white/[0.1]"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />Preview
                </button>
                <button
                  onClick={() => setViewMode("code")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    viewMode === "code"
                      ? "bg-white/[0.07] text-white border border-white/[0.1]"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />Code
                </button>
              </div>

              {viewMode === "preview" && generatedHtml && (
                <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
                  <button
                    onClick={() => setPreviewMode("desktop")}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                      previewMode === "desktop" ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Desktop</span>
                  </button>
                  <button
                    onClick={() => setPreviewMode("mobile")}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                      previewMode === "mobile" ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Mobile</span>
                  </button>
                </div>
              )}
            </div>

            {/* Preview Content */}
            <div className="flex-1 relative overflow-hidden">

              {/* Empty state */}
              {!generatedHtml && !generating && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                    className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
                    style={{ background: `${selectedTemplate.color}12`, border: `1px solid ${selectedTemplate.color}20` }}
                  >
                    <selectedTemplate.icon className="w-9 h-9" style={{ color: selectedTemplate.color + "80" }} />
                  </motion.div>
                  <h3 className="text-zinc-300 font-semibold text-lg mb-2">Preview erscheint hier</h3>
                  <p className="text-zinc-600 text-sm max-w-[260px] leading-relaxed">
                    Wähle ein Template, stelle den Ton ein und klicke auf <span className="text-[#95BF47]">Generieren</span>.
                  </p>
                  <div className="mt-5 flex items-center gap-3 text-[11px] text-zinc-700">
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3" />Liquid-kompatibel</span>
                    <span className="w-1 h-1 bg-zinc-700 rounded-full" />
                    <span className="flex items-center gap-1"><Monitor className="w-3 h-3" />Responsive</span>
                    <span className="w-1 h-1 bg-zinc-700 rounded-full" />
                    <span className="flex items-center gap-1"><Rocket className="w-3 h-3" />1-Klick Deploy</span>
                  </div>
                </div>
              )}

              {/* Loading state */}
              {generating && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                      style={{ background: `${selectedTemplate.color}18`, border: `1px solid ${selectedTemplate.color}30` }}>
                      <Wand2 className="w-7 h-7" style={{ color: selectedTemplate.color }} />
                    </div>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                      className="absolute -inset-1 rounded-3xl border-2 border-transparent"
                      style={{ borderTopColor: selectedTemplate.color, borderRightColor: selectedTemplate.color + "50" }}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white mb-1">KI generiert dein Template</p>
                    <p className="text-xs text-zinc-500">Shopify Liquid + HTML wird optimiert...</p>
                  </div>
                  {/* Progress dots */}
                  <div className="flex gap-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: selectedTemplate.color }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Preview iframe */}
              {generatedHtml && viewMode === "preview" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 flex items-start justify-center pt-6 pb-6 px-6 overflow-auto"
                  style={{ background: "#111" }}
                >
                  <motion.div
                    layout
                    className="bg-white rounded-xl overflow-hidden shadow-2xl shadow-black/60"
                    style={{
                      width: previewMode === "mobile" ? "375px" : "100%",
                      maxWidth: previewMode === "desktop" ? "680px" : undefined,
                      minHeight: "400px",
                    }}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  >
                    <iframe
                      ref={iframeRef}
                      title="Email Preview"
                      className="w-full min-h-[600px] border-0 block"
                      sandbox="allow-same-origin"
                    />
                  </motion.div>
                </motion.div>
              )}

              {/* Code view */}
              {generatedHtml && viewMode === "code" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 overflow-auto p-4"
                >
                  {/* Code toolbar */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                      <span className="text-[11px] text-zinc-500 ml-2 font-mono">{selectedTemplate.id}.html</span>
                    </div>
                    <span className="text-[10px] text-zinc-600 font-mono">{generatedHtml.length.toLocaleString()} chars</span>
                  </div>
                  <pre className="text-[11px] text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap break-words bg-black/40 border border-white/[0.06] rounded-xl p-4 overflow-x-auto">
                    {generatedHtml}
                  </pre>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>

        {/* ── Bottom info bar ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-4 flex items-center gap-4 text-[11px] text-zinc-600 justify-center flex-wrap"
        >
          <span className="flex items-center gap-1.5"><Zap className="w-3 h-3 text-zinc-700" />Powered by DeepSeek AI</span>
          <span className="w-1 h-1 bg-zinc-700 rounded-full" />
          <span className="flex items-center gap-1.5"><Code2 className="w-3 h-3 text-zinc-700" />Shopify Liquid kompatibel</span>
          <span className="w-1 h-1 bg-zinc-700 rounded-full" />
          <span>Die KI kann Fehler machen. Bitte prüfe Templates vor dem Live-Schalten.</span>
        </motion.div>
      </div>
    </div>
  );
}
