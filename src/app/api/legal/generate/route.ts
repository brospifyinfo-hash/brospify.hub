import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey, getKundeProfile, updateKundeProfile } from "@/lib/sheets";

export const dynamic = "force-dynamic";

interface LegalData {
  firmenname: string;
  inhaber: string;
  strasse: string;
  plz: string;
  stadt: string;
  land: string;
  email: string;
  telefon: string;
  ustId: string;
  handelsregister: string;
}

// ─── Legal Page Templates ───────────────────────────────────────

function generateImpressum(d: LegalData): string {
  return `<h2>Impressum</h2>
<p><strong>Angaben gem&auml;&szlig; &sect; 5 TMG:</strong></p>
<p>${d.firmenname}<br>${d.inhaber}<br>${d.strasse}<br>${d.plz} ${d.stadt}<br>${d.land}</p>
<p><strong>Kontakt:</strong><br>E-Mail: ${d.email}<br>Telefon: ${d.telefon}</p>
${d.ustId ? `<p><strong>Umsatzsteuer-ID:</strong><br>Umsatzsteuer-Identifikationsnummer gem&auml;&szlig; &sect; 27a UStG: ${d.ustId}</p>` : ""}
${d.handelsregister ? `<p><strong>Handelsregister:</strong><br>${d.handelsregister}</p>` : ""}
<p><strong>Verantwortlich f&uuml;r den Inhalt nach &sect; 55 Abs. 2 RSt:</strong><br>${d.inhaber}<br>${d.strasse}<br>${d.plz} ${d.stadt}</p>
<h3>Haftungsausschluss</h3>
<p><strong>Haftung f&uuml;r Inhalte:</strong> Die Inhalte unserer Seiten wurden mit gr&ouml;&szlig;ter Sorgfalt erstellt. F&uuml;r die Richtigkeit, Vollst&auml;ndigkeit und Aktualit&auml;t der Inhalte k&ouml;nnen wir jedoch keine Gew&auml;hr &uuml;bernehmen.</p>
<p><strong>Haftung f&uuml;r Links:</strong> Unser Angebot enth&auml;lt Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen Einfluss haben. F&uuml;r die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter verantwortlich.</p>`;
}

function generateAGB(d: LegalData): string {
  return `<h2>Allgemeine Gesch&auml;ftsbedingungen</h2>
<h3>&sect; 1 Geltungsbereich</h3>
<p>F&uuml;r alle Bestellungen &uuml;ber unseren Online-Shop gelten die nachfolgenden AGB. Der Online-Shop wird betrieben von ${d.firmenname}, ${d.strasse}, ${d.plz} ${d.stadt}.</p>
<h3>&sect; 2 Vertragsschluss</h3>
<p>Die Darstellung der Produkte im Online-Shop stellt kein rechtlich bindendes Angebot, sondern eine Aufforderung zur Bestellung dar. Durch Anklicken des Buttons &quot;Kaufen&quot; geben Sie eine verbindliche Bestellung ab. Die Best&auml;tigung des Eingangs der Bestellung erfolgt per E-Mail.</p>
<h3>&sect; 3 Preise und Versandkosten</h3>
<p>Alle Preise verstehen sich inklusive der gesetzlichen Mehrwertsteuer. Versandkosten werden im Bestellvorgang gesondert ausgewiesen und vom K&auml;ufer getragen, sofern nichts anderes vereinbart ist.</p>
<h3>&sect; 4 Lieferung</h3>
<p>Die Lieferzeit betr&auml;gt, sofern nicht anders angegeben, 5&ndash;15 Werktage. Wir behalten uns vor, bei Nichtverfügbarkeit der Ware den Kunden unverzüglich zu informieren und bereits erhaltene Gegenleistungen zu erstatten.</p>
<h3>&sect; 5 Zahlung</h3>
<p>Die Zahlung erfolgt wahlweise per Kreditkarte, PayPal oder sonstige im Shop angebotene Zahlungsarten. Die Zahlung ist sofort mit Bestellabschluss f&auml;llig.</p>
<h3>&sect; 6 Eigentumsvorbehalt</h3>
<p>Die gelieferte Ware bleibt bis zur vollst&auml;ndigen Bezahlung Eigentum von ${d.firmenname}.</p>
<h3>&sect; 7 Schlussbestimmungen</h3>
<p>Es gilt das Recht der Bundesrepublik Deutschland. Die Europ&auml;ische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener">https://ec.europa.eu/consumers/odr</a>.</p>`;
}

