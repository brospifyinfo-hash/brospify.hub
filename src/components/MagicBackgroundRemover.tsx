"use client";

// ─── <MagicBackgroundRemover /> ─────────────────────────────────
// Three precision tiers (Schnell / Präzise / Haar+Fell) call into
// rembg or BiRefNet via Fal. After the cutout returns, the user can
// optionally composite it onto a new background — solid colour,
// gradient preset, or uploaded image — entirely client-side via
// canvas. Result is saved to the user's Mediathek with one tap.
//
// Cost discipline: background replacement is local — zero API calls,
// zero credits, instant. Only the initial cutout costs.

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
import {
  BG_PRECISION_OPTIONS,
  type BgPrecision,
} from "@/lib/ai-studio-scenes";

const ACCENT = "#95BF47";
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const PROCESS_MAX_DIM = 2400;
const PROCESS_QUALITY = 0.92;

type Stage = "idle" | "preparing" | "processing" | "done" | "error";
type BgKind = "transparent" | "color" | "gradient" | "image";

interface ColorPreset { id: string; label: string; hex: string }
interface GradientPreset { id: string; label: string; css: string; canvas: string[] }

const COLOR_PRESETS: ColorPreset[] = [
  { id: "white", label: "Weiß", hex: "#ffffff" },
  { id: "black", label: "Schwarz", hex: "#0a0a0a" },
  { id: "ivory", label: "Elfenbein", hex: "#f5efe2" },
  { id: "stone", label: "Steingrau", hex: "#a8a29e" },
  { id: "sage", label: "Salbei", hex: "#bbcdb1" },
  { id: "blush", label: "Blush", hex: "#f3d4cf" },
  { id: "navy", label: "Navy", hex: "#1d2942" },
  { id: "brand", label: "Brand", hex: "#95BF47" },
];

const GRADIENT_PRESETS: GradientPreset[] = [
  { id: "warm-cream", label: "Cream", css: "linear-gradient(180deg,#fff7ed 0%,#fde6c4 100%)", canvas: ["#fff7ed", "#fde6c4"] },
  { id: "warm-blush", label: "Blush", css: "linear-gradient(180deg,#fde2e4 0%,#f9b6c4 100%)", canvas: ["#fde2e4", "#f9b6c4"] },
  { id: "cool-mint", label: "Mint", css: "linear-gradient(180deg,#e0f2eb 0%,#a8d5c0 100%)", canvas: ["#e0f2eb", "#a8d5c0"] },
  { id: "cool-sky", label: "Sky", css: "linear-gradient(180deg,#dbeafe 0%,#93c5fd 100%)", canvas: ["#dbeafe", "#93c5fd"] },
  { id: "neutral-stone", label: "Stein", css: "linear-gradient(180deg,#f5f5f4 0%,#a8a29e 100%)", canvas: ["#f5f5f4", "#a8a29e"] },
  { id: "moody-charcoal", label: "Moody", css: "linear-gradient(180deg,#3f3f46 0%,#0a0a0a 100%)", canvas: ["#3f3f46", "#0a0a0a"] },
  { id: "sunset", label: "Sunset", css: "linear-gradient(180deg,#fed7aa 0%,#fb923c 60%,#9a3412 100%)", canvas: ["#fed7aa", "#fb923c", "#9a3412"] },
  { id: "brand-glow", label: "Brand", css: `linear-gradient(180deg,#cce6a6 0%,${ACCENT} 100%)`, canvas: ["#cce6a6", ACCENT] },
];

