import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey, getKundeProfile, updateKundeProfile } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// POST — markiert die Einführungs-Tour als gesehen (hasSeenTour=true).
// Getrennt von /api/profile/onboarding, damit auch Bestandskunden die Tour
// einmalig bekommen, ohne den Onboarding-Status zu verändern.
export async function POST() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.lizenzschluessel) {
      // Admins (ohne Lizenz) brauchen kein Persistieren — einfach ok.
      return NextResponse.json({ success: true, persisted: false });
    }

    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde) {
      return NextResponse.json({ success: true, persisted: false });
    }

    const profile = await getKundeProfile(kunde.rowIndex);
    if (!profile.hasSeenTour) {
      profile.hasSeenTour = true;
      await updateKundeProfile(kunde.rowIndex, profile);
    }

    return NextResponse.json({ success: true, persisted: true });
  } catch (error) {
    console.error("[Tour Seen] Error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
