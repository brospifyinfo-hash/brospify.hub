"use client";

// ─── Global Credits Context ──────────────────────────────────────
// Single source of truth for the user's credit balance. The Navigation
// header subscribes for the always-visible pill; tool pages call
// `setBalance(creditsRemaining)` from API responses to keep the
// number authoritative without a refetch round-trip.
//
// Live-Tracking Strategie:
// 1. Initialer Fetch beim Mounten.
// 2. Polling alle POLL_INTERVAL_MS solange der Tab sichtbar ist.
// 3. `visibilitychange` → wenn Tab zurück in den Vordergrund kommt,
//    sofort einen frischen Request feuern (deckt den Fall ab dass
//    der User in einer anderen Tab/Browser-App war und ein Admin
//    seine Credits überschrieben hat).
// 4. `BroadcastChannel("brospify-credits")` — eine Tab pusht den
//    aktuellsten Stand, alle anderen aktualisieren ohne neuen
//    HTTP-Request. Reduziert Sheets-Quota-Druck bei Multi-Tab-Usern.
// 5. `online` Event → nach Netzwerk-Wiederherstellung ein Refetch.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface CreditsState {
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  loading: boolean;
  /** Wann zuletzt erfolgreich geladen — für Debug/UI. */
  lastSyncedAt: number;
}

interface CreditsContextValue extends CreditsState {
  /** Refetch the current balance from the server. */
  refresh: () => Promise<void>;
  /** Apply an authoritative new balance (e.g. from an API response). */
  setBalance: (balance: number) => void;
  /** Optimistically subtract from balance; server is the truth. */
  optimisticDeduct: (amount: number) => void;

  // ─── Admin-editable credit config (icon + per-tool costs) ─────
  // Sourced from /api/credit-config so an admin price/icon change
  // shows up in every tool UI without a redeploy. `costOf` falls
  // back to the caller's bundled default until the config arrives.
  creditIcon: string;
  costOf: (key: string, fallback: number) => number;

  // ─── Back-compat shims ────────────────────────────────────────
  // Some pages still read `remaining` / `setRemaining`. Keep them
  // pointing at `balance` so the migration is transparent.
  remaining: number;
  setRemaining: (n: number) => void;
}

const CreditsContext = createContext<CreditsContextValue | null>(null);

const POLL_INTERVAL_MS = 30_000;
const BROADCAST_CHANNEL = "brospify-credits";

interface BroadcastPayload {
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  ts: number;
}

