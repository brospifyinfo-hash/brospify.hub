// ─── Stammdaten des Studios ──────────────────────────────────────
// Eine Datei, ein Ort: Adresse, Kontakt, Öffnungszeiten und die
// Galerie. Wer Texte oder Bilder ändern will, ändert sie hier — kein
// CMS nötig, und Server- wie Client-Komponenten ziehen dieselben Werte.
//
// Quelle der Kontaktdaten ist das Schaufenster-Foto des Studios
// (Nürnberger Straße 7, 90518 Altdorf · 0171 833 99 86). Tätowiert wird
// von Michi (Inhaber) und Gorilla — beide siehe ARTISTS weiter unten.
// Vor dem Live-Gang bitte gegenprüfen — vor allem die Öffnungszeiten,
// die auf der Scheibe nur als „Termine nach Vereinbarung" stehen.

export const STUDIO = {
  name: "Midgard Tattoo",
  tagline: "Black & Grey aus Altdorf",
  /** Wer die Anfragen beantwortet — steht in Mails und Bestätigungen. */
  artist: "Michi",
  /** Beide Namen zusammen, für Fließtext und Suchmaschinen. */
  artists: "Michi & Gorilla",
  street: "Nürnberger Straße 7",
  zip: "90518",
  city: "Altdorf",
  country: "Deutschland",
  phone: "0171 833 99 86",
  /** tel:-Link, international normalisiert. */
  phoneHref: "tel:+491718339986",
  email: "termin@midgard-tattoo.de",
  instagram: "https://www.instagram.com/",
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=Nürnberger+Straße+7,+90518+Altdorf",
  doorNote: "Termine nach Vereinbarung — bitte klingeln.",
} as const;

/** Öffnungszeiten. `null` = geschlossen. */
export const OPENING_HOURS: { day: string; hours: string | null }[] = [
  { day: "Montag", hours: null },
  { day: "Dienstag", hours: "11:00 – 19:00" },
  { day: "Mittwoch", hours: "11:00 – 19:00" },
  { day: "Donnerstag", hours: "11:00 – 19:00" },
  { day: "Freitag", hours: "11:00 – 19:00" },
  { day: "Samstag", hours: "10:00 – 16:00" },
  { day: "Sonntag", hours: null },
];

// ─── Galerie ─────────────────────────────────────────────────────
// `span` steuert, wie viel Fläche eine Arbeit im Masonry-Raster bekommt:
// "tall" bekommt die volle Höhe, "wide" zieht sich auf dem Desktop über
// zwei Spalten. `blur` ist ein 12 px breites WebP als Data-URI — es
// steht sofort im HTML und verhindert das graue Loch beim Nachladen.
export interface GalleryPiece {
  slug: string;
  src: string;
  alt: string;
  title: string;
  style: string;
  placement: string;
  width: number;
  height: number;
  blur: string;
  span?: "tall" | "wide";
  /** Läuft in der Slideshow im Hero mit, solange keine eigenen Bilder
   *  hochgeladen sind. Ohne Markierung bliebe die Auswahl dem Zufall der
   *  Reihenfolge überlassen — inklusive Studiofotos, die als
   *  bildschirmfüllender Hintergrund nicht funktionieren. */
  inHero?: boolean;
  /** Reihenfolge in der Slideshow. Ohne Angabe entscheidet die
   *  Reihenfolge in GALLERY — und die richtet sich nach der Galerie-Seite,
   *  nicht danach, welches Motiv den besten ersten Eindruck macht. */
  heroOrder?: number;
  /** `object-position` für die Darstellung im Hero.
   *  Ein Hochformat auf einen breiten Bildschirm zu legen heißt, den
   *  Großteil wegzuschneiden — welcher Teil stehen bleibt, entscheidet
   *  über Wirkung oder Unfall. Deshalb pro Motiv gesetzt statt einmal
   *  global geraten. Vorgabe: "50% 30%". */
  focal?: string;
}

