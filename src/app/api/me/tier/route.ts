import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getCurrentTier } from "@/lib/tier-guard";

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
  if (!tier) {
    return NextResponse.json({ error: "Tier konnte nicht aufgelöst werden" }, { status: 500 });
  }

  return NextResponse.json({
    tier,
    isAdmin: !!session.isAdmin,
  });
}