function generateDatenschutz(d: LegalData): string {
  return `<h2>Datenschutzerkl&auml;rung</h2>
<h3>1. Verantwortlicher</h3>
<p>Verantwortlich f&uuml;r die Datenverarbeitung ist:<br>${d.firmenname}<br>${d.inhaber}<br>${d.strasse}<br>${d.plz} ${d.stadt}<br>E-Mail: ${d.email}</p>
<h3>2. Erhebung und Speicherung personenbezogener Daten</h3>
<p>Beim Besuch unseres Online-Shops erheben wir folgende Informationen: IP-Adresse, Datum und Uhrzeit der Anfrage, Inhalt der Anfrage, Zugriffsstatus/HTTP-Statuscode, &uuml;bertragene Datenmenge, Referrer-URL, Browser und Betriebssystem. Diese Daten werden f&uuml;r die Bereitstellung der Website ben&ouml;tigt (Art. 6 Abs. 1 lit. f DSGVO).</p>
<h3>3. Bestellvorgang</h3>
<p>Zur Vertragsabwicklung erheben wir: Name, Adresse, E-Mail, Zahlungsdaten. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserf&uuml;llung).</p>
<h3>4. Cookies</h3>
<p>Unser Shop verwendet Cookies. Technisch notwendige Cookies werden auf Basis von Art. 6 Abs. 1 lit. f DSGVO gesetzt. F&uuml;r Analyse-Cookies holen wir Ihre Einwilligung ein (Art. 6 Abs. 1 lit. a DSGVO).</p>
<h3>5. Ihre Rechte</h3>
<p>Sie haben gem&auml;&szlig; DSGVO das Recht auf: Auskunft (&sect; 15), Berichtigung (&sect; 16), L&ouml;schung (&sect; 17), Einschr&auml;nkung der Verarbeitung (&sect; 18), Daten&uuml;bertragbarkeit (&sect; 20), Widerspruch (&sect; 21). Kontaktieren Sie uns unter ${d.email}.</p>
<h3>6. Beschwerderecht</h3>
<p>Sie haben das Recht, sich bei einer Aufsichtsbeh&ouml;rde zu beschweren.</p>`;
}

function generateWiderruf(d: LegalData): string {
  return `<h2>Widerrufsbelehrung</h2>
<h3>Widerrufsrecht</h3>
<p>Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gr&uuml;nden diesen Vertrag zu widerrufen. Die Widerrufsfrist betr&auml;gt vierzehn Tage ab dem Tag, an dem Sie oder ein von Ihnen benannter Dritter die Waren in Besitz genommen haben.</p>
<p>Um Ihr Widerrufsrecht auszu&uuml;ben, m&uuml;ssen Sie uns (${d.firmenname}, ${d.strasse}, ${d.plz} ${d.stadt}, E-Mail: ${d.email}, Telefon: ${d.telefon}) mittels einer eindeutigen Erkl&auml;rung &uuml;ber Ihren Entschluss informieren.</p>
<h3>Folgen des Widerrufs</h3>
<p>Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschlie&szlig;lich der Lieferkosten, unverz&uuml;glich und sp&auml;testens binnen vierzehn Tagen zur&uuml;ckzuzahlen. Wir verwenden f&uuml;r die R&uuml;ckzahlung dasselbe Zahlungsmittel, das Sie bei der urspr&uuml;nglichen Transaktion eingesetzt haben.</p>
<h3>Ausschluss des Widerrufsrechts</h3>
<p>Das Widerrufsrecht besteht nicht bei Vertr&auml;gen zur Lieferung versiegelter Waren, die aus Gr&uuml;nden des Gesundheitsschutzes oder der Hygiene nicht zur R&uuml;ckgabe geeignet sind, wenn ihre Versiegelung nach der Lieferung entfernt wurde.</p>`;
}

// ─── Shopify API Helpers ────────────────────────────────────────

