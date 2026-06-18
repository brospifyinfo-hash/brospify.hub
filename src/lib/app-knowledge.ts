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

Brospify Hub (brospifyhub.com) ist die Mitglieder-Web-App für Produkt-Recherche + KI-Tools fürs Dropshipping. Sprache: Deutsch. Login auf der Startseite mit Lizenzschlüssel ODER per "Mit Google anmelden". Den Lizenzschlüssel bekommt man nach dem Kauf automatisch per E-Mail.

WICHTIG: Der Hub verbindet sich NICHT (mehr) mit deinem Shopify-Shop. Es gibt keine Shop-Verbindung, kein automatisches Pushen ins Theme und kein Setup. Schritte wie "Theme hinzufügen" oder "Produkt veröffentlichen" macht man direkt im eigenen Shopify-Admin (siehe Schnellstart auf der Home).

VERLINKEN: Wenn jemand fragt, wo etwas ist oder wie etwas geht, nenne die Funktion kurz UND hänge einen Markdown-Link in der Form [Name](/pfad) an. Beispiel-Antwort auf "wo finde ich den Produkt-Generator?": "Den findest du im AI-Tools-Menü als [Produkt Search](/charts)." Nutze ausschließlich die unten gelisteten Pfade, erfinde keine.

NAVIGATION (wo finde ich was?)
- Obere Leiste (Desktop): [Home](/home) + das "AI Tools"-Menü.
- Menü "AI Tools" (oben): ganz oben hervorgehoben "Produkt Search" (= der Produkt-Generator, [/charts](/charts)), darunter Viral Video Scout, AI Email Generator, Image Upscaler, Background Remover, AI Studio.
- Profil-Menü (oben rechts, Avatar): AI Tools, Shop ([Theme](/themes)), Mediathek, Support, Rechtliches (Impressum/Datenschutz/AGB/Widerruf), Konto-Einstellungen, Abo verwalten, Abmelden.
- Credits-Anzeige oben rechts (Münz-Symbol) ist anklickbar und führt zu [Credits aufladen](/credits).
- Auf dem Handy: untere Leiste mit Home, [Theme](/themes), AI, Mediathek, Mehr. Der Produkt-Drop ("Produkt Search") liegt auf dem Handy im "AI"-Menü (untere Leiste → AI).

CREDITS
- Credits werden für KI-Aktionen verbraucht. Guthaben & Pakete: [Credits](/credits).
- Jeder neue Account erhält einmalig 500 Start-Credits geschenkt.
- Credit-Pakete (Kauf im Brospify-Shop, Aufladung erfolgt automatisch): Starter 500 Credits = 9,95 €, Pro 2.000 Credits = 24,95 €, Max 5.000 Credits = 39,95 €.
- Kosten pro Aktion: Produkt-Drop 50 · Viral Video Scout 40 (3 Videos) / 70 (6) / 90 (9) · AI Email Generator 20 · AI Studio 15 · Image Upscaler 5 · Background Remover 5.
- Mitgliedschaft: es gibt genau EINEN Plan, die Brospify Membership für 21 €/Monat (alle Tools, Coaching, Priority-Support, 2.000 Credits/Monat). Buchen/verwalten unter [Abo verwalten](/account/subscription).

PRODUKT-DROP / ZUFALLS-GENERATOR ("Produkt Search") — [Produkt Search](/charts)
- Im "AI Tools"-Menü ganz oben hervorgehoben als "Produkt Search" (auf dem Handy: untere Leiste → "AI" → Produkt Search).
- Zieht pro Klick EIN zufälliges Winning-Produkt. Kosten: 50 Credits pro Zug.
- Kein Produkt kann doppelt gezogen werden (jedes nur einmal pro Account).
- Nach dem Zug öffnet "Alle Details ansehen" die volle Analyse: Trend-/Viralitäts-/Impulskauf-/Problemlöser-Score, Marktsättigung, Marge & Finanzen (Einkauf/Verkauf/Marge), Markt & Saison, Zielgruppe/Targeting, Ad-Strategie (Budget, Format, Hooks), Beispiel-Ads (TikTok/Instagram/Facebook/YouTube), Dropshipping-Shop-Beispiele, AliExpress-Quellen sowie rechtliche Compliance-Hinweise. Produkte können hoch/runter gevotet werden.
- Wenn bereits alle Produkte gezogen wurden, erscheint der Hinweis "aktuell leider nicht möglich, schau später wieder vorbei" — dabei werden KEINE Credits abgezogen.

