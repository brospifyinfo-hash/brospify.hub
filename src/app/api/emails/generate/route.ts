import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey } from "@/lib/sheets";

export const dynamic = "force-dynamic";

const TONE_INSTRUCTIONS: Record<string, string> = {
  professional: "Schreibe sachlich, präzise und professionell. Keine Umgangssprache. Duze nicht.",
  friendly: "Schreibe herzlich, persönlich und freundlich. Duze den Kunden. Verwende Emojis sparsam.",
  bold: "Schreibe kraftvoll, direkt und energiegeladen. Kurze Sätze. Starke Verben. Keine Weichspüler.",
  luxury: "Schreibe exklusiv, edel und zurückhaltend. Weniger ist mehr. Kein Ausrufezeichen.",
};

const TEMPLATE_NAMES: Record<string, string> = {
  order_confirmation: "Bestellbestätigung",
  shipping_confirmation: "Versandbestätigung",
  abandoned_checkout: "Abgebrochener Checkout (Recovery)",
  customer_welcome: "Willkommens-E-Mail",
  refund_notification: "Rückerstattungsbestätigung",
  order_cancelled: "Bestellstornierung",
  password_reset: "Passwort zurücksetzen",
  account_activation: "Konto-Aktivierung",
  fulfillment_request: "Lieferbestätigung (Fulfillment)",
  invoice: "Rechnungsentwurf / Pro-forma",
};

const LIQUID_EXAMPLES: Record<string, string> = {
  order_confirmation: `{{ shop.name }}, {{ order.name }}, {{ order.order_status_url }}, {{ customer.first_name }}, {% for line_item in line_items %}{{ line_item.title }}{% endfor %}, {{ subtotal_price | money }}, {{ total_price | money }}`,
  shipping_confirmation: `{{ shop.name }}, {{ order.name }}, {{ tracking_company }}, {{ tracking_number }}, {{ tracking_url }}, {{ customer.first_name }}`,
  abandoned_checkout: `{{ shop.name }}, {{ checkout.abandoned_checkout_url }}, {{ customer.first_name }}, {% for line_item in line_items %}{{ line_item.title }}, {{ line_item.price | money }}{% endfor %}`,
  customer_welcome: `{{ shop.name }}, {{ customer.first_name }}, {{ customer.email }}, {{ shop.url }}`,
  refund_notification: `{{ shop.name }}, {{ order.name }}, {{ refund_amount | money }}, {{ customer.first_name }}`,
  order_cancelled: `{{ shop.name }}, {{ order.name }}, {{ customer.first_name }}, {{ total_price | money }}`,
  password_reset: `{{ shop.name }}, {{ customer.first_name }}, {{ customer.reset_password_url }}`,
  account_activation: `{{ shop.name }}, {{ customer.first_name }}, {{ customer.account_activation_url }}`,
  fulfillment_request: `{{ shop.name }}, {{ order.name }}, {{ customer.first_name }}, {{ fulfillment.tracking_company }}, {{ fulfillment.tracking_url }}`,
  invoice: `{{ shop.name }}, {{ customer.first_name }}, {{ draft_order.name }}, {{ draft_order.invoice_url }}, {{ draft_order.total_price | money }}`,
};

function buildPrompt(
  type: string,
  tone: string,
  brandName: string,
  extraInfo: string,
  shopDomain: string
): string {
  const templateName = TEMPLATE_NAMES[type] || type;
  const toneInstr = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.professional;
  const liquidVars = LIQUID_EXAMPLES[type] || "";

  return `Du bist ein Shopify E-Mail-Template Experte. Erstelle ein vollständiges, production-ready Shopify Email Template für: ${templateName}

SHOP-DETAILS:
- Brand-Name: ${brandName || "Mein Shop"}
- Shop-Domain: ${shopDomain || "example.myshopify.com"}
- Zusatzinfos: ${extraInfo || "Keine weiteren Infos"}

TON-VORGABE: ${toneInstr}

VERFÜGBARE LIQUID-VARIABLEN (nutze diese):
${liquidVars}

ANFORDERUNGEN:
1. Liefere AUSSCHLIESSLICH validen HTML-Code mit eingebettetem CSS (kein Markdown, kein Erklärungstext).
2. Verwende eine responsive Table-basierte Email-Struktur (640px max-width), kompatibel mit Gmail, Outlook, Apple Mail.
3. Nutze Inline-CSS für alle Styles.
4. Akzentfarbe: #95BF47 (Shopify-Grün) für Buttons und Highlights.
5. Hintergrund: #0a0a0a oder #1a1a1a für moderne Dark-Mode-kompatible Emails.
6. Eingebettete Liquid-Variablen exakt so nutzen wie von Shopify vorgegeben.
7. Füge einen klaren CTA-Button ein (z.B. "Bestellung ansehen", "Jetzt einlösen").
8. Footer mit Abmelde-Link: <a href="{{ shop.url }}">{{ shop.name }}</a>
9. Keine externen Bild-URLs außer {{ line_item.image | img_url: 'small' }}.
10. Breite: 600px im Container, 100% im Wrapper.

Antworte NUR mit dem HTML-Code. Beginne direkt mit <!DOCTYPE html>.`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { type, tone, brandName, extraInfo } = await req.json();

    if (!type || !TEMPLATE_NAMES[type]) {
      return NextResponse.json({ error: "Ungültiger Template-Typ" }, { status: 400 });
    }

    // Get shop domain for context
    let shopDomain = "";
    try {
      if (session.lizenzschluessel) {
        const kunde = await findKundeByKey(session.lizenzschluessel);
        shopDomain = kunde?.shopDomain || "";
      }
    } catch { /* ignore */ }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI-API nicht konfiguriert." }, { status: 500 });
    }

    const prompt = buildPrompt(type, tone || "professional", brandName || "", extraInfo || "", shopDomain);

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "Du bist ein Shopify Email Template Experte. Antworte immer nur mit reinem HTML-Code ohne Erklärungen." },
          { role: "user", content: prompt },
        ],
        max_tokens: 3000,
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[EmailGen] DeepSeek error:", res.status, err);
      return NextResponse.json({ error: "KI-Generierung fehlgeschlagen." }, { status: 502 });
    }

    const data = await res.json();
    let html = data.choices?.[0]?.message?.content || "";

    // Strip markdown code blocks if AI wrapped the response
    html = html.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    if (!html.includes("<")) {
      return NextResponse.json({ error: "Kein gültiges HTML generiert." }, { status: 500 });
    }

    console.log("[EmailGen] Generated template:", type, "length:", html.length);

    return NextResponse.json({
      success: true,
      html,
      type,
      templateName: TEMPLATE_NAMES[type],
    });
  } catch (error) {
    console.error("[EmailGen] Error:", error);
    return NextResponse.json({ error: "Interner Fehler bei der Generierung." }, { status: 500 });
  }
}
