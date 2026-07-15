import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { applyKundeToSession, verifyEmailLoginToken } from "@/lib/editor-auth";
import { findOrCreateEditorKunde } from "@/lib/editor-accounts";
import { logSystemEvent } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// ─── Editor-Login per E-Mail — Schritt 2: Link einlösen ────────────────
// GET ?token=… → Signatur/Ablauf prüfen, Konto finden oder Gratis-Konto
// anlegen, Session setzen, weiter ins Ziel (z. B. /editor?start=own).

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const payload = verifyEmailLoginToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL("/start/login?error=email_expired", req.url));
  }
  const errTo = (code: string) =>
    NextResponse.redirect(new URL(`/start/login?error=${code}&next=${encodeURIComponent(payload.next)}`, req.url));

  try {
    const result = await findOrCreateEditorKunde({ provider: "email", email: payload.email });
    if (!result.ok) return errTo(result.error);

    const session = await getSession();
    applyKundeToSession(session, result.kunde, { googleEmail: payload.email });
    await session.save();

    void logSystemEvent({
      level: "audit",
      actor: payload.email,
      action: result.created ? "auth.editor.signup" : "auth.editor.login",
      target: result.kunde.lizenzschluessel,
      details: { method: "email" },
    });

    return NextResponse.redirect(new URL(payload.next, req.url));
  } catch (err) {
    console.error("[editor-auth/email] callback error:", err);
    return errTo("server");
  }
}
