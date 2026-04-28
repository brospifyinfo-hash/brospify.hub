/**
 * AI Email Generator — Simulation eines KI-Agenten
 *
 * Diese Datei kapselt den "AI-Call". In Produktion wird das Inner-Workings
 * durch einen echten LLM-Call ersetzt (z. B. Anthropic Claude oder OpenAI).
 * Aktuell deterministisch und template-basiert — der Frontend-Vertrag bleibt
 * bei einem Switch identisch:
 *
 *     { templateKey, tone, notes, brandName? } -> { subject, html }
 *
 * MIGRATION ZU EINEM ECHTEN LLM:
 *   1. Den Prompt in `buildPrompt()` an Claude senden
 *      (`messages.create` mit prompt-caching auf den System-Prompt).
 *   2. Die Antwort (HTML/Liquid) durch `sanitizeAiOutput()` filtern.
 *   3. Subject aus dem ersten <title>-Tag oder einer separaten Anfrage holen.
 */

import type { EmailTemplateKey, EmailTemplateMeta } from "./email-templates";
import { getTemplateMeta } from "./email-templates";

export type BrandTone = "serioes" | "locker" | "luxurioes" | "freundlich";

export interface GenerateInput {
  templateKey: EmailTemplateKey;
  tone: BrandTone;
  notes: string;
  brandName?: string;
  accentColor?: string; // Hex, default Shopify-Grün
}

export interface GenerateOutput {
  subject: string;
  html: string; // Vollständiges Liquid + HTML, deploybar in Shopify
}

const DEFAULT_BRAND = "Dein Shop";
const DEFAULT_ACCENT = "#95BF47"; // Shopify-Grün

const TONE_PRESETS: Record<
  BrandTone,
  { greeting: string; signOff: string; voice: string }
> = {
  serioes: {
    greeting: "Sehr geehrte/r {{ customer.first_name }},",
    signOff: "Mit freundlichen Grüßen",
    voice: "präzise, höflich, klassisch",
  },
  locker: {
    greeting: "Hey {{ customer.first_name }},",
    signOff: "Bis bald",
    voice: "locker, modern, du-Form",
  },
  luxurioes: {
    greeting: "Liebe/r {{ customer.first_name }},",
    signOff: "Mit aufrichtigem Dank",
    voice: "elegant, exklusiv, zurückhaltend",
  },
  freundlich: {
    greeting: "Hallo {{ customer.first_name }} 👋",
    signOff: "Herzliche Grüße",
    voice: "warmherzig, persönlich, optimistisch",
  },
};

/**
 * Simuliert einen KI-Call mit realistischer Latenz.
 * Bei einem echten LLM-Switch hier den fetch zu Anthropic/OpenAI einsetzen.
 */
export async function generateEmailTemplate(
  input: GenerateInput
): Promise<GenerateOutput> {
  // Künstliche Denk-Pause, damit das Frontend einen "AI-thinking"-State zeigt.
  await new Promise((r) => setTimeout(r, 1100 + Math.random() * 600));

  const meta = getTemplateMeta(input.templateKey);
  const tone = TONE_PRESETS[input.tone];
  const brand = input.brandName?.trim() || DEFAULT_BRAND;
  const accent = input.accentColor || DEFAULT_ACCENT;
  const notes = input.notes.trim();

  const subject = renderSubject(input.templateKey, meta, brand, input.tone);
  const html = renderBody({
    meta,
    tone,
    brand,
    accent,
    notes,
  });

  return { subject, html };
}

function renderSubject(
  key: EmailTemplateKey,
  meta: EmailTemplateMeta,
  brand: string,
  tone: BrandTone
): string {
  // Tonabhängige Subject-Variationen — sonst klingen alle Mails gleich.
  switch (key) {
    case "abandoned_checkout":
      return tone === "luxurioes"
        ? "Ihre Auswahl wartet noch auf Sie"
        : tone === "locker"
        ? "Hey, da war noch was im Warenkorb 👀"
        : "Du hast etwas in deinem Warenkorb vergessen";
    case "customer_account_welcome":
      return tone === "luxurioes"
        ? `Willkommen im exklusiven Kreis von ${brand}`
        : `Willkommen bei ${brand}`;
    case "gift_card_notification":
      return `Ein Geschenk von ${brand} wartet auf dich`;
    default:
      return meta.defaultSubject;
  }
}

interface RenderArgs {
  meta: EmailTemplateMeta;
  tone: (typeof TONE_PRESETS)[BrandTone];
  brand: string;
  accent: string;
  notes: string;
}

/**
 * Erzeugt einen vollständigen, validen Shopify-Liquid-/HTML-Body.
 *
 * Der Body ist bewusst inline-styled — E-Mail-Clients (Gmail, Outlook,
 * Apple Mail) ignorieren <style>-Blöcke teils oder filtern sie raus.
 * Nur die Mobile-Media-Query bleibt im <head> als Best-Effort.
 */
