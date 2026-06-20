// ─── POST /api/email-templates/generate ──────────────────────────
// Generates Shopify Liquid/HTML via DeepSeek AI with a dynamic,
// tone-specific layout prompt. Falls back to the deterministic
// generator if DEEPSEEK_API_KEY is not configured.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireFeature } from "@/lib/tier-guard";
import { generateEmailTemplate, type GenerateInput } from "@/lib/ai-email-generator";
import { getTemplateById, type EmailTemplateDef } from "@/lib/email-templates";
import {
  deductCredits,
  findKundeByKey,
  getCreditsState,
  getKundeProfile,
} from "@/lib/sheets";
import { getCreditCost } from "@/lib/credit-config-server";

// ─── Types ───────────────────────────────────────────────────────

interface RequestBody extends Partial<GenerateInput> {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  logoUrl?: string;
  headerImageUrl?: string;
  socialInstagram?: string;
  socialTiktok?: string;
  socialTwitter?: string;
  tonalität?: string;
  typographyStyle?: "serif" | "sans-serif";
  fontFamily?: string;
  addSocialLinks?: boolean;
  addDiscountCode?: boolean;
  discountCode?: string;
  addTrustBadges?: boolean;
  specialNotes?: string;
}

// Whitelist of selectable Google fonts (mirrors ConfigPanel.FONT_FAMILIES).
const ALLOWED_FONTS: Record<string, string> = {
  Inter: '"Inter", system-ui, sans-serif',
  Roboto: '"Roboto", Helvetica, Arial, sans-serif',
  "Open Sans": '"Open Sans", Helvetica, Arial, sans-serif',
  Montserrat: '"Montserrat", system-ui, sans-serif',
  Poppins: '"Poppins", system-ui, sans-serif',
  Lato: '"Lato", system-ui, sans-serif',
  Nunito: '"Nunito", system-ui, sans-serif',
  Raleway: '"Raleway", system-ui, sans-serif',
  "Work Sans": '"Work Sans", system-ui, sans-serif',
  "DM Sans": '"DM Sans", system-ui, sans-serif',
  "Playfair Display": '"Playfair Display", Georgia, serif',
  Merriweather: '"Merriweather", Georgia, serif',
  Lora: '"Lora", Georgia, serif',
  "EB Garamond": '"EB Garamond", Garamond, serif',
  "Cormorant Garamond": '"Cormorant Garamond", Garamond, serif',
  "Bodoni Moda": '"Bodoni Moda", Didot, serif',
  "DM Serif Display": '"DM Serif Display", Georgia, serif',
  "Space Grotesk": '"Space Grotesk", system-ui, sans-serif',
  "Bricolage Grotesque": '"Bricolage Grotesque", system-ui, sans-serif',
  Manrope: '"Manrope", system-ui, sans-serif',
  Geist: '"Geist", system-ui, sans-serif',
  "JetBrains Mono": '"JetBrains Mono", monospace',
};

// ─── Layout Directives (tone → explicit HTML/CSS instructions) ───

