"use client";

// ─── useResilientJob ─────────────────────────────────────────────
// Long-running AI calls in the hub used to die on any hiccup —
// network flap, tab close, accidental reload. This hook makes them
// resilient:
//
//   • blocks tab close / reload while a job is running (beforeunload)
//   • auto-retries transient errors (network errors, 5xx, JSON parse)
//     with exponential backoff — NEVER bubbles them as a fatal error
//   • surfaces a live debug feed so the user sees what's happening
//   • persists job state to localStorage so a reload picks up the
//     loading UI again (the actual in-flight request can't be
//     resumed across reload, but the user can confirm "weiter
//     versuchen" and we re-fire with the same inputs)
//
// Only 4xx responses (bad input, insufficient credits, auth) are
// treated as terminal — those won't succeed on retry and we surface
// them to the caller. Everything else loops forever.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const STORAGE_PREFIX = "brospify:job:";
const MAX_LOG_LINES = 40;

export interface JobLogEntry {
  ts: number;
  level: "info" | "warn" | "error" | "retry";
  message: string;
}

export type JobStatus = "idle" | "running" | "done" | "error";

interface PersistedJob {
  status: JobStatus;
  startedAt: number;
  attempts: number;
  lastError?: string;
  hint?: string;
  log: JobLogEntry[];
}

export interface ResilientJobState {
  status: JobStatus;
  attempts: number;
  elapsedMs: number;
  log: JobLogEntry[];
  /** Fatal error — only set for 4xx responses that won't recover. */
  fatalError: string | null;
  hint: string | null;
}

export interface RunOptions<T> {
  /** Performs one attempt. Throws for ANY failure — the hook decides
   *  whether to retry. Returning a value resolves the job. */
  attempt: () => Promise<T>;
  /** Optional hook fired on each successful retry — useful for
   *  refreshing credits / clearing optimistic state. */
  onAttemptStart?: (attempt: number) => void;
  /** Optional progress hint (e.g. "Renderer wärmt auf"). */
  hint?: string;
}

export class TerminalJobError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "TerminalJobError";
  }
}

/** Helper: classify a fetch response so the caller can decide if
 *  the error is terminal (4xx) vs retryable (network, 5xx). */
export async function readJobResponse<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (res.ok) return body as T;

  const obj = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const message = typeof obj.error === "string"
    ? obj.error
    : typeof obj.message === "string"
      ? obj.message
      : `Server-Fehler (HTTP ${res.status})`;

  if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 425 && res.status !== 429) {
    // 4xx (except 408 timeout, 425 too-early, 429 rate-limit) won't
    // succeed on retry — propagate as terminal.
    throw new TerminalJobError(message, res.status);
  }
  // 408 / 425 / 429 / 5xx — retryable.
  const err = new Error(message);
  (err as Error & { _retryable?: boolean })._retryable = true;
  throw err;
}

function nowMs() {
  return Date.now();
}

function loadPersisted(key: string): PersistedJob | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedJob;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function savePersisted(key: string, value: PersistedJob | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null) {
      window.localStorage.removeItem(STORAGE_PREFIX + key);
    } else {
      window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    }
  } catch { /* quota etc. */ }
}

export interface UseResilientJobResult<T> {
  state: ResilientJobState;
  /** True when status === "running". Use this to disable user inputs and
   *  show the loader. */
  isRunning: boolean;
  /** Start a new job. Resolves with the value or rejects with a
   *  TerminalJobError (4xx) or AbortError on user cancel. */
  run: (opts: RunOptions<T>) => Promise<T>;
  /** Reset the persisted state (after viewing the result, or on
   *  explicit user retry). */
  reset: () => void;
  /** Indicates that we found a persisted "running" job in
   *  localStorage on mount — meaning the user navigated/reloaded
   *  while a previous attempt was in flight. Caller decides how to
   *  prompt the user. */
  hasOrphan: boolean;
  /** Drop the orphan record without resuming. */
  clearOrphan: () => void;
}

/**
 * @param key  Unique key per tool (e.g. "ai-studio", "bg-remove").
 *             Used for the localStorage record.
 */
