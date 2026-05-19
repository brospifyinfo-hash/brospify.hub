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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
