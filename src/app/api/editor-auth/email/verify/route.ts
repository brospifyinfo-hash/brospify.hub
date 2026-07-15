import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  applyKundeToSession,
  safeNextPath,
  verifyEmailLoginCodeHash,
  bumpCodeAttempt,
  clearCodeAttempts,
  rateLimit,
  EMAIL_CODE_MAX_ATTEMPTS,
} from "@/lib/editor-auth";
import { findOrCreateEditorKunde } from "@/lib/editor-accounts";
import { logSystemEvent } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// ─── Editor-Login per E-Mail — Schritt 2: Code einlösen ────────────────
// POST { code, next? } → prüft den Code gegen den in DIESER Browser-
// Session hinterlegten Hash. Brute-Force-Schutz in mehreren Schichten:
//  1) Per-IP-Rate-Limit auf dieser Route (deckelt den Rate-Durchsatz —
//     auch wenn jemand den attempts:0-Cookie erneut abspielt),
//  2) SERVERSEITIGER Fehlversuch-Zähler pro Code-ID (bumpCodeAttempt) —
//     liegt NICHT im mitgeschickten Cookie, ist also nicht replaybar,
//  3) kurze TTL (15 min) auf dem Code selbst.
// Bei Erfolg: Konto finden oder Gratis-Konto anlegen, Session setzen.

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { code?: string; next?: string };
    const code = (body.code || "").replace(/\D/g, "");
    const next = safeNextPath(body.next);

    // Schicht 1: hartes Per-IP-Limit gegen Bruteforce/Cookie-Replay.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!rateLimit(`otp-verify-ip:${ip}`, 30, 10 * 60 * 1000)) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const session = await getSession();
    const pending = session.editorEmailLogin;

    if (!pending) {
      return NextResponse.json({ ok: false, error: "code_missing" }, { status: 400 });
    }
    if (Date.now() > pending.expiresAt) {
      session.editorEmailLogin = undefined;
      await session.save();
      clearCodeAttempts(pending.codeId);
      return NextResponse.json({ ok: false, error: "code_expired" }, { status: 400 });
    }

    // Schicht 2: serverseitiger Zähler — hier hochzählen, BEVOR der Code
    // geprüft wird. Cookie-Replay des attempts:0-Snapshots hilft nicht,
    // weil dieser Zähler nicht im Cookie steckt.
    const used = bumpCodeAttempt(pending.codeId);
    if (used > EMAIL_CODE_MAX_ATTEMPTS) {
      session.editorEmailLogin = undefined;
      await session.save();
      clearCodeAttempts(pending.codeId);
      return NextResponse.json({ ok: false, error: "too_many_attempts" }, { status: 429 });
    }

    if (code.length !== 6 || !verifyEmailLoginCodeHash(pending.email, code, pending.codeHash)) {
      // Zähler steht serverseitig — Session bleibt unverändert (kein neues
      // Set-Cookie nötig, keine Manipulationsfläche).
      return NextResponse.json(
        { ok: false, error: "code_wrong", attemptsLeft: Math.max(0, EMAIL_CODE_MAX_ATTEMPTS - used) },
        { status: 401 },
      );
    }

    // Code korrekt → einloggen. Bei einem TRANSIENTEN Server-Fehler bleibt
    // der Code gültig (Nutzer drückt einfach nochmal „Anmelden"); nur bei
    // Erfolg oder harter Ablehnung wird er endgültig entwertet.
    const result = await findOrCreateEditorKunde({ provider: "email", email: pending.email });
    if (!result.ok) {
      if (result.error !== "server") {
        session.editorEmailLogin = undefined;
        await session.save();
        clearCodeAttempts(pending.codeId);
      }
      return NextResponse.json({ ok: false, error: result.error }, { status: result.error === "server" ? 500 : 403 });
    }

    session.editorEmailLogin = undefined;
    clearCodeAttempts(pending.codeId);
    applyKundeToSession(session, result.kunde, { googleEmail: pending.email });
    await session.save();

    void logSystemEvent({
      level: "audit",
      actor: pending.email,
      action: result.created ? "auth.editor.signup" : "auth.editor.login",
      target: result.kunde.lizenzschluessel,
      details: { method: "email-code" },
    });

    return NextResponse.json({ ok: true, next });
  } catch (err) {
    console.error("[editor-auth/email] verify error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
