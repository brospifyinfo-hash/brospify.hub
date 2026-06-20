"use client";

// ─── <HybridUpscaler /> ───────────────────────────────────────────
// Three upscale modes (Photo / Faces / Graphics) × scale (2× or 4×).
// Result is shown in a draggable before/after compare slider, with
// optional one-click save to the user's Mediathek.
//
// Reliability rails (kept from the previous version):
//   • Client re-encodes every input to a JPEG ≤ 2400 px and ~92%
//     quality so the multipart payload is well under Vercel's 4.5 MB
//     body cap regardless of source format or megapixel count.
//   • The server uses Replicate's `Prefer: wait=60` then long-polls
//     up to ~3.5 minutes — generous enough for full 4× passes.

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
  useResilientJob,
  readJobResponse,
  JobDebugPanel,
  OrphanResumeBanner,
  TerminalJobError,
} from "@/lib/resilient-job";

const ACCENT = "#95BF47";
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const PROCESS_MAX_DIM = 2400;
const PROCESS_QUALITY = 0.92;

type Stage = "idle" | "preparing" | "processing" | "done" | "error";
type UpscaleMode = "photo" | "faces" | "graphics";
type Scale = 2 | 4;

interface ModeOption {
  id: UpscaleMode;
  label: string;
  hint: string;
  icon: (props: { color?: string }) => React.JSX.Element;
}

const MODES: readonly ModeOption[] = [
  {
    id: "photo",
    label: "Foto",
    hint: "Beste Wahl für Produktbilder & Fotos.",
    icon: ImageIcon,
  },
  {
    id: "faces",
    label: "Gesichter",
    hint: "Schärft & glättet Gesichter — perfekt für Lifestyle-Shots.",
    icon: FaceIcon,
  },
  {
    id: "graphics",
    label: "Grafik / Logo",
    hint: "Knackige Kanten für Logos, Icons, Screenshots.",
    icon: GraphicIcon,
  },
];

interface UpscaleResponse {
  url: string;
  creditsRemaining?: number;
}

