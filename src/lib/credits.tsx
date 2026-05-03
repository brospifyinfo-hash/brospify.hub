"use client";

// ─── Global Credits Context ──────────────────────────────────────
// Single source of truth for the user's credit balance. The Navigation
// header subscribes for the always-visible pill; tool pages call
// `setBalance(creditsRemaining)` from API responses to keep the
// number authoritative without a refetch round-trip.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface CreditsState {
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  loading: boolean;
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

export function CreditsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CreditsState>({
    balance: 0,
    totalPurchased: 0,
    totalUsed: 0,
    loading: true,
  });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      if (!res.ok) {
        setState((s) => ({ ...s, loading: false }));
        return;
      }
      const data = await res.json();
      const c = data.credits;
      if (c) {
        setState({
          balance: c.balance ?? 0,
          totalPurchased: c.totalPurchased ?? 0,
          totalUsed: c.totalUsed ?? 0,
          loading: false,
        });
      } else {
        setState((s) => ({ ...s, loading: false }));
      }
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setBalance = useCallback((balance: number) => {
    setState((s) => ({ ...s, balance: Math.max(0, balance), loading: false }));
  }, []);

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
      refresh: async () => {},
      setBalance: () => {},
      optimisticDeduct: () => {},
      remaining: 0,
      setRemaining: () => {},
    };
  }
  return ctx;
}
