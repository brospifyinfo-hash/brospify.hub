"use client";

// ─── Email Template Editor ───────────────────────────────────────
// Three-column-on-desktop layout:
//  · left:  AI input form (tone, notes, color)
//  · right: live preview + deploy button
//
// State machine: idle → generating → previewing → deploying → done
// All network calls hit /api/email-templates/{generate,deploy}.

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Code2, Eye, Copy, Check, Loader2 } from "lucide-react";
import { getTemplateById } from "@/lib/email-templates";
import type { BrandTone } from "@/lib/ai-email-generator";
import { AIPromptForm } from "@/components/email/AIPromptForm";
import { EmailPreview } from "@/components/email/EmailPreview";
import { DeployButton } from "@/components/email/DeployButton";

interface PageProps {
  params: Promise<{ templateId: string }>;
}

interface GeneratedTemplate {
  liquid: string;
  subject: string;
}

export default function TemplateEditorPage({ params }: PageProps) {
  const { templateId } = use(params);
  const tpl = getTemplateById(templateId);

  // ─── form state ─────────────────────────────────
  const [brandTone, setBrandTone] = useState<BrandTone>("seriös");
  const [specialNotes, setSpecialNotes] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#95BF47");

  // ─── generation state ───────────────────────────
  const [generated, setGenerated] = useState<GeneratedTemplate | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // ─── view toggle (preview vs source) ────────────
  const [view, setView] = useState<"preview" | "source">("preview");
  const [copied, setCopied] = useState(false);

  // ─── shop connection check ──────────────────────
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
          <h1 className="font-sf-display text-xl font-semibold mb-2">Vorlage nicht gefunden</h1>
          <p className="text-white/55 text-sm mb-5">
            Die angeforderte Email-Vorlage existiert nicht.
          </p>
          <Link href="/email-templates" className="text-[13px] text-white/80 hover:text-white">
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
          brandTone,
          specialNotes,
          primaryColor,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenError(data.error ?? "Generierung fehlgeschlagen.");
        return;
      }
      setGenerated({ liquid: data.liquid, subject: data.subject });
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

  return (
    <div className="min-h-screen bg-email-mesh font-sf text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/30 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/email-templates"
            className="inline-flex items-center gap-2 text-[13px] text-white/60 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Alle Vorlagen
          </Link>

          <div className="flex items-center gap-2 text-[12px]">
            <span className="font-mono text-white/40">{tpl.shopifyName}</span>
            <span className="text-white/20">·</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                shopReady
                  ? "bg-emerald-400/10 border-emerald-400/20 text-emerald-300"
                  : "bg-amber-400/10 border-amber-400/20 text-amber-300"
              }`}
            >
              {shopReady ? "Shop verbunden" : "Shop nicht verbunden"}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Title row */}
        <div className="flex items-start gap-4 mb-10">
          <div className="inline-flex w-14 h-14 items-center justify-center rounded-2xl glass-email">
            <Icon className="w-6 h-6 text-white/85" strokeWidth={1.6} />
          </div>
          <div>
            <h1 className="font-sf-display text-3xl sm:text-4xl font-semibold tracking-tight">
              {tpl.title}
            </h1>
            <p className="mt-1 text-[14px] text-white/60 max-w-xl">{tpl.description}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* ─── LEFT: AI input ────────────────────── */}
          <aside className="lg:col-span-4 space-y-6">
            <AIPromptForm
              brandTone={brandTone}
              setBrandTone={setBrandTone}
              specialNotes={specialNotes}
              setSpecialNotes={setSpecialNotes}
              primaryColor={primaryColor}
              setPrimaryColor={setPrimaryColor}
              onGenerate={handleGenerate}
              generating={generating}
            />

            {genError && (
              <div className="glass-email px-4 py-3 text-[13px] text-red-300/90">
                {genError}
              </div>
            )}

            {/* Variable cheatsheet */}
            <div className="glass-email p-5">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45 mb-3">
                Verfügbare Liquid-Variablen
              </div>
              <ul className="space-y-1.5">
                {tpl.liquidVariables.map((v) => (
                  <li
                    key={v}
                    className="font-mono text-[12px] text-white/70 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.04]"
                  >
                    {`{{ ${v} }}`}
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* ─── RIGHT: preview + deploy ───────────── */}
          <section className="lg:col-span-8 space-y-6">
            {generated ? (
              <>
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
                      className="inline-flex items-center gap-1.5 text-[12px] text-white/60 hover:text-white transition"
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
                      transition={{ duration: 0.3 }}
                    >
                      <EmailPreview liquid={generated.liquid} subject={generated.subject} />
                    </motion.div>
                  ) : (
                    <motion.pre
                      key="source"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="glass-email p-5 overflow-x-auto text-[12px] leading-relaxed font-mono text-white/75 max-h-[780px]"
                    >
                      {generated.liquid}
                    </motion.pre>
                  )}
                </AnimatePresence>

                {/* Deploy */}
                <div className="glass-email p-6 space-y-4">
                  <div>
                    <h3 className="font-sf-display text-[18px] font-semibold tracking-tight">
                      Bereit zum Live-Schalten
                    </h3>
                    <p className="text-[13px] text-white/55 mt-1">
                      Klick speichert das Template in deinem Shopify-Konto und überschreibt die
                      bestehende{" "}
                      <span className="font-mono text-white/75">{tpl.shopifyName}</span>
                      -Benachrichtigung.
                    </p>
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
              <EmptyPreview generating={generating} />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

// ─── Empty state ────────────────────────────────────────────────

function EmptyPreview({ generating }: { generating: boolean }) {
  return (
    <div className="glass-email aspect-[4/3] flex flex-col items-center justify-center text-center px-8">
      {generating ? (
        <>
          <Loader2 className="w-8 h-8 text-white/60 animate-spin mb-4" />
          <h3 className="font-sf-display text-xl font-semibold tracking-tight">
            Generiert dein Template…
          </h3>
          <p className="mt-2 text-[13px] text-white/50 max-w-sm">
            Wir verarbeiten deinen Markenton und bauen valides Shopify-Liquid.
          </p>
        </>
      ) : (
        <>
          <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
            <Eye className="w-5 h-5 text-white/55" />
          </div>
          <h3 className="font-sf-display text-xl font-semibold tracking-tight">
            Noch keine Vorschau
          </h3>
          <p className="mt-2 text-[13px] text-white/50 max-w-sm">
            Wähle links Tonfall und Hinweise, dann wird die Mail hier
            in Mobile- und Desktop-Ansicht gerendert.
          </p>
        </>
      )}
    </div>
  );
}