export default function HybridUpscaler() {
  const credits = useCredits();
  const job = useResilientJob<UpscaleResponse>("upscale");
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastInput, setLastInput] = useState<{ file: File; mode: UpscaleMode; scale: Scale } | null>(null);

  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [originalDims, setOriginalDims] = useState<{ width: number; height: number } | null>(null);
  const [upscaledUrl, setUpscaledUrl] = useState<string | null>(null);
  const [outputDims, setOutputDims] = useState<{ width: number; height: number } | null>(null);

  const [mode, setMode] = useState<UpscaleMode>("photo");
  const [scale, setScale] = useState<Scale>(4);

  const [elapsed, setElapsed] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const [savedToLibrary, setSavedToLibrary] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startedAtRef = useRef(0);

  const cost = credits.costOf("UPSCALE_IMAGE", CREDIT_COSTS.UPSCALE_IMAGE);
  const insufficientCredits = !credits.loading && credits.balance < cost;

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
    setStage("idle");
    setErrorMsg(null);
    setOriginalUrl(null);
    setOriginalDims(null);
    setUpscaledUrl(null);
    setOutputDims(null);
    setElapsed(0);
    setSavedToLibrary(false);
    setSaving(false);
  }

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
      if (insufficientCredits) {
        setErrorMsg(
          `Du brauchst ${cost} Credits — du hast ${credits.balance}.`,
        );
        return;
      }

      if (originalUrl) URL.revokeObjectURL(originalUrl);
      setErrorMsg(null);
      setUpscaledUrl(null);
      setOutputDims(null);
      setSavedToLibrary(false);

      const previewUrl = URL.createObjectURL(file);
      setOriginalUrl(previewUrl);
      setStage("preparing");

      let payload: File;
      let dims: { width: number; height: number };
      try {
        const result = await preprocessImage(file);
        payload = result.file;
        dims = result.dims;
      } catch (err) {
        console.error("[Upscaler] preprocess failed:", err);
        setErrorMsg(
          err instanceof Error
            ? `Bild konnte nicht vorbereitet werden: ${err.message}`
            : "Bild konnte nicht vorbereitet werden.",
        );
        setStage("error");
        return;
      }
      setOriginalDims(dims);

      setStage("processing");
      startTimer();
      credits.optimisticDeduct(cost);
      setLastInput({ file: payload, mode, scale });
      await runUpscale(payload, mode, scale);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [insufficientCredits, credits.balance, originalUrl, mode, scale],
  );

  async function runUpscale(file: File, modeId: UpscaleMode, scaleN: Scale) {
    try {
      const data = await job.run({
        hint: `${modeId.toUpperCase()} · ${scaleN}×`,
        onAttemptStart: (n) => { if (n > 1) credits.refresh(); },
        attempt: async () => {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("mode", modeId);
          fd.append("scale", String(scaleN));
          const res = await fetch("/api/upscale/cloud", { method: "POST", body: fd });
          return await readJobResponse<UpscaleResponse>(res);
        },
      });
      if (typeof data.creditsRemaining === "number") {
        credits.setBalance(data.creditsRemaining);
      } else {
        credits.refresh();
      }
      stopTimer();
      setUpscaledUrl(data.url);
      void measureRemoteImage(data.url).then(setOutputDims);
      setStage("done");
    } catch (err) {
      stopTimer();
      credits.refresh();
      const msg = err instanceof TerminalJobError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unbekannter Fehler bei der Verarbeitung.";
      setErrorMsg(msg);
      setStage("error");
    }
  }

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

  async function handleDownload() {
    if (!upscaledUrl) return;
    try {
      const blob = await fetch(upscaledUrl).then((r) => r.blob());
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `upscaled-${scale}x-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setErrorMsg("Download fehlgeschlagen.");
    }
  }

  async function handleSaveToLibrary() {
    if (!upscaledUrl || saving || savedToLibrary) return;
    setSaving(true);
    try {
      const r = await fetch("/api/library/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "image-url",
          source: "upscaler",
          remoteUrl: upscaledUrl,
          title: `Upscale ${scale}× · ${MODES.find((m) => m.id === mode)?.label}`,
          basename: "upscaled",
          meta: {
            scale,
            mode,
            ...(outputDims || {}),
          },
        }),
      });
      if (r.ok) setSavedToLibrary(true);
    } catch {
      // ignore — user can retry
    } finally {
      setSaving(false);
    }
  }

  const elapsedSec = (elapsed / 1000).toFixed(1);
  const isWorking = stage === "preparing" || stage === "processing";

  return (
    <div className="font-sf w-full">
      {/* ── Mode + scale picker (above dropzone, also during done) ── */}
      {(stage === "idle" || stage === "done") && (
        <div className="mb-3 space-y-3">
          <ModePicker value={mode} onChange={setMode} disabled={isWorking} />
          <ScalePicker value={scale} onChange={setScale} disabled={isWorking} />
        </div>
      )}

      {/* ── Stage: IDLE — drop zone ───────────────────────────── */}
      {stage === "idle" && (
        <>
          <div
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onClick={() => !insufficientCredits && fileInputRef.current?.click()}
            className={`relative aspect-[4/3] sm:aspect-[16/9] rounded-2xl flex flex-col items-center justify-center text-center px-4 sm:px-6 py-6 sm:py-8 transition-all duration-300 ${insufficientCredits ? "cursor-not-allowed" : "cursor-pointer"}`}
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
              <UploadIcon color={ACCENT} />
            </div>

            <h3
              className="text-[17px] font-semibold tracking-tight text-white"
              style={{ letterSpacing: "-0.022em" }}
            >
              Bild hochladen
            </h3>
            <p className="text-[12px] text-zinc-400 mt-1.5 max-w-sm leading-relaxed">
              Drag &amp; Drop oder klicke, um ein Foto auszuwählen
            </p>
            <p className="text-[10px] text-zinc-600 mt-0.5">
              JPG · PNG · WebP · {scale}× Auflösung
            </p>

            <button
              type="button"
              disabled={insufficientCredits}
              onClick={(e) => {
                e.stopPropagation();
                if (!insufficientCredits) fileInputRef.current?.click();
              }}
              className="mt-4 px-5 h-10 rounded-full text-[14px] font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: ACCENT,
                color: "#0a1604",
                boxShadow: `0 8px 24px -8px ${ACCENT}80, inset 0 1px 0 rgba(255,255,255,0.25)`,
              }}
            >
              Datei wählen
            </button>

            <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-[0.14em] text-zinc-600 whitespace-nowrap">
              {cost} {credits.creditIcon} / Bild
            </p>

            {insufficientCredits && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center text-center px-6"
                style={{
                  background: "rgba(7,7,9,0.85)",
                  backdropFilter: "blur(14px)",
                  WebkitBackdropFilter: "blur(14px)",
                }}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{
                    background: "rgba(245,158,11,0.15)",
                    border: "1px solid rgba(245,158,11,0.35)",
                  }}
                >
                  <span className="text-[24px]">{credits.creditIcon}</span>
                </div>
                <h3 className="text-[18px] font-semibold tracking-tight">
                  Nicht genug Credits
                </h3>
                <p className="text-[13px] text-zinc-400 mt-1.5 max-w-xs">
                  Pro Bild brauchst du {cost} Credits.
                  Aktuell verfügbar: {credits.balance.toLocaleString("de-DE")}.
                </p>
                <Link
                  href="/credits"
                  className="mt-5 px-5 h-10 rounded-full inline-flex items-center gap-2 text-[13px] font-semibold transition active:scale-[0.98]"
                  style={{
                    background: ACCENT,
                    color: "#0a1604",
                    boxShadow: `0 8px 24px -8px ${ACCENT}80`,
                  }}
                >
                  Credits aufladen
                </Link>
              </div>
            )}
          </div>

          {errorMsg && (
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
        </>
      )}

      {/* ── Stage: WORKING ───────────────────────────────────── */}
      {isWorking && (
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
            // eslint-disable-next-line @next/next/no-img-element
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
              {stage === "preparing" ? "Bild wird vorbereitet…" : `Auf ${scale}× hochskaliert`}
            </h3>
            <p className="mt-1 text-[11px] text-zinc-400">
              {stage === "preparing"
                ? "Optimiere die Quelldatei…"
                : `${MODES.find((m) => m.id === mode)?.label}-Modus · ${elapsedSec}s`}
            </p>
            {stage === "processing" && (
              <p className="mt-1 text-[11px] text-zinc-500 max-w-xs">
                Hochauflösende Bilder können bis zu 90 Sekunden dauern.
              </p>
            )}
          </div>
        </div>
      )}
      {stage === "processing" && (
        <div className="mt-3">
          <JobDebugPanel state={job.state} />
        </div>
      )}
      {job.hasOrphan && stage !== "processing" && (
        <div className="mb-3">
          <OrphanResumeBanner
            toolLabel="Hybrid-Upscaler"
            onRetry={() => {
              if (lastInput) {
                setStage("processing");
                startTimer();
                runUpscale(lastInput.file, lastInput.mode, lastInput.scale);
              } else {
                job.clearOrphan();
              }
            }}
            onDismiss={job.clearOrphan}
          />
        </div>
      )}

      {/* ── Stage: DONE — before/after slider ─────────────── */}
      {stage === "done" && upscaledUrl && originalUrl && (
        <div className="space-y-3">
          <BeforeAfter beforeUrl={originalUrl} afterUrl={upscaledUrl} />

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
              disabled={saving || savedToLibrary}
              className="h-11 px-4 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-60"
              style={{
                background: savedToLibrary ? "rgba(16,185,129,0.10)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${savedToLibrary ? "rgba(16,185,129,0.35)" : "rgba(255,255,255,0.10)"}`,
                color: savedToLibrary ? "#10b981" : "#e4e4e7",
              }}
            >
              {saving ? <Spinner color="currentColor" small /> : savedToLibrary ? <CheckIcon /> : <FolderIcon />}
              {savedToLibrary ? "Gespeichert" : saving ? "Speichere…" : "In Mediathek"}
            </button>
            <button
              onClick={reset}
              className="px-4 h-11 rounded-xl text-[12px] font-semibold text-zinc-300 transition-all active:scale-[0.99]"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              Neues Bild
            </button>
          </div>

          <p className="text-[10px] text-zinc-500 text-center">
            Fertig in {elapsedSec}s
            {originalDims && outputDims && ` · ${originalDims.width}×${originalDims.height} → ${outputDims.width}×${outputDims.height}`}
          </p>
        </div>
      )}

      {/* ── Stage: ERROR ──────────────────────────────────────── */}
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
              <div className="text-[13px] text-red-200/90 mt-1 break-words">{errorMsg}</div>
            </div>
          </div>
          <button
            onClick={reset}
            className="text-[13px] px-4 h-9 rounded-full font-medium text-red-200 transition-all active:scale-[0.97] shrink-0"
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

