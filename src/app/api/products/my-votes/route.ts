// ─── /api/products/my-votes ───────────────────────────────
// Liefert die Voting-Map des aktuell eingeloggten Users:
// { votes: { [produktId]: "up" | "down" } }
//
// Verwendet vom Charts-Frontend um die Pfeil-Buttons korrekt
// hervorzuheben (welcher Pfeil ist schon geklickt).

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || session.isAdmin || !session.lizenzschluessel) {
    return NextResponse.json({ votes: {} });
  }
  try {
    const kunde = await findKundeByKey(session.lizenzschluessel);
    return NextResponse.json({
      votes: kunde?.profile?.votedProducts || {},
    });
  } catch (err) {
    console.warn("[my-votes] error:", err);
    return NextResponse.json({ votes: {} });
  }
}
