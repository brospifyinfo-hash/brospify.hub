// ─── Resend transactional email ──────────────────────────────
// Thin wrapper around Resend's HTTP API — no SDK dependency,
// keeps the bundle small and matches the rest of the codebase
// which uses fetch() everywhere.
//
// Configuration (Vercel env vars):
//   RESEND_API_KEY            — required. Get from resend.com → API Keys.
//   RESEND_FROM_EMAIL         — required. Customer-facing FROM addr.
//                               Must be a verified domain on Resend
//                               (e.g. "noreply@brospify.com").
//                               Used for licence-key delivery so the
//                               customer recognises the shop domain.
//   RESEND_ADMIN_FROM_EMAIL   — optional. Admin-facing FROM addr for
//                               internal alerts (tickets, low credits).
//                               Defaults to RESEND_FROM_EMAIL if unset.
//                               Recommended: "noreply@brospifyhub.com"
//                               so the hub admin can filter alerts in
//                               their inbox by sender domain.
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
  /** Override the default FROM. Falls back to RESEND_FROM_EMAIL. */
  from?: string;
}

async function sendViaResend(args: SendArgs): Promise<SendResult> {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const defaultFrom = (process.env.RESEND_FROM_EMAIL || "").trim();
  const from = (args.from || defaultFrom).trim();
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
    <h2 style="font-size:16px;color:#111;margin:24px 0 8px;">1. Brospify Hub öffnen</h2>
    <p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 12px;">
      Im Hub findest du alle KI-Tools, deine Credits, Trend-Charts und vieles mehr:
    </p>
    <div style="text-align:center;margin:16px 0 24px;">
      <a href="https://brospifyhub.com/login"
         style="display:inline-block;background:#95BF47;color:#fff;font-weight:700;
                font-size:15px;text-decoration:none;padding:14px 28px;border-radius:8px;
                box-shadow:0 2px 6px rgba(149,191,71,0.3);">
        Zum Brospify Hub &rarr;
      </a>
    </div>
    <p style="font-size:13px;color:#666;margin:0 0 20px;text-align:center;">
      Mit deinem Lizenzschlüssel oben einloggen.
    </p>

    <h2 style="font-size:16px;color:#111;margin:24px 0 8px;">2. Theme in deinem Shopify-Shop aktivieren</h2>
    <ol style="font-size:14px;color:#333;line-height:1.6;padding-left:20px;margin:0 0 20px;">
      <li>Shopify Admin → <b>Online-Shop</b> → <b>Themes</b> → Brospify Theme öffnen.</li>
      <li>In den Theme-Einstellungen das Feld <b>„Lizenzschlüssel"</b> suchen.</li>
      <li>Den Schlüssel oben einfügen und speichern. Fertig.</li>
    </ol>
    <p style="font-size:13px;color:#666;line-height:1.5;margin:24px 0 0;">
      Bei Fragen oder Problemen melde dich einfach unter
      <a href="mailto:support@brospify.com" style="color:#95BF47;text-decoration:none;">support@brospify.com</a>
      oder direkt im Hub unter <b>Support</b> &rarr; <b>Ticket erstellen</b>.
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

1. Brospify Hub öffnen: https://brospifyhub.com/login
   → Mit obigem Lizenzschlüssel einloggen.

2. Theme in deinem Shop aktivieren:
   → Shopify Admin → Online-Shop → Themes → Brospify Theme
   → Theme-Einstellungen → Feld "Lizenzschlüssel" → einfügen + speichern.

Bei Fragen: support@brospify.com oder direkt im Hub unter Support.

Brospify
brospify.com · brospifyhub.com`;

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

/** FROM-address for admin-facing alerts (tickets, low-credits).
 *  Lets the hub send internal notifications from a different
 *  verified domain than customer-facing licence mails. */
function adminFromAddress(): string | undefined {
  const v = (process.env.RESEND_ADMIN_FROM_EMAIL || "").trim();
  return v || undefined; // undefined → sendViaResend falls back to RESEND_FROM_EMAIL
}

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
    from: adminFromAddress(),
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
    from: adminFromAddress(),
    subject: `[Brospify Hub] ⚠ Credits niedrig: ${args.customerName} (${args.balance})`,
    html,
    text: `Credits niedrig\nKunde: ${args.customerName} (${args.customerEmail || "—"})\nLizenz: ${args.customerKey}\nBalance: ${args.balance} (Schwelle ${args.threshold})`,
  });
}

// ─── API-Guthaben-Alert ─────────────────────────────────────────
// Warnt den Admin, wenn das Guthaben/die Quota eines API-Providers
// niedrig oder leer ist — BEVOR die Tools ausfallen.

export interface AdminApiBalanceAlertArgs {
  lows: { label: string; status: "low" | "empty"; detail: string }[];
}

export async function sendAdminApiBalanceAlert(args: AdminApiBalanceAlertArgs): Promise<SendResult> {
  const anyEmpty = args.lows.some((l) => l.status === "empty");
  const rows = args.lows
    .map(
      (l) => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;font-weight:600;">${escapeHtml(l.label)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;color:${l.status === "empty" ? "#dc2626" : "#d97706"};font-weight:700;">${l.status === "empty" ? "LEER" : "NIEDRIG"}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#374151;">${escapeHtml(l.detail)}</td>
        </tr>`,
    )
    .join("");
  const html = `
    <div style="font-family:-apple-system,sans-serif;color:#1f2937;line-height:1.5;">
      <div style="background:${anyEmpty ? "#fee2e2" : "#fef3c7"};padding:16px;border-radius:8px;margin-bottom:16px;font-size:13px;border-left:4px solid ${anyEmpty ? "#dc2626" : "#f59e0b"};">
        <strong style="color:${anyEmpty ? "#991b1b" : "#92400e"};">⚠ API-Guthaben ${anyEmpty ? "LEER" : "läuft aus"}</strong><br/>
        <hr style="border:none;border-top:1px solid ${anyEmpty ? "#fecaca" : "#fde68a"};margin:8px 0;"/>
        ${args.lows.length} ${args.lows.length === 1 ? "Provider braucht" : "Provider brauchen"} bald ein Top-Up. Lade dort auf, bevor die entsprechenden Tools ausfallen.
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">
            <th style="padding:6px 10px;">Provider</th>
            <th style="padding:6px 10px;">Status</th>
            <th style="padding:6px 10px;">Rest</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:20px;font-size:11px;color:#6b7280;">
        Live-Status: <a href="https://brospifyhub.com/admin">brospifyhub.com/admin</a> &rarr; System-Status &rarr; AI-API Balances
      </p>
    </div>
  `.trim();
  return sendViaResend({
    to: ADMIN_SUPPORT_EMAIL,
    from: adminFromAddress(),
    subject: `[Brospify Hub] ⚠ API-Guthaben ${anyEmpty ? "LEER" : "niedrig"}: ${args.lows.map((l) => l.label.split(" (")[0]).join(", ")}`,
    html,
    text: `API-Guthaben-Warnung\n\n${args.lows.map((l) => `${l.label}: ${l.status === "empty" ? "LEER" : "NIEDRIG"} — ${l.detail}`).join("\n")}\n\nLive-Status: brospifyhub.com/admin → System-Status`,
  });
}

