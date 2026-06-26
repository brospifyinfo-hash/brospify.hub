"use client";

// ─── /email-support → „Problem melden" ───────────────────────────
// Kurzes strukturiertes Formular (Kategorie + Dringlichkeit + Beschreibung
// + Antwort-E-Mail). Geht per Resend an brospify.info@gmail.com. Ersetzt
// das alte freie „E-Mail Support"-Formular.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle, Send, Loader2, CheckCircle2, AlertCircle, Inbox, Bot, ArrowRight, Check,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { useI18n } from "@/lib/i18n";

export default function ProblemMeldenPage() {
  const router = useRouter();
  const { t } = useI18n();
  const CATEGORIES = [
    t.support.catLicense, t.support.catCredits, t.support.catTool, t.support.catTheme, t.support.catOther,
  ];
  const URGENCIES = [t.support.urgBlocked, t.support.urgAnnoying, t.support.urgInfo];
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [category, setCategory] = useState("");
  const [urgency, setUrgency] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.isLoggedIn) {
          router.push("/");
          return;
        }
        setEmail(data.googleEmail || data.kundenEmail || "");
        setAuthorized(true);
      })
      .catch(() => router.push("/"))
      .finally(() => setLoading(false));
  }, [router]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSend = !!category && !!urgency && message.trim().length >= 5 && emailOk && !sending;

  async function handleSend() {
    if (!category || !urgency) { setError(t.support.errChooseCatUrg); return; }
    if (message.trim().length < 5) { setError(t.support.errDescribe); return; }
    if (!emailOk) { setError(t.support.errValidEmail); return; }
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/email-support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, urgency, message: message.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(String(data.error || t.support.errSendFailed)); return; }
      setSuccess(true);
      setCategory("");
      setUrgency("");
      setMessage("");
    } catch {
      setError(t.support.errServer);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#95BF47]" />
      </div>
    );
  }
  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />
      <main className="max-w-2xl mx-auto px-3 sm:px-5 py-3 sm:py-5 space-y-4">
        <div className="space-y-1">
          <h1 className="text-base font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-300" />
            {t.support.reportTitle}
          </h1>
          <p className="text-[11px] text-zinc-500">
            {t.support.reportSub}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => router.push("/ai-support")} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] transition text-left">
            <Bot className="w-4 h-4 text-purple-300 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-zinc-200">AI Support</div>
              <div className="text-[10px] text-zinc-500">{t.support.aiSupportDesc}</div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
          </button>
          <button onClick={() => router.push("/ai-support?view=tickets")} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] transition text-left">
            <Inbox className="w-4 h-4 text-blue-300 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-zinc-200">{t.support.myTickets}</div>
              <div className="text-[10px] text-zinc-500">{t.support.pastRequests}</div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
          </button>
        </div>

        {success && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 text-emerald-100">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-300" />
            <div className="flex-1">
              <div className="text-xs font-semibold text-emerald-200">{t.support.reported}</div>
              <p className="text-[11px] text-emerald-100/80 mt-0.5">
                {t.support.thanksReply} {email ? <>{t.support.thanksAt} <strong>{email}</strong></> : t.support.thanksToYou}.
              </p>
            </div>
            <button onClick={() => setSuccess(false)} className="text-[10px] text-emerald-300/70 hover:text-emerald-200 underline shrink-0">{t.support.reportAgain}</button>
          </motion.div>
        )}

        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/[0.06] border border-red-500/20 text-red-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-[11px] flex-1">{error}</p>
          </div>
        )}

        <div className="space-y-4 bg-white/[0.03] border border-white/10 rounded-2xl p-4">
          {/* Q1 — Kategorie */}
          <Question num={1} label={t.support.q1} required>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <Pill key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Pill>
              ))}
            </div>
          </Question>

          {/* Q2 — Dringlichkeit */}
          <Question num={2} label={t.support.q2} required>
            <div className="flex flex-wrap gap-1.5">
              {URGENCIES.map((u) => (
                <Pill key={u} active={urgency === u} onClick={() => setUrgency(u)}>{u}</Pill>
              ))}
            </div>
          </Question>

          {/* Q3 — Beschreibung */}
          <Question num={3} label={t.support.q3} required>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sending}
              rows={6}
              maxLength={10000}
              placeholder={t.support.descPlaceholder}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50 resize-none"
            />
            <p className="text-[10px] text-zinc-500 mt-1">{t.support.autoSeeNote}</p>
          </Question>

          {/* Antwort-E-Mail */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-200 mb-1">
              {t.support.replyEmail} <span className="text-amber-300">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={sending}
              placeholder={t.support.emailPlaceholder}
              className={`w-full px-3 py-2 bg-zinc-900 border rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50 ${email && !emailOk ? "border-red-500/50" : "border-zinc-700"}`}
            />
            <p className="text-[10px] text-zinc-500 mt-1">{t.support.replyEmailNote}</p>
          </div>

          <button
            onClick={handleSend}
            disabled={!canSend}
            className="w-full py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-semibold flex items-center justify-center gap-2 text-amber-100 transition"
          >
            {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.support.sending}</> : <><Send className="w-4 h-4" /> {t.support.submitReport}</>}
          </button>
        </div>

        <div className="text-center pt-2">
          <p className="text-[10px] text-zinc-600">
            {t.support.goesTo} <strong className="text-zinc-500">brospify.info@gmail.com</strong>. {t.support.reply24}
          </p>
        </div>
      </main>
    </div>
  );
}

function Question({ num, label, required, children }: { num: number; label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-2 text-[12.5px] font-semibold text-zinc-100 mb-1.5">
        <span className="w-5 h-5 rounded-md bg-white/[0.06] text-zinc-400 text-[10px] font-bold flex items-center justify-center shrink-0">{num}</span>
        {label}
        {required && <span className="text-amber-300">*</span>}
      </label>
      {children}
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg border text-[11.5px] inline-flex items-center gap-1.5 transition ${
        active ? "border-amber-500/50 bg-amber-500/15 text-white font-medium" : "border-white/10 bg-white/[0.02] text-zinc-300 hover:bg-white/[0.05]"
      }`}
    >
      {active && <Check className="w-3 h-3 text-amber-300" />}
      {children}
    </button>
  );
}
