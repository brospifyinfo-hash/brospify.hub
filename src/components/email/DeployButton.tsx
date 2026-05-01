"use client";

// ─── Deploy Button ───────────────────────────────────────────────
// Prominent Shopify-green CTA. Calls /api/email-templates/deploy
// which writes the generated Liquid into the matching Shopify
// notification template via the Admin REST API.

import { Loader2, Check, AlertTriangle, Zap } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface DeployButtonProps {
  templateId: string;
  liquid: string;
  subject: string;
  /** Set to false to gate the button (e.g. shop not connected). */
  ready: boolean;
}

type DeployState =
  | { kind: "idle" }
  | { kind: "deploying" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export function DeployButton({ templateId, liquid, subject, ready }: DeployButtonProps) {
  const [state, setState] = useState<DeployState>({ kind: "idle" });

  async function deploy() {
    if (!ready || state.kind === "deploying") return;
    setState({ kind: "deploying" });
    try {
      const res = await fetch("/api/email-templates/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, liquid, subject }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? "Deployment fehlgeschlagen." });
        return;
      }
      setState({ kind: "success" });
      setTimeout(() => setState({ kind: "idle" }), 3500);
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Netzwerkfehler.",
      });
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={deploy}
        disabled={!ready || state.kind === "deploying" || state.kind === "success"}
        className="btn-deploy w-full inline-flex items-center justify-center gap-2.5 px-6 py-4 text-[15px]"
      >
        <AnimatePresence mode="wait" initial={false}>
          {state.kind === "deploying" ? (
            <motion.span
              key="deploying"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="inline-flex items-center gap-2.5"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              Wird in Shopify gepusht…
            </motion.span>
          ) : state.kind === "success" ? (
            <motion.span
              key="success"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center gap-2.5"
            >
              <Check className="w-4 h-4" strokeWidth={2.5} />
              Live im Shop
            </motion.span>
          ) : (
            <motion.span
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="inline-flex items-center gap-2.5"
            >
              <Zap className="w-4 h-4" strokeWidth={2.2} />
              In Shopify live schalten
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {!ready && (
        <p className="flex items-center gap-2 text-[12px] text-amber-300/80">
          <AlertTriangle className="w-3.5 h-3.5" />
          Verbinde zuerst deinen Shop in den Einstellungen.
        </p>
      )}

      <AnimatePresence>
        {state.kind === "error" && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2 text-[12px] text-red-300/90 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5"
          >
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{state.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