// ─── Mode picker ───────────────────────────────────────────────

function ModePicker({ value, onChange, disabled }: {
  value: UpscaleMode;
  onChange: (m: UpscaleMode) => void;
  disabled: boolean;
}) {
  const active = MODES.find((m) => m.id === value) ?? MODES[0];
  return (
    <div
      className="rounded-2xl p-1 grid grid-cols-3 gap-1"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {MODES.map((m) => {
        const isSelected = m.id === value;
        return (
          <button
            key={m.id}
            disabled={disabled}
            onClick={() => onChange(m.id)}
            className="relative px-2 py-2 rounded-xl text-[11px] font-semibold flex flex-col items-center justify-center gap-1 transition disabled:opacity-50"
            style={{
              background: isSelected ? `linear-gradient(135deg, ${ACCENT}25, ${ACCENT}08)` : "transparent",
              border: isSelected ? `1px solid ${ACCENT}40` : "1px solid transparent",
              color: isSelected ? ACCENT : "rgba(255,255,255,0.65)",
            }}
            title={m.hint}
          >
            <m.icon color={isSelected ? ACCENT : "currentColor"} />
            {m.label}
          </button>
        );
      })}

      {/* Hint row spans full grid */}
      <p className="col-span-3 px-3 pt-1.5 pb-1 text-[10px] text-zinc-500 leading-snug text-center">
        {active.hint}
      </p>
    </div>
  );
}

