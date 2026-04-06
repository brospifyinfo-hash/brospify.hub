import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey, getKundeProfile, updateKundeProfile } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// POST — link a Google email to this customer profile
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { googleEmail } = await req.json();
    if (!googleEmail || typeof googleEmail !== "string" || !googleEmail.includes("@")) {
      return NextResponse.json({ error: "Ungültige E-Mail." }, { status: 400 });
    }

    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde) {
      return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
    }

    const profile = await getKundeProfile(kunde.rowIndex);
    profile.linkedGoogleEmail = googleEmail.toLowerCase();
    await updateKundeProfile(kunde.rowIndex, profile);

    return NextResponse.json({ success: true, linkedEmail: profile.linkedGoogleEmail });
  } catch (error) {
    console.error("[Link Google] Error:", error);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
