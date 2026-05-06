// ─── /api/admin/impersonate ──────────────────────────────────────
// Step into a customer's session. Body: { key }
// We snapshot the original admin session into `originalSession`
// (JSON-serialised SessionData minus impersonation fields) so the
// /exit endpoint can swap it back. `impersonatedBy` is the admin
// email/key — used by the UI banner and audit log.

import { NextRequest, NextResponse } from "next/server";
import { findKundeByKey, getKundeProfile, logSystemEvent } from "@/lib/sheets";
import { getSession, type SessionData } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  let body: { key?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const key = String(body.key || "").trim();
  if (!key) {
    return NextResponse.json({ error: "key fehlt." }, { status: 400 });
  }

  const kunde = await findKundeByKey(key);
  if (!kunde) {
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  }

  // Snapshot the current admin session (without impersonation
  // fields, to avoid recursion if exit/restore happens twice).
  const adminIdentifier =
    session.googleEmail || session.lizenzschluessel || "admin";

  const snapshot: SessionData = {
    isLoggedIn: session.isLoggedIn || false,
    isAdmin: session.isAdmin || false,
    lizenzschluessel: session.lizenzschluessel,
    sku: session.sku,
    shopDomain: session.shopDomain,
    shopifyToken: session.shopifyToken,
    customerClientId: session.customerClientId,
    customerClientSecret: session.customerClientSecret,
    oauthNonce: session.oauthNonce,
    hasShopifyConnection: session.hasShopifyConnection,
    onboardingDone: session.onboardingDone,
    setupStep1Done: session.setupStep1Done,
    setupStep1Skipped: session.setupStep1Skipped,
    setupStep2Done: session.setupStep2Done,
    googleName: session.googleName,
    googleEmail: session.googleEmail,
    googleImage: session.googleImage,
  };

  const profile = await getKundeProfile(kunde.rowIndex);

  // Replace the session with the customer's identity, but keep
  // `impersonatedBy` + `originalSession` so we can restore.
  session.isLoggedIn = true;
  session.isAdmin = false;
  session.lizenzschluessel = kunde.lizenzschluessel;
  session.sku = kunde.sku;
  session.shopDomain = kunde.shopDomain || undefined;
  session.shopifyToken = kunde.shopifyToken || undefined;
  session.hasShopifyConnection = !!kunde.shopifyToken;
  session.onboardingDone = !!profile.hasCompletedOnboarding;
  session.setupStep1Done = !!kunde.shopifyToken;
  session.setupStep1Skipped = false;
  session.setupStep2Done = false;
  // Wipe Google identity so the impersonated context doesn't pretend
  // to be the admin's Google account in the UI.
  session.googleName = undefined;
  session.googleEmail = undefined;
  session.googleImage = undefined;
  session.impersonatedBy = adminIdentifier;
  session.originalSession = JSON.stringify(snapshot);
  await session.save();

  void logSystemEvent({
    level: "audit",
    actor: adminIdentifier,
    action: "impersonate.start",
    target: kunde.lizenzschluessel,
    details: { email: kunde.kundenEmail },
  });

  return NextResponse.json({ success: true, redirect: "/home" });
}
