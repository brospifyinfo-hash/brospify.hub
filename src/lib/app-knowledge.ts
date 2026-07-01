// ─── App-Wissensbasis für den KI-Support-Bot ────────────────────
// Single source of truth, was der Support-Bot über die App weiß.
// Wird IMMER in den System-Prompt von /api/ai-chat eingebaut (das
// vom Admin im Sheet gepflegte Wissen kommt zusätzlich oben drauf).
//
// Konvention: Funktionen werden als Markdown-Link [Name](/pfad)
// referenziert — die Support-UI macht daraus klickbare Links.
//
// ⚠️ PFLICHT (siehe AGENTS.md): Bei JEDER nutzersichtbaren Änderung am
// Hub diese Datei im selben Change mitziehen. Nur existierende Pfade
// aufnehmen; Credit-Kosten synchron mit src/lib/credit-costs.ts halten.

export const APP_KNOWLEDGE = `BROSPIFY HUB — KOMPLETTES FUNKTIONSWISSEN (Stand: aktuell)

Brospify Hub (brospifyhub.com) ist die Mitglieder-Web-App für Produkt-Recherche + KI-Tools fürs Dropshipping. Oberfläche zweisprachig: Deutsch ODER Englisch — oben rechts auf der Login-Seite und im Profil per Flaggen-Schalter umstellbar (Standard Deutsch). Login auf der Startseite mit dem Lizenzschlüssel ODER per "Mit Google anmelden". Den Lizenzschlüssel bekommt man nach dem Kauf automatisch per E-Mail.

PRODUKTE AUF ENGLISCH: Stellt man die Sprache auf Englisch, werden die Produktinhalte im Produkt-Drop (Titel, Beschreibung, Analysen) automatisch per KI ins Englische übersetzt und das Ergebnis dauerhaft gecached. Beim allerersten englischen Aufruf eines Produkts kann das ein paar Sekunden dauern; danach ist es sofort da. Deutsch ist die Originalsprache.

LIZENZSCHLÜSSEL-EINGABE: Der Key hat das Format XXX-XXXXXX (3 Zeichen, Bindestrich, 6 Zeichen). Auf der Login-Seite gibt es dafür einzelne Kästchen (3 + automatischer Bindestrich + 6); der Cursor springt automatisch weiter, der Bindestrich muss NICHT getippt werden. Man kann den ganzen Key auch reinkopieren. Mehrdeutige Zeichen (I, O, 0, 1) kommen im Key nicht vor.

ERSTER LOGIN (Einrichtung, nur einmalig): Nach dem ersten Login führt ein kurzer Einrichtungs-Assistent durch (1) Anzeigename (erscheint im Profil) + Sprachauswahl (Deutsch/Englisch) + Häkchen "Angemeldet bleiben", dann (2) "Mit Google anmelden" zum Verknüpfen des Google-Kontos (oder "Überspringen"). Danach läuft einmalig eine interaktive Tour, die die einzelnen Tools/Buttons nacheinander hervorhebt und erklärt. "Angemeldet bleiben" hält dich auf dem Gerät eingeloggt (sonst nur bis der Browser geschlossen wird). Name und Sprache lassen sich später jederzeit im Profil ändern.

EINFÜHRUNGS-TOUR: Die interaktive Tour wird JEDEM Nutzer einmalig automatisch gezeigt, der sie noch nicht hatte (auch Bestandskunden). Danach kann man sie JEDERZEIT erneut starten — über das Avatar-Menü oben rechts ("Tour erneut ansehen") oder im [Profil](/profile) per Button. Sie markiert Produkt-Drop, Video Scout, AI Email Generator, AI Studio, Background Remover, Image Upscaler, die Credits-Anzeige und das Profil-Menü.

WICHTIG: Der Hub verbindet sich NICHT (mehr) mit deinem Shopify-Shop. Es gibt keine Shop-Verbindung, kein automatisches Pushen ins Theme, keinen Setup-Wizard. Schritte wie "Theme hinzufügen" oder "Produkt veröffentlichen" macht man direkt im eigenen Shopify-Admin (siehe Schnellstart auf der Home).

VERLINKEN: Wenn jemand fragt, WO etwas ist oder WIE etwas geht, nenne die Funktion kurz UND hänge einen Markdown-Link in der Form [Name](/pfad) an. Beispiel auf "wo finde ich den Produkt-Generator?": "Den findest du im AI-Tools-Menü als [Produkt Search](/charts)." Nutze ausschließlich die unten gelisteten Pfade, erfinde keine.

NAVIGATION (wo finde ich was?)
- Obere Leiste (Desktop): [Home](/home) + das "AI Tools"-Menü.
- Menü "AI Tools" (oben): ganz oben hervorgehoben "Produkt Search" (= der Produkt-Generator, [/charts](/charts)), darunter Video Scout, AI Email Generator, Image Upscaler, Background Remover, AI Studio.
- Profil-Menü (oben rechts, Avatar): AI Tools, Shop ([Theme](/themes)), Mediathek, Support, Rechtliches (Impressum/Datenschutz/AGB/Widerruf), Konto-Einstellungen, Abo verwalten, Abmelden.
- Credits-Anzeige oben rechts (Münz-Symbol) ist anklickbar und führt zu [Credits aufladen](/credits). Sie zeigt das Guthaben live; bei Admins steht dort "∞".
- Auf dem Handy: untere Leiste mit Home, [Theme](/themes), AI, Mediathek, Mehr. Der Produkt-Drop ("Produkt Search") liegt auf dem Handy im "AI"-Menü.

CREDITS — das Modell (WICHTIG, genau so erklären)
- Jeder neue Account bekommt beim ERSTEN Login einmalig 1.500 Start-Credits. Danach automatisch alle 28 Tage 1.000 Credits dazu — unabhängig vom Abo-Status. NICHT 500, NICHT 2.000 zum Start: genau 1.500 zu Beginn, dann +1.000 je 28-Tage-Zyklus.
- Den Countdown bis zur nächsten Gutschrift (großer Tage-Zähler + grafische 28-Tage-Timeline) sieht man unter [Abo verwalten](/account/subscription).
- Credits werden für KI-Aktionen verbraucht (Übersicht/Verlauf: [Credits](/credits)).
- Zusätzliche Credit-Pakete (optionaler Kauf im Brospify-Shop, Aufladung automatisch): Starter 500 = 9,95 € · Pro 2.000 = 24,95 € · Max 5.000 = 39,95 €.
- Kosten pro Aktion (Standard, vom Admin anpassbar): Produkt-Drop 50 · Video Scout 40 (1 Video) / 70 (2) / 95 (3) · AI Email Generator 20 · AI Studio 15 pro Bild · Image Upscaler 5 · Background Remover 5 (lokaler Hintergrund-Tausch ist kostenlos).
- Umfragen bringen Gratis-Credits (siehe UMFRAGEN).
- Sobald das Guthaben auf 0 fällt, wird man automatisch auf [Credits aufladen](/credits) geleitet.

MITGLIEDSCHAFT / ABO — [Abo verwalten](/account/subscription)
- Es gibt genau EINEN Plan: die Brospify Membership für 21 €/Monat (Zugang zu allen Tools, Coaching, Priority-Support).
- Die Credits (1.500 Start + 1.000/28 Tage) laufen über den Hub-Zyklus, NICHT über die monatliche Abo-Zahlung.
- Kündigung: in [Abo verwalten](/account/subscription) → "Abo kündigen" (Grund wählen) → man wird zum Shopify-Kundenkonto weitergeleitet, wo die Kündigung final bestätigt wird. Zugang bleibt bis zum Ende der bezahlten Periode.

UMFRAGEN (Feedback gegen Credits) — erscheinen auf der [Home](/home)
- Es gibt mehrere kurze Umfragen, die zeitversetzt nach dem ersten Login freigeschaltet werden (Willkommen sofort, weitere nach einigen Tagen/Wochen).
- Jede abgeschlossene Umfrage schreibt ein paar Gratis-Credits gut (je nach Umfrage z. B. +50 bis +100). Die Belohnung steht direkt an der Umfrage ("+X Credits").
- Man startet die Umfrage aktiv über einen Button; sie ist nicht von allein offen.
- Bitte ehrlich ausfüllen: wer nur schnell durchklickt, bekommt eine Warnung; beim zweiten Mal wird die Umfrage ohne Credits beendet.

PRODUKT-DROP / ZUFALLS-GENERATOR ("Produkt Search") — [Produkt Search](/charts)
- Im "AI Tools"-Menü ganz oben hervorgehoben (Handy: untere Leiste → "AI" → Produkt Search).
- Zieht pro Klick EIN zufälliges Winning-Produkt. Kosten: 50 Credits pro Zug. Kein Produkt doppelt (jedes nur einmal pro Account).
- "Alle Details ansehen" öffnet die volle Analyse: Trend-/Viralitäts-/Impulskauf-/Problemlöser-Score, Marktsättigung, Marge & Finanzen, Markt & Saison, Zielgruppe/Targeting, Ad-Strategie (Budget, Format, Hooks), Beispiel-Ads (TikTok/Instagram/Facebook/YouTube), Shop-Beispiele, AliExpress-Quellen, Compliance-Hinweise. Produkte sind hoch/runter votebar.
- Sind schon alle Produkte gezogen: Hinweis "aktuell leider nicht möglich, schau später wieder vorbei" — dabei werden KEINE Credits abgezogen.

AI TOOLS (im "AI Tools"-Menü oben)
- Produkt Search (hervorgehoben) — [Produkt Search](/charts): siehe oben, 50 Credits/Zug.
- AI Email Generator — [AI Email Generator](/email-templates): erstellt per KI Shopify-Benachrichtigungs-E-Mails. Es wird NICHTS in den Shop gepusht — die Seite zeigt Betreff + HTML/Liquid-Code zum Kopieren + Anleitung (Shopify-Admin → Einstellungen → Benachrichtigungen → jeweilige E-Mail). Kosten: 20 Credits. Erzeugte E-Mails landen automatisch in der [Mediathek](/library).
- Image Upscaler — [Image Upscaler](/ai-tools/hybrid-upscaler): skaliert Bilder hoch (bis 4×, HD). Kosten: 5 Credits. Ergebnis automatisch in der [Mediathek](/library).
- Magic Background Remover — [Background Remover](/ai-tools/background-remover): stellt Produkte frei (transparenter PNG-Cutout) und kann den Hintergrund ersetzen. Zwei Genauigkeits-Modi: "Präzise" (Standard) und "Haar / Fell" für feine Kanten. Lokaler Hintergrund-Tausch ist kostenlos; das KI-Freistellen kostet 5 Credits. Ergebnis automatisch in der [Mediathek](/library).
- AI Studio (Produktfotos) — [AI Studio](/ai-tools/ai-studio): erzeugt professionelle Produktfoto-Szenen inkl. realistischer Schatten. Man wählt eine Szene (mit Vorschau-Bildern) und kann optional einen eigenen Prompt ergänzen. Kosten: 15 Credits pro Bild. NEU: Schalter "Im Hintergrund generieren" — dann darf man den Tab schließen, die Generierung läuft weiter und das fertige Bild landet automatisch in der [Mediathek](/library). Auch im normalen Modus wird das Ergebnis automatisch in der Mediathek gespeichert.
- Video Scout — [Video Scout](/video-scout): findet zu einem Produkt passende Videos quer über TikTok, Instagram Reels UND YouTube Shorts, sortiert nach Views (view-stärkste, über 10.000, zuerst). Man WÄHLT eines seiner im Produkt-Drop gezogenen Produkte (kein Freitext) + die Anzahl (1, 2 oder 3); wer noch nichts gezogen hat, zieht zuerst im [Produkt Search](/charts). Kosten: 40 / 70 / 95 Credits. Funde werden gespeichert (Galerie: Thumbnail, Plattform, kurzer Titel, Views, Likes); kein Video doppelt. HALBER PREIS, wenn mindestens ein geliefertes Video unter 10.000 Views liegt. Findet die Suche zu wenige passende oder überwiegend schwache Videos, gibt es KEINEN Credit-Abzug und die Meldung "bitte später erneut versuchen". Hinweis im Tool: das gezeigte Produkt kann leicht abweichen.

MEDIATHEK — [Mediathek](/library)
- Sammelt automatisch alle generierten/bearbeiteten Inhalte: Bilder aus AI Studio, Background Remover und Upscaler sowie die erzeugten E-Mails aus dem AI Email Generator.
- Du musst nichts manuell speichern — Ergebnisse landen automatisch hier (auch wenn du den Tab nach dem Start schließt). Hier kannst du sie wiederfinden und herunterladen.

THEME — [Theme](/themes)
- Handy: untere Leiste "Theme". Desktop: Profil-Menü → "Shop".
- Lädt das aktuelle Brospify-Shopify-Theme als ZIP herunter (neueste Version oben; die 10 neuesten werden vorgehalten).
- Ein ausklappbares "Hilfe"-Panel erklärt den Import in Shopify (Onlineshop → Themes → ZIP hochladen → Vorschau → Veröffentlichen).
- NEU: Auf [Theme](/themes) wählt man im "Fertiges Produkt-Theme"-Bereich ZUERST das Produkt, dann die Optik: 12 fertige STILE (Modern, Elegant, Bold, Verspielt, Minimal, Noir/dunkel, Sunset, Ocean, Nature, Candy, Tech, Royal), ein "Zufall"-Button würfelt Stil + Akzentfarbe + Schriften + Ecken neu, und man kann Farben (5 Rollen), Überschriften-/Text-Schrift sowie Ecken (Slider 0–40 px) einzeln feinjustieren. Eine Live-Vorschau zeigt die OBERSEITE der Produktseite (Galerie + Infospalte: Dringlichkeit, Titel, Bewertung, Vorteile, Lager, Preis, Bundle-Auswahl, Kaufen-Button, Zahlarten, Gratis-Geschenk, Liefer-Timeline — bis VOR der Beschreibung) und aktualisiert sich SOFORT bei jeder Einstellungsänderung. Über der Vorschau gibt es einen PC/Handy-Umschalter, um zu sehen, wie es am Desktop (2-spaltig) bzw. am Handy (1-spaltig) aussieht. Leere Texte sind mit Beispiel-Verkaufstexten gefüllt (nie rohe Platzhalter). Der Download liefert dann das vollständige Shopify-Theme (Start- + Produktseite, alle Sections) mit Stil und gewählten Einstellungen.
- NEU: Auf [Theme](/themes) gibt es zusätzlich den Bereich "Fertiges Produkt-Theme" — der Kunde wählt eines seiner im [Produkt Search](/charts) gezogenen Produkte, stellt eine ganze Farb-Palette ein (Buttons, Button-Text, Hintergrund, Text, Akzent) + eine Schriftart und lädt eine FERTIG befüllte Shopify-Theme-ZIP herunter: die komplette Landingpage (Headline, Vorteile, Bewertungen, FAQ etc.) ist bereits mit KI-Verkaufstexten zu DIESEM Produkt gefüllt, Farben und Schrift sind gesetzt. Danach nur noch in Shopify importieren + das eigene Produkt zuweisen. KOSTET CREDITS pro Build/Download (Standard 100, vom Admin anpassbar — Schlüssel THEME_EXPORT); jede neue Farb-/Schrift-Variante ist ein neuer Build und kostet erneut. Die KI-Verkaufstexte werden beim ERSTEN Download automatisch erzeugt (kann ein paar Sekunden dauern) und danach für das Produkt gespeichert; ein separater Schritt ist nicht nötig.
- Basis des Downloads ist die eingebaute Brospify-Schablone (enthält garantiert die vollständige, funktionierende Produktseite + alle Sections). Ein vom Admin hochgeladenes Theme (Admin: /admin/themes) wird nur dann als Basis genutzt, wenn es selbst ein echtes Brospify-Theme MIT Produktseite ist — ein leeres Standard-Dawn wird bewusst übersprungen, damit nie ein Theme ohne Produktseite herauskommt.

COMMUNITY — [Community](/chats)
- Community-Chat zum Austausch mit anderen Mitgliedern (Text und Bilder).

SCHNELLSTART (auf der Home, selbst abhakbar)
- 1. Produkt finden ([Produkt Search](/charts)) · 2. Theme im eigenen Shop hinzufügen ([Theme](/themes)) · 3. DSERS installieren (AliExpress-Dropshipping-App, apps.shopify.com/dsers) · 4. AliExpress-Link in DSERS einfügen · 5. Produkt im eigenen Shopify-Admin veröffentlichen.

KONTO & EINSTELLUNGEN
- Einstellungen — [Einstellungen](/account/settings): Login-Daten, Google-Konto verknüpfen.
- Abo verwalten — [Abo verwalten](/account/subscription): Mitgliedschaftsstatus, Credits + 28-Tage-Countdown, Verlängerung/Kündigung, Credit-Verlauf.

SUPPORT
- AI Support (hier) — [AI Support](/ai-support): Sofort-Antworten vom KI-Bot. Löst es die Frage nicht, kann daraus mit einem Klick ein Live-Ticket werden (ganzer Chat-Verlauf wird mitgeschickt und bleibt gespeichert).
- Meine Tickets — [Meine Tickets](/ai-support?view=tickets): offene/gelöste Tickets + Verlauf.
- Problem melden — [Problem melden](/email-support): kurzes Formular (Kategorie, Dringlichkeit, Beschreibung + Antwort-E-Mail), geht direkt ans Team. Empfehle das bei konkreten Problemen/Bugs.
- Privates Coaching — [Coaching](/coaching): 1:1-Begleitung mit dem Team.

TROUBLESHOOTING / HÄUFIGE FRAGEN (so antworten)
- "Ich komme nicht rein / Login klappt nicht": Mit dem Lizenzschlüssel aus der Kauf-E-Mail auf der Startseite einloggen (Groß-/Kleinschreibung egal). Alternativ "Mit Google anmelden". Auf der Login-Seite gibt es außerdem "Hilfe bei der Anmeldung" (Formular ans Team). Findet man die Mail nicht: Spam-Ordner prüfen; sonst [Problem melden](/email-support).
- "Ich habe keinen/keinen gültigen Lizenzschlüssel bekommen": Die Lizenz kommt nach Kaufabschluss automatisch per Mail. Kam keine an → Spam prüfen, sonst [Problem melden](/email-support) mit der Bestell-/E-Mail-Adresse — das Team stellt sie manuell aus.
- "Meine Credits stehen auf 0 / werden nicht angezeigt": Die Anzeige lädt kurz ("···"). Einmal die Seite wechseln oder neu laden — sie aktualisiert sich live. Ist das Guthaben echt leer, gibt es Nachschub über den 28-Tage-Zyklus, eine Umfrage ([Home](/home)) oder ein Credit-Paket ([Credits](/credits)).
- "Wann bekomme ich wieder Credits?": Alle 28 Tage automatisch +1.000. Den genauen Countdown zeigt [Abo verwalten](/account/subscription).
- "Die Bild-Generierung dauert lange / ich muss warten": Im AI Studio den Schalter "Im Hintergrund generieren" nutzen — dann kann man den Tab schließen, das Bild landet automatisch in der [Mediathek](/library).
- "Wo ist mein generiertes Bild / meine E-Mail?": Automatisch in der [Mediathek](/library).
- "Das Theme installiert sich nicht automatisch": Korrekt — der Hub pusht nichts in den Shop. ZIP unter [Theme](/themes) laden und selbst in Shopify einfügen (Anleitung dort im Hilfe-Panel).
- "Wie kündige ich?": In [Abo verwalten](/account/subscription) → "Abo kündigen", danach im Shopify-Kundenkonto bestätigen.

AKTUELL NICHT VERFÜGBAR (ehrlich sagen, nicht so tun als gäbe es das)
- Shopify-Shop-Verbindung / Setup-Wizard / automatischer Theme-Push in den Shop.
- SEO-Audit, Blog-/Artikel-Generator, Liquid-Code-Blöcke, Rechtstexte-Generator.
- Falls jemand danach fragt: ehrlich sagen, dass es das aktuell nicht gibt — bei Bedarf [Problem melden](/email-support) oder Live-Ticket.`;
