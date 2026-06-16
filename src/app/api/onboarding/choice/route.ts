import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }

    const { mode } = await req.json();

    if (mode === "quick") {
      session.hasShopifyConnection = false;
      session.onboardingDone = true;
      await session.save();
      return NextResponse.json({ redirect: "/home" });
    }

    // "full" (Shop verbinden) gibt es nicht mehr — Setup wurde entfernt.
    // Wir leiten jeden gültigen Modus zur Home.
    if (mode === "full") {
      session.onboardingDone = true;
      await session.save();
      return NextResponse.json({ redirect: "/home" });
    }

    return NextResponse.json({ error: "Ungültiger Modus" }, { status: 400 });
  } catch (error) {
    console.error("Onboarding choice error:", error);
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten." },
      { status: 500 }
    );
  }
}
