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
import { findOrCreateEditorKunde } from "@/lib/editor-accounts";

export const dynamic = "force-dynamic";

// After Google sign-in, this route maps the Google email to a Kunden entry
// and creates an iron-session (same as license key login).
export async function GET(req: NextRequest) {
  // Optionales Post-Login-Ziel (Standalone-Landing → Theme-Editor). Nur
  // interne, absolute Pfade zulassen (Open-Redirect-Schutz): muss mit „/"
  // beginnen, aber nicht mit „//" (protocol-relative) oder „/\".
  const nextParam = req.nextUrl.searchParams.get("next");
  const safeNext =
    nextParam && /^\/(?![/\\])/.test(nextParam) ? nextParam : null;

  // Fehler-Ziel: Kommt der Login aus dem Editor-Funnel (next gesetzt), landen
  // Fehler auf der EIGENEN hellen Login-Seite der Editor-Website — nicht auf
  // dem Hub-Login. Hub-Logins (ohne next) behalten ihr bisheriges Verhalten.
  const errTo = (code: string) =>
    safeNext
      ? `/start/login?error=${code}&next=${encodeURIComponent(safeNext)}`
      : `/?error=${code}`;

  try {
    const authSession = await auth();

    if (!authSession?.user?.email) {
      return NextResponse.redirect(new URL(errTo("no_email"), req.url));
    }

    const email = authSession.user.email;
    let kunde = await findKundeByGoogleEmail(email);

    if (!kunde) {
      // Editor-Funnel (next gesetzt): Selbst-Registrierung — beim ersten
      // Login entsteht automatisch ein Gratis-Konto (EDITOR_STARTER_CREDITS,
      // kein Abo-SKU, kein Recurring). Hub-Logins ohne next behalten die
      // bisherige Ablehnung unbekannter Konten.
      if (safeNext) {
        const created = await findOrCreateEditorKunde({
          provider: "google",
          email,
          displayName: authSession.user.name || undefined,
        });
        if (!created.ok) {
          return NextResponse.redirect(new URL(errTo(created.error), req.url));
        }
        kunde = created.kunde;
      } else {
        return NextResponse.redirect(new URL(errTo("no_license"), req.url));
      }
    }

    if (kunde.profile.blocked === true) {
      void logSystemEvent({
        level: "warn",
        actor: email,
        action: "auth.login.blocked",
        target: kunde.lizenzschluessel,
        details: { method: "google" },
      });
      return NextResponse.redirect(new URL(errTo("blocked"), req.url));
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

    // Editor-Funnel: IMMER direkt ins gewünschte Ziel (z. B.
    // /editor?start=own) — auch Admins und Nicht-Onboardete landen dort,
    // das Hub-Onboarding gehört nicht zur Editor-Website.
    if (safeNext) {
      return NextResponse.redirect(new URL(safeNext, req.url));
    }

    if (isAdminRole) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }

    if (!profile.hasCompletedOnboarding) {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }

    return NextResponse.redirect(new URL("/home", req.url));
  } catch (error) {
    console.error("[Google Callback] Error:", error);
    return NextResponse.redirect(new URL(errTo("server"), req.url));
  }
}
