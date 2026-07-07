"use client";

// ─── AI Co-Pilot (Leiste UNTER der Live-Vorschau) ───────────────────
// Texteingabe + Bild-Drag&Drop → die AI schlägt IMMER zuerst einen Plan
// vor (Schritte + Credit-Kosten nach Aufwand). Erst nach Bestätigung werden
// die Operationen Schritt für Schritt mit Animation auf das ThemeDocument
// angewandt — die Live-Preview aktualisiert sich dabei ohne Reload, und
// Ctrl+Z macht den GANZEN AI-Lauf als einen Schritt rückgängig.
// Die Leiste liegt bewusst im normalen Fluss (nie über der Preview).

import { useEffect, useRef, useState, type DragEvent, type ClipboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, ImagePlus, X, Check, CircleDashed, Coins, ArrowUp, Undo2,
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
}

type Phase = "idle" | "planning" | "plan" | "applying" | "done";

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
}) {
  const { t, lang } = useI18n();
  const credits = useCredits();
  const [phase, setPhase] = useState<Phase>("idle");
  const [prompt, setPrompt] = useState("");
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
          capabilities,
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
        body: JSON.stringify({ document: docRef.current, ops: plan.ops, imageCount: plan.imageCount, capabilities }),
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

  return (
    <div className="mt-2 shrink-0">
      <AnimatePresence initial={false}>
        {/* ── Plan-Karte / Umsetzungs-Animation ── */}
        {(phase === "plan" || phase === "applying" || phase === "done") && plan && (
          <motion.div
            key="plan"
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: 8, height: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div
              className={`relative rounded-xl border p-3 mb-2 ${
                phase === "applying"
                  ? "border-[#95BF47]/60 bg-[#95BF47]/[0.06]"
                  : phase === "done"
                    ? "border-[#95BF47]/50 bg-[#95BF47]/[0.08]"
                    : "border-white/[0.12] glass-strong"
              }`}
            >
              {/* animierter Schimmer während der Umsetzung */}
              {phase === "applying" && (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-xl"
                  style={{ background: "linear-gradient(110deg, transparent 30%, rgba(149,191,71,0.14) 50%, transparent 70%)", backgroundSize: "220% 100%" }}
                  animate={{ backgroundPositionX: ["120%", "-120%"] }}
                  transition={{ repeat: Infinity, duration: 1.6, ease: "linear" }}
                />
              )}
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(149,191,71,0.15)" }}>
                  <Sparkles className={`w-4 h-4 ${phase === "applying" ? "animate-pulse" : ""}`} style={{ color: ACCENT }} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-bold text-white">
                      {phase === "done" ? t.themes.aiDone : phase === "applying" ? t.themes.aiApplying : t.themes.aiPlanTitle}
                    </span>
                    {phase !== "done" && plan.cost > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10.5px] font-semibold text-amber-200">
                        <Coins className="w-3 h-3" /> {t.themes.aiPlanCost.replace("{n}", String(plan.cost))}
                      </span>
                    )}
                    {phase === "done" && (
                      <span className="inline-flex items-center gap-1 text-[10.5px] text-zinc-400">
                        <Undo2 className="w-3 h-3" /> {t.themes.aiUndoHint}
                      </span>
                    )}
                  </div>
                  {phase === "plan" && plan.summary && (
                    <p className="text-[11.5px] text-zinc-400 mt-0.5 leading-snug">{plan.summary}</p>
                  )}
                  {/* Schritte — beim Umsetzen haken sie nacheinander ab */}
                  {phase !== "done" && (
                    <ul className="mt-2 space-y-1 max-h-[180px] overflow-y-auto pr-1">
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
                              <span className={`block text-[12px] font-semibold leading-tight ${stepActive ? "text-white" : stepDone ? "text-[#cfe9a3]" : "text-zinc-300"}`}>{s.title}</span>
                              <span className="block text-[10.5px] text-zinc-500 leading-snug">{s.detail}</span>
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
                        animate={{ width: `${Math.round((progress / Math.max(1, plan.ops.length)) * 100)}%` }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                      />
                    </div>
                  )}
                  {/* Aktionen */}
                  {phase === "plan" && (
                    <div className="flex items-center gap-2 mt-2.5">
                      <button
                        onClick={confirmPlan}
                        className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-bold text-white hover:brightness-110 transition"
                        style={{ background: ACCENT }}
                      >
                        <Sparkles className="w-3.5 h-3.5" /> {t.themes.aiApply}
                      </button>
                      <button
                        onClick={discard}
                        className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-zinc-300 hover:text-white transition"
                      >
                        {t.themes.aiDiscard}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="mb-1.5 text-[11.5px] text-amber-300/90">{error}</p>}

      {/* ── Eingabe-Leiste (Text + Bilder) ── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        title={t.themes.aiHint}
        className={`rounded-xl border transition ${
          drag ? "border-[#95BF47] bg-[#95BF47]/[0.08]" : "border-white/[0.1] glass-strong"
        } ${phase === "applying" ? "opacity-60 pointer-events-none" : ""}`}
      >
        {images.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 pt-2 flex-wrap">
            {images.map((img, i) => (
              <span key={i} className="relative group/img">
                <img src={img.dataUrl} alt={img.name} className="w-9 h-9 rounded-md object-cover border border-white/15" />
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
        <div className="flex items-end gap-1.5 p-1.5">
          <span className="pl-1.5 pb-2 shrink-0" title={t.themes.aiTitle}>
            <Sparkles className={`w-4 h-4 ${phase === "planning" ? "animate-pulse" : ""}`} style={{ color: ACCENT }} />
          </span>
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
            rows={1}
            disabled={phase === "planning"}
            className="flex-1 min-w-0 resize-none bg-transparent px-1 py-2 text-[12.5px] text-white placeholder:text-zinc-500 outline-none max-h-[92px] disabled:opacity-60"
            style={{ scrollbarWidth: "thin" }}
          />
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={images.length >= 3 || phase === "planning"}
            title={t.themes.aiImageHint}
            className="shrink-0 w-8 h-8 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white disabled:opacity-30 flex items-center justify-center transition"
          >
            <ImagePlus className="w-4 h-4" />
          </button>
          <button
            onClick={requestPlan}
            disabled={phase === "planning" || (!prompt.trim() && !images.length)}
            title={t.themes.aiSend}
            className="shrink-0 w-8 h-8 rounded-lg text-white disabled:opacity-30 flex items-center justify-center transition hover:brightness-110"
            style={{ background: ACCENT }}
          >
            {phase === "planning" ? <CircleDashed className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
