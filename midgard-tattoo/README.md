# Midgard Tattoo — Studio-Website

Website des Tattoostudios **Midgard Tattoo**, Nürnberger Straße 7, 90518 Altdorf.
Tätowiert wird von **Michi** (Inhaber) und **Gorilla**. Portfolio,
Online-Terminanfrage und ein Dashboard, in dem der Inhaber seine freien Termine
selbst pflegt.

Eigenständiges Next.js-Projekt — keine Abhängigkeit zu anderen Anwendungen.

```bash
npm install
cp .env.example .env.local     # mindestens TATTOO_ADMIN_PASSWORD setzen
npm run dev                    # → http://localhost:3000
```

| Route | Was |
|---|---|
| `/` | Startseite: Hero-Slideshow, dann sechs nummerierte Kapitel — Galerie-Vorschau, **vollständige Terminbuchung**, die beiden Artists, Vertrauensmerkmale, Preis-, Bewertungs- und Studio-Vorschau |
| `/galerie` | Alle Motive mit Leuchtkasten, darunter die Stilrichtungen |
| `/termin` | Ablauf in vier Schritten, Kalender, Anfrageformular |
| `/preise` | Richtwerte, was im Preis enthalten ist, was ihn beeinflusst |
| `/bewertungen` | Überblick (Schnitt + Verteilung) und alle Kundenstimmen |
| `/studio` | Die beiden Studiofotos, Michi und Gorilla, Anfahrt mit Karte, Öffnungszeiten |
| `/pflege` | Pflegeanleitung nach der Sitzung, inkl. Warnzeichen |
| `/fragen` | Häufige Fragen (mit FAQPage-Structured-Data) |
| `/impressum` · `/datenschutz` | Pflichtseiten · `noindex` |
| `/admin` | Dashboard: Kalender, Anfragen, Bilder, Bewertungen |
| `/admin/login` | Passwort-Anmeldung |
| `/api/slots` · `/api/bookings` | Öffentlich: freie Termine lesen, Anfrage abschicken |
| `/api/admin/login` · `.../logout` | Session an/aus |
| `/api/admin/slots` | Termine verwalten |
| `/api/admin/bookings` | Anfragen verwalten |
| `/api/admin/media` | Bilder hochladen, beschriften, sortieren, löschen |
| `/api/admin/reviews` | Bewertungen pflegen |

## Tech-Stack und warum

| Baustein | Gewählt | Begründung |
|---|---|---|
| Framework | **Next.js 16 (App Router), React 19** | Server-Komponenten liefern Galerie und Terminzähler fertig gerendert aus — gut für die Ladezeit und für Google, das ein lokales Studio überhaupt erst findet. Route Handler ersetzen einen separaten API-Server. |
| Styling | **Tailwind v4 + `globals.css`** | Tailwind für Layout und Abstände, `globals.css` für die Design-Tokens (Farben, Schrift, Kanten). Zwei Ebenen statt einer: die Marke steht an einer Stelle, das Layout bleibt im Markup lesbar. |
| Animation | **Framer Motion 12** | Bewegt ausschließlich `transform`/`opacity` (Compositor statt Layout) und bringt `useReducedMotion` mit — Barrierefreiheit ohne Zusatzarbeit. |
| Schriften | **`next/font` (Anton, Inter, Permanent Marker)** | Werden beim Build selbst gehostet: kein externer Request, kein Font-Flackern, keine Google-Fonts-Frage im Datenschutz. |
| Bilder | **`next/image` + WebP + Blur-Platzhalter** | Die Fotos aus dem Studio sind der Inhalt der Seite; sie müssen scharf sein und trotzdem schnell laden. |
| Auth | **iron-session** | Verschlüsseltes Cookie, kein Nutzerkonto, keine Tabelle. Für genau einen Inhaber ist alles andere Overhead. |
| Daten | **JSON-Store, Adapter-basiert** | Läuft sofort — lokal als Datei, auf Vercel als Blob. Der Umzug auf Postgres/Supabase ist vorbereitet, siehe unten. |
| Mails | **Resend** (optional) | Ein `fetch`-Aufruf statt eines SDK. Ohne Konfiguration funktioniert die Buchung trotzdem. |

## Ins Dashboard kommen

`/admin` aufrufen — lokal `http://localhost:3000/admin`, live
`deine-domain.de/admin`. In der Fußzeile jeder Seite steht unten rechts
ein unauffälliger Link **Studio-Login**, damit die Adresse niemand
auswendig braucht. Das ist kein Sicherheitsproblem: Der Schutz ist das
Passwort und die Sperre nach acht Fehlversuchen, nicht ein versteckter
Pfad.

