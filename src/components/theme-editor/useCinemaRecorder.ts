"use client";

// ─── Kino-Modus: Aufnahme der Handy-Ansicht als Video ──────────────────────
// Nimmt NUR das Handy-Element auf (Bühne, Bluescreen und Steuerleiste sind
// nicht im Video) und speichert es als Datei.
//
// Pipeline (bewusst so robust gebaut):
//  1. Tab-Aufnahme per getDisplayMedia (preferCurrentTab → Chrome fragt nur
//     „Diesen Tab teilen?"), zugeschnitten aufs Handy: Region Capture
//     (cropTo, seit Chrome 104 stabil), Element Capture (restrictTo) nur als
//     Ersatz — Element Capture liefert bei nicht „geeigneten" Elementen
//     kommentarlos KEINE Bilder.
//  2. Die zugeschnittenen Bilder laufen NICHT direkt in den Encoder, sondern
//     werden im festen 60-Hz-Takt auf eine Leinwand FESTER Größe
//     gezeichnet (HD: 1080×1920). Grund: Die Tab-Aufnahme ändert ihre
//     Bildgröße (Zuschnitt greift, Chrome skaliert hoch) und liefert bei
//     ruhender Seite kaum Bilder — beides lässt MP4/H.264-Aufnahmen in Chrome
//     scheitern. Die Leinwand liefert konstante Größe + konstante 60 fps.
//  3. MediaRecorder mit MIME-Kette MP4 → WebM: scheitert ein Format beim
//     Start, wird automatisch das nächste genommen.
// Jeder Fehler trägt Stufe + technischen Grund (Diagnose ohne Rätselraten).

import { useCallback, useEffect, useRef, useState } from "react";

export type RecState = "idle" | "starting" | "recording" | "saving";
export type RecOutput = "hd" | "view";

export interface RecResult {
  fileName: string;
  width: number;
  height: number;
  seconds: number;
  bytes: number;
}

export type RecError = "unsupported" | "wrongSurface" | "noFrames" | "failed";

type CaptureTarget = object;
interface CaptureTargetFactory {
  fromElement(el: Element): Promise<CaptureTarget>;
}
type ZoomableTrack = MediaStreamTrack & {
  restrictTo?: (t: CaptureTarget | null) => Promise<void>;
  cropTo?: (t: CaptureTarget | null) => Promise<void>;
};

// Reihenfolge = Präferenz. MP4/H.264 öffnet jedes Schnittprogramm direkt.
const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.640033",
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

const HD_W = 1080;
const HD_H = 1920;
const FPS = 60;

function supportedMimes(): string[] {
  if (typeof MediaRecorder === "undefined") return [];
  return MIME_CANDIDATES.filter((m) => {
    try { return MediaRecorder.isTypeSupported(m); } catch { return false; }
  });
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

function captureFactory(name: "RestrictionTarget" | "CropTarget"): CaptureTargetFactory | undefined {
  return (window as unknown as Record<string, CaptureTargetFactory | undefined>)[name];
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

function describe(e: unknown): string {
  if (e instanceof DOMException || e instanceof Error) return `${e.name}: ${e.message}`.slice(0, 160);
  return String(e).slice(0, 160);
}

export function recorderSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    !!navigator.mediaDevices?.getDisplayMedia &&
    typeof MediaRecorder !== "undefined" &&
    !!(captureFactory("CropTarget") || captureFactory("RestrictionTarget")) &&
    supportedMimes().length > 0 &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

/** Echte Maße + Länge aus der fertigen Datei lesen (für die Erfolgsmeldung). */
function probe(blob: Blob): Promise<{ width: number; height: number; seconds: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    let settled = false;
    const done = (width: number, height: number, seconds: number) => {
      if (settled) return;
      settled = true;
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

/** Wartet, bis das Video wirklich Bilder zeigt (Maße bekannt). */
function waitForFrames(video: HTMLVideoElement, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (video.videoWidth > 0) return resolve(true);
    const t = setTimeout(() => { cleanup(); resolve(video.videoWidth > 0); }, ms);
    const ok = () => { if (video.videoWidth > 0) { cleanup(); resolve(true); } };
    const cleanup = () => {
      clearTimeout(t);
      video.removeEventListener("loadedmetadata", ok);
      video.removeEventListener("resize", ok);
      video.removeEventListener("playing", ok);
    };
    video.addEventListener("loadedmetadata", ok);
    video.addEventListener("resize", ok);
    video.addEventListener("playing", ok);
  });
}

/** Startet einen MediaRecorder; scheitert ein Format sofort (Konstruktor,
 *  start() oder Fehler vor dem ersten Datenpaket), wird das nächste versucht. */
async function startRecorder(
  stream: MediaStream,
  mimes: string[],
  onData: (b: Blob) => void,
): Promise<{ rec: MediaRecorder; mime: string } | { error: string }> {
  let lastErr = "kein Format verfügbar";
  for (const mime of mimes) {
    let rec: MediaRecorder;
    try {
      // Hohe Bitrate: UI-Text und feine Linien bleiben auch nach dem
      // erneuten Komprimieren durch TikTok/Reels gestochen scharf.
      rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 20_000_000 });
    } catch (e) {
      lastErr = `${mime} → ${describe(e)}`;
      continue;
    }
    const outcome = await new Promise<"ok" | string>((resolve) => {
      let finished = false;
      const finish = (v: "ok" | string) => { if (!finished) { finished = true; resolve(v); } };
      rec.onerror = (ev) => finish(`${mime} → ${describe((ev as unknown as { error?: unknown }).error ?? "Encoder-Fehler")}`);
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) { onData(e.data); finish("ok"); }
      };
      try {
        rec.start(250);
      } catch (e) {
        finish(`${mime} → ${describe(e)}`);
        return;
      }
      // Kommt nach 2,5 s kein Fehler, läuft der Encoder — auch falls das
      // erste Paket noch auf sich warten lässt.
      setTimeout(() => finish("ok"), 2500);
    });
    if (outcome === "ok") {
      rec.ondataavailable = (e) => { if (e.data && e.data.size) onData(e.data); };
      return { rec, mime };
    }
    lastErr = outcome;
    // Gescheiterten Versuch still beenden — sein letztes Datenpaket darf nicht
    // in die Aufnahme des nächsten Formats rutschen.
    rec.ondataavailable = null;
    rec.onerror = null;
    try { if (rec.state !== "inactive") rec.stop(); } catch { /* egal */ }
  }
  return { error: lastErr };
}

