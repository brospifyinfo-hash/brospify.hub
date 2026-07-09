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
  Sparkles, X, Check, CircleDashed, Coins, Undo2, Target, Plus, ChevronDown,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useCredits } from "@/lib/credits";
import { ACCENT } from "@/components/theme-editor/editor-ui";
import {
  applyAiOpToDoc, newAiApplyCtx, type AiOp, type AiPlanStep,
} from "@/lib/theme-ai-ops";
import type { ThemeDocument, EditorAction } from "@/lib/theme-doc";
import type { BaseSectionInfo } from "@/lib/theme-library";
import { BroMascot, type BroState } from "@/components/theme-editor/BroMascot";

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
  /** Wurden bei DIESEM Request Credits abgebucht (nicht bei Cache-Treffern/Admin). */
  charged?: boolean;
  creditsRemaining?: number;
  /** true = nur schneller Ersatz-Entwurf (KI war ausgelastet) — Retry empfehlen. */
  fallback?: boolean;
  /** Signiert mode/imageCount/ops — Pflicht beim Bestätigen (apply). */
  planToken?: string;
}

type Phase = "idle" | "planning" | "plan" | "applying" | "done";

// Standard = Claude Sonnet (günstig, Alltag) · Expert = Claude Opus (stärker,
// mehr Credits). Wahl bleibt über localStorage erhalten.
type AiMode = "standard" | "expert";
// Key bewusst neu (…2): alte gespeicherte „expert"-Werte werden ignoriert →
// alle starten wieder auf STANDARD (Default), bis sie bewusst Expert wählen.
const AI_MODE_LS = "bspx:aiMode2";
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

/** Modus-Auswahl im „Pro ⌄"-Stil (öffnet nach OBEN, da die Leiste unten sitzt).
 *  Standard = schnell, wendet direkt an · Expert = zeigt erst einen Plan. */