export default function MagicBackgroundRemover() {
  const credits = useCredits();
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null);
  const [precision, setPrecision] = useState<BgPrecision>("fast");

  // Background composition state
  const [bgKind, setBgKind] = useState<BgKind>("transparent");
  const [bgColor, setBgColor] = useState<string>(COLOR_PRESETS[0].hex);
  const [bgGradient, setBgGradient] = useState<string>(GRADIENT_PRESETS[0].id);
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null);
  const [composedUrl, setComposedUrl] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const [savedToLibrary, setSavedToLibrary] = useState(false);
  const [saving, setSaving] = useState(false);

  const [elapsed, setElapsed] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgUploadRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startedAtRef = useRef(0);

  const insufficientCredits =
    !credits.loading && credits.balance < CREDIT_COSTS.BG_REMOVE;

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
      if (composedUrl?.startsWith("blob:")) URL.revokeObjectURL(composedUrl);
      if (bgImageUrl?.startsWith("blob:")) URL.revokeObjectURL(bgImageUrl);
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Recompose whenever the user changes the bg or kind ──
  useEffect(() => {
    if (!cutoutUrl) return;
    if (bgKind === "transparent") {
      if (composedUrl?.startsWith("blob:")) URL.revokeObjectURL(composedUrl);
      setComposedUrl(null);
      setSavedToLibrary(false);
      return;
    }
    let cancelled = false;
    setComposing(true);
    composeOnBackground(cutoutUrl, { kind: bgKind, color: bgColor, gradient: bgGradient, imageUrl: bgImageUrl })
      .then((blobUrl) => {
        if (cancelled) {
          if (blobUrl.startsWith("blob:")) URL.revokeObjectURL(blobUrl);
          return;
        }
        setComposedUrl((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
          return blobUrl;
        });
        setSavedToLibrary(false);
      })
      .catch((err) => {
        console.error("[BgRemover] compose failed:", err);
      })
      .finally(() => {
        if (!cancelled) setComposing(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutoutUrl, bgKind, bgColor, bgGradient, bgImageUrl]);

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
    if (composedUrl?.startsWith("blob:")) URL.revokeObjectURL(composedUrl);
    if (bgImageUrl?.startsWith("blob:")) URL.revokeObjectURL(bgImageUrl);
    stopTimer();
    setStage("idle");
    setErrorMsg(null);
    setOriginalUrl(null);
    setCutoutUrl(null);
    setComposedUrl(null);
    setBgImageUrl(null);
    setBgKind("transparent");
    setSavedToLibrary(false);
    setSaving(false);
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
      if (composedUrl?.startsWith("blob:")) URL.revokeObjectURL(composedUrl);
      setErrorMsg(null);
      setCutoutUrl(null);
      setComposedUrl(null);
      setSavedToLibrary(false);

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
      await runRemoveBg(payload, precision);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [insufficientCredits, credits.balance, originalUrl, precision],
  );

  async function runRemoveBg(file: File, precisionId: BgPrecision) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("precision", precisionId);
      const res = await fetch("/api/bg-remove", {
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
      setCutoutUrl(data.url as string);
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

  function onBgImageSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (bgImageUrl?.startsWith("blob:")) URL.revokeObjectURL(bgImageUrl);
    const url = URL.createObjectURL(file);
    setBgImageUrl(url);
    setBgKind("image");
    if (bgUploadRef.current) bgUploadRef.current.value = "";
  }

  // The displayed image: cutout when transparent, composed otherwise
  const displayUrl = bgKind === "transparent" ? cutoutUrl : (composedUrl ?? cutoutUrl);

  async function handleDownload() {
    if (!displayUrl) return;
    try {
      const blob = await fetch(displayUrl).then((r) => r.blob());
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      const ext = bgKind === "transparent" ? "png" : "jpg";
      a.download = `freigestellt-${bgKind}-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setErrorMsg("Download fehlgeschlagen.");
    }
  }

  async function handleSaveToLibrary() {
    if (!cutoutUrl || saving || savedToLibrary) return;
    setSaving(true);
    try {
      // For composed images we need to upload the local blob first.
      // For transparent we can pass the remote URL straight through —
      // sharp on the server will keep alpha.
      let remoteUrl = cutoutUrl;
      let title = `Freigestellt · ${BG_PRECISION_OPTIONS.find((p) => p.id === precision)?.label}`;

      if (bgKind !== "transparent" && composedUrl?.startsWith("blob:")) {
        // Upload composed JPG via /api/upload first, then ingest into library.
        const blob = await fetch(composedUrl).then((r) => r.blob());
        const fd = new FormData();
        fd.append("file", new File([blob], `composed-${Date.now()}.jpg`, { type: "image/jpeg" }));
        const upRes = await fetch("/api/upload", { method: "POST", body: fd });
        if (!upRes.ok) throw new Error("Upload fehlgeschlagen");
        const upData = await upRes.json();
        remoteUrl = upData.url;
        title = `Mit Hintergrund · ${bgKind === "color" ? "Farbe" : bgKind === "gradient" ? "Gradient" : "Bild"}`;
      }

      const r = await fetch("/api/library/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "image-url",
          source: "bg-remover",
          remoteUrl,
          keepAlpha: bgKind === "transparent",
          title,
          basename: "cutout",
          meta: {
            precision,
            background: bgKind,
            ...(bgKind === "color" ? { color: bgColor } : {}),
            ...(bgKind === "gradient" ? { gradient: bgGradient } : {}),
          },
        }),
      });
      if (r.ok) setSavedToLibrary(true);
    } catch (err) {
      console.error("[BgRemover] save-to-library failed:", err);
    } finally {
      setSaving(false);
    }
  }

  const elapsedSec = (elapsed / 1000).toFixed(1);
  const isWorking = stage === "preparing" || stage === "processing";

  return (
    <div className="font-sf w-full">
      {(stage === "idle" || stage === "done") && (
        <PrecisionToggle value={precision} onChange={setPrecision} disabled={isWorking} />
      )}

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
            className={`relative aspect-[4/3] sm:aspect-[16/10] rounded-3xl sm:rounded-[28px] flex flex-col items-center justify-center text-center px-5 sm:px-8 py-10 sm:py-12 transition-all duration-300 ${insufficientCredits ? "cursor-not-allowed" : "cursor-pointer"}`}
            style={{
              background: dragActive ? "rgba(149, 191, 71, 0.06)" : "rgba(255, 255, 255, 0.03)",
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
              className="w-14 sm:w-16 h-14 sm:h-16 rounded-2xl flex items-center justify-center mb-4 sm:mb-6"
              style={{
                background: `linear-gradient(135deg, ${ACCENT}25, ${ACCENT}10)`,
                border: `1px solid ${ACCENT}30`,
              }}
            >
              <ScissorsIcon color={ACCENT} />
            </div>

            <h3
              className="text-[19px] sm:text-[22px] font-semibold tracking-tight text-white"
              style={{ letterSpacing: "-0.022em" }}
            >
              Produkt freistellen
            </h3>
            <p className="text-[13px] sm:text-[14px] text-zinc-400 mt-1.5 sm:mt-2 max-w-sm leading-relaxed">
              Tippen oder Datei reinziehen
            </p>
            <p className="text-[11px] sm:text-[12px] text-zinc-600 mt-1">
              JPG · PNG · WebP · transparenter PNG-Output
            </p>

            <button
              type="button"
              disabled={insufficientCredits}
              onClick={(e) => {
                e.stopPropagation();
                if (!insufficientCredits) fileInputRef.current?.click();
              }}
              className="mt-6 sm:mt-8 px-6 h-11 rounded-full text-[14px] font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: ACCENT,
                color: "#0a1604",
                boxShadow: `0 8px 24px -8px ${ACCENT}80, inset 0 1px 0 rgba(255,255,255,0.25)`,
              }}
            >
              Datei wählen
            </button>

            <p className="absolute bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 text-[10px] sm:text-[11px] uppercase tracking-[0.14em] text-zinc-600 whitespace-nowrap">
              {CREDIT_COSTS.BG_REMOVE} Credits / Bild
            </p>

            {insufficientCredits && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-0 rounded-3xl sm:rounded-[28px] flex flex-col items-center justify-center text-center px-6"
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
                  Aktuell: {credits.balance.toLocaleString("de-DE")}.
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
          className="relative aspect-[4/3] sm:aspect-[16/10] rounded-3xl sm:rounded-[28px] flex flex-col items-center justify-center text-center px-6 sm:px-8 py-10 sm:py-12 overflow-hidden"
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
            <h3 className="mt-5 sm:mt-6 text-[18px] sm:text-[20px] font-semibold tracking-tight text-white">
              {stage === "preparing" ? "Bild wird vorbereitet…" : "Hintergrund wird entfernt"}
            </h3>
            <p className="mt-1.5 sm:mt-2 text-[12.5px] sm:text-[13px] text-zinc-400">
              {stage === "preparing"
                ? "Optimiere die Quelldatei…"
                : `${BG_PRECISION_OPTIONS.find((p) => p.id === precision)?.label}-Modus · ${elapsedSec}s`}
            </p>
            {stage === "processing" && (
              <p className="mt-1 text-[11px] text-zinc-500 max-w-xs">
                {precision === "fast"
                  ? "Schnell-Modus: meist unter 3 Sekunden."
                  : precision === "hair"
                    ? "Haar-Modus: 6–10 Sekunden für perfekte Härchen-Kanten."
                    : "Präzise-Modus: 5–10 Sekunden für feine Details."}
              </p>
            )}
          </div>
        </div>
      )}

      {stage === "done" && cutoutUrl && (
        <div className="space-y-4 sm:space-y-5">
          {/* Result preview */}
          <div
            className="relative w-full rounded-3xl sm:rounded-[24px] overflow-hidden"
            style={{
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 24px 60px -30px rgba(0,0,0,0.6)",
              background: bgKind === "transparent" ? "#fff" : "#000",
              backgroundImage: bgKind === "transparent"
                ? `
                    linear-gradient(45deg, #d4d4d8 25%, transparent 25%),
                    linear-gradient(-45deg, #d4d4d8 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #d4d4d8 75%),
                    linear-gradient(-45deg, transparent 75%, #d4d4d8 75%)
                  `
                : undefined,
              backgroundSize: bgKind === "transparent" ? "24px 24px" : undefined,
              backgroundPosition: bgKind === "transparent"
                ? "0 0, 0 12px, 12px -12px, -12px 0px"
                : undefined,
            }}
          >
            {composing && bgKind !== "transparent" && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <Spinner color={ACCENT} small={false} />
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayUrl ?? cutoutUrl}
              alt="Freigestelltes Produkt"
              crossOrigin="anonymous"
              className="block w-full h-auto"
            />
          </div>

          {/* Background replacement panel */}
          <BackgroundPanel
            kind={bgKind}
            onKind={setBgKind}
            color={bgColor}
            onColor={setBgColor}
            gradient={bgGradient}
            onGradient={setBgGradient}
            bgImageUrl={bgImageUrl}
            onBgImageRequest={() => bgUploadRef.current?.click()}
            onBgImageRemove={() => {
              if (bgImageUrl?.startsWith("blob:")) URL.revokeObjectURL(bgImageUrl);
              setBgImageUrl(null);
              setBgKind("transparent");
            }}
          />
          <input
            ref={bgUploadRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onBgImageSelect}
          />

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={handleDownload}
              className="flex-1 h-12 rounded-2xl text-[14px] sm:text-[15px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              style={{
                background: ACCENT,
                color: "#0a1604",
                boxShadow: `0 12px 28px -10px ${ACCENT}80, inset 0 1px 0 rgba(255,255,255,0.25)`,
              }}
            >
              <DownloadIcon />
              Download ({bgKind === "transparent" ? "PNG" : "JPG"})
            </button>
            <button
              onClick={handleSaveToLibrary}
              disabled={saving || savedToLibrary || composing}
              className="h-12 px-5 rounded-2xl text-[14px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-60"
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
              className="px-5 h-12 rounded-2xl text-[13px] sm:text-[14px] font-semibold text-zinc-300 transition-all active:scale-[0.99]"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              Neues Bild
            </button>
          </div>

          <p className="text-[11px] sm:text-[12px] text-zinc-500 text-center">
            Fertig in {elapsedSec}s · {bgKind === "transparent" ? "transparenter PNG" : "Hintergrund lokal komponiert (kostet 0 Credits)"}
          </p>
        </div>
      )}

      {stage === "error" && errorMsg && (
        <div
          className="rounded-3xl sm:rounded-[24px] p-5 sm:p-6 flex flex-col sm:flex-row items-start gap-3 sm:gap-4"
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
            className="text-[13px] px-4 h-10 sm:h-9 w-full sm:w-auto rounded-full font-medium text-red-200 transition-all active:scale-[0.97]"
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

// ─── Precision Toggle (3 columns now) ───────────────────────────

function PrecisionToggle({
  value,
  onChange,
  disabled,
}: {
  value: BgPrecision;
  onChange: (v: BgPrecision) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mb-5 sm:mb-6">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-zinc-500">
          Genauigkeit
        </span>
        <span className="text-[10.5px] text-zinc-600">
          gleicher Credit-Preis
        </span>
      </div>
      <div
        className="relative grid grid-cols-3 gap-1 p-1 rounded-2xl"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          opacity: disabled ? 0.55 : 1,
        }}
      >
        {BG_PRECISION_OPTIONS.map((opt) => {
          const active = opt.id === value;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.id)}
              className="relative rounded-xl py-2 px-2.5 text-left transition-all active:scale-[0.99] disabled:cursor-not-allowed"
              style={{
                background: active ? "rgba(149,191,71,0.12)" : "transparent",
                border: active ? `1px solid ${ACCENT}55` : "1px solid transparent",
                boxShadow: active
                  ? `0 8px 22px -10px ${ACCENT}50, inset 0 1px 0 rgba(255,255,255,0.04)`
                  : undefined,
              }}
            >
              <div className="flex items-center gap-2">
                {active ? (
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
                  />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                )}
                <span
                  className="text-[12px] sm:text-[13px] font-semibold tracking-tight"
                  style={{ color: active ? "#fff" : "#d4d4d8" }}
                >
                  {opt.label}
                </span>
              </div>
              <p className="text-[10px] sm:text-[10.5px] text-zinc-500 mt-1 leading-snug">
                {opt.hint}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Background panel ──────────────────────────────────────────

function BackgroundPanel({
  kind, onKind,
  color, onColor,
  gradient, onGradient,
  bgImageUrl, onBgImageRequest, onBgImageRemove,
}: {
  kind: BgKind;
  onKind: (k: BgKind) => void;
  color: string;
  onColor: (c: string) => void;
  gradient: string;
  onGradient: (g: string) => void;
  bgImageUrl: string | null;
  onBgImageRequest: () => void;
  onBgImageRemove: () => void;
}) {
  return (
    <div
      className="rounded-3xl sm:rounded-[24px] p-4 sm:p-5 space-y-3.5"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full" style={{ background: ACCENT }} />
          <h4 className="text-[12px] sm:text-[13px] font-semibold uppercase tracking-[0.14em] text-zinc-300">
            Hintergrund hinzufügen
          </h4>
        </div>
        <span className="text-[10px] text-zinc-600 hidden sm:inline">
          0 Credits · lokal
        </span>
      </div>

      {/* Kind tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        {([
          { id: "transparent", label: "Transparent" },
          { id: "color", label: "Farbe" },
          { id: "gradient", label: "Gradient" },
          { id: "image", label: "Bild" },
        ] as { id: BgKind; label: string }[]).map((t) => {
          const active = t.id === kind;
          return (
            <button
              key={t.id}
              onClick={() => {
                if (t.id === "image" && !bgImageUrl) {
                  onBgImageRequest();
                  return;
                }
                onKind(t.id);
              }}
              className="px-2 py-1.5 rounded-lg text-[11px] sm:text-[12px] font-semibold transition"
              style={{
                background: active ? "rgba(149,191,71,0.15)" : "transparent",
                border: active ? `1px solid ${ACCENT}40` : "1px solid transparent",
                color: active ? ACCENT : "rgba(255,255,255,0.65)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Per-kind controls */}
      {kind === "color" && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
            {COLOR_PRESETS.map((c) => {
              const active = c.hex === color;
              return (
                <button
                  key={c.id}
                  onClick={() => onColor(c.hex)}
                  className="aspect-square rounded-lg border transition-all"
                  style={{
                    background: c.hex,
                    borderColor: active ? "#fff" : "rgba(255,255,255,0.10)",
                    boxShadow: active ? `0 0 0 2px ${ACCENT}55` : undefined,
                  }}
                  title={c.label}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => onColor(e.target.value)}
              className="w-9 h-9 rounded-md bg-transparent border border-white/10 cursor-pointer"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => onColor(e.target.value)}
              className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-xs font-mono outline-none focus:border-white/25 transition"
              maxLength={7}
            />
          </div>
        </div>
      )}

      {kind === "gradient" && (
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
          {GRADIENT_PRESETS.map((g) => {
            const active = g.id === gradient;
            return (
              <button
                key={g.id}
                onClick={() => onGradient(g.id)}
                className="aspect-square rounded-lg border transition-all"
                style={{
                  background: g.css,
                  borderColor: active ? "#fff" : "rgba(255,255,255,0.10)",
                  boxShadow: active ? `0 0 0 2px ${ACCENT}55` : undefined,
                }}
                title={g.label}
              />
            );
          })}
        </div>
      )}

      {kind === "image" && (
        <div className="space-y-2">
          {bgImageUrl ? (
            <div className="flex gap-2 items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bgImageUrl}
                alt="Hintergrund"
                className="w-16 h-16 object-cover rounded-lg border border-white/10"
              />
              <div className="flex-1 text-[11px] text-zinc-400">
                Eigenes Hintergrund-Bild geladen.
              </div>
              <button
                onClick={onBgImageRemove}
                className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-300 hover:bg-white/[0.08] transition"
              >
                Entfernen
              </button>
              <button
                onClick={onBgImageRequest}
                className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-300 hover:bg-white/[0.08] transition"
              >
                Tauschen
              </button>
            </div>
          ) : (
            <button
              onClick={onBgImageRequest}
              className="w-full py-3 rounded-xl border border-dashed border-white/15 text-zinc-400 hover:text-white hover:bg-white/[0.04] transition text-xs flex items-center justify-center gap-2"
            >
              <UploadSmallIcon /> Eigenes Hintergrund-Bild hochladen
            </button>
          )}
        </div>
      )}

      {kind === "transparent" && (
        <p className="text-[10.5px] text-zinc-500 leading-snug">
          PNG mit Transparenz — perfekt zum Einfügen in Listings, Banner oder Mockups.
        </p>
      )}
    </div>
  );
}

// ─── Compose function (canvas, client-side) ─────────────────────

interface ComposeOpts {
  kind: BgKind;
  color: string;
  gradient: string;
  imageUrl: string | null;
}

async function composeOnBackground(cutoutUrl: string, opts: ComposeOpts): Promise<string> {
  const cutoutImg = await loadImage(cutoutUrl);
  const w = cutoutImg.naturalWidth;
  const h = cutoutImg.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar.");

  // Background
  if (opts.kind === "color") {
    ctx.fillStyle = opts.color;
    ctx.fillRect(0, 0, w, h);
  } else if (opts.kind === "gradient") {
    const preset = GRADIENT_PRESETS.find((g) => g.id === opts.gradient) || GRADIENT_PRESETS[0];
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    const stops = preset.canvas;
    stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  } else if (opts.kind === "image" && opts.imageUrl) {
    const bgImg = await loadImage(opts.imageUrl);
    // Cover-fit the background
    const ar = bgImg.naturalWidth / bgImg.naturalHeight;
    const targetAr = w / h;
    let sx = 0, sy = 0, sw = bgImg.naturalWidth, sh = bgImg.naturalHeight;
    if (ar > targetAr) {
      // bg wider than canvas — crop horizontally
      sw = bgImg.naturalHeight * targetAr;
      sx = (bgImg.naturalWidth - sw) / 2;
    } else {
      sh = bgImg.naturalWidth / targetAr;
      sy = (bgImg.naturalHeight - sh) / 2;
    }
    ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, w, h);
  } else {
    // transparent — leave as-is
  }

  // Cutout on top
  ctx.drawImage(cutoutImg, 0, 0);

  // Export — use JPG for opaque, PNG for transparent
  const mime = opts.kind === "transparent" ? "image/png" : "image/jpeg";
  const quality = opts.kind === "transparent" ? undefined : 0.92;
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Compose-Encode fehlgeschlagen."))),
      mime,
      quality,
    ),
  );
  return URL.createObjectURL(blob);
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

function UploadSmallIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
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

function Spinner({ color, small = false }: { color: string; small?: boolean }) {
  const size = small ? 18 : 48;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{ border: `2px solid ${color}25` }}
      />
      <div
        className="absolute inset-0 rounded-full animate-spin"
        style={{
          border: `2px solid transparent`,
          borderTopColor: color,
          animationDuration: "0.8s",
        }}
      />
    </div>
  );
}
