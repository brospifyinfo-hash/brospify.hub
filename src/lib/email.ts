// ─── Resend transactional email ──────────────────────────────
// Thin wrapper around Resend's HTTP API — no SDK dependency,
// keeps the bundle small and matches the rest of the codebase
// which uses fetch() everywhere.
//
// Configuration (Vercel env vars):
//   RESEND_API_KEY     — required. Get from resend.com → API Keys.
//   RESEND_FROM_EMAIL  — required. Must be a verified domain on
//                        Resend (e.g. "noreply@brospify.com").
//                        Verification is a 5-min DNS-record step.
//
// All helpers FAIL OPEN: if Resend isn't configured we log a
// warning and return { sent: false } but never throw. License
// issuance must NEVER be blocked by an email-send failure — the
// customer's row is already in the sheet at that point.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

interface SendResult {
  sent: boolean;
  id?: string;
  error?: string;
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

async function sendViaResend(args: SendArgs): Promise<SendResult> {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const from = (process.env.RESEND_FROM_EMAIL || "").trim();
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping send.");
    return { sent: false, error: "RESEND_API_KEY not configured" };
  }
  if (!from) {
    console.warn("[email] RESEND_FROM_EMAIL not set — skipping send.");
    return { sent: false, error: "RESEND_FROM_EMAIL not configured" };
  }
  if (!args.to || !args.to.includes("@")) {
    return { sent: false, error: "invalid recipient" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
        reply_to: args.replyTo,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      console.error("[email] Resend error:", res.status, data);
      return { sent: false, error: data.message || `HTTP ${res.status}` };
    }
    return { sent: true, id: data.id };
  } catch (err) {
    console.error("[email] Resend fetch failed:", err);
    return { sent: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

// ─── License-key delivery email ──────────────────────────────
// Sent automatically after a successful order is paid in Shopify
// and the Hub's webhook handler has generated the licence.

export interface LicenseEmailArgs {
  to: string;
  customerName?: string;
  licenseKey: string;
  orderNumber?: string;
  sku?: string;
}

export async function sendLicenseEmail(args: LicenseEmailArgs): Promise<SendResult> {
  const greetName = (args.customerName || "").trim() || "lieber Brospify-Kunde";
  const orderLine = args.orderNumber ? ` (Bestellung ${args.orderNumber})` : "";

  const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f7;margin:0;padding:32px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,0.04);">
    <h1 style="margin:0 0 16px;font-size:22px;color:#111;">Dein Brospify Lizenzschlüssel ist da</h1>
    <p style="font-size:15px;color:#333;line-height:1.5;margin:0 0 20px;">
      Hallo ${escapeHtml(greetName)},<br><br>
      vielen Dank für deinen Kauf${escapeHtml(orderLine)}! Hier ist dein persönlicher Lizenzschlüssel:
    </p>
    <div style="background:#0c0c0c;color:#95BF47;font-family:'SF Mono','Menlo','Monaco',monospace;font-size:18px;letter-spacing:1px;padding:18px;border-radius:8px;text-align:center;margin:24px 0;font-weight:700;">
      ${escapeHtml(args.licenseKey)}
    </div>
    <h2 style="font-size:16px;color:#111;margin:24px 0 8px;">So aktivierst du dein Theme</h2>
    <ol style="font-size:14px;color:#333;line-height:1.6;padding-left:20px;margin:0 0 20px;">
      <li>Shopify Admin → <b>Online-Shop</b> → <b>Themes</b> → Brospify Theme öffnen.</li>
      <li>In den Theme-Einstellungen das Feld <b>„Lizenzschlüssel"</b> suchen.</li>
      <li>Den Schlüssel oben einfügen und speichern. Fertig.</li>
    </ol>
    <p style="font-size:13px;color:#666;line-height:1.5;margin:24px 0 0;">
      Bei Fragen oder Problemen melde dich einfach unter
      <a href="mailto:support@brospify.com" style="color:#95BF47;text-decoration:none;">support@brospify.com</a>.
    </p>
    <p style="font-size:12px;color:#999;margin:32px 0 0;border-top:1px solid #eee;padding-top:16px;">
      Diese Mail wurde automatisch nach Bestelleingang versendet.<br>
      Brospify · <a href="https://brospify.com" style="color:#999;">brospify.com</a>
    </p>
  </div>
</body>
</html>`;

  const text = `Hallo ${greetName},

vielen Dank für deinen Kauf${orderLine}! Hier ist dein Brospify Lizenzschlüssel:

  ${args.licenseKey}

So aktivierst du:
1. Shopify Admin → Online-Shop → Themes → Brospify Theme
2. Theme-Einstellungen → Feld "Lizenzschlüssel" suchen
3. Schlüssel einfügen und speichern. Fertig.

Bei Fragen: support@brospify.com

Brospify
brospify.com`;

  return sendViaResend({
    to: args.to,
    subject: `Dein Brospify Lizenzschlüssel${orderLine ? " " + args.orderNumber : ""}`,
    html,
    text,
    replyTo: "support@brospify.com",
  });
}

// ─── Admin-Notifications (Tickets + Low-Credits) ─────────────
// Geht IMMER an die zentrale Support-Adresse, nicht an Kunden.
// Wird vom /api/tickets POST (neuer Ticket) und vom credit-deduct
// path (wenn balance < threshold) aufgerufen. Fail-open — bei
// Konfig-Fehler nur warnen.

const ADMIN_SUPPORT_EMAIL = "brospify.info@gmail.com";

export interface AdminTicketAlertArgs {
  ticketId: string;
  subject: string;
  customerName: string;
  customerEmail?: string;
  customerKey: string;
  initialMessage?: string;
}

export async function sendAdminTicketAlert(args: AdminTicketAlertArgs): Promise<SendResult> {
  const html = `
    <div style="font-family:-apple-system,sans-serif;color:#1f2937;line-height:1.5;">
      <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin-bottom:16px;font-size:13px;">
        <strong style="color:#95BF47;">🎫 Neues Brospify-Ticket</strong><br/>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:8px 0;"/>
        <strong>Ticket-ID:</strong> <code>${escapeHtml(args.ticketId)}</code><br/>
        <strong>Von:</strong> ${escapeHtml(args.customerName)}<br/>
        ${args.customerEmail ? `<strong>E-Mail:</strong> <a href="mailto:${escapeHtml(args.customerEmail)}">${escapeHtml(args.customerEmail)}</a><br/>` : ""}
        <strong>Lizenz:</strong> <code>${escapeHtml(args.customerKey)}</code>
      </div>
      <h2 style="font-size:16px;margin:0 0 8px 0;">${escapeHtml(args.subject)}</h2>
      ${args.initialMessage ? `<div style="white-space:pre-wrap;font-size:14px;background:#fafafa;padding:12px;border-radius:6px;border-left:3px solid #95BF47;">${escapeHtml(args.initialMessage)}</div>` : ""}
      <p style="margin-top:24px;font-size:11px;color:#6b7280;">
        Hub-Link: <a href="https://brospifyhub.com/admin">brospifyhub.com/admin</a> &rarr; Tickets
      </p>
    </div>
  `.trim();
  return sendViaResend({
    to: ADMIN_SUPPORT_EMAIL,
    subject: `[Brospify Hub] 🎫 Neues Ticket: ${args.subject}`,
    html,
    text: `Neues Ticket\nID: ${args.ticketId}\nVon: ${args.customerName} (${args.customerEmail || "—"})\nLizenz: ${args.customerKey}\nBetreff: ${args.subject}\n\n${args.initialMessage || ""}`,
    replyTo: args.customerEmail || undefined,
  });
}

export interface AdminLowCreditsAlertArgs {
  customerName: string;
  customerEmail?: string;
  customerKey: string;
  balance: number;
  threshold: number;
}

export async function sendAdminLowCreditsAlert(args: AdminLowCreditsAlertArgs): Promise<SendResult> {
  const html = `
    <div style="font-family:-apple-system,sans-serif;color:#1f2937;line-height:1.5;">
      <div style="background:#fef3c7;padding:16px;border-radius:8px;margin-bottom:16px;font-size:13px;border-left:4px solid #f59e0b;">
        <strong style="color:#92400e;">⚠ Kunden-Credits laufen aus</strong><br/>
        <hr style="border:none;border-top:1px solid #fde68a;margin:8px 0;"/>
        <strong>Kunde:</strong> ${escapeHtml(args.customerName)}<br/>
        ${args.customerEmail ? `<strong>E-Mail:</strong> <a href="mailto:${escapeHtml(args.customerEmail)}">${escapeHtml(args.customerEmail)}</a><br/>` : ""}
        <strong>Lizenz:</strong> <code>${escapeHtml(args.customerKey)}</code><br/>
        <strong>Aktuelles Guthaben:</strong> <span style="font-size:18px;font-weight:700;color:#dc2626;">${args.balance.toLocaleString("de-DE")}</span> Credits
        <span style="color:#6b7280;">(Schwelle ${args.threshold.toLocaleString("de-DE")})</span>
      </div>
      <p style="font-size:13px;color:#374151;">
        Der Kunde hat eben den Schwellwert unterschritten. Bei Bedarf kannst du im Admin-Panel manuell Credits gutschreiben oder einen Voucher-Code generieren.
      </p>
      <p style="margin-top:20px;font-size:11px;color:#6b7280;">
        Hub-Link: <a href="https://brospifyhub.com/admin">brospifyhub.com/admin</a> &rarr; Kunden
      </p>
    </div>
  `.trim();
  return sendViaResend({
    to: ADMIN_SUPPORT_EMAIL,
    subject: `[Brospify Hub] ⚠ Credits niedrig: ${args.customerName} (${args.balance})`,
    html,
    text: `Credits niedrig\nKunde: ${args.customerName} (${args.customerEmail || "—"})\nLizenz: ${args.customerKey}\nBalance: ${args.balance} (Schwelle ${args.threshold})`,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
