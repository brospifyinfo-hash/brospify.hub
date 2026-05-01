"use client";

// ─── Email Template Editor — Full Dashboard ───────────────────────
// True 3-column layout:
//  Left  (col-3): ConfigPanel — Brand design, media, tone, content
//  Center (col-6): Context banner → EmailPreview → Deploy section
//  Right  (col-3): Template info, Liquid variables, tips
//
// State machine: idle → generating → previewing → deploying → done

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Code2,
  Eye,
  Copy,
  Check,
  Loader2,
  Info,
  Zap,
  RefreshCw,
} from "lucide-react";
import { getTemplateById } from "@/lib/email-templates";
import { ConfigPanel, DEFAULT_CONFIG, type EmailConfig } from "@/components/email/ConfigPanel";
import { EmailPreview } from "@/components/email/EmailPreview";
import { DeployButton } from "@/components/email/DeployButton";

interface PageProps {
  params: Promise<{ templateId: string }>;
}

interface GeneratedTemplate {
  liquid: string;
  subject: string;
  source?: string;
}

// ─── Category badge colors ───────────────────────────────────────

const CATEGORY_COLORS = {
  transactional: "bg-sky-400/10 border-sky-400/20 text-sky-300",
  lifecycle: "bg-fuchsia-400/10 border-fuchsia-400/20 text-fuchsia-300",
  recovery: "bg-amber-400/10 border-amber-400/20 text-amber-300",
} as const;

const CATEGORY_LABELS = {
  transactional: "Transaktional",
  lifecycle: "Lifecycle",
  recovery: "Recovery",
} as const;

// ─── Tips per template (curated) ─────────────────────────────────

const TEMPLATE_TIPS: Record<string, string[]> = {
  "order-confirmation": [
    "Füge 2-3 Produktempfehlungen direkt nach dem Bestellsummary ein.",
    "Zeige dein Rückgaberecht prominent — reduziert Kaufreue.",
    "CTA zur Bestellverfolgung direkt im Hero-Bereich.",
  ],
  "shipping-confirmation": [
    "Tracking-Button sollte der einzige primäre CTA sein.",
    "Füge eine Vorschau der bestellten Artikel ein, um Erinnerung zu stärken.",
    "Nutze die Wartezeit für eine Review-Einladung unten im Footer.",
  ],
  "abandoned-checkout": [
    "Zeige die abgebrochenen Artikel groß mit Bildern.",
    "Ein Rabattcode mit Ablaufzeit erhöht die Conversion messbar.",
    "Maximal 1 CTA — 'Jetzt bestellen' direkt zum Checkout.",
  ],
  "customer-account-welcome": [
    "Erste Impression zählt — spiegele hier deinen Brand-Ton perfekt.",
    "Füge 3-5 Top-Produkte als visuelles Grid ein.",
    "Erkläre kurz die Vorteile eines Accounts (Bestellverfolgung, Punkte etc.).",
  ],
  "order-refund": [
    "Klarer, beruhigender Ton reduziert Support-Anfragen.",
    "Erkläre den Rückerstattungszeitraum explizit (3-5 Werktage).",
    "Biete einen Rabattcode für den nächsten Einkauf an.",
  ],
  "order-cancelled": [
    "Transparenz über den Storno-Grund schafft Vertrauen.",
    "Nutze dies als Recovery — Rabattcode für Wiederkauf.",
    "Kurz und direkt — keine langen Erklärungen.",
  ],
  "shipping-update": [
    "Halte es kurz — Datum, Tracking-Link, fertig.",
    "Nutze den Moment für einen sanften Cross-Sell.",
    "Emoji im Betreff (📦) erhöht Öffnungsrate messbar.",
  ],
  "order-delivered": [
    "Bitte 3-5 Tage nach Zustellung um ein Review.",
    "Zeige ähnliche Produkte als 'Du könntest auch mögen'-Block.",
    "Loyalty-Punkte oder Folge-Rabatt als Dankeschön.",
  ],
  "payment-receipt": [
    "Steuerrechtlich korrekte Felder: Bestell-Nr., MwSt., Betrag.",
    "Halte das Design schlicht — dies ist ein Pflicht-Dokument.",
    "Füge einen Link zum Download der Rechnung ein wenn möglich.",
  ],
  "customer-invitation": [
    "Ein einziger, klarer CTA — kein anderer Link auf der Seite.",
    "Erkläre in 1-2 Sätzen, warum sie eingeladen wurden.",
    "Ablaufdatum des Einladungslinks kommunizieren.",
  ],
};