export function useResilientJob<T = unknown>(key: string): UseResilientJobResult<T> {
  const persisted = typeof window === "undefined" ? null : loadPersisted(key);
  const orphan = persisted?.status === "running";

  const [state, setState] = useState<ResilientJobState>(() => ({
    status: orphan ? "running" : (persisted?.status ?? "idle"),
    attempts: persisted?.attempts ?? 0,
    elapsedMs: persisted ? Math.max(0, nowMs() - persisted.startedAt) : 0,
    log: persisted?.log ?? [],
    fatalError: null,
    hint: persisted?.hint ?? null,
  }));
  const [hasOrphan, setHasOrphan] = useState(!!orphan);

  const stateRef = useRef(state);
  stateRef.current = state;

  const startedAtRef = useRef<number>(persisted?.startedAt ?? 0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningRef = useRef(state.status === "running");

  // Tick the elapsed counter while running.
  useEffect(() => {
    if (state.status !== "running") {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setState((s) => ({ ...s, elapsedMs: nowMs() - startedAtRef.current }));
    }, 500);
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [state.status]);

  // Block tab close / reload while a job is in flight.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!runningRef.current) return;
      e.preventDefault();
      // Browsers ignore the custom message in modern versions, but
      // the assignment is what triggers the confirm dialog.
      e.returnValue = "";
      return "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Keep runningRef in sync — it's read by the beforeunload handler
  // synchronously, so it must reflect the latest status.
  useEffect(() => {
    runningRef.current = state.status === "running";
  }, [state.status]);

  // Persist on every meaningful state change.
  useEffect(() => {
    if (state.status === "idle" || state.status === "done") {
      // Idle is meaningless to persist; done is auto-cleared after a
      // few seconds so a fresh reload doesn't re-show the loader.
      if (state.status === "idle") savePersisted(key, null);
      return;
    }
    savePersisted(key, {
      status: state.status,
      startedAt: startedAtRef.current,
      attempts: state.attempts,
      hint: state.hint ?? undefined,
      lastError: state.fatalError ?? undefined,
      log: state.log,
    });
  }, [key, state]);

  const appendLog = useCallback((entry: Omit<JobLogEntry, "ts">) => {
    setState((s) => {
      const next: JobLogEntry = { ...entry, ts: nowMs() };
      const log = [...s.log, next].slice(-MAX_LOG_LINES);
      return { ...s, log };
    });
  }, []);

  const reset = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    setState({
      status: "idle",
      attempts: 0,
      elapsedMs: 0,
      log: [],
      fatalError: null,
      hint: null,
    });
    setHasOrphan(false);
    savePersisted(key, null);
  }, [key]);

  const clearOrphan = useCallback(() => {
    setHasOrphan(false);
    if (stateRef.current.status === "running" && !runningRef.current) {
      // Defensive: only reset if we're not actually running.
      reset();
    }
  }, [reset]);

  const run = useCallback<UseResilientJobResult<T>["run"]>(
    async (opts) => {
      // Clear any orphan flag the moment a real run starts.
      setHasOrphan(false);

      startedAtRef.current = nowMs();
      setState({
        status: "running",
        attempts: 0,
        elapsedMs: 0,
        log: [{
          ts: nowMs(),
          level: "info",
          message: `Job gestartet${opts.hint ? ` — ${opts.hint}` : ""}.`,
        }],
        fatalError: null,
        hint: opts.hint ?? null,
      });
      runningRef.current = true;

      let attempt = 0;
      // Exponential backoff capped at 30s.
      const backoffMs = (a: number) => Math.min(30_000, 1500 * Math.pow(1.7, a - 1));

      while (true) {
        attempt += 1;
        setState((s) => ({ ...s, attempts: attempt }));
        opts.onAttemptStart?.(attempt);
        if (attempt > 1) {
          appendLog({ level: "retry", message: `Versuch ${attempt} — Verbindung wird erneut aufgebaut…` });
        } else {
          appendLog({ level: "info", message: "Verbindung zum AI-Backend aufgebaut, Anfrage läuft." });
        }

        try {
          const value = await opts.attempt();
          appendLog({ level: "info", message: `Antwort erhalten nach ${attempt} Versuch${attempt > 1 ? "en" : ""}.` });
          setState((s) => ({ ...s, status: "done" }));
          runningRef.current = false;
          // Clean up the persisted record so a future reload won't
          // re-surface this run.
          savePersisted(key, null);
          return value;
        } catch (err: unknown) {
          if (err instanceof TerminalJobError) {
            appendLog({ level: "error", message: `Abbruch (HTTP ${err.status}): ${err.message}` });
            setState((s) => ({ ...s, status: "error", fatalError: err.message }));
            runningRef.current = false;
            savePersisted(key, null);
            throw err;
          }
          const msg = err instanceof Error ? err.message : String(err);
          appendLog({ level: "warn", message: `Transienter Fehler: ${msg} — bleibe dran.` });
          // Sleep before next attempt. Honor a reasonable max backoff.
          await new Promise((r) => setTimeout(r, backoffMs(attempt)));
          // Loop continues — never gives up on transient errors.
        }
      }
    },
    [appendLog, key],
  );

  return {
    state,
    isRunning: state.status === "running",
    run,
    reset,
    hasOrphan,
    clearOrphan,
  };
}