Das Passwort steht in `TATTOO_ADMIN_PASSWORD` (siehe `.env.example`).

## Bilder pflegen

Im Dashboard unter *Bilder*: hineinziehen oder auswählen, mehrere auf
einmal. Die Seite macht daraus automatisch WebP mit höchstens 1400 px
Kantenlänge und erzeugt den Unschärfe-Platzhalter — es muss nichts
vorbereitet werden, ein Handyfoto reicht.

Je Bild lassen sich Titel, Stil, Körperstelle und Bildbeschreibung
setzen sowie zwei Haken: **In der Galerie** und **In der Slideshow**
(das Hero oben auf der Startseite). Die Reihenfolge bestimmen die Pfeile.

**Rückfall:** Solange kein eigenes Bild hochgeladen ist, zeigt die
Website die zehn mitgelieferten Motive aus `src/lib/studio.ts`. Welche
davon in der Slideshow laufen, steuert dort das Feld `inHero` — kuratiert,
weil ein Studiofoto als bildschirmfüllender Hintergrund nicht funktioniert. Sobald
das erste eigene Bild da ist, gilt ausschließlich der eigene Bestand —
sonst ließen sich die Beispiele nie loswerden. Ist für die Slideshow
nichts markiert, laufen dort die ersten Galeriebilder.

Wo die Dateien landen: mit `BLOB_READ_WRITE_TOKEN` in Vercel Blob, sonst
in `public/uploads/` (per `.gitignore` ausgeschlossen).

## Bewertungen

Ausschließlich vom Inhaber eingetragen, im Dashboard unter *Bewertungen*.
Es gibt bewusst **keine** mitgelieferten Beispiele und keinen
öffentlichen Schreibzugriff: erfundene Kundenstimmen sind Irreführung,
und ein offenes Formular wäre eine Einladung an Spam. Solange nichts
eingetragen ist, zeigt `/bewertungen` einen Hinweis statt einer leeren
Liste, und der Anreißer auf der Startseite bleibt weg.

Der Schalter *Auf der Website sichtbar* erlaubt, eine Bewertung
vorzubereiten oder zurückzuziehen, ohne sie zu verlieren.

### Beispiel-Bewertungen

Unten im Formular gibt es **Beispiele einfügen** — fünf Platzhalter, um
die Seite gefüllt zu sehen. Sie sind an drei Stellen als solche
erkennbar, damit sie nicht versehentlich als echte Kundenstimmen
durchgehen:

* auf `/bewertungen` ein deutlich sichtbarer Hinweis über der Liste,
* auf jeder Karte ein Etikett „Beispiel" (auch im Anreißer der Startseite),
* im Dashboard ein Hinweis samt Knopf **Beispiele entfernen**.

Solange auch nur ein Platzhalter dabei ist, wird die
Bewertungs-Auszeichnung für Google (`AggregateRating`) **nicht** erzeugt
und der Durchschnitt nicht angezeigt — eine erfundene Note im
Suchergebnis wäre eine Falschangabe. Sobald nur noch echte Bewertungen
übrig sind, erscheint beides automatisch.

**Vor dem Live-Gang entfernen.** Erfundene Bewertungen auf einer echten
Studio-Website sind irreführende Werbung und abmahnfähig — ein Klick auf
*Beispiele entfernen* genügt.

## Karte

Auf `/studio` steht eine Kartenvorschau, die **nichts** von außen lädt.
Erst ein Klick auf „Karte laden" holt Google Maps — vorher verlässt kein
einziger Request die eigene Domain. Das ist in Deutschland kein Detail:
eine ungefragt eingebettete Karte überträgt IP-Adresse und Gerätedaten
an Google und braucht eine Einwilligung. Der Datenschutztext beschreibt
das entsprechend.

## Termine: erst Beratung, dann Sitzung

Was im öffentlichen Kalender steht, ist standardmäßig ein
**Beratungstermin** — kostenlos und unverbindlich. Dort werden Motiv,
Größe, Stelle und Preis besprochen; gestochen wird an dem Tag nicht. Der
eigentliche Tattoo-Termin entsteht erst im Anschluss.

Im Dashboard wählt der Inhaber vor dem Anlegen die Art (`Beratung` oder
`Sitzung`). Ohne Angabe — auch bei Datensätzen aus der Zeit vor dieser
Unterscheidung — gilt Beratung; `slotKind()` in `src/lib/types.ts` ist die
einzige Stelle, an der dieser Rückfallwert steht.

