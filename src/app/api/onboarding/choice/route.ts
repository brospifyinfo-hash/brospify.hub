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

    if (mode === "full") {
      session.hasShopifyConnection = false; // will be set to true after OAuth
      session.onboardingDone = true;
      await session.save();
      return NextResponse.json({ redirect: "/setup" });
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