// ─── Debug overlay component ─────────────────────────────────────
// Reusable UI that the AI tools mount whenever the job is running.
// Shows elapsed time, attempt counter, live log feed, and a clear
// "Wird nicht abgebrochen" hint so users don't accidentally try to
// close the tab.

export function JobDebugPanel({ state, compact }: { state: ResilientJobState; compact?: boolean }) {
  const secs = Math.max(0, Math.floor(state.elapsedMs / 1000));
  const mins = Math.floor(secs / 60);
  const elapsedLabel = mins > 0 ? `${mins}m ${secs % 60}s` : `${secs}s`;

  return (
    <div className={`rounded-xl border border-white/[0.08] bg-white/[0.02] ${compact ? "p-3" : "p-4"} space-y-2`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex w-2 h-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#95BF47]/60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#95BF47]" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-200">
            Job läuft
          </span>
          {state.attempts > 1 && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
              Versuch {state.attempts}
            </span>
          )}
        </div>
        <span className="text-[10px] font-mono text-zinc-500 tabular-nums">{elapsedLabel}</span>
      </div>

      <p className="text-[10.5px] text-zinc-500 leading-snug">
        Diese Anfrage kann nicht abgebrochen werden — bei Netz-Fehlern wird automatisch neu verbunden.
        Tab oder Browser geschlossen? Auf dieser Seite wird die Anfrage beim nächsten Öffnen fortgesetzt.
      </p>

      {state.hint && (
        <div className="text-[11px] text-[#95BF47]/90 flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-[#95BF47]" />
          {state.hint}
        </div>
      )}

      <div className="max-h-32 overflow-y-auto rounded-lg border border-white/[0.04] bg-black/30 p-2 font-mono text-[10px] leading-relaxed space-y-0.5">
        {state.log.length === 0 ? (
          <div className="text-zinc-600">Warte auf erste Antwort…</div>
        ) : (
          state.log.slice(-15).map((line, i) => (
            <div
              key={i}
              className={
                line.level === "error"
                  ? "text-red-400"
                  : line.level === "warn"
                    ? "text-amber-300"
                    : line.level === "retry"
                      ? "text-cyan-300"
                      : "text-zinc-400"
              }
            >
              <span className="text-zinc-600">
                [{new Date(line.ts).toLocaleTimeString("de-DE", { hour12: false })}]
              </span>{" "}
              {line.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Orphan-resume banner ───────────────────────────────────────
// Surfaces when we detect a previously-running job in localStorage
// on mount. Lets the user re-trigger or dismiss.

export function OrphanResumeBanner({
  toolLabel,
  onRetry,
  onDismiss,
}: {
  toolLabel: string;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3 flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
        <span className="text-base">↻</span>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-xs font-bold mb-0.5">{toolLabel} wurde unterbrochen</h3>
        <p className="text-[10px] text-zinc-400 leading-snug">
          Beim letzten Versuch wurde der Tab/Browser geschlossen oder die Seite neu geladen.
          Klicke „Weiter laden" um die Anfrage erneut zu starten.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <button
          onClick={onRetry}
          className="btn-accent px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap"
        >
          Weiter laden
        </button>
        <button
          onClick={onDismiss}
          className="px-3 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition"
        >
          Verwerfen
        </button>
      </div>
    </div>
  );
}
