import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey, getKundeProfile, updateKundeProfile } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// POST — toggle a start-task completion flag for the current user.
// Body: { id: string; done: boolean }
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    // Admin login is keyless — there's no customer row to write into,
    // so we just no-op gracefully. UI will still update locally.
    if (session.isAdmin) {
      return NextResponse.json({ success: true, persisted: false });
    }
    const body = await req.json();
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });
    const done = body.done !== false;

    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde) {
      return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
    }
    const profile = await getKundeProfile(kunde.rowIndex);
    const map = { ...(profile.onboarding_tasks_done || {}) };
    if (done) map[id] = true;
    else delete map[id];
    profile.onboarding_tasks_done = map;
    await updateKundeProfile(kunde.rowIndex, profile);
    return NextResponse.json({ success: true, persisted: true });
  } catch (err) {
    console.error("[StartTasks/done] POST error:", err);
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
