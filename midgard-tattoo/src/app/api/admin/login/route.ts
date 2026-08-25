// ─── POST /api/admin/login ────────────────────────────────
// Anmeldung des Studio-Inhabers. Passwortvergleich in konstanter Zeit,
// Fehlversuche pro IP gedrosselt, Session als verschlüsseltes Cookie.

import { NextRequest, NextResponse } from "next/server";
import {
  checkStudioPassword,
  clearAttempts,
  clientKey,
  getStudioSession,
  isRateLimited,
  isStudioAdminConfigured,
  noteFailedAttempt,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isStudioAdminConfigured()) {
    return NextResponse.json(
      { error: "Der Admin-Bereich ist nicht eingerichtet (TATTOO_ADMIN_PASSWORD fehlt)." },
      { status: 503 },
    );
  }

  const key = await clientKey();
  if (isRateLimited(key)) {
    return NextResponse.json(
      { error: "Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen." },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => null)) as { password?: string } | null;
  const password = typeof body?.password === "string" ? body.password : "";

  if (!password || !checkStudioPassword(password)) {
    noteFailedAttempt(key);
    // Bewusst dieselbe Meldung für „leer" und „falsch": kein Hinweis
    // darauf, ob ein Passwort überhaupt gesetzt ist.
    return NextResponse.json({ error: "Passwort stimmt nicht." }, { status: 401 });
  }

  clearAttempts(key);
  const session = await getStudioSession();
  session.isStudioAdmin = true;
  session.loggedInAt = Date.now();
  await session.save();

  return NextResponse.json({ ok: true });
}