function buildStyleDirective(
  tonalität: string,
  primaryColor: string,
  secondaryColor: string,
  backgroundColor: string,
  fontFamily: string,
): string {
  const directives: Record<string, string> = {
    luxuriös: `
LAYOUT-STIL: Luxuriös & Exklusiv
- Padding: mindestens 100px oben/unten im Header, 80px in Sektionen
- Logo: ZENTRIERT, 80px Margin darunter, kein farbiger Hintergrund dahinter
- Typografie: ${fontFamily}, Headlines font-size: 30px, letter-spacing: 0.05em
- Body-Text: font-size: 15px, line-height: 2.0, color: #333
- CTA-Button: KEIN gefüllter Hintergrund — nur Border-Style: border: 1.5px solid ${primaryColor}; color: ${primaryColor}; background: transparent; padding: 18px 48px; border-radius: 0;
- Farben: NUR ${backgroundColor} als Hintergrund, ${primaryColor} nur als Akzent. KEINE anderen Farben.
- Trennlinien: border-top: 0.5px solid rgba(0,0,0,0.08) — extrem subtil
- KEINE Emojis. KEINE Ausrufezeichen. KEINE Großbuchstaben-Worte.
- Footer: maximal 2 Links, 11px Font, enormes Padding darunter
- Gesamt: Schweigen ist Gold. Whitespace ist das Design.`,

    nahbar: `
LAYOUT-STIL: Nahbar & Persönlich
- Padding: moderat (50-60px horizontal, 40px vertikal)
- Header: farbiger Hintergrund-Banner in ${primaryColor}18 (sehr helles ${primaryColor}), Logo LINKS
- Elemente: border-radius: 14px für alle Karten und Buttons
- CTA-Button: border-radius: 100px, background: ${primaryColor}, color: #fff, font-weight: 600, padding: 16px 36px
- Produktbilder: border-radius: 10px, box-shadow: 0 2px 12px rgba(0,0,0,0.08)
- Sektionshintergrund: abwechselnd #fff und #fafafa
- Footer: kurze, herzliche Verabschiedung, Social-Media-Links wenn vorhanden
- Ton: warmherzig, persönlich, Du-Form`,

    minimalistisch: `
LAYOUT-STIL: Extrem Minimalistisch
- Padding: 120px oben/unten Header, 80px Sektionen
- Hintergrund: ${backgroundColor} ÜBERALL — kein Farbwechsel zwischen Sektionen
- Typografie: ${fontFamily}, Headlines: 18px KAPITÄLCHEN (font-variant: small-caps), letter-spacing: 0.15em
- Body-Text: font-size: 13px, line-height: 1.8, color: #555
- KEIN Header-Bild. KEIN Dekor. KEIN Hintergrundmuster.
- CTA: Einziger Link als unterstrichener Text ODER sehr schlichter Button (border-radius: 0, kein Schatten, nur ${primaryColor} background)
- Produkttabelle: NUR Text, keine Bilder, dünne 1px Trennlinien
- Footer: 1 einziger Link, sehr klein, viel Abstand
- Zwischen jedem Element: mindestens 60px Abstand
- Ziel: Eine E-Mail, die man in 5 Sekunden versteht`,

    "aggressiv-sale": `
LAYOUT-STIL: Aggressiv Sale & Conversion-Fokus
- Oben: VOLLE-BREITE Banner mit background: ${primaryColor}, weiße Schrift 36px, font-weight: 900
- Direkt danach: Urgency-Zeile z.B. "⚡ Nur heute" in fetter Schrift
- Padding: kompakt (24-32px)
- Produktbilder: wenn vorhanden in 2-Spalten CSS-Grid (display: inline-block; width: 48%)
- CTA-Buttons: font-size: 18px, font-weight: 900, border-radius: 4px, background: ${primaryColor}, BREITE padding: 20px, MEHRERE CTAs (oben + unten)
- Headlines: font-size: 28-36px, font-weight: 900, line-height: 1.1
- Discount-Block (falls vorhanden): auffällig, großer Rahmen, Kontrastfarbe
- Kurze, kraftvolle Sätze. Power-Words: JETZT, SOFORT, EXKLUSIV, LIMITIERT
- Sekundärfarbe ${secondaryColor} für alternative Elemente`,

    seriös: `
LAYOUT-STIL: Professionell & Seriös
- Padding: Standard 40px horizontal, 32px vertikal
- Logo: LINKS-OBEN in weißem/hellem Header-Panel, keine Dekoration
- Sektionen: klar strukturiert mit dünnen Trennlinien (border-top: 1px solid #e8e8e8)
- Tabellen für Bestelldetails: sauber, 2-spaltig, rechtsbündig für Preise
- CTA-Button: solid background ${primaryColor}, border-radius: 6px, padding: 14px 28px, font-weight: 600
- Äußerer Hintergrund: #f5f5f5, E-Mail-Body: #ffffff
- Typografie: ${fontFamily}, klare Informationshierarchie
- Keine Dekorelemente, kein Gradient, kein Schatten übertrieben`,

    verspielt: `
LAYOUT-STIL: Verspielt & Energetisch
- Header: Gradient background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor})
- Abwechselnde Sektions-Hintergründe: #fff und ${primaryColor}0D (sehr helles Grün)
- Alle Elemente: border-radius: 20px oder mehr
- Emojis in Headlines erlaubt und erwünscht 🎉 ✨ 🛍️
- Buttons: Gradient-Hintergrund, border-radius: 100px, padding: 18px 40px
- Produktbilder: mit farbigem Border oder box-shadow in ${primaryColor}33
- Headline font-size: 28px+, lebendige, positive Sprache
- Mehrere visuelle Highlights, Energie-Farben`,
  };

  return directives[tonalität] ?? directives["seriös"];
}

// ─── AI Prompt Builder ───────────────────────────────────────────

