"use client";

// ─── Kino-Modus: Aufnahme als Video (Handy + Texteingabe) ─────────────────
// Nimmt pro Start MEHRERE Bereiche gleichzeitig als getrennte Videos auf
// (Handy-Ansicht und AI-Texteingabe) und speichert beide automatisch.
//
// Pipeline (bewusst so robust gebaut):
//  1. EINE Tab-Aufnahme per getDisplayMedia (preferCurrentTab → Chrome fragt
//     nur „Diesen Tab teilen?"), OHNE Region Capture (cropTo): Chrome wendet
//     einen Zuschnitt auf die ganze Quelle an (zwei Bereiche gehen damit eh
//     nicht), und direkt nach dem ersten cropTo einer Seite lieferte Chrome
//     154 im Test überhaupt KEIN Bild mehr („kein Bild geliefert"). Die
//     Bereiche schneiden wir selbst aus dem ganzen Tab aus (Elementrechteck
//     in CSS-px × Bildpunkte pro CSS-px).
//     Schärfe vs. Stabilität: Chromes HiDPI-Tab-Aufnahme rendert den GANZEN
//     Tab für eine hohe Wunsch-Auflösung mit bis zu 2× Pixeldichte. Auf
//     schwacher Grafik (Intel UHD 620) kam das Neuzeichnen beim Scrollen
//     nicht mehr hinterher → weiße, leere Flächen im Video. Deshalb wird
//     gezielt 1,5× angefordert (Tab-Größe × Pixeldichte × 1,5).
//  2. Pro Bereich eine Leinwand FESTER Größe (HD: Handy 1080×1920, Eingabe
//     1920×1080), gezeichnet im festen 60-Hz-Takt. Grund: Die Tab-Aufnahme
//     ändert ihre Bildgröße (HiDPI greift nach dem Start) und liefert bei
//     ruhender Seite kaum Bilder — beides lässt MP4/H.264 in Chrome
//     scheitern. Die Leinwände liefern konstante Größe + konstante 60 fps.
//  3. Alle Encoder starten im SELBEN Moment (Videos laufen synchron) mit
//     MIME-Kette MP4 → WebM: scheitert ein Format, versuchen alle das nächste.
//  4. BILD ↔ LAYOUT SYNCHRON HALTEN: Chrome blendet nach der Freigabe die
//     Leiste „Dieser Tab wird geteilt" ein (Fenster wird niedriger → das
//     Layout springt) und liefert bei ruhender Seite noch sekundenlang das
//     ALTE Bild. Würde mit den neuen Rechtecken ausgeschnitten, entstünde
//     ein verrutschter, vergrößerter Handy-Ausschnitt. Deshalb: Aufnahme-
//     Layout erst NACH der Freigabe setzen und warten, bis es steht; ein
//     Bild wird nur gezeichnet, wenn sein Seitenverhältnis zum aktuellen
//     Rahmen passt (sonst bleibt das letzte richtige Bild stehen), und ein
//     unsichtbarer Pixel erzwingt ein frisches Bild.
// Jeder Fehler trägt Stufe + technischen Grund (Diagnose ohne Rätselraten).

import { useCallback, useEffect, useRef, useState } from "react";

export type RecState = "idle" | "starting" | "recording" | "saving";

/** Ein aufzunehmender Bereich. */
export interface RecTarget {
  /** Datei-Präfix, z. B. "brospify-handy". */
  name: string;
  /** Element, dessen Bildschirmbereich aufgenommen wird (bei jedem Bild neu vermessen). */
  el: () => HTMLElement | null;
  /** Ausgabegröße in Pixeln (wird auf gerade Zahlen gerundet). */
  size: (rect: DOMRect, dpr: number) => { w: number; h: number };
  /** Bitrate in bit/s. */
  bitrate: number;
  /** Bilder pro Sekunde (60 oder 30 — 30 halbiert die Last, reicht fürs Tippen). */
  fps?: 60 | 30;
  /** Pflicht-Bereich: fehlt das Element, scheitert der Start. Sonst übersprungen. */
  required?: boolean;
}

export interface RecResult {
  name: string;
  fileName: string;
  width: number;
  height: number;
  seconds: number;
  bytes: number;
}

export type RecError = "unsupported" | "wrongSurface" | "noFrames" | "failed";


