// ─── Server-side tier gating helpers ─────────────────────────────
// Use from API routes:
//   const guard = await requireFeature(session, "aiStudio");
//   if (!guard.ok) return guard.response;
//
// `requireFeature` resolves the customer's current tier (from the
// Kunden sheet), looks up the live tier config (from Settings sheet),
// and returns a NextResponse if the feature is not enabled.

import { NextResponse } from "next/server";
import { findKundeByKey, type TierKey } from "./sheets";
import { getTierConfig } from "./tiers";
import {
  type FeatureFlag,
  type LimitKey,
  type TierDefinition,
  hasFeature,
} from "./tiers-shared";

interface SessionLike {
  isLoggedIn: boolean;
  isAdmin?: boolean;
  lizenzschluessel?: string;
}

export interface TierGuardOk {
  ok: true;
  tier: TierDefinition;
  tierKey: TierKey;
}

export interface TierGuardFail {
  ok: false;
  response: NextResponse;
  reason: "unauthenticated" | "feature_locked" | "limit_exceeded";
  tier?: TierDefinition;
}

export type TierGuardResult = TierGuardOk | TierGuardFail;

/**
 * Resolve the current customer's tier definition. Admins always
 * resolve to the highest paid tier (`business`) so they can test
 * everything; regular users resolve from their Kunden row, defaulting
 * to `free` when no row or tier is set.
 */
export async function getCurrentTier(session: SessionLike): Promise<TierDefinition | null> {
  if (!session.isLoggedIn) return null;

  const all = await getTierConfig();
  const findByKey = (key: TierKey) => all.find((t) => t.key === key);

  if (session.isAdmin) {
    return findByKey("business") || all[all.length - 1] || null;
  }

  const lk = session.lizenzschluessel;
  if (!lk) return findByKey("free") || all[0] || null;

  try {
    const kunde = await findKundeByKey(lk);
    if (!kunde) return findByKey("free") || all[0] || null;
    const key: TierKey = kunde.profile?.tier || "free";
    return findByKey(key) || findByKey("free") || all[0] || null;
  } catch {
    return findByKey("free") || all[0] || null;
  }
}

/**
 * Gate an API route on a feature flag. Returns either `{ ok: true, tier }`
 * or `{ ok: false, response }` — caller short-circuits with `return`.
 */
export async function requireFeature(
  session: SessionLike,
  flag: FeatureFlag,
): Promise<TierGuardResult> {
  if (!session.isLoggedIn) {
    return {
      ok: false,
      reason: "unauthenticated",
      response: NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 }),
    };
  }

  // Admins always pass — they need to test everything.
  if (session.isAdmin) {
    const tier = await getCurrentTier(session);
    if (tier) return { ok: true, tier, tierKey: tier.key };
  }

  const tier = await getCurrentTier(session);
  if (!tier) {
    return {
      ok: false,
      reason: "unauthenticated",
      response: NextResponse.json({ error: "Tier konnte nicht aufgelöst werden" }, { status: 401 }),
    };
  }

  if (!hasFeature(tier, flag)) {
    return {
      ok: false,
      tier,
      reason: "feature_locked",
      response: NextResponse.json(
        {
          error: "FEATURE_LOCKED",
          message: `Dieses Feature ist in deinem Abo (${tier.label}) nicht enthalten.`,
          tier: tier.key,
          requiredFeature: flag,
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true, tier, tierKey: tier.key };
}

/**
 * Soft limit check — returns the limit value (-1 = unlimited) so
 * callers can enforce monthly caps. Pass `currentUsage` if you want
 * an immediate yes/no decision.
 */
export async function getLimit(
  session: SessionLike,
  key: LimitKey,
): Promise<{ tier: TierDefinition; max: number } | null> {
  const tier = await getCurrentTier(session);
  if (!tier) return null;
  return { tier, max: tier.limits[key] };
}