// ─── Scale picker ──────────────────────────────────────────────

function ScalePicker({ value, onChange, disabled }: {
  value: Scale;
  onChange: (s: Scale) => void;
  disabled: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-1 grid grid-cols-2 gap-1"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {([2, 4] as Scale[]).map((s) => {
        const isSelected = s === value;
        return (
          <button
            key={s}
            disabled={disabled}
            onClick={() => onChange(s)}
            className="relative px-3 py-2 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-1 transition disabled:opacity-50"
            style={{
              background: isSelected ? `linear-gradient(135deg, ${ACCENT}25, ${ACCENT}08)` : "transparent",
              border: isSelected ? `1px solid ${ACCENT}40` : "1px solid transparent",
              color: isSelected ? ACCENT : "rgba(255,255,255,0.7)",
            }}
          >
            {s}× Auflösung
            <span className="text-[9px] font-normal opacity-60 ml-1">
              {s === 2 ? "schneller" : "max"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Before/after compare slider ───────────────────────────────

function BeforeAfter({ beforeUrl, afterUrl }: { beforeUrl: string; afterUrl: string }) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  function handleMove(clientX: number) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, next)));
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleMove(e.clientX);
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    handleMove(e.clientX);
  }
  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-2xl overflow-hidden bg-zinc-900 select-none touch-none"
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 24px 60px -30px rgba(0,0,0,0.6)",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* AFTER (full-size, behind) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={afterUrl}
        alt="Hochskaliert"
        crossOrigin="anonymous"
        className="block w-full h-auto pointer-events-none"
      />

      {/* BEFORE (clipped to slider position) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeUrl}
          alt="Original"
          className="block w-full h-full object-cover pointer-events-none"
        />
      </div>

      {/* Slider handle */}
      <div
        className="absolute top-0 bottom-0 w-[2px] bg-white/90 pointer-events-none"
        style={{ left: `${pos}%`, boxShadow: "0 0 12px rgba(0,0,0,0.5)" }}
      />
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/95 flex items-center justify-center cursor-ew-resize pointer-events-none"
        style={{ left: `${pos}%`, top: "50%", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}
      >
        <SliderHandleIcon />
      </div>

      {/* Labels */}
      <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest bg-black/60 text-white/90 backdrop-blur-md pointer-events-none">
        Vorher
      </div>
      <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest bg-[#95BF47] text-black backdrop-blur-md pointer-events-none">
        Nachher
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

interface PreprocessResult {
  file: File;
  dims: { width: number; height: number };
}

async function preprocessImage(file: File): Promise<PreprocessResult> {
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
    return {
      file: new File([blob], `${baseName}.jpg`, { type: "image/jpeg" }),
      dims: { width: img.naturalWidth, height: img.naturalHeight },
    };
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

function measureRemoteImage(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
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

function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6l2 3h6a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
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

function SliderHandleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 3 12 9 6" />
      <polyline points="15 18 21 12 15 6" />
    </svg>
  );
}

function Spinner({ color, small = false }: { color: string; small?: boolean }) {
  const size = small ? 18 : 48;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{ border: `${small ? 2 : 2}px solid ${color}25` }}
      />
      <div
        className="absolute inset-0 rounded-full animate-spin"
        style={{
          border: `${small ? 2 : 2}px solid transparent`,
          borderTopColor: color,
          animationDuration: "0.8s",
        }}
      />
    </div>
  );
}

// Mode icons
function ImageIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}
function FaceIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}
function GraphicIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
      <line x1="12" y1="22" x2="12" y2="11" />
    </svg>
  );
}