// Reihenfolge = Präferenz. MP4/H.264 öffnet jedes Schnittprogramm direkt.
const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.640033",
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

const FPS = 60;
/** Aufnahme-Pixeldichte relativ zum Bildschirm (Chrome: 1–2, in ¼-Schritten). */
const CAPTURE_BOOST = 1.5;

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

/** Wartet, bis sich die Fenstergröße nicht mehr ändert (Chromes Freigabe-
 *  Leiste erscheint erst nach dem Dialog) und React neu gelayoutet hat. */
async function settleLayout(maxMs = 1800): Promise<void> {
  const t0 = performance.now();
  let last = `${window.innerWidth}x${window.innerHeight}`;
  let stableSince = performance.now();
  while (performance.now() - t0 < maxMs) {
    await new Promise((r) => setTimeout(r, 50));
    const now = `${window.innerWidth}x${window.innerHeight}`;
    if (now !== last) {
      last = now;
      stableSince = performance.now();
    } else if (performance.now() - stableSince >= 350) break;
  }
  await new Promise((r) => setTimeout(r, 120));
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

/** Startet für JEDEN Stream einen MediaRecorder — alle im selben Moment,
 *  damit die Videos synchron laufen. Scheitert ein Format bei irgendeinem
 *  Stream sofort (Konstruktor, start() oder Fehler vor dem ersten
 *  Datenpaket), versuchen ALLE das nächste Format. */
async function startRecorders(
  streams: { stream: MediaStream; bitrate: number }[],
  mimes: string[],
  onData: (i: number, b: Blob) => void,
): Promise<{ recs: MediaRecorder[]; mime: string } | { error: string }> {
  let lastErr = "kein Format verfügbar";
  for (const mime of mimes) {
    const recs: MediaRecorder[] = [];
    let ctorErr = "";
    for (const { stream, bitrate } of streams) {
      try {
        // Hohe Bitrate: UI-Text und feine Linien bleiben auch nach dem
        // erneuten Komprimieren durch TikTok/Reels gestochen scharf.
        recs.push(new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate }));
      } catch (e) {
        ctorErr = `${mime} → ${describe(e)}`;
        break;
      }
    }
    if (ctorErr) {
      lastErr = ctorErr;
      continue;
    }
    const outcomes = await Promise.all(recs.map((rec, i) => new Promise<"ok" | string>((resolve) => {
      let finished = false;
      const finish = (v: "ok" | string) => { if (!finished) { finished = true; resolve(v); } };
      rec.onerror = (ev) => finish(`${mime} → ${describe((ev as unknown as { error?: unknown }).error ?? "Encoder-Fehler")}`);
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) { onData(i, e.data); finish("ok"); }
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
    })));
    const bad = outcomes.find((o) => o !== "ok");
    if (!bad) {
      recs.forEach((rec, i) => { rec.ondataavailable = (e) => { if (e.data && e.data.size) onData(i, e.data); }; });
      return { recs, mime };
    }
    lastErr = bad;
    // Gescheiterten Versuch still beenden — seine letzten Datenpakete dürfen
    // nicht in die Aufnahme des nächsten Formats rutschen.
    for (const rec of recs) {
      rec.ondataavailable = null;
      rec.onerror = null;
      try { if (rec.state !== "inactive") rec.stop(); } catch { /* egal */ }
    }
  }
  return { error: lastErr };
}

interface Lane {
  target: RecTarget;
  el: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  stream: MediaStream;
  chunks: Blob[];
  outW: number;
  outH: number;
  /** Nur jeden n-ten Takt zeichnen (30 fps → 2). */
  every: number;
}