function buildPrompt(tpl: EmailTemplateDef, body: RequestBody): string {
  const primaryColor = body.primaryColor || "#95BF47";
  const secondaryColor = body.secondaryColor || "#1a1a1a";
  const backgroundColor = body.backgroundColor || "#ffffff";
  const tonalität = body.tonalität || body.brandTone || "seriös";
  const typographyStyle = body.typographyStyle || "sans-serif";
  const fontKey =
    typeof body.fontFamily === "string" && ALLOWED_FONTS[body.fontFamily]
      ? body.fontFamily
      : null;
  const fontFamily = fontKey
    ? ALLOWED_FONTS[fontKey]
    : typographyStyle === "serif"
      ? '"Georgia", "Times New Roman", Times, serif'
      : '"Helvetica Neue", "Arial", Helvetica, sans-serif';
  // Used to instruct the AI to embed the right Google Fonts <link>.
  const googleFontHref = fontKey
    ? `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontKey).replace(/%20/g, "+")}:wght@400;500;600;700&display=swap`
    : null;

  const styleDirective = buildStyleDirective(
    tonalität,
    primaryColor,
    secondaryColor,
    backgroundColor,
    fontFamily,
  );

  // Build list of extra content to embed
  const extras: string[] = [];
  if (body.logoUrl) {
    extras.push(
      `Logo einbinden: <img src="${body.logoUrl}" alt="{{ shop.name }}" style="max-height:48px;max-width:180px;display:block;" />`,
    );
  }
  if (body.headerImageUrl) {
    extras.push(
      `Header-Bild direkt unterhalb des Logos: <img src="${body.headerImageUrl}" alt="Header" style="width:100%;display:block;" />`,
    );
  }
  if (body.addSocialLinks) {
    const links = [
      body.socialInstagram && `<a href="${body.socialInstagram}" style="margin:0 6px;text-decoration:none;">Instagram</a>`,
      body.socialTiktok && `<a href="${body.socialTiktok}" style="margin:0 6px;text-decoration:none;">TikTok</a>`,
      body.socialTwitter && `<a href="${body.socialTwitter}" style="margin:0 6px;text-decoration:none;">Twitter/X</a>`,
    ]
      .filter(Boolean)
      .join(" · ");
    if (links) extras.push(`Social-Media-Links im Footer: ${links}`);
  }
  if (body.addDiscountCode && body.discountCode) {
    extras.push(
      `Prominenter Rabattcode-Block: Code "${body.discountCode}" — auffällig gestaltet, gut lesbar, mit Hinweis "Für deinen nächsten Einkauf"`,
    );
  }
  if (body.addTrustBadges) {
    extras.push(
      'Trust-Badge-Sektion (kleines Raster): "🔒 Sichere Zahlung", "↩ 30 Tage Rückgabe", "🚚 Kostenloser Versand ab 50€"',
    );
  }
  if (body.specialNotes) {
    extras.push(`Individuelle Anweisung: ${body.specialNotes}`);
  }

  const liquidVars = tpl.liquidVariables.map((v) => `{{ ${v} }}`).join(", ");

  return `Du bist ein Senior Shopify-E-Mail-Template-Entwickler. Erstelle ein vollständiges, production-ready HTML E-Mail Template.

TEMPLATE-TYP: ${tpl.title}
SHOPIFY-KENNUNG: ${tpl.shopifyName}
BESCHREIBUNG: ${tpl.description}
TRIGGER: ${tpl.triggerContext}

MARKEN-KONFIGURATION:
- Primärfarbe: ${primaryColor}
- Sekundärfarbe: ${secondaryColor}
- Hintergrundfarbe: ${backgroundColor}
- Typografie: ${fontFamily}${googleFontHref ? `\n- Google-Font einbinden: füge im <head> ein <link href="${googleFontHref}" rel="stylesheet"> ein und nutze die Schrift in einem inline <style>html,body{font-family:${fontFamily};}</style> Block.` : ""}

${styleDirective}

ZUSÄTZLICHE INHALTE ZUR INTEGRATION:
${extras.length > 0 ? extras.map((e) => `- ${e}`).join("\n") : "- Keine weiteren Extras"}

VERFÜGBARE LIQUID-VARIABLEN (verwende diese im generierten Code):
${liquidVars}
- {% for line_item in order.line_items %} ... {{ line_item.title }}, {{ line_item.quantity }}, {{ line_item.price | money }}, {{ line_item.image | img_url: 'medium' }} ... {% endfor %}

TECHNISCHE PFLICHT-ANFORDERUNGEN:
1. Antworte AUSSCHLIESSLICH mit reinem HTML (beginnend mit einem Subject-Kommentar)
2. KEIN Markdown-Codeblock, KEINE Erklärung außerhalb des HTML
3. Beginne mit: <!-- Subject: [passender Betreff für diesen Template-Typ] -->
4. Danach sofort: <!DOCTYPE html>
5. Responsive Table-Layout, max-width: 640px, centered
6. AUSSCHLIESSLICH Inline-CSS (keine externen Stylesheets)
7. Kompatibel mit Gmail, Apple Mail, Outlook
8. Valides Shopify Liquid: {{ variable }}, {% for %}, {% if %}, {% endif %}
9. Alle Preise mit | money Filter: {{ order.total_price | money }}
10. Produktbilder: {{ line_item.image | img_url: 'medium' }}
11. Footer zwingend mit: <a href="{{ shop.url }}">{{ shop.name }}</a>
12. Abmelde-Hinweis im Footer

Beginne jetzt sofort mit dem Subject-Kommentar:`;
}

