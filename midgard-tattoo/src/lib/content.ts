// ─── Inhalte der Unterseiten ─────────────────────────────────────
// Preise, Pflegeanleitung und die Bausteine für Impressum und
// Datenschutz. Bewusst getrennt von studio.ts (Stammdaten), damit
// Textpflege nicht neben Adressdaten stattfindet.
//
// ⚠️ ZWEI DINGE VOR DEM LIVE-GANG:
//   1. Die PREISE unten sind Platzhalter in marktüblicher Größenordnung.
//      Sie müssen durch die echten Preise des Studios ersetzt werden —
//      falsche Preisangaben auf einer Website sind ein Ärgernis, das
//      direkt am Empfang landet.
//   2. IMPRESSUM und DATENSCHUTZ sind Pflichttexte mit rechtlicher
//      Wirkung. Was hier steht, ist ein ausgefülltes Gerüst, keine
//      Rechtsberatung. Alle mit [ ] markierten Stellen ergänzen und den
//      fertigen Text prüfen lassen.

// ─── Preise ──────────────────────────────────────────────────────
export interface PriceRow {
  label: string;
  price: string;
  note?: string;
}

export const PRICE_ROWS: PriceRow[] = [
  { label: "Mindestpreis", price: "ab 80 €", note: "Auch das kleinste Motiv braucht Vorbereitung, sterile Nadeln und Zeit." },
  { label: "Kleines Motiv", price: "80 – 200 €", note: "Bis etwa 10 cm, meist in einer Sitzung fertig." },
  { label: "Mittleres Motiv", price: "200 – 500 €", note: "10 bis 20 cm, je nach Detailgrad." },
  { label: "Großes Motiv", price: "ab 500 €", note: "Ab 20 cm, häufig über mehrere Sitzungen." },
  { label: "Tagessatz", price: "ca. 600 €", note: "Für großflächige Projekte, etwa 6 Stunden mit Pausen." },
];

export const PRICE_FACTORS = [
  {
    title: "Größe und Stelle",
    body: "Ein Unterarm sticht sich anders als Rippen oder Hand. Empfindliche Stellen brauchen mehr Pausen — und damit mehr Zeit.",
  },
  {
    title: "Detailgrad",
    body: "Feine Schattierungen und Realistik dauern deutlich länger als klare Linien. Der Aufwand steckt in den Übergängen.",
  },
  {
    title: "Vorlage oder Entwurf",
    body: "Ein individuell gezeichnetes Motiv bedeutet Zeichenzeit vor dem Termin. Die steckt im Preis mit drin.",
  },
  {
    title: "Cover-Up",
    body: "Ein altes Motiv zu überdecken ist aufwendiger als auf freier Haut zu arbeiten — oft braucht es auch mehr Sitzungen.",
  },
];

// ─── Pflege ──────────────────────────────────────────────────────
export const AFTERCARE_STEPS = [
  {
    when: "Die ersten Stunden",
    body: "Die Folie bleibt drauf, so lange es besprochen wurde — meist zwei bis vier Stunden, bei Second-Skin-Folie deutlich länger. Danach mit lauwarmem Wasser und sauberen Händen vorsichtig abwaschen.",
  },
  {
    when: "Tag 1 bis 3",
    body: "Zwei- bis dreimal täglich hauchdünn eincremen. Dünn heißt dünn: Die Haut soll atmen, nicht unter einer Fettschicht liegen. Wundsekret und etwas Farbe im Waschwasser sind normal.",
  },
  {
    when: "Tag 4 bis 14",
    body: "Es bildet sich eine feine Schuppenschicht, die juckt. Nicht kratzen, nicht abziehen — sonst geht Farbe mit. Weiter dünn eincremen, bis die Haut wieder glatt ist.",
  },
  {
    when: "Die ersten vier Wochen",
    body: "Kein Solarium, keine Sauna, kein Schwimmbad, kein Baden in Seen. Duschen ist in Ordnung, nur nicht minutenlang unter heißem Wasser stehen.",
  },
  {
    when: "Dauerhaft",
    body: "Sonne bleicht Tinte aus. Wer sein Tattoo lange scharf haben will, cremt es im Sommer mit hohem Lichtschutzfaktor ein — das ist der größte einzelne Hebel.",
  },
];

export const AFTERCARE_WARNINGS = [
  "Starke Rötung, die nach Tag 3 zunimmt statt abzuklingen",
  "Pochender Schmerz, Überwärmung oder gelblicher Ausfluss",
  "Fieber oder Schüttelfrost",
];

