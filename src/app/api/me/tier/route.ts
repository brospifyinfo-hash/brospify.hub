import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getCurrentTier } from "@/lib/tier-guard";
import { findKundeByKey } from "@/lib/sheets";
import { isActiveSubFromKunde, tierFromSku } from "@/lib/tiers-shared";

// What the logged-in user is allowed to do.
// Returns the current tier definition so the client can render lock
// states, hide features, and show "Upgrade to X" CTAs.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const tier = await getCurrentTier(session);

  // Pull active-sub + SKU info so home/banner can react without a
  // separate /api/profile round-trip.
  let activeSubscription = false;
  let sku = "";
  let tierCanceledAt = "";
  let tierSince = "";
  let tierFromSheet: ReturnType<typeof tierFromSku> = null;
  if (session.isAdmin) {
    activeSubscription = true;
  } else if (session.lizenzschluessel) {
    try {
      const kunde = await findKundeByKey(session.lizenzschluessel);
      if (kunde) {
        sku = kunde.sku || "";
        activeSubscription = isActiveSubFromKunde(kunde);
        tierCanceledAt = kunde.profile?.tierCanceledAt || "";
        tierSince = kunde.profile?.tierSince || "";
        tierFromSheet = tierFromSku(kunde.sku);
      }
    } catch { /* ignore */ }
  }

  return NextResponse.json({
    tier,
    isAdmin: !!session.isAdmin,
    activeSubscription,
    sku,
    tierFromSku: tierFromSheet,
    tierCanceledAt,
    tierSince,
  });
}
