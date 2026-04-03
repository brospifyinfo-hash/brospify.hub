import { NextRequest, NextResponse } from "next/server";
import { findKundeByKey } from "@/lib/sheets";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const { lizenzschluessel } = await req.json();

    if (!lizenzschluessel || typeof lizenzschluessel !== "string") {
      return NextResponse.json(
        { error: "Bitte gib einen Lizenzschlüssel ein." },
        { status: 400 }
      );
    }

    const trimmedKey = lizenzschluessel.trim();

    // Admin check
    if (trimmedKey === "Hat-Jonas") {
      const session = await getSession();
      session.isLoggedIn = true;
      session.isAdmin = true;
      await session.save();
      return NextResponse.json({ redirect: "/admin" });
    }

    // Customer check
    const kunde = await findKundeByKey(trimmedKey);
    if (!kunde) {
      return NextResponse.json(
        { error: "Ungültiger Lizenzschlüssel. Bitte überprüfe deine Eingabe." },
        { status: 401 }
      );
    }

    const session = await getSession();
    session.isLoggedIn = true;
    session.isAdmin = false;
    session.lizenzschluessel = kunde.lizenzschluessel;
    session.sku = kunde.sku;
    session.shopDomain = kunde.shopDomain || undefined;
    session.shopifyToken = kunde.shopifyToken || undefined;
    session.setupStep1Done = !!kunde.shopifyToken;
    session.setupStep2Done = false;
    await session.save();

    return NextResponse.json({ redirect: "/setup" });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten. Bitte versuche es erneut." },
      { status: 500 }
    );
  }
}
