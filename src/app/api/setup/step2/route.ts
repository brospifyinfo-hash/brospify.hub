import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();
  if (!session.isLoggedIn || session.isAdmin) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  session.setupStep2Done = true;
  await session.save();
  return NextResponse.json({ success: true });
}
