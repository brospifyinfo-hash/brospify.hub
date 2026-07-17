import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { rateLimit, verifyPassword, validatePassword, hashPassword } from "@/lib/editor-auth";
import { findKundeByKey, updateKundeProfile, logSystemEvent } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Passwort setzen/ändern (eingeloggt) ───────────────────────────────
// POST { currentPassword?, newPassword }.
//  - Konto HAT bereits ein Passwort → currentPassword muss stimmen.
//  - Konto hat KEINS (Google/Shopify/Code-Login) → currentPassword nicht
//    nötig, es wird erstmalig eins gesetzt.
// Die Session beweist die Konto-Inhaberschaft; zusätzlich Rate-Limit.

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.isAdmin || !session.lizenzschluessel) {
      return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });
    }
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!rateLimit(`pw-change:${session.lizenzschluessel}`, 8, 10 * 60 * 1000) || !rateLimit(`pw-change-ip:${ip}`, 20, 10 * 60 * 1000)) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const body = (await req.json().catch(() => ({}))) as { currentPassword?: string; newPassword?: string };
    if (!validatePassword(body.newPassword)) {
      return NextResponse.json({ ok: false, error: "password_weak" }, { status: 400 });
    }

    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde) return NextResponse.json({ ok: false, error: "server" }, { status: 500 });

    const existingHash = kunde.profile.passwordHash;
    if (existingHash) {
      const cur = typeof body.currentPassword === "string" ? body.currentPassword : "";
      if (!cur || !(await verifyPassword(cur, existingHash))) {
        return NextResponse.json({ ok: false, error: "current_wrong" }, { status: 403 });
      }
    }

    const newHash = await hashPassword(body.newPassword as string);
    await updateKundeProfile(kunde.rowIndex, {
      ...kunde.profile,
      passwordHash: newHash,
      passwordSetAt: new Date().toISOString(),
    });

    void logSystemEvent({
      level: "audit",
      actor: kunde.kundenEmail || kunde.profile.username || kunde.lizenzschluessel,
      action: existingHash ? "auth.editor.password_changed" : "auth.editor.password_set",
      target: kunde.lizenzschluessel,
      details: { method: "settings" },
    });

    return NextResponse.json({ ok: true, hadPassword: !!existingHash });
  } catch (err) {
    console.error("[editor-auth/password/change] error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