export function CreditsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CreditsState>({
    balance: 0,
    totalPurchased: 0,
    totalUsed: 0,
    loading: true,
    lastSyncedAt: 0,
  });

  // Admin-editable credit config (icon + per-tool costs). Fetched once.
  const [creditIcon, setCreditIcon] = useState<string>("🪙");
  const [creditCosts, setCreditCosts] = useState<Record<string, number>>({});
  useEffect(() => {
    let cancelled = false;
    fetch("/api/credit-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (typeof data.icon === "string" && data.icon.trim()) setCreditIcon(data.icon);
        if (data.costs && typeof data.costs === "object") setCreditCosts(data.costs);
      })
      .catch(() => {/* keep defaults */});
    return () => { cancelled = true; };
  }, []);
  const costOf = useCallback(
    (key: string, fallback: number) => {
      const v = creditCosts[key];
      return Number.isFinite(v) ? v : fallback;
    },
    [creditCosts],
  );

  // Hold a ref to the BroadcastChannel so we can publish updates from
  // anywhere without recreating the channel on every render.
  const channelRef = useRef<BroadcastChannel | null>(null);
  // Track the most-recent fetch token so out-of-order responses don't
  // overwrite a fresher value (`AbortController` would also work but
  // keep this dependency-free).
  const fetchTokenRef = useRef(0);

  // Push the current state to other tabs.
  const broadcast = useCallback((payload: BroadcastPayload) => {
    try {
      channelRef.current?.postMessage(payload);
    } catch {
      // postMessage can throw if the channel is closed during teardown
      // — ignore, we'll resync on the next tick.
    }
  }, []);

  // Retry-Backoff bei 401/Network-Fehlern. Bei OAuth-Redirect kann es
  // sein dass der Session-Cookie auf dem ersten /api/profile call noch
  // nicht propagiert ist und der Server 401 wirft. Vorher hatten wir
  // dann loading: false + balance: 0 gesetzt — das hat dem User
  // "0 Credits" angezeigt obwohl er gerade die Membership gekauft hat.
  // Jetzt: bis zu RETRY_MAX Versuche mit zunehmenden Delays, und
  // loading bleibt true solange keine erfolgreiche Antwort kam.
  //
  // lastSyncedAt liegt zusaetzlich in einer Ref — wir koennen es im
  // refresh-Closure lesen ohne es als useCallback-dep zu haben (wuerde
  // sonst eine infinite-loop ueber den useEffect ausloesen, weil jeder
  // erfolgreiche refresh lastSyncedAt aktualisiert).
  const RETRY_MAX = 4;
  const RETRY_DELAYS_MS = [300, 800, 1600, 3000];
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedAtRef = useRef(0);

  const refresh = useCallback(async (): Promise<void> => {
    const token = ++fetchTokenRef.current;
    // Vorhandenen retry-Timer canceln, neuer Fetch uebernimmt.
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    const scheduleRetry = (reason: string) => {
      if (retryCountRef.current >= RETRY_MAX) {
        // Aufgegeben. Hatten wir SCHON MAL eine Balance, loading: false
        // setzen (alte Zahl bleibt sichtbar). Wurde dagegen NIE erfolgreich
        // geladen (z.B. 401 weil der Session-Cookie nach Login/OAuth noch
        // nicht propagiert ist), loading: true LASSEN → der Header zeigt
        // weiter "···" statt eine irreführende 0. Der 30s-Poll und der
        // Route-Wechsel-Refresh holen die Zahl dann nach.
        if (token === fetchTokenRef.current && lastSyncedAtRef.current > 0) {
          setState((s) => ({ ...s, loading: false }));
        }
        return;
      }
      const delay = RETRY_DELAYS_MS[Math.min(retryCountRef.current, RETRY_DELAYS_MS.length - 1)];
      retryCountRef.current += 1;
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        void refresh();
      }, delay);
      console.log(`[credits] retry #${retryCountRef.current} in ${delay}ms (${reason})`);
    };

    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      if (!res.ok) {
        // 403: account blocked → kein retry, endgueltig.
        if (res.status === 403) {
          if (token === fetchTokenRef.current) {
            setState((s) => ({ ...s, loading: false }));
          }
          return;
        }
        // Wenn schon mal erfolgreich: kein retry, alte balance bleibt sichtbar.
        if (lastSyncedAtRef.current > 0) {
          if (token === fetchTokenRef.current) {
            setState((s) => ({ ...s, loading: false }));
          }
          return;
        }
        scheduleRetry(`HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      const c = data.credits;
      if (c && token === fetchTokenRef.current) {
        retryCountRef.current = 0; // Reset retry counter bei Erfolg
        const ts = Date.now();
        const next: CreditsState = {
          balance: Math.max(0, Number(c.balance) || 0),
          totalPurchased: Math.max(0, Number(c.totalPurchased) || 0),
          totalUsed: Math.max(0, Number(c.totalUsed) || 0),
          loading: false,
          lastSyncedAt: ts,
        };
        lastSyncedAtRef.current = ts;
        setState(next);
        broadcast({
          balance: next.balance,
          totalPurchased: next.totalPurchased,
          totalUsed: next.totalUsed,
          ts,
        });
      } else if (token === fetchTokenRef.current) {
        // Antwort kam aber kein credits-Objekt → behandle wie 404-Race.
        if (lastSyncedAtRef.current === 0) {
          scheduleRetry("no credits in response");
        } else {
          setState((s) => ({ ...s, loading: false }));
        }
      }
    } catch (err) {
      // Network error → retry nur bei initialem Mount.
      if (token === fetchTokenRef.current && lastSyncedAtRef.current === 0) {
        scheduleRetry(`network: ${err instanceof Error ? err.message : "unknown"}`);
      } else if (token === fetchTokenRef.current) {
        setState((s) => ({ ...s, loading: false }));
      }
    }
  }, [broadcast]);

  // ── Initial fetch + polling + visibility/online listeners ──
  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    function startPolling() {
      if (intervalId) return;
      intervalId = setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          refresh();
        }
      }, POLL_INTERVAL_MS);
    }
    function stopPolling() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    // Initial fetch.
    refresh();

    // Visibility: refetch immediately on focus, pause polling when hidden.
    const onVisibility = () => {
      if (cancelled) return;
      if (document.visibilityState === "visible") {
        refresh();
        startPolling();
      } else {
        stopPolling();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Online: catch back-from-offline cases.
    const onOnline = () => { if (!cancelled) refresh(); };
    window.addEventListener("online", onOnline);

    // Cross-tab broadcast subscriber.
    if (typeof BroadcastChannel !== "undefined") {
      channelRef.current = new BroadcastChannel(BROADCAST_CHANNEL);
      channelRef.current.onmessage = (event: MessageEvent<BroadcastPayload>) => {
        const p = event.data;
        if (!p || typeof p.balance !== "number") return;
        setState((s) => {
          if (p.ts < s.lastSyncedAt) return s;
          lastSyncedAtRef.current = p.ts;
          return {
            balance: Math.max(0, p.balance),
            totalPurchased: Math.max(0, p.totalPurchased),
            totalUsed: Math.max(0, p.totalUsed),
            loading: false,
            lastSyncedAt: p.ts,
          };
        });
      };
    }

    if (typeof document === "undefined" || document.visibilityState === "visible") {
      startPolling();
    }

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      stopPolling();
      // Ausstehenden retry-Timer canceln damit kein Fetch nach unmount feuert
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      try {
        channelRef.current?.close();
      } catch { /* ignore */ }
      channelRef.current = null;
    };
  }, [refresh]);

  const setBalance = useCallback((balance: number) => {
    const safe = Math.max(0, balance);
    const ts = Date.now();
    setState((s) => ({ ...s, balance: safe, loading: false, lastSyncedAt: ts }));
    // Push the authoritative value out to the other tabs immediately.
    broadcast({ balance: safe, totalPurchased: state.totalPurchased, totalUsed: state.totalUsed, ts });
  }, [broadcast, state.totalPurchased, state.totalUsed]);

  const optimisticDeduct = useCallback((amount: number) => {
    setState((s) => ({
      ...s,
      balance: Math.max(0, s.balance - amount),
      totalUsed: s.totalUsed + amount,
    }));
  }, []);

  return (
    <CreditsContext.Provider
      value={{
        ...state,
        refresh,
        setBalance,
        optimisticDeduct,
        creditIcon,
        costOf,
        remaining: state.balance,
        setRemaining: setBalance,
      }}
    >
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits(): CreditsContextValue {
  const ctx = useContext(CreditsContext);
  if (!ctx) {
    return {
      balance: 0,
      totalPurchased: 0,
      totalUsed: 0,
      loading: false,
      lastSyncedAt: 0,
      refresh: async () => {},
      setBalance: () => {},
      optimisticDeduct: () => {},
      creditIcon: "🪙",
      costOf: (_key: string, fallback: number) => fallback,
      remaining: 0,
      setRemaining: () => {},
    };
  }
  return ctx;
}
