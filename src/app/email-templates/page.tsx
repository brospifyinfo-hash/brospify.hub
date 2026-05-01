"use client";

// ─── AI Email Template Dashboard ─────────────────────────────────
// Apple-style minimal grid of the Top 10 Shopify notification emails.
// Each card opens the editor where the user can generate via AI,
// preview, and deploy directly into the connected Shopify shop.

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Mail } from "lucide-react";
import { EMAIL_TEMPLATES } from "@/lib/email-templates";

const CATEGORY_LABEL: Record<string, string> = {
  transactional: "Transaktional",
  lifecycle: "Lifecycle",
  recovery: "Recovery",
};

export default function EmailTemplatesDashboard() {
  return (
    <div className="min-h-screen bg-email-mesh font-sf text-white">
      {/* Hero */}
      <header className="mx-auto max-w-6xl px-6 pt-20 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-2 mb-6"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-medium tracking-wide uppercase glass-email"
                style={{ color: "#95BF47" }}>
            <Sparkles className="w-3 h-3" />
            AI · Email Studio
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="font-sf-display text-5xl sm:text-6xl font-semibold tracking-tight max-w-3xl"
        >
          Deine Shopify-Mails.
          <br />
          <span className="text-white/50">Generiert. Geprüft. Deployt.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 max-w-xl text-[15px] leading-relaxed text-white/60"
        >
          Wähle eine der zehn wichtigsten Shopify-Benachrichtigungen.
          Beschreibe deinen Tonfall — die KI baut das Liquid-Template,
          du prüfst die Vorschau, und ein Klick spielt sie in deinen Shop.
        </motion.p>
      </header>

      {/* Grid */}
      <main className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {EMAIL_TEMPLATES.map((tpl, i) => {
            const Icon = tpl.icon;
            return (
              <motion.div
                key={tpl.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.05 + i * 0.04,
                  duration: 0.5,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <Link
                  href={`/email-templates/${tpl.id}`}
                  className="group relative block glass-email-card p-6 h-full"
                >
                  {/* Accent glow */}
                  <div
                    className={`absolute inset-0 rounded-[1.25rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br ${tpl.accent}`}
                  />

                  <div className="relative flex flex-col h-full">
                    {/* Icon */}
                    <div className="mb-5 inline-flex w-11 h-11 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06]">
                      <Icon className="w-5 h-5 text-white/80" strokeWidth={1.6} />
                    </div>

                    {/* Category */}
                    <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40 mb-2">
                      {CATEGORY_LABEL[tpl.category]}
                    </div>

                    {/* Title */}
                    <h3 className="font-sf-display text-[19px] font-semibold leading-tight tracking-tight text-white">
                      {tpl.title}
                    </h3>

                    {/* Tagline */}
                    <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">
                      {tpl.tagline}
                    </p>

                    {/* Footer */}
                    <div className="mt-auto pt-6 flex items-center justify-between">
                      <span className="text-[11px] font-mono text-white/30">
                        {tpl.shopifyName}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-white/70 group-hover:text-white transition-colors">
                        Öffnen
                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="mt-16 flex items-center justify-center">
          <div className="glass-email px-5 py-3 inline-flex items-center gap-3 text-[13px] text-white/55">
            <Mail className="w-4 h-4" />
            <span>Alle Vorlagen werden direkt in dein verbundenes Shopify-Konto gepusht.</span>
          </div>
        </div>
      </main>
    </div>
  );
}
