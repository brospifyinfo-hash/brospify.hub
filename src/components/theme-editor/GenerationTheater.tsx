"use client";

// ─── GenerationTheater — inszenierter Shop-Aufbau ───────────────────
// Fährt einen „Genesis-Job": erst eine Analyse-Phase (rotierende Status-
// Meldungen, während prepare() echte Arbeit macht ODER nur Show ist),
// dann die Reveal-Timeline — jeder Schritt dispatcht ein gewachsenes
// Dokument (aiApply), die Live-Preview baut sich sichtbar Section für
// Section auf; neue Elemente bekommen GSAP-Puls + Smooth-Scroll (gleiche
// Mechanik wie insertSection im Editor). History = EIN Undo-Schritt
// (aiBoundary + aiApply), Editor ist währenddessen via onBusyChange gesperrt.
// „Überspringen" spult die restlichen Schritte im Zeitraffer ab — das
// Ergebnis ist IMMER exakt das Ziel-Dokument (letzter Schritt).

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { gsap } from "gsap";
import { Check, ChevronsRight, Sparkles } from "lucide-react";
import { ACCENT } from "@/components/theme-editor/editor-ui";
import { BroMascot } from "@/components/theme-editor/BroMascot";
import type { RevealStep } from "@/lib/theme-genesis";
import type { EditorAction } from "@/lib/theme-doc";

export interface GenesisJob {
  /** Eindeutig pro Lauf (Date.now()) — startet den Effekt neu. */
  id: number;
  /** Rotierende Analyse-Meldungen (Fake-AI bzw. Wartezeit der echten AI). */
  intro: string[];
  /** Analyse-Phase mindestens so lange zeigen (Demo braucht „Denkzeit"). */
  minIntroMs: number;
  /** Liefert die Reveal-Schritte — Demo: fetch + Timeline; Eigenes Produkt:
   *  echter AI-Plan. Wirft Error mit nutzerlesbarer Meldung. */
  prepare: () => Promise<{ steps: RevealStep[]; notice?: string }>;
  doneTitle: string;
  doneSub: string;
}

export interface TheaterTexts {
  analyzing: string;
  skip: string;
}

