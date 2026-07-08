"use client";

// ─── AI Co-Pilot (einklappbares Panel in der LINKEN Editor-Spalte) ──
// Texteingabe + Bild-Drag&Drop → die AI schlägt IMMER zuerst einen Plan
// vor (Schritte + Credit-Kosten nach Aufwand). Erst nach Bestätigung werden
// die Operationen Schritt für Schritt mit Animation auf das ThemeDocument
// angewandt — die Live-Preview aktualisiert sich dabei ohne Reload, und
// Ctrl+Z macht den GANZEN AI-Lauf als einen Schritt rückgängig.
// Das Panel sitzt über der Aufbau-Leiste (nie über der Preview) und ist
// per Kopfzeile einklappbar; der Status (Plan bereit / % beim Umsetzen)
// bleibt auch eingeklappt in der Kopfzeile sichtbar.

import { useEffect, useRef, useState, type DragEvent, type ClipboardEvent } from "react";
import { motion } from "framer-motion";
import {
  Sparkles, ImagePlus, X, Check, CircleDashed, Coins, Undo2, ChevronDown, Target, Plus,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useCredits } from "@/lib/credits";
import { ACCENT } from "@/components/theme-editor/editor-ui";
import {
  applyAiOpToDoc, newAiApplyCtx, type AiOp, type AiPlanStep,
} from "@/lib/theme-ai-ops";
import type { ThemeDocument, EditorAction } from "@/lib/theme-doc";
import type { BaseSectionInfo } from "@/lib/theme-library";

interface AiImage {
  dataUrl: string;
  name: string;
  hints: string[];
}

interface PlanResponse {
  summary: string;
  steps: AiPlanStep[];
  ops: AiOp[];
  tier: string;
  cost: number;
  imageCount: number;
  mode?: AiMode;
  /** Signiert mode/imageCount/ops — Pflicht beim Bestätigen (apply). */
  planToken?: string;
}

type Phase = "idle" | "planning" | "plan" | "applying" | "done";

// Standard = Claude Sonnet (günstig, Alltag) · Expert = Claude Opus (stärker,
// mehr Credits). Wahl bleibt über localStorage erhalten.
type AiMode = "standard" | "expert";
const AI_MODE_LS = "bspx:aiMode";
function loadAiMode(): AiMode {
  try {
    return localStorage.getItem(AI_MODE_LS) === "expert" ? "expert" : "standard";
  } catch {
    return "standard";
  }
}

