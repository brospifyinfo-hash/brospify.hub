"use client";

// ─── <HybridUpscaler /> ───────────────────────────────────────────
// Smart 2-way image upscaler:
//   1. "Standard"  → in-browser, free, GPU/WebGL via UpscalerJS+TF.js
//   2. "High Quality" → server-side, Cloudinary AI upscale
//
// Cost optimisation: the heavy TF.js + UpscalerJS bundle is loaded
// ONLY when the user actually starts a Standard-mode run (next/dynamic
// with `ssr: false`). Cloud-mode users never download the model.
//
// Apple-style glassmorphism, accent #95BF47, system-UI font.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import dynamic from "next/dynamic";

// Dynamic import — UpscalerJS imports `window`/`document` at the top of
// its module, so a static import would crash `next build` on Vercel.
// `ssr: false` keeps the engine out of the server pass entirely.
const LocalUpscalerEngine = dynamic(
  () => import("./LocalUpscalerEngine"),
  { ssr: false },
);

const ACCENT = "#95BF47";
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB — Vercel body cap

type Mode = "local" | "cloud";
type Stage = "idle" | "processing" | "done" | "error";

export default function HybridUpscaler() {
  const [mode, setMode] = useState<Mode>("local");
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [upscaledUrl, setUpscaledUrl] = useState<string | null>(null);
  const [outputDims, setOutputDims] = useState<{ width: number; height: number } | null>(null);

  const [progress, setProgress] = useState(0); // 0..1, only meaningful for local mode
  const [elapsed, setElapsed] = useState(0); // ms
  const [dragActive, setDragActive] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startedAtRef = useRef(0);
  // A monotonically-increasing key so each Standard run remounts the engine.
  const [runId, setRunId] = useState(0);

  // ── Cleanup blob URLs on unmount ────────────────────────────────
  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
      if (upscaledUrl?.startsWith("blob:")) URL.revokeObjectURL(upscaledUrl);
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Compare-slider drag handling ────────────────────────────────
  useEffect(() => {
    function move(clientX: number) {
      if (!draggingRef.current || !sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const pct = ((clientX - rect.left) / rect.width) * 100;
      setSliderPos(Math.max(0, Math.min(100, pct)));
    }
    const onMove = (e: MouseEvent) => move(e.clientX);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) move(t.clientX);
    };
    const onUp = () => (draggingRef.current = false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouch);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  function startTimer() {
    startedAtRef.current = performance.now();
    setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsed(Math.round(performance.now() - startedAtRef.current));
    }, 200);
  }
  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function reset() {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (upscaledUrl?.startsWith("blob:")) URL.revokeObjectURL(upscaledUrl);
    stopTimer();
    setStage("idle");
    setErrorMsg(null);
    setOriginalFile(null);
    setOriginalUrl(null);
    setUpscaledUrl(null);
    setOutputDims(null);
    setProgress(0);
    setElapsed(0);
    setSliderPos(50);
  }

  // ── File intake ─────────────────────────────────────────────────
  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setErrorMsg("Bitte ein Bild auswählen (JPG, PNG, WebP).");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setErrorMsg(
          `Datei zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 4 MB.`,
        );
        return;
      }

      // Reset any previous run.
      if (originalUrl) URL.revokeObjectURL(originalUrl);
      if (upscaledUrl?.startsWith("blob:")) URL.revokeObjectURL(upscaledUrl);

      setErrorMsg(null);
      setUpscaledUrl(null);
      setOutputDims(null);
      setProgress(0);
      setSliderPos(50);

      const newUrl = URL.createObjectURL(file);
      setOriginalFile(file);
      setOriginalUrl(newUrl);
      setStage("processing");
      startTimer();

      if (mode === "cloud") {
        await runCloud(file);
      } else {
        // Bumping runId forces the dynamic engine to remount and start.
        setRunId((id) => id + 1);
      }
    },
    [mode, originalUrl, upscaledUrl],
  );

  // ── Cloud branch (server-side) ──────────────────────────────────
  async function runCloud(file: File) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upscale/cloudinary", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        throw new Error(
          (data && data.error) || `Server-Fehler (Status ${res.status}).`,
        );
      }
      stopTimer();
      setUpscaledUrl(data.url as string);
      setOutputDims({ width: data.width, height: data.height });
      setProgress(1);
      setStage("done");
    } catch (err) {
      stopTimer();
      setErrorMsg(
        err instanceof Error ? err.message : "Unbekannter Fehler bei der Cloud-Verarbeitung.",
      );
      setStage("error");
    }
  }

  // ── Local-engine callback handlers ──────────────────────────────
  const handleLocalResult = useCallback(
    (blob: Blob, dims: { width: number; height: number }) => {
      const url = URL.createObjectURL(blob);
      stopTimer();
      setUpscaledUrl(url);
      setOutputDims(dims);
      setProgress(1);
      setStage("done");
    },
    [],
  );
  const handleLocalError = useCallback((msg: string) => {
    stopTimer();
    setErrorMsg(msg);
    setStage("error");
  }, []);
  const handleLocalProgress = useCallback((pct: number) => {
    setProgress(pct);
  }, []);

  // ── DnD + file picker ───────────────────────────────────────────
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

  // ── Download upscaled output ────────────────────────────────────
  async function handleDownload() {
    if (!upscaledUrl) return;
    try {
      // Cloud URL is cross-origin, so fetch → blob → anchor trick keeps
      // the filename + avoids opening a new tab.
      const blob = upscaledUrl.startsWith("blob:")
        ? await fetch(upscaledUrl).then((r) => r.blob())
        : await fetch(upscaledUrl).then((r) => r.blob());
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `upscaled-${mode}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setErrorMsg("Download fehlgeschlagen.");
    }
  }

  const elapsedSec = (elapsed / 1000).toFixed(1);
  const isProcessing = stage === "processing";
  const showCompare = stage === "done" && originalUrl && upscaledUrl;
  const showLocalEngine =
    mode === "local" && isProcessing && originalFile !== null;

  // ───────────────────────────────────────────────────────────────
  return (
    <div className="font-sf w-full">
      {/* Headless engine — only mounted on Standard runs */}
      {showLocalEngine && originalFile && (
        <LocalUpscalerEngine
          key={runId}
          file={originalFile}
          onProgress={handleLocalProgress}
          onResult={handleLocalResult}
          onError={handleLocalError}
        />
      )}

      {/* ── Mode toggle ───────────────────────────────────────── */}
      <div className="mb-6 flex justify-center">
        <ModeToggle mode={mode} setMode={setMode} disabled={isProcessing} />
      </div>

      {/* ── Stage: IDLE — glass upload zone ───────────────────── */}
      {stage === "idle" && (
        <div
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onClick={() => fileInputRef.current?.click()}
          className="relative aspect-[16/10] rounded-[28px] cursor-pointer flex flex-col items-center justify-center text-center px-8 py-12 transition-all duration-300"
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
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
            style={{
              background: `linear-gradient(135deg, ${ACCENT}25, ${ACCENT}10)`,
              border: `1px solid ${ACCENT}30`,
            }}
          >
            <UploadIcon color={ACCENT} />
          </div>

          <h3
            className="text-[22px] font-semibold tracking-tight text-white"
            style={{ letterSpacing: "-0.022em" }}
          >
            Bild hochladen
          </h3>
          <p className="text-[14px] text-zinc-400 mt-2 max-w-sm leading-relaxed">
            Drag &amp; Drop oder klicke, um ein Foto auszuwählen
          </p>
          <p className="text-[12px] text-zinc-600 mt-1">
            JPG · PNG · WebP · max. 4 MB
          </p>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="mt-8 px-6 h-11 rounded-full text-[14px] font-semibold transition-all duration-200 active:scale-[0.98]"
            style={{
              background: ACCENT,
              color: "#0a1604",
              boxShadow: `0 8px 24px -8px ${ACCENT}80, inset 0 1px 0 rgba(255,255,255,0.25)`,
            }}
          >
            Datei wählen
          </button>

          <p
            className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[11px] uppercase tracking-[0.14em] text-zinc-600"
          >
            {mode === "local"
              ? "Standard · GPU lokal · 0 Credits"
              : "High Quality · Cloudinary AI · 1 Aufruf"}
          </p>
        </div>
      )}

      {/* ── Stage: PROCESSING ─────────────────────────────────── */}
      {isProcessing && (
        <div
          className="relative aspect-[16/10] rounded-[28px] flex flex-col items-center justify-center text-center px-8 py-12 overflow-hidden"
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
              className="mt-6 text-[20px] font-semibold tracking-tight text-white"
              style={{ letterSpacing: "-0.022em" }}
            >
              {mode === "local"
                ? "GPU rechnet · in deinem Browser"
                : "Cloudinary AI verfeinert"}
            </h3>
            <p className="mt-2 text-[13px] text-zinc-400">
              {mode === "local"
                ? `Modell wird geladen · läuft seit ${elapsedSec}s`
                : `Hochladen & verarbeiten · ${elapsedSec}s`}
            </p>

            {mode === "local" && progress > 0 && (
              <div className="mt-5 w-64 h-1.5 rounded-full overflow-hidden bg-white/[0.06]">
                <div
                  className="h-full rounded-full transition-[width] duration-200"
                  style={{
                    width: `${Math.round(progress * 100)}%`,
                    background: `linear-gradient(90deg, ${ACCENT}, #b8e06b)`,
                    boxShadow: `0 0 12px ${ACCENT}80`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Stage: DONE — before/after slider ─────────────────── */}
      {showCompare && (
        <div className="space-y-5">
          <div
            ref={sliderRef}
            className="relative w-full aspect-[16/10] rounded-[24px] overflow-hidden bg-zinc-900 select-none cursor-ew-resize"
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 24px 60px -30px rgba(0,0,0,0.6)",
            }}
            onMouseDown={() => (draggingRef.current = true)}
            onTouchStart={() => (draggingRef.current = true)}
          >
            <img
              src={upscaledUrl}
              alt="Hochskaliert"
              draggable={false}
              crossOrigin="anonymous"
              className="absolute inset-0 w-full h-full object-contain"
            />
            <img
              src={originalUrl}
              alt="Original"
              draggable={false}
              className="absolute inset-0 w-full h-full object-contain"
              style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
            />

            <Pill text="Vorher" position="left" />
            <Pill
              text={mode === "local" ? "Lokal · 4×" : "Cloud · HQ"}
              position="right"
              accent
            />

            <div
              className="absolute top-0 bottom-0 w-px"
              style={{
                left: `${sliderPos}%`,
                background: "white",
                boxShadow: "0 0 16px rgba(0,0,0,0.6)",
              }}
            >
              <button
                type="button"
                onMouseDown={() => (draggingRef.current = true)}
                onTouchStart={() => (draggingRef.current = true)}
                aria-label="Vergleichsregler"
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white text-black flex items-center justify-center cursor-ew-resize"
                style={{ boxShadow: "0 6px 24px rgba(0,0,0,0.45)" }}
              >
                <SliderHandle />
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleDownload}
              className="flex-1 h-12 rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              style={{
                background: ACCENT,
                color: "#0a1604",
                boxShadow: `0 12px 28px -10px ${ACCENT}80, inset 0 1px 0 rgba(255,255,255,0.25)`,
              }}
            >
              <DownloadIcon />
              Hochaufgelöstes Bild herunterladen
            </button>
            <button
              onClick={reset}
              className="px-6 h-12 rounded-2xl text-[14px] font-semibold text-zinc-300 transition-all active:scale-[0.99]"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
              }}
            >
              Neues Bild
            </button>
          </div>

          <p className="text-[12px] text-zinc-500 text-center">
            Fertig in {elapsedSec}s · {mode === "local" ? "UpscalerJS lokal" : "Cloudinary AI"}
            {outputDims && ` · ${outputDims.width}×${outputDims.height}`}
          </p>
        </div>
      )}

      {/* ── Stage: ERROR ──────────────────────────────────────── */}
      {stage === "error" && errorMsg && (
        <div
          className="rounded-[24px] p-6 flex items-start gap-4"
          style={{
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.20)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <AlertIcon />
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-red-300">Fehler</div>
            <div className="text-[13px] text-red-200/90 mt-1 break-words">{errorMsg}</div>
          </div>
          <button
            onClick={reset}
            className="text-[13px] px-4 h-9 rounded-full font-medium text-red-200 transition-all active:scale-[0.97]"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {/* Inline error during idle (validation) */}
      {stage === "idle" && errorMsg && (
        <div
          className="mt-4 rounded-2xl p-4 flex items-center gap-3"
          style={{
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.20)",
          }}
        >
          <AlertIcon />
          <div className="text-[13px] text-red-200">{errorMsg}</div>
        </div>
      )}
    </div>
  );
}

