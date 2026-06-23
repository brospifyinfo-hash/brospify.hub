import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  findKundeByGoogleEmail,
  findKundeByKey,
  getKundeProfile,
  logSystemEvent,
  updateKundeProfile,
} from "@/lib/sheets";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET — Rückkehr-Ziel des Google-OAuth im Onboarding-Wizard (Schritt 2).
// Der Nutzer ist bereits per Lizenzschlüssel eingeloggt (iron-session). Diese
// Route verknüpft die nun authentifizierte Google-E-Mail mit seinem Profil,
// markiert das Onboarding als abgeschlossen und leitet in die interaktive
// Tour (/home?tour=1).
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.lizenzschluessel) {
      // Keine gültige Lizenz-Session — zurück zum Login.
      return NextResponse.redirect(new URL("/", req.url));
    }

    const authSession = await auth();
    const email = authSession?.user?.email?.toLowerCase();

    if (email) {
      // Sicherstellen, dass diese Google-E-Mail nicht schon einem ANDEREN
      // Konto gehört (sonst könnten sich zwei Lizenzen dieselbe Mail teilen).
      const existing = await findKundeByGoogleEmail(email);
      if (existing && existing.lizenzschluessel !== session.lizenzschluessel) {
        return NextResponse.redirect(
          new URL("/onboarding?google=taken", req.url)
        );
      }

      const kunde = await findKundeByKey(session.lizenzschluessel);
      if (kunde) {
        const profile = await getKundeProfile(kunde.rowIndex);
        profile.linkedGoogleEmail = email;
        if (!profile.displayName && authSession?.user?.name) {
          profile.displayName = authSession.user.name.slice(0, 60);
        }
        profile.hasCompletedOnboarding = true;
        await updateKundeProfile(kunde.rowIndex, profile);

        session.googleEmail = email;
        session.googleName = authSession?.user?.name || session.googleName;
        session.googleImage = authSession?.user?.image || session.googleImage;
        await session.save();

        void logSystemEvent({
          level: "audit",
          actor: kunde.lizenzschluessel,
          action: "onboarding.google_linked",
          target: email,
          details: { method: "onboarding" },
        });
      }
    }

    return NextResponse.redirect(new URL("/home?tour=1", req.url));
  } catch (error) {
    console.error("[Onboarding Link Google] Error:", error);
    return NextResponse.redirect(new URL("/home?tour=1", req.url));
  }
}
