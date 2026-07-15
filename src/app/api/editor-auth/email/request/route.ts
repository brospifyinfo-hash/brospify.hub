import { NextRequest, NextResponse } from "next/server";
import { signEmailLoginToken, safeNextPath, rateLimit, editorAuthSecret } from "@/lib/editor-auth";
import { sendEditorLoginEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// ─── Editor-Login per E-Mail — Schritt 1: Link anfordern ───────────────
// POST { email, next? } → verschickt einen signierten 15-Minuten-Link.
// Antwortet IMMER mit ok:true bei gültiger E-Mail (kein Konto-Enumeration-
// Leck: ob die Adresse ein Konto hat, wird hier nicht verraten — beim
// Klick entsteht ohnehin automatisch ein Gratis-Konto).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function originFrom(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string; next?: string };
    const email = (body.email || "").trim().toLowerCase();
    const next = safeNextPath(body.next);

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: "email_invalid" }, { status: 400 });
    }
    if (!editorAuthSecret()) {
      return NextResponse.json({ ok: false, error: "server" }, { status: 503 });
    }

    // Best-effort-Rate-Limit: 3 Links / 10 min pro Adresse, 10 pro IP.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!rateLimit(`email-req:${email}`, 3, 10 * 60 * 1000) || !rateLimit(`email-ip:${ip}`, 10, 10 * 60 * 1000)) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const token = signEmailLoginToken(email, next);
    if (!token) return NextResponse.json({ ok: false, error: "server" }, { status: 503 });

    const loginUrl = `${originFrom(req)}/api/editor-auth/email/callback?token=${encodeURIComponent(token)}`;
    const sent = await sendEditorLoginEmail({ to: email, loginUrl });

    // Lokal/ohne Resend-Key: Link im Dev-Modus zurückgeben, damit der
    // Flow testbar bleibt (niemals in Produktion).
    if (!sent.sent) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[editor-auth/email] Versand übersprungen — Dev-Link:", loginUrl);
        return NextResponse.json({ ok: true, devUrl: loginUrl });
      }
      return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[editor-auth/email] request error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
