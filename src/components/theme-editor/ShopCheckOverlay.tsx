"use client";

// ─── Shop-Check: Qualitäts-Checkliste für den aktuellen Shop ────────────
// Prüft das Dokument rein CLIENTSEITIG (keine API, keine Credits) gegen
// die bewährten Conversion-Regeln des Editors: genau ein Hero, gesunde
// Section-Anzahl, Social Proof, FAQ unten, Startseite, Kaufbox-Pflicht-
// Bausteine. Ergebnis als Score-Ring + Checkliste mit konkreten Tipps.

import { useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ClipboardCheck, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { ThemeDocument } from "@/lib/theme-doc";
import { getSectionDef, HERO_TYPES } from "@/lib/theme-library";
import { ACCENT } from "@/components/theme-editor/editor-ui";

export interface ShopCheckT {
  title: string;
  sub: string;
  scoreLabel: string;
  close: string;
  hero: string; heroTip: string;
  count: string; countTip: string;
  proof: string; proofTip: string;
  faq: string; faqTip: string;
  home: string; homeTip: string;
  benefits: string; benefitsTip: string;
  trust: string; trustTip: string;
  urgency: string; urgencyTip: string;
}

type State = "ok" | "warn" | "fail";
interface Check { id: string; state: State; label: string; tip: string }

const TRUST_BLOCKS = ["trust_badges", "guarantee", "social_proof", "avatar_proof", "review_quote", "payment_icons"];
const URGENCY_BLOCKS = ["urgency_text", "countdown_timer", "stock_indicator", "ship_countdown", "stock_bar"];

/** Alle Checks deterministisch aus dem Dokument ableiten. */
export function runShopChecks(doc: ThemeDocument, t: ShopCheckT): Check[] {
  const secs = doc.sections;
  const heroCount = secs.filter((s) => HERO_TYPES.has(s.type)).length;
  const active = (bt: string) => doc.buybox.order.includes(bt) && !doc.buybox.hidden.includes(bt);
  const faqIdx = secs.findIndex((s) => s.type === "collapsible-content" || s.type.includes("faq"));
  const faqLow = faqIdx >= 0 && faqIdx >= Math.floor(secs.length / 2);
  return [
    {
      id: "hero",
      state: heroCount === 1 ? "ok" : heroCount === 0 ? "fail" : "warn",
      label: t.hero,
      tip: t.heroTip,
    },
    {
      id: "count",
      state: secs.length >= 6 && secs.length <= 12 ? "ok" : secs.length >= 4 && secs.length <= 14 ? "warn" : "fail",
      label: t.count.replace("{n}", String(secs.length)),
      tip: t.countTip,
    },
    {
      id: "proof",
      state: secs.some((s) => getSectionDef(s.type)?.category === "social") ? "ok" : "fail",
      label: t.proof,
      tip: t.proofTip,
    },
    {
      id: "faq",
      state: faqIdx < 0 ? "fail" : faqLow ? "ok" : "warn",
      label: t.faq,
      tip: t.faqTip,
    },
    {
      id: "home",
      state: (doc.home || []).length >= 3 ? "ok" : (doc.home || []).length >= 1 ? "warn" : "fail",
      label: t.home,
      tip: t.homeTip,
    },
    {
      id: "benefits",
      state: active("benefits_list") ? "ok" : "fail",
      label: t.benefits,
      tip: t.benefitsTip,
    },
    {
      id: "trust",
      state: TRUST_BLOCKS.some(active) ? "ok" : "fail",
      label: t.trust,
      tip: t.trustTip,
    },
    {
      id: "urgency",
      state: URGENCY_BLOCKS.some(active) ? "ok" : "warn",
      label: t.urgency,
      tip: t.urgencyTip,
    },
  ];
}

const STATE_ICON: Record<State, typeof CheckCircle2> = { ok: CheckCircle2, warn: AlertTriangle, fail: XCircle };
const STATE_CLS: Record<State, string> = { ok: "text-[#95BF47]", warn: "text-amber-400", fail: "text-red-400" };

export default function ShopCheckOverlay({
  open, onClose, doc, t,
}: {
  open: boolean;
  onClose: () => void;
  doc: ThemeDocument;
  t: ShopCheckT;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => closeRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      prev?.focus?.();
    };
  }, [open, onClose]);

  const checks = useMemo(() => (open ? runShopChecks(doc, t) : []), [open, doc, t]);
  const okCount = checks.filter((c) => c.state === "ok").length;
  const pct = checks.length ? Math.round((okCount / checks.length) * 100) : 0;
  const ringColor = pct >= 75 ? ACCENT : pct >= 45 ? "#f59e0b" : "#ef4444";
  const R = 26;
  const CIRC = 2 * Math.PI * R;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shopcheck-title"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md max-h-[86vh] flex flex-col rounded-2xl border border-white/[0.1] bg-[#101014]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-white/[0.07] shrink-0">
              <ClipboardCheck className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />
              <div className="min-w-0 flex-1">
                <h2 id="shopcheck-title" className="text-[15px] font-bold text-white">{t.title}</h2>
                <p className="text-[11px] text-zinc-500">{t.sub}</p>
              </div>
              <button ref={closeRef} onClick={onClose} className="w-8 h-8 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white flex items-center justify-center transition" aria-label={t.close}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Score-Ring */}
            <div className="flex items-center gap-4 px-5 py-4 border-b border-white/[0.06] shrink-0">
              <div className="relative w-[64px] h-[64px] shrink-0">
                <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                  <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(128,128,128,0.2)" strokeWidth="6" />
                  <circle
                    cx="32" cy="32" r={R} fill="none" stroke={ringColor} strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct / 100)}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[15px] font-bold text-white tabular-nums">
                  {pct}%
                </span>
              </div>
              <p className="text-[12.5px] text-zinc-400 leading-snug">
                {t.scoreLabel.replace("{ok}", String(okCount)).replace("{total}", String(checks.length))}
              </p>
            </div>

            {/* Checkliste */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {checks.map((c) => {
                const Ico = STATE_ICON[c.state];
                return (
                  <div key={c.id} className="flex items-start gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
                    <Ico className={`w-4 h-4 shrink-0 mt-px ${STATE_CLS[c.state]}`} />
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-semibold text-white leading-snug">{c.label}</div>
                      {c.state !== "ok" && <div className="text-[11.5px] text-zinc-500 leading-snug mt-0.5">{c.tip}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
