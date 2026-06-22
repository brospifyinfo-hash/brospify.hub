"use client";

// ─── SurveyCard — gestaffelte Umfragen auf der Startseite ──────────
// Zeigt die aktuell freigeschaltete Umfrage (mit „Neu"-Badge + Credit-
// Belohnung), sammelt Antworten und schickt sie an POST /api/survey. Nach
// Abschluss erscheint die nächste freigeschaltete Umfrage; ist gerade keine
// offen, zeigt eine dezente Vorschau, wann die nächste kommt.

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquareHeart, Star, Check, Loader2, Send, Coins, Clock, Lock } from "lucide-react";
import { useCredits } from "@/lib/credits";
import type { SurveyQuestion, SurveyAnswers } from "@/lib/survey";

const ACCENT = "#95BF47";

interface SurveyWithStatus {
  id: string;
  title: string;
  description: string;
  creditReward: number;
  unlockAfterDays: number;
  questions: SurveyQuestion[];
  status: "available" | "completed" | "locked";
  unlocksInDays: number;
}

export default function SurveyCard() {
  const credits = useCredits();
  const [loaded, setLoaded] = useState(false);
  const [surveys, setSurveys] = useState<SurveyWithStatus[]>([]);
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [submitting, setSubmitting] = useState(false);
  const [doneReward, setDoneReward] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/survey", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setSurveys(Array.isArray(data.surveys) ? data.surveys : []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => { cancelled = true; };
  }, []);

  const current = surveys.find((s) => s.status === "available") || null;
  const nextLocked = surveys
    .filter((s) => s.status === "locked")
    .sort((a, b) => a.unlocksInDays - b.unlocksInDays)[0] || null;

  function setAnswer(id: string, value: number | string | string[]) {
    setAnswers((a) => ({ ...a, [id]: value }));
  }
  function toggleMulti(id: string, option: string) {
    setAnswers((a) => {
      const cur = Array.isArray(a[id]) ? (a[id] as string[]) : [];
      return { ...a, [id]: cur.includes(option) ? cur.filter((x) => x !== option) : [...cur, option] };
    });
  }
  function requiredOk(s: SurveyWithStatus): boolean {
    return s.questions.every((q) => !q.required || answers[q.id] !== undefined);
  }

  async function submit(s: SurveyWithStatus) {
    if (submitting) return;
    if (!requiredOk(s)) {
      setError("Bitte beantworte die markierte Pflichtfrage (⭐).");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId: s.id, answers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Speichern fehlgeschlagen.");
        return;
      }
      if (typeof data.creditsRemaining === "number") credits.setBalance(data.creditsRemaining);
      setDoneReward(typeof data.creditsAwarded === "number" ? data.creditsAwarded : s.creditReward);
      // Diese Umfrage lokal als erledigt markieren + Antworten zurücksetzen.
      setSurveys((list) => list.map((x) => (x.id === s.id ? { ...x, status: "completed" } : x)));
      setTimeout(() => { setDoneReward(null); setAnswers({}); }, 2600);
    } catch {
      setError("Verbindungsfehler. Bitte erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!loaded) return null;

  // Danke-Animation direkt nach dem Absenden.
  if (doneReward !== null) {
    return (
      <section className="rounded-2xl sm:rounded-3xl border border-[#95BF47]/20 bg-[#95BF47]/[0.06] p-5 text-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-[#95BF47]/15 border border-[#95BF47]/30 flex items-center justify-center">
            <Check className="w-6 h-6" style={{ color: ACCENT }} />
          </div>
          <p className="text-[15px] font-bold text-white">Danke für dein Feedback!</p>
          <p className="text-[12.5px] text-zinc-300 inline-flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-300" />
            <span className="font-semibold text-amber-200">+{doneReward} Credits</span> gutgeschrieben
          </p>
        </motion.div>
      </section>
    );
  }

  // Keine offene Umfrage → dezente Vorschau auf die nächste (oder nichts).
  if (!current) {
    if (!nextLocked) return null;
    return (
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0">
          <Clock className="w-4 h-4 text-zinc-400" />
        </div>
        <p className="text-[12.5px] text-zinc-300 flex-1 leading-snug">
          Nächste Umfrage{" "}
          <span className="text-white font-medium">
            {nextLocked.unlocksInDays <= 1 ? "in Kürze" : `in ${nextLocked.unlocksInDays} Tagen`}
          </span>{" "}
          — bringt dir <span className="text-amber-200 font-medium">+{nextLocked.creditReward} Credits</span>.
        </p>
        <Lock className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
      </section>
    );
  }

  return (
    <section className="rounded-2xl sm:rounded-3xl border border-[#95BF47]/20 bg-gradient-to-b from-[#95BF47]/[0.07] to-white/[0.02] p-4 sm:p-5 relative overflow-hidden">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-[#95BF47]/15 border border-[#95BF47]/25 flex items-center justify-center shrink-0">
          <MessageSquareHeart className="w-[18px] h-[18px]" style={{ color: ACCENT }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] uppercase tracking-[0.18em] font-bold text-[#95BF47] bg-[#95BF47]/12 border border-[#95BF47]/25 rounded px-1.5 py-0.5">
              Neue Umfrage
            </span>
            <span className="text-[9px] uppercase tracking-[0.16em] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded px-1.5 py-0.5 inline-flex items-center gap-1">
              <Coins className="w-2.5 h-2.5" /> +{current.creditReward} Credits
            </span>
          </div>
          <h2 className="text-[15px] font-bold text-white leading-tight mt-1.5">{current.title}</h2>
          <p className="text-[12px] text-zinc-400 mt-0.5 leading-snug">{current.description}</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={current.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {current.questions.map((q) => (
            <QuestionField key={q.id} q={q} answers={answers} setAnswer={setAnswer} toggleMulti={toggleMulti} />
          ))}

          {error && <p className="text-[11.5px] text-red-400">{error}</p>}

          <button
            onClick={() => submit(current)}
            disabled={submitting}
            className="btn-deploy w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[14px] disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Absenden & +{current.creditReward} Credits sichern
          </button>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function QuestionField({
  q,
  answers,
  setAnswer,
  toggleMulti,
}: {
  q: SurveyQuestion;
  answers: SurveyAnswers;
  setAnswer: (id: string, v: number | string | string[]) => void;
  toggleMulti: (id: string, option: string) => void;
}) {
  const val = answers[q.id];
  return (
    <div>
      <label className="block text-[12.5px] font-semibold text-zinc-200 leading-snug">
        {q.label}
        {q.required && <span className="text-[#95BF47]" title="Pflichtfrage"> ⭐</span>}
      </label>
      {q.hint && <p className="text-[10.5px] text-zinc-500 mt-0.5 mb-1.5">{q.hint}</p>}

      {q.type === "rating" && (
        <div className="flex gap-1.5 mt-1">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = typeof val === "number" && n <= val;
            return (
              <button
                key={n}
                onClick={() => setAnswer(q.id, n)}
                className={`w-9 h-9 rounded-lg border flex items-center justify-center transition ${
                  active ? "border-[#95BF47]/50 bg-[#95BF47]/15" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                }`}
                aria-label={`${n} von 5`}
              >
                <Star className="w-4 h-4" style={{ color: active ? ACCENT : "#52525b", fill: active ? ACCENT : "none" }} />
              </button>
            );
          })}
        </div>
      )}

      {q.type === "single" && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {q.options?.map((o) => {
            const active = val === o;
            return (
              <button
                key={o}
                onClick={() => setAnswer(q.id, o)}
                className={`px-2.5 py-1.5 rounded-lg border text-[11.5px] transition ${
                  active ? "border-[#95BF47]/50 bg-[#95BF47]/15 text-white" : "border-white/10 bg-white/[0.02] text-zinc-300 hover:bg-white/[0.05]"
                }`}
              >
                {o}
              </button>
            );
          })}
        </div>
      )}

      {q.type === "multi" && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {q.options?.map((o) => {
            const active = Array.isArray(val) && val.includes(o);
            return (
              <button
                key={o}
                onClick={() => toggleMulti(q.id, o)}
                className={`px-2.5 py-1.5 rounded-lg border text-[11.5px] inline-flex items-center gap-1 transition ${
                  active ? "border-[#95BF47]/50 bg-[#95BF47]/15 text-white" : "border-white/10 bg-white/[0.02] text-zinc-300 hover:bg-white/[0.05]"
                }`}
              >
                {active && <Check className="w-3 h-3" style={{ color: ACCENT }} />}
                {o}
              </button>
            );
          })}
        </div>
      )}

      {q.type === "text" && (
        <textarea
          value={typeof val === "string" ? val : ""}
          onChange={(e) => setAnswer(q.id, e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Deine Antwort…"
          className="input-glass w-full text-[12.5px] mt-1 resize-none"
        />
      )}
    </div>
  );
}
