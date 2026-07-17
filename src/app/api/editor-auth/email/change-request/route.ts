import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  rateLimit,
  editorAuthSecret,
  generateEmailLoginCode,
  generateCodeId,
  hashEmailLoginCode,
  EMAIL_CODE_TTL_MS,
} from "@/lib/editor-auth";
import { deliverEditorLoginEmail } from "@/lib/email";
import { findKundeByGoogleEmail } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function originFrom(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// ─── E-Mail ändern — Schritt 1: Code an die NEUE Adresse ────────────────
// POST { newEmail } (eingeloggt). Prüft Format + Verfügbarkeit, verschickt
// einen 6-stelligen Code an die NEUE Adresse (Ownership-Beweis) und legt
// die ausstehende Änderung in der Session dieses Kontos ab.

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.isAdmin || !session.lizenzschluessel) {
      return NextResponse.json({ ok: false, error: "not_logged_in" }, { status: 401 });
    }
    if (!editorAuthSecret()) return NextResponse.json({ ok: false, error: "server" }, { status: 503 });

    const body = (await req.json().catch(() => ({}))) as { newEmail?: string };
    const newEmail = (body.newEmail || "").trim().toLowerCase();
    if (!EMAIL_RE.test(newEmail)) {
      return NextResponse.json({ ok: false, error: "email_invalid" }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!rateLimit(`email-change:${session.lizenzschluessel}`, 3, 10 * 60 * 1000) || !rateLimit(`email-change-ip:${ip}`, 10, 10 * 60 * 1000)) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    // Verfügbarkeit: darf keinem ANDEREN Konto gehören.
    const owner = await findKundeByGoogleEmail(newEmail);
    if (owner && owner.lizenzschluessel !== session.lizenzschluessel) {
      return NextResponse.json({ ok: false, error: "email_taken" }, { status: 409 });
    }

    const code = generateEmailLoginCode();
    const codeHash = hashEmailLoginCode(newEmail, code);
    if (!codeHash) return NextResponse.json({ ok: false, error: "server" }, { status: 503 });

    const loginUrl = `${originFrom(req)}/editor`; // reiner Info-Link in der Mail
    const sent = await deliverEditorLoginEmail({ to: newEmail, code, loginUrl });

    const commit = async () => {
      session.editorEmailChange = {
        newEmail,
        codeHash,
        expiresAt: Date.now() + EMAIL_CODE_TTL_MS,
        codeId: generateCodeId(),
        lizenzschluessel: session.lizenzschluessel!,
      };
      await session.save();
    };

    if (!sent.sent) {
      if (process.env.NODE_ENV !== "production") {
        await commit();
        return NextResponse.json({ ok: true, devCode: code });
      }
      return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
    }
    await commit();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[editor-auth/email/change-request] error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
