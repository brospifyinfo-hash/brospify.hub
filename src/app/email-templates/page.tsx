"use client";

// ─── Email Studio — Single-Page Workspace ────────────────────────
// All-in-one editor: pick reason → configure → AI-generate → live
// preview with optional manual text editing → 1-click Shopify
// deploy. The legacy grid + per-template subroute is gone: this is
// the entire feature on one screen.

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import Navigation from "@/components/Navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code2,
  Eye,
  Copy,
  Check,
  Loader2,
  Info,
  Zap,
  RefreshCw,
  ChevronDown,
  Mail,
  Sparkles,
  Coins,
  X,
  AlertTriangle,
  SlidersHorizontal,
} from "lucide-react";
import {
  EMAIL_TEMPLATES,
  getTemplateById,
  type EmailTemplateDef,
} from "@/lib/email-templates";
import {
  ConfigPanel,
  DEFAULT_CONFIG,
  getFontStack,
  type EmailConfig,
} from "@/components/email/ConfigPanel";
import {
  EmailPreview,
  type EmailPreviewHandle,
} from "@/components/email/EmailPreview";
import { DeployButton } from "@/components/email/DeployButton";
import { useCredits } from "@/lib/credits";
import { CREDIT_COSTS as CREDIT_LIMITS } from "@/lib/credit-costs";

// ─── Constants ───────────────────────────────────────────────────

const CATEGORY_LABELS = {
  transactional: "Transaktional",
  lifecycle: "Lifecycle",
  recovery: "Recovery",
} as const;

const CATEGORY_COLORS = {
  transactional: "bg-sky-400/10 border-sky-400/20 text-sky-300",
  lifecycle: "bg-fuchsia-400/10 border-fuchsia-400/20 text-fuchsia-300",
  recovery: "bg-amber-400/10 border-amber-400/20 text-amber-300",
} as const;

interface GeneratedTemplate {
  liquid: string;
  subject: string;
  source?: string;
}

// ─── Page export ─────────────────────────────────────────────────

export default function EmailStudioPage() {
  return (
    <Suspense fallback={null}>
      <EmailStudio />
    </Suspense>
  );
}

// ─── Workspace component ─────────────────────────────────────────

