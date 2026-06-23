import { NextRequest, NextResponse } from "next/server";
import { applySessionLifetime, getSession } from "@/lib/session";
import { findKundeByKey, getKundeProfile, updateKundeProfile } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// POST — Schritt 1 des Erstlogin-Wizards: Anzeigename + Sprache + „angemeldet
// bleiben". Speichert Name/Sprache im Profil und wendet die Cookie-Lebensdauer
// an. Markiert das Onboarding NICHT als abgeschlossen (das passiert erst nach
// dem Google-Schritt bzw. dem Überspringen).
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const displayName = String(body.displayName || "").trim().slice(0, 60);
    const language = body.language === "en" ? "en" : "de";
    const remember = body.rememberMe === true;

    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde) {
      return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
    }

    const profile = await getKundeProfile(kunde.rowIndex);
    if (displayName) profile.displayName = displayName;
    profile.language = language;
    await updateKundeProfile(kunde.rowIndex, profile);

    // „Angemeldet bleiben" auf das Cookie anwenden (Upgrade auf persistent
    // oder Downgrade auf Session-Cookie) und Anzeigename in der Session
    // spiegeln, damit die Navigation ihn sofort zeigt.
    session.rememberMe = remember;
    if (displayName) session.googleName = session.googleName || displayName;
    applySessionLifetime(session, remember);
    await session.save();

    return NextResponse.json({ success: true, language });
  } catch (error) {
    console.error("[Onboarding Setup] Error:", error);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
