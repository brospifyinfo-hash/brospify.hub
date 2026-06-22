"use client";

// ─── SurveyCard — System-Verbesserungs-Umfrage auf der Startseite ──
// Zeigt die Fragen aus lib/survey, sammelt die Antworten und schickt sie
// an POST /api/survey. Hat der Account schon abgegeben, erscheint nur ein
// dezenter Danke-Hinweis mit „Nochmal teilnehmen". Komplett eigenständig,
// damit die Home-Seite nur eine Zeile braucht.

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquareHeart, Star, Check, Loader2, Send, X } from "lucide-react";
import {
  SURVEY_QUESTIONS,
  hasRequiredAnswers,
  type SurveyAnswers,
  type SurveyQuestion,
} from "@/lib/survey";

const ACCENT = "#95BF47";

export default function SurveyCard() {
  const [loaded, setLoaded] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [open, setOpen] = useState(false); // Formular sichtbar?
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/survey", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setAnswered(!!data.answered);
        setOpen(!data.answered);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  function setAnswer(id: string, value: number | string | string[]) {
    setAnswers((a) => ({ ...a, [id]: value }));
  }
  function toggleMulti(id: string, option: string) {
    setAnswers((a) => {
      const cur = Array.isArray(a[id]) ? (a[id] as string[]) : [];
      return { ...a, [id]: cur.includes(option) ? cur.filter((x) => x !== option) : [...cur, option] };
    });
  }

  async function submit() {
    if (submitting) return;
    if (!hasRequiredAnswers(answers)) {
      setError("Bitte beantworte die markierte Pflichtfrage (⭐).");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Speichern fehlgeschlagen.");
        return;
      }
      setDone(true);
      setAnswered(true);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
      }, 2200);
    } catch {
      setError("Verbindungsfehler. Bitte erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!loaded) return null;

  // Bereits abgegeben & nicht erneut geöffnet → dezenter Danke-Streifen.
  if (answered && !open) {
    return (
      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-[#95BF47]/12 border border-[#95BF47]/25 flex items-center justify-center shrink-0">
          <Check className="w-4 h-4" style={{ color: ACCENT }} />
        </div>
        <p className="text-[12.5px] text-zinc-300 flex-1 leading-snug">
          Danke für dein Feedback! Es hilft uns, Brospify gezielt zu verbessern.
        </p>
        <button
          onClick={() => { setAnswers({}); setDone(false); setOpen(true); }}
          className="text-[11px] font-medium text-zinc-400 hover:text-white transition shrink-0"
        >
          Nochmal teilnehmen
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl sm:rounded-3xl border border-[#95BF47]/15 bg-gradient-to-b from-[#95BF47]/[0.06] to-white/[0.02] p-4 sm:p-5 relative overflow-hidden">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-[#95BF47]/15 border border-[#95BF47]/25 flex items-center justify-center shrink-0">
          <MessageSquareHeart className="w-[18px] h-[18px]" style={{ color: ACCENT }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-bold text-white leading-tight">Hilf uns, Brospify besser zu machen</h2>
          <p className="text-[12px] text-zinc-400 mt-0.5 leading-snug">
            2 Minuten — dein Feedback bestimmt, woran wir als Nächstes arbeiten.
          </p>
        </div>
        {answered && (
          <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white transition shrink-0" aria-label="Schließen">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {done ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 py-6 justify-center text-center"
          >
            <Check className="w-5 h-5" style={{ color: ACCENT }} />
            <span className="text-[14px] font-semibold text-white">Danke! Dein Feedback ist gespeichert.</span>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {SURVEY_QUESTIONS.map((q) => (
              <QuestionField key={q.id} q={q} answers={answers} setAnswer={setAnswer} toggleMulti={toggleMulti} />
            ))}

            {error && <p className="text-[11.5px] text-red-400">{error}</p>}

            <button
              onClick={submit}
              disabled={submitting}
              className="btn-deploy w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[14px] disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Feedback senden
            </button>
          </motion.div>
        )}
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
