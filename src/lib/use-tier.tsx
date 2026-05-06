"use client";

import { useEffect, useState } from "react";
import type { TierDefinition, FeatureFlag, LimitKey } from "./tiers-shared";

interface TierState {
  tier: TierDefinition | null;
  isAdmin: boolean;
  loading: boolean;
}

let cached: TierState | null = null;
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((fn) => fn());
}

async function fetchTier(): Promise<TierState> {
  try {
    const res = await fetch("/api/me/tier", { cache: "no-store" });
    if (!res.ok) return { tier: null, isAdmin: false, loading: false };
    const data = await res.json();
    return {
      tier: data.tier ?? null,
      isAdmin: !!data.isAdmin,
      loading: false,
    };
  } catch {
    return { tier: null, isAdmin: false, loading: false };
  }
}

/** Force the next render to refetch — call after admin tier change. */
export function refreshTier() {
  cached = null;
  fetchTier().then((state) => {
    cached = state;
    notify();
  });
}

export function useTier(): TierState & {
  has: (flag: FeatureFlag) => boolean;
  limit: (key: LimitKey) => number;
} {
  const [state, setState] = useState<TierState>(
    cached || { tier: null, isAdmin: false, loading: true },
  );

  useEffect(() => {
    let mounted = true;

    const sub = () => {
      if (mounted && cached) setState(cached);
    };
    subscribers.add(sub);

    if (cached) {
      setState(cached);
    } else {
      fetchTier().then((s) => {
        cached = s;
        if (mounted) setState(s);
      });
    }

    return () => {
      mounted = false;
      subscribers.delete(sub);
    };
  }, []);

  return {
    ...state,
    has: (flag: FeatureFlag) => {
      // Admins bypass on the client too — keeps testing flows simple.
      if (state.isAdmin) return true;
      return state.tier?.features?.[flag] === true;
    },
    limit: (key: LimitKey) => {
      if (state.isAdmin) return -1;
      return state.tier?.limits?.[key] ?? 0;
    },
  };
}