// ─── Impressum ───────────────────────────────────────────────────
// Pflichtangaben nach § 5 DDG (früher § 5 TMG) und § 18 MStV.
export const IMPRINT_FIELDS: { label: string; value: string; todo?: boolean }[] = [
  { label: "Diensteanbieter", value: "[Vollständiger Name des Inhabers]", todo: true },
  { label: "Anschrift", value: "Nürnberger Straße 7, 90518 Altdorf" },
  { label: "Telefon", value: "0171 833 99 86" },
  { label: "E-Mail", value: "[E-Mail-Adresse des Studios]", todo: true },
  { label: "Umsatzsteuer-ID", value: "[USt-IdNr. nach § 27 a UStG — oder Hinweis auf Kleinunternehmerregelung]", todo: true },
  { label: "Inhaltlich verantwortlich (§ 18 Abs. 2 MStV)", value: "[Name und Anschrift]", todo: true },
  { label: "Zuständige Aufsichtsbehörde", value: "[Gesundheitsamt des Landkreises Nürnberger Land]", todo: true },
];

// ─── Datenschutz ─────────────────────────────────────────────────
export interface PrivacySection {
  title: string;
  body: string[];
  todo?: boolean;
}

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    title: "Verantwortlich für die Datenverarbeitung",
    body: [
      "Verantwortlich im Sinne der Datenschutz-Grundverordnung ist der im Impressum genannte Diensteanbieter. Für Fragen zum Datenschutz genügt eine Nachricht an die dort angegebene Adresse.",
    ],
  },
  {
    title: "Terminanfragen",
    body: [
      "Wer über das Formular einen Termin anfragt, gibt Name, E-Mail-Adresse und Telefonnummer an sowie Angaben zum gewünschten Motiv (Stil, Größe, Körperstelle, Farbe, Budgetrahmen, Beschreibung, optional ein Referenz-Link).",
      "Diese Angaben werden ausschließlich verwendet, um die Anfrage zu bearbeiten und den Termin abzustimmen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Anbahnung eines Vertragsverhältnisses) sowie die im Formular erteilte Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO.",
      "Die Daten werden gelöscht, sobald sie für die Terminabwicklung nicht mehr benötigt werden — spätestens nach Ablauf gesetzlicher Aufbewahrungsfristen. Eine Löschung auf Wunsch ist jederzeit möglich.",
    ],
  },
  {
    title: "E-Mail-Versand",
    body: [
      "Zur Bestätigung von Anfragen versendet die Website automatisch E-Mails. Dafür wird ein Versanddienstleister eingesetzt, der die Empfängeradresse und den Inhalt der Nachricht verarbeitet.",
      "[Namen und Sitz des eingesetzten Dienstleisters ergänzen sowie den Abschluss eines Auftragsverarbeitungsvertrags bestätigen.]",
    ],
    todo: true,
  },
  {
    title: "Hosting und Server-Protokolle",
    body: [
      "Die Website wird bei einem Hosting-Anbieter betrieben, der beim Aufruf technisch notwendige Daten verarbeitet: IP-Adresse, Zeitpunkt, aufgerufene Adresse, übertragene Datenmenge und Browserkennung. Diese Daten dienen dem sicheren Betrieb und werden nach kurzer Zeit gelöscht.",
      "[Namen und Sitz des Hosting-Anbieters ergänzen sowie den Abschluss eines Auftragsverarbeitungsvertrags bestätigen.]",
    ],
    todo: true,
  },
  {
    title: "Kartenanzeige (Google Maps)",
    body: [
      "Auf der Studio-Seite lässt sich eine Karte einblenden. Sie wird NICHT automatisch geladen: Zu sehen ist zunächst eine eigene Vorschau ohne jede Verbindung nach außen.",
      "Erst wenn du auf „Karte laden\" klickst, stellt dein Browser eine Verbindung zu Google (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland) her. Dabei werden deine IP-Adresse und Geräteinformationen an Google übertragen; Google kann dabei Cookies setzen. Rechtsgrundlage ist deine Einwilligung durch den Klick, Art. 6 Abs. 1 lit. a DSGVO.",
      "Ohne diesen Klick findet keine Übertragung statt. Die Adresse des Studios steht auch als Text auf der Seite.",
    ],
  },
  {
    title: "Cookies und Reichweitenmessung",
    body: [
      "Diese Website setzt keine Cookies zu Werbe- oder Analysezwecken und bindet keine Dienste zur Reichweitenmessung ein. Schriften werden von der eigenen Domain ausgeliefert; es findet kein Aufruf externer Schriftanbieter statt. Externe Inhalte werden ausschließlich nach ausdrücklichem Klick geladen (siehe Kartenanzeige).",
      "Im geschützten Studio-Bereich wird ein technisch notwendiges Cookie gesetzt, das ausschließlich der Anmeldung des Inhabers dient.",
    ],
  },
  {
    title: "Deine Rechte",
    body: [
      "Dir stehen die Rechte auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO) zu. Eine erteilte Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen.",
      "Außerdem besteht ein Beschwerderecht bei einer Datenschutz-Aufsichtsbehörde. Zuständig ist in Bayern das Bayerische Landesamt für Datenschutzaufsicht (BayLDA), Promenade 27, 91522 Ansbach.",
    ],
  },
];
