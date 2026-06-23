import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  ensureSignupAt,
  ensureStarterGrant,
  findKundeByGoogleEmail,
  getKundeProfile,
  logSystemEvent,
} from "@/lib/sheets";
import { applySessionLifetime, getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// After Google sign-in, this route maps the Google email to a Kunden entry
// and creates an iron-session (same as license key login).
export async function GET(req: NextRequest) {
  try {
    const authSession = await auth();

    if (!authSession?.user?.email) {
      return NextResponse.redirect(new URL("/?error=no_email", req.url));
    }

    const email = authSession.user.email;
    const kunde = await findKundeByGoogleEmail(email);

    if (!kunde) {
      return NextResponse.redirect(
        new URL("/?error=no_license", req.url)
      );
    }

    if (kunde.profile.blocked === true) {
      void logSystemEvent({
        level: "warn",
        actor: email,
        action: "auth.login.blocked",
        target: kunde.lizenzschluessel,
        details: { method: "google" },
      });
      return NextResponse.redirect(new URL("/?error=blocked", req.url));
    }

    const isAdminRole = kunde.profile.role === "admin";

    // „Angemeldet bleiben" wird über die Callback-URL durch den OAuth-
    // Round-Trip getragen (?remember=1). Google-Logins sollen standardmäßig
    // persistent sein; nur ?remember=0 erzeugt ein Session-Cookie.
    const remember = req.nextUrl.searchParams.get("remember") !== "0";

    // Create iron-session (same fields as license key login)
    const session = await getSession();
    session.isLoggedIn = true;
    session.isAdmin = isAdminRole;
    session.lizenzschluessel = kunde.lizenzschluessel;
    session.sku = kunde.sku;
    session.shopDomain = kunde.shopDomain || undefined;
    session.shopifyToken = kunde.shopifyToken || undefined;
    session.setupStep1Done = !!kunde.shopifyToken;
    session.setupStep2Done = false;
    session.googleName = authSession.user.name || undefined;
    session.googleEmail = authSession.user.email || undefined;
    session.googleImage = authSession.user.image || undefined;
    session.rememberMe = remember;
    applySessionLifetime(session, remember);

    if (kunde.shopifyToken) {
      session.hasShopifyConnection = true;
      session.onboardingDone = true;
    }

    await session.save();

    // Profile housekeeping
    const rawProfile = await getKundeProfile(kunde.rowIndex);
    let profile = await ensureStarterGrant(kunde.rowIndex, rawProfile);
    profile = await ensureSignupAt(kunde.rowIndex, profile);

    void logSystemEvent({
      level: "audit",
      actor: email,
      action: isAdminRole ? "auth.login.admin" : "auth.login",
      target: kunde.lizenzschluessel,
      details: { method: "google" },
    });

    if (isAdminRole) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }

    if (!profile.hasCompletedOnboarding) {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }

    return NextResponse.redirect(new URL("/home", req.url));
  } catch (error) {
    console.error("[Google Callback] Error:", error);
    return NextResponse.redirect(new URL("/?error=server", req.url));
  }
}