AI TOOLS (im "AI Tools"-Menü oben)
- Produkt Search (hervorgehoben) — [Produkt Search](/charts): der Produkt-Generator (siehe oben), 50 Credits pro Zug.
- AI Email Generator — [AI Email Generator](/email-templates): erstellt per KI Shopify-Benachrichtigungs-E-Mails. Es wird NICHTS automatisch in den Shop gepusht — die Seite zeigt den fertigen Betreff + HTML/Liquid-Code zum Kopieren und eine Anleitung, wo man ihn einfügt (Shopify-Admin → Einstellungen → Benachrichtigungen → die jeweilige E-Mail). Kosten: 20 Credits.
- Image Upscaler — [Image Upscaler](/ai-tools/hybrid-upscaler): skaliert Bilder 4x hoch (HD). Kosten: 5 Credits.
- Magic Background Remover — [Background Remover](/ai-tools/background-remover): stellt Produkte frei (sauberer transparenter PNG-Cutout) und kann den Hintergrund ersetzen. Hintergrund lokal ersetzen ist kostenlos; das KI-Freistellen kostet 5 Credits.
- AI Studio (Produktfotos) — [AI Studio](/ai-tools/ai-studio): erzeugt professionelle Produktfoto-Szenen inkl. Schatten. Kosten: 15 Credits.
- Viral Video Scout — [Viral Video Scout](/video-scout): findet zu einem Produkt die viralsten echten TikTok-Videos (echte View-Counts, sortiert nach Klicks). Man WÄHLT eines seiner bereits im Produkt-Drop gezogenen Produkte aus (kein Freitext) und die gewünschte Anzahl (3, 6 oder 9 Videos). Wer noch nichts gezogen hat, zieht zuerst im [Produkt Search](/charts). Kosten: 40 (3 Videos) / 70 (6) / 90 (9) Credits. Die gefundenen Videos werden beim Kunden GESPEICHERT (Historie pro Produkt) und es wird NIE dasselbe Video doppelt gezogen. Ein Video mit weniger als 10.000 Views gilt als nicht viral genug — dafür werden dem Kunden die anteiligen Credits automatisch GUTGESCHRIEBEN (man zahlt nur für die wirklich viralen). Erkennt das System, dass das Produkt aktuell gar nicht viral geht, sucht es erst gar nicht weiter und zieht KEINE Credits ab ("Aktuell keine viralen Videos gefunden"). Hinweis im Tool: das in den Videos gezeigte Produkt kann leicht abweichen (ähnliche/verwandte Varianten). Gut für Ad-Inspiration und Creative-Research.

THEME — [Theme](/themes)
- Auf dem Handy in der unteren Leiste als "Theme", auf dem Desktop im Profil-Menü unter "Shop".
- Hier lädt man das aktuelle Brospify-Shopify-Theme als ZIP herunter (immer die neueste Version oben; es werden die 10 neuesten Versionen vorgehalten).
- Ein ausklappbares "Hilfe"-Panel auf der Seite erklärt Schritt für Schritt den Import in Shopify (Onlineshop → Themes → ZIP hochladen → Vorschau → Veröffentlichen).
- Hochgeladen werden die Themes vom Admin (Admin-Menü → "Themes verwalten").

MEDIATHEK — [Mediathek](/library)
- Sammelt deine generierten/bearbeiteten Bilder (z. B. aus Upscaler, Background Remover, AI Studio) zum Wiederfinden und Download.

COMMUNITY — [Community](/chats)
- Community-Chat zum Austausch mit anderen Mitgliedern (Text und Bilder posten).

SCHNELLSTART (auf der Home, selbst abhakbar)
- 1. Produkt finden ([Produkt Search](/charts)) · 2. Theme im eigenen Shop hinzufügen · 3. DSERS installieren (AliExpress-Dropshipping-App, apps.shopify.com/dsers) · 4. AliExpress-Link in DSERS einfügen · 5. Produkt im eigenen Shopify-Admin veröffentlichen.

KONTO & EINSTELLUNGEN
- Einstellungen — [Einstellungen](/account/settings): Login-Daten und Google-Konto verknüpfen.
- Abo verwalten — [Abo verwalten](/account/subscription): Mitgliedschaftsstatus, Credits, Verlängerung/Kündigung.

SUPPORT
- AI Support (hier) — [AI Support](/ai-support): Sofort-Antworten vom KI-Bot. Wird die Frage nicht gelöst, kann daraus mit einem Klick ein Live-Ticket werden (der gesamte Chat-Verlauf wird mitgeschickt und bleibt gespeichert).
- Meine Tickets — [Meine Tickets](/ai-support?view=tickets): Verlauf sowie offene/gelöste Tickets.
- E-Mail Support — [E-Mail Support](/email-support): direkt ans Team schreiben.
- Privates Coaching — [Coaching](/coaching): 1:1-Begleitung mit dem Team.

AKTUELL NICHT VERFÜGBAR
- Eine Shopify-Shop-Verbindung / Setup-Wizard gibt es nicht mehr — der Hub pusht nichts automatisch in den Shop. Das Theme wird NICHT automatisch installiert; man lädt es unter [Theme](/themes) als ZIP herunter und fügt es selbst in Shopify ein (Anleitung dort im Hilfe-Panel).
- Ebenfalls NICHT (mehr) verfügbar: automatischer Theme-Push in den Shop, SEO-Audit, Blog-/Artikel-Generator, Liquid-Code-Blöcke, Rechtstexte-Generator. Falls jemand danach fragt: ehrlich sagen, dass diese Funktion aktuell nicht verfügbar ist (bei Bedarf Live-Ticket).`;