export const GALLERY: GalleryPiece[] = [
  {
    slug: "kolibri-lotus",
    src: "/kolibri-lotus.webp",
    alt: "Kolibri über Lotusblüten mit drei Schmetterlingen, Black-and-Grey-Tattoo auf dem Oberschenkel",
    title: "Kolibri & Lotus",
    style: "Black & Grey",
    placement: "Oberschenkel",
    width: 1179,
    height: 1549,
    blur: "data:image/webp;base64,UklGRmYAAABXRUJQVlA4IFoAAAAQAgCdASoMABAAA8BgJZACdADdb+Xmh6lAAP7m2kSR/1zqzzSUYMqc/i7vsVBh4lBY5CosYZGtq3fDnnhtW/bnpImqgRFHNnPE1M4pku95ntQPjuGrGX2f4AA=",
    span: "tall",
    focal: "48% 45%",
    inHero: true,
    heroOrder: 2,
  },
  {
    slug: "loewe-sketch",
    src: "/loewe-sketch.webp",
    alt: "Löwenkopf im Sketch-Stil mit offenen Linien, Tattoo auf dem Unterarm",
    title: "Löwe im Sketch-Stil",
    style: "Sketch / Realistic",
    placement: "Unterarm",
    width: 1179,
    height: 1155,
    blur: "data:image/webp;base64,UklGRlQAAABXRUJQVlA4IEgAAADwAQCdASoMAAwAA8BgJQBOgBusN08sruAA+EKjYtTIBLkoPPj+oGatVsUpItM/mde47Wb1TYjoRRMq/ZtcKj+OyWts6e+AAAA=",
    focal: "50% 42%",
    inHero: true,
    heroOrder: 5,
  },
  {
    slug: "libelle-seerose",
    src: "/libelle-seerose.webp",
    alt: "Libelle über zwei Seerosen mit Aquarell-Schatten, Tattoo auf der Wade",
    title: "Libelle & Seerose",
    style: "Black & Grey / Aquarell",
    placement: "Wade",
    width: 1179,
    height: 1174,
    blur: "data:image/webp;base64,UklGRlgAAABXRUJQVlA4IEwAAADwAQCdASoMAAwAA8BgJZACdAD8LXIZXOgA/k9sBpZIXf7IA/86G6lkGUcM/kyS6P1HBRkPvRzELV3u5GUA/UEDhV90UQgNUjeAqaQA",
    focal: "42% 42%",
  },
  {
    slug: "wanderhoden",
    src: "/wanderhoden.webp",
    alt: "Comic-Figur mit Wanderhut, Rucksack und Wanderstock, darunter der Schriftzug Wanderhoden",
    title: "Wanderhoden",
    style: "Illustrativ / Humor",
    placement: "Wade",
    width: 1179,
    height: 1152,
    blur: "data:image/webp;base64,UklGRk4AAABXRUJQVlA4IEIAAADwAQCdASoMAAwAA8BgJZACdADcYsso1oAA9zOdEWr1o8RThBNz2h6uCMQkq/l2P3yaKtkQe+n7rsUYVNQlfkUWgAA=",
  },
  {
    slug: "fee-schmetterlinge",
    src: "/fee-schmetterlinge.webp",
    alt: "Fee mit Schmetterlingsflügeln, langem Haar und Schmetterlingen, Black-and-Grey-Tattoo auf dem Oberarm",
    title: "Fee & Schmetterlinge",
    style: "Black & Grey / Fineline",
    placement: "Oberarm",
    width: 1179,
    height: 1172,
    blur: "data:image/webp;base64,UklGRlQAAABXRUJQVlA4IEgAAACwAQCdASoMAAwAA8BgJQBOgBmfNjoAAOJ8xmENCEkwbbAT29kL30Q3Zz38TZQKidQVuvps4yvU0w6HWw9z/Iv02Y+ESC6gAAA=",
    focal: "45% 35%",
    inHero: true,
    heroOrder: 1,
  },
  {
    slug: "phoenix",
    src: "/phoenix.webp",
    alt: "Aufsteigender Phönix mit langen Schwanzfedern, schwarz-grau mit roten Akzenten, Tattoo auf der Wade",
    title: "Phönix",
    style: "Black & Grey mit Rot",
    placement: "Wade",
    width: 824,
    height: 1153,
    blur: "data:image/webp;base64,UklGRmIAAABXRUJQVlA4IFYAAACwAwCdASoMABEAPwFqrU8rJaQiMAgBYCAJQBOkGQAtYcF3wGk5IAD7AHRu8O5E9L/neIEY+Hfr7dgnmicK4IRVrgQd5IooR5FXNwbMCteD+ZCsnEAAAA==",
    focal: "48% 40%",
    inHero: true,
    heroOrder: 4,
  },
  {
    slug: "blut-schweiss-traenen",
    src: "/blut-schweiss-traenen.webp",
    alt: "Schriftzug „Blut Schweiß Tränen“ in geschwungener Schreibschrift auf dem Handrücken",
    title: "Blut, Schweiß, Tränen",
    style: "Lettering",
    placement: "Handrücken",
    width: 1179,
    height: 1161,
    blur: "data:image/webp;base64,UklGRlIAAABXRUJQVlA4IEYAAADQAQCdASoMAAwAA8BgJZACsADZqzh2QAD+058wrmeT8fcFr7eq8zlkRDw+mZTq5KMjqS/HZwaH5P1RLYKyy9ziXl/ZwAAA",
  },
  {
    slug: "totenkopf",
    src: "/totenkopf.webp",
    alt: "Fotorealistischer Totenkopf über einer düsteren Landschaft, Tattoo auf dem Unterarm",
    title: "Totenkopf",
    style: "Realistic",
    placement: "Unterarm",
    width: 1179,
    height: 1156,
    blur: "data:image/webp;base64,UklGRkYAAABXRUJQVlA4IDoAAADwAQCdASoMAAwAA8BgJZQCdADdJAXI6YAA/qwsZ/Low6OkhqWv5JOrBqiOFZJiamxse76kyUJiEgAA",
    focal: "50% 40%",
    inHero: true,
    heroOrder: 3,
  },
];