export function useCinemaRecorder() {
  const [state, setState] = useState<RecState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<RecError | null>(null);
  const [errorDetail, setErrorDetail] = useState("");
  const [results, setResults] = useState<RecResult[]>([]);

  const streamRef = useRef<MediaStream | null>(null);
  const lanesRef = useRef<Lane[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const drawTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recsRef = useRef<MediaRecorder[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const stateRef = useRef<RecState>("idle");
  const restoreRef = useRef<(() => void) | undefined>(undefined);
  /** Fertige Dateien (zum erneuten Speichern, falls Chrome eine blockiert hat). */
  const blobsRef = useRef<Blob[]>([]);
  /** Unsichtbarer Pixel außerhalb der Bereiche — erzwingt frische Bilder. */
  const dotRef = useRef<HTMLDivElement | null>(null);

  const setBoth = (s: RecState) => {
    stateRef.current = s;
    setState(s);
  };

  const teardown = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    if (drawTimerRef.current) clearInterval(drawTimerRef.current);
    drawTimerRef.current = null;
    lanesRef.current.forEach((l) => l.stream.getTracks().forEach((t) => t.stop()));
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.srcObject = null;
      v.remove();
    }
    videoRef.current = null;
    dotRef.current?.remove();
    dotRef.current = null;
  };

  const fail = (kind: RecError, detail: string) => {
    teardown();
    lanesRef.current = [];
    recsRef.current = [];
    setBoth("idle");
    setError(kind);
    setErrorDetail(detail);
    restoreRef.current?.();
  };

  const stop = useCallback(() => {
    const recs = recsRef.current.filter((r) => r.state !== "inactive");
    if (!recs.length || stateRef.current !== "recording") return;
    setBoth("saving");
    recs.forEach((r) => r.stop());
  }, []);

  /** onLayout: vor dem Start das Aufnahme-Layout setzen (die Vorschau
   *  skaliert per Layout-Effekt nach); onRestore: danach zurückstellen. */
  const start = useCallback(async (opts: { targets: RecTarget[]; onLayout?: () => void; onRestore?: () => void }) => {
    if (stateRef.current !== "idle") return;
    setError(null);
    setErrorDetail("");
    setResults([]);
    blobsRef.current = [];
    restoreRef.current = opts.onRestore;
    if (!recorderSupported()) {
      setError("unsupported");
      return;
    }
    setBoth("starting");
    // Echte Bildschirm-Pixeldichte VOR der Aufnahme merken — während der
    // Tab-Aufnahme meldet Chrome die HiDPI-Aufnahmedichte (z. B. 3 statt 1,5).
    const screenDpr = window.devicePixelRatio || 1;

    // 1) Tab-Aufnahme anfordern. Wunsch-Auflösung = 1,5× der echten Tab-
    //    Pixel → Chrome rendert den Tab für die Aufnahme mit 1,5× Dichte:
    //    deutlich schärfer als nativ, aber ohne die 2×-Last, bei der
    //    schwache Grafik beim Scrollen leere (weiße) Kacheln liefert.
    const capW = Math.min(3840, Math.round(window.innerWidth * screenDpr * CAPTURE_BOOST));
    const capH = Math.min(2160, Math.round(window.innerHeight * screenDpr * CAPTURE_BOOST));
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
          frameRate: { ideal: FPS, max: FPS },
          width: { ideal: capW },
          height: { ideal: capH },
          // Mauszeiger nicht mit ins Video (wo Chrome das unterstützt).
          cursor: "never",
        } as MediaTrackConstraints,
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
    const track = stream.getVideoTracks()[0];
    if (!track) return fail("failed", "Kein Videobild erhalten.");
    // Ausgeschnitten wird nach Bildschirm-Koordinaten dieses Tabs — ein
    // anderes Fenster/ein ganzer Bildschirm würde falsche Bereiche liefern.
    const surface = (track.getSettings() as MediaTrackSettings & { displaySurface?: string }).displaySurface;
    if (surface && surface !== "browser") return fail("wrongSurface", `displaySurface = ${surface}`);

    // Aufnahme-Layout erst JETZT setzen: Chromes Freigabe-Leiste ist da,
    // das Fenster hat seine endgültige Höhe — danach springt nichts mehr.
    opts.onLayout?.();
    await settleLayout();

    const picked = opts.targets
      .map((target) => ({ target, el: target.el() }))
      .filter((p): p is { target: RecTarget; el: HTMLElement } => !!p.el);
    const missing = opts.targets.find((t) => t.required && !picked.some((p) => p.target === t));
    if (missing || !picked.length) return fail("failed", `Aufnahme-Bereich „${(missing ?? opts.targets[0])?.name ?? "?"}“ nicht gefunden.`);


    // 2) Tab-Bilder in ein unsichtbares Video leiten.
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
    // Bezug des Aufnahmebilds = der ganze Tab (Viewport).
    const refRect = () => ({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight });
    // Unsichtbarer Pixel ganz oben links (dunkle Bühne, in KEINEM Bereich):
    // Chrome schickt bei ruhender Seite KEIN Bild — ein echter Farbwechsel
    // (fast schwarz ↔ schwarz, fürs Auge unsichtbar) erzwingt ein frisches.
    const dot = document.createElement("div");
    dot.setAttribute("aria-hidden", "true");
    dot.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;background:#000000;pointer-events:none;z-index:2147483647";
    document.body.appendChild(dot);
    dotRef.current = dot;
    let lastNudge = 0;
    let flip = false;
    const nudge = () => {
      const now = performance.now();
      if (now - lastNudge < 150) return;
      lastNudge = now;
      flip = !flip;
      dot.style.background = flip ? "#020202" : "#000000";
    };
    /** Passt das aktuelle Bild zum aktuellen Layout (Seitenverhältnis)? */
    const frameMatches = () => {
      const vw = video.videoWidth, vh = video.videoHeight;
      const r = refRect();
      if (!vw || !vh || r.width < 1 || r.height < 1) return false;
      return Math.abs(vw / vh / (r.width / r.height) - 1) < 0.015;
    };
    // Während des Wartens laufend anstoßen (ein einzelner Anstoß kann vor dem
    // Zuschnitt „verpuffen").
    nudge();
    const nudgeTimer = setInterval(nudge, 160);
    const gotFrames = await waitForFrames(video, 5000);
    clearInterval(nudgeTimer);
    if (!gotFrames) {
      return fail("noFrames", `Chrome hat innerhalb von 5 s kein Bild des Tabs geliefert.${playErr ? ` (${playErr})` : ""}`);
    }
    // Erst starten, wenn das Bild zum Layout passt (max. 2,5 s, dann weiter
    // — z. B. falls Chrome das Bild mit Rand liefert).
    for (let t0 = performance.now(); !frameMatches() && performance.now() - t0 < 2500; ) {
      nudge();
      await new Promise((r) => setTimeout(r, 60));
    }

    // 3) Pro Bereich eine Leinwand FESTER Größe.
    const lanes: Lane[] = [];
    for (const { target, el } of picked) {
      const size = target.size(el.getBoundingClientRect(), screenDpr);
      const outW = even(Math.min(size.w, 3840));
      const outH = even(Math.min(size.h, 3840));
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return fail("failed", "Canvas-Kontext nicht verfügbar.");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const fps = target.fps ?? FPS;
      lanes.push({ target, el, canvas, ctx, stream: canvas.captureStream(fps), chunks: [], outW, outH, every: Math.max(1, Math.round(FPS / fps)) });
    }
    lanesRef.current = lanes;

    let tick = 0;
    let mismatchSince = 0;
    const draw = () => {
      const vw = video.videoWidth, vh = video.videoHeight;
      const ref = refRect();
      if (!vw || !vh || ref.width < 1 || ref.height < 1) return;
      // Bild noch vom alten Layout → NICHT ausschneiden (das letzte richtige
      // Bild bleibt stehen) und ein frisches anfordern. Hält der Zustand
      // > 1,5 s an, liefert Chrome offenbar mit Rand → dann trotzdem zeichnen.
      if (!frameMatches()) {
        if (!mismatchSince) mismatchSince = performance.now();
        if (performance.now() - mismatchSince < 1500) {
          nudge();
          return;
        }
      } else mismatchSince = 0;
      // Aufnahmebild ↔ Seite: gleichmäßig skaliert, ggf. mittig mit Rand.
      const s = Math.min(vw / ref.width, vh / ref.height);
      const ox = (vw - ref.width * s) / 2, oy = (vh - ref.height * s) / 2;
      const t = tick++;
      for (const l of lanes) {
        if (t % l.every) continue;
        const r = l.el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        // Cover-Fit: Seitenverhältnis exakt halten, Ränder minimal kappen.
        const k = Math.max(l.outW / r.width, l.outH / r.height);
        const cw = l.outW / k, ch = l.outH / k;
        let sx = ox + (r.left - ref.left + (r.width - cw) / 2) * s;
        let sy = oy + (r.top - ref.top + (r.height - ch) / 2) * s;
        let sw = cw * s, sh = ch * s;
        // Nie über den Bildrand lesen (Rundung/Fenster-Kante).
        sx = Math.max(0, Math.min(sx, vw - 1));
        sy = Math.max(0, Math.min(sy, vh - 1));
        sw = Math.min(sw, vw - sx);
        sh = Math.min(sh, vh - sy);
        l.ctx.drawImage(video, sx, sy, sw, sh, 0, 0, l.outW, l.outH);
      }
    };
    // Fester 60-Hz-Takt statt requestAnimationFrame: rAF pausiert, sobald
    // das Fenster verdeckt ist (z. B. OBS davor) — das Video würde stocken.
    draw();
    drawTimerRef.current = setInterval(draw, 1000 / FPS);

    // 4) Encoder starten (alle gleichzeitig, MP4 → WebM-Kette). Uhr läuft ab
    //    hier — die Encoder schreiben schon während der Format-Prüfung mit.
    startedAtRef.current = Date.now();
    setElapsed(0);
    const started = await startRecorders(
      lanes.map((l) => ({ stream: l.stream, bitrate: l.target.bitrate })),
      supportedMimes(),
      (i, b) => lanes[i].chunks.push(b),
    );
    if ("error" in started) return fail("failed", started.error);
    const { recs, mime } = started;
    const type = mime.split(";")[0] || "video/webm";
    const ext = type.includes("mp4") ? "mp4" : "webm";
    const ts = stamp();

    let pending = recs.length;
    const finishAll = async () => {
      const seconds = (Date.now() - startedAtRef.current) / 1000;
      teardown();
      recsRef.current = [];
      lanesRef.current = [];
      restoreRef.current?.();
      const files = lanes.map((l) => ({ lane: l, blob: new Blob(l.chunks, { type }), fileName: `${l.target.name}_${ts}.${ext}` }));
      lanes.forEach((l) => { l.chunks = []; });
      const ok = files.filter((f) => f.blob.size > 0);
      if (!ok.length) {
        setBoth("idle");
        setError("failed");
        setErrorDetail("Die Aufnahme enthielt keine Daten.");
        return;
      }
      // Nacheinander speichern — Chrome fragt beim zweiten Download einmalig
      // „Mehrere Dateien herunterladen?" (einmal „Zulassen" genügt).
      for (let i = 0; i < ok.length; i++) {
        if (i) await new Promise((r) => setTimeout(r, 400));
        download(ok[i].blob, ok[i].fileName);
      }
      blobsRef.current = ok.map((f) => f.blob);
      const metas = await Promise.all(ok.map((f) => probe(f.blob)));
      setResults(ok.map((f, i) => ({
        name: f.lane.target.name,
        fileName: f.fileName,
        width: metas[i].width || f.lane.outW,
        height: metas[i].height || f.lane.outH,
        seconds: metas[i].seconds || seconds,
        bytes: f.blob.size,
      })));
      setBoth("idle");
    };
    recs.forEach((rec) => {
      rec.onerror = (ev) => {
        setErrorDetail(`${mime} → ${describe((ev as unknown as { error?: unknown }).error ?? "Encoder-Fehler")}`);
        setError("failed");
        // Ein Encoder streikt → alle sauber beenden (Bisheriges bleibt erhalten).
        if (stateRef.current === "recording") setBoth("saving");
        recs.forEach((r) => { if (r.state !== "inactive") r.stop(); });
      };
      rec.onstop = () => {
        pending -= 1;
        if (pending === 0) void finishAll();
      };
    });
    // Nutzer beendet die Freigabe über Chromes Leiste → sauber speichern.
    track.addEventListener("ended", () => stop());

    recsRef.current = recs;
    tickRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 250);
    setBoth("recording");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop]);

  // Editor verlassen während der Aufnahme → nichts verlieren: speichern.
  useEffect(() => () => {
    const recs = recsRef.current.filter((r) => r.state !== "inactive");
    if (recs.length) recs.forEach((r) => r.stop());
    else teardown();
  }, []);

  /** Datei i erneut speichern (falls Chrome den Mehrfach-Download blockiert hat). */
  const saveAgain = useCallback((i: number) => {
    const blob = blobsRef.current[i];
    const r = results[i];
    if (blob && r) download(blob, r.fileName);
  }, [results]);

  const clearNotice = useCallback(() => {
    setError(null);
    setErrorDetail("");
    setResults([]);
    blobsRef.current = [];
  }, []);

  return { state, elapsed, error, errorDetail, results, start, stop, clearNotice, saveAgain };
}
