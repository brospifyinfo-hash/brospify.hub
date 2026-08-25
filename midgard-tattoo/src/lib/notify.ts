// ─── Benachrichtigungen zur Terminanfrage ────────────────────────
// Zwei Mails pro Anfrage: eine an den Inhaber („neue Anfrage") und eine
// Eingangsbestätigung an den Kunden. Beide sind OPTIONAL und schlagen
// niemals auf die Buchung durch — ist Resend nicht konfiguriert oder
// der Versand scheitert, ist die Anfrage trotzdem gespeichert und im
// Dashboard sichtbar. Eine Mail darf keinen Termin kosten.
//
// Konfiguration:
//   RESEND_API_KEY, RESEND_FROM_EMAIL  — wie im restlichen Hub
//   TATTOO_NOTIFY_EMAIL                — Postfach des Studios; fehlt es,
//                                        wird nur die Kundenbestätigung
//                                        verschickt.

import { sendViaResend } from "./email";
import { STUDIO } from "./studio";
import {
  budgetLabel,
  colorLabel,
  formatDateLong,
  placementLabel,
  sizeLabel,
  slotKind,
  styleLabel,
  SLOT_KIND_PUBLIC,
  type Booking,
  type Slot,
} from "./types";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 12px 6px 0;color:#8a8a90;font-size:13px;white-space:nowrap;vertical-align:top">${esc(label)}</td>
    <td style="padding:6px 0;color:#111;font-size:14px">${esc(value)}</td>
  </tr>`;
}

function shell(title: string, inner: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#f5f4f2;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6e4e0">
      <div style="background:#111113;padding:20px 24px">
        <div style="color:#ffd200;font-size:12px;letter-spacing:.18em;text-transform:uppercase">${esc(STUDIO.name)}</div>
        <div style="color:#fff;font-size:20px;font-weight:700;margin-top:4px">${esc(title)}</div>
      </div>
      <div style="padding:24px">${inner}</div>
      <div style="padding:16px 24px;border-top:1px solid #eee;color:#8a8a90;font-size:12px">
        ${esc(STUDIO.name)} · ${esc(STUDIO.street)} · ${esc(STUDIO.zip)} ${esc(STUDIO.city)} · ${esc(STUDIO.phone)}
      </div>
    </div>
  </div>`;
}

function detailTable(booking: Booking, slot: Slot): string {
  return `<table style="width:100%;border-collapse:collapse">
    ${row("Termin", `${SLOT_KIND_PUBLIC[slotKind(slot)]} · ${formatDateLong(slot.date)}, ${slot.startTime} Uhr`)}
    ${row("Stil", styleLabel(booking.style))}
    ${row("Größe", sizeLabel(booking.size))}
    ${row("Stelle", placementLabel(booking.placement))}
    ${row("Farbe", colorLabel(booking.colorMode))}
    ${row("Budget", budgetLabel(booking.budget))}
    ${row("Erstes Tattoo", booking.isFirstTattoo ? "Ja" : "Nein")}
    ${row("Idee", booking.idea)}
    ${booking.referenceUrl ? row("Referenz", booking.referenceUrl) : ""}
  </table>`;
}

/** Anfrage-Eingang an das Studio. */
export async function notifyStudio(booking: Booking, slot: Slot): Promise<void> {
  const to = (process.env.TATTOO_NOTIFY_EMAIL || "").trim();
  if (!to) return;
  const inner = `
    <p style="margin:0 0 16px;color:#111;font-size:15px">
      Neue Terminanfrage von <strong>${esc(booking.name)}</strong>.
    </p>
    ${detailTable(booking, slot)}
    <table style="width:100%;border-collapse:collapse;margin-top:16px;border-top:1px solid #eee">
      ${row("E-Mail", booking.email)}
      ${row("Telefon", booking.phone)}
    </table>
    <p style="margin:20px 0 0;color:#8a8a90;font-size:13px">
      Der Termin ist bis zu deiner Entscheidung reserviert. Bestätigen oder ablehnen kannst du ihn im Dashboard.
    </p>`;
  await sendViaResend({
    to,
    subject: `Neue Anfrage (${SLOT_KIND_PUBLIC[slotKind(slot)]}) — ${formatDateLong(slot.date)}, ${slot.startTime} Uhr`,
    html: shell("Neue Terminanfrage", inner),
    replyTo: booking.email,
  }).catch(() => undefined);
}

/** Eingangsbestätigung an den Kunden. */
export async function notifyCustomer(booking: Booking, slot: Slot): Promise<void> {
  const inner = `
    <p style="margin:0 0 16px;color:#111;font-size:15px">
      Hallo ${esc(booking.name.split(" ")[0])},<br>
      deine Anfrage ist angekommen. Der ${esc(SLOT_KIND_PUBLIC[slotKind(slot)])} ist für dich reserviert — sobald ${esc(STUDIO.artist)} sie durchgesehen hat, bekommst du die feste Bestätigung.
    </p>
    <p style="margin:0 0 16px;color:#111;font-size:15px">
      ${slotKind(slot) === "consultation"
        ? "Beim Beratungstermin geht es ums Motiv, die Größe, die Stelle und den Preis — gestochen wird an dem Tag noch nicht. Den Termin fürs Tätowieren machen wir direkt im Anschluss aus."
        : "Bring bitte etwas Zeit mit und iss vorher ordentlich."}
    </p>
    ${detailTable(booking, slot)}
    <p style="margin:20px 0 0;color:#8a8a90;font-size:13px">
      Passt etwas nicht? Antworte einfach auf diese Mail oder ruf an: ${esc(STUDIO.phone)}.
    </p>`;
  await sendViaResend({
    to: booking.email,
    subject: `Deine Terminanfrage bei ${STUDIO.name}`,
    html: shell("Anfrage erhalten", inner),
    replyTo: (process.env.TATTOO_NOTIFY_EMAIL || "").trim() || undefined,
  }).catch(() => undefined);
}

/** Zu-/Absage nach der Entscheidung des Inhabers. */
export async function notifyDecision(
  booking: Booking,
  slot: Slot,
  decision: "confirmed" | "declined",
): Promise<void> {
  const confirmed = decision === "confirmed";
  const inner = `
    <p style="margin:0 0 16px;color:#111;font-size:15px">
      Hallo ${esc(booking.name.split(" ")[0])},<br>
      ${confirmed
        ? `dein ${esc(SLOT_KIND_PUBLIC[slotKind(slot)])} steht: <strong>${esc(formatDateLong(slot.date))}, ${esc(slot.startTime)} Uhr</strong>. Wir sehen uns in der ${esc(STUDIO.street)}.`
        : "dieser Termin lässt sich leider nicht einrichten. Schau gern noch einmal in den Kalender — dort stehen die aktuell freien Termine."}
    </p>
    ${confirmed ? detailTable(booking, slot) : ""}
    ${booking.adminNote ? `<p style="margin:16px 0 0;padding:12px;background:#faf9f7;border-radius:8px;color:#111;font-size:14px">${esc(booking.adminNote)}</p>` : ""}`;
  await sendViaResend({
    to: booking.email,
    subject: confirmed
      ? `Termin bestätigt — ${formatDateLong(slot.date)}`
      : `Terminanfrage vom ${formatDateLong(slot.date)}`,
    html: shell(confirmed ? "Termin bestätigt" : "Termin leider nicht möglich", inner),
    replyTo: (process.env.TATTOO_NOTIFY_EMAIL || "").trim() || undefined,
  }).catch(() => undefined);
}
