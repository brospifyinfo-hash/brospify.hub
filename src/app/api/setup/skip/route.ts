import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.isAdmin) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    session.setupStep1Done = true;
    session.setupStep1Skipped = true;
    await session.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Skip error:", error);
    return NextResponse.json(
      { error: "Fehler beim Überspringen." },
      { status: 500 }
    );
  }
}