/** Erstes Bild der Hero-Slideshow — Rückfall für Vorschaubilder. */
export const HERO_PIECE =
  GALLERY.filter((p) => p.inHero).sort((a, b) => (a.heroOrder ?? 99) - (b.heroOrder ?? 99))[0]
  ?? GALLERY[0];

// ─── Stil-Schwerpunkte (Sektion „Handschrift") ───────────────────
export const SPECIALTIES = [
  {
    title: "Black & Grey",
    body: "Weiche Grauverläufe, tiefe Schwarztöne, viel Luft dazwischen. Die Handschrift des Hauses — von der Lotusblüte bis zum Portrait.",
  },
  {
    title: "Realistic & Sketch",
    body: "Tiere und Portraits, entweder fotorealistisch ausgearbeitet oder bewusst offen gelassen: sichtbare Linien, wie direkt aus dem Skizzenbuch.",
  },
  {
    title: "Fineline & Florales",
    body: "Feine Linien, Blüten, Insekten, Schmetterlinge. Filigran genug für den Unterarm, ruhig genug, um mit der Zeit gut zu altern.",
  },
  {
    title: "Cover-Up",
    body: "Altes Motiv, das nicht mehr passt? Wir schauen gemeinsam, was möglich ist — ehrlich, auch wenn die Antwort mal Laserentfernung heißt.",
  },
];