Weil ein Beratungsgespräch genau der Ort ist, an dem offene Fragen geklärt
werden, bietet **jedes** Auswahlfeld des Formulars „Noch nicht sicher" an.
Wer sich nicht festlegen will, soll das sagen können, statt zu raten.

## Jede Seite nur ihr Thema

Die Unterseiten wiederholen einander nicht. Preise stehen auf `/preise`,
Motive auf `/galerie`, der Laden auf `/studio` — und nirgends sonst. Auch
angehängte „Termin buchen"-Streifen am Seitenende gibt es nicht mehr: der Weg
zum Termin steht im Kopfbereich und in der Fußzeile, das reicht.

Zwei Stellen sind bewusst anders:

* Die **Terminbuchung steht zweimal**: vollständig auf `/termin` und
  vollständig auf der Startseite direkt unter der Galerie-Vorschau. Wer sich
  gerade durch die Motive gesehen hat, ist genau dort so weit — ein Klick auf
  eine andere Seite wäre die Hürde, an der es scheitert. Es ist dieselbe
  Komponente (`<BookingWidget />`), nicht zwei Umsetzungen.
* Die **Startseite** ist die Übersicht: je ein Kapitel pro Hauptseite,
  durchnummeriert von 01 bis 06.

Die beiden **Studiofotos** (`STUDIO_PHOTOS` in `src/lib/studio.ts`) liegen
ausdrücklich nicht in `GALLERY`. In der Galerie geht es um Arbeiten; Räume
gehören zum Standort und stehen nur auf `/studio`.

## Vertrauensmerkmale

`TRUST_BADGES` (`src/lib/studio.ts`) zeigt fünf Kacheln auf der Startseite:
Einwegnadeln, saubere Arbeitsfläche, eigener Entwurf, kostenlose Beratung,
ab 18 mit Ausweis.

**Das sind Selbstauskünfte über die Arbeitsweise, keine Zertifikate.** Bewusst
kein Siegel, kein „TÜV-geprüft", keine erfundene Mitgliedschaft — Werbung mit
Auszeichnungen, die es nicht gibt, ist nach § 5 UWG angreifbar und fliegt beim
ersten Nachfragen auf. Wenn echte Nachweise vorliegen (Hygieneschulung,
Erste-Hilfe-Kurs, Anzeige beim Gesundheitsamt), gehören sie dort hinein — mit
Namen und Jahr.

## Design

Die Farben stammen nicht aus einer Palette, sondern aus den Fotos des Studios:

* **Schwarz/Grau-Skala** — die Tinte selbst. Nie ein reines `#000`; das wirkt
  auf Bildschirmen härter als jede Nadel es je war.
* **Knochenweiß `#EDE9E3`** — die weiß gestrichene Studiowand und die
  Schriftzüge auf der Schaufensterscheibe.
* **Hautton `#D6B195`** — füllt auf jedem Foto die Fläche zwischen den Linien
  und hält die Seite davon ab, kalt-blau zu kippen.
* **Signal-Gelb `#FFD200`** — der Farbton des handgemalten „TATTOO" auf der
  Scheibe. Der einzige bunte Ton der Seite und deshalb auch der einzige
  Träger von Handlungsaufrufen.

Schrift: **Anton** greift die fetten Versalien der Scheibe auf, **Permanent
Marker** den handgemalten Schriftzug daneben (sparsam eingesetzt), **Inter**
trägt alles, was gelesen statt angeschaut werden muss.

**Bewegung.** Alles blendet beim Hereinscrollen ein — `Reveal` für einzelne
Blöcke, `Stagger` für Listen, `SplitHeadline` für Überschriften, die wortweise
aus einer Maske aufsteigen, `Parallax` für Bilder. Animiert werden
ausschließlich `transform` und `opacity`; `prefers-reduced-motion` schaltet
jede Bewegung ab und zeigt sofort den Endzustand.

**Hero-Slideshow.** Wechselt von selbst alle **7 Sekunden** (`INTERVAL_MS` in
`src/components/Hero.tsx`). Unter dem aktiven Vorschaubild läuft ein Balken
genau diese Zeit ab, damit sichtbar ist, wann der nächste Wechsel kommt. Die
Schau pausiert, sobald der Tab in den Hintergrund geht, und steht bei
reduzierter Bewegung ganz still — dann bleibt der Balken voll, statt einen
Ablauf vorzutäuschen, den es nicht gibt.

