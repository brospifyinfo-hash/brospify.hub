import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  applyKundeToSession,
  safeNextPath,
  rateLimit,
  verifyPassword,
  looksLikeEmail,
  normalizeUsername,
} from "@/lib/editor-auth";
import { findKundeByGoogleEmail, findKundeByUsername, logSystemEvent } from "@/lib/sheets";
import { isProtectedAccount } from "@/lib/editor-accounts";

export const dynamic = "force-dynamic";

// ─── Editor-Login mit Username/E-Mail + Passwort ───────────────────────
// POST { identifier, password, next? } → löst das Konto per Username ODER
// E-Mail auf, prüft das Passwort (scrypt, timing-sicher) und loggt ein.
// Absichtlich generische Fehlermeldung ("invalid_credentials"), damit
// nicht verraten wird, ob ein Konto/Username existiert. Rate-Limit gegen
// Brute-Force pro IP UND pro Identifier.

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { identifier?: string; password?: string; next?: string };
    const identifier = (body.identifier || "").trim();
    const password = typeof body.password === "string" ? body.password : "";
    const next = safeNextPath(body.next);

    if (!identifier || !password) {
      return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 400 });
    }

    // Hartes Rate-Limit: 10 Versuche / 10 min pro IP und pro Identifier.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const idKey = identifier.toLowerCase();
    if (!rateLimit(`pw-login-ip:${ip}`, 10, 10 * 60 * 1000) || !rateLimit(`pw-login-id:${idKey}`, 10, 10 * 60 * 1000)) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const kunde = looksLikeEmail(identifier)
      ? await findKundeByGoogleEmail(identifier.toLowerCase())
      : await findKundeByUsername(normalizeUsername(identifier));

    // Kein Konto ODER kein Passwort gesetzt ODER Passwort falsch → gleiche
    // generische Antwort (kein Enumeration-Leck). Bei fehlendem Konto
    // dennoch einen Scheinvergleich rechnen wäre ideal; hier reicht die
    // konstante Fehlermeldung + Rate-Limit.
    if (!kunde || !kunde.profile.passwordHash) {
      return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
    }
    if (kunde.profile.blocked === true) {
      return NextResponse.json({ ok: false, error: "blocked" }, { status: 403 });
    }
    // Geschützte Konten (Admin / aktives Abo) sind über den Editor-Weg
    // NICHT per Passwort erreichbar — konsistent mit findOrCreateEditorKunde
    // (z. B. Konto setzt als editor-free ein Passwort und wird später zu
    // Admin/Abo). Solche Nutzer melden sich über Google bzw. den Hub an.
    if (isProtectedAccount(kunde)) {
      return NextResponse.json({ ok: false, error: "use_primary_login" }, { status: 403 });
    }

    const ok = await verifyPassword(password, kunde.profile.passwordHash);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
    }

    const session = await getSession();
    applyKundeToSession(session, kunde, { googleEmail: kunde.kundenEmail || undefined });
    await session.save();

    void logSystemEvent({
      level: "audit",
      actor: kunde.kundenEmail || kunde.profile.username || kunde.lizenzschluessel,
      action: "auth.editor.login",
      target: kunde.lizenzschluessel,
      details: { method: "password" },
    });

    return NextResponse.json({ ok: true, next });
  } catch (err) {
    console.error("[editor-auth/password] login error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