// ─── Mode toggle ─────────────────────────────────────────────────
function ModeToggle({
  mode,
  setMode,
  disabled,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  disabled?: boolean;
}) {
  const options: { value: Mode; label: string; sub: string }[] = [
    { value: "local", label: "Standard", sub: "Lokal · 0 Credits" },
    { value: "cloud", label: "High Quality", sub: "Cloud · 1 Call" },
  ];

  return (
    <div
      className="relative inline-flex p-1 rounded-2xl"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
        boxShadow: "0 8px 24px -16px rgba(0,0,0,0.6)",
      }}
    >
      {/* Sliding pill */}
      <div
        aria-hidden
        className="absolute top-1 bottom-1 rounded-xl transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          width: "calc(50% - 4px)",
          left: mode === "local" ? "4px" : "50%",
          background: `linear-gradient(180deg, ${ACCENT} 0%, #86ad3f 100%)`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 14px -4px ${ACCENT}80`,
        }}
      />
      {options.map((opt) => {
        const active = mode === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => setMode(opt.value)}
            className="relative z-10 px-5 sm:px-7 py-2 rounded-xl flex flex-col items-center transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minWidth: 124 }}
          >
            <span
              className="text-[13px] font-semibold leading-tight"
              style={{
                color: active ? "#0a1604" : "rgba(255,255,255,0.85)",
                letterSpacing: "-0.01em",
              }}
            >
              {opt.label}
            </span>
            <span
              className="text-[10px] uppercase tracking-[0.1em] font-medium leading-tight mt-0.5"
              style={{
                color: active ? "rgba(10,22,4,0.7)" : "rgba(255,255,255,0.4)",
              }}
            >
              {opt.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Tiny inline icons ───────────────────────────────────────────

function UploadIcon({ color = "#fff" }: { color?: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
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

function AlertIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function SliderHandle() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l-6-6 6-6m6 12l6-6-6-6" />
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

function Pill({
  text,
  position,
  accent,
}: {
  text: string;
  position: "left" | "right";
  accent?: boolean;
}) {
  return (
    <div
      className={`absolute top-3 ${position === "left" ? "left-3" : "right-3"} px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.12em] font-bold`}
      style={{
        background: accent ? "rgba(149,191,71,0.85)" : "rgba(0,0,0,0.6)",
        color: accent ? "#0a1604" : "#fff",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: accent ? "1px solid rgba(149,191,71,0.4)" : "1px solid rgba(255,255,255,0.15)",
      }}
    >
      {text}
    </div>
  );
}
