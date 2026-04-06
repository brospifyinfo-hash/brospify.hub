import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAllKunden, getKundeProfile } from "@/lib/sheets";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// After Google sign-in, this route maps the Google email to a Kunden entry
// and creates an iron-session (same as license key login)
export async function GET(req: NextRequest) {
  try {
    const authSession = await auth();

    if (!authSession?.user?.email) {
      return NextResponse.redirect(new URL("/?error=no_email", req.url));
    }

    const email = authSession.user.email.toLowerCase();
    const kunden = await getAllKunden();

    // Match by kunden email OR by linked Google email in Profil_JSON
    let kunde = kunden.find(
      (k) => k.kundenEmail.toLowerCase() === email
    );

    if (!kunde) {
      // Check if any customer has linked this Google email
      for (const k of kunden) {
        if (k.profile?.linkedGoogleEmail?.toLowerCase() === email) {
          kunde = k;
          break;
        }
      }
    }

    if (!kunde) {
      return NextResponse.redirect(
        new URL("/?error=no_license", req.url)
      );
    }

    // Create iron-session (same fields as license key login)
    const session = await getSession();
    session.isLoggedIn = true;
    session.isAdmin = false;
    session.lizenzschluessel = kunde.lizenzschluessel;
    session.sku = kunde.sku;
    session.shopDomain = kunde.shopDomain || undefined;
    session.shopifyToken = kunde.shopifyToken || undefined;
    session.setupStep1Done = !!kunde.shopifyToken;
    session.setupStep2Done = false;
    session.googleName = authSession.user.name || undefined;
    session.googleEmail = authSession.user.email || undefined;
    session.googleImage = authSession.user.image || undefined;

    if (kunde.shopifyToken) {
      session.hasShopifyConnection = true;
      session.onboardingDone = true;
    }

    await session.save();

    // Check onboarding status from Profil_JSON
    const profile = await getKundeProfile(kunde.rowIndex);

    if (!profile.hasCompletedOnboarding) {
      return NextResponse.redirect(new URL("/language", req.url));
    }

    return NextResponse.redirect(new URL("/home", req.url));
  } catch (error) {
    console.error("[Google Callback] Error:", error);
    return NextResponse.redirect(new URL("/?error=server", req.url));
  }
}