Das Motiv liegt auf breiten Schirmen **nicht** als Hintergrund hinter dem Text.
Tattoo-Aufnahmen sind hochkant; ein 16:9-Ausschnitt schneidet zwei Drittel weg,
und vom Löwen bleibt ein Auge übrig. Der Hero ist deshalb geteilt: links der
Text, rechts eine Fläche über die **volle Höhe des Bildschirms**, die bis an den
rechten Rand läuft — rund 46 % breit und 100 svh hoch, also etwa 3:4 und damit
praktisch das Format der Aufnahmen selbst. Das Bild wird so groß wie irgend
möglich gezeigt und trotzdem kaum beschnitten (462×950 px bei 1024er Breite,
727×950 px bei 1920). Der Text sitzt dabei exakt auf der Rasterkante der übrigen
Seite; dafür sorgt `.shell-left` in `globals.css` — die Klasse gehört auf den
umgebenden Kasten, nicht auf die linke Spalte, sonst rechnet `100%` mit der
falschen Breite.

Den Grund hinter allem macht dieselbe Aufnahme als 12-px-Version aus dem
Blur-Platzhalter, weich hochskaliert: kein zusätzlicher Ladevorgang, aber die
Farbe des Motivs auf der ganzen Fläche. Auf dem Handy ist der Bildschirm selbst
hochkant — dort läuft die Aufnahme wie gehabt bildschirmfüllend hinter dem Text.

Welche Motive laufen und in welcher Reihenfolge, steuern `inHero` und
`heroOrder` in `GALLERY` (`src/lib/studio.ts`); `focal` setzt den
Bildausschnitt. Sobald der Inhaber eigene Bilder mit dem Haken „Im Hero zeigen"
hochlädt, gilt ausschließlich seine Auswahl.

**Galeriegröße.** Die Masonry-Spalten stehen auf 1 (Handy) / 2 (ab 640 px) /
3 (ab 1280 px) — siehe `.masonry` in `src/app/globals.css`. Vier Spalten
nebeneinander machten aus jeder Arbeit eine Briefmarke; bei einer
Tattoo-Galerie muss man die Linien erkennen.

## Datenhaltung

`src/lib/store.ts` hält den kompletten Bestand als ein JSON-Dokument
`{ slots, bookings }` und wählt den Adapter selbst:

* **Vercel Blob** — sobald `BLOB_READ_WRITE_TOKEN` gesetzt ist.
* **Lokale Datei** — sonst, `.data/tattoo-booking.json` (per `.gitignore` ausgeschlossen).

Alle Änderungen laufen über `mutate()`, das Lesen-Ändern-Schreiben in einer
prozesslokalen Kette serialisiert. Zwei gleichzeitige Anfragen auf denselben
Termin können sich damit nicht überholen: die zweite bekommt einen 409.

### Grenzen — und wann Postgres fällig wird

1. **Vercel Blob kennt nur öffentliche Objekte.** Der Dateiname wird deshalb
   per HMAC aus einem Server-Secret abgeleitet und ist ohne dieses Secret nicht
   zu erraten. Das ist Verschleierung, keine Zugriffskontrolle.
2. **Die Serialisierung gilt pro Prozess.** Laufen mehrere Serverless-Instanzen
   parallel, greift sie nicht mehr. Bei einem Studio mit einer Handvoll
   Anfragen pro Tag ist das Zusammentreffen praktisch ausgeschlossen — bei
   mehreren Artists nicht mehr.

Für beides liegt die Antwort fertig in [`docs/schema.sql`](./docs/schema.sql):
echte Row-Level-Security, ein Unique-Index, der Doppelbuchungen auf
Datenbankebene ausschließt, und Trigger, die den Termin-Status an die Buchung
koppeln. Zu ersetzen sind ausschließlich `readRaw`/`writeRaw` und die vier
Mutations-Funktionen in `store.ts` — Typen, API-Routen und UI bleiben
unverändert.

## Konfiguration

Alle Variablen samt Erklärung stehen in [`.env.example`](./.env.example).
Das absolute Minimum für den Betrieb:

```
TATTOO_ADMIN_PASSWORD=…     # ohne diese Variable ist /admin gesperrt
TATTOO_SESSION_SECRET=…     # ≥32 zufällige Zeichen
```

## Inhalte pflegen

Ohne CMS, alles an einer Stelle:

* **Texte, Adresse, Öffnungszeiten, FAQ, Stilrichtungen, Artists,
  Vertrauensmerkmale** → `src/lib/studio.ts`
* **Galerie** → Bild nach `public/` legen, Eintrag in `GALLERY` ergänzen
  (`inHero: true` nimmt es in die Slideshow auf, `heroOrder` bestimmt die
  Reihenfolge dort, `focal` den Bildausschnitt). `blur` ist ein 12 px breites WebP als Data-URI:
  ```js
  sharp(datei).resize({ width: 12 }).webp({ quality: 35 }).toBuffer()
  ```
