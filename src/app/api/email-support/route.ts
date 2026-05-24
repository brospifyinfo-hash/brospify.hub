// ─── /api/email-support ──────────────────────────────────────
// Schickt eine Support-E-Mail vom eingeloggten User an die zentrale
// Support-Adresse (brospify.info@gmail.com). Body:
//   { subject: string, message: string }
//
// Wir packen Lizenzschluessel + Email + Shop-Domain + Tier in den
// Email-Body damit der Support direkt sieht wer schreibt, ohne dass
// der User das selbst eintippen muss. Reply-To setzen wir auf die
// Google/Customer-Email des Users, damit das Support-Team einfach
// auf "Antworten" druecken kann.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPPORT_TO = "brospify.info@gmail.com";
const RESEND_ENDPOINT = "https://api.resend.com/emails";

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
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  let subject = "";
  let message = "";
  try {
    const body = await req.json();
    subject = String(body?.subject || "").trim().slice(0, 200);
    message = String(body?.message || "").trim().slice(0, 10_000);
  } catch {
    return NextResponse.json({ error: "Body unleserlich." }, { status: 400 });
  }
  if (!subject || !message) {
    return NextResponse.json(
      { error: "Bitte Betreff und Nachricht angeben." },
      { status: 400 },
    );
  }

  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const fromAddr = (process.env.RESEND_FROM_EMAIL || "").trim();
  if (!apiKey || !fromAddr) {
    return NextResponse.json(
      { error: "E-Mail-Versand ist serverseitig nicht konfiguriert. Bitte Admin kontaktieren." },
      { status: 500 },
    );
  }

  // User-Infos sammeln fuer den Email-Header.
  let kundeEmail = session.googleEmail || "";
  let shopDomain = "";
  let tier = "";
  if (session.lizenzschluessel) {
    try {
      const kunde = await findKundeByKey(session.lizenzschluessel);
      if (kunde) {
        kundeEmail = kunde.kundenEmail || kundeEmail;
        shopDomain = kunde.shopDomain || "";
        tier = kunde.profile?.tier || "";
      }
    } catch (e) {
      console.warn("[email-support] could not load Kunde:", e);
    }
  }

  const userLabel = session.googleName || kundeEmail || session.lizenzschluessel || "Unbekannt";
  const fullSubject = `[Brospify Hub] ${subject}`;

  // HTML-Header mit User-Kontext + Original-Nachricht.
  const html = `
    <div style="font-family: -apple-system, sans-serif; color: #1f2937; line-height: 1.5;">
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 16px; font-size: 13px;">
        <strong style="color: #95BF47;">Brospify Hub Support-Anfrage</strong><br/>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 8px 0;"/>
        <strong>Von:</strong> ${escapeHtml(userLabel)}<br/>
        ${kundeEmail ? `<strong>E-Mail:</strong> <a href="mailto:${escapeHtml(kundeEmail)}">${escapeHtml(kundeEmail)}</a><br/>` : ""}
        ${session.lizenzschluessel ? `<strong>Lizenz:</strong> <code>${escapeHtml(session.lizenzschluessel)}</code><br/>` : ""}
        ${shopDomain ? `<strong>Shop:</strong> ${escapeHtml(shopDomain)}<br/>` : ""}
        ${tier ? `<strong>Tier:</strong> ${escapeHtml(tier)}<br/>` : ""}
        ${session.isAdmin ? `<strong style="color: #dc2626;">⚠ Admin-Account</strong><br/>` : ""}
      </div>
      <h2 style="font-size: 16px; margin: 0 0 8px 0;">${escapeHtml(subject)}</h2>
      <div style="white-space: pre-wrap; font-size: 14px;">${escapeHtml(message)}</div>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 12px 0;"/>
      <p style="font-size: 11px; color: #6b7280;">
        Diese E-Mail wurde automatisch über das Brospify-Hub-Support-Formular gesendet.
        Antworte einfach auf diese Mail — die Antwort geht direkt an den User.
      </p>
    </div>
  `.trim();

  const text = [
    `Brospify Hub — Support-Anfrage`,
    `Von: ${userLabel}`,
    kundeEmail ? `E-Mail: ${kundeEmail}` : "",
    session.lizenzschluessel ? `Lizenz: ${session.lizenzschluessel}` : "",
    shopDomain ? `Shop: ${shopDomain}` : "",
    tier ? `Tier: ${tier}` : "",
    "",
    subject,
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
        subject: fullSubject,
        html,
        text,
        // Wenn der User eine Email hat -> Support kann direkt
        // "Antworten" druecken um ihm zu schreiben.
        reply_to: kundeEmail || undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as ResendRes;
    if (!res.ok) {
      console.error("[email-support] Resend error:", res.status, data);
      return NextResponse.json(
        { error: data.message || `Mail-Versand fehlgeschlagen (HTTP ${res.status}).` },
        { status: 502 },
      );
    }
    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    console.error("[email-support] send failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Versand fehlgeschlagen." },
      { status: 500 },
    );
  }
}
