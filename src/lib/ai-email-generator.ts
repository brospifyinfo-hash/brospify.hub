// ─── AI Email Liquid/HTML Generator ──────────────────────────────
// Produces a valid Shopify-Liquid email body for one of the Top 10
// notification templates based on a brand tone and special hints.
//
// In production, this module would call an LLM (OpenAI/Anthropic).
// To keep the deployment light and deterministic in dev, we generate
// real, valid Shopify Liquid using a structured template engine.
// The LLM call hook is exposed at the bottom (generateWithLLM) and
// can be wired up by setting the OPENAI_API_KEY env var.

import { EmailTemplateDef, getTemplateById } from "./email-templates";

export type BrandTone =
  | "seriös"
  | "locker"
  | "luxuriös"
  | "verspielt"
  | "minimalistisch";

export interface GenerateInput {
  templateId: string;
  brandTone: BrandTone;
  specialNotes?: string;
  brandName?: string;
  primaryColor?: string;
}

export interface GenerateResult {
  templateId: string;
  liquid: string;
  subject: string;
  generatedAt: string;
}

// ─── Tone → copy variants ────────────────────────────────────────

interface ToneCopy {
  greeting: (firstName: string) => string;
  signOff: string;
  voice: "Sie" | "Du";
  intro: Record<string, string>;
}

const TONE_COPY: Record<BrandTone, ToneCopy> = {
  seriös: {
    greeting: (n) => `Sehr geehrte/r ${n}`,
    signOff: "Mit freundlichen Grüßen",
    voice: "Sie",
    intro: {
      "order-confirmation":
        "wir bestätigen den Eingang Ihrer Bestellung und bedanken uns für Ihr Vertrauen.",
      "shipping-confirmation":
        "Ihre Bestellung wurde verpackt und dem Versanddienstleister übergeben.",
      "abandoned-checkout":
        "Sie haben Artikel im Warenkorb hinterlassen. Wir haben diese für Sie reserviert.",
      "customer-account-welcome":
        "wir freuen uns, Sie als neuen Kunden begrüßen zu dürfen.",
      "order-refund":
        "die Rückerstattung Ihrer Bestellung wurde erfolgreich verarbeitet.",
      "order-cancelled":
        "Ihre Bestellung wurde wie gewünscht storniert.",
      "shipping-update":
        "Ihre Sendung befindet sich auf dem letzten Zustellweg.",
      "order-delivered":
        "Ihre Bestellung wurde erfolgreich an die angegebene Adresse zugestellt.",
      "payment-receipt":
        "anbei erhalten Sie den Beleg über Ihre erfolgte Zahlung.",
      "customer-invitation":
        "wir laden Sie ein, Ihr Kundenkonto zu aktivieren.",
    },
  },
  locker: {
    greeting: (n) => `Hey ${n}`,
    signOff: "Bis bald",
    voice: "Du",
    intro: {
      "order-confirmation":
        "danke für deine Bestellung — wir kümmern uns ab sofort darum.",
      "shipping-confirmation":
        "dein Paket ist auf dem Weg zu dir!",
      "abandoned-checkout":
        "du hast was im Warenkorb vergessen — kein Stress, ist alles noch da.",
      "customer-account-welcome":
        "willkommen an Bord! Schön, dass du dabei bist.",
      "order-refund":
        "deine Rückerstattung ist durch — Geld kommt in den nächsten Tagen.",
      "order-cancelled":
        "deine Bestellung wurde storniert. Alles gut.",
      "shipping-update":
        "dein Paket kommt heute noch an.",
      "order-delivered":
        "dein Paket ist da — viel Spaß damit!",
      "payment-receipt":
        "hier ist dein Beleg, falls du ihn brauchst.",
      "customer-invitation":
        "klick einmal kurz rein, dann bist du startklar.",
    },
  },
  luxuriös: {
    greeting: (n) => `Verehrte/r ${n}`,
    signOff: "Mit den besten Empfehlungen",
    voice: "Sie",
    intro: {
      "order-confirmation":
        "wir danken Ihnen für Ihre exquisite Auswahl. Ihre Bestellung ist eingegangen.",
      "shipping-confirmation":
        "Ihr Paket wurde mit Sorgfalt vorbereitet und ist nun unterwegs zu Ihnen.",
      "abandoned-checkout":
        "Eine Auswahl wartet noch auf Ihre Entscheidung.",
      "customer-account-welcome":
        "es ist uns eine Ehre, Sie in unserem Kreis willkommen zu heißen.",
      "order-refund":
        "Ihre Rückerstattung wurde reibungslos und diskret abgewickelt.",
      "order-cancelled":
        "Ihre Stornierung wurde umgehend berücksichtigt.",
      "shipping-update":
        "Ihre Sendung wird heute zugestellt.",
      "order-delivered":
        "Ihre Bestellung ist eingetroffen. Wir wünschen erlesene Freude.",
      "payment-receipt":
        "anbei Ihr offizieller Zahlungsbeleg.",
      "customer-invitation":
        "wir laden Sie ein, Ihr persönliches Konto bei uns zu aktivieren.",
    },
  },
  verspielt: {
    greeting: (n) => `Hi ${n}!`,
    signOff: "Cheers",
    voice: "Du",
    intro: {
      "order-confirmation":
        "Yes! Bestellung angekommen — und wir können es kaum erwarten, sie zu dir zu schicken.",
      "shipping-confirmation":
        "Pssst — dein Paket ist gerade auf großer Reise.",
      "abandoned-checkout":
        "Da haben sich ein paar Lieblingsstücke einsam in deinem Warenkorb gefühlt.",
      "customer-account-welcome":
        "Willkommen in der Crew!",
      "order-refund":
        "Deine Rückerstattung ist geflitzt — alles wieder gut.",
      "order-cancelled":
        "Storniert — kein Drama, beim nächsten Mal klappt's.",
      "shipping-update":
        "Achtung, dein Paket kommt heute angeflogen!",
      "order-delivered":
        "Tadaa — dein Paket ist gelandet!",
      "payment-receipt":
        "Beleg für deine Unterlagen.",
      "customer-invitation":
        "Ein Klick und du bist Teil der Crew.",
    },
  },
  minimalistisch: {
    greeting: (n) => `Hallo ${n}`,
    signOff: "Danke",
    voice: "Du",
    intro: {
      "order-confirmation": "Bestellung erhalten.",
      "shipping-confirmation": "Paket versendet.",
      "abandoned-checkout": "Du hast Artikel im Warenkorb.",
      "customer-account-welcome": "Konto erstellt.",
      "order-refund": "Rückerstattung verarbeitet.",
      "order-cancelled": "Bestellung storniert.",
      "shipping-update": "Lieferung heute.",
      "order-delivered": "Geliefert.",
      "payment-receipt": "Zahlungsbeleg.",
      "customer-invitation": "Konto aktivieren.",
    },
  },
};

