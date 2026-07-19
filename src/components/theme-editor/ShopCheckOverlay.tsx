"use client";

// ─── Shop-Check: Qualitäts-Checkliste für den aktuellen Shop ────────────
// Prüft das Dokument rein CLIENTSEITIG (keine API, keine Credits) gegen
// die bewährten Conversion-Regeln des Editors. EXPLIZIT HELLES Premium-
// Panel (der Editor ist fest hell): Gradient-Score-Ring mit Verdikt,
// Zusammenfassungs-Chips, Check-Karten mit getönten Status-Kreisen —
// bewusst nicht über die generischen theme-light-Wildcards gestylt.

import { useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ClipboardCheck, Check, AlertTriangle, XCircle } from "lucide-react";
import type { ThemeDocument } from "@/lib/theme-doc";
import { getSectionDef, HERO_TYPES } from "@/lib/theme-library";

const INK = "#1c1b22";
const INK_SOFT = "#5c5a66";
const INK_FAINT = "#8c8a96";
const LINE = "#ecece9";
const GREEN = "#95BF47";
const GREEN_DEEP = "#4c6b1f";
const AMBER = "#f59e0b";
const AMBER_DEEP = "#92600a";
const RED = "#ef4444";
const RED_DEEP = "#b91c1c";

export interface ShopCheckT {
  title: string;
  sub: string;
  scoreLabel: string;
  close: string;
  verdictGood: string;
  verdictMid: string;
  verdictLow: string;
  chipOk: string;
  chipWarn: string;
  chipFail: string;
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
interface CheckRow { id: string; state: State; label: string; tip: string }

const TRUST_BLOCKS = ["trust_badges", "guarantee", "social_proof", "avatar_proof", "review_quote", "payment_icons"];
const URGENCY_BLOCKS = ["urgency_text", "countdown_timer", "stock_indicator", "ship_countdown", "stock_bar"];

/** Alle Checks deterministisch aus dem Dokument ableiten. */
export function runShopChecks(doc: ThemeDocument, t: ShopCheckT): CheckRow[] {
  const secs = doc.sections;
  const heroCount = secs.filter((s) => HERO_TYPES.has(s.type)).length;
  const active = (bt: string) => doc.buybox.order.includes(bt) && !doc.buybox.hidden.includes(bt);
  const faqIdx = secs.findIndex((s) => s.type === "collapsible-content" || s.type.includes("faq"));
  const faqLow = faqIdx >= 0 && faqIdx >= Math.floor(secs.length / 2);
  return [
    { id: "hero", state: heroCount === 1 ? "ok" : heroCount === 0 ? "fail" : "warn", label: t.hero, tip: t.heroTip },
    {
      id: "count",
      state: secs.length >= 6 && secs.length <= 12 ? "ok" : secs.length >= 4 && secs.length <= 14 ? "warn" : "fail",
      label: t.count.replace("{n}", String(secs.length)),
      tip: t.countTip,
    },
    { id: "proof", state: secs.some((s) => getSectionDef(s.type)?.category === "social") ? "ok" : "fail", label: t.proof, tip: t.proofTip },
    { id: "faq", state: faqIdx < 0 ? "fail" : faqLow ? "ok" : "warn", label: t.faq, tip: t.faqTip },
    {
      id: "home",
      state: (doc.home || []).length >= 3 ? "ok" : (doc.home || []).length >= 1 ? "warn" : "fail",
      label: t.home,
      tip: t.homeTip,
    },
    { id: "benefits", state: active("benefits_list") ? "ok" : "fail", label: t.benefits, tip: t.benefitsTip },
    { id: "trust", state: TRUST_BLOCKS.some(active) ? "ok" : "fail", label: t.trust, tip: t.trustTip },
    { id: "urgency", state: URGENCY_BLOCKS.some(active) ? "ok" : "warn", label: t.urgency, tip: t.urgencyTip },
  ];
}

const STATE_META: Record<State, { Ico: typeof Check; fg: string; wash: string }> = {
  ok: { Ico: Check, fg: GREEN_DEEP, wash: "rgba(149,191,71,0.16)" },
  warn: { Ico: AlertTriangle, fg: AMBER_DEEP, wash: "rgba(245,158,11,0.14)" },
  fail: { Ico: XCircle, fg: RED_DEEP, wash: "rgba(239,68,68,0.12)" },
};

function SummaryChip({ text, fg, wash }: { text: string; fg: string; wash: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full font-bold"
      style={{ fontSize: 11, padding: "4px 11px", color: fg, background: wash }}
    >
      {text}
    </span>
  );
}

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
  const warnCount = checks.filter((c) => c.state === "warn").length;
  const failCount = checks.filter((c) => c.state === "fail").length;
  const pct = checks.length ? Math.round((okCount / checks.length) * 100) : 0;
  const verdict = pct >= 75 ? t.verdictGood : pct >= 45 ? t.verdictMid : t.verdictLow;
  const verdictColor = pct >= 75 ? GREEN_DEEP : pct >= 45 ? AMBER_DEEP : RED_DEEP;
  const R = 34;
  const CIRC = 2 * Math.PI * R;
  // Sortierung: Probleme zuerst — das Wichtigste sofort im Blick.
  const ORDER: Record<State, number> = { fail: 0, warn: 1, ok: 2 };
  const sorted = [...checks].sort((a, b) => ORDER[a.state] - ORDER[b.state]);

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
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-lg max-h-[86vh] flex flex-col overflow-hidden"
            style={{
              background: "#ffffff",
              borderRadius: 24,
              border: `1px solid ${LINE}`,
              boxShadow: "0 8px 24px -12px rgba(20,18,26,0.18), 0 40px 90px -24px rgba(20,18,26,0.38)",
            }}
          >
            {/* Kopf */}
            <div className="flex items-center gap-3 shrink-0" style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${LINE}` }}>
              <span
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 38, height: 38, borderRadius: 12,
                  background: `linear-gradient(135deg, ${GREEN}, #6f9a30)`,
                  boxShadow: "0 6px 16px -6px rgba(149,191,71,0.55)",
                }}
              >
                <ClipboardCheck style={{ width: 18, height: 18, color: "#ffffff" }} strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="shopcheck-title" style={{ fontSize: 16, fontWeight: 800, color: INK }}>{t.title}</h2>
                <p style={{ fontSize: 11.5, color: INK_FAINT }}>{t.sub}</p>
              </div>
              <button
                ref={closeRef}
                onClick={onClose}
                aria-label={t.close}
                className="bspx-rail-slim flex items-center justify-center shrink-0"
                style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${LINE}`, background: "#fff", cursor: "pointer" }}
              >
                <X style={{ width: 15, height: 15 }} strokeWidth={2} />
              </button>
            </div>

            {/* Score-Held: Gradient-Ring + Verdikt + Chips */}
            <div className="flex items-center gap-5 shrink-0" style={{ padding: "16px 20px", borderBottom: `1px solid ${LINE}`, background: "linear-gradient(180deg, #fafaf8, #ffffff)" }}>
              <div className="relative shrink-0" style={{ width: 84, height: 84 }}>
                <svg viewBox="0 0 84 84" className="w-full h-full -rotate-90">
                  <defs>
                    <linearGradient id="bspx-score-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={pct >= 75 ? "#b5d874" : pct >= 45 ? "#fbbf24" : "#f87171"} />
                      <stop offset="100%" stopColor={pct >= 75 ? GREEN : pct >= 45 ? AMBER : RED} />
                    </linearGradient>
                  </defs>
                  <circle cx="42" cy="42" r={R} fill="none" stroke="#efefec" strokeWidth="8" />
                  <motion.circle
                    cx="42" cy="42" r={R} fill="none" stroke="url(#bspx-score-grad)" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={CIRC}
                    initial={{ strokeDashoffset: CIRC }}
                    animate={{ strokeDashoffset: CIRC * (1 - pct / 100) }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center tabular-nums" style={{ fontSize: 19, fontWeight: 800, color: INK }}>
                  {pct}%
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div style={{ fontSize: 16.5, fontWeight: 800, color: verdictColor, marginBottom: 6 }}>{verdict}</div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <SummaryChip text={t.chipOk.replace("{n}", String(okCount))} fg={GREEN_DEEP} wash="rgba(149,191,71,0.16)" />
                  {warnCount > 0 && <SummaryChip text={t.chipWarn.replace("{n}", String(warnCount))} fg={AMBER_DEEP} wash="rgba(245,158,11,0.14)" />}
                  {failCount > 0 && <SummaryChip text={t.chipFail.replace("{n}", String(failCount))} fg={RED_DEEP} wash="rgba(239,68,68,0.12)" />}
                </div>
                <p style={{ fontSize: 11, color: INK_FAINT, marginTop: 7, lineHeight: 1.45 }}>
                  {t.scoreLabel.replace("{ok}", String(okCount)).replace("{total}", String(checks.length))}
                </p>
              </div>
            </div>

            {/* Checkliste — Probleme zuerst */}
            <div className="flex-1 overflow-y-auto" style={{ padding: "14px 20px 18px" }}>
              <div className="space-y-2">
                {sorted.map((c, i) => {
                  const meta = STATE_META[c.state];
                  const Ico = meta.Ico;
                  return (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 + i * 0.035, duration: 0.25, ease: "easeOut" }}
                      className="flex items-start gap-3"
                      style={{
                        borderRadius: 14,
                        border: `1px solid ${c.state === "ok" ? LINE : c.state === "warn" ? "rgba(245,158,11,0.35)" : "rgba(239,68,68,0.3)"}`,
                        background: c.state === "ok" ? "#ffffff" : c.state === "warn" ? "rgba(245,158,11,0.05)" : "rgba(239,68,68,0.04)",
                        padding: "10px 12px",
                      }}
                    >
                      <span
                        className="flex items-center justify-center shrink-0"
                        style={{ width: 26, height: 26, borderRadius: 999, background: meta.wash, marginTop: 1 }}
                      >
                        <Ico style={{ width: 14, height: 14, color: meta.fg }} strokeWidth={2.4} />
                      </span>
                      <div className="min-w-0">
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, lineHeight: 1.35 }}>{c.label}</div>
                        {c.state !== "ok" && (
                          <div style={{ fontSize: 11.5, color: INK_SOFT, lineHeight: 1.45, marginTop: 2 }}>{c.tip}</div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