/** Dominante Farbtöne eines Bildes clientseitig extrahieren (Canvas). */
async function extractPalette(dataUrl: string): Promise<string[]> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = dataUrl;
    });
    const size = 48;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum > 244 || lum < 12) continue; // fast weiß/schwarz ignorieren
      const key = `${r >> 5}_${g >> 5}_${b >> 5}`;
      const e = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
      e.r += r; e.g += g; e.b += b; e.n += 1;
      buckets.set(key, e);
    }
    const hex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
    return Array.from(buckets.values())
      .sort((a, b) => b.n - a.n)
      .slice(0, 4)
      .map((e) => `#${hex(e.r / e.n)}${hex(e.g / e.n)}${hex(e.b / e.n)}`);
  } catch {
    return [];
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function AiCopilot({
  doc, dispatch, baseSections, capabilities, homeSections, productTitle, onBusyChange,
  focus = [], onRemoveFocus, onSelectFocus, selectedFocusable = null, onFocusSelected,
  focusPick = false, onToggleFocusPick, onClearFocus,
}: {
  doc: ThemeDocument;
  dispatch: (a: EditorAction) => void;
  baseSections: BaseSectionInfo[];
  capabilities: string[];
  homeSections: BaseSectionInfo[];
  productTitle?: string;
  /** true, solange die AI Ops anwendet — der Editor sperrt dann Undo/Edits,
   *  damit nichts vom nächsten Animations-Schritt überschrieben wird. */
  onBusyChange?: (busy: boolean) => void;
  /** Für die AI fokussierte Sections/Kaufbox — die AI ändert dann primär diese. */
  focus?: { uid: string; label: string }[];
  onRemoveFocus?: (uid: string) => void;
  onSelectFocus?: (uid: string) => void;
  /** Aktuell ausgewählte, noch nicht fokussierte Section/Kaufbox (Schnell-Fokus). */
  selectedFocusable?: { uid: string; label: string } | null;
  onFocusSelected?: () => void;
  /** Fokus-Auswahl-Modus: in der Vorschau Sections/Kaufbox anklicken zum Fokussieren. */
  focusPick?: boolean;
  onToggleFocusPick?: () => void;
  onClearFocus?: () => void;
}) {
  const { t, lang } = useI18n();
  const credits = useCredits();
  const [open, setOpen] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<AiMode>("standard");
  useEffect(() => setMode(loadAiMode()), []);
  function pickMode(m: AiMode) {
    setMode(m);
    try {
      localStorage.setItem(AI_MODE_LS, m);
    } catch {
      /* Private Mode etc. */
    }
  }
  const [images, setImages] = useState<AiImage[]>([]);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const docRef = useRef(doc);
  docRef.current = doc;
  const fileRef = useRef<HTMLInputElement>(null);
  // Done-Anzeige-Timer: wird bei jedem neuen Flow gecleart, sonst würde ein
  // alter Timer den frisch erstellten Folge-Plan wieder löschen.
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearDoneTimer = () => {
    if (doneTimer.current) {
      clearTimeout(doneTimer.current);
      doneTimer.current = null;
    }
  };
  useEffect(() => clearDoneTimer, []);

  async function addFiles(files: FileList | File[] | null | undefined) {
    if (!files) return;
    for (const file of Array.from(files).slice(0, 3 - images.length)) {
      if (!file.type.startsWith("image/") || file.size > 4.5 * 1024 * 1024) continue;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }).catch(() => "");
      if (!dataUrl.startsWith("data:image/")) continue;
      const hints = await extractPalette(dataUrl);
      setImages((prev) => (prev.length >= 3 ? prev : [...prev, { dataUrl, name: file.name, hints }]));
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDrag(false);
    addFiles(e.dataTransfer?.files);
  }
  function onPaste(e: ClipboardEvent) {
    const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith("image/"));
    if (files.length) addFiles(files);
  }

  async function requestPlan() {
    if (phase === "planning" || phase === "applying") return;
    if (!prompt.trim() && !images.length) return;
    clearDoneTimer();
    setPhase("planning");
    setError("");
    setPlan(null);
    try {
      const res = await fetch("/api/theme-ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          document: docRef.current,
          prompt: prompt.trim(),
          images: images.map((i) => ({ dataUrl: i.dataUrl })),
          paletteHints: images.flatMap((i) => i.hints).slice(0, 8),
          productTitle,
          lang,
          mode,
          capabilities,
          focus: focus.map((f) => f.uid),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d?.error || t.themes.aiErr);
        setPhase("idle");
        return;
      }
      setPlan(d as PlanResponse);
      setPhase("plan");
    } catch {
      setError(t.themes.aiErr);
      setPhase("idle");
    }
  }

  async function confirmPlan() {
    if (!plan || phase === "applying") return;
    clearDoneTimer();
    setPhase("applying");
    onBusyChange?.(true);
    setError("");
    setProgress(0);
    try {
      const res = await fetch("/api/theme-ai/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          document: docRef.current,
          ops: plan.ops,
          planToken: plan.planToken,
          productTitle,
          capabilities,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(res.status === 402 ? d?.error || t.themes.aiNoCredits : d?.error || t.themes.aiErr);
        setPhase("plan");
        onBusyChange?.(false);
        return;
      }
      if (typeof d?.creditsRemaining === "number") credits.setBalance(d.creditsRemaining);
    } catch {
      setError(t.themes.aiErr);
      setPhase("plan");
      onBusyChange?.(false);
      return;
    }

    // Ops Schritt für Schritt anwenden — die Preview folgt live; History
    // koalesziert zu EINEM Schritt (aiBoundary + aiApply). Der Editor ist
    // währenddessen via onBusyChange gesperrt (kein Undo/Edit dazwischen).
    try {
      dispatch({ type: "aiBoundary" });
      const ctx = newAiApplyCtx(baseSections, capabilities, homeSections);
      let cur = docRef.current;
      const delay = Math.min(450, Math.max(170, Math.round(5500 / plan.ops.length)));
      for (let i = 0; i < plan.ops.length; i++) {
        cur = applyAiOpToDoc(cur, plan.ops[i], ctx);
        dispatch({ type: "aiApply", doc: cur });
        setProgress(i + 1);
        // eslint-disable-next-line no-await-in-loop
        await sleep(delay);
      }
    } finally {
      onBusyChange?.(false);
    }
    setPhase("done");
    setPrompt("");
    setImages([]);
    // Jeder neue Flow (requestPlan/confirmPlan/discard) cleart den Timer —
    // feuert er, ist die Phase garantiert noch "done".
    doneTimer.current = setTimeout(() => {
      doneTimer.current = null;
      setPhase("idle");
      setPlan(null);
    }, 4500);
  }

  function discard() {
    clearDoneTimer();
    setPlan(null);
    setPhase("idle");
    setError("");
  }

  const stepForOp = (opIdx: number): number => {
    if (!plan?.steps.length || !plan.ops.length) return 0;
    return Math.min(plan.steps.length - 1, Math.floor((opIdx / plan.ops.length) * plan.steps.length));
  };
  const activeStep = plan ? stepForOp(Math.max(0, progress - 1)) : 0;

  const showPlanCard = (phase === "plan" || phase === "applying" || phase === "done") && !!plan;
  const applyPct = plan ? Math.round((progress / Math.max(1, plan.ops.length)) * 100) : 0;

  return (
    <div
      className={`mb-2 shrink-0 rounded-xl border overflow-hidden transition ${
        drag ? "border-[#95BF47] bg-[#95BF47]/[0.06]" : "border-white/[0.1] glass-strong"
      }`}
    >
      {/* ── Kopfzeile: immer sichtbar, klappt das Panel ein/aus ── */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={t.themes.aiHint}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-white/[0.04] transition"
      >
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-[#95BF47]/30 bg-gradient-to-br from-[#95BF47]/35 to-[#95BF47]/5">
          <Sparkles className={`w-4 h-4 ${phase === "planning" || phase === "applying" ? "animate-pulse" : ""}`} style={{ color: ACCENT }} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-bold text-white leading-tight">{t.themes.aiTitle}</span>
          <span className="block text-[9px] uppercase tracking-[0.14em] font-semibold text-zinc-500 truncate">{t.themes.aiTagline}</span>
        </span>
        {/* Status auch im eingeklappten Zustand sichtbar */}
        {phase === "planning" && <CircleDashed className="w-3.5 h-3.5 animate-spin text-[#cfe9a3] shrink-0" />}
        {phase === "plan" && (
          <span className="shrink-0 inline-flex items-center rounded-full border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200">
            {t.themes.aiPlanReady}
          </span>
        )}
        {phase === "applying" && <span className="shrink-0 text-[10px] font-bold tabular-nums text-[#cfe9a3]">{applyPct}%</span>}
        {phase === "done" && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT }} />}
        <ChevronDown className={`w-4 h-4 text-zinc-500 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Einklapp-Animation über CSS-Grid (0fr→1fr) — robust, und der
          Eingabe-State (Text/Bilder) bleibt beim Einklappen erhalten. */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        aria-hidden={!open}
      >
        <div className="min-h-0 overflow-hidden">
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              className="px-2.5 pb-2.5 space-y-2 max-h-[46vh] overflow-y-auto"
            >
              {error && <p className="text-[11px] text-amber-300/90 leading-snug">{error}</p>}

              {showPlanCard && plan ? (
                /* ── Plan-Karte / Umsetzungs-Animation ── */
                <div
                  className={`relative rounded-lg border p-2.5 ${
                    phase === "applying"
                      ? "border-[#95BF47]/60 bg-[#95BF47]/[0.06]"
                      : phase === "done"
                        ? "border-[#95BF47]/50 bg-[#95BF47]/[0.08]"
                        : "border-white/[0.12] bg-white/[0.03]"
                  }`}
                >
                  {phase === "applying" && (
                    <motion.span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-lg"
                      style={{ background: "linear-gradient(110deg, transparent 30%, rgba(149,191,71,0.14) 50%, transparent 70%)", backgroundSize: "220% 100%" }}
                      animate={{ backgroundPositionX: ["120%", "-120%"] }}
                      transition={{ repeat: Infinity, duration: 1.6, ease: "linear" }}
                    />
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12.5px] font-bold text-white">
                      {phase === "done" ? t.themes.aiDone : phase === "applying" ? t.themes.aiApplying : t.themes.aiPlanTitle}
                    </span>
                    {phase !== "done" && plan.cost > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                        <Coins className="w-3 h-3" /> {t.themes.aiPlanCost.replace("{n}", String(plan.cost))}
                      </span>
                    )}
                  </div>
                  {phase === "done" && (
                    <p className="mt-1 inline-flex items-center gap-1 text-[10.5px] text-zinc-400">
                      <Undo2 className="w-3 h-3" /> {t.themes.aiUndoHint}
                    </p>
                  )}
                  {phase === "plan" && plan.summary && (
                    <p className="text-[11px] text-zinc-400 mt-1 leading-snug">{plan.summary}</p>
                  )}
                  {/* Schritte — beim Umsetzen haken sie nacheinander ab */}
                  {phase !== "done" && (
                    <ul className="mt-2 space-y-1.5">
                      {plan.steps.map((s, i) => {
                        const stepDone = phase === "applying" && (i < activeStep || progress >= plan.ops.length);
                        const stepActive = phase === "applying" && i === activeStep && progress < plan.ops.length;
                        return (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-[2px] shrink-0">
                              {stepDone ? (
                                <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="block">
                                  <Check className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                                </motion.span>
                              ) : stepActive ? (
                                <CircleDashed className="w-3.5 h-3.5 animate-spin text-[#cfe9a3]" />
                              ) : (
                                <span className="block w-3.5 h-3.5 rounded-full border border-white/20" />
                              )}
                            </span>
                            <span className="min-w-0">
                              <span className={`block text-[11.5px] font-semibold leading-tight ${stepActive ? "text-white" : stepDone ? "text-[#cfe9a3]" : "text-zinc-300"}`}>{s.title}</span>
                              <span className="block text-[10px] text-zinc-500 leading-snug">{s.detail}</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {/* Fortschrittsbalken */}
                  {phase === "applying" && (
                    <div className="mt-2 h-1 rounded-full bg-white/[0.07] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: ACCENT }}
                        animate={{ width: `${applyPct}%` }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                      />
                    </div>
                  )}
                  {/* Aktionen — in der schmalen Spalte gestapelt */}
                  {phase === "plan" && (
                    <div className="space-y-1.5 mt-2.5">
                      <button
                        onClick={confirmPlan}
                        className="w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold text-white hover:brightness-110 transition"
                        style={{ background: ACCENT }}
                      >
                        <Sparkles className="w-3.5 h-3.5" /> {t.themes.aiApply}
                      </button>
                      <button
                        onClick={discard}
                        className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11.5px] font-semibold text-zinc-300 hover:text-white transition"
                      >
                        {t.themes.aiDiscard}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* ── Eingabe: Text + Bilder ── */
                <>
                  {/* Fokus: welche Sections/Kaufbox die AI ändern soll (optional).
                      Der Fokus-Button aktiviert den Auswahl-Modus (in der Vorschau
                      anklicken); fokussiert konzentriert sich der Plan darauf. */}
                  <div className={`rounded-lg border px-2 py-1.5 space-y-1.5 transition ${focusPick ? "border-amber-400/60 bg-amber-400/[0.09]" : "border-white/[0.1] bg-white/[0.02]"}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-200/90 flex-1">
                        <Target className="w-3 h-3" /> {t.themes.aiFocusLabel}
                      </span>
                      <button
                        onClick={() => onToggleFocusPick?.()}
                        aria-pressed={focusPick}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10.5px] font-bold transition ${
                          focusPick
                            ? "border-amber-400/60 bg-amber-400/20 text-amber-100"
                            : "border-amber-400/30 bg-amber-400/[0.08] text-amber-100 hover:bg-amber-400/[0.16]"
                        }`}
                      >
                        <Target className="w-3 h-3" /> {focusPick ? t.themes.aiFocusDone : t.themes.aiFocusPick}
                      </button>
                      {focus.length > 0 && (
                        <button onClick={() => onClearFocus?.()} title={t.themes.aiFocusClear} className="text-[10px] font-semibold text-zinc-400 hover:text-white px-1">
                          {t.themes.aiFocusClear}
                        </button>
                      )}
                    </div>
                    {focusPick && <p className="text-[10px] text-amber-200/80 leading-snug">{t.themes.aiFocusPickHint}</p>}
                    {focus.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {focus.map((f) => (
                          <span key={f.uid} className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 pl-2 pr-1 py-0.5 text-[10.5px] font-semibold text-amber-100">
                            <button onClick={() => onSelectFocus?.(f.uid)} className="max-w-[110px] truncate hover:underline" title={f.label}>{f.label}</button>
                            <button onClick={() => onRemoveFocus?.(f.uid)} aria-label={t.themes.aiFocusRemove} className="w-3.5 h-3.5 rounded-full hover:bg-black/30 flex items-center justify-center">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      !focusPick && <p className="text-[10px] text-zinc-500 leading-snug">{t.themes.aiFocusEmpty}</p>
                    )}
                    {selectedFocusable && (
                      <button
                        onClick={() => onFocusSelected?.()}
                        className="inline-flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-400/[0.08] px-2 py-1 text-[10.5px] font-semibold text-amber-100 hover:bg-amber-400/[0.16] transition"
                      >
                        <Plus className="w-3 h-3" /> {t.themes.aiFocusAddSelected.replace("{name}", selectedFocusable.label)}
                      </button>
                    )}
                  </div>
                  {/* Modus: Standard (Sonnet, günstig) vs. Expert (Opus, mehr Credits) */}
                  <div className="flex items-center gap-1" role="radiogroup" aria-label={t.themes.aiModeLabel}>
                    {(["standard", "expert"] as const).map((m) => (
                      <button
                        key={m}
                        role="radio"
                        aria-checked={mode === m}
                        onClick={() => pickMode(m)}
                        disabled={phase === "planning"}
                        title={m === "expert" ? t.themes.aiModeExpertHint : t.themes.aiModeStandardHint}
                        className={`flex-1 h-6 rounded-md border text-[10px] font-semibold transition ${
                          mode === m
                            ? "border-[#95BF47]/60 bg-[#95BF47]/10 text-white"
                            : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.07]"
                        }`}
                      >
                        {m === "expert" ? t.themes.aiModeExpert : t.themes.aiModeStandard}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onPaste={onPaste}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        requestPlan();
                      }
                    }}
                    placeholder={phase === "planning" ? t.themes.aiPlanning : t.themes.aiPlaceholder}
                    rows={3}
                    disabled={phase === "planning"}
                    className="w-full resize-none rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-[12px] text-white placeholder:text-zinc-500 outline-none focus:border-[#95BF47]/60 transition disabled:opacity-60"
                    style={{ scrollbarWidth: "thin" }}
                  />
                  {images.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {images.map((img, i) => (
                        <span key={i} className="relative">
                          <img src={img.dataUrl} alt={img.name} className="w-10 h-10 rounded-md object-cover border border-white/15" />
                          <button
                            onClick={() => setImages(images.filter((_, x) => x !== i))}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-black/80 border border-white/20 text-zinc-300 hover:text-white flex items-center justify-center"
                            aria-label={t.themes.aiImageRemove}
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={images.length >= 3 || phase === "planning"}
                      title={t.themes.aiImageHint}
                      className="shrink-0 w-9 h-9 rounded-lg border border-dashed border-white/15 bg-white/[0.03] text-zinc-400 hover:text-white hover:border-[#95BF47]/50 disabled:opacity-30 flex items-center justify-center transition"
                    >
                      <ImagePlus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={requestPlan}
                      disabled={phase === "planning" || (!prompt.trim() && !images.length)}
                      className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg text-[12px] font-bold text-white disabled:opacity-35 transition hover:brightness-110"
                      style={{ background: ACCENT }}
                    >
                      {phase === "planning"
                        ? <><CircleDashed className="w-4 h-4 animate-spin" /> {t.themes.aiPlanning}</>
                        : <><Sparkles className="w-4 h-4" /> {t.themes.aiSend}</>}
                    </button>
                  </div>
                  <p className="text-[9.5px] text-zinc-600 leading-snug">{t.themes.aiHint}</p>
                </>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}
