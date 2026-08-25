// ─── Stammdaten des Studios ──────────────────────────────────────
// Eine Datei, ein Ort: Adresse, Kontakt, Öffnungszeiten und die
// Galerie. Wer Texte oder Bilder ändern will, ändert sie hier — kein
// CMS nötig, und Server- wie Client-Komponenten ziehen dieselben Werte.
//
// Quelle der Kontaktdaten ist das Schaufenster-Foto des Studios
// (Nürnberger Straße 7, 90518 Altdorf · Artist: Michl · 0171 833 99 86).
// Vor dem Live-Gang bitte gegenprüfen — vor allem die Öffnungszeiten,
// die auf der Scheibe nur als „Termine nach Vereinbarung" stehen.

export const STUDIO = {
  name: "Midgard Tattoo",
  tagline: "Black & Grey aus Altdorf",
  artist: "Michl",
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
    slug: "studio-altdorf",
    src: "/studio-altdorf.webp",
    alt: "Schaufenster des Midgard-Tattoo-Studios in der Nürnberger Straße 7 in Altdorf",
    title: "Das Studio",
    style: "Nürnberger Straße 7",
    placement: "Altdorf",
    width: 1179,
    height: 1037,
    blur: "data:image/webp;base64,UklGRlgAAABXRUJQVlA4IEwAAAAQAgCdASoMAAsAA8BgJYwC7AEQ+mOeAQ6AAP63CmzweDjxbO0evLHqz5UGZrA5R6Ll6EdMjmBIuaiCNIFOYNRJzD98wpgoAsfYAAAA",
    span: "wide",
  },
];

/** Das Stück, das im Hero groß im Parallax liegt. */
export const HERO_PIECE = GALLERY[0];

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