* **Auswahlfelder des Formulars** (Stil, Größe, Körperstelle, Farbe, Budget) →
  `src/lib/types.ts`. Der Server prüft jede Eingabe gegen genau diese Kataloge,
  Client und Validierung bleiben also automatisch synchron.
* **Seitenstruktur** → `src/app/(site)/`. Die Route-Gruppe `(site)` taucht in
  keiner Adresse auf; sie hält nur Kopf- und Fußzeile von `/admin` fern. Neue
  Seite = neuer Ordner mit `page.tsx`, Eintrag in `NAV`
  (`src/components/SiteHeader.tsx`) und in `src/app/sitemap.ts`.

## Termine anlegen (Dashboard)

Drei Wege, alle unter `/admin` → Reiter *Kalender*:

1. **Uhrzeit antippen** — Tag wählen, Dauer wählen, eine der
   Voreinstellungen (10:00 … 18:00) antippen. Der Termin ist sofort online.
2. **Andere Uhrzeit eintragen** — aufklappen, *von* und *bis* frei eingeben.
   Die Dauer rechnet der Server aus der Endzeit, damit Anzeige und
   Datenbestand nicht auseinanderlaufen können. Grenzen: 15 Minuten bis
   12 Stunden, kein Übertritt über Mitternacht.
3. **Mehrere Tage** — Tage im Kalender sammeln, dann eine Uhrzeit antippen;
   sie wird auf alle gesetzt.

## Sicherheit

* Passwortvergleich in konstanter Zeit; nach 8 Fehlversuchen ist die IP
  15 Minuten gesperrt.
* Jede Admin-Route prüft die Session einzeln — die Weiterleitung auf der
  Seite ist Komfort, nicht der Schutz.
* Terminanfragen: max. 5 pro IP und Stunde, Honeypot-Feld gegen Bots, jede
  Eingabe serverseitig gegen die Kataloge geprüft und in der Länge begrenzt.
* Der öffentliche Endpunkt liefert nur freie Termine ab heute und nur die
  Felder, die der Kalender braucht — keine internen Notizen, keine Rückschlüsse
  auf andere Kunden.
* `/admin` ist per `robots: noindex` und `robots.txt` von der Suche
  ausgeschlossen.

## Vor dem Live-Gang prüfen

Vier Dinge stehen noch auf Platzhaltern. Sie sind im Code kommentiert und
auf den betroffenen Seiten sichtbar markiert:

1. **Öffnungszeiten** (`src/lib/studio.ts`) sind angenommen — auf der
   Schaufensterscheibe steht nur „Termine nach Vereinbarung".
2. **E-Mail-Adresse und Instagram-Profil** in `STUDIO` sind erfunden.
3. **Preise** (`PRICE_ROWS` in `src/lib/content.ts`) sind Platzhalter in
   marktüblicher Größenordnung. Falsche Preise auf einer Website landen
   direkt als Ärger am Empfang.
4. **Beispiel-Bewertungen**, falls eingefügt — im Dashboard unter
   *Bewertungen* mit einem Klick entfernen.
5. **Impressum und Datenschutz** (`IMPRINT_FIELDS`, `PRIVACY_SECTIONS` in
   `src/lib/content.ts`) sind ein ausgefülltes Gerüst, keine
   Rechtsberatung. Alle offenen Stellen stehen in eckigen Klammern und
   werden auf den Seiten selbst als Hinweis angezeigt, solange sie leer
   sind. Ein unvollständiges Impressum ist in Deutschland abmahnfähig —
   bitte den fertigen Text prüfen lassen.

6. **Vertrauensmerkmale** (`TRUST_BADGES` in `src/lib/studio.ts`) sind
   Selbstauskünfte, keine Zertifikate. Bitte prüfen, dass jede Zusage im
   Studio auch wirklich so gehalten wird — und echte Nachweise dort
   ergänzen, statt Siegel zu erfinden.
7. **Artist-Texte** (`ARTISTS` in `src/lib/studio.ts`) beschreiben
   Schwerpunkte und Arbeitsweise von Michi und Gorilla. Von beiden
   gegenlesen lassen.

Adresse und Telefonnummer stammen vom Schaufenster-Foto des Studios und
sollten gegengeprüft werden. Auf der Scheibe steht „Artist: Michl" — im
Projekt ist durchgehend **Michi** hinterlegt; bitte klären, welche
Schreibweise nach außen gelten soll.