// ─── FAQ ─────────────────────────────────────────────────────────
export const FAQ = [
  {
    q: "Wie läuft die Terminanfrage ab?",
    a: "Du wählst im Kalender einen der freigegebenen Termine, füllst das kurze Formular aus und schickst es ab. Der Termin ist dann für dich reserviert und wird nach der persönlichen Rückmeldung fest bestätigt.",
  },
  {
    q: "Warum sehe ich nur bestimmte Tage?",
    a: "Im Kalender stehen ausschließlich Termine, die vorher aktiv freigegeben wurden. Alles andere ist entweder schon vergeben oder für Vorbereitung, Zeichnung und Pausen reserviert.",
  },
  {
    q: "Was kostet ein Tattoo?",
    a: "Das hängt von Größe, Motiv und Aufwand ab. Kleine Arbeiten starten bei einem Mindestpreis, größere werden pro Sitzung abgerechnet. Nach deiner Anfrage bekommst du eine ehrliche Einschätzung, bevor irgendetwas fix ist.",
  },
  {
    q: "Bekomme ich vorher einen Entwurf?",
    a: "Ja. Nach dem Vorgespräch entsteht eine Zeichnung, die wir gemeinsam durchgehen. Erst wenn sie sitzt, wird tätowiert.",
  },
  {
    q: "Muss ich eine Anzahlung leisten?",
    a: "Für größere Projekte ja — sie sichert deinen Termin und wird mit dem Endpreis verrechnet. Wie hoch sie ausfällt, besprechen wir im Vorgespräch.",
  },
  {
    q: "Ab welchem Alter darf ich mich tätowieren lassen?",
    a: "Ab 18 Jahren, ohne Ausnahme. Bitte bring einen gültigen Ausweis mit.",
  },
  {
    q: "Wie pflege ich mein frisches Tattoo?",
    a: "Du bekommst nach der Sitzung eine schriftliche Pflegeanleitung mit: sauber halten, dünn eincremen, zwei Wochen kein Solarium, keine Sauna, kein Schwimmbad. Bei Fragen einfach anrufen.",
  },
];

// ─── Studio-Aufnahmen ────────────────────────────────────────────
// Bewusst NICHT in der Galerie: dort geht es um Arbeiten, nicht um
// Räume. Diese beiden gehören zum Standort und stehen deshalb nur auf
// der Studio-Seite.
export const STUDIO_PHOTOS: GalleryPiece[] = [
  {
    slug: "studio-altdorf",
    src: "/studio-altdorf.webp",
    alt: "Schaufenster des Midgard-Tattoo-Studios in der Nürnberger Straße 7 in Altdorf bei Tag",
    title: "Von der Straße",
    style: "Nürnberger Straße 7",
    placement: "Tagsüber",
    width: 1179,
    height: 1037,
    blur: "data:image/webp;base64,UklGRlgAAABXRUJQVlA4IEwAAAAQAgCdASoMAAsAA8BgJYwC7AEQ+mOeAQ6AAP63CmzweDjxbO0evLHqz5UGZrA5R6Ll6EdMjmBIuaiCNIFOYNRJzD98wpgoAsfYAAAA",
  },
  {
    slug: "studio-abend",
    src: "/studio-abend.webp",
    alt: "Das beleuchtete Schaufenster des Studios von innen, am Abend",
    title: "Von innen",
    style: "Nürnberger Straße 7",
    placement: "Am Abend",
    width: 979,
    height: 1004,
    blur: "data:image/webp;base64,UklGRlQAAABXRUJQVlA4IEgAAAAwAgCdASoMAAwAA8BgJagCdAEU+LrOfHW0AAD+oyZYhIBc/LpGji3c1ShiSdSVaslCBQboHL7wyH+NtE/0RYcKoJHOtQOAAAA=",
  },
];

// ─── Die Artists ─────────────────────────────────────────────────
// Zwei Menschen, zwei Handschriften. Die Fotos sind Schwarzweiß-
// Aufnahmen bei der Arbeit — bewusst keine gestellten Portraits.
export interface Artist {
  slug: string;
  name: string;
  role: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  blur: string;
  /** `object-position` — beide Aufnahmen sind quadratisch und werden im
   *  Hochformat gezeigt; ohne Angabe schneidet der Browser mittig und
   *  damit am Gesicht vorbei. */
  focal: string;
  /** Worauf sich diese Person spezialisiert hat. */
  focus: string[];
  bio: string;
}

