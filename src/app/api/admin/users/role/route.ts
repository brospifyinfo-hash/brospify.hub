// ─── /api/admin/users/role ───────────────────────────────────────
// Promote / demote a user. Body: { key, role: "admin" | "user" }
// Writes a SystemLogs audit entry on every change so we can trace
// who flipped what when.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  findKundeByKey,
  getKundeProfile,
  logSystemEvent,
  setUserRole,
  type UserRole,
} from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  let body: { key?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const key = String(body.key || "").trim();
  const role = String(body.role || "").trim() as UserRole;
  if (!key) {
    return NextResponse.json({ error: "key fehlt." }, { status: 400 });
  }
  if (role !== "admin" && role !== "user") {
    return NextResponse.json({ error: "role muss 'admin' oder 'user' sein." }, { status: 400 });
  }

  const kunde = await findKundeByKey(key);
  if (!kunde) {
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  }

  const profile = await getKundeProfile(kunde.rowIndex);
  const prev = (profile.role as UserRole) || "user";
  if (prev === role) {
    return NextResponse.json({ success: true, role, unchanged: true });
  }

  await setUserRole(kunde.rowIndex, profile, role);

  const actor = session.googleEmail || session.lizenzschluessel || "admin";
  void logSystemEvent({
    level: "audit",
    actor,
    action: role === "admin" ? "role.promote" : "role.demote",
    target: kunde.lizenzschluessel,
    details: { prev, next: role, email: kunde.kundenEmail },
  });

  return NextResponse.json({ success: true, role, prev });
}
