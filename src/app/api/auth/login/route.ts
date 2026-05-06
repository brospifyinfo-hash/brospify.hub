import { NextRequest, NextResponse } from "next/server";
import {
  ensureSignupAt,
  ensureStarterGrant,
  findKundeByKey,
  getKundeProfile,
  logSystemEvent,
} from "@/lib/sheets";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const { lizenzschluessel } = await req.json();

    if (!lizenzschluessel || typeof lizenzschluessel !== "string") {
      return NextResponse.json(
        { error: "Bitte gib einen Lizenzschlüssel ein." },
        { status: 400 }
      );
    }

    const trimmedKey = lizenzschluessel.trim();

    // Master admin key — hardcoded escape hatch that always works,
    // independent of any DB role state. Kept on top intentionally.
    if (trimmedKey === "Hat-Jonas") {
      const session = await getSession();
      session.isLoggedIn = true;
      session.isAdmin = true;
      await session.save();
      void logSystemEvent({
        level: "audit",
        actor: "Hat-Jonas",
        action: "auth.login.master",
        target: "",
        details: { method: "master-key" },
      });
      return NextResponse.json({ redirect: "/admin" });
    }

    // Customer check
    const kunde = await findKundeByKey(trimmedKey);
    if (!kunde) {
      return NextResponse.json(
        { error: "Ungültiger Lizenzschlüssel. Bitte überprüfe deine Eingabe." },
        { status: 401 }
      );
    }

    if (kunde.profile.blocked === true) {
      void logSystemEvent({
        level: "warn",
        actor: kunde.lizenzschluessel,
        action: "auth.login.blocked",
        target: kunde.lizenzschluessel,
        details: { method: "key" },
      });
      return NextResponse.json(
        { error: "Dieser Account wurde deaktiviert. Bitte kontaktiere den Support." },
        { status: 403 }
      );
    }

    const isAdminRole = kunde.profile.role === "admin";

    const session = await getSession();
    session.isLoggedIn = true;
    session.isAdmin = isAdminRole;
    session.lizenzschluessel = kunde.lizenzschluessel;
    session.sku = kunde.sku;
    session.shopDomain = kunde.shopDomain || undefined;
    session.shopifyToken = kunde.shopifyToken || undefined;
    session.setupStep1Done = !!kunde.shopifyToken;
    session.setupStep2Done = false;

    if (kunde.shopifyToken) {
      session.hasShopifyConnection = true;
      session.onboardingDone = true;
    }
    await session.save();

    // Profile housekeeping: starter grant + signupAt backfill.
    const rawProfile = await getKundeProfile(kunde.rowIndex);
    let profile = await ensureStarterGrant(kunde.rowIndex, rawProfile);
    profile = await ensureSignupAt(kunde.rowIndex, profile);

    void logSystemEvent({
      level: "audit",
      actor: kunde.lizenzschluessel,
      action: isAdminRole ? "auth.login.admin" : "auth.login",
      target: kunde.lizenzschluessel,
      details: { method: "key" },
    });

    if (isAdminRole) {
      return NextResponse.json({ redirect: "/admin" });
    }

    if (!profile.hasCompletedOnboarding) {
      return NextResponse.json({ redirect: "/onboarding" });
    }

    return NextResponse.json({ redirect: "/home" });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten. Bitte versuche es erneut." },
      { status: 500 }
    );
  }
}