export const ARTISTS: Artist[] = [
  {
    slug: "michi",
    name: "Michi",
    role: "Inhaber & Artist",
    src: "/artist-michi.webp",
    alt: "Michi bei der Arbeit am Tattoo, Schwarzweiß-Aufnahme im Studio",
    width: 934,
    height: 950,
    focal: "62% 38%",
    blur: "data:image/webp;base64,UklGRlwAAABXRUJQVlA4IFAAAADwAQCdASoMAAwAA8BgJaQAAq9hwvNszwAA/uFeI9aXt1Mk4bSgI7XEMzzIMTAdVfZGacJcprQYeY26mpqu8KCsfthXKVcBMf6TQJY1V/wwAA==",
    focus: ["Black & Grey", "Realistic", "Cover-Up"],
    bio: "Führt das Studio in der Nürnberger Straße. Arbeitet am liebsten in Schwarz-Grau mit weichen Verläufen — Portraits, Tiere, alles, was Tiefe braucht. Sagt vor dem Stechen ehrlich, wenn eine Idee so nicht funktioniert.",
  },
  {
    slug: "gorilla",
    name: "Gorilla",
    role: "Artist",
    src: "/artist-gorilla.webp",
    alt: "Gorilla konzentriert bei der Arbeit am Tattoo, Schwarzweiß-Aufnahme im Studio",
    width: 1048,
    height: 1067,
    focal: "35% 32%",
    blur: "data:image/webp;base64,UklGRlwAAABXRUJQVlA4IFAAAADwAQCdASoMAAwAA8BgJaQAAlxljB+5bAAA/U8NQd3hIKnpUpKbnu7tUkErNo9DHXtTcV3LKw9xccUMyxpc6Peq7d0Ug9LB+f+fhCC/GAAAAA==",
    focus: ["Fineline", "Florales", "Lettering"],
    bio: "Feine Linien, Blüten, Insekten, Schriftzüge. Nimmt sich für filigrane Arbeiten die Zeit, die sie brauchen — und macht so oft Pause, wie du sie brauchst.",
  },
];

// ─── Vertrauensmerkmale ──────────────────────────────────────────
// Bewusst KEINE Siegel, Zertifikate oder Mitgliedschaften: was hier
// steht, ist Selbstauskunft über die eigene Arbeitsweise — nachprüfbar
// im Studio, nicht durch eine Prüfstelle. Erfundene Auszeichnungen
// („TÜV-geprüft", „zertifizierter Betrieb") wären Werbung mit falschen
// Tatsachen und nach § 5 UWG angreifbar. Wenn echte Nachweise
// vorliegen (Hygieneschulung, Erste-Hilfe-Kurs, Gewerbeanmeldung beim
// Gesundheitsamt), gehören sie hier hinein — mit Namen und Jahr.
export interface TrustBadge {
  /** Kurzform für die Kachel. */
  title: string;
  /** Ein Satz, der die Zusage konkret macht. */
  body: string;
  /** Piktogramm-Kennung, siehe src/components/Trust.tsx. */
  icon: "needle" | "shield" | "pencil" | "chat" | "id";
}

export const TRUST_BADGES: TrustBadge[] = [
  {
    title: "Einwegnadeln",
    body: "Jede Nadel und jede Kartusche kommt steril verpackt und wird nach der Sitzung entsorgt. Nichts wird zweimal benutzt.",
    icon: "needle",
  },
  {
    title: "Saubere Arbeitsfläche",
    body: "Liege, Griffe und Ablagen werden vor jedem Termin desinfiziert und abgedeckt. Farben stammen von geprüften Herstellern.",
    icon: "shield",
  },
  {
    title: "Eigener Entwurf",
    body: "Dein Motiv wird für dich gezeichnet — keine Vorlage von der Wand, die schon zehn andere tragen.",
    icon: "pencil",
  },
  {
    title: "Kostenlose Beratung",
    body: "Das Vorgespräch kostet nichts und verpflichtet zu nichts. Auch wenn am Ende kein Termin daraus wird.",
    icon: "chat",
  },
  {
    title: "Ab 18, mit Ausweis",
    body: "Tätowiert wird ausschließlich ab 18 Jahren. Ausweis bitte mitbringen — ohne Ausnahme, auch nicht mit Einverständnis der Eltern.",
    icon: "id",
  },
];
