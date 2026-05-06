"use client";

// ─── <AiStudio /> ────────────────────────────────────────────────
// Three-step studio: 1) drop a product 2) pick a scene + tweak prompt
// 3) generate. Result lands in a before/after reveal slider.
//
// Server-side: /api/ai-studio runs a single Fal IC-Light v2 call.
// IC-Light is allowed to relight the product, adapt its position
// and scale to the scene, and generate the new background +
// realistic shadows. The carousel scenes are rendered with
// layered CSS gradients (no image hosting needed) using the
// `visual` props from the scene catalog.
//
// Layout is mobile-first: the carousel snaps cleanly on touch,
// the prompt area is collapsible, and the generate CTA is
// full-width on small screens.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { useCredits } from "@/lib/credits";
import { CREDIT_COSTS } from "@/lib/credit-costs";
import {
  AI_STUDIO_SCENES,
  type AiStudioScene,
} from "@/lib/ai-studio-scenes";

const ACCENT = "#95BF47";
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const PROCESS_MAX_DIM = 2400;
const PROCESS_QUALITY = 0.92;
const CUSTOM_PROMPT_MAX = 500;

type Stage = "upload" | "configure" | "processing" | "done" | "error";

export default function AiStudio() {
  const credits = useCredits();
  const [stage, setStage] = useState<Stage>("upload");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [preparedFile, setPreparedFile] = useState<File | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultScene, setResultScene] = useState<AiStudioScene | null>(null);
  const [sceneId, setSceneId] = useState<string>(AI_STUDIO_SCENES[0].id);
  const [customPrompt, setCustomPrompt] = useState("");
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);

  const [savedToLibrary, setSavedToLibrary] = useState(false);
  const [savingToLibrary, setSavingToLibrary] = useState(false);

  const [elapsed, setElapsed] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startedAtRef = useRef(0);

  const insufficientCredits =
    !credits.loading && credits.balance < CREDIT_COSTS.AI_STUDIO;

  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startTimer() {
    startedAtRef.current = performance.now();
    setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsed(Math.round(performance.now() - startedAtRef.current));
    }, 250);
  }
  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function reset() {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    stopTimer();
    setStage("upload");
    setErrorMsg(null);
    setOriginalUrl(null);
    setPreparedFile(null);
    setResultUrl(null);
    setResultScene(null);
    setSceneId(AI_STUDIO_SCENES[0].id);
    setCustomPrompt("");
    setShowCustomPrompt(false);
    setSavedToLibrary(false);
    setSavingToLibrary(false);
    setElapsed(0);
  }

  async function handleSaveToLibrary() {
    if (!resultUrl || savingToLibrary || savedToLibrary) return;
    setSavingToLibrary(true);
    try {
      const r = await fetch("/api/library/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "image-url",
          source: "ai-studio",
          remoteUrl: resultUrl,
          title: resultScene
            ? `AI Studio · ${resultScene.label}`
            : "AI Studio Szene",
          basename: "ai-studio",
          meta: {
            sceneId: resultScene?.id,
            sceneLabel: resultScene?.label,
          },
        }),
      });
      if (r.ok) setSavedToLibrary(true);
    } catch {
      // ignore
    } finally {
      setSavingToLibrary(false);
    }
  }

  // ── Step 1: upload ────────────────────────────────────────────
  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setErrorMsg("Bitte ein Bild auswählen (JPG, PNG, WebP).");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setErrorMsg(
          `Datei zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
        );
        return;
      }

      if (originalUrl) URL.revokeObjectURL(originalUrl);
      setErrorMsg(null);
      setResultUrl(null);
      setResultScene(null);

      const previewUrl = URL.createObjectURL(file);
      setOriginalUrl(previewUrl);

      let payload: File;
      try {
        payload = await preprocessImage(file);
      } catch (err) {
        console.error("[AiStudio] preprocess failed:", err);
        setErrorMsg(
          err instanceof Error
            ? `Bild konnte nicht vorbereitet werden: ${err.message}`
            : "Bild konnte nicht vorbereitet werden.",
        );
        setStage("error");
        return;
      }
      setPreparedFile(payload);
      setStage("configure");
    },
    [originalUrl],
  );

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function onSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Step 3: generate ──────────────────────────────────────────
  async function handleGenerate() {
    if (!preparedFile) return;
    if (insufficientCredits) {
      setErrorMsg(
        `Du brauchst ${CREDIT_COSTS.AI_STUDIO} Credits — du hast ${credits.balance}.`,
      );
      return;
    }
    const scene =
      AI_STUDIO_SCENES.find((s) => s.id === sceneId) || AI_STUDIO_SCENES[0];

    setErrorMsg(null);
    setStage("processing");
    startTimer();
    credits.optimisticDeduct(CREDIT_COSTS.AI_STUDIO);

    try {
      const fd = new FormData();
      fd.append("file", preparedFile);
      fd.append("sceneId", scene.id);
      const trimmedPrompt = customPrompt.trim().slice(0, CUSTOM_PROMPT_MAX);
      if (trimmedPrompt) fd.append("customPrompt", trimmedPrompt);

      const res = await fetch("/api/ai-studio", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        if (typeof data?.creditsRemaining === "number") {
          credits.setBalance(data.creditsRemaining);
        } else {
          credits.refresh();
        }
        throw new Error(
          (data && data.error) || `Verarbeitung fehlgeschlagen (Status ${res.status}).`,
        );
      }
      if (typeof data.creditsRemaining === "number") {
        credits.setBalance(data.creditsRemaining);
      } else {
        credits.refresh();
      }
      stopTimer();
      setResultUrl(data.url as string);
      setResultScene(scene);
      setSavedToLibrary(false);
      setStage("done");
    } catch (err) {
      stopTimer();
      setErrorMsg(
        err instanceof Error ? err.message : "Unbekannter Fehler bei der Verarbeitung.",
      );
      setStage("error");
    }
  }

  async function handleDownload() {
    if (!resultUrl) return;
    try {
      const blob = await fetch(resultUrl).then((r) => r.blob());
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `ai-studio-${resultScene?.id || "scene"}-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setErrorMsg("Download fehlgeschlagen.");
    }
  }

  const elapsedSec = (elapsed / 1000).toFixed(1);

  return (
    <div className="font-sf w-full">
      {/* ── STAGE: upload (Step 1) ───────────────────────────── */}
      {stage === "upload" && (
        <>
          <StepHeader step={1} total={3} title="Produktbild hochladen" />
          <div
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onClick={() => fileInputRef.current?.click()}
            className="relative aspect-[4/3] sm:aspect-[16/9] rounded-2xl flex flex-col items-center justify-center text-center px-4 sm:px-6 py-6 sm:py-8 transition-all duration-300 cursor-pointer"
            style={{
              background: dragActive
                ? "rgba(149, 191, 71, 0.06)"
                : "rgba(255, 255, 255, 0.03)",
              backdropFilter: "blur(28px) saturate(140%)",
              WebkitBackdropFilter: "blur(28px) saturate(140%)",
              border: `1px dashed ${dragActive ? ACCENT + "80" : "rgba(255,255,255,0.10)"}`,
              boxShadow: dragActive
                ? `0 0 0 4px ${ACCENT}15, 0 24px 60px -20px rgba(0,0,0,0.5)`
                : "0 24px 60px -30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onSelect}
            />

            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
              style={{
                background: `linear-gradient(135deg, ${ACCENT}25, ${ACCENT}10)`,
                border: `1px solid ${ACCENT}30`,
              }}
            >
              <CameraIcon color={ACCENT} />
            </div>

            <h3
              className="text-[17px] font-semibold tracking-tight text-white"
              style={{ letterSpacing: "-0.022em" }}
            >
              Produkt hochladen
            </h3>
            <p className="text-[12px] text-zinc-400 mt-1.5 max-w-sm leading-relaxed">
              Tippen oder Datei reinziehen
            </p>
            <p className="text-[10px] text-zinc-600 mt-0.5">
              JPG · PNG · WebP
            </p>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="mt-4 px-5 h-10 rounded-full text-[14px] font-semibold transition-all active:scale-[0.98]"
              style={{
                background: ACCENT,
                color: "#0a1604",
                boxShadow: `0 8px 24px -8px ${ACCENT}80, inset 0 1px 0 rgba(255,255,255,0.25)`,
              }}
            >
              Datei wählen
            </button>

            <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-[0.14em] text-zinc-600 whitespace-nowrap">
              {CREDIT_COSTS.AI_STUDIO} Credits / Generierung
            </p>
          </div>

          {errorMsg && <InlineError msg={errorMsg} />}
        </>
      )}

      {/* ── STAGE: configure (Step 2 + Step 3) ───────────────── */}
      {stage === "configure" && originalUrl && (
        <>
          <StepHeader step={2} total={3} title="Szene & Stil wählen" />

          {/* Compact preview row */}
          <div
            className="flex items-center gap-2 mb-3 rounded-xl p-2"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              className="w-12 h-12 rounded-lg overflow-hidden shrink-0"
              style={{ background: "#0a0a0c" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={originalUrl}
                alt="Original"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-white">
                Bereit zur Verarbeitung
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">
                Wähle eine Szene unten
              </div>
            </div>
            <button
              onClick={() => {
                if (originalUrl) URL.revokeObjectURL(originalUrl);
                setOriginalUrl(null);
                setPreparedFile(null);
                setStage("upload");
              }}
              className="text-[11px] px-2.5 h-7 rounded-full font-medium text-zinc-300 transition active:scale-[0.97] shrink-0"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              Anderes
            </button>
          </div>

          {/* Carousel of scene templates */}
          <SceneCarousel selected={sceneId} onSelect={setSceneId} />

          {/* Custom prompt — collapsible */}
          <CustomPromptBlock
            value={customPrompt}
            onChange={setCustomPrompt}
            open={showCustomPrompt}
            setOpen={setShowCustomPrompt}
          />

          <StepHeader step={3} total={3} title="Generieren" className="mt-4" />

          <button
            onClick={handleGenerate}
            disabled={insufficientCredits}
            className="w-full h-13 py-4 rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: ACCENT,
              color: "#0a1604",
              boxShadow: `0 12px 28px -10px ${ACCENT}80, inset 0 1px 0 rgba(255,255,255,0.25)`,
            }}
          >
            <SparklesIcon />
            Generieren · {CREDIT_COSTS.AI_STUDIO} Credits
          </button>

          {insufficientCredits && (
            <div
              className="mt-4 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              style={{
                background: "rgba(245, 158, 11, 0.08)",
                border: "1px solid rgba(245, 158, 11, 0.20)",
              }}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-[20px]">🪙</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-amber-200">
                    Nicht genug Credits
                  </div>
                  <div className="text-[11.5px] text-amber-100/70 mt-0.5">
                    Pro Generierung brauchst du {CREDIT_COSTS.AI_STUDIO} Credits.
                    Aktuell: {credits.balance.toLocaleString("de-DE")}.
                  </div>
                </div>
              </div>
              <Link
                href="/credits"
                className="shrink-0 w-full sm:w-auto px-4 h-10 rounded-full inline-flex items-center justify-center text-[12.5px] font-semibold transition active:scale-[0.97]"
                style={{
                  background: ACCENT,
                  color: "#0a1604",
                }}
              >
                Aufladen
              </Link>
            </div>
          )}

          {errorMsg && <InlineError msg={errorMsg} />}
        </>
      )}

      {/* ── STAGE: processing ────────────────────────────────── */}
      {stage === "processing" && (
        <div
          className="relative aspect-[4/3] sm:aspect-[16/9] rounded-2xl flex flex-col items-center justify-center text-center px-4 sm:px-6 py-6 sm:py-8 overflow-hidden"
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            backdropFilter: "blur(28px) saturate(140%)",
            WebkitBackdropFilter: "blur(28px) saturate(140%)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 24px 60px -30px rgba(0,0,0,0.5)",
          }}
        >
          {originalUrl && (
            <img
              src={originalUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-contain opacity-15 blur-md"
            />
          )}
          <div className="relative z-10 flex flex-col items-center max-w-sm">
            <Spinner color={ACCENT} />
            <h3
              className="mt-3 text-[16px] font-semibold tracking-tight text-white"
              style={{ letterSpacing: "-0.022em" }}
            >
              Szene wird erstellt
            </h3>
            <p className="mt-1 text-[11px] text-zinc-400">
              Verarbeitung läuft · {elapsedSec}s
            </p>
            <p className="mt-1 text-[11px] text-zinc-500 max-w-xs">
              Die KI integriert dein Produkt in die neue Szene mit
              passender Belichtung und realistischen Schatten.
            </p>
          </div>
        </div>
      )}

      {/* ── STAGE: done — before/after slider ────────────────── */}
      {stage === "done" && resultUrl && originalUrl && (
        <div className="space-y-3">
          <BeforeAfter beforeUrl={originalUrl} afterUrl={resultUrl} />

          {resultScene && (
            <div className="text-center">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] uppercase tracking-[0.14em] font-semibold"
                style={{
                  background: "rgba(149, 191, 71, 0.10)",
                  border: `1px solid ${ACCENT}40`,
                  color: ACCENT,
                }}
              >
                <SparklesIcon small />
                {resultScene.label}
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={handleDownload}
              className="flex-1 h-11 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              style={{
                background: ACCENT,
                color: "#0a1604",
                boxShadow: `0 12px 28px -10px ${ACCENT}80, inset 0 1px 0 rgba(255,255,255,0.25)`,
              }}
            >
              <DownloadIcon />
              Herunterladen
            </button>
            <button
              onClick={handleSaveToLibrary}
              disabled={savingToLibrary || savedToLibrary}
              className="h-11 px-4 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-60"
              style={{
                background: savedToLibrary ? "rgba(16,185,129,0.10)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${savedToLibrary ? "rgba(16,185,129,0.35)" : "rgba(255,255,255,0.10)"}`,
                color: savedToLibrary ? "#10b981" : "#e4e4e7",
              }}
            >
              {savingToLibrary ? (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : savedToLibrary ? (
                <CheckSmallIcon />
              ) : (
                <FolderSmallIcon />
              )}
              {savedToLibrary ? "Gespeichert" : savingToLibrary ? "Speichere…" : "In Mediathek"}
            </button>
            <button
              onClick={() => {
                setResultUrl(null);
                setResultScene(null);
                setSavedToLibrary(false);
                setStage("configure");
              }}
              className="px-3 h-11 rounded-xl text-[12px] font-semibold text-zinc-300 transition-all active:scale-[0.99]"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              Andere Szene
            </button>
            <button
              onClick={reset}
              className="px-3 h-11 rounded-xl text-[12px] font-semibold text-zinc-300 transition-all active:scale-[0.99]"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              Neues Bild
            </button>
          </div>
        </div>
      )}

      {/* ── STAGE: error ─────────────────────────────────────── */}
      {stage === "error" && errorMsg && (
        <div
          className="rounded-2xl p-3 flex items-start gap-2"
          style={{
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.20)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <AlertIcon />
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold text-red-300">Fehler</div>
              <div className="text-[13px] text-red-200/90 mt-1 break-words">
                {errorMsg}
              </div>
            </div>
          </div>
          <button
            onClick={reset}
            className="text-[12px] px-3 h-9 rounded-lg font-medium text-red-200 transition-all active:scale-[0.97]"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            Erneut versuchen
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Step header ─────────────────────────────────────────────────

function StepHeader({
  step,
  total,
  title,
  className = "",
}: {
  step: number;
  total: number;
  title: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 mb-2.5 ${className}`}>
      <span
        className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-semibold tabular-nums shrink-0"
        style={{
          background: `${ACCENT}18`,
          border: `1px solid ${ACCENT}40`,
          color: ACCENT,
        }}
      >
        {step}
      </span>
      <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-zinc-500 hidden sm:inline">
        Schritt {step} / {total}
      </span>
      <h2 className="text-[13px] font-semibold tracking-tight text-white truncate">
        {title}
      </h2>
    </div>
  );
}

// ─── Inline error pill ───────────────────────────────────────────

function InlineError({ msg }: { msg: string }) {
  return (
    <div
      className="mt-4 rounded-2xl p-4 flex items-start gap-3"
      style={{
        background: "rgba(239, 68, 68, 0.08)",
        border: "1px solid rgba(239, 68, 68, 0.20)",
      }}
    >
      <AlertIcon />
      <div className="text-[13px] text-red-200 break-words flex-1 min-w-0">{msg}</div>
    </div>
  );
}

// ─── Custom Prompt block ────────────────────────────────────────
// Collapsible textarea so the configure view stays clean by default.
// Power users can pop it open and add framing or mood notes that get
// appended to the scene's curated prompt server-side.

function CustomPromptBlock({
  value,
  onChange,
  open,
  setOpen,
}: {
  value: string;
  onChange: (v: string) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
}) {
  const remaining = CUSTOM_PROMPT_MAX - value.length;
  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rounded-2xl px-4 py-3 transition active:scale-[0.99]"
        style={{
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: open ? `${ACCENT}18` : "rgba(255,255,255,0.04)",
              border: `1px solid ${open ? `${ACCENT}40` : "rgba(255,255,255,0.08)"}`,
            }}
          >
            <PencilIcon color={open ? ACCENT : "#a1a1aa"} />
          </div>
          <div className="text-left min-w-0">
            <div className="text-[13px] font-semibold text-white truncate">
              Eigener Prompt
              <span className="text-zinc-500 font-normal ml-1.5">
                (optional)
              </span>
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
              {value
                ? `${value.slice(0, 60)}${value.length > 60 ? "…" : ""}`
                : "z. B. „mit Schatten von einer Pflanze rechts"}
            </div>
          </div>
        </div>
        <ChevronIcon dir={open ? "up" : "down"} />
      </button>

      {open && (
        <div
          className="mt-2 rounded-2xl p-3 sm:p-4"
          style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value.slice(0, CUSTOM_PROMPT_MAX))}
            placeholder="Beschreibe Details die zur Szene hinzukommen sollen — auf Deutsch oder Englisch."
            rows={3}
            className="w-full rounded-xl px-3 py-2.5 text-[13.5px] outline-none resize-none transition placeholder:text-white/25 leading-relaxed text-white"
            style={{
              background: "rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          />
          <div className="flex items-center justify-between mt-2 px-1">
            <span className="text-[10.5px] text-zinc-500">
              wird an die Szene angehängt
            </span>
            <span
              className="text-[10.5px] tabular-nums"
              style={{ color: remaining < 50 ? "#fbbf24" : "#71717a" }}
            >
              {remaining}/{CUSTOM_PROMPT_MAX}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Scene Carousel ──────────────────────────────────────────────
// Horizontal snap carousel. On mobile we hide the desktop arrow
// buttons (touch swipe is the natural interaction) and use a
// taller card so the scene visual is more legible.

function SceneCarousel({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function nudge(dir: 1 | -1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 320, behavior: "smooth" });
  }

  return (
    <div className="relative -mx-1">
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-3 px-1 snap-x snap-mandatory scrollbar-thin"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.10) transparent",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {AI_STUDIO_SCENES.map((scene) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            active={scene.id === selected}
            onClick={() => onSelect(scene.id)}
          />
        ))}
        {/* Trailing spacer so the last card snaps with breathing room */}
        <div className="shrink-0 w-1" aria-hidden />
      </div>

      {/* Desktop edge nudges */}
      <button
        onClick={() => nudge(-1)}
        className="hidden md:flex absolute left-0 top-[42%] -translate-y-1/2 -translate-x-2 w-9 h-9 rounded-full items-center justify-center transition active:scale-[0.95]"
        style={{
          background: "rgba(15,15,18,0.92)",
          border: "1px solid rgba(255,255,255,0.10)",
          color: "#fff",
          backdropFilter: "blur(12px)",
        }}
        aria-label="Zurück scrollen"
      >
        <ChevronIcon dir="left" />
      </button>
      <button
        onClick={() => nudge(1)}
        className="hidden md:flex absolute right-0 top-[42%] -translate-y-1/2 translate-x-2 w-9 h-9 rounded-full items-center justify-center transition active:scale-[0.95]"
        style={{
          background: "rgba(15,15,18,0.92)",
          border: "1px solid rgba(255,255,255,0.10)",
          color: "#fff",
          backdropFilter: "blur(12px)",
        }}
        aria-label="Vor scrollen"
      >
        <ChevronIcon dir="right" />
      </button>
    </div>
  );
}

// ─── Single Scene Card ──────────────────────────────────────────
// Layered CSS art: background gradient → optional radial light spot →
// optional surface band → product silhouette → glass label. Selected
// state adds a green ring and a checkmark; hover gently lifts.

function SceneCard({
  scene,
  active,
  onClick,
}: {
  scene: AiStudioScene;
  active: boolean;
  onClick: () => void;
}) {
  const v = scene.visual;
  const tint = v.product === "light" ? "light" : "dark";

  return (
    <button
      onClick={onClick}
      className="group relative shrink-0 snap-start w-[150px] rounded-xl overflow-hidden text-left transition-all active:scale-[0.98] hover:-translate-y-0.5"
      style={{
        border: active ? `1.5px solid ${ACCENT}` : "1px solid rgba(255,255,255,0.10)",
        boxShadow: active
          ? `0 16px 32px -12px ${ACCENT}55, 0 0 0 4px ${ACCENT}20`
          : "0 14px 28px -18px rgba(0,0,0,0.7)",
      }}
    >
      {/* Visual stage: aspect 4:5 portrait */}
      <div className="relative aspect-[4/5]" style={{ background: v.background }}>
        {v.light && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: v.light, mixBlendMode: "screen" }}
          />
        )}
        {v.accent && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: v.accent }}
          />
        )}
        {v.surface && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: v.surface }}
          />
        )}

        {/* Product silhouette — universal-ish bottle/box shape with
            a soft contact shadow so each card reads as a real scene. */}
        <ProductSilhouette tint={tint} />

        {/* Selected check badge */}
        {active && (
          <div
            className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center"
            style={{
              background: ACCENT,
              boxShadow: "0 6px 14px -2px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.4)",
            }}
          >
            <CheckIcon />
          </div>
        )}

        {/* Vignette to make labels pop */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)",
          }}
        />
      </div>

      {/* Glass label */}
      <div
        className="px-3 py-2.5"
        style={{
          background: "rgba(12, 12, 14, 0.92)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div className="text-[12.5px] font-semibold text-white truncate">
          {scene.label}
        </div>
        <div className="text-[10.5px] text-zinc-500 truncate mt-0.5">
          {scene.hint}
        </div>
      </div>
    </button>
  );
}

// Universal product silhouette: rounded "bottle" body with a soft
// contact shadow. Tint flips between light/dark depending on the
// scene background so it stays visible on every theme.
function ProductSilhouette({ tint }: { tint: "light" | "dark" }) {
  const fill =
    tint === "light"
      ? "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.62) 60%, rgba(255,255,255,0.45) 100%)"
      : "linear-gradient(180deg, rgba(40,40,46,0.92) 0%, rgba(20,20,24,0.7) 60%, rgba(12,12,16,0.55) 100%)";
  const innerShine =
    tint === "light"
      ? "linear-gradient(85deg, transparent 65%, rgba(255,255,255,0.35) 78%, transparent 92%)"
      : "linear-gradient(85deg, transparent 65%, rgba(255,255,255,0.10) 78%, transparent 92%)";
  return (
    <div className="absolute inset-0 flex items-end justify-center pointer-events-none pb-[26%]">
      <div className="relative w-[42%]">
        {/* Contact shadow ellipse */}
        <div
          className="absolute -bottom-[14%] left-1/2 -translate-x-1/2 w-[120%] h-[14%] rounded-[50%]"
          style={{
            background:
              "radial-gradient(closest-side, rgba(0,0,0,0.55), transparent 75%)",
            filter: "blur(2px)",
          }}
        />
        {/* Body */}
        <div
          className="relative aspect-[2/3] rounded-[22%_22%_18%_18%/14%_14%_10%_10%]"
          style={{
            background: fill,
            boxShadow:
              tint === "light"
                ? "0 14px 18px -8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.55)"
                : "0 14px 18px -8px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.18)",
          }}
        >
          {/* Subtle "neck" highlight */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[35%] h-[18%] rounded-b-xl"
            style={{
              background:
                tint === "light"
                  ? "linear-gradient(180deg, rgba(255,255,255,0.7) 0%, transparent 100%)"
                  : "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 100%)",
            }}
          />
          {/* Side shine */}
          <div
            className="absolute inset-0 rounded-[22%_22%_18%_18%/14%_14%_10%_10%]"
            style={{ background: innerShine }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Before/After Reveal Slider ─────────────────────────────────

function BeforeAfter({
  beforeUrl,
  afterUrl,
}: {
  beforeUrl: string;
  afterUrl: string;
}) {
  const [pct, setPct] = useState(50);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function setFromClientX(clientX: number) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPct(Math.max(0, Math.min(100, next)));
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setFromClientX(e.clientX);
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    setFromClientX(e.clientX);
  }
  function onPointerUp() {
    draggingRef.current = false;
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-square rounded-2xl overflow-hidden select-none touch-none"
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 24px 60px -30px rgba(0,0,0,0.6)",
        background: "#0a0a0c",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* AFTER — square output fills the canvas */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={afterUrl}
        alt="Nachher"
        crossOrigin="anonymous"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        draggable={false}
      />

      {/* BEFORE — clipped from the left, contain to keep aspect honest */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ width: `${pct}%` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeUrl}
          alt="Vorher"
          className="absolute inset-0 h-full object-contain"
          style={{
            width: containerWidth ? `${containerWidth}px` : "100%",
            background: "#111114",
          }}
          draggable={false}
        />
      </div>

      {/* Divider + handle */}
      <div
        className="absolute top-0 bottom-0"
        style={{
          left: `${pct}%`,
          transform: "translateX(-50%)",
          width: "2px",
          background: "rgba(255,255,255,0.95)",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.25), 0 0 20px rgba(0,0,0,0.4)",
        }}
      >
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 sm:w-10 sm:h-10 rounded-full flex items-center justify-center"
          style={{
            background: "#fff",
            boxShadow:
              "0 8px 20px -4px rgba(0,0,0,0.45), 0 0 0 4px rgba(255,255,255,0.18)",
          }}
        >
          <ArrowsIcon />
        </div>
      </div>

      {/* Labels */}
      <span
        className="absolute top-3 left-3 text-[10px] uppercase tracking-[0.16em] font-semibold px-2 py-1 rounded-full"
        style={{
          background: "rgba(0,0,0,0.55)",
          color: "#fff",
          backdropFilter: "blur(8px)",
        }}
      >
        Vorher
      </span>
      <span
        className="absolute top-3 right-3 text-[10px] uppercase tracking-[0.16em] font-semibold px-2 py-1 rounded-full"
        style={{
          background: ACCENT,
          color: "#0a1604",
        }}
      >
        Nachher
      </span>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

async function preprocessImage(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const longestSide = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = longestSide > PROCESS_MAX_DIM ? PROCESS_MAX_DIM / longestSide : 1;
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas-Kontext nicht verfügbar.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Bild konnte nicht kodiert werden."))),
        "image/jpeg",
        PROCESS_QUALITY,
      );
    });
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Bild konnte nicht gelesen werden."));
    img.src = src;
  });
}

// ─── Tiny inline icons ───────────────────────────────────────────

function CameraIcon({ color = "#fff" }: { color?: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function SparklesIcon({ small = false }: { small?: boolean }) {
  const s = small ? 12 : 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
      <path d="M19 16l.7 2.1L22 19l-2.3.9L19 22l-.7-2.1L16 19l2.3-.9z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a1604" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ChevronIcon({ dir }: { dir: "left" | "right" | "up" | "down" }) {
  let points = "";
  if (dir === "left") points = "15 18 9 12 15 6";
  else if (dir === "right") points = "9 18 15 12 9 6";
  else if (dir === "up") points = "18 15 12 9 6 15";
  else points = "6 9 12 15 18 9";
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points={points} />
    </svg>
  );
}

function ArrowsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a0a0c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" transform="translate(-3 0)" />
      <polyline points="9 18 15 12 9 6" transform="translate(3 0)" />
    </svg>
  );
}

function PencilIcon({ color = "#fff" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function FolderSmallIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6l2 3h6a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2z" />
    </svg>
  );
}

function CheckSmallIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function Spinner({ color }: { color: string }) {
  return (
    <div className="relative w-12 h-12">
      <div
        className="absolute inset-0 rounded-full"
        style={{ border: `2px solid ${color}25` }}
      />
      <div
        className="absolute inset-0 rounded-full animate-spin"
        style={{
          border: "2px solid transparent",
          borderTopColor: color,
          animationDuration: "0.8s",
        }}
      />
    </div>
  );
}
