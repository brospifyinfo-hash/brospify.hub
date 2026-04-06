import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey, getKundeProfile, updateKundeProfile } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// POST — mark onboarding as completed
export async function POST() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde) {
      return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
    }

    const profile = await getKundeProfile(kunde.rowIndex);
    profile.hasCompletedOnboarding = true;
    await updateKundeProfile(kunde.rowIndex, profile);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Onboarding] Error:", error);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
