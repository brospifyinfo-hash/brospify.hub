"use client";

// ─── <MagicBackgroundRemover /> ─────────────────────────────────
// Drop a product photo → Photoroom strips the background → user
// downloads a transparent PNG. The result preview sits on a
// checkerboard so the transparency is visually obvious.
//
// Reliability: oversized inputs are the #1 cause of failed runs
// (Vercel rejects > 4.5 MB bodies). We re-encode every input
// client-side to a JPEG capped at 2400 px on the longest side.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import Link from "next/link";
import { useCredits } from "@/lib/credits";
import { CREDIT_COSTS } from "@/lib/credit-costs";

const ACCENT = "#95BF47";
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const PROCESS_MAX_DIM = 2400;
const PROCESS_QUALITY = 0.92;

type Stage = "idle" | "preparing" | "processing" | "done" | "error";

export default function MagicBackgroundRemover() {
  const credits = useCredits();
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const [elapsed, setElapsed] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startedAtRef = useRef(0);

  const insufficientCredits =
    !credits.loading && credits.balance < CREDIT_COSTS.BG_REMOVE;

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
    setResultUrl(null);
    setElapsed(0);
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
          `Du brauchst ${CREDIT_COSTS.BG_REMOVE} Credits — du hast ${credits.balance}.`,
        );
        return;
      }

      if (originalUrl) URL.revokeObjectURL(originalUrl);
      setErrorMsg(null);
      setResultUrl(null);

      const previewUrl = URL.createObjectURL(file);
      setOriginalUrl(previewUrl);
      setStage("preparing");

      let payload: File;
      try {
        payload = await preprocessImage(file);
      } catch (err) {
        console.error("[BgRemover] preprocess failed:", err);
        setErrorMsg(
          err instanceof Error
            ? `Bild konnte nicht vorbereitet werden: ${err.message}`
            : "Bild konnte nicht vorbereitet werden.",
        );
        setStage("error");
        return;
      }

      setStage("processing");
      startTimer();
      credits.optimisticDeduct(CREDIT_COSTS.BG_REMOVE);
      await runRemoveBg(payload);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [insufficientCredits, credits.balance, originalUrl],
  );

  async function runRemoveBg(file: File) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/photoroom/remove-bg", {
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
      setStage("done");
    } catch (err) {
      stopTimer();
      setErrorMsg(
        err instanceof Error ? err.message : "Unbekannter Fehler bei der Verarbeitung.",
      );
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
    if (!resultUrl) return;
    try {
      const blob = await fetch(resultUrl).then((r) => r.blob());
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `bg-removed-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setErrorMsg("Download fehlgeschlagen.");
    }
  }

  const elapsedSec = (elapsed / 1000).toFixed(1);
  const isWorking = stage === "preparing" || stage === "processing";

  return (
    <div className="font-sf w-full">
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
            className={`relative aspect-[16/10] rounded-[28px] flex flex-col items-center justify-center text-center px-8 py-12 transition-all duration-300 ${insufficientCredits ? "cursor-not-allowed" : "cursor-pointer"}`}
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
              <ScissorsIcon color={ACCENT} />
            </div>

            <h3
              className="text-[22px] font-semibold tracking-tight text-white"
              style={{ letterSpacing: "-0.022em" }}
            >
              Produkt freistellen
            </h3>
            <p className="text-[14px] text-zinc-400 mt-2 max-w-sm leading-relaxed">
              Drag &amp; Drop oder klicke, um ein Foto auszuwählen
            </p>
            <p className="text-[12px] text-zinc-600 mt-1">
              JPG · PNG · WebP · transparenter PNG-Output
            </p>

            <button
              type="button"
              disabled={insufficientCredits}
              onClick={(e) => {
                e.stopPropagation();
                if (!insufficientCredits) fileInputRef.current?.click();
              }}
              className="mt-8 px-6 h-11 rounded-full text-[14px] font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: ACCENT,
                color: "#0a1604",
                boxShadow: `0 8px 24px -8px ${ACCENT}80, inset 0 1px 0 rgba(255,255,255,0.25)`,
              }}
            >
              Datei wählen
            </button>

            <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[11px] uppercase tracking-[0.14em] text-zinc-600">
              Kostet {CREDIT_COSTS.BG_REMOVE} Credits pro Bild
            </p>

            {insufficientCredits && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-0 rounded-[28px] flex flex-col items-center justify-center text-center px-6"
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
                  <span className="text-[24px]">🪙</span>
                </div>
                <h3 className="text-[18px] font-semibold tracking-tight">
                  Nicht genug Credits
                </h3>
                <p className="text-[13px] text-zinc-400 mt-1.5 max-w-xs">
                  Pro Bild brauchst du {CREDIT_COSTS.BG_REMOVE} Credits.
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

      {isWorking && (
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
              {stage === "preparing"
                ? "Bild wird vorbereitet…"
                : "Hintergrund wird entfernt"}
            </h3>
            <p className="mt-2 text-[13px] text-zinc-400">
              {stage === "preparing"
                ? "Optimiere die Quelldatei…"
                : `Verarbeitung läuft · ${elapsedSec}s`}
            </p>
            {stage === "processing" && (
              <p className="mt-1 text-[11px] text-zinc-500 max-w-xs">
                Dein Produkt bleibt pixelgenau erhalten — nur der
                Hintergrund wird entfernt.
              </p>
            )}
          </div>
        </div>
      )}

      {stage === "done" && resultUrl && (
        <div className="space-y-5">
          <div
            className="relative w-full rounded-[24px] overflow-hidden"
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 24px 60px -30px rgba(0,0,0,0.6)",
              background: "#fff",
              backgroundImage: `
                linear-gradient(45deg, #d4d4d8 25%, transparent 25%),
                linear-gradient(-45deg, #d4d4d8 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #d4d4d8 75%),
                linear-gradient(-45deg, transparent 75%, #d4d4d8 75%)
              `,
              backgroundSize: "24px 24px",
              backgroundPosition: "0 0, 0 12px, 12px -12px, -12px 0px",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resultUrl}
              alt="Freigestelltes Produkt"
              crossOrigin="anonymous"
              className="block w-full h-auto"
            />
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
              Download (PNG)
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
            Fertig in {elapsedSec}s · transparenter PNG
          </p>
        </div>
      )}

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
            <div className="text-[13px] text-red-200/90 mt-1 break-words">
              {errorMsg}
            </div>
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

function ScissorsIcon({ color = "#fff" }: { color?: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
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
