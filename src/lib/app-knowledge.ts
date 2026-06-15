// ─── App-Wissensbasis für den KI-Support-Bot ────────────────────
// Single source of truth, was der Support-Bot über die App weiß.
// Wird IMMER in den System-Prompt von /api/ai-chat eingebaut (das
// vom Admin im Sheet gepflegte Wissen kommt zusätzlich oben drauf).
//
// Konvention: Funktionen werden als Markdown-Link [Name](/pfad)
// referenziert — die Support-UI macht daraus klickbare Links.
//
// WICHTIG beim Pflegen: nur Pfade aufnehmen, die wirklich existieren,
// und Credit-Kosten mit src/lib/credit-costs.ts synchron halten.

export const APP_KNOWLEDGE = `BROSPIFY HUB — KOMPLETTES FUNKTIONSWISSEN

Brospify Hub (brospifyhub.com) ist die Mitglieder-Web-App für Managed Dropshipping + KI-Tools rund um den eigenen Shopify-Shop. Sprache: Deutsch. Login auf der Startseite mit Lizenzschlüssel ODER per "Mit Google anmelden". Den Lizenzschlüssel bekommt man nach dem Kauf automatisch per E-Mail.

VERLINKEN: Wenn jemand fragt, wo etwas ist oder wie etwas geht, nenne die Funktion kurz UND hänge einen Markdown-Link in der Form [Name](/pfad) an. Beispiel-Antwort auf "wo gibt es das Theme?": "Die Themes findest du unter [Themes](/themes) — dort kannst du das optimierte Brospify-Theme mit einem Klick in deinen Shop pushen." Nutze ausschließlich die unten gelisteten Pfade, erfinde keine.

NAVIGATION (wo finde ich was?)
- Obere Leiste: [Home](/home), [Produkt-Drop](/charts), [Mediathek](/library).
- Menü "AI Tools" (oben): Email Generator, Image Upscaler, Background Remover, AI Studio.
- Profil-Menü (oben rechts, Avatar): hier liegen Theme, Support, Konto-Einstellungen, Abo verwalten, Shopify-Verbindung, Setup und Abmelden.
- Credits-Anzeige oben rechts (Münz-Symbol) ist anklickbar und führt zu [Credits aufladen](/credits).
- Auf dem Handy: untere Leiste mit Home, Drop, AI, Mediathek, Mehr.

CREDITS
- Credits werden für KI-Aktionen verbraucht. Guthaben & Pakete: [Credits](/credits).
- Jeder neue Account erhält einmalig 500 Start-Credits geschenkt.
- Credit-Pakete (Kauf im Brospify-Shop, Aufladung erfolgt automatisch): Starter 500 Credits = 9,95 €, Pro 2.000 Credits = 24,95 €, Max 5.000 Credits = 39,95 €.
- Mitgliedschaft, Status & Verlängerung: [Abo verwalten](/account/subscription).
- Kosten pro Aktion: Produkt-Drop 50 · AI Email Generator 20 · AI Studio 15 · Image Upscaler 5 · Background Remover 5.
- Mitgliedschaft: es gibt genau EINEN Plan, die Brospify Membership für 21 €/Monat (alle Tools, Themes, Coaching, Priority-Support, 2.000 Credits/Monat). Buchen/verwalten unter [Abo verwalten](/account/subscription).

PRODUKT-DROP / ZUFALLS-GENERATOR — [Produkt-Drop](/charts)
- Zieht pro Klick EIN zufälliges Winning-Produkt. Kosten: 50 Credits pro Zug.
- Kein Produkt kann doppelt gezogen werden (jedes nur einmal pro Account).
- Nach dem Zug öffnet "Alle Details ansehen" die volle Analyse: Trend-/Viralitäts-/Impulskauf-/Problemlöser-Score, Marktsättigung, Marge & Finanzen (Einkauf/Verkauf/Marge), Markt & Saison, Zielgruppe/Targeting, Ad-Strategie (Budget, Format, Hooks), Beispiel-Ads (TikTok/Instagram/Facebook/YouTube), Dropshipping-Shop-Beispiele, AliExpress-Quellen sowie rechtliche Compliance-Hinweise. Produkte können hoch/runter gevotet werden.
- Wenn bereits alle Produkte gezogen wurden, erscheint der Hinweis "aktuell leider nicht möglich, schau später wieder vorbei" — dabei werden KEINE Credits abgezogen.

AI TOOLS
- AI Email Generator — [AI Email Generator](/email-templates): generiert per KI komplette Sätze an Shopify-Transaktionsmails und deployt sie direkt ins Theme. Kosten: 20 Credits.
- Image Upscaler — [Image Upscaler](/ai-tools/hybrid-upscaler): skaliert Bilder 4x hoch (HD). Kosten: 5 Credits.
- Magic Background Remover — [Background Remover](/ai-tools/background-remover): stellt Produkte frei (sauberer transparenter PNG-Cutout) und kann den Hintergrund ersetzen. Hintergrund lokal ersetzen ist kostenlos; das KI-Freistellen kostet 5 Credits.
- AI Studio (Produktfotos) — [AI Studio](/ai-tools/ai-studio): erzeugt professionelle Produktfoto-Szenen inkl. Schatten. Kosten: 15 Credits.

THEME (im Profil-Menü oben rechts)
- Themes — [Themes](/themes): Galerie der optimierten Brospify-Shopify-Themes; mit einem Klick direkt in den verbundenen Shop pushen/installieren. Voraussetzung: aktive Membership + verbundener Shopify-Shop (manche Themes sind ein einmaliger Kauf).

MEDIATHEK — [Mediathek](/library)
- Sammelt deine generierten/bearbeiteten Bilder (z. B. aus Upscaler, Background Remover, AI Studio) zum Wiederfinden und Download.

COMMUNITY — [Community](/chats)
- Community-Chat zum Austausch mit anderen Mitgliedern (Text und Bilder posten).

KONTO & EINSTELLUNGEN
- Einstellungen — [Einstellungen](/account/settings): Login-Daten und Google-Konto verknüpfen.
- Abo verwalten — [Abo verwalten](/account/subscription): Mitgliedschaftsstatus, Credits, Verlängerung/Kündigung.
- Shopify-Verbindung — [Shopify-Verbindung](/account/shopify): Shopify-API-Zugangsdaten eintragen oder ändern.
- Setup-Wizard — [Setup](/setup): geführte Erst-Einrichtung (Shop verbinden).

SHOPIFY VERBINDEN (Schritt für Schritt, kein Programmieren nötig)
1. Im Shopify-Admin: Einstellungen → Apps und Vertriebskanäle → Apps entwickeln → "Benutzerdefinierte App erstellen" (Custom App).
2. Admin-API-Zugriff konfigurieren und die App installieren.
3. "Admin API Access Token" (sowie API-Key/Secret) kopieren.
4. Im Hub unter [Shopify-Verbindung](/account/shopify) bzw. über den [Setup](/setup)-Wizard eintragen. Fertig.

SUPPORT
- AI Support (hier) — [AI Support](/ai-support): Sofort-Antworten vom KI-Bot. Wird die Frage nicht gelöst, kann daraus mit einem Klick ein Live-Ticket werden (der gesamte Chat-Verlauf wird mitgeschickt und bleibt gespeichert).
- Meine Tickets — [Meine Tickets](/ai-support?view=tickets): Verlauf sowie offene/gelöste Tickets.
- E-Mail Support — [E-Mail Support](/email-support): direkt ans Team schreiben.
- Privates Coaching — [Coaching](/coaching): 1:1-Begleitung mit dem Team.

AKTUELL NICHT VERFÜGBAR
- SEO-Audit/SEO-Analyse, Blog-/Artikel-Generator, Liquid-Code-Blöcke und der Rechtstexte-Generator sind in der App derzeit NICHT verfügbar. Falls jemand danach fragt: ehrlich sagen, dass diese Funktion aktuell nicht verfügbar ist (bei Bedarf Live-Ticket).`;