// ─── Admin-Notification: Kunde will ziehen, hat aber schon ALLE ──
// Produkte. Signalisiert Nachfrage nach neuen Produkten. Geht an die
// zentrale Support-Adresse (brospify.info@gmail.com).

export interface AdminAllDrawnAlertArgs {
  customerName: string;
  customerEmail?: string;
  customerKey: string;
  totalProducts: number;
}

export async function sendAdminAllDrawnAlert(args: AdminAllDrawnAlertArgs): Promise<SendResult> {
  const html = `
    <div style="font-family:-apple-system,sans-serif;color:#1f2937;line-height:1.5;">
      <div style="background:#ecfccb;padding:16px;border-radius:8px;margin-bottom:16px;font-size:13px;border-left:4px solid #95BF47;">
        <strong style="color:#3f6212;">🎲 Kunde wollte ziehen — alle Produkte bereits gezogen</strong><br/>
        <hr style="border:none;border-top:1px solid #d9f99d;margin:8px 0;"/>
        <strong>Kunde:</strong> ${escapeHtml(args.customerName)}<br/>
        ${args.customerEmail ? `<strong>E-Mail:</strong> <a href="mailto:${escapeHtml(args.customerEmail)}">${escapeHtml(args.customerEmail)}</a><br/>` : ""}
        <strong>Lizenz:</strong> <code>${escapeHtml(args.customerKey)}</code><br/>
        <strong>Gezogene Produkte gesamt:</strong> ${args.totalProducts.toLocaleString("de-DE")}
      </div>
      <p style="font-size:13px;color:#374151;">
        Dieser Kunde wollte im Zufalls-Generator ein weiteres Produkt ziehen, hat aber bereits
        <strong>jedes verfügbare Produkt</strong> gezogen. Das ist ein Signal für Nachfrage —
        sobald du neue Produkte einpflegst, kann er wieder ziehen.
      </p>
      <p style="margin-top:20px;font-size:11px;color:#6b7280;">
        Hub-Link: <a href="https://brospifyhub.com/admin">brospifyhub.com/admin</a> &rarr; Produkte
      </p>
    </div>
  `.trim();
  return sendViaResend({
    to: ADMIN_SUPPORT_EMAIL,
    from: adminFromAddress(),
    subject: `[Brospify Hub] 🎲 Kunde will ziehen — hat aber schon alle Produkte (${args.customerName})`,
    html,
    text: `Kunde wollte ziehen, hat aber bereits alle Produkte.\nKunde: ${args.customerName} (${args.customerEmail || "—"})\nLizenz: ${args.customerKey}\nGezogene Produkte gesamt: ${args.totalProducts}`,
    replyTo: args.customerEmail || undefined,
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
