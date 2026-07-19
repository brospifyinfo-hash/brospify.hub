// ─── /api/admin/users ────────────────────────────────────────────
// Full-fat user listing for the admin Users tab. Includes role,
// tier, signup, credit summary, and contact info — everything the
// new "User-Management" table needs in one round trip.
//
// GET                    → list view
// GET ?key=<licence>     → single-user detail (same shape as list, plus log)

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  findKundeByKey,
  getAllKunden,
  getCreditsState,
  type CreditTransaction,
  type TierKey,
  type UserRole,
} from "@/lib/sheets";
import { resolvePlan, type PlanState } from "@/lib/tiers-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UserRow {
  rowIndex: number;
  lizenzschluessel: string;
  status: string;
  shopDomain: string;
  email: string;
  sku: string;
  role: UserRole;
  tier: TierKey | "";
  /** WIRKSAMER Plan laut resolvePlan (leer bei gekündigt/abgelaufen/…). */
  effectiveTier: TierKey | "";
  /** Warum der Plan (nicht) wirkt — für ehrliche Badges im Admin. */
  planState: PlanState;
  /** Gekündigt, aber bezahlte Periode läuft noch (Zugang bis endsAt). */
  pendingCancel: boolean;
  tierSince: string;
  tierCanceledAt: string;
  signupAt: string;
  hasShopify: boolean;
  hasGoogle: boolean;
  blocked: boolean;
  vip: boolean;
  credits: { balance: number; totalPurchased: number; totalUsed: number };
  lastTransaction?: CreditTransaction;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  const key = req.nextUrl.searchParams.get("key");
  if (key) return single(key);
  return list();
}

function rowFor(k: Awaited<ReturnType<typeof getAllKunden>>[number]): UserRow {
  const credits = getCreditsState(k.profile);
  const log = Array.isArray(k.profile.credits?.log) ? k.profile.credits!.log! : [];
  const plan = resolvePlan(k);
  return {
    rowIndex: k.rowIndex,
    lizenzschluessel: k.lizenzschluessel,
    status: k.status,
    shopDomain: k.shopDomain,
    email: k.kundenEmail,
    sku: k.sku,
    role: (k.profile.role as UserRole) || "user",
    // tier = eingetragener Plan (auch via SKU), effectiveTier = wirksam.
    tier: plan.baseTier || "",
    effectiveTier: plan.tier || "",
    planState: plan.state,
    pendingCancel: plan.pendingCancel,
    tierSince: k.profile.tierSince || "",
    tierCanceledAt: k.profile.tierCanceledAt || "",
    signupAt: k.profile.signupAt || "",
    hasShopify: !!k.shopifyToken,
    hasGoogle: !!k.profile.linkedGoogleEmail,
    blocked: k.profile.blocked === true,
    vip: k.profile.vip === true,
    credits: {
      balance: credits.balance,
      totalPurchased: credits.totalPurchased,
      totalUsed: credits.totalUsed,
    },
    lastTransaction: log.length > 0 ? log[log.length - 1] : undefined,
  };
}

async function list(): Promise<NextResponse> {
  try {
    const kunden = await getAllKunden();
    const users: UserRow[] = kunden
      .filter((k) => k.lizenzschluessel)
      .map(rowFor);
    // Admins first, then highest balance
    users.sort((a, b) => {
      if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
      return b.credits.balance - a.credits.balance;
    });
    return NextResponse.json({ users, total: users.length });
  } catch (err) {
    console.error("[admin/users] list error:", err);
    return NextResponse.json({ error: "Fehler beim Laden." }, { status: 500 });
  }
}

async function single(key: string): Promise<NextResponse> {
  try {
    const kunde = await findKundeByKey(key);
    if (!kunde) {
      return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
    }
    const log = Array.isArray(kunde.profile.credits?.log) ? kunde.profile.credits!.log! : [];
    return NextResponse.json({
      user: rowFor(kunde),
      log: [...log].reverse(),
      adminNote: kunde.profile.adminNote || "",
    });
  } catch (err) {
    console.error("[admin/users] detail error:", err);
    return NextResponse.json({ error: "Fehler beim Laden." }, { status: 500 });
  }
}
