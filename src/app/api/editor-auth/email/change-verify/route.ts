import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  rateLimit,
  verifyEmailLoginCodeHash,
  bumpCodeAttempt,
  clearCodeAttempts,
  EMAIL_CODE_MAX_ATTEMPTS,
} from "@/lib/editor-auth";
import { findKundeByKey, findKundeByGoogleEmail, updateKundeField, logSystemEvent } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── E-Mail ändern — Schritt 2: Code einlösen ──────────────────────────
// POST { code } (eingeloggt). Prüft den Code gegen die pending-Änderung
// (an die NEUE Adresse gebunden), stellt dann kundenEmail (Spalte E) um.

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.isAdmin || !session.lizenzschluessel) {
      return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });
    }
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!rateLimit(`email-change-verify-ip:${ip}`, 30, 10 * 60 * 1000)) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const pending = session.editorEmailChange;
    // Nur die Änderung des eingeloggten Kontos zulassen.
    if (!pending || pending.lizenzschluessel !== session.lizenzschluessel) {
      return NextResponse.json({ ok: false, error: "code_missing" }, { status: 400 });
    }
    if (Date.now() > pending.expiresAt) {
      session.editorEmailChange = undefined;
      await session.save();
      clearCodeAttempts(pending.codeId);
      return NextResponse.json({ ok: false, error: "code_expired" }, { status: 400 });
    }

    const code = ((await req.json().catch(() => ({}))) as { code?: string }).code || "";
    const digits = code.replace(/\D/g, "");

    const used = bumpCodeAttempt(pending.codeId);
    if (used > EMAIL_CODE_MAX_ATTEMPTS) {
      session.editorEmailChange = undefined;
      await session.save();
      clearCodeAttempts(pending.codeId);
      return NextResponse.json({ ok: false, error: "too_many_attempts" }, { status: 429 });
    }
    if (digits.length !== 6 || !verifyEmailLoginCodeHash(pending.newEmail, digits, pending.codeHash)) {
      return NextResponse.json(
        { ok: false, error: "code_wrong", attemptsLeft: Math.max(0, EMAIL_CODE_MAX_ATTEMPTS - used) },
        { status: 401 },
      );
    }

    // Re-Check Verfügbarkeit (Race seit change-request) + Konto laden.
    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde) return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
    const owner = await findKundeByGoogleEmail(pending.newEmail);
    if (owner && owner.lizenzschluessel !== kunde.lizenzschluessel) {
      session.editorEmailChange = undefined;
      await session.save();
      clearCodeAttempts(pending.codeId);
      return NextResponse.json({ ok: false, error: "email_taken" }, { status: 409 });
    }

    // kundenEmail = Spalte E.
    await updateKundeField(kunde.rowIndex, "E", pending.newEmail);
    session.editorEmailChange = undefined;
    session.googleEmail = pending.newEmail;
    await session.save();
    clearCodeAttempts(pending.codeId);

    void logSystemEvent({
      level: "audit",
      actor: kunde.lizenzschluessel,
      action: "auth.editor.email_changed",
      target: kunde.lizenzschluessel,
      details: { newEmail: pending.newEmail },
    });

    return NextResponse.json({ ok: true, email: pending.newEmail });
  } catch (err) {
    console.error("[editor-auth/email/change-verify] error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