type Mode = "intro" | "reveal" | "done";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Neues Element in der Preview pulsen + sanft in den Blick scrollen. */
function pulseTarget(focusUid?: string, focusBlk?: string) {
  const sel = focusUid
    ? `[data-section-uid="${focusUid}"]`
    : focusBlk
      ? `[data-blk-type="${focusBlk}"]`
      : null;
  if (!sel) return;
  requestAnimationFrame(() => {
    const el = document.querySelector(sel);
    if (!el) return;
    gsap.fromTo(el, { opacity: 0.1, scale: 0.97 }, { opacity: 1, scale: 1, duration: 0.6, ease: "power3.out" });
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

export default function GenerationTheater({
  job, dispatch, onBusyChange, onDone, onError, t,
}: {
  job: GenesisJob | null;
  dispatch: (a: EditorAction) => void;
  onBusyChange: (busy: boolean) => void;
  /** Nach dem letzten Schritt (notice = z. B. Fallback-Hinweis der AI). */
  onDone?: (notice?: string) => void;
  /** prepare() fehlgeschlagen — Editor bleibt im leeren Zustand nutzbar. */
  onError: (msg: string) => void;
  t: TheaterTexts;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [introIdx, setIntroIdx] = useState(0);
  const [cur, setCur] = useState<{ title: string; detail?: string } | null>(null);
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [doneText, setDoneText] = useState<{ title: string; sub: string } | null>(null);
  const fastRef = useRef(false);
  const runRef = useRef(0);

  // Analyse-Meldungen rotieren.
  useEffect(() => {
    if (mode !== "intro" || !job || job.intro.length < 2) return;
    const id = setInterval(() => setIntroIdx((i) => (i + 1) % job.intro.length), 1900);
    return () => clearInterval(id);
  }, [mode, job]);

  useEffect(() => {
    if (!job) return;
    const runId = ++runRef.current;
    let cancelled = false;
    const alive = () => !cancelled && runRef.current === runId;
    fastRef.current = false;
    setIntroIdx(0);
    setCount(0);
    setTotal(0);
    setCur(null);
    setDoneText({ title: job.doneTitle, sub: job.doneSub });
    setMode("intro");
    onBusyChange(true);

    (async () => {
      const t0 = Date.now();
      let prep: { steps: RevealStep[]; notice?: string };
      try {
        prep = await job.prepare();
      } catch (e) {
        if (!alive()) return;
        setMode(null);
        onBusyChange(false);
        onError(e instanceof Error && e.message ? e.message : "Fehler");
        return;
      }
      // Analyse-Phase nicht abrupt beenden — Mindestdauer; in kleinen Slices
      // warten, damit „Überspringen" auch WÄHREND der Wartezeit sofort greift.
      const deadline = t0 + Math.min(job.minIntroMs, 15_000);
      while (Date.now() < deadline && !fastRef.current) {
        await sleep(Math.min(120, Math.max(15, deadline - Date.now())));
        if (!alive()) return;
      }
      if (!alive()) return;

      setMode("reveal");
      setTotal(prep.steps.length);
      dispatch({ type: "aiBoundary" });
      for (let i = 0; i < prep.steps.length; i++) {
        if (!alive()) return;
        const s = prep.steps[i];
        dispatch({ type: "aiApply", doc: s.doc });
        setCur({ title: s.title, detail: s.detail });
        setCount(i + 1);
        if (!fastRef.current) pulseTarget(s.focusUid, s.focusBlk);
        await sleep(fastRef.current ? 40 : s.ms);
      }
      if (!alive()) return;
      setMode("done");
      onBusyChange(false);
      onDone?.(prep.notice);
      setTimeout(() => { if (alive()) setMode((m) => (m === "done" ? null : m)); }, 4200);
    })();

    return () => {
      cancelled = true;
      onBusyChange(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  const pct = total ? Math.round((count / total) * 100) : 0;
  const visible = mode !== null && !!job;

  return (
    <>
      {/* Dauerhaft gemountete Live-Region (nur Phasen-Wechsel, kein Schritt-
          Spam) — der Editor ist während des Laufs gesperrt, Screenreader
          brauchen hörbares Feedback, was passiert und wann es fertig ist. */}
      <div role="status" aria-live="polite" className="sr-only">
        {mode === "intro" ? t.analyzing : mode === "done" && doneText ? `${doneText.title} ${doneText.sub}` : ""}
      </div>
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 26, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.97 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fixed left-1/2 -translate-x-1/2 bottom-20 lg:bottom-5 z-[60] w-[min(580px,calc(100vw-1.5rem))]"
        >
          <div className="relative rounded-2xl border border-[#95BF47]/40 bg-[#101014]/95 backdrop-blur-xl shadow-[0_24px_70px_-18px_rgba(0,0,0,0.85)] overflow-hidden">
            {/* Shimmer über dem ganzen Panel, solange gearbeitet wird */}
            {mode !== "done" && (
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ background: "linear-gradient(110deg, transparent 30%, rgba(149,191,71,0.1) 50%, transparent 70%)", backgroundSize: "220% 100%" }}
                animate={{ backgroundPositionX: ["120%", "-120%"] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
              />
            )}

            <div className="relative flex items-center gap-3.5 px-4 py-3.5">
              <BroMascot state={mode === "done" ? "idle" : mode === "intro" ? "thinking" : "working"} showBubble={false} />

              <div className="flex-1 min-w-0">
                {mode === "intro" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 shrink-0 animate-pulse" style={{ color: ACCENT }} />
                      <span className="text-[13px] font-bold text-white truncate">{t.analyzing}</span>
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={introIdx}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.28 }}
                        className="mt-0.5 text-[11.5px] text-zinc-400 truncate"
                      >
                        {job!.intro[introIdx] || job!.intro[0]}
                      </motion.p>
                    </AnimatePresence>
                    {/* Indeterminierter Balken */}
                    <div className="mt-2 h-1 rounded-full bg-white/[0.07] overflow-hidden">
                      <motion.div
                        className="h-full w-1/3 rounded-full"
                        style={{ background: ACCENT }}
                        animate={{ x: ["-120%", "320%"] }}
                        transition={{ repeat: Infinity, duration: 1.35, ease: "easeInOut" }}
                      />
                    </div>
                  </>
                )}

                {mode === "reveal" && cur && (
                  <>
                    <div className="flex items-center gap-2 min-w-0">
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={cur.title + (cur.detail || "")}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.22 }}
                          className="min-w-0 flex-1"
                        >
                          <span className="block text-[13px] font-bold text-white truncate">{cur.title}</span>
                          {cur.detail && <span className="block text-[11px] text-[#cfe9a3] truncate">{cur.detail}</span>}
                        </motion.span>
                      </AnimatePresence>
                      <span className="shrink-0 text-[10.5px] font-bold tabular-nums text-zinc-500">{count} / {total}</span>
                    </div>
                    <div className="mt-2 h-1 rounded-full bg-white/[0.07] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: ACCENT }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                      />
                    </div>
                  </>
                )}

                {mode === "done" && doneText && (
                  <div className="flex items-center gap-2.5">
                    <motion.span
                      initial={{ scale: 0.3, rotate: -30, opacity: 0 }}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 320, damping: 18 }}
                      className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full"
                      style={{ background: ACCENT }}
                    >
                      <Check className="w-4.5 h-4.5 text-[#0a0a0a]" />
                    </motion.span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-bold text-white truncate">{doneText.title}</span>
                      <span className="block text-[11px] text-zinc-400 truncate">{doneText.sub}</span>
                    </span>
                  </div>
                )}
              </div>

              {mode !== "done" && (
                <button
                  onClick={() => { fastRef.current = true; }}
                  title={t.skip}
                  className="shrink-0 self-start flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10.5px] font-semibold text-zinc-400 hover:text-white transition"
                >
                  <ChevronsRight className="w-3.5 h-3.5" /> {t.skip}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