export function useCinemaRecorder(getTarget: () => HTMLElement | null) {
  const [state, setState] = useState<RecState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<RecError | null>(null);
  const [errorDetail, setErrorDetail] = useState("");
  const [result, setResult] = useState<RecResult | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const drawTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const stateRef = useRef<RecState>("idle");
  const restoreRef = useRef<(() => void) | undefined>(undefined);
  const setBoth = (s: RecState) => {
    stateRef.current = s;
    setState(s);
  };

  const teardown = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    if (drawTimerRef.current) clearInterval(drawTimerRef.current);
    drawTimerRef.current = null;
    canvasStreamRef.current?.getTracks().forEach((t) => t.stop());
    canvasStreamRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.srcObject = null;
      v.remove();
    }
    videoRef.current = null;
  };

  const fail = (kind: RecError, detail: string) => {
    teardown();
    recRef.current = null;
    setBoth("idle");
    setError(kind);
    setErrorDetail(detail);
    restoreRef.current?.();
  };

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") {
      setBoth("saving");
      rec.stop();
    }
  }, []);

  /** onLayout: vor dem Start das Aufnahme-Layout setzen (die Vorschau
   *  skaliert per Layout-Effekt nach); onRestore: danach zurückstellen. */
  const start = useCallback(async (opts: { output: RecOutput; onLayout?: () => void; onRestore?: () => void }) => {
    if (stateRef.current !== "idle") return;
    setError(null);
    setErrorDetail("");
    setResult(null);
    restoreRef.current = opts.onRestore;
    if (!recorderSupported()) {
      setError("unsupported");
      return;
    }
    setBoth("starting");
    opts.onLayout?.();
    await new Promise((r) => setTimeout(r, 250));

    // 1) Tab-Aufnahme anfordern (hohe Wunsch-Auflösung → Chrome rendert den
    //    Tab für die Aufnahme mit höherer Pixeldichte, wo es das kann).
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
          frameRate: { ideal: FPS, max: FPS },
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
      restoreRef.current?.();
      return;
    }
    streamRef.current = stream;
    const track = stream.getVideoTracks()[0] as ZoomableTrack | undefined;
    const target = getTarget();
    if (!track || !target) return fail("failed", "Kein Videobild bzw. Handy-Element gefunden.");

    // 2) Aufs Handy zuschneiden: Region Capture zuerst (keine Eignungs-
    //    Bedingungen), Element Capture als Ersatz.
    let zoomed = false;
    let zoomErr = "";
    const crop = captureFactory("CropTarget");
    if (crop && track.cropTo) {
      try {
        await track.cropTo(await crop.fromElement(target));
        zoomed = true;
      } catch (e) {
        zoomErr = `cropTo → ${describe(e)}`;
      }
    }
    const restrict = captureFactory("RestrictionTarget");
    if (!zoomed && restrict && track.restrictTo) {
      try {
        await track.restrictTo(await restrict.fromElement(target));
        zoomed = true;
      } catch (e) {
        zoomErr += `${zoomErr ? " · " : ""}restrictTo → ${describe(e)}`;
      }
    }
    if (!zoomed) return fail("wrongSurface", zoomErr);

    // 3) Zugeschnittene Bilder in ein unsichtbares Video leiten.
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("aria-hidden", "true");
    video.style.cssText = "position:fixed;left:-99999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none";
    document.body.appendChild(video);
    videoRef.current = video;
    video.srcObject = stream;
    // NICHT auf play() warten: kommt nie ein Bild, bleibt dieses Promise für
    // immer offen — der Recorder hinge sonst in „Startet …" fest (und der
    // Kino-Modus ließe sich nicht mehr verlassen). Die Bild-Prüfung unten
    // hat ein festes Zeitlimit.
    let playErr = "";
    video.play().catch((e) => { playErr = describe(e); });
    // Die erste Aufnahme-Vorlage kommt u. U. erst nach dem Zuschnitt — bis
    // zu 4 s warten (bei ruhender Seite erzwingt ein Mini-Scroll ein Bild).
    target.scrollBy({ top: 1 });
    target.scrollBy({ top: -1 });
    if (!(await waitForFrames(video, 4000))) {
      return fail("noFrames", `Chrome hat innerhalb von 4 s kein Bild der Handy-Ansicht geliefert.${playErr ? ` (${playErr})` : ""}`);
    }

    // 4) Leinwand FESTER Größe: HD = 1080×1920; „Wie angezeigt" = aktuelle
    //    Handy-Spalte in echten Bildschirm-Pixeln (gerade Zahlen für H.264).
    const rect = target.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const outW = opts.output === "hd" ? HD_W : even(Math.min(rect.width * dpr, 2160));
    const outH = opts.output === "hd" ? HD_H : even(Math.min(rect.height * dpr, 3840));
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return fail("failed", "Canvas-Kontext nicht verfügbar.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const draw = () => {
      const vw = video.videoWidth, vh = video.videoHeight;
      if (vw && vh) {
        // Cover-Fit: Seitenverhältnis exakt halten, Ränder minimal kappen.
        const scale = Math.max(outW / vw, outH / vh);
        const sw = outW / scale, sh = outH / scale;
        ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, outW, outH);
      }
    };
    // Fester 60-Hz-Takt statt requestAnimationFrame: rAF pausiert, sobald
    // das Fenster verdeckt ist (z. B. OBS davor) — das Video würde stocken.
    draw();
    drawTimerRef.current = setInterval(draw, 1000 / FPS);
    const canvasStream = canvas.captureStream(FPS);
    canvasStreamRef.current = canvasStream;

    // 5) Encoder starten (MP4 → WebM-Kette). Uhr läuft ab hier — der
    //    Encoder schreibt schon während der Format-Prüfung mit.
    chunksRef.current = [];
    startedAtRef.current = Date.now();
    setElapsed(0);
    const started = await startRecorder(canvasStream, supportedMimes(), (b) => chunksRef.current.push(b));
    if ("error" in started) return fail("failed", started.error);
    const { rec, mime } = started;

    rec.onerror = (ev) => {
      setErrorDetail(`${mime} → ${describe((ev as unknown as { error?: unknown }).error ?? "Encoder-Fehler")}`);
      setError("failed");
      if (rec.state !== "inactive") rec.stop();
    };
    rec.onstop = async () => {
      const seconds = (Date.now() - startedAtRef.current) / 1000;
      teardown();
      recRef.current = null;
      const type = mime.split(";")[0] || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      restoreRef.current?.();
      if (!blob.size) {
        setBoth("idle");
        setError("failed");
        setErrorDetail("Die Aufnahme enthielt keine Daten.");
        return;
      }
      const fileName = `brospify-handy_${stamp()}.${type.includes("mp4") ? "mp4" : "webm"}`;
      download(blob, fileName);
      const meta = await probe(blob);
      setResult({ fileName, width: meta.width || outW, height: meta.height || outH, seconds: meta.seconds || seconds, bytes: blob.size });
      setBoth("idle");
    };
    // Nutzer beendet die Freigabe über Chromes Leiste → sauber speichern.
    track.addEventListener("ended", () => stop());

    recRef.current = rec;
    tickRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 250);
    setBoth("recording");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getTarget, stop]);

  // Editor verlassen während der Aufnahme → nichts verlieren: speichern.
  useEffect(() => () => {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    else teardown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearNotice = useCallback(() => {
    setError(null);
    setErrorDetail("");
    setResult(null);
  }, []);

  return { state, elapsed, error, errorDetail, result, start, stop, clearNotice };
}