async function createShopifyPage(
  domain: string,
  token: string,
  title: string,
  bodyHtml: string
): Promise<{ id: number; handle: string } | null> {
  try {
    const res = await fetch(
      `https://${domain}/admin/api/2024-01/pages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({
          page: { title, body_html: bodyHtml, published: true },
        }),
      }
    );
    const data = await res.json();
    console.log(`[Legal] Page "${title}" response:`, res.status, JSON.stringify(data).substring(0, 300));
    if (res.ok && data.page) {
      return { id: data.page.id, handle: data.page.handle };
    }
    return null;
  } catch (err) {
    console.error(`[Legal] Page "${title}" error:`, err);
    return null;
  }
}

async function createFooterMenu(
  domain: string,
  token: string,
  pages: { title: string; handle: string }[]
): Promise<boolean> {
  try {
    // Build menu items linking to each page
    const menuItems = pages.map((p) => ({
      title: p.title,
      type: "http",
      url: `https://${domain}/pages/${p.handle}`,
    }));

    const res = await fetch(
      `https://${domain}/admin/api/2024-01/menus.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({
          menu: {
            title: "Rechtliches",
            handle: "rechtliches",
            menu_items: menuItems,
          },
        }),
      }
    );
    const data = await res.json();
    console.log("[Legal] Menu response:", res.status, JSON.stringify(data).substring(0, 300));
    return res.ok;
  } catch (err) {
    console.error("[Legal] Menu error:", err);
    return false;
  }
}

async function setPolicies(
  domain: string,
  token: string,
  data: LegalData
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://${domain}/admin/api/2024-01/policies.json`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({
          policy: {
            refund_policy: generateWiderruf(data),
            privacy_policy: generateDatenschutz(data),
            terms_of_service: generateAGB(data),
          },
        }),
      }
    );
    console.log("[Legal] Policies response:", res.status);
    return res.ok;
  } catch (err) {
    console.error("[Legal] Policies error:", err);
    return false;
  }
}

// ─── Main Handler ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body: LegalData & { disclaimer: boolean } = await req.json();

    // Validate disclaimer
    if (!body.disclaimer) {
      return NextResponse.json(
        { error: "Bitte bestätige den Disclaimer." },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.firmenname || !body.inhaber || !body.strasse || !body.plz || !body.stadt || !body.email) {
      return NextResponse.json(
        { error: "Bitte fülle alle Pflichtfelder aus." },
        { status: 400 }
      );
    }

    // Get customer Shopify data
    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde || !kunde.shopifyToken || !kunde.shopDomain) {
      return NextResponse.json(
        { error: "Shop nicht verbunden. Bitte zuerst unter Einstellungen verbinden." },
        { status: 400 }
      );
    }

    const token = kunde.shopifyToken;
    const domain = kunde.shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const legalData: LegalData = {
      firmenname: body.firmenname,
      inhaber: body.inhaber,
      strasse: body.strasse,
      plz: body.plz,
      stadt: body.stadt,
      land: body.land || "Deutschland",
      email: body.email,
      telefon: body.telefon || "",
      ustId: body.ustId || "",
      handelsregister: body.handelsregister || "",
    };

    console.log("[Legal] Generating pages for:", domain);

    // Step 1: Create all 4 legal pages
    const pageDefinitions = [
      { title: "Impressum", html: generateImpressum(legalData) },
      { title: "AGB", html: generateAGB(legalData) },
      { title: "Datenschutzerklärung", html: generateDatenschutz(legalData) },
      { title: "Widerrufsbelehrung", html: generateWiderruf(legalData) },
    ];

    const createdPages: { title: string; handle: string }[] = [];
    const failedPages: string[] = [];

    for (const pageDef of pageDefinitions) {
      const result = await createShopifyPage(domain, token, pageDef.title, pageDef.html);
      if (result) {
        createdPages.push({ title: pageDef.title, handle: result.handle });
      } else {
        failedPages.push(pageDef.title);
      }
    }

    // Step 2: Create footer menu
    let menuCreated = false;
    if (createdPages.length > 0) {
      menuCreated = await createFooterMenu(domain, token, createdPages);
    }

    // Step 3: Set Shopify legal policies
    const policiesSet = await setPolicies(domain, token, legalData);

    console.log("[Legal] Result:", {
      pagesCreated: createdPages.length,
      pagesFailed: failedPages.length,
      menuCreated,
      policiesSet,
    });

    // Update onboarding checklist
    if (createdPages.length > 0) {
      try {
        const profile = await getKundeProfile(kunde.rowIndex);
        await updateKundeProfile(kunde.rowIndex, {
          ...profile,
          onboarding_checklist: { ...profile.onboarding_checklist, legal_texts_generated: true },
        });
      } catch (e) { console.error("[Legal] Checklist update failed:", e); }
    }

    return NextResponse.json({
      success: true,
      pages: {
        created: createdPages.map((p) => p.title),
        failed: failedPages,
      },
      menuCreated,
      policiesSet,
    });
  } catch (error) {
    console.error("[Legal] Error:", error);
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten." },
      { status: 500 }
    );
  }
}