function EmailStudio() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const credits = useCredits();

  // ── Selected template (URL ?reason= keeps deep links working) ──
  const initialReason = searchParams.get("reason") ?? "order-confirmation";
  const [selectedId, setSelectedId] = useState<string>(
    EMAIL_TEMPLATES.some((t) => t.id === initialReason)
      ? initialReason
      : "order-confirmation",
  );
  const tpl = useMemo(
    () => getTemplateById(selectedId) ?? EMAIL_TEMPLATES[0],
    [selectedId],
  );

  // Push the selected reason into the URL so it's shareable / preserved.
  useEffect(() => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (params.get("reason") !== selectedId) {
      params.set("reason", selectedId);
      router.replace(`/email-templates?${params.toString()}`, { scroll: false });
    }
  }, [selectedId, router, searchParams]);

  // ── Config + generation state ──
  const [config, setConfig] = useState<EmailConfig>(DEFAULT_CONFIG);
  const [generated, setGenerated] = useState<GeneratedTemplate | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [view, setView] = useState<"preview" | "source">("preview");
  const [copied, setCopied] = useState(false);

  // ── Shopify connection ──
  const [shopReady, setShopReady] = useState(false);
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => setShopReady(Boolean(d.hasShopifyToken)))
      .catch(() => setShopReady(false));
  }, []);

  // ── Reset generation when reason changes ──
  useEffect(() => {
    setGenerated(null);
    setGenError(null);
    setView("preview");
  }, [selectedId]);

  const previewRef = useRef<EmailPreviewHandle>(null);

  // ── Generate ──
  const handleGenerate = useCallback(async () => {
    setGenError(null);
    setGenerating(true);
    credits.optimisticDeduct(CREDIT_LIMITS.EMAIL_GENERATE);
    try {
      const res = await fetch("/api/email-templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedId,
          ...config,
          brandTone: config.tonalität,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data.creditsRemaining === "number") {
          credits.setRemaining(data.creditsRemaining);
        } else {
          credits.refresh();
        }
        setGenError(data.error ?? "Generierung fehlgeschlagen.");
        return;
      }
      setGenerated({
        liquid: data.liquid,
        subject: data.subject,
        source: data.source,
      });
      if (typeof data.creditsRemaining === "number") {
        credits.setRemaining(data.creditsRemaining);
      } else {
        credits.refresh();
      }
      setView("preview");
    } catch (err) {
      credits.refresh();
      setGenError(err instanceof Error ? err.message : "Netzwerkfehler.");
    } finally {
      setGenerating(false);
    }
  }, [selectedId, config, credits]);

  // ── Inline text edit handler — splice into Liquid source ──
  const handleTextEdit = useCallback(
    (originalText: string, newText: string) => {
      setGenerated((g) => {
        if (!g) return g;
        // The original text is the rendered (mock-data-substituted) string.
        // It may exist 1:1 in the Liquid source; we replace the FIRST match.
        // If it doesn't, we silently keep the current source (fallback).
        const idx = g.liquid.indexOf(originalText);
        if (idx === -1) return g;
        const updated =
          g.liquid.slice(0, idx) + newText + g.liquid.slice(idx + originalText.length);
        return { ...g, liquid: updated };
      });
    },
    [],
  );

  function copySource() {
    if (!generated) return;
    navigator.clipboard.writeText(generated.liquid);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const insufficient =
    !credits.loading && credits.remaining < CREDIT_LIMITS.EMAIL_GENERATE;
  const fontStack = getFontStack(config.fontFamily);

  // Mobile drawer state
  const [mobileConfigOpen, setMobileConfigOpen] = useState(false);
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);

  return (
    <div className="min-h-screen bg-email-mesh font-sf text-white">
      <Navigation />

      {/* ── Mobile Reason picker (sticky on top, just below nav) ── */}
      <div className="lg:hidden sticky top-14 z-30 px-3 py-3 bg-[#030303]/85 backdrop-blur-xl border-b border-white/[0.05]">
        <ReasonPicker
          templates={EMAIL_TEMPLATES}
          selectedId={selectedId}
          onSelect={setSelectedId}
          tpl={tpl}
          shopReady={shopReady}
          compact
        />
      </div>

      {/* ── Workspace ───────────────────────────────────────────── */}
      <div className="max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-6 py-4 sm:py-6 pb-32 lg:pb-6">
        <div className="grid grid-cols-12 gap-5">
          {/* ── LEFT SIDEBAR: Config (desktop only inline) ───── */}
          <aside className="hidden lg:block lg:col-span-3 space-y-2.5">
            <div className="lg:sticky lg:top-[80px]">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
                  Konfiguration
                </span>
                <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono text-white/55 bg-white/[0.04] border border-white/[0.06]">
                  <Coins className="w-2.5 h-2.5" />
                  {credits.loading ? "···" : credits.remaining}
                </span>
              </div>

              {genError && (
                <div className="glass-email px-4 py-3 mb-3 text-[13px] text-red-300/90 border border-red-500/20 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{genError}</span>
                </div>
              )}

              <div className="overflow-y-auto lg:max-h-[calc(100vh-130px)] pr-0.5 space-y-2.5 pb-6">
                <ConfigPanel
                  config={config}
                  setConfig={setConfig}
                  onGenerate={handleGenerate}
                  generating={generating}
                  generateCost={CREDIT_LIMITS.EMAIL_GENERATE}
                  insufficientCredits={insufficient}
                />
              </div>
            </div>
          </aside>

          {/* ── CENTER: Reason picker (desktop) + Preview + Deploy ── */}
          <section className="col-span-12 lg:col-span-6 space-y-4 sm:space-y-5">
            {/* Mobile-only error banner */}
            {genError && (
              <div className="lg:hidden glass-email px-4 py-3 text-[13px] text-red-300/90 border border-red-500/20 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{genError}</span>
              </div>
            )}

            {/* Email-Reason picker (desktop only — mobile has it in
                the sticky strip above) */}
            <div className="hidden lg:block">
              <ReasonPicker
                templates={EMAIL_TEMPLATES}
                selectedId={selectedId}
                onSelect={setSelectedId}
                tpl={tpl}
                shopReady={shopReady}
              />
            </div>

            {/* Preview block */}
            {generated ? (
              <>
                {/* Source indicator + regenerate */}
                {generated.source && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] text-white/35">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          generated.source === "deepseek"
                            ? "bg-emerald-400"
                            : "bg-amber-400"
                        }`}
                      />
                      {generated.source === "deepseek"
                        ? "DeepSeek KI generiert"
                        : "Deterministischer Fallback"}
                    </div>
                    <button
                      onClick={handleGenerate}
                      disabled={generating || insufficient}
                      className="inline-flex items-center gap-1.5 text-[12px] text-white/45 hover:text-white/80 transition disabled:opacity-40"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Neu generieren
                      <span className="font-mono text-[10px] text-white/30 ml-1">
                        -{CREDIT_LIMITS.EMAIL_GENERATE}
                      </span>
                    </button>
                  </div>
                )}

                {/* View toggle */}
                <div className="flex items-center justify-between">
                  <div className="segment">
                    <button
                      data-active={view === "preview"}
                      onClick={() => setView("preview")}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Vorschau
                    </button>
                    <button
                      data-active={view === "source"}
                      onClick={() => setView("source")}
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      Liquid-Quelle
                    </button>
                  </div>
                  {view === "source" && (
                    <button
                      onClick={copySource}
                      className="inline-flex items-center gap-1.5 text-[12px] text-white/55 hover:text-white transition"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-300" />
                          Kopiert
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Kopieren
                        </>
                      )}
                    </button>
                  )}
                </div>

                <AnimatePresence mode="wait">
                  {view === "preview" ? (
                    <motion.div
                      key="preview"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <EmailPreview
                        ref={previewRef}
                        liquid={generated.liquid}
                        subject={generated.subject}
                        fontStack={fontStack}
                        onTextEdit={handleTextEdit}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="source"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="glass-email overflow-hidden"
                    >
                      <pre className="p-5 overflow-x-auto text-[12px] leading-relaxed font-mono text-white/70 max-h-[820px] overflow-y-auto">
                        {generated.liquid}
                      </pre>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Deploy section */}
                <div className="glass-email p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-sf-display text-[17px] font-semibold tracking-tight">
                        Template live schalten
                      </h3>
                      <p className="text-[13px] text-white/50 mt-1 leading-relaxed">
                        Überschreibt die{" "}
                        <code className="font-mono text-white/70 text-[12px]">
                          {tpl.shopifyName}
                        </code>
                        -Benachrichtigung in deinem Shopify-Konto direkt.
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium bg-white/[0.04] border border-white/[0.06] text-white/45 shrink-0">
                      <Zap className="w-3 h-3" />
                      1-Klick Deploy
                    </span>
                  </div>
                  <DeployButton
                    templateId={tpl.id}
                    liquid={generated.liquid}
                    subject={generated.subject}
                    ready={shopReady}
                  />
                </div>
              </>
            ) : (
              <EmptyState
                generating={generating}
                onGenerate={handleGenerate}
                tpl={tpl}
                disabled={insufficient}
              />
            )}
          </section>

          {/* ── RIGHT SIDEBAR: Info + Variables + Tips ──────────
                Desktop only — mobile users open it via the bottom
                action bar. */}
          <aside className="hidden lg:block lg:col-span-3 space-y-4">
            <div className="lg:sticky lg:top-[80px] space-y-4 overflow-y-auto lg:max-h-[calc(100vh-130px)] pr-0.5 pb-6">
              {/* Template stats */}
              <div className="glass-email p-5 space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
                  Template-Info
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Kategorie", value: CATEGORY_LABELS[tpl.category] },
                    { label: "Badge", value: tpl.contextBadge },
                    {
                      label: "Variablen",
                      value: `${tpl.liquidVariables.length} verfügbar`,
                    },
                    {
                      label: "API-Name",
                      value: tpl.shopifyName.replace(/_/g, " "),
                    },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[10px] text-white/35 uppercase tracking-[0.08em] mb-0.5">
                        {label}
                      </p>
                      <p className="text-[12px] font-medium text-white/80 leading-tight">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Liquid variables */}
              <div className="glass-email p-5 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
                  Liquid-Variablen
                </p>
                <ul className="space-y-1.5">
                  {tpl.liquidVariables.map((v) => (
                    <li
                      key={v}
                      className="font-mono text-[11.5px] text-white/65 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.04] hover:bg-white/[0.05] hover:text-white/80 transition-colors cursor-default"
                    >
                      {`{{ ${v} }}`}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tips */}
              <div className="glass-email p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Info
                    className="w-3.5 h-3.5 text-white/40"
                    strokeWidth={1.8}
                  />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
                    So funktioniert's
                  </p>
                </div>
                <ul className="space-y-3 text-[12px] text-white/60 leading-relaxed">
                  <li>
                    <span className="text-white/85 font-medium">1.</span>{" "}
                    Wähle einen Email-Anlass und konfiguriere Farben, Schrift
                    und Stil.
                  </li>
                  <li>
                    <span className="text-white/85 font-medium">2.</span>{" "}
                    Klicke auf{" "}
                    <em className="not-italic text-[#95BF47]">
                      Template mit KI generieren
                    </em>
                    .
                  </li>
                  <li>
                    <span className="text-white/85 font-medium">3.</span>{" "}
                    Tippe einen Block in der Vorschau an — wähle{" "}
                    <em className="not-italic text-white/85">Text bearbeiten</em>{" "}
                    (kostenlos) für freie Edits.
                  </li>
                  <li>
                    <span className="text-white/85 font-medium">4.</span>{" "}
                    Hover über einen Bereich und klicke{" "}
                    <em className="not-italic text-[#95BF47]">
                      Bereich mit KI anpassen
                    </em>{" "}
                    für einen gezielten Edit (10 Credits).
                  </li>
                  <li>
                    <span className="text-white/85 font-medium">5.</span>{" "}
                    <em className="not-italic text-[#95BF47]">
                      In Shopify live schalten
                    </em>{" "}
                    pusht das Template direkt in deinen Shop.
                  </li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ── Mobile Bottom Action Bar ─ hidden while a drawer is up ── */}
      <div
        className={`lg:hidden fixed inset-x-0 bottom-0 z-40 backdrop-blur-2xl bg-[#030303]/85 border-t border-white/[0.06] transition-transform duration-200 ${
          mobileConfigOpen || mobileInfoOpen
            ? "translate-y-full"
            : "translate-y-0"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            type="button"
            onClick={() => setMobileConfigOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-white/65 active:bg-white/[0.06] transition"
          >
            <SlidersHorizontal className="w-5 h-5" strokeWidth={1.6} />
            <span className="text-[10px] font-medium leading-none">Config</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileInfoOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-white/65 active:bg-white/[0.06] transition"
          >
            <Info className="w-5 h-5" strokeWidth={1.6} />
            <span className="text-[10px] font-medium leading-none">Info</span>
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || insufficient}
            className="flex-1 btn-accent inline-flex items-center justify-center gap-2 px-4 h-12 rounded-xl text-[14px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generiert…
              </>
            ) : generated ? (
              <>
                <RefreshCw className="w-4 h-4" />
                Neu generieren
                <span className="font-mono text-[11px] opacity-65 ml-0.5">
                  -{CREDIT_LIMITS.EMAIL_GENERATE}
                </span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                KI generieren
                <span className="font-mono text-[11px] opacity-65 ml-0.5">
                  -{CREDIT_LIMITS.EMAIL_GENERATE}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Mobile Config Drawer (portaled to body) ───────────── */}
      <BodyPortal>
        <AnimatePresence>
          {mobileConfigOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-[100] bg-black/60 backdrop-blur-md"
              onClick={() => setMobileConfigOpen(false)}
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 280 }}
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-[#0a0a0a] border-t border-white/[0.08]"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
              >
                <div className="bottom-sheet-grabber mt-3" />
                <div className="px-4 pb-2 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#95BF47] mb-0.5">
                      Konfiguration
                    </p>
                    <h2 className="font-sf-display text-lg font-semibold tracking-tight">
                      Design & Content
                    </h2>
                  </div>
                  <button
                    onClick={() => setMobileConfigOpen(false)}
                    className="w-10 h-10 inline-flex items-center justify-center rounded-xl text-white/45 hover:text-white hover:bg-white/[0.04]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="px-4 pt-3 pb-6 space-y-2.5">
                  <ConfigPanel
                    config={config}
                    setConfig={setConfig}
                    onGenerate={() => {
                      setMobileConfigOpen(false);
                      handleGenerate();
                    }}
                    generating={generating}
                    generateCost={CREDIT_LIMITS.EMAIL_GENERATE}
                    insufficientCredits={insufficient}
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </BodyPortal>

      {/* ── Mobile Info Drawer (portaled to body) ─────────────── */}
      <BodyPortal>
        <AnimatePresence>
          {mobileInfoOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-[100] bg-black/60 backdrop-blur-md"
              onClick={() => setMobileInfoOpen(false)}
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 280 }}
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl bg-[#0a0a0a] border-t border-white/[0.08]"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
              >
              <div className="bottom-sheet-grabber mt-3" />
              <div className="px-4 pb-2 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#95BF47] mb-0.5">
                    Template-Info
                  </p>
                  <h2 className="font-sf-display text-lg font-semibold tracking-tight">
                    {tpl.title}
                  </h2>
                </div>
                <button
                  onClick={() => setMobileInfoOpen(false)}
                  className="w-10 h-10 inline-flex items-center justify-center rounded-xl text-white/45 hover:text-white hover:bg-white/[0.04]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-4 pt-3 pb-6 space-y-3.5">
                <div className="glass-email p-4 space-y-3">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/40">
                    Liquid-Variablen
                  </p>
                  <ul className="grid grid-cols-2 gap-1.5">
                    {tpl.liquidVariables.map((v) => (
                      <li
                        key={v}
                        className="font-mono text-[11px] text-white/65 px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.04]"
                      >
                        {`{{ ${v} }}`}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="glass-email p-4 space-y-2.5">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/40">
                    So funktioniert's
                  </p>
                  <ol className="space-y-2.5 text-[12.5px] text-white/65 leading-relaxed">
                    <li>
                      <span className="text-white/85 font-medium">1.</span>{" "}
                      Anlass oben wählen, dann Konfiguration anpassen.
                    </li>
                    <li>
                      <span className="text-white/85 font-medium">2.</span>{" "}
                      <em className="not-italic text-[#95BF47]">KI generieren</em>{" "}
                      antippen — kostet {CREDIT_LIMITS.EMAIL_GENERATE} Credits.
                    </li>
                    <li>
                      <span className="text-white/85 font-medium">3.</span>{" "}
                      Aktiviere bei Bedarf den{" "}
                      <em className="not-italic text-[#95BF47]">Editor-Modus</em>{" "}
                      über der Vorschau und tippe einen Text an, um ihn zu
                      ändern (kostenlos).
                    </li>
                    <li>
                      <span className="text-white/85 font-medium">4.</span>{" "}
                      <em className="not-italic text-[#95BF47]">
                        In Shopify live schalten
                      </em>{" "}
                      pusht das Template direkt in deinen Shop.
                    </li>
                  </ol>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </BodyPortal>
    </div>
  );
}

// ─── Reason Picker (top-left dropdown + dynamic context hint) ────

function ReasonPicker({
  templates,
  selectedId,
  onSelect,
  tpl,
  shopReady,
  compact = false,
}: {
  templates: EmailTemplateDef[];
  selectedId: string;
  onSelect: (id: string) => void;
  tpl: EmailTemplateDef;
  shopReady: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Desktop dropdown: outside-click closes it. (We do NOT bind a
  // touchstart handler — on mobile the bottom-sheet is rendered as a
  // full-screen portal that already has its own backdrop; binding
  // touchstart here used to close the sheet on the very first tap.)
  useEffect(() => {
    if (compact) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [compact]);

  // Lock body scroll while the mobile sheet is open + ESC closes it.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const Icon = tpl.icon;

  // ── Compact (mobile sticky-strip) variant ──
  if (compact) {
    return (
      <>
        {/* The trigger lives inside the sticky strip in the page */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="w-full flex items-center gap-3 px-3 h-14 rounded-2xl bg-white/[0.05] border border-white/[0.08] active:bg-white/[0.09] transition text-left"
        >
          <span
            className="inline-flex w-11 h-11 items-center justify-center rounded-xl shrink-0"
            style={{
              background:
                "linear-gradient(135deg, rgba(149,191,71,0.18), rgba(149,191,71,0.05))",
              border: "1px solid rgba(149,191,71,0.25)",
            }}
          >
            <Icon className="w-[18px] h-[18px] text-[#95BF47]" strokeWidth={1.7} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40 leading-none mb-1">
              Email-Anlass
            </div>
            <div className="flex items-center gap-2">
              <div className="font-sf-display text-[15.5px] font-semibold tracking-tight truncate text-white">
                {tpl.title}
              </div>
              <span
                className={`shrink-0 w-1.5 h-1.5 rounded-full ${shopReady ? "bg-emerald-400" : "bg-amber-400"}`}
                title={shopReady ? "Shop verbunden" : "Shop nicht verbunden"}
              />
            </div>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-white/55">
            Wechseln
            <ChevronDown className="w-3.5 h-3.5" />
          </span>
        </button>

        {/* Trigger context — inline, no toggle. Two-line clamp keeps
            the sticky strip compact. Tap the chevron to expand. */}
        <ContextHint text={tpl.triggerContext} />

        {/* Full-screen picker portaled into <body> so that backdrop
            filters in the sticky strip don't pin it under the preview. */}
        <BodyPortal>
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md"
                onClick={() => setOpen(false)}
              >
              <motion.div
                ref={ref}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 34, stiffness: 320 }}
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-x-0 bottom-0 flex flex-col rounded-t-3xl bg-[#0a0a0a] border-t border-white/[0.08]"
                style={{
                  maxHeight: "92vh",
                  paddingBottom: "env(safe-area-inset-bottom, 0px)",
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="reason-picker-title"
              >
                <div className="bottom-sheet-grabber mt-3" />

                {/* Header */}
                <div className="px-5 pb-3 flex items-start justify-between gap-3 shrink-0">
                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#95BF47] mb-0.5">
                      Email-Anlass wählen
                    </p>
                    <h3
                      id="reason-picker-title"
                      className="font-sf-display text-[19px] font-semibold tracking-tight text-white"
                    >
                      Welche Mail möchtest du gestalten?
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Schließen"
                    className="w-10 h-10 -mt-0.5 inline-flex items-center justify-center rounded-xl text-white/55 active:bg-white/[0.06]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Scrollable list */}
                <div
                  className="flex-1 overflow-y-auto px-3 pt-1 pb-5 space-y-1.5"
                  style={{ overscrollBehavior: "contain" }}
                >
                  {templates.map((t) => {
                    const ItemIcon = t.icon;
                    const active = t.id === selectedId;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          onSelect(t.id);
                          setOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition ${
                          active
                            ? "bg-[#95BF47]/14 border border-[#95BF47]/35"
                            : "border border-white/[0.05] bg-white/[0.025] active:bg-white/[0.06]"
                        }`}
                      >
                        <span
                          className="inline-flex w-11 h-11 items-center justify-center rounded-xl shrink-0"
                          style={{
                            background: active
                              ? "linear-gradient(135deg, rgba(149,191,71,0.22), rgba(149,191,71,0.05))"
                              : "rgba(255,255,255,0.04)",
                            border: active
                              ? "1px solid rgba(149,191,71,0.3)"
                              : "1px solid rgba(255,255,255,0.05)",
                          }}
                        >
                          <ItemIcon
                            className={`w-[18px] h-[18px] ${
                              active ? "text-[#95BF47]" : "text-white/60"
                            }`}
                            strokeWidth={1.7}
                          />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-[14.5px] font-semibold tracking-tight truncate ${
                              active ? "text-white" : "text-white/90"
                            }`}
                          >
                            {t.title}
                          </div>
                          <div className="text-[12px] text-white/45 truncate">
                            {t.tagline}
                          </div>
                        </div>
                        {active && (
                          <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-[#95BF47] text-black shrink-0">
                            <Check className="w-3.5 h-3.5" strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </motion.div>
            )}
          </AnimatePresence>
        </BodyPortal>
      </>
    );
  }

  // ── Default (desktop) variant ──
  return (
    <div className="glass-email p-5 space-y-4">
      <div className="flex items-start gap-4">
        <div ref={ref} className="relative flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40 mb-1.5">
            Email-Anlass
          </p>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:border-white/[0.14] hover:bg-white/[0.06] transition text-left"
          >
            <span
              className="inline-flex w-9 h-9 items-center justify-center rounded-lg shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(149,191,71,0.14), rgba(149,191,71,0.04))",
                border: "1px solid rgba(149,191,71,0.2)",
              }}
            >
              <Icon className="w-4 h-4 text-[#95BF47]" strokeWidth={1.7} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-sf-display text-[15px] font-semibold tracking-tight truncate">
                {tpl.title}
              </div>
              <div className="text-[11.5px] text-white/45 truncate">
                {tpl.tagline}
              </div>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-white/40 shrink-0 transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 right-0 mt-2 z-50 max-h-[60vh] overflow-y-auto rounded-2xl border border-white/[0.08] shadow-2xl shadow-black/60 p-2 space-y-1"
                style={{
                  background: "rgba(14,14,14,0.96)",
                  backdropFilter: "blur(40px)",
                }}
              >
                {templates.map((t) => {
                  const ItemIcon = t.icon;
                  const active = t.id === selectedId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        onSelect(t.id);
                        setOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${
                        active
                          ? "bg-[#95BF47]/10 border border-[#95BF47]/25"
                          : "border border-transparent hover:bg-white/[0.04]"
                      }`}
                    >
                      <ItemIcon
                        className={`w-4 h-4 shrink-0 ${
                          active ? "text-[#95BF47]" : "text-white/55"
                        }`}
                        strokeWidth={1.7}
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-[13px] font-semibold tracking-tight truncate ${
                            active ? "text-white" : "text-white/85"
                          }`}
                        >
                          {t.title}
                        </div>
                        <div className="text-[11px] text-white/40 truncate">
                          {t.tagline}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-white/30">
                        {t.shopifyName}
                      </span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0 pt-5">
          <span
            className={`px-2.5 py-1 rounded-full text-[10.5px] font-medium border ${
              shopReady
                ? "bg-emerald-400/10 border-emerald-400/20 text-emerald-300"
                : "bg-amber-400/10 border-amber-400/20 text-amber-300"
            }`}
          >
            {shopReady ? "● Shop verbunden" : "○ Shop nicht verbunden"}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.08em] border ${
              CATEGORY_COLORS[tpl.category]
            }`}
          >
            {CATEGORY_LABELS[tpl.category]}
          </span>
        </div>
      </div>

      <div className="border-t border-white/[0.05] pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35 mb-1.5 flex items-center gap-1.5">
          <Mail className="w-3 h-3" />
          Wann erhält der Kunde diese E-Mail?
        </p>
        <p className="text-[13px] text-white/65 leading-relaxed">
          {tpl.triggerContext}
        </p>
      </div>
    </div>
  );
}

// ─── Portal helper ──────────────────────────────────────────────
//
// Bottom-sheet modals must be rendered into <body> (not into the
// component tree) so that ancestor `backdrop-filter` / `transform`
// stacking contexts can't pin them under sibling elements like the
// preview iframe. Server-render produces nothing — we wait for the
// client mount to grab document.body.

function BodyPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

// ─── Inline trigger-context hint (mobile sticky strip) ──────────

function ContextHint({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      className="mt-2 w-full flex items-start gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04] active:bg-white/[0.04] text-left"
    >
      <Mail className="w-3.5 h-3.5 text-[#95BF47] shrink-0 mt-0.5" />
      <span
        className={`text-[12px] text-white/65 leading-relaxed flex-1 ${
          expanded ? "" : "line-clamp-2"
        }`}
      >
        {text}
      </span>
      <ChevronDown
        className={`w-3.5 h-3.5 text-white/35 shrink-0 mt-0.5 transition-transform ${
          expanded ? "rotate-180" : ""
        }`}
      />
    </button>
  );
}

// ─── Empty State ─────────────────────────────────────────────────

function EmptyState({
  generating,
  onGenerate,
  tpl,
  disabled,
}: {
  generating: boolean;
  onGenerate: () => void;
  tpl: EmailTemplateDef;
  disabled: boolean;
}) {
  const Icon = tpl.icon;
  return (
    <div
      className="glass-email flex flex-col items-center justify-center text-center px-8 py-20"
      style={{ minHeight: "440px" }}
    >
      {generating ? (
        <>
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mb-5">
            <Loader2 className="w-6 h-6 text-white/60 animate-spin" />
          </div>
          <h3 className="font-sf-display text-xl font-semibold tracking-tight mb-2">
            KI generiert dein Template…
          </h3>
          <p className="text-[13px] text-white/45 max-w-sm leading-relaxed">
            Wir verarbeiten deine Konfiguration und bauen valides Shopify-Liquid
            mit dem gewählten Layout-Stil.
          </p>
          <div className="mt-8 flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-5">
            <Icon className="w-6 h-6 text-white/35" strokeWidth={1.5} />
          </div>
          <h3 className="font-sf-display text-xl font-semibold tracking-tight mb-2">
            Bereit für deine{" "}
            <span className="text-[#95BF47]">{tpl.title.toLowerCase()}</span>
          </h3>
          <p className="text-[13px] text-white/45 max-w-[320px] leading-relaxed">
            Konfiguriere links Markenfarben, Schriftart und Stilrichtung — dann
            klicke auf{" "}
            <em className="not-italic text-white/65">
              Template mit KI generieren
            </em>
            .
          </p>
          <button
            onClick={onGenerate}
            disabled={disabled}
            className="mt-8 btn-accent inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[14px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            Jetzt generieren
            <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/15 text-[11px] font-mono">
              <Coins className="w-3 h-3" />
              -{CREDIT_LIMITS.EMAIL_GENERATE}
            </span>
          </button>
        </>
      )}
    </div>
  );
}