function ModeSelect({ mode, onPick, disabled }: { mode: AiMode; onPick: (m: AiMode) => void; disabled?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1.5 text-[12px] font-semibold text-zinc-100 hover:text-white hover:bg-white/[0.09] transition disabled:opacity-40"
      >
        {mode === "expert" ? t.themes.aiModeExpert : t.themes.aiModeStandard}
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute bottom-full right-0 mb-2 z-50 w-64 rounded-2xl border border-white/15 bg-[#17171d] p-1.5 shadow-[0_20px_50px_-14px_rgba(0,0,0,0.85)]" role="listbox">
            {(["standard", "expert"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="option"
                aria-selected={mode === m}
                onClick={() => { onPick(m); setOpen(false); }}
                className={`w-full text-left rounded-xl px-3 py-2.5 transition border ${
                  mode === m ? "bg-[#95BF47]/15 border-[#95BF47]/40" : "border-transparent hover:bg-white/[0.07]"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-white">{m === "expert" ? t.themes.aiModeExpert : t.themes.aiModeStandard}</span>
                  {mode === m && <Check className="w-4 h-4 ml-auto" style={{ color: ACCENT }} />}
                </span>
                <span className="block text-[11px] text-zinc-300 leading-snug mt-1">{m === "expert" ? t.themes.aiModeExpertHint : t.themes.aiModeStandardHint}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

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
  // Hinweis (kein Fehler): z. B. „KI war ausgelastet, das war nur ein
  // schneller Entwurf — nochmal senden für die volle Produkt-Anpassung".
  const [notice, setNotice] = useState("");
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
    setNotice("");
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
        setError(res.status === 402 ? d?.error || t.themes.aiNoCredits : d?.error || t.themes.aiErr);
        setPhase("idle");
        return;
      }
      // Credits werden JETZT (bei der Plan-Erstellung) abgezogen — Kontostand live nachziehen.
      if (typeof d?.creditsRemaining === "number") credits.setBalance(d.creditsRemaining);
      if ((d as PlanResponse)?.fallback) setNotice(t.themes.aiFallbackNote);
      setPlan(d as PlanResponse);
      // STANDARD = kein Plan-Review: direkt umsetzen (Enter wendet sofort an).
      // EXPERT = Plan zur Freigabe anzeigen, erst „Umsetzen" wendet an.
      if (mode === "standard") {
        await confirmPlan(d as PlanResponse);
      } else {
        setPhase("plan");
      }
    } catch {
      setError(t.themes.aiErr);
      setPhase("idle");
    }
  }

  async function confirmPlan(explicitPlan?: PlanResponse) {
    const p = explicitPlan || plan;
    if (!p || phase === "applying") return;
    clearDoneTimer();
    setPhase("applying");
    onBusyChange?.(true);
    setError("");
    setProgress(0);
    // Anwenden ist PREPAID (Credits fielen bei der Plan-Erstellung an) und passiert
    // rein clientseitig. /apply autorisiert nur + füttert den Lernspeicher — es darf
    // das Anwenden NIE blockieren (sonst „bezahlt, aber kein Ergebnis"). Deshalb
    // fire-and-forget, ohne auf die Antwort zu warten.
    fetch("/api/theme-ai/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        document: docRef.current,
        ops: p.ops,
        planToken: p.planToken,
        productTitle,
        capabilities,
      }),
    }).catch(() => {});

    // Ops Schritt für Schritt anwenden — die Preview folgt live; History
    // koalesziert zu EINEM Schritt (aiBoundary + aiApply). Der Editor ist
    // währenddessen via onBusyChange gesperrt (kein Undo/Edit dazwischen).
    try {
      dispatch({ type: "aiBoundary" });
      const ctx = newAiApplyCtx(baseSections, capabilities, homeSections);
      let cur = docRef.current;
      const delay = Math.min(450, Math.max(170, Math.round(5500 / p.ops.length)));
      for (let i = 0; i < p.ops.length; i++) {
        cur = applyAiOpToDoc(cur, p.ops[i], ctx);
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

  // Bro-Maskottchen: Zustand aus der Phase ableiten. planning → nachdenken,
  // applying → arbeiten (mit echtem aktuellem Schritt in der Sprechblase),
  // alles andere (idle/plan/done) → Default.
  const broState: BroState = phase === "planning" ? "thinking" : phase === "applying" ? "working" : "idle";
  const broStep = phase === "applying" ? plan?.steps[activeStep]?.title : undefined;

  return (
    <div className="flex items-end gap-2.5">
      {/* Bro — kleiner separater Kreis LINKS neben der Leiste (frisst keine
          Höhe in der Leiste, Sprechblase schwebt beim Arbeiten über ihm) */}
      <BroMascot state={broState} stepTitle={broStep} showBubble={!showPlanCard} />
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`flex-1 min-w-0 rounded-2xl border transition ${
          drag
            ? "border-[#95BF47] bg-[#95BF47]/[0.07]"
            : focusPick
              ? "border-amber-400/50 bg-amber-400/[0.04]"
              : "border-white/[0.1] glass-strong"
        }`}
      >
      {error && <p className="px-4 pt-3 text-[11.5px] text-amber-300/90 leading-snug">{error}</p>}
      {notice && !error && <p className="px-4 pt-3 text-[11.5px] text-sky-300/90 leading-snug">{notice}</p>}
      {focusPick && !showPlanCard && (
        <p className="flex items-center gap-1.5 px-4 pt-3 text-[11px] font-medium text-amber-200/85 leading-snug">
          <Target className="w-3.5 h-3.5 shrink-0" /> {t.themes.aiFocusPickHint}
        </p>
      )}
      {(focus.length > 0 || selectedFocusable) && !showPlanCard && (
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
          {focus.map((f) => (
            <span key={f.uid} className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 pl-3 pr-1.5 py-1 text-[11px] font-semibold text-amber-100">
              <button onClick={() => onSelectFocus?.(f.uid)} className="max-w-[150px] truncate hover:underline" title={f.label}>{f.label}</button>
              <button onClick={() => onRemoveFocus?.(f.uid)} aria-label={t.themes.aiFocusRemove} className="w-4 h-4 rounded-full hover:bg-black/30 flex items-center justify-center"><X className="w-2.5 h-2.5" /></button>
            </span>
          ))}
          {selectedFocusable && (
            <button onClick={() => onFocusSelected?.()} className="inline-flex items-center gap-1 rounded-full border border-dashed border-amber-400/40 bg-amber-400/[0.06] px-3 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-400/[0.14] transition">
              <Plus className="w-3 h-3" /> <span className="max-w-[130px] truncate">{selectedFocusable.label}</span>
            </button>
          )}
          {focus.length > 0 && (
            <button onClick={() => onClearFocus?.()} className="text-[11px] font-semibold text-zinc-400 hover:text-white px-1">{t.themes.aiFocusClear}</button>
          )}
        </div>
      )}

      {showPlanCard && plan ? (
        <div className="max-h-[42vh] overflow-y-auto p-2.5">
                <div
                  className={`relative rounded-xl border p-3 ${
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
                    {phase !== "done" && plan.charged && plan.cost > 0 && (
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
                  {/* Aktionen — nebeneinander (breite Leiste unter der Vorschau) */}
                  {phase === "plan" && (
                    <div className="flex gap-1.5 mt-2.5">
                      <button
                        onClick={() => confirmPlan()}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold text-white hover:brightness-110 transition"
                        style={{ background: ACCENT }}
                      >
                        <Sparkles className="w-3.5 h-3.5" /> {t.themes.aiApply}
                      </button>
                      <button
                        onClick={discard}
                        className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-1.5 text-[11.5px] font-semibold text-zinc-300 hover:text-white transition"
                      >
                        {t.themes.aiDiscard}
                      </button>
                    </div>
                  )}
                </div>
        </div>
              ) : (
                /* ── Dünne Command-Zeile: alles in EINER Reihe, Enter löst aus.
                    Textarea min-w-0 schrumpft → nie Überlauf/Umbruch. ── */
                <div className="flex items-center gap-2 px-2.5 py-2">
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                  {/* „+" — Datei/Bild anhängen (auch per Drag & Drop) */}
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={images.length >= 3 || phase === "planning"}
                    title={t.themes.aiUploadHint}
                    aria-label={t.themes.aiUploadHint}
                    className="shrink-0 w-8 h-8 rounded-full border border-white/12 bg-white/[0.05] text-zinc-300 hover:text-white hover:bg-white/[0.1] disabled:opacity-30 flex items-center justify-center transition"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  {/* Bild-Vorschauen inline (klein) */}
                  {images.map((img, i) => (
                    <span key={i} className="relative shrink-0">
                      <img src={img.dataUrl} alt={img.name} className="w-8 h-8 rounded-lg object-cover border border-white/15" />
                      <button onClick={() => setImages(images.filter((_, x) => x !== i))} aria-label={t.themes.aiImageRemove} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-black/80 border border-white/20 text-zinc-300 hover:text-white flex items-center justify-center"><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ))}
                  {/* Eingabe — kurzer Platzhalter, schrumpft mit (min-w-0) */}
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onPaste={onPaste}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); requestPlan(); } }}
                    placeholder={phase === "planning" ? t.themes.aiPlanning : t.themes.aiPlaceholderShort}
                    rows={1}
                    disabled={phase === "planning"}
                    className="flex-1 min-w-0 resize-none bg-transparent px-1 text-[13.5px] text-white placeholder:text-zinc-500 outline-none disabled:opacity-60 leading-relaxed"
                    style={{ scrollbarWidth: "thin", maxHeight: 72 }}
                  />
                  {phase === "planning" && <CircleDashed className="w-4 h-4 animate-spin text-[#cfe9a3] shrink-0" />}
                  {/* Modus-Dropdown (Standard/Expert) */}
                  <ModeSelect mode={mode} onPick={pickMode} disabled={phase === "planning"} />
                  {/* Fokus-Icon (Hover erklärt es) */}
                  <button
                    onClick={() => onToggleFocusPick?.()}
                    aria-pressed={focusPick}
                    title={t.themes.aiFocusTooltip}
                    aria-label={t.themes.aiFocusTooltip}
                    className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition ${
                      focusPick ? "bg-amber-400/25 text-amber-100 border border-amber-400/60" : "border border-white/12 bg-white/[0.05] text-zinc-300 hover:text-amber-200 hover:bg-amber-400/[0.12]"
                    }`}
                  >
                    <Target className="w-4 h-4" />
                  </button>
                </div>
              )}
      </div>
    </div>
  );
}
