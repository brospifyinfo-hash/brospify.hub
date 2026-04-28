"use client";

/**
 * EditorPanel — Der Editor-Modus für ein einzelnes Template.
 *
 * Layout (Desktop): 2-Spalten — links PromptForm + Subject, rechts Preview.
 * Layout (Mobile):  Einspaltig, Form zuerst, Preview darunter.
 *
 * Daten-Flow:
 *   1. User wählt Tonfall + Notes -> klickt "Generieren".
 *   2. POST /api/email-templates/generate -> {subject, html}
 *   3. Preview rendert html, Subject ist editierbar.
 *   4. User klickt "In Shopify live schalten" -> POST /api/email-templates/deploy.
 */

import { useState } from "react";
import {
  ArrowLeft,
  Check,
  Loader2,
  Rocket,
  AlertCircle,
} from "lucide-react";
import type { EmailTemplateMeta } from "@/lib/email-templates";
import type { BrandTone } from "@/lib/ai-email-generator";
import PromptForm from "./PromptForm";
import PreviewFrame from "./PreviewFrame";

interface Props {
  meta: EmailTemplateMeta;
  shopConnected: boolean;
  shopDomain?: string;
  onBack: () => void;
  /** Callback nach erfolgreichem Deploy — Page kann das Live-Flag aktualisieren. */
  onDeployed?: () => void;
}

export default function EditorPanel({
  meta,
  shopConnected,
  shopDomain,
  onBack,
  onDeployed,
}: Props) {
  const [tone, setTone] = useState<BrandTone>("freundlich");
  const [brandName, setBrandName] = useState("");
  const [notes, setNotes] = useState("");
  const [subject, setSubject] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    setDeployed(false);
    try {
      const res = await fetch("/api/email-templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey: meta.key,
          tone,
          notes,
          brandName: brandName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Generierung fehlgeschlagen.");
        return;
      }
      setSubject(data.subject);
      setHtml(data.html);
    } catch {
      setError("Verbindungsfehler beim Generieren.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDeploy() {
    if (!html) return;
    setDeploying(true);
    setError("");
    try {
      const res = await fetch("/api/email-templates/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey: meta.key,
          html,
          subject: subject || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Deployment fehlgeschlagen.");
        return;
      }
      setDeployed(true);
      onDeployed?.();
      // Erfolg ~3s anzeigen, dann State zurücksetzen.
      setTimeout(() => setDeployed(false), 3000);
    } catch {
      setError("Verbindungsfehler beim Deploy.");
    } finally {
      setDeploying(false);
    }
  }

  const canDeploy = !!html && shopConnected && !deploying;

  return (
    <div className="space-y-6">
      {/* Top-Bar mit Back-Button + Title */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-[13px] text-white/50 hover:text-white transition mb-3 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
            Zurück zur Übersicht
          </button>
          <h2 className="text-[32px] sm:text-[38px] font-semibold tracking-tight text-white leading-tight">
            {meta.title}
          </h2>
          <p className="text-[14px] text-white/50 mt-1.5 max-w-xl">
            {meta.description}
          </p>
        </div>

        {shopConnected && shopDomain && (
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-white/40">
              Verbundener Shop
            </div>
            <div className="text-[14px] text-white/80 mt-0.5 font-mono">
              {shopDomain}
            </div>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
        {/* Linke Spalte: Form + Subject + Deploy-Button */}
        <div className="space-y-6">
          <div className="glass rounded-3xl p-7">
            <PromptForm
              tone={tone}
              setTone={setTone}
              brandName={brandName}
              setBrandName={setBrandName}
              notes={notes}
              setNotes={setNotes}
              loading={generating}
              onGenerate={handleGenerate}
            />
          </div>

          {/* Subject (nur sichtbar nach Generation) */}
          {subject !== null && (
            <div className="glass rounded-3xl p-7">
              <label className="block text-[11px] uppercase tracking-wider text-white/50 mb-2">
                Betreff
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-2xl text-[14px] text-white placeholder-white/30 outline-none focus:bg-white/[0.07] focus:border-white/25 transition"
              />
            </div>
          )}

          {/* Deploy-Banner */}
          {error && (
            <div className="flex items-start gap-2.5 px-4 py-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-[13px]">
              <AlertCircle
                className="w-4 h-4 shrink-0 mt-0.5"
                strokeWidth={1.8}
              />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {!shopConnected && (
            <div className="flex items-start gap-2.5 px-4 py-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[13px]">
              <AlertCircle
                className="w-4 h-4 shrink-0 mt-0.5"
                strokeWidth={1.8}
              />
              <span className="leading-relaxed">
                Verbinde zuerst deinen Shop, um Templates live schalten zu können.
              </span>
            </div>
          )}

          {/* DER One-Click Deploy Button — Shopify-Grün */}
          <button
            onClick={handleDeploy}
            disabled={!canDeploy}
            className={[
              "w-full py-4 rounded-2xl font-medium text-[15px] tracking-tight",
              "flex items-center justify-center gap-2.5 transition cursor-pointer",
              "disabled:cursor-not-allowed disabled:opacity-40",
              deployed
                ? "bg-[#95BF47] text-white shadow-[0_0_40px_-10px_#95BF47]"
                : "bg-[#95BF47] text-white hover:bg-[#a3cc54] hover:shadow-[0_8px_30px_-6px_rgba(149,191,71,0.5)]",
            ].join(" ")}
          >
            {deploying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.2} />
                Wird deployed...
              </>
            ) : deployed ? (
              <>
                <Check className="w-4 h-4" strokeWidth={2.4} />
                Live in Shopify
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4" strokeWidth={2} />
                In Shopify live schalten
              </>
            )}
          </button>
        </div>

        {/* Rechte Spalte: Preview */}
        <div className="min-h-[640px]">
          <PreviewFrame html={html} subject={subject} loading={generating} />
        </div>
      </div>
    </div>
  );
}
