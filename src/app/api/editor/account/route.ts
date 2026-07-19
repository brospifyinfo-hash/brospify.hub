import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey, getCreditsState } from "@/lib/sheets";
import {
  isActiveSubFromKunde,
  tierFromSku,
  resolveTier,
  isEditorTier,
  TIER_DISPLAY_LABEL,
  DEFAULT_TIERS,
  editorPlanSummaries,
  type TierKey,
} from "@/lib/tiers-shared";
import { countNamedDesigns, maxActiveDesignsFor } from "@/lib/editor-designs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── /api/editor/account — Konto-/Abo-/Credits-/Design-Status ──────────
// Alles, was das Profil-Overlay des Editors braucht, in EINEM Call.
// Gäste bekommen { loggedIn:false }. Admins ∞. Normale Nutzer: aktueller
// Plan, Credits, aktive Designs (used/limit) + die 3 Editor-Pläne.

export async function GET() {
  const session = await getSession();
  const plans = editorPlanSummaries();

  if (!session.isLoggedIn) {
    return NextResponse.json({ loggedIn: false, plans });
  }

  if (session.isAdmin) {
    return NextResponse.json({
      loggedIn: true,
      isAdmin: true,
      name: session.googleName || "Admin",
      email: session.googleEmail || null,
      plan: { active: true, key: "pro", label: "Admin", priceEur: 0 },
      credits: { balance: null, unlimited: true },
      designs: { used: 0, limit: -1 },
      subscriptionEndsAt: null,
      plans,
    });
  }

  const kunde = session.lizenzschluessel ? await findKundeByKey(session.lizenzschluessel) : null;
  const active = kunde ? isActiveSubFromKunde(kunde) : false;
  // Gleiche Prioritäten wie resolvePlan (profile.tier vor SKU) — sonst
  // zeigt das Konto-Overlay einen anderen Plan als die Gates nutzen.
  const tierKey: TierKey | null = kunde
    ? resolveTier(kunde.profile?.tier) || tierFromSku(kunde.sku) || null
    : null;
  const tierDef = tierKey ? DEFAULT_TIERS.find((t) => t.key === tierKey) : null;
  const balance = kunde ? getCreditsState(kunde.profile).balance : 0;
  const used = await countNamedDesigns(session.lizenzschluessel || "");
  const limit = kunde ? await maxActiveDesignsFor(kunde) : 0;

  return NextResponse.json({
    loggedIn: true,
    isAdmin: false,
    name: session.googleName || kunde?.profile?.displayName || kunde?.profile?.username || null,
    email: kunde?.kundenEmail || session.googleEmail || null,
    username: kunde?.profile?.username || null,
    hasPassword: !!kunde?.profile?.passwordHash,
    shopDomain: kunde?.shopDomain || null,
    plan: {
      active,
      key: active ? tierKey : null,
      label: active && tierKey ? TIER_DISPLAY_LABEL[tierKey] : null,
      priceEur: active && tierDef ? tierDef.priceMonthlyEur : 0,
      isEditorPlan: active ? isEditorTier(tierKey) : false,
    },
    credits: { balance },
    designs: { used, limit },
    subscriptionEndsAt: kunde?.profile?.subscriptionEndsAt || null,
    plans,
  });
}
