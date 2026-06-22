"use client";

// ─── SurveyCard — gestaffelte Umfragen auf der Startseite ──────────
// 3 Phasen: INTRO (Teaser + „Umfrage starten") → ACTIVE (Fragen, wird erst
// nach aktivem Start geöffnet) → DONE (Danke + Credits).
//
// Hintergrund-Tracking: misst die Zeitabstände zwischen den Antworten, um zu
// erkennen, ob jemand nur durchklickt. Die Metriken gehen als `meta` mit der
// Abgabe an /api/survey; das rushed-Flag wird serverseitig bestimmt.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquareHeart, Star, Check, Loader2, Send, Coins, Clock, Lock, ArrowRight, ListChecks, AlertTriangle, Ban,
} from "lucide-react";
import { useCredits } from "@/lib/credits";
import { FAST_GAP_MS, type SurveyQuestion, type SurveyAnswers } from "@/lib/survey";

const ACCENT = "#95BF47";
const RATING_LABELS = ["", "gar nicht", "eher nicht", "neutral", "gut", "sehr gut"];

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
  const [phase, setPhase] = useState<"intro" | "active">("intro");
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [submitting, setSubmitting] = useState(false);
  const [doneReward, setDoneReward] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [blockedMsg, setBlockedMsg] = useState("");

  // Timing-Tracking (Hintergrund).
  const startRef = useRef(0);
  const timesRef = useRef<Record<string, number>>({});

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

  function markAnswered(id: string) {
    if (timesRef.current[id] === undefined) timesRef.current[id] = Date.now();
  }
  function setAnswer(id: string, value: number | string | string[]) {
    markAnswered(id);
    setAnswers((a) => ({ ...a, [id]: value }));
  }
  function toggleMulti(id: string, option: string) {
    markAnswered(id);
    setAnswers((a) => {
      const cur = Array.isArray(a[id]) ? (a[id] as string[]) : [];
      return { ...a, [id]: cur.includes(option) ? cur.filter((x) => x !== option) : [...cur, option] };
    });
  }

  function startSurvey() {
    startRef.current = Date.now();
    timesRef.current = {};
    setAnswers({});
    setError("");
    setWarning("");
    setPhase("active");
  }

  function buildMeta() {
    const times = Object.values(timesRef.current).sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < times.length; i++) gaps.push(times[i] - times[i - 1]);
    const sortedGaps = [...gaps].sort((a, b) => a - b);
    const medianGapMs = sortedGaps.length ? sortedGaps[Math.floor(sortedGaps.length / 2)] : 0;
    const minGapMs = sortedGaps.length ? sortedGaps[0] : 0;
    const fastCount = gaps.filter((g) => g < FAST_GAP_MS).length;
    return {
      durationMs: startRef.current ? Date.now() - startRef.current : 0,
      answeredCount: times.length,
      fastCount,
      medianGapMs,
      minGapMs,
    };
  }

  async function submit(s: SurveyWithStatus) {
    if (submitting) return;
    const missing = s.questions.filter((q) => q.required && answers[q.id] === undefined);
    if (missing.length > 0) {
      setError("Bitte beantworte die markierte Pflichtfrage (⭐).");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId: s.id, answers, meta: buildMeta() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Speichern fehlgeschlagen.");
        return;
      }
      // 2× durchgeklickt → Umfrage beendet, keine Credits (Terminal-Karte).
      if (data.blocked) {
        setSurveys((list) => list.map((x) => (x.id === s.id ? { ...x, status: "completed" } : x)));
        setBlockedMsg(data.message || "Diese Umfrage wurde beendet. Es werden keine Credits gutgeschrieben.");
        return;
      }
      // 1× durchgeklickt → Warnung: in Ruhe neu ausfüllen (Antworten + Timer reset).
      if (data.warning) {
        setWarning(data.message || "Bitte lies dir die Fragen in Ruhe durch.");
        setAnswers({});
        timesRef.current = {};
        startRef.current = Date.now();
        return;
      }
      if (typeof data.creditsRemaining === "number") credits.setBalance(data.creditsRemaining);
      setDoneReward(typeof data.creditsAwarded === "number" ? data.creditsAwarded : s.creditReward);
      setSurveys((list) => list.map((x) => (x.id === s.id ? { ...x, status: "completed" } : x)));
      setPhase("intro");
      setTimeout(() => { setDoneReward(null); setAnswers({}); }, 2800);
    } catch {
      setError("Verbindungsfehler. Bitte erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!loaded) return null;

  // ── BLOCKED: 2× durchgeklickt → beendet, keine Credits ──
  if (blockedMsg) {
    return (
      <section className="rounded-2xl sm:rounded-3xl border border-red-500/25 bg-red-500/[0.06] p-5 sm:p-6 text-center">
        <div className="inline-flex flex-col items-center gap-2.5">
          <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
            <Ban className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-[15px] font-bold text-white">Umfrage beendet</p>
          <p className="text-[12.5px] text-zinc-300 max-w-sm leading-snug">{blockedMsg}</p>
        </div>
      </section>
    );
  }

  // ── DONE ──
  if (doneReward !== null) {
    return (
      <section className="rounded-2xl sm:rounded-3xl border border-[#95BF47]/20 bg-[#95BF47]/[0.06] p-6 text-center">
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex flex-col items-center gap-2.5">
          <div className="w-14 h-14 rounded-2xl bg-[#95BF47]/15 border border-[#95BF47]/30 flex items-center justify-center">
            <Check className="w-7 h-7" style={{ color: ACCENT }} />
          </div>
          <p className="text-[16px] font-bold text-white">Danke für dein Feedback! 🙌</p>
          <p className="text-[13px] text-zinc-300 inline-flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-300" />
            <span className="font-semibold text-amber-200">+{doneReward} Credits</span> wurden dir gutgeschrieben
          </p>
        </motion.div>
      </section>
    );
  }

  // ── Keine offene Umfrage → dezente Vorschau ──
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

  const answeredCount = current.questions.filter((q) => answers[q.id] !== undefined).length;
  const totalQ = current.questions.length;
  const requiredLeft = current.questions.filter((q) => q.required && answers[q.id] === undefined).length;
  const estMin = Math.max(1, Math.round(totalQ * 0.33));

  return (
    <section className="rounded-2xl sm:rounded-3xl border border-[#95BF47]/20 bg-gradient-to-b from-[#95BF47]/[0.08] to-white/[0.02] relative overflow-hidden">
      {/* Kopf */}
      <div className="p-4 sm:p-5 pb-3 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#95BF47]/15 border border-[#95BF47]/25 flex items-center justify-center shrink-0">
          <MessageSquareHeart className="w-5 h-5" style={{ color: ACCENT }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] uppercase tracking-[0.18em] font-bold text-[#95BF47] bg-[#95BF47]/12 border border-[#95BF47]/25 rounded px-1.5 py-0.5">
              Neue Umfrage
            </span>
            <span className="text-[9px] uppercase tracking-[0.16em] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded px-1.5 py-0.5 inline-flex items-center gap-1">
              <Coins className="w-2.5 h-2.5" /> +{current.creditReward} Credits
            </span>
          </div>
          <h2 className="text-[16px] sm:text-[17px] font-bold text-white leading-tight mt-1.5">{current.title}</h2>
          <p className="text-[12.5px] text-zinc-400 mt-0.5 leading-snug">{current.description}</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase === "intro" ? (
          // ── INTRO: aktiv starten ──
          <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 sm:px-5 pb-5">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Chip icon={ListChecks} text={`${totalQ} Fragen`} />
              <Chip icon={Clock} text={`~${estMin} Min`} />
              <Chip icon={Coins} text={`+${current.creditReward} Credits`} amber />
            </div>
            <button
              onClick={startSurvey}
              className="btn-deploy w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 text-[14px] font-semibold"
            >
              Umfrage starten
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="mt-2.5 text-[10.5px] text-zinc-600 leading-snug">
              Dein Feedback bestimmt, woran wir als Nächstes arbeiten. Nimm dir kurz Zeit — die Credits
              gibt&apos;s direkt nach dem Absenden.
            </p>
          </motion.div>
        ) : (
          // ── ACTIVE: Fragen ──
          <motion.div key="active" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {warning && (
              <div className="mx-4 sm:mx-5 mb-3 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-3.5 py-3">
                <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <p className="text-[12px] text-amber-100/90 leading-snug">{warning}</p>
              </div>
            )}
            {/* Fortschrittsleiste */}
            <div className="px-4 sm:px-5">
              <div className="flex items-center justify-between text-[10.5px] text-zinc-500 mb-1">
                <span>Fortschritt</span>
                <span className="tabular-nums">{answeredCount}/{totalQ} beantwortet</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#95BF47] to-emerald-400"
                  animate={{ width: `${Math.round((answeredCount / totalQ) * 100)}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            <div className="p-4 sm:p-5 space-y-2.5">
              {current.questions.map((q, i) => (
                <QuestionField
                  key={q.id}
                  index={i + 1}
                  total={totalQ}
                  q={q}
                  answers={answers}
                  setAnswer={setAnswer}
                  toggleMulti={toggleMulti}
                />
              ))}

              {error && <p className="text-[11.5px] text-red-400">{error}</p>}

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
                <button
                  onClick={() => submit(current)}
                  disabled={submitting || requiredLeft > 0}
                  className="btn-deploy inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[14px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Absenden & +{current.creditReward} Credits sichern
                </button>
                {requiredLeft > 0 && (
                  <span className="text-[11px] text-zinc-500">Noch {requiredLeft} Pflichtfrage{requiredLeft > 1 ? "n" : ""} (⭐)</span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Chip({ icon: Icon, text, amber }: { icon: typeof Clock; text: string; amber?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11.5px] font-medium ${
      amber ? "bg-amber-500/10 border-amber-500/25 text-amber-200" : "bg-white/[0.03] border-white/10 text-zinc-300"
    }`}>
      <Icon className="w-3.5 h-3.5" />
      {text}
    </span>
  );
}

function QuestionField({
  index, total, q, answers, setAnswer, toggleMulti,
}: {
  index: number;
  total: number;
  q: SurveyQuestion;
  answers: SurveyAnswers;
  setAnswer: (id: string, v: number | string | string[]) => void;
  toggleMulti: (id: string, option: string) => void;
}) {
  const val = answers[q.id];
  const answered = val !== undefined;
  return (
    <div className={`rounded-xl border p-3 sm:p-3.5 transition ${
      answered ? "border-[#95BF47]/20 bg-[#95BF47]/[0.04]" : "border-white/[0.07] bg-white/[0.02]"
    }`}>
      <div className="flex items-start gap-2.5">
        <span className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
          answered ? "bg-[#95BF47] text-black" : "bg-white/[0.06] text-zinc-400"
        }`}>
          {answered ? <Check className="w-3 h-3" strokeWidth={3} /> : index}
        </span>
        <div className="flex-1 min-w-0">
          <label className="block text-[12.5px] font-semibold text-zinc-100 leading-snug">
            {q.label}
            {q.required && <span className="text-[#95BF47]" title="Pflichtfrage"> ⭐</span>}
            <span className="text-zinc-600 font-normal text-[10.5px]"> · {index}/{total}</span>
          </label>
          {q.hint && <p className="text-[10.5px] text-zinc-500 mt-0.5">{q.hint}</p>}

          {q.type === "rating" && (
            <div className="mt-2">
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => {
                  const active = typeof val === "number" && n <= val;
                  return (
                    <button
                      key={n}
                      onClick={() => setAnswer(q.id, n)}
                      className={`w-10 h-10 rounded-lg border flex items-center justify-center transition ${
                        active ? "border-[#95BF47]/50 bg-[#95BF47]/15" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                      }`}
                      aria-label={`${n} von 5`}
                    >
                      <Star className="w-[18px] h-[18px]" style={{ color: active ? ACCENT : "#52525b", fill: active ? ACCENT : "none" }} />
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1 text-[9.5px] text-zinc-600">
                <span>{RATING_LABELS[1]}</span>
                <span>{typeof val === "number" ? RATING_LABELS[val] : ""}</span>
                <span>{RATING_LABELS[5]}</span>
              </div>
            </div>
          )}

          {q.type === "single" && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {q.options?.map((o) => {
                const active = val === o;
                return (
                  <button
                    key={o}
                    onClick={() => setAnswer(q.id, o)}
                    className={`px-3 py-1.5 rounded-lg border text-[11.5px] transition ${
                      active ? "border-[#95BF47]/50 bg-[#95BF47]/15 text-white font-medium" : "border-white/10 bg-white/[0.02] text-zinc-300 hover:bg-white/[0.05]"
                    }`}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          )}

          {q.type === "multi" && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {q.options?.map((o) => {
                const active = Array.isArray(val) && val.includes(o);
                return (
                  <button
                    key={o}
                    onClick={() => toggleMulti(q.id, o)}
                    className={`px-3 py-1.5 rounded-lg border text-[11.5px] inline-flex items-center gap-1.5 transition ${
                      active ? "border-[#95BF47]/50 bg-[#95BF47]/15 text-white font-medium" : "border-white/10 bg-white/[0.02] text-zinc-300 hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${active ? "bg-[#95BF47] border-[#95BF47]" : "border-white/25"}`}>
                      {active && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
                    </span>
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
              className="input-glass w-full text-[12.5px] mt-2 resize-none"
            />
          )}
        </div>
      </div>
    </div>
  );
}