// ─── Extract subject from <!-- Subject: ... --> comment ──────────

function extractSubject(html: string, fallback: string): { subject: string; body: string } {
  const match = html.match(/<!--\s*Subject:\s*(.+?)\s*-->/);
  if (match) {
    return {
      subject: match[1].trim(),
      body: html.replace(match[0], "").trim(),
    };
  }
  return { subject: fallback, body: html };
}

// ─── Route Handler ───────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await getSession();
  const guard = await requireFeature(session, "emailTemplates");
  if (!guard.ok) return guard.response;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const templateId = body.templateId;
  if (!templateId || typeof templateId !== "string") {
    return NextResponse.json({ error: "templateId fehlt." }, { status: 400 });
  }
  const tpl = getTemplateById(templateId);
  if (!tpl) {
    return NextResponse.json({ error: "Unbekannte templateId." }, { status: 404 });
  }

  // ── Credit pre-check (admin bypasses the meter) ────────────────
  let kundeRowIndex: number | null = null;
  let kundeProfile: Awaited<ReturnType<typeof getKundeProfile>> | null = null;
  if (!session.isAdmin && session.lizenzschluessel) {
    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde) {
      return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });
    }
    kundeRowIndex = kunde.rowIndex;
    kundeProfile = await getKundeProfile(kunde.rowIndex);
    const credits = getCreditsState(kundeProfile);
    const cost = await getCreditCost("EMAIL_GENERATE");
    if (credits.balance < cost) {
      return NextResponse.json(
        {
          error: `Nicht genug Credits — du brauchst ${cost}, hast aber nur ${credits.balance}. Lade dein Konto unter /credits auf.`,
          creditsRemaining: credits.balance,
        },
        { status: 402 },
      );
    }
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;

  // ── Try DeepSeek if key is configured ──────────────────────────
  if (apiKey) {
    try {
      const prompt = buildPrompt(tpl, body);

      const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content:
                "Du bist ein Senior Shopify Email Template Entwickler. Antworte immer ausschließlich mit reinem HTML-Code, beginnend mit einem <!-- Subject: ... --> Kommentar, dann sofort <!DOCTYPE html>. Kein Text außerhalb des HTML.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 4000,
          temperature: 0.7, // Higher temp = more layout variety between tones
        }),
      });

      if (res.ok) {
        const data = await res.json();
        let raw: string = data.choices?.[0]?.message?.content ?? "";

        // Strip potential markdown code fences
        raw = raw
          .replace(/^```html\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();

        if (raw.includes("<") && raw.includes(">")) {
          const { subject, body: liquid } = extractSubject(raw, tpl.title);
          const creditsRemaining = await chargeCredits(
            kundeRowIndex,
            kundeProfile,
          );
          return NextResponse.json({
            liquid,
            subject,
            templateId: tpl.id,
            generatedAt: new Date().toISOString(),
            source: "deepseek",
            creditsRemaining,
          });
        }
      } else {
        console.error("[Generate] DeepSeek error:", res.status, await res.text());
      }
    } catch (err) {
      console.error("[Generate] DeepSeek fetch error:", err);
    }
  }

  // ── Fallback: deterministic generator ──────────────────────────
  try {
    const ALLOWED_TONES = ["seriös", "locker", "luxuriös", "verspielt", "minimalistisch"];
    const brandTone = (
      ALLOWED_TONES.includes(body.brandTone ?? "") ? body.brandTone : "seriös"
    ) as "seriös" | "locker" | "luxuriös" | "verspielt" | "minimalistisch";

    const result = generateEmailTemplate({
      templateId,
      brandTone,
      specialNotes:
        typeof body.specialNotes === "string" ? body.specialNotes.slice(0, 600) : "",
      primaryColor:
        typeof body.primaryColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.primaryColor)
          ? body.primaryColor
          : "#95BF47",
    });

    const creditsRemaining = await chargeCredits(kundeRowIndex, kundeProfile);
    return NextResponse.json({
      ...result,
      source: "deterministic",
      creditsRemaining,
      _warning: apiKey ? undefined : "DEEPSEEK_API_KEY nicht konfiguriert — deterministischer Fallback verwendet.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generierung fehlgeschlagen." },
      { status: 500 },
    );
  }
}

// ─── Credit deduction helper ────────────────────────────────────

async function chargeCredits(
  rowIndex: number | null,
  profile: Awaited<ReturnType<typeof getKundeProfile>> | null,
): Promise<number | undefined> {
  if (rowIndex === null || profile === null) return undefined;
  const result = await deductCredits(
    rowIndex,
    profile,
    await getCreditCost("EMAIL_GENERATE"),
  );
  return result.success ? result.remaining : undefined;
}