// ─── Body block builders (Liquid) ────────────────────────────────

function lineItemsBlock(): string {
  return `
    {% for line in order.line_items %}
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #eaeaea;font:400 14px/1.4 -apple-system,BlinkMacSystemFont,'SF Pro Text','Inter',sans-serif;color:#1d1d1f;">
          {{ line.title }}
          {% if line.variant_title %}<br><span style="color:#86868b;font-size:13px;">{{ line.variant_title }}</span>{% endif %}
        </td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid #eaeaea;font:400 14px/1.4 -apple-system,BlinkMacSystemFont,'SF Pro Text','Inter',sans-serif;color:#1d1d1f;white-space:nowrap;">
          {{ line.quantity }} × {{ line.price | money }}
        </td>
      </tr>
    {% endfor %}
  `;
}

function ctaButton(label: string, href: string, color: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:32px 0;">
      <tr>
        <td style="border-radius:12px;background:${color};">
          <a href="${href}" style="display:inline-block;padding:14px 28px;font:600 15px/1 -apple-system,BlinkMacSystemFont,'SF Pro Text','Inter',sans-serif;color:#ffffff;text-decoration:none;border-radius:12px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>
  `;
}

// ─── Subject builder ─────────────────────────────────────────────

function buildSubject(template: EmailTemplateDef, tone: BrandTone): string {
  const base: Record<string, string> = {
    "order-confirmation": "Bestellung {{ order.name }} bestätigt",
    "shipping-confirmation": "Dein Paket {{ order.name }} ist unterwegs",
    "abandoned-checkout": "Du hast etwas vergessen",
    "customer-account-welcome": "Willkommen bei {{ shop.name }}",
    "order-refund": "Rückerstattung verarbeitet",
    "order-cancelled": "Bestellung {{ order.name }} storniert",
    "shipping-update": "Lieferupdate für {{ order.name }}",
    "order-delivered": "Deine Bestellung ist da",
    "payment-receipt": "Zahlungsbeleg {{ order.name }}",
    "customer-invitation": "Aktiviere dein Konto",
  };
  const subject = base[template.id] ?? template.title;
  if (tone === "luxuriös") return `· ${subject} ·`;
  if (tone === "verspielt") return `🎉 ${subject}`;
  return subject;
}

// ─── Wrapper layout ──────────────────────────────────────────────

interface WrapOpts {
  subject: string;
  preheader: string;
  bodyHtml: string;
  primaryColor: string;
}

function wrap({ subject, preheader, bodyHtml, primaryColor }: WrapOpts): string {
  return `<!doctype html>
<html lang="{{ shop.locale }}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${subject}</title>
    <style>
      @media only screen and (max-width: 600px) {
        .container { width: 100% !important; padding: 16px !important; }
        .card { padding: 20px !important; border-radius: 16px !important; }
        h1 { font-size: 22px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Inter',sans-serif;">
    <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f7;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" class="container" cellspacing="0" cellpadding="0" width="560" style="width:560px;max-width:100%;">
            <tr>
              <td style="padding-bottom:24px;text-align:center;">
                <a href="{{ shop.url }}" style="font:700 20px/1 -apple-system,BlinkMacSystemFont,'SF Pro Display','Inter',sans-serif;color:#1d1d1f;text-decoration:none;letter-spacing:-0.02em;">
                  {{ shop.name }}
                </a>
              </td>
            </tr>
            <tr>
              <td class="card" style="background:#ffffff;border-radius:20px;padding:40px;border:1px solid rgba(0,0,0,0.04);box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 8px;text-align:center;font:400 12px/1.5 -apple-system,BlinkMacSystemFont,'SF Pro Text','Inter',sans-serif;color:#86868b;">
                © {{ "now" | date: "%Y" }} {{ shop.name }} · <a href="{{ shop.url }}" style="color:#86868b;">{{ shop.domain }}</a>
                <br><span style="color:#86868b;">Erstellt mit Brospify Hub · Akzent <span style="color:${primaryColor};">●</span></span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// ─── Per-template body builders ──────────────────────────────────

function buildBody(
  template: EmailTemplateDef,
  tone: BrandTone,
  notes: string | undefined,
  primaryColor: string,
): string {
  const t = TONE_COPY[tone];
  const greeting = `${t.greeting("{{ customer.first_name }}")},`;
  const intro = t.intro[template.id];
  const noteBlock = notes
    ? `<p style="margin:24px 0 0;padding:16px;border-radius:12px;background:#f5f5f7;font:400 14px/1.5 -apple-system,BlinkMacSystemFont,'SF Pro Text','Inter',sans-serif;color:#1d1d1f;">${escapeHtml(notes)}</p>`
    : "";

  const headStyles = `font:700 28px/1.2 -apple-system,BlinkMacSystemFont,'SF Pro Display','Inter',sans-serif;color:#1d1d1f;letter-spacing:-0.02em;margin:0 0 12px;`;
  const para = `font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'SF Pro Text','Inter',sans-serif;color:#1d1d1f;margin:0 0 12px;`;

  const sign = `<p style="${para}margin-top:32px;">${t.signOff},<br>{{ shop.name }}</p>`;

  switch (template.id) {
    case "order-confirmation":
      return `
        <h1 style="${headStyles}">${template.title}</h1>
        <p style="${para}">${greeting}</p>
        <p style="${para}">${intro}</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;border-top:1px solid #eaeaea;">
          ${lineItemsBlock()}
          <tr>
            <td style="padding:16px 0 0;font:600 15px/1.4 -apple-system,BlinkMacSystemFont,'SF Pro Text','Inter',sans-serif;color:#1d1d1f;">Gesamt</td>
            <td align="right" style="padding:16px 0 0;font:600 15px/1.4 -apple-system,BlinkMacSystemFont,'SF Pro Text','Inter',sans-serif;color:#1d1d1f;">{{ order.total_price | money }}</td>
          </tr>
        </table>
        ${ctaButton("Bestellung ansehen", "{{ order.order_status_url }}", primaryColor)}
        ${noteBlock}
        ${sign}
      `;

    case "shipping-confirmation":
      return `
        <h1 style="${headStyles}">${template.title}</h1>
        <p style="${para}">${greeting}</p>
        <p style="${para}">${intro}</p>
        <p style="${para}"><strong>Tracking:</strong> {{ fulfillment.tracking_number }}</p>
        ${ctaButton("Sendung verfolgen", "{{ fulfillment.tracking_url }}", primaryColor)}
        ${noteBlock}
        ${sign}
      `;

    case "abandoned-checkout":
      return `
        <h1 style="${headStyles}">${template.title}</h1>
        <p style="${para}">${greeting}</p>
        <p style="${para}">${intro}</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;border-top:1px solid #eaeaea;">
          {% for line in checkout.line_items %}
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #eaeaea;font:400 14px/1.4 -apple-system,BlinkMacSystemFont,'SF Pro Text','Inter',sans-serif;color:#1d1d1f;">{{ line.title }}</td>
              <td align="right" style="padding:12px 0;border-bottom:1px solid #eaeaea;font:400 14px/1.4 -apple-system,BlinkMacSystemFont,'SF Pro Text','Inter',sans-serif;color:#1d1d1f;">{{ line.quantity }} × {{ line.price | money }}</td>
            </tr>
          {% endfor %}
        </table>
        ${ctaButton("Warenkorb wiederherstellen", "{{ checkout.abandoned_checkout_url }}", primaryColor)}
        ${noteBlock}
        ${sign}
      `;

    case "customer-account-welcome":
      return `
        <h1 style="${headStyles}">Willkommen 👋</h1>
        <p style="${para}">${greeting}</p>
        <p style="${para}">${intro}</p>
        ${ctaButton("Shop entdecken", "{{ shop.url }}", primaryColor)}
        ${noteBlock}
        ${sign}
      `;

    case "order-refund":
      return `
        <h1 style="${headStyles}">${template.title}</h1>
        <p style="${para}">${greeting}</p>
        <p style="${para}">${intro}</p>
        <p style="${para}"><strong>Erstattungsbetrag:</strong> {{ refund.amount | money }}</p>
        ${ctaButton("Bestellung ansehen", "{{ order.order_status_url }}", primaryColor)}
        ${noteBlock}
        ${sign}
      `;

    case "order-cancelled":
      return `
        <h1 style="${headStyles}">${template.title}</h1>
        <p style="${para}">${greeting}</p>
        <p style="${para}">${intro}</p>
        {% if order.cancel_reason %}<p style="${para}"><strong>Grund:</strong> {{ order.cancel_reason }}</p>{% endif %}
        ${ctaButton("Erneut bestellen", "{{ shop.url }}", primaryColor)}
        ${noteBlock}
        ${sign}
      `;

    case "shipping-update":
      return `
        <h1 style="${headStyles}">${template.title}</h1>
        <p style="${para}">${greeting}</p>
        <p style="${para}">${intro}</p>
        ${ctaButton("Sendung verfolgen", "{{ fulfillment.tracking_url }}", primaryColor)}
        ${noteBlock}
        ${sign}
      `;

    case "order-delivered":
      return `
        <h1 style="${headStyles}">${template.title}</h1>
        <p style="${para}">${greeting}</p>
        <p style="${para}">${intro}</p>
        ${ctaButton("Mehr entdecken", "{{ shop.url }}", primaryColor)}
        ${noteBlock}
        ${sign}
      `;

    case "payment-receipt":
      return `
        <h1 style="${headStyles}">${template.title}</h1>
        <p style="${para}">${greeting}</p>
        <p style="${para}">${intro}</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;">
          <tr><td style="${para}">Bestellung</td><td align="right" style="${para}">{{ order.name }}</td></tr>
          <tr><td style="${para}">Betrag</td><td align="right" style="${para}">{{ order.total_price | money }}</td></tr>
        </table>
        ${ctaButton("Beleg herunterladen", "{{ order.order_status_url }}", primaryColor)}
        ${noteBlock}
        ${sign}
      `;

    case "customer-invitation":
      return `
        <h1 style="${headStyles}">${template.title}</h1>
        <p style="${para}">${greeting}</p>
        <p style="${para}">${intro}</p>
        ${ctaButton("Konto aktivieren", "{{ customer_account_activation_url }}", primaryColor)}
        ${noteBlock}
        ${sign}
      `;

    default:
      return `<p style="${para}">${greeting}</p><p style="${para}">${intro ?? ""}</p>${sign}`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Public entry point ──────────────────────────────────────────

export function generateEmailTemplate(input: GenerateInput): GenerateResult {
  const template = getTemplateById(input.templateId);
  if (!template) {
    throw new Error(`Unknown template id: ${input.templateId}`);
  }
  const tone: BrandTone = input.brandTone ?? "seriös";
  const primaryColor = input.primaryColor ?? "#95BF47";

  const subject = buildSubject(template, tone);
  const body = buildBody(template, tone, input.specialNotes, primaryColor);
  const liquid = wrap({
    subject,
    preheader: template.tagline,
    bodyHtml: body,
    primaryColor,
  });

  return {
    templateId: template.id,
    liquid,
    subject,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Optional: real LLM integration hook ─────────────────────────
// Wire up an API key and call this from the route handler instead
// of generateEmailTemplate to swap in a real model output.
export async function generateWithLLM(
  _input: GenerateInput,
): Promise<GenerateResult> {
  // Pseudocode for production wiring:
  //
  //   const resp = await fetch("https://api.openai.com/v1/chat/completions", { ... });
  //   const liquid = resp.choices[0].message.content;
  //   return { templateId, liquid, subject, generatedAt };
  //
  // For now, fall through to the deterministic generator.
  return generateEmailTemplate(_input);
}
