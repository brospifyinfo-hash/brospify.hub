// ─── POST /api/login-help ───────────────────────────────────────
// PUBLIC (no session) — the "Hilfe bei der Anmeldung"-Formular auf der
// Login-Seite. Ein Interessent/Kunde, der noch nicht reinkommt, gibt
// SEINE E-Mail + eine Nachricht ein; wir schicken das direkt an den
// Support-Posteingang und setzen reply_to auf die Kunden-Mail, damit
// du mit einem Klick antworten kannst.
//
// Body: { email: string, message: string, name?: string }

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPPORT_TO = "brospify.info@gmail.com";
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ResendRes {
  id?: string;
  message?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
  let email = "";
  let message = "";
  let name = "";
  try {
    const body = await req.json();
    email = String(body?.email || "").trim().slice(0, 200);
    message = String(body?.message || "").trim().slice(0, 5_000);
    name = String(body?.name || "").trim().slice(0, 120);
    // Honeypot: bots fill hidden fields. If present, pretend success.
    if (typeof body?.company === "string" && body.company.trim()) {
      return NextResponse.json({ success: true });
    }
  } catch {
    return NextResponse.json({ error: "Body unleserlich." }, { status: 400 });
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Bitte eine gültige E-Mail-Adresse angeben." },
      { status: 400 },
    );
  }
  if (!message) {
    return NextResponse.json(
      { error: "Bitte beschreibe kurz, wobei du Hilfe brauchst." },
      { status: 400 },
    );
  }

  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const fromAddr =
    (process.env.RESEND_ADMIN_FROM_EMAIL || "").trim() ||
    (process.env.RESEND_FROM_EMAIL || "").trim();
  if (!apiKey || !fromAddr) {
    return NextResponse.json(
      { error: "E-Mail-Versand ist serverseitig nicht konfiguriert. Bitte Admin kontaktieren." },
      { status: 500 },
    );
  }

  const html = `
    <div style="font-family: -apple-system, sans-serif; color: #1f2937; line-height: 1.5;">
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 16px; font-size: 13px;">
        <strong style="color: #95BF47;">Brospify Hub — Hilfe bei der Anmeldung</strong><br/>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 8px 0;"/>
        ${name ? `<strong>Name:</strong> ${escapeHtml(name)}<br/>` : ""}
        <strong>E-Mail:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>
      </div>
      <h2 style="font-size: 16px; margin: 0 0 8px 0;">Nachricht</h2>
      <div style="white-space: pre-wrap; font-size: 14px;">${escapeHtml(message)}</div>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 12px 0;"/>
      <p style="font-size: 11px; color: #6b7280;">
        Gesendet über das „Hilfe bei der Anmeldung"-Formular der Login-Seite.
        Einfach auf diese Mail antworten — die Antwort geht direkt an ${escapeHtml(email)}.
      </p>
    </div>
  `.trim();

  const text = [
    "Brospify Hub — Hilfe bei der Anmeldung",
    name ? `Name: ${name}` : "",
    `E-Mail: ${email}`,
    "",
    message,
  ].filter(Boolean).join("\n");

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddr,
        to: [SUPPORT_TO],
        subject: `[Brospify Hub] Anmelde-Hilfe von ${email}`,
        html,
        text,
        reply_to: email,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as ResendRes;
    if (!res.ok) {
      console.error("[login-help] Resend error:", res.status, data);
      return NextResponse.json(
        { error: data.message || `Versand fehlgeschlagen (HTTP ${res.status}).` },
        { status: 502 },
      );
    }
    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    console.error("[login-help] send failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Versand fehlgeschlagen." },
      { status: 500 },
    );
  }
}
