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

  const refresh = useCallback(async () => {
    const token = ++fetchTokenRef.current;
    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      if (!res.ok) {
        // Still mark as "loaded" so the pill stops showing the dots
        // forever; a 401 means the user isn't logged in, no panic.
        if (token === fetchTokenRef.current) {
          setState((s) => ({ ...s, loading: false }));
        }
        return;
      }
      const data = await res.json();
      const c = data.credits;
      if (c && token === fetchTokenRef.current) {
        const next: CreditsState = {
          balance: Math.max(0, Number(c.balance) || 0),
          totalPurchased: Math.max(0, Number(c.totalPurchased) || 0),
          totalUsed: Math.max(0, Number(c.totalUsed) || 0),
          loading: false,
          lastSyncedAt: Date.now(),
        };
        setState(next);
        broadcast({
          balance: next.balance,
          totalPurchased: next.totalPurchased,
          totalUsed: next.totalUsed,
          ts: next.lastSyncedAt,
        });
      } else if (token === fetchTokenRef.current) {
        setState((s) => ({ ...s, loading: false }));
      }
    } catch {
      if (token === fetchTokenRef.current) {
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
          // Ignore older snapshots.
          if (p.ts < s.lastSyncedAt) return s;
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
      remaining: 0,
      setRemaining: () => {},
    };
  }
  return ctx;
}
