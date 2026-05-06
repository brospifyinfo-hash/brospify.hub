// ─── /api/admin/impersonate/exit ─────────────────────────────────
// Restore the original admin session from `originalSession`. The
// caller might be inside the impersonated user's session, so we
// don't gate this on `isAdmin` — the snapshot itself proves the
// admin was the one who initiated impersonation.

import { NextResponse } from "next/server";
import { logSystemEvent } from "@/lib/sheets";
import { getSession, type SessionData } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();

  if (!session.impersonatedBy || !session.originalSession) {
    return NextResponse.json(
      { error: "Keine aktive Impersonation." },
      { status: 400 },
    );
  }

  let restored: SessionData | null = null;
  try {
    restored = JSON.parse(session.originalSession) as SessionData;
  } catch {
    restored = null;
  }
  if (!restored) {
    return NextResponse.json(
      { error: "Snapshot korrupt – bitte neu einloggen." },
      { status: 500 },
    );
  }

  const adminId = session.impersonatedBy;
  const target = session.lizenzschluessel || "";

  // Apply the snapshot field-by-field so the IronSession proxy picks
  // up the changes; assigning a fresh object replaces nothing.
  session.isLoggedIn = restored.isLoggedIn;
  session.isAdmin = restored.isAdmin;
  session.lizenzschluessel = restored.lizenzschluessel;
  session.sku = restored.sku;
  session.shopDomain = restored.shopDomain;
  session.shopifyToken = restored.shopifyToken;
  session.customerClientId = restored.customerClientId;
  session.customerClientSecret = restored.customerClientSecret;
  session.oauthNonce = restored.oauthNonce;
  session.hasShopifyConnection = restored.hasShopifyConnection;
  session.onboardingDone = restored.onboardingDone;
  session.setupStep1Done = restored.setupStep1Done;
  session.setupStep1Skipped = restored.setupStep1Skipped;
  session.setupStep2Done = restored.setupStep2Done;
  session.googleName = restored.googleName;
  session.googleEmail = restored.googleEmail;
  session.googleImage = restored.googleImage;
  session.impersonatedBy = undefined;
  session.originalSession = undefined;
  await session.save();

  void logSystemEvent({
    level: "audit",
    actor: adminId,
    action: "impersonate.exit",
    target,
    details: {},
  });

  return NextResponse.json({ success: true, redirect: "/admin" });
}
