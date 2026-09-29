"use client";

// ─── Kino-Modus: Aufnahme der Handy-Ansicht als Video ──────────────────────
// Nimmt NUR das Handy-Element auf (Bühne, Bluescreen und Steuerleiste sind
// nicht im Video) und speichert es als Datei. Weg: Tab-Aufnahme per
// getDisplayMedia (preferCurrentTab → Chrome fragt nur „Diesen Tab teilen?")
// + Zuschnitt auf das Element — bevorzugt Element Capture (restrictTo: nur
// das Element, nichts Darüberliegendes), sonst Region Capture (cropTo).
// Es wird eine sehr hohe Auflösung angefordert: Chrome rendert den Tab dann
// während der Aufnahme mit höherer Pixeldichte, statt Bildschirm-Pixel
// hochzurechnen. Chrome/Edge am Desktop; andere Browser bekommen eine klare
// Meldung statt eines halben Videos.

import { useCallback, useEffect, useRef, useState } from "react";

export type RecState = "idle" | "starting" | "recording" | "saving";

export interface RecResult {
  fileName: string;
  width: number;
  height: number;
  seconds: number;
  bytes: number;
}

export type RecError = "unsupported" | "wrongSurface" | "failed";

type CaptureTarget = object;
interface CaptureTargetFactory {
  fromElement(el: Element): Promise<CaptureTarget>;
}
type ZoomableTrack = MediaStreamTrack & {
  restrictTo?: (t: CaptureTarget | null) => Promise<void>;
  cropTo?: (t: CaptureTarget | null) => Promise<void>;
};

// Reihenfolge = Präferenz. MP4/H.264 öffnet jedes Schnittprogramm direkt;
// WebM nur, wo der Browser kein MP4 aufnehmen kann.
const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.640033",
  "video/mp4;codecs=avc1.4d0033",
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) || "";
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

function captureFactory(name: "RestrictionTarget" | "CropTarget"): CaptureTargetFactory | undefined {
  return (window as unknown as Record<string, CaptureTargetFactory | undefined>)[name];
}

export function recorderSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    !!navigator.mediaDevices?.getDisplayMedia &&
    typeof MediaRecorder !== "undefined" &&
    !!(captureFactory("RestrictionTarget") || captureFactory("CropTarget")) &&
    !!pickMime()
  );
}

/** Echte Maße + Länge aus der fertigen Datei lesen (für die Erfolgsmeldung). */
function probe(blob: Blob): Promise<{ width: number; height: number; seconds: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const done = (width: number, height: number, seconds: number) => {
      URL.revokeObjectURL(url);
      resolve({ width, height, seconds });
    };
    v.onloadedmetadata = () => done(v.videoWidth, v.videoHeight, Number.isFinite(v.duration) ? v.duration : 0);
    v.onerror = () => done(0, 0, 0);
    setTimeout(() => done(v.videoWidth || 0, v.videoHeight || 0, 0), 4000);
    v.src = url;
  });
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Erst später freigeben — der Download-Start ist asynchron.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function useCinemaRecorder(getTarget: () => HTMLElement | null) {
  const [state, setState] = useState<RecState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<RecError | null>(null);
  const [result, setResult] = useState<RecResult | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const stateRef = useRef<RecState>("idle");
  const setBoth = (s: RecState) => {
    stateRef.current = s;
    setState(s);
  };

  const cleanupStream = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") {
      setBoth("saving");
      rec.stop();
    }
  }, []);

  /** onLayout: vor dem Start das Aufnahme-Layout setzen und warten, bis es
   *  steht (die Vorschau skaliert per Layout-Effekt/ResizeObserver nach). */
  const start = useCallback(async (onLayout?: () => void, onRestore?: () => void) => {
    if (stateRef.current !== "idle") return;
    setError(null);
    setResult(null);
    if (!recorderSupported()) {
      setError("unsupported");
      return;
    }
    setBoth("starting");
    onLayout?.();
    await new Promise((r) => setTimeout(r, 250));

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
          frameRate: { ideal: 60, max: 60 },
          width: { ideal: 3840 },
          height: { ideal: 2160 },
        },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: "include",
        surfaceSwitching: "exclude",
        systemAudio: "exclude",
        monitorTypeSurfaces: "exclude",
      } as DisplayMediaStreamOptions);
    } catch {
      // Abgebrochen im Freigabe-Dialog → still zurück, kein Fehler.
      setBoth("idle");
      onRestore?.();
      return;
    }
    streamRef.current = stream;
    const track = stream.getVideoTracks()[0] as ZoomableTrack | undefined;
    const target = getTarget();

    // Nur das Handy: erst Element Capture, dann Region Capture. Klappt beides
    // nicht, wurde ein anderer Tab/Bildschirm gewählt.
    let zoomed = false;
    if (track && target) {
      const restrict = captureFactory("RestrictionTarget");
      if (restrict && track.restrictTo) {
        try {
          await track.restrictTo(await restrict.fromElement(target));
          zoomed = true;
        } catch {
          /* Element erfüllt die Voraussetzungen nicht → Zuschnitt probieren */
        }
      }
      const crop = captureFactory("CropTarget");
      if (!zoomed && crop && track.cropTo) {
        try {
          await track.cropTo(await crop.fromElement(target));
          zoomed = true;
        } catch {
          /* anderer Tab gewählt */
        }
      }
    }
    if (!zoomed) {
      cleanupStream();
      setBoth("idle");
      setError("wrongSurface");
      onRestore?.();
      return;
    }

    const mimeType = pickMime();
    let rec: MediaRecorder;
    try {
      // Hohe Bitrate: UI-Text und feine Linien bleiben auch nach dem
      // Hochladen (TikTok/Reels komprimieren nochmal) gestochen scharf.
      rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 20_000_000 });
    } catch {
      cleanupStream();
      setBoth("idle");
      setError("failed");
      onRestore?.();
      return;
    }
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunksRef.current.push(e.data);
    };
    rec.onstop = async () => {
      const seconds = (Date.now() - startedAtRef.current) / 1000;
      cleanupStream();
      recRef.current = null;
      const type = mimeType.split(";")[0] || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      onRestore?.();
      if (!blob.size) {
        setBoth("idle");
        setError("failed");
        return;
      }
      const fileName = `brospify-handy_${stamp()}.${type.includes("mp4") ? "mp4" : "webm"}`;
      download(blob, fileName);
      const meta = await probe(blob);
      setResult({ fileName, width: meta.width, height: meta.height, seconds: meta.seconds || seconds, bytes: blob.size });
      setBoth("idle");
    };
    rec.onerror = () => {
      if (rec.state !== "inactive") rec.stop();
      setError("failed");
    };
    // Nutzer beendet die Freigabe über Chromes Leiste → sauber speichern.
    track?.addEventListener("ended", () => stop());

    recRef.current = rec;
    startedAtRef.current = Date.now();
    setElapsed(0);
    tickRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 250);
    rec.start(1000);
    setBoth("recording");
  }, [getTarget, stop]);

  // Editor verlassen während der Aufnahme → nichts verlieren: speichern.
  useEffect(() => () => {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    else streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const clearNotice = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  return { state, elapsed, error, result, start, stop, clearNotice };
}