function renderBody(args: RenderArgs): string {
  const body = renderBodyContent(args);

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(args.meta.title)}</title>
  <style>
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 16px !important; }
      .card { padding: 24px !important; }
      h1 { font-size: 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f6f6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f4;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;">
          <tr>
            <td style="padding:24px 8px;text-align:center;">
              <span style="font-size:18px;font-weight:600;letter-spacing:-0.01em;color:#111;">{{ shop.name }}</span>
            </td>
          </tr>
          <tr>
            <td class="card" style="background:#ffffff;border-radius:16px;padding:40px;border:1px solid #ececea;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 8px;text-align:center;color:#9b9b97;font-size:12px;line-height:1.6;">
              {{ shop.name }} &middot; {{ shop.address.address1 }}, {{ shop.address.city }}<br>
              <a href="{{ shop.url }}" style="color:#9b9b97;text-decoration:underline;">{{ shop.url }}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Pro Template-Key der eigentliche Mail-Inhalt.
 * Liquid-Variablen (z. B. `{{ order.name }}`) werden im echten Shopify-Versand
 * automatisch durch den jeweiligen Wert ersetzt — in der Vorschau bleiben
 * sie als Platzhalter sichtbar, das ist gewollt.
 */
function renderBodyContent({ meta, tone, brand, accent, notes }: RenderArgs): string {
  const cta = (label: string, href = "{{ order.order_status_url }}") => `
    <p style="margin:32px 0 0 0;text-align:center;">
      <a href="${href}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600;font-size:15px;letter-spacing:-0.01em;">
        ${label}
      </a>
    </p>`;

  const greeting = `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#444;">${tone.greeting}</p>`;
  const signOff = `<p style="margin:32px 0 0 0;font-size:15px;color:#444;">${tone.signOff}<br><strong>${escapeHtml(brand)}</strong></p>`;
  const notesBlock = notes
    ? `<div style="margin:24px 0;padding:16px 20px;background:#f6f6f4;border-radius:12px;font-size:14px;color:#444;line-height:1.6;border-left:3px solid ${accent};">${escapeHtml(notes)}</div>`
    : "";

  switch (meta.key) {
    case "order_confirmation":
      return `
        ${greeting}
        <h1 style="margin:0 0 12px 0;font-size:28px;font-weight:700;letter-spacing:-0.02em;color:#111;">Vielen Dank für deine Bestellung</h1>
        <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#555;">
          Bestellung <strong>{{ order.name }}</strong> ist bei uns eingegangen.
          Wir bereiten alles vor und melden uns wieder, sobald dein Paket unterwegs ist.
        </p>
        {% for line in line_items %}
          <table width="100%" style="margin:8px 0;border-bottom:1px solid #ececea;">
            <tr>
              <td style="padding:12px 0;font-size:14px;color:#222;">{{ line.title }} × {{ line.quantity }}</td>
              <td style="padding:12px 0;font-size:14px;color:#222;text-align:right;">{{ line.line_price | money }}</td>
            </tr>
          </table>
        {% endfor %}
        <p style="margin:16px 0 0 0;text-align:right;font-size:16px;font-weight:600;color:#111;">
          Gesamt: {{ total_price | money }}
        </p>
        ${notesBlock}
        ${cta("Bestellung anzeigen")}
        ${signOff}`;

    case "shipping_confirmation":
      return `
        ${greeting}
        <h1 style="margin:0 0 12px 0;font-size:28px;font-weight:700;letter-spacing:-0.02em;color:#111;">Dein Paket ist unterwegs</h1>
        <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#555;">
          Bestellung <strong>{{ order.name }}</strong> wurde verpackt und an
          <strong>{{ fulfillment.tracking_company }}</strong> übergeben.
        </p>
        <div style="background:#f6f6f4;border-radius:12px;padding:20px;margin:16px 0;">
          <p style="margin:0 0 4px 0;font-size:12px;color:#9b9b97;text-transform:uppercase;letter-spacing:0.08em;">Sendungsnummer</p>
          <p style="margin:0;font-size:16px;font-family:'SF Mono',Menlo,Consolas,monospace;color:#111;">{{ fulfillment.tracking_number }}</p>
        </div>
        ${notesBlock}
        ${cta("Sendung verfolgen", "{{ fulfillment.tracking_url }}")}
        ${signOff}`;

    case "abandoned_checkout":
      return `
        ${greeting}
        <h1 style="margin:0 0 12px 0;font-size:28px;font-weight:700;letter-spacing:-0.02em;color:#111;">Du hast etwas vergessen</h1>
        <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#555;">
          Deine Auswahl wartet noch auf dich — wir haben sie für dich aufgehoben.
        </p>
        {% for line in line_items %}
          <table width="100%" style="margin:8px 0;">
            <tr>
              <td style="padding:8px 0;font-size:14px;color:#222;">{{ line.title }} × {{ line.quantity }}</td>
              <td style="padding:8px 0;font-size:14px;color:#222;text-align:right;">{{ line.line_price | money }}</td>
            </tr>
          </table>
        {% endfor %}
        ${notesBlock}
        ${cta("Jetzt abschließen", "{{ url }}")}
        ${signOff}`;

    case "customer_account_welcome":
      return `
        ${greeting}
        <h1 style="margin:0 0 12px 0;font-size:28px;font-weight:700;letter-spacing:-0.02em;color:#111;">Schön, dass du da bist</h1>
        <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#555;">
          Dein Konto bei <strong>${escapeHtml(brand)}</strong> ist startklar.
          Stil: ${escapeHtml(tone.voice)}.
        </p>
        ${notesBlock}
        ${cta("Jetzt entdecken", "{{ shop.url }}")}
        ${signOff}`;

    case "order_refund":
      return `
        ${greeting}
        <h1 style="margin:0 0 12px 0;font-size:28px;font-weight:700;letter-spacing:-0.02em;color:#111;">Rückerstattung bestätigt</h1>
        <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#555;">
          Wir haben dir <strong>{{ amount | money }}</strong> für die Bestellung
          <strong>{{ order.name }}</strong> erstattet. Der Betrag erscheint je
          nach Zahlungsmethode innerhalb von 3–10 Werktagen auf deinem Konto.
        </p>
        ${notesBlock}
        ${signOff}`;

    case "shipping_update":
      return `
        ${greeting}
        <h1 style="margin:0 0 12px 0;font-size:28px;font-weight:700;letter-spacing:-0.02em;color:#111;">Update zu deiner Sendung</h1>
        <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#555;">
          Es gibt Neuigkeiten zu Bestellung <strong>{{ order.name }}</strong>:
          {{ fulfillment.tracking_company }} hat den Status aktualisiert.
        </p>
        ${notesBlock}
        ${cta("Aktuellen Status sehen", "{{ fulfillment.tracking_url }}")}
        ${signOff}`;

    case "customer_account_activate":
      return `
        ${greeting}
        <h1 style="margin:0 0 12px 0;font-size:28px;font-weight:700;letter-spacing:-0.02em;color:#111;">Konto aktivieren</h1>
        <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#555;">
          Du wurdest eingeladen, ein Konto bei <strong>${escapeHtml(brand)}</strong> zu erstellen.
          Klicke auf den Button, um die Aktivierung abzuschließen.
        </p>
        ${notesBlock}
        ${cta("Konto aktivieren", "{{ customer.account_activation_url }}")}
        ${signOff}`;

    case "customer_password_reset":
      return `
        ${greeting}
        <h1 style="margin:0 0 12px 0;font-size:28px;font-weight:700;letter-spacing:-0.02em;color:#111;">Passwort zurücksetzen</h1>
        <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#555;">
          Wir haben eine Anfrage zum Zurücksetzen deines Passworts erhalten.
          Falls du das nicht warst, ignoriere diese E-Mail einfach.
        </p>
        ${notesBlock}
        ${cta("Neues Passwort setzen", "{{ customer.reset_password_url }}")}
        ${signOff}`;

    case "gift_card_notification":
      return `
        ${greeting}
        <h1 style="margin:0 0 12px 0;font-size:28px;font-weight:700;letter-spacing:-0.02em;color:#111;">Ein Geschenk für dich</h1>
        <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#555;">
          Du hast eine Geschenkkarte im Wert von <strong>{{ gift_card.initial_value | money }}</strong> erhalten.
        </p>
        <div style="background:linear-gradient(135deg,${accent}15,${accent}05);border:1px solid ${accent}40;border-radius:16px;padding:24px;text-align:center;margin:24px 0;">
          <p style="margin:0 0 4px 0;font-size:12px;color:#9b9b97;text-transform:uppercase;letter-spacing:0.08em;">Code</p>
          <p style="margin:0;font-size:22px;font-family:'SF Mono',Menlo,Consolas,monospace;color:#111;letter-spacing:0.04em;">{{ gift_card.code }}</p>
        </div>
        ${notesBlock}
        ${cta("Jetzt einlösen", "{{ shop.url }}")}
        ${signOff}`;

    case "order_invoice":
      return `
        ${greeting}
        <h1 style="margin:0 0 12px 0;font-size:28px;font-weight:700;letter-spacing:-0.02em;color:#111;">Deine Rechnung</h1>
        <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#555;">
          Anbei findest du die Rechnung zu Bestellung <strong>{{ order.name }}</strong>.
          Zahlbar innerhalb von <strong>14 Tagen</strong> ohne Abzug.
        </p>
        <p style="margin:16px 0 0 0;text-align:right;font-size:16px;font-weight:600;color:#111;">
          Rechnungsbetrag: {{ total_price | money }}
        </p>
        ${notesBlock}
        ${cta("Rechnung als PDF", "{{ order.order_status_url }}")}
        ${signOff}`;
  }
}

/**
 * Sehr defensives HTML-Escaping für vom Nutzer eingegebene Notizen.
 * In Produktion würde der LLM die Notizen frei verarbeiten — wir wollen aber
 * sicher sein, dass kein versehentliches `<script>` durch die Vorschau geht.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
