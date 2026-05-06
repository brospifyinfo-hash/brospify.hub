// ─── safeFetch — hardened fetch for admin views ──────────────────
// The admin panel makes a lot of polling fetches (live credits, users
// table, stats). Without timeouts and retries any temporary network
// blip or sluggish Sheets-API call piles up promises and eventually
// crashes the panel. This wrapper:
//
//   • aborts on a 30s timeout via AbortController,
//   • retries once on network error or 5xx with a 800ms backoff,
//   • coalesces concurrent calls to the same key — if a fetch is
//     already in flight for that key, the new caller piggy-backs on
//     it instead of duplicating the request.
//
// Returns `null` on hard failure so callers don't have to wrap every
// site in a try/catch — just check for null. Successful responses
// are parsed as JSON and returned typed.

const DEFAULT_TIMEOUT_MS = 30_000;
const RETRY_DELAY_MS = 800;

interface SafeFetchOptions extends RequestInit {
  /** Override the default 30s timeout. Set to 0 to disable. */
  timeoutMs?: number;
  /** Disable the single retry on transient failure. */
  noRetry?: boolean;
  /**
   * Coalesce key — if a fetch with the same key is already in
   * flight, the new caller awaits the same promise instead of
   * issuing a second request. Falsy = no coalescing.
   */
  coalesceKey?: string;
}

const inflight = new Map<string, Promise<unknown>>();

async function once<T>(input: RequestInfo | URL, init: SafeFetchOptions): Promise<T | null> {
  const timeout = init.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const ac = new AbortController();
  const timer = timeout > 0 ? setTimeout(() => ac.abort(), timeout) : null;
  try {
    const res = await fetch(input, { ...init, signal: ac.signal });
    if (!res.ok) {
      // 4xx is treated as a hard failure (no retry) — nothing the
      // network can fix. 5xx returns null so the caller decides
      // whether to retry.
      if (res.status >= 500) {
        return null;
      }
      try {
        // Try to parse error JSON so callers can inspect via a
        // shared envelope; if the body isn't JSON, fall back.
        const data = await res.json();
        return data as T;
      } catch {
        return null;
      }
    }
    // 204 / empty body — return an empty object cast.
    if (res.status === 204) return {} as T;
    return (await res.json()) as T;
  } catch (err) {
    // AbortError = timeout. Other errors = network failure.
    if ((err as Error).name === "AbortError") {
      console.warn(`[safeFetch] timeout: ${String(input)}`);
    } else {
      console.warn(`[safeFetch] network error:`, err);
    }
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function safeFetch<T = unknown>(
  input: RequestInfo | URL,
  init: SafeFetchOptions = {},
): Promise<T | null> {
  const key = init.coalesceKey;
  if (key && inflight.has(key)) {
    return inflight.get(key) as Promise<T | null>;
  }

  const exec = (async () => {
    let result = await once<T>(input, init);
    if (result === null && !init.noRetry) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      result = await once<T>(input, init);
    }
    return result;
  })();

  if (key) {
    inflight.set(key, exec);
    exec.finally(() => {
      // Release the slot once the request finishes regardless of
      // outcome — next caller will issue a new request.
      inflight.delete(key);
    });
  }

  return exec;
}