// ─── Page Component ──────────────────────────────────────────────

export default function TemplateEditorPage({ params }: PageProps) {
  const { templateId } = use(params);
  const tpl = getTemplateById(templateId);

  // Config state
  const [config, setConfig] = useState<EmailConfig>(DEFAULT_CONFIG);

  // Generation state
  const [generated, setGenerated] = useState<GeneratedTemplate | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // View toggle
  const [view, setView] = useState<"preview" | "source">("preview");
  const [copied, setCopied] = useState(false);

  // Shop connection
  const [shopReady, setShopReady] = useState(false);
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => setShopReady(Boolean(d.hasShopifyToken)))
      .catch(() => setShopReady(false));
  }, []);

  if (!tpl) {
    return (
      <div className="min-h-screen bg-email-mesh font-sf flex items-center justify-center">
        <div className="glass-email p-8 text-center max-w-sm">
          <h1 className="font-sf-display text-xl font-semibold mb-2">
            Vorlage nicht gefunden
          </h1>
          <p className="text-white/55 text-sm mb-5">
            Die angeforderte Email-Vorlage existiert nicht.
          </p>
          <Link
            href="/email-templates"
            className="text-[13px] text-white/80 hover:text-white"
          >
            ← Zurück zur Übersicht
          </Link>
        </div>
      </div>
    );
  }

  async function handleGenerate() {
    setGenError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/email-templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          ...config,
          brandTone: config.tonalität,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenError(data.error ?? "Generierung fehlgeschlagen.");
        return;
      }
      setGenerated({
        liquid: data.liquid,
        subject: data.subject,
        source: data.source,
      });
      setView("preview");
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Netzwerkfehler.");
    } finally {
      setGenerating(false);
    }
  }

  function copySource() {
    if (!generated) return;
    navigator.clipboard.writeText(generated.liquid);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const Icon = tpl.icon;
  const tips = TEMPLATE_TIPS[tpl.id] ?? [];

  return (
    <div className="min-h-screen bg-email-mesh font-sf text-white">
      {/* ── Sticky Header ──────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/40 backdrop-blur-2xl">
        <div className="max-w-[1600px] mx-auto px-6 py-3.5 flex items-center justify-between">
          <Link
            href="/email-templates"
            className="inline-flex items-center gap-2 text-[13px] text-white/55 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Alle Vorlagen
          </Link>

          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-white/35">{tpl.shopifyName}</span>
            <span className="text-white/15">·</span>
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                shopReady
                  ? "bg-emerald-400/10 border-emerald-400/20 text-emerald-300"
                  : "bg-amber-400/10 border-amber-400/20 text-amber-300"
              }`}
            >
              {shopReady ? "● Shop verbunden" : "○ Shop nicht verbunden"}
            </span>
          </div>
        </div>
      </header>

      {/* ── Context Banner ─────────────────────────────────────── */}
      <div className="border-b border-white/[0.05] bg-white/[0.015]">
        <div className="max-w-[1600px] mx-auto px-6 py-5 flex items-start gap-5">
          <div
            className="inline-flex w-12 h-12 items-center justify-center rounded-2xl shrink-0"
            style={{
              background:
                "linear-gradient(135deg, rgba(149,191,71,0.12) 0%, rgba(149,191,71,0.04) 100%)",
              border: "1px solid rgba(149,191,71,0.15)",
            }}
          >
            <Icon className="w-5 h-5 text-[#95BF47]" strokeWidth={1.6} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
              <h1 className="font-sf-display text-[22px] font-semibold tracking-tight">
                {tpl.title}
              </h1>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.08em] border ${
                  CATEGORY_COLORS[tpl.category]
                }`}
              >
                {CATEGORY_LABELS[tpl.category]}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.08em] border bg-white/[0.04] border-white/[0.08] text-white/50">
                {tpl.contextBadge}
              </span>
            </div>
            <p className="text-[13px] text-white/55 leading-relaxed max-w-3xl">
              {tpl.triggerContext}
            </p>
          </div>
        </div>
      </div>

      {/* ── 3-Column Grid ──────────────────────────────────────── */}
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* ── LEFT SIDEBAR: Config ─────────────────────────── */}
          <aside className="col-span-12 lg:col-span-3 space-y-2.5">
            <div className="sticky top-[65px]">
              {/* Section header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
                  Konfiguration
                </span>
              </div>

              {/* Error */}
              {genError && (
                <div className="glass-email px-4 py-3 mb-3 text-[13px] text-red-300/90 border-red-500/20">
                  {genError}
                </div>
              )}

              <div className="overflow-y-auto max-h-[calc(100vh-140px)] pr-0.5 space-y-2.5 pb-6">
                <ConfigPanel
                  config={config}
                  setConfig={setConfig}
                  onGenerate={handleGenerate}
                  generating={generating}
                />
              </div>
            </div>
          </aside>

          {/* ── CENTER: Preview + Deploy ─────────────────────── */}
          <section className="col-span-12 lg:col-span-6 space-y-5">
            {generated ? (
              <>
                {/* Source indicator */}
                {generated.source && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] text-white/35">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${generated.source === "deepseek" ? "bg-emerald-400" : "bg-amber-400"}`}
                      />
                      {generated.source === "deepseek"
                        ? "DeepSeek KI generiert"
                        : "Deterministischer Fallback"}
                    </div>
                    <button
                      onClick={handleGenerate}
                      disabled={generating}
                      className="inline-flex items-center gap-1.5 text-[12px] text-white/45 hover:text-white/80 transition disabled:opacity-40"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Neu generieren
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

                {/* Preview or Source */}
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
                        liquid={generated.liquid}
                        subject={generated.subject}
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
                    <div className="shrink-0">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium bg-white/[0.04] border border-white/[0.06] text-white/45">
                        <Zap className="w-3 h-3" />
                        1-Klick Deploy
                      </span>
                    </div>
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
              <EmptyState generating={generating} onGenerate={handleGenerate} />
            )}
          </section>

          {/* ── RIGHT SIDEBAR: Info + Variables + Tips ───────── */}
          <aside className="col-span-12 lg:col-span-3 space-y-4">
            <div className="sticky top-[65px] space-y-4 overflow-y-auto max-h-[calc(100vh-140px)] pr-0.5 pb-6">
              {/* Template stats */}
              <div className="glass-email p-5 space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
                  Template-Info
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      label: "Kategorie",
                      value: CATEGORY_LABELS[tpl.category],
                    },
                    { label: "Badge", value: tpl.contextBadge },
                    {
                      label: "Variablen",
                      value: `${tpl.liquidVariables.length} verfügbar`,
                    },
                    {
                      label: "API-Name",
                      value: tpl.shopifyName
                        .replace("_", " ")
                        .replace("_", " "),
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
                  <li className="font-mono text-[11.5px] text-white/40 px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.03] italic">
                    {"{% for line_item in order.line_items %}"}
                  </li>
                </ul>
              </div>

              {/* Tips */}
              {tips.length > 0 && (
                <div className="glass-email p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-white/40" strokeWidth={1.8} />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
                      Optimierungs-Tipps
                    </p>
                  </div>
                  <ul className="space-y-3">
                    {tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-[#95BF47]/15 border border-[#95BF47]/25 flex items-center justify-center text-[9px] font-bold text-[#95BF47]">
                          {i + 1}
                        </span>
                        <span className="text-[12px] text-white/60 leading-relaxed">{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────

function EmptyState({
  generating,
  onGenerate,
}: {
  generating: boolean;
  onGenerate: () => void;
}) {
  return (
    <div
      className="glass-email flex flex-col items-center justify-center text-center px-8 py-24"
      style={{ minHeight: "480px" }}
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
            <Eye className="w-6 h-6 text-white/35" />
          </div>
          <h3 className="font-sf-display text-xl font-semibold tracking-tight mb-2">
            Noch keine Vorschau
          </h3>
          <p className="text-[13px] text-white/40 max-w-[280px] leading-relaxed">
            Konfiguriere links Markenfarben und Stilrichtung, dann hier auf
            <em className="not-italic text-white/60"> Mail generieren</em> klicken.
          </p>
          <button
            onClick={onGenerate}
            className="mt-8 btn-accent inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[14px] font-semibold"
          >
            <span>Jetzt generieren</span>
          </button>
        </>
      )}
    </div>
  );
}
