// ─── Section-Bibliothek des Theme-Editors ───────────────────────────
// Registry aller anbietbaren Produktseiten-Sektionen mit Style-Presets.
// Client-safe: Vorschau (Replica-Renderer), Editor-UI UND Compile-Engine
// lesen dieselben Definitionen → Vorschau = Download.
//
// WICHTIG: Alle Setting-Keys/Werte sind gegen die echten {% schema %}-Blöcke
// der Theme-Basis verifiziert (siehe Session-Extraktion). KEINE Keys erfinden.
// Preset-Werte, die mit "@" beginnen (z. B. "@accent"), werden beim Compile
// und in der Vorschau gegen die Farb-Palette aufgelöst.

import type { ColorPalette } from "@/lib/theme-placeholders";
import type { SectionInstance, ThemeDocument } from "@/lib/theme-doc";
import { newSectionUid, emptyDocument } from "@/lib/theme-doc";
import { getThemeStyle } from "@/lib/theme-styles";
import { BUYBOX_DEFAULT_ORDER } from "@/lib/theme-sections";
import { DEFAULT_BENEFIT_ICONS } from "@/lib/theme-icons";

export type SectionCategory = "conversion" | "social" | "content" | "media" | "info";

export const CATEGORY_LABELS: Record<SectionCategory, { de: string; en: string }> = {
  conversion: { de: "Verkauf & Angebote", en: "Conversion & offers" },
  social: { de: "Social Proof", en: "Social proof" },
  content: { de: "Inhalt & Story", en: "Content & story" },
  media: { de: "Bild & Video", en: "Media" },
  info: { de: "Infos & FAQ", en: "Info & FAQ" },
};

export interface FieldTarget {
  /** Setting-Key (Section-Setting oder — mit blockType — Block-Setting). */
  key: string;
  blockType?: string;
  /** n-ter Block dieses Typs (0-basiert), default 0. */
  index?: number;
}

export interface FieldDef {
  id: string;
  label: string;
  labelEn: string;
  kind: "text" | "textarea";
  target: FieldTarget;
  /** Default-Text — Fallback in Vorschau UND Download. */
  def: string;
  /** Ziel ist richtext → Wert wird als <p>…</p> geschrieben. */
  html?: boolean;
}

export interface BlockRecipe {
  type: string;
  settings: Record<string, string | number | boolean>;
}

export interface PresetDef {
  id: string;
  label: string;
  labelEn: string;
  hint: string;
  /** settings-Overrides auf echten Schema-Keys. "@rolle" = Palette-Farbe. */
  settings: Record<string, string | number | boolean>;
  /** Ersetzen die Blocks der Section beim Instanziieren (optional). */
  blocks?: BlockRecipe[];
}

export interface SectionDef {
  type: string;
  category: SectionCategory;
  label: string;
  labelEn: string;
  desc: string;
  descEn: string;
  fields: FieldDef[];
  presets: PresetDef[];
}

// ─── Hilfen ─────────────────────────────────────────────────────────

const PALETTE_REF: Record<string, keyof ColorPalette> = {
  "@accent": "accent",
  "@button": "button",
  "@buttonText": "buttonText",
  "@background": "background",
  "@text": "text",
};

/** Löst "@accent" & Co. gegen die Palette auf; andere Werte unverändert. */
export function resolvePaletteRef(value: string | number | boolean, palette: ColorPalette): string | number | boolean {
  if (typeof value === "string" && value.startsWith("@")) {
    const role = PALETTE_REF[value];
    if (role) return palette[role];
  }
  return value;
}

export function getSectionDef(type: string): SectionDef | undefined {
  return SECTION_LIBRARY.find((s) => s.type === type);
}

export function getPresetDef(def: SectionDef | undefined, presetId: string): PresetDef | undefined {
  if (!def) return undefined;
  return def.presets.find((p) => p.id === presetId) || def.presets[0];
}

/** Effektive Texte einer Instanz: Feld-Defaults ⊕ Nutzer-Eingaben. */
export function resolveTexts(instance: SectionInstance): Record<string, string> {
  const def = getSectionDef(instance.type);
  const out: Record<string, string> = {};
  for (const f of def?.fields || []) out[f.id] = f.def;
  for (const [k, v] of Object.entries(instance.texts || {})) {
    if (typeof v === "string" && v.trim()) out[k] = v;
  }
  return out;
}

/** Effektive Preset-Settings einer Instanz (Palette-Refs aufgelöst).
 *  presetId "" = NEUTRAL: keine Overrides — die Section behält ihren
 *  Basis-Zustand (wichtig für übernommene Startseiten-Sections). */
export function resolvePresetSettings(instance: SectionInstance, palette: ColorPalette): Record<string, string | number | boolean> {
  if (!instance.presetId) return {};
  const def = getSectionDef(instance.type);
  const preset = getPresetDef(def, instance.presetId);
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(preset?.settings || {})) out[k] = resolvePaletteRef(v, palette);
  return out;
}

// ─── Wiederkehrende Block-Rezepte ───────────────────────────────────

const FAQ_ROWS: { q: string; a: string }[] = [
  { q: "Wie schnell wird geliefert?", a: "<p>Wir versenden innerhalb von 24 Stunden — die Lieferung dauert in der Regel 1–3 Werktage.</p>" },
  { q: "Kann ich das Produkt zurückgeben?", a: "<p>Ja, du hast 30 Tage Zeit. Geld-zurück-Garantie ohne Wenn und Aber.</p>" },
  { q: "Ist die Bezahlung sicher?", a: "<p>Absolut. Alle Zahlungen laufen SSL-verschlüsselt über PayPal, Klarna oder Kreditkarte.</p>" },
  { q: "Was ist, wenn ich Fragen habe?", a: "<p>Unser Support antwortet dir innerhalb von 24 Stunden — schreib uns einfach.</p>" },
];

const TRUST_REVIEWS: { text: string; name: string; rating: number }[] = [
  { text: "Top Qualität und blitzschnelle Lieferung — absolut empfehlenswert!", name: "Sarah M.", rating: 5 },
  { text: "Hat meine Erwartungen wirklich übertroffen. Klare Kaufempfehlung.", name: "Tom K.", rating: 5 },
  { text: "Endlich ein Produkt, das hält, was es verspricht.", name: "Laura B.", rating: 5 },
  { text: "Super Preis-Leistung, sehr zufrieden. Gerne wieder!", name: "Nico W.", rating: 4 },
  { text: "Schnell geliefert, top verpackt — fünf Sterne.", name: "Julia S.", rating: 5 },
];

const FEATURES: { title: string; text: string }[] = [
  { title: "Durchdachtes Design", text: "Jedes Detail ist auf den Alltag abgestimmt — einfach, robust, zuverlässig." },
  { title: "Premium-Material", text: "Sorgfältig ausgewählte Materialien für ein Ergebnis, das du spürst." },
  { title: "Sofort startklar", text: "Auspacken, loslegen — keine komplizierte Einrichtung nötig." },
  { title: "Für dich getestet", text: "Von tausenden Kunden geprüft und mit Bestnoten bewertet." },
];

const faqBlocks = (): BlockRecipe[] => FAQ_ROWS.map((r) => ({ type: "faq", settings: { question: r.q, answer: r.a } }));
const trustBlocks = (): BlockRecipe[] => TRUST_REVIEWS.map((r) => ({ type: "review", settings: { review_text: r.text, mobile_review_text: r.text, reviewer_name: r.name, rating: r.rating } }));
const featureBlocks = (n: number): BlockRecipe[] => FEATURES.slice(0, n).map((f) => ({ type: "feature", settings: { title: f.title, text: f.text } }));

// ─── Die Bibliothek ────────────────────────────────────────────────

export const SECTION_LIBRARY: SectionDef[] = [
  // ══ Verkauf & Angebote ══
  {
    type: "bro-cta-banner",
    category: "conversion",
    label: "CTA-Banner",
    labelEn: "CTA banner",
    desc: "Großes Statement mit Button — perfekt als Abschluss der Seite.",
    descEn: "Big statement with a button — perfect to close the page.",
    fields: [
      { id: "eyebrow", label: "Eyebrow", labelEn: "Eyebrow", kind: "text", target: { key: "eyebrow" }, def: "Limitiertes Angebot" },
      { id: "heading", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "heading" }, def: "Bereit für den Unterschied?" },
      { id: "subheading", label: "Untertitel", labelEn: "Subheading", kind: "textarea", target: { key: "subheading" }, def: "Schließe dich tausenden zufriedenen Kunden an — risikofrei mit 30 Tagen Geld-zurück-Garantie." },
      { id: "cta", label: "Button-Text", labelEn: "Button label", kind: "text", target: { key: "btn_primary_text_label" }, def: "JETZT SICHERN" },
    ],
    presets: [
      { id: "vollbild", label: "Vollbild-Hero", labelEn: "Full-bleed hero", hint: "Hoch, zentriert, dramatisch", settings: { align: "center", min_height_desktop: 560, h_size_desktop: 64, overlay_opacity: 55, radius: 0, max_width: 860, padding_y: 110, accent_color: "@accent", btn_primary_bg: "@button", btn_primary_text: "@buttonText" } },
      { id: "karte", label: "Karten-Banner", labelEn: "Card banner", hint: "Abgerundet, kompakt, edel", settings: { align: "center", min_height_desktop: 340, h_size_desktop: 40, radius: 28, max_width: 720, padding_y: 64, overlay_opacity: 35, accent_color: "@accent", btn_primary_bg: "@button", btn_primary_text: "@buttonText" } },
      { id: "editorial", label: "Editorial links", labelEn: "Editorial left", hint: "Linksbündig, ruhig, hochwertig", settings: { align: "left", min_height_desktop: 460, h_size_desktop: 52, radius: 0, max_width: 640, overlay_opacity: 50, accent_color: "@accent", btn_primary_bg: "@button", btn_primary_text: "@buttonText" } },
    ],
  },
  {
    type: "countdown",
    category: "conversion",
    label: "Countdown-Banner",
    labelEn: "Countdown banner",
    desc: "Tickender Angebots-Countdown mit Promo-Zeilen.",
    descEn: "Ticking offer countdown with promo lines.",
    fields: [
      { id: "heading", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "heading_text" }, def: "Nur für kurze Zeit" },
      { id: "subheading", label: "Untertitel", labelEn: "Subheading", kind: "text", target: { key: "subheading_text" }, def: "Sichere dir dein Angebot, bevor der Timer abläuft" },
    ],
    presets: [
      { id: "dunkel", label: "Dunkel", labelEn: "Dark", hint: "Dunkler Balken, Akzent-Timer", settings: { bg_color: "#0f0f12", heading_color: "#ffffff", accent_color: "@accent" } },
      { id: "akzent", label: "Akzent", labelEn: "Accent", hint: "Voll in deiner Akzentfarbe", settings: { bg_color: "@accent", heading_color: "#ffffff", accent_color: "#ffffff" } },
      { id: "hell", label: "Hell", labelEn: "Light", hint: "Dezent auf Seiten-Hintergrund", settings: { bg_color: "@background", heading_color: "@text", accent_color: "@accent" } },
    ],
  },
  {
    type: "featured-collection",
    category: "conversion",
    label: "Produkt-Empfehlungen",
    labelEn: "Featured products",
    desc: "Weitere Produkte aus deinem Shop — Cross-Selling.",
    descEn: "More products from your shop — cross-selling.",
    fields: [{ id: "title", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "title" }, def: "Das könnte dir auch gefallen" }],
    presets: [
      { id: "galerie", label: "Galerie", labelEn: "Gallery", hint: "4 Spalten, quadratisch", settings: { columns_desktop: 4, image_ratio: "square", heading_size: "h2", products_to_show: 4, enable_desktop_slider: false } },
      { id: "editorial", label: "Editorial", labelEn: "Editorial", hint: "2 große Portrait-Karten mit Bogen", settings: { columns_desktop: 2, image_ratio: "portrait", image_shape: "arch", heading_size: "h1", products_to_show: 2, enable_desktop_slider: false } },
      { id: "slider", label: "Slider", labelEn: "Slider", hint: "Durchblätterbare Reihe", settings: { enable_desktop_slider: true, columns_desktop: 4, products_to_show: 8, image_ratio: "square", heading_size: "h2" } },
    ],
  },
  {
    type: "kollektionen",
    category: "conversion",
    label: "Kategorie-Badges",
    labelEn: "Collection badges",
    desc: "Klickbare Kategorie-Pillen zu deinen Kollektionen.",
    descEn: "Clickable pills linking to your collections.",
    fields: [],
    presets: [
      { id: "mittig", label: "Zentriert", labelEn: "Centered", hint: "Pillen mittig", settings: { alignment: "center" } },
      { id: "links", label: "Linksbündig", labelEn: "Left", hint: "Pillen links", settings: { alignment: "flex-start" } },
      { id: "gross", label: "Groß", labelEn: "Large", hint: "Große, luftige Pillen", settings: { alignment: "center", font_size_desktop: 18, padding_x_desktop: 32, padding_y_desktop: 14 } },
    ],
  },

  // ══ Social Proof ══
  {
    type: "reviews2",
    category: "social",
    label: "Kunden-Bewertungen",
    labelEn: "Customer reviews",
    desc: "Bewertungs-Karten mit Zitaten, Namen und Sternen.",
    descEn: "Review cards with quotes, names and stars.",
    fields: [
      { id: "eyebrow", label: "Eyebrow", labelEn: "Eyebrow", kind: "text", target: { key: "eyebrow" }, def: "Aus der Community" },
      { id: "headline", label: "Überschrift", labelEn: "Headline", kind: "text", target: { key: "headline" }, def: "Echte Stimmen," },
      { id: "headlineEm", label: "Überschrift (Akzent)", labelEn: "Headline (accent)", kind: "text", target: { key: "headline_em" }, def: "echte Ergebnisse." },
      { id: "subline", label: "Untertitel", labelEn: "Subline", kind: "text", target: { key: "subline" }, def: "Unsere Kunden teilen ihre Erfahrungen — ehrlich und ungefiltert." },
    ],
    presets: [
      { id: "hell", label: "Hell", labelEn: "Light", hint: "Weiße Karten auf Seiten-Hintergrund", settings: { color_bg: "@background", color_card: "#ffffff", color_accent: "@accent", color_text: "@text" } },
      { id: "getoent", label: "Getönt", labelEn: "Tinted", hint: "Warm getönter Hintergrund", settings: { color_bg: "#f7f5f2", color_card: "#ffffff", color_accent: "@accent", color_text: "#2a2520" } },
      { id: "dunkel", label: "Dunkel", labelEn: "Dark", hint: "Dunkle Karten, edler Look", settings: { color_bg: "#101014", color_card: "#1a1a20", color_accent: "@accent", color_text: "#f5f5f7" } },
    ],
  },
  {
    type: "reviews",
    category: "social",
    label: "Bewertungs-Übersicht",
    labelEn: "Rating overview",
    desc: "Kategorie-Ratings mit animierten Sterne-Balken.",
    descEn: "Category ratings with animated star bars.",
    fields: [
      { id: "heading", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "heading" }, def: "KUNDEN LIEBEN ES" },
      { id: "subheading", label: "Untertitel", labelEn: "Subheading", kind: "text", target: { key: "subheading" }, def: "Basierend auf tausenden Bewertungen" },
    ],
    presets: [
      { id: "fade", label: "Sanft animiert", labelEn: "Soft fade", hint: "Fade-up beim Scrollen", settings: { animation_type: "fade-up", heading_size: 40, star_color: "@accent" } },
      { id: "gross", label: "Groß & plakativ", labelEn: "Big & bold", hint: "Große Headline, große Sterne", settings: { heading_size: 56, star_size: 26, animation_type: "fade-scale", star_color: "@accent" } },
      { id: "ruhig", label: "Ruhig", labelEn: "Calm", hint: "Ohne Animation, schmal", settings: { animation_type: "none", heading_size: 32, max_width: 760, star_color: "@accent" } },
    ],
  },
  {
    type: "trustpilot",
    category: "social",
    label: "Bewertungs-Marquee",
    labelEn: "Review marquee",
    desc: "Endlos durchlaufende Bewertungs-Karten (Trustpilot-Stil).",
    descEn: "Endlessly scrolling review cards (Trustpilot style).",
    fields: [],
    presets: [
      { id: "flow", label: "Schneller Flow", labelEn: "Fast flow", hint: "Kleine Karten, flotter Lauf", settings: { scroll_speed: 45, card_padding: 10, text_size: 13 }, blocks: trustBlocks() },
      { id: "gross", label: "Groß & ruhig", labelEn: "Large & calm", hint: "Große Karten, langsamer Lauf", settings: { scroll_speed: 22, card_padding: 20, review_image_size: 150, text_size: 15 }, blocks: trustBlocks() },
      { id: "kompakt", label: "Kompakt", labelEn: "Compact", hint: "Dichte, kleine Karten", settings: { scroll_speed: 35, card_padding: 8, review_image_size: 80, text_size: 12 }, blocks: trustBlocks() },
    ],
  },
  {
    type: "vids",
    category: "social",
    label: "Video-Bewertungen",
    labelEn: "Video reviews",
    desc: "Kunden-Videos im Hochformat mit Namen.",
    descEn: "Portrait customer videos with names.",
    fields: [
      { id: "title", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "title" }, def: "Echte Erfahrungen unserer Kunden" },
      { id: "subtitle", label: "Untertitel", labelEn: "Subheading", kind: "text", target: { key: "subtitle" }, def: "Echte Erfahrungen in Bild & Ton" },
    ],
    presets: [
      { id: "hell", label: "Hell", labelEn: "Light", hint: "Auf Seiten-Hintergrund", settings: { bg_color: "@background" } },
      { id: "getoent", label: "Getönt", labelEn: "Tinted", hint: "Sanft abgesetzter Hintergrund", settings: { bg_color: "#f7f5f2" } },
      { id: "dunkel", label: "Dunkel", labelEn: "Dark", hint: "Kino-Look", settings: { bg_color: "#101014" } },
    ],
  },
  {
    type: "socialicons",
    category: "social",
    label: "Social-Leiste",
    labelEn: "Social bar",
    desc: "Folge-uns-Zeile mit Social-Media-Icons.",
    descEn: "Follow-us row with social icons.",
    fields: [{ id: "heading", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "heading" }, def: "Folge uns gerne ❤️" }],
    presets: [
      { id: "mittig", label: "Zentriert", labelEn: "Centered", hint: "Klassisch mittig", settings: { icon_alignment: "center", heading_alignment: "center" } },
      { id: "kompakt", label: "Kompakt", labelEn: "Compact", hint: "Kleine Icons, wenig Abstand", settings: { icon_size: 30, section_padding_top: 24, section_padding_bottom: 24, icon_alignment: "center", heading_alignment: "center" } },
      { id: "gross", label: "Groß", labelEn: "Large", hint: "Große Icons mit Hover-Zoom", settings: { icon_size: 56, hover_scale: 1.3, icon_alignment: "center", heading_alignment: "center" } },
    ],
  },

  // ══ Inhalt & Story ══
  {
    type: "bro-feature-grid",
    category: "content",
    label: "Feature-Grid",
    labelEn: "Feature grid",
    desc: "Icon-Karten mit deinen Produkt-Vorteilen.",
    descEn: "Icon cards with your product benefits.",
    fields: [
      { id: "eyebrow", label: "Eyebrow", labelEn: "Eyebrow", kind: "text", target: { key: "eyebrow" }, def: "Deine Vorteile" },
      { id: "heading", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "heading" }, def: "Was es besonders macht" },
      { id: "subheading", label: "Untertitel", labelEn: "Subheading", kind: "textarea", target: { key: "subheading" }, def: "Durchdacht bis ins Detail — damit du dich auf das Wesentliche konzentrieren kannst." },
    ],
    presets: [
      { id: "icons", label: "Icon-Karten", labelEn: "Icon cards", hint: "3 Spalten, zentriert", settings: { columns_desktop: 3, card_align: "center", icon_size: 32, card_radius: 16, heading_align: "center", accent_color: "@accent" }, blocks: featureBlocks(3) },
      { id: "kacheln", label: "Große Kacheln", labelEn: "Big tiles", hint: "2 Spalten, viel Raum", settings: { columns_desktop: 2, card_padding: 36, card_radius: 20, title_size: 20, heading_align: "left", card_align: "left", accent_color: "@accent" }, blocks: featureBlocks(4) },
      { id: "kompakt", label: "Kompakt-Reihe", labelEn: "Compact row", hint: "4 schlanke Karten", settings: { columns_desktop: 4, card_padding: 16, gap: 12, icon_size: 22, text_size: 13, heading_align: "center", card_align: "center", accent_color: "@accent" }, blocks: featureBlocks(4) },
    ],
  },
  {
    type: "image-with-text",
    category: "content",
    label: "Marken-Story (Bild + Text)",
    labelEn: "Brand story (image + text)",
    desc: "Bild neben Story-Text — die klassische Über-uns-Sektion.",
    descEn: "Image beside story text — the classic about section.",
    fields: [
      { id: "heading", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "heading", blockType: "heading" }, def: "Warum uns tausende vertrauen" },
      { id: "text", label: "Story-Text", labelEn: "Story text", kind: "textarea", target: { key: "text", blockType: "text" }, def: "Wir entwickeln Produkte, die halten, was sie versprechen — fair produziert, sorgfältig getestet und von tausenden Kunden geliebt.", html: true },
      { id: "cta", label: "Button-Text", labelEn: "Button label", kind: "text", target: { key: "button_label", blockType: "button" }, def: "Mehr erfahren" },
    ],
    presets: [
      { id: "split", label: "50/50 Split", labelEn: "50/50 split", hint: "Bild links, Text rechts", settings: { desktop_image_width: "medium", layout: "image_first", height: "adapt", desktop_content_position: "middle", desktop_content_alignment: "left", content_layout: "no-overlap" }, blocks: [{ type: "heading", settings: {} }, { type: "text", settings: {} }, { type: "button", settings: {} }] },
      { id: "overlap", label: "Editorial Overlap", labelEn: "Editorial overlap", hint: "Großes Bild, Text-Karte überlappt", settings: { desktop_image_width: "large", content_layout: "overlap", height: "medium", desktop_content_position: "middle", desktop_content_alignment: "left", layout: "image_first" }, blocks: [{ type: "heading", settings: {} }, { type: "text", settings: {} }, { type: "button", settings: {} }] },
      { id: "zentriert", label: "Minimalist Center", labelEn: "Minimalist center", hint: "Kleines Bild, zentrierter Text", settings: { desktop_image_width: "small", desktop_content_alignment: "center", desktop_content_position: "middle", layout: "text_first", content_layout: "no-overlap", height: "adapt" }, blocks: [{ type: "heading", settings: {} }, { type: "text", settings: {} }] },
    ],
  },
  {
    type: "multicolumn",
    category: "content",
    label: "Spalten-Grid",
    labelEn: "Column grid",
    desc: "Mehrspaltiger Text-Block für Gründe, Werte oder Schritte.",
    descEn: "Multi-column text block for reasons, values or steps.",
    fields: [{ id: "title", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "title" }, def: "Gute Gründe für uns" }],
    presets: [
      { id: "drei", label: "Drei Spalten", labelEn: "Three columns", hint: "Zentriert, luftig", settings: { columns_desktop: 3, column_alignment: "center", background_style: "none", heading_size: "h2" }, blocks: FEATURES.slice(0, 3).map((f) => ({ type: "column", settings: { title: f.title, text: `<p>${f.text}</p>` } })) },
      { id: "karten", label: "Karten", labelEn: "Cards", hint: "Mit Karten-Hintergrund", settings: { columns_desktop: 3, background_style: "primary", column_alignment: "left", heading_size: "h2" }, blocks: FEATURES.slice(0, 3).map((f) => ({ type: "column", settings: { title: f.title, text: `<p>${f.text}</p>` } })) },
      { id: "vier", label: "Vier kompakt", labelEn: "Four compact", hint: "4 schmale Spalten", settings: { columns_desktop: 4, column_alignment: "center", background_style: "none", heading_size: "h2" }, blocks: FEATURES.map((f) => ({ type: "column", settings: { title: f.title, text: `<p>${f.text}</p>` } })) },
    ],
  },
  {
    type: "rich-text",
    category: "content",
    label: "Text-Statement",
    labelEn: "Text statement",
    desc: "Große Aussage in purem Text — wirkt edel und ruhig.",
    descEn: "A big statement in pure text — calm and premium.",
    fields: [
      { id: "heading", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "heading", blockType: "heading" }, def: "Qualität, die man jeden Tag spürt" },
      { id: "text", label: "Text", labelEn: "Text", kind: "textarea", target: { key: "text", blockType: "text" }, def: "Kein Schnickschnack, keine Kompromisse — nur ein Produkt, das seinen Job macht. Jeden Tag.", html: true },
    ],
    presets: [
      { id: "mittig", label: "Zentriert", labelEn: "Centered", hint: "Klassisch mittig", settings: { desktop_content_position: "center", content_alignment: "center", full_width: false }, blocks: [{ type: "heading", settings: {} }, { type: "text", settings: {} }] },
      { id: "links", label: "Linksbündig", labelEn: "Left", hint: "Editorial links", settings: { desktop_content_position: "left", content_alignment: "left", full_width: false }, blocks: [{ type: "heading", settings: {} }, { type: "text", settings: {} }] },
      { id: "breit", label: "Volle Breite", labelEn: "Full width", hint: "Über die ganze Seite", settings: { full_width: true, desktop_content_position: "center", content_alignment: "center" }, blocks: [{ type: "heading", settings: {} }, { type: "text", settings: {} }] },
    ],
  },

  // ══ Bild & Video ══
  {
    type: "scrollingbild",
    category: "media",
    label: "Parallax-Bild",
    labelEn: "Parallax image",
    desc: "Großes Scroll-Bild mit Headline — starker visueller Break.",
    descEn: "Large scrolling image with headline — strong visual break.",
    fields: [
      { id: "eyebrow", label: "Eyebrow", labelEn: "Eyebrow", kind: "text", target: { key: "eyebrow_text" }, def: "Erlebe den Unterschied" },
      { id: "line1", label: "Headline Zeile 1", labelEn: "Headline line 1", kind: "text", target: { key: "headline_line_1" }, def: "Gemacht für" },
      { id: "line2", label: "Headline Zeile 2", labelEn: "Headline line 2", kind: "text", target: { key: "headline_line_2" }, def: "deinen Alltag." },
    ],
    presets: [
      { id: "vollbild", label: "Vollbild", labelEn: "Full screen", hint: "Bild füllt den Viewport", settings: { size_mode: "viewport", desktop_height: 90, overlay_style: "bottom", corner_radius: 0, side_margin: 0 } },
      { id: "kino", label: "Kino 21:9", labelEn: "Cinema 21:9", hint: "Breites Kinoformat", settings: { size_mode: "ratio", aspect_desktop: "21 / 9", corner_radius: 0, side_margin: 0, overlay_style: "full", overlay_opacity: 45 } },
      { id: "karte", label: "Karten-Bild", labelEn: "Card image", hint: "Abgerundet mit Rand", settings: { size_mode: "ratio", aspect_desktop: "16 / 9", corner_radius: 28, side_margin: 48, overlay_style: "radial" } },
    ],
  },
  {
    type: "collage",
    category: "media",
    label: "Collage-Grid",
    labelEn: "Collage grid",
    desc: "Asymmetrisches Bild-Raster (Bilder wählst du in Shopify).",
    descEn: "Asymmetric image grid (pick images in Shopify).",
    fields: [{ id: "heading", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "heading" }, def: "Ein Blick ins Detail" }],
    presets: [
      { id: "links", label: "Groß links", labelEn: "Big left", hint: "Großes Bild links", settings: { desktop_layout: "left", card_styles: "none", heading_size: "h2" }, blocks: [{ type: "image", settings: {} }, { type: "image", settings: {} }, { type: "image", settings: {} }] },
      { id: "rechts", label: "Groß rechts", labelEn: "Big right", hint: "Großes Bild rechts", settings: { desktop_layout: "right", card_styles: "none", heading_size: "h2" }, blocks: [{ type: "image", settings: {} }, { type: "image", settings: {} }, { type: "image", settings: {} }] },
      { id: "karten", label: "Karten-Stil", labelEn: "Card style", hint: "Mit Karten-Rahmen", settings: { desktop_layout: "left", card_styles: "product-card-wrapper", heading_size: "h2" }, blocks: [{ type: "image", settings: {} }, { type: "image", settings: {} }, { type: "image", settings: {} }] },
    ],
  },
  {
    type: "video",
    category: "media",
    label: "Video-Sektion",
    labelEn: "Video section",
    desc: "YouTube/Vimeo-Video mit Überschrift.",
    descEn: "YouTube/Vimeo video with heading.",
    fields: [
      { id: "heading", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "heading" }, def: "Sieh es in Aktion" },
      { id: "videoUrl", label: "YouTube-Link", labelEn: "YouTube link", kind: "text", target: { key: "video_url" }, def: "" },
    ],
    presets: [
      { id: "standard", label: "Standard", labelEn: "Standard", hint: "Im Seitenraster", settings: { full_width: false, heading_size: "h2" } },
      { id: "vollbreit", label: "Vollbreit", labelEn: "Full width", hint: "Über die ganze Seite", settings: { full_width: true, heading_size: "h1" } },
    ],
  },
  {
    type: "animatedtext",
    category: "media",
    label: "Lauftext-Highlight",
    labelEn: "Marquee highlight",
    desc: "Animierter Text-Marquee mit Icon — lebendiger Akzent.",
    descEn: "Animated text marquee with icon — lively accent.",
    fields: [
      { id: "subtitle", label: "Eyebrow", labelEn: "Eyebrow", kind: "text", target: { key: "subtitle" }, def: "Von Kunden geliebt" },
      { id: "title", label: "Titel", labelEn: "Title", kind: "text", target: { key: "title" }, def: "Überzeugt auf ganzer Linie" },
      { id: "text", label: "Lauftext", labelEn: "Marquee text", kind: "text", target: { key: "text" }, def: "Premium-Qualität • Schneller Versand • 30 Tage Garantie" },
    ],
    presets: [
      { id: "stern", label: "Stern", labelEn: "Star", hint: "Mit Stern-Icon", settings: { icon_choice: "star", underline_color: "@accent" } },
      { id: "herz", label: "Herz", labelEn: "Heart", hint: "Mit Herz-Icon", settings: { icon_choice: "heart", underline_color: "@accent" } },
    ],
  },

  // ══ Infos & FAQ ══
  {
    type: "qanda",
    category: "info",
    label: "FAQ (Premium)",
    labelEn: "FAQ (premium)",
    desc: "Aufklappbare Fragen im Glas-Look — nimmt Kaufzweifel.",
    descEn: "Collapsible questions in a glass look — removes doubts.",
    fields: [
      { id: "title", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "title" }, def: "Häufige Fragen" },
      { id: "subtitle", label: "Untertitel", labelEn: "Subheading", kind: "text", target: { key: "subtitle" }, def: "Alles, was du wissen musst" },
      { id: "q1", label: "Frage 1", labelEn: "Question 1", kind: "text", target: { key: "question", blockType: "faq", index: 0 }, def: FAQ_ROWS[0].q },
      { id: "a1", label: "Antwort 1", labelEn: "Answer 1", kind: "textarea", target: { key: "answer", blockType: "faq", index: 0 }, def: "Wir versenden innerhalb von 24 Stunden — die Lieferung dauert in der Regel 1–3 Werktage.", html: true },
      { id: "q2", label: "Frage 2", labelEn: "Question 2", kind: "text", target: { key: "question", blockType: "faq", index: 1 }, def: FAQ_ROWS[1].q },
      { id: "a2", label: "Antwort 2", labelEn: "Answer 2", kind: "textarea", target: { key: "answer", blockType: "faq", index: 1 }, def: "Ja, du hast 30 Tage Zeit. Geld-zurück-Garantie ohne Wenn und Aber.", html: true },
      { id: "q3", label: "Frage 3", labelEn: "Question 3", kind: "text", target: { key: "question", blockType: "faq", index: 2 }, def: FAQ_ROWS[2].q },
      { id: "a3", label: "Antwort 3", labelEn: "Answer 3", kind: "textarea", target: { key: "answer", blockType: "faq", index: 2 }, def: "Absolut. Alle Zahlungen laufen SSL-verschlüsselt über PayPal, Klarna oder Kreditkarte.", html: true },
      { id: "q4", label: "Frage 4", labelEn: "Question 4", kind: "text", target: { key: "question", blockType: "faq", index: 3 }, def: FAQ_ROWS[3].q },
      { id: "a4", label: "Antwort 4", labelEn: "Answer 4", kind: "textarea", target: { key: "answer", blockType: "faq", index: 3 }, def: "Unser Support antwortet dir innerhalb von 24 Stunden — schreib uns einfach.", html: true },
    ],
    presets: [
      { id: "glass", label: "Glass", labelEn: "Glass", hint: "Glas-Karten, eine offen", settings: { auto_close: true, icon_color: "@accent" }, blocks: faqBlocks() },
      { id: "offen", label: "Alle offen", labelEn: "All open", hint: "Mehrere gleichzeitig offen", settings: { auto_close: false, icon_color: "@accent" }, blocks: faqBlocks() },
      { id: "kompakt", label: "Kompakt", labelEn: "Compact", hint: "Wenig Abstand", settings: { auto_close: true, padding_top: 32, padding_bottom: 32, icon_color: "@accent" }, blocks: faqBlocks() },
    ],
  },
  {
    type: "collapsible-content",
    category: "info",
    label: "Aufklapp-Inhalte",
    labelEn: "Collapsible content",
    desc: "Klassische Aufklapp-Reihen für Details & Pflegehinweise.",
    descEn: "Classic collapsible rows for details & care info.",
    fields: [{ id: "heading", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "heading" }, def: "Gut zu wissen" }],
    presets: [
      { id: "reihen", label: "Reihen", labelEn: "Rows", hint: "Einzelne Reihen-Karten", settings: { layout: "row", heading_alignment: "center", open_first_collapsible_row: true }, blocks: FAQ_ROWS.map((r) => ({ type: "collapsible_row", settings: { heading: r.q, row_content: r.a } })) },
      { id: "sektion", label: "Sektion", labelEn: "Section", hint: "Als zusammenhängender Block", settings: { layout: "section", heading_alignment: "center", open_first_collapsible_row: false }, blocks: FAQ_ROWS.map((r) => ({ type: "collapsible_row", settings: { heading: r.q, row_content: r.a } })) },
      { id: "schlicht", label: "Schlicht", labelEn: "Plain", hint: "Ohne Rahmen", settings: { layout: "none", heading_alignment: "left", open_first_collapsible_row: false }, blocks: FAQ_ROWS.map((r) => ({ type: "collapsible_row", settings: { heading: r.q, row_content: r.a } })) },
    ],
  },
  {
    type: "bro-info-tabs",
    category: "info",
    label: "Produktdetails (Tabs)",
    labelEn: "Product details (tabs)",
    desc: "Tab-Bereich mit Beschreibung, Versand & Garantie.",
    descEn: "Tabbed area with description, shipping & warranty.",
    fields: [{ id: "heading", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "heading" }, def: "Mehr über das Produkt" }],
    presets: [
      { id: "mittig", label: "Zentriert", labelEn: "Centered", hint: "Tabs mittig", settings: { heading_align: "center", tab_align: "center", accent_color: "@accent" } },
      { id: "links", label: "Linksbündig", labelEn: "Left", hint: "Editorial links", settings: { heading_align: "left", tab_align: "flex-start", accent_color: "@accent" } },
      { id: "karte", label: "Große Karte", labelEn: "Big card", hint: "Runder Container, viel Innenraum", settings: { container_radius: 22, panel_padding: 36, heading_align: "center", tab_align: "center", accent_color: "@accent" } },
    ],
  },

  // ══ Startseiten-Sections (auch auf der Produktseite einsetzbar) ══
  {
    type: "slideshow2",
    category: "media",
    label: "Hero-Slider",
    labelEn: "Hero slider",
    desc: "Großer Startseiten-Slider mit Headline, Untertitel & Button.",
    descEn: "Big homepage slider with headline, subheading & button.",
    fields: [
      { id: "heading", label: "Headline (Slide 1)", labelEn: "Headline (slide 1)", kind: "textarea", target: { key: "heading", blockType: "slide", index: 0 }, def: "Spürbar besser — ab dem ersten Tag" },
      { id: "subheading", label: "Untertitel (Slide 1)", labelEn: "Subheading (slide 1)", kind: "text", target: { key: "subheading", blockType: "slide", index: 0 }, def: "Der einfache Weg zu einem Ergebnis, das du wirklich merkst." },
      { id: "cta", label: "Button-Text (Slide 1)", labelEn: "Button label (slide 1)", kind: "text", target: { key: "btn_text", blockType: "slide", index: 0 }, def: "JETZT SICHERN" },
    ],
    presets: [
      { id: "vollbild", label: "Vollbild", labelEn: "Full bleed", hint: "Kantenlos über die volle Breite", settings: { full_width: true, corner_radius: 0, height_desktop: 700, dot_active: "@accent" }, blocks: [{ type: "slide", settings: { btn_bg_color: "@button", btn_text_color: "@buttonText" } }] },
      { id: "karte", label: "Karten-Hero", labelEn: "Card hero", hint: "Abgerundet mit Rand", settings: { full_width: false, corner_radius: 30, height_desktop: 560, dot_active: "@accent" }, blocks: [{ type: "slide", settings: { btn_bg_color: "@button", btn_text_color: "@buttonText" } }] },
      { id: "kompakt", label: "Kompakt", labelEn: "Compact", hint: "Niedriger, ruhiger Einstieg", settings: { full_width: false, corner_radius: 16, height_desktop: 480, height_mobile: 460, dot_active: "@accent" }, blocks: [{ type: "slide", settings: { btn_bg_color: "@button", btn_text_color: "@buttonText" } }] },
    ],
  },
  {
    type: "benefits",
    category: "content",
    label: "Vorteil-Banner",
    labelEn: "Benefit banner",
    desc: "Zwei kompakte Vorteile nebeneinander (Versand, Bezahlung …).",
    descEn: "Two compact benefits side by side (shipping, payment …).",
    fields: [
      { id: "title1", label: "Vorteil 1 — Titel", labelEn: "Benefit 1 — title", kind: "text", target: { key: "title_1" }, def: "Bequem auf Rechnung" },
      { id: "text1", label: "Vorteil 1 — Text", labelEn: "Benefit 1 — text", kind: "text", target: { key: "text_1" }, def: "Bezahle entspannt mit PayPal oder Klarna." },
      { id: "title2", label: "Vorteil 2 — Titel", labelEn: "Benefit 2 — title", kind: "text", target: { key: "title_2" }, def: "Schneller DHL-Versand" },
      { id: "text2", label: "Vorteil 2 — Text", labelEn: "Benefit 2 — text", kind: "text", target: { key: "text_2" }, def: "Dein Paket ist in 1–3 Tagen bei dir Zuhause." },
    ],
    presets: [
      { id: "standard", label: "Standard", labelEn: "Standard", hint: "Kompakte Leiste", settings: { padding_vertical: 20 } },
      { id: "luftig", label: "Luftig", labelEn: "Airy", hint: "Mehr Abstand", settings: { padding_vertical: 48 } },
    ],
  },
  {
    type: "photo",
    category: "content",
    label: "Foto-Kollage + Text",
    labelEn: "Photo collage + text",
    desc: "Drei Bilder mit Story-Text und Button.",
    descEn: "Three images with story text and a button.",
    fields: [
      { id: "subtitle", label: "Eyebrow", labelEn: "Eyebrow", kind: "text", target: { key: "subtitle" }, def: "Unsere Marke" },
      { id: "title", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "title" }, def: "Gemacht für deinen Alltag" },
      { id: "description", label: "Text", labelEn: "Text", kind: "textarea", target: { key: "description" }, def: "Einfach, zuverlässig und durchdacht bis ins Detail — damit du dich auf das Wesentliche konzentrieren kannst.", html: true },
      { id: "cta", label: "Button-Text", labelEn: "Button label", kind: "text", target: { key: "button_label" }, def: "JETZT ENTDECKEN" },
    ],
    presets: [
      { id: "hell", label: "Hell", labelEn: "Light", hint: "Auf Seiten-Hintergrund", settings: { bg_color: "@background", btn_bg_color: "@button", btn_text_color: "@buttonText" } },
      { id: "getoent", label: "Getönt", labelEn: "Tinted", hint: "Sanft abgesetzt", settings: { bg_color: "#f7f5f2", btn_bg_color: "@button", btn_text_color: "@buttonText" } },
    ],
  },
  {
    type: "map",
    category: "info",
    label: "Standort & Kontakt",
    labelEn: "Location & contact",
    desc: "Karten-Sektion mit Adresse und Kontakt-Button.",
    descEn: "Map section with address and contact button.",
    fields: [
      { id: "subtitle", label: "Eyebrow", labelEn: "Eyebrow", kind: "text", target: { key: "subtitle" }, def: "Besuche uns" },
      { id: "title", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "title" }, def: "Unser Standort" },
      { id: "text", label: "Text", labelEn: "Text", kind: "textarea", target: { key: "text" }, def: "Wir sind für dich da — bei Fragen melde dich jederzeit gerne bei uns.", html: true },
      { id: "address", label: "Adresse", labelEn: "Address", kind: "text", target: { key: "address" }, def: "Berlin, Germany" },
      { id: "cta", label: "Button-Text", labelEn: "Button label", kind: "text", target: { key: "btn_label" }, def: "Route planen" },
    ],
    presets: [
      { id: "rechts", label: "Karte rechts", labelEn: "Map right", hint: "Text links, Karte rechts", settings: { layout: "map_right", map_filter: "grayscale", pin_color: "@accent", btn_bg_color: "@button", btn_text_color: "@buttonText" } },
      { id: "links", label: "Karte links", labelEn: "Map left", hint: "Karte links, Text rechts", settings: { layout: "map_left", map_filter: "grayscale", pin_color: "@accent", btn_bg_color: "@button", btn_text_color: "@buttonText" } },
      { id: "dunkel", label: "Dunkler Filter", labelEn: "Dark filter", hint: "Karte im Dark-Look", settings: { layout: "map_right", map_filter: "dark", pin_color: "@accent", btn_bg_color: "@button", btn_text_color: "@buttonText" } },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────
// KAUFBOX-BLOCK-BIBLIOTHEK — Style-Arten + Texte für die Bausteine der
// main-product-Infospalte (neben dem Produktbild). Alle Keys/Werte sind
// gegen den {% schema %}-Block von sections/main-product.liquid verifiziert.
// Preset-Werte "@rolle" werden gegen die Palette aufgelöst.
//
// WICHTIG (Compile-Regel): Nutzer-Texte überschreiben IMMER; Feld-Defaults
// füllen nur LEERE Settings — KI-Verkaufstexte (Copy-Bindings, z. B. die
// PRODUCT_USP_* in der Vorteile-Liste) bleiben sonst unangetastet.
// ─────────────────────────────────────────────────────────────────

export interface BuyboxBlockLib {
  type: string;
  fields: FieldDef[]; // target.key = Block-Setting-Key
  presets: PresetDef[];
}

export const BUYBOX_LIBRARY: BuyboxBlockLib[] = [
  {
    type: "sale_banner",
    fields: [
      { id: "text", label: "Banner-Text", labelEn: "Banner text", kind: "text", target: { key: "text" }, def: "SALE – Nur für kurze Zeit" },
      { id: "emoji", label: "Emoji", labelEn: "Emoji", kind: "text", target: { key: "emoji" }, def: "🔥" },
    ],
    presets: [
      { id: "akzent", label: "Akzent", labelEn: "Accent", hint: "Voll in deiner Akzentfarbe", settings: { bg: "@accent", t_color: "#ffffff", radius: 12, b_width: 0 } },
      { id: "dunkel", label: "Dunkel", labelEn: "Dark", hint: "Schwarzer Balken", settings: { bg: "#111111", t_color: "#ffffff", radius: 12, b_width: 0 } },
      { id: "umriss", label: "Umriss", labelEn: "Outline", hint: "Weiß mit Akzent-Rahmen", settings: { bg: "#ffffff", t_color: "@text", b_color: "@accent", b_width: 2, radius: 12 } },
    ],
  },
  {
    type: "urgency_text",
    fields: [{ id: "text_prefix", label: "Hinweis-Text", labelEn: "Urgency text", kind: "text", target: { key: "text_prefix" }, def: "Angebot endet am" }],
    presets: [
      { id: "auffaellig", label: "Auffällig", labelEn: "Bold", hint: "Fett, linksbündig", settings: { is_bold: true, font_size: 15, alignment: "left" } },
      { id: "zentriert", label: "Zentriert", labelEn: "Centered", hint: "Mittig, fett", settings: { alignment: "center", is_bold: true } },
      { id: "dezent", label: "Dezent", labelEn: "Subtle", hint: "Klein und ruhig", settings: { is_bold: false, font_size: 13, alignment: "left" } },
    ],
  },
  {
    type: "custom_title",
    fields: [],
    presets: [
      { id: "gross", label: "Groß & fett", labelEn: "Big & bold", hint: "34 px, linksbündig", settings: { font_size_desktop: 34, font_weight: "800", alignment: "left" } },
      { id: "zentriert", label: "Zentriert", labelEn: "Centered", hint: "Mittig, mittleres Gewicht", settings: { alignment: "center", font_size_desktop: 30, font_weight: "600" } },
      { id: "kompakt", label: "Kompakt", labelEn: "Compact", hint: "24 px, dicht", settings: { font_size_desktop: 24, font_weight: "800", alignment: "left" } },
    ],
  },
  {
    type: "custom_rating",
    fields: [{ id: "rating_text", label: "Bewertungs-Text", labelEn: "Rating text", kind: "text", target: { key: "rating_text" }, def: "" }],
    presets: [
      { id: "klassisch", label: "Klassisch", labelEn: "Classic", hint: "Gefüllte Sterne zuerst", settings: { star_shape: "classic", star_style: "filled", layout_style: "stars_first", star_color: "@accent" } },
      { id: "pill", label: "Pill", labelEn: "Pill", hint: "Kompakte Kapsel mit Zahl", settings: { layout_style: "compact_pill", pill_bg: true, star_shape: "rounded", star_color: "@accent" } },
      { id: "glow", label: "Glow", labelEn: "Glow", hint: "Funkelnde Sterne, animiert", settings: { star_style: "glow", star_shape: "sparkle", animate_on_view: true, star_color: "@accent" } },
    ],
  },
  {
    type: "benefits_list",
    fields: [
      { id: "text_1", label: "Vorteil 1", labelEn: "Benefit 1", kind: "text", target: { key: "text_1" }, def: "" },
      { id: "text_2", label: "Vorteil 2", labelEn: "Benefit 2", kind: "text", target: { key: "text_2" }, def: "" },
      { id: "text_3", label: "Vorteil 3", labelEn: "Benefit 3", kind: "text", target: { key: "text_3" }, def: "" },
      { id: "text_4", label: "Vorteil 4", labelEn: "Benefit 4", kind: "text", target: { key: "text_4" }, def: "" },
    ],
    presets: [
      { id: "dunkel", label: "Dunkle Kreise", labelEn: "Dark circles", hint: "Icons in dunklen Kreisen", settings: { icon_style: "dark_circle" } },
      { id: "akzent", label: "Akzent-Kreise", labelEn: "Accent circles", hint: "Icons auf Akzentfarbe", settings: { icon_style: "accent_circle", icon_bg: "@accent", icon_color: "#ffffff" } },
      { id: "soft", label: "Soft", labelEn: "Soft", hint: "Sanft getönte Kreise", settings: { icon_style: "soft_circle", icon_color: "@accent" } },
      { id: "umriss", label: "Umriss", labelEn: "Outline", hint: "Nur Icon-Umrisse", settings: { icon_style: "outlined", icon_color: "@accent" } },
    ],
  },
  {
    type: "stock_indicator",
    fields: [{ id: "text", label: "Lager-Text", labelEn: "Stock text", kind: "text", target: { key: "text" }, def: "" }],
    presets: [
      { id: "puls", label: "Pulsierend", labelEn: "Pulse", hint: "Grüner Puls-Punkt", settings: {} },
      { id: "zentriert", label: "Zentriert", labelEn: "Centered", hint: "Mittig", settings: { alignment: "center" } },
      { id: "fett", label: "Fett", labelEn: "Bold", hint: "Größer und fetter", settings: { font_weight: "800", font_size: 15 } },
    ],
  },
  {
    type: "custom_price",
    fields: [],
    presets: [
      { id: "gross", label: "Groß + Badge", labelEn: "Big + badge", hint: "34 px, Rabatt-Badge", settings: { price_size_desk: 34, price_weight: "800", show_compare: true, show_badge: true, badge_bg: "@accent", badge_text: "#ffffff" } },
      { id: "schlicht", label: "Schlicht", labelEn: "Plain", hint: "Ohne Badge", settings: { price_size_desk: 28, price_weight: "600", show_compare: true, show_badge: false } },
      { id: "zentriert", label: "Zentriert", labelEn: "Centered", hint: "Mittig mit Badge", settings: { alignment: "center", show_badge: true, badge_bg: "@accent", badge_text: "#ffffff" } },
    ],
  },
  {
    type: "bundle_selector",
    fields: [{ id: "heading", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "heading" }, def: "" }],
    presets: [
      { id: "modern", label: "Modern", labelEn: "Modern", hint: "Bilder + Ersparnis", settings: { card_style: "modern", show_image: true, show_savings: true, show_per_unit: true, active_border: "@accent" } },
      { id: "soft", label: "Soft", labelEn: "Soft", hint: "Runde, weiche Karten", settings: { card_style: "soft", card_radius: 18, show_image: true, active_border: "@accent" } },
      { id: "umriss", label: "Umriss", labelEn: "Outline", hint: "Schlank ohne Bilder", settings: { card_style: "outlined", show_image: false, active_border: "@accent" } },
      { id: "klassisch", label: "Klassisch", labelEn: "Classic", hint: "Reduzierte Reihen", settings: { card_style: "classic", show_image: false, show_qty_chip: false } },
    ],
  },
  {
    type: "buy_buttons",
    fields: [
      { id: "add_to_cart_text", label: "Button-Text", labelEn: "Button label", kind: "text", target: { key: "add_to_cart_text" }, def: "" },
      { id: "subtext", label: "Trust-Zeile (unter dem Button)", labelEn: "Trust line (below button)", kind: "text", target: { key: "subtext" }, def: "Sichere Bezahlung · 30 Tage Rückgaberecht" },
    ],
    presets: [
      { id: "klassisch", label: "Klassisch", labelEn: "Classic", hint: "Ein großer Kaufen-Button", settings: { layout: "layout1", cart_size: "lg", cart_icon: "cart", cart_icon_position: "left", btn_shape: "round", primary_bg: "@button", primary_fg: "@buttonText" } },
      { id: "xl", label: "XL", labelEn: "XL", hint: "Extra groß, Plus-Icon", settings: { layout: "layout1", cart_size: "xl", cart_text_size: "big", cart_text_weight: "extra", cart_icon: "plus", btn_shape: "round", primary_bg: "@button", primary_fg: "@buttonText" } },
      { id: "pill", label: "Pill (rund)", labelEn: "Pill (round)", hint: "Vollrunder Button", settings: { layout: "layout1", cart_size: "lg", cart_icon: "cart", btn_shape: "pill", primary_bg: "@button", primary_fg: "@buttonText" } },
      { id: "kantig", label: "Kantig", labelEn: "Sharp", hint: "Ohne runde Ecken", settings: { layout: "layout1", cart_size: "lg", cart_icon: "none", btn_shape: "sharp", primary_bg: "@button", primary_fg: "@buttonText" } },
      { id: "akzent", label: "Akzent-Button", labelEn: "Accent button", hint: "In deiner Akzentfarbe", settings: { layout: "layout1", cart_size: "xl", cart_icon: "cart", btn_shape: "round", primary_bg: "@accent", primary_fg: "#ffffff" } },
      { id: "combo", label: "Express-Combo", labelEn: "Express combo", hint: "Kaufen + PayPal/Klarna-Split", settings: { layout: "layout2", combo_left_brand: "paypal", combo_right_brand: "klarna", combo_divider: "diagonal", btn_shape: "round", primary_bg: "@button", primary_fg: "@buttonText" } },
    ],
  },
  {
    type: "payment_icons",
    fields: [{ id: "heading", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "heading" }, def: "" }],
    presets: [
      { id: "mittig", label: "Zentriert", labelEn: "Centered", hint: "Mittig, Standardgröße", settings: { alignment: "center", icon_width: 44 } },
      { id: "gross", label: "Groß", labelEn: "Large", hint: "Große Logos", settings: { alignment: "center", icon_width: 56, icon_gap: 12 } },
      { id: "links", label: "Kompakt links", labelEn: "Compact left", hint: "Klein, linksbündig", settings: { alignment: "flex-start", icon_width: 34 } },
    ],
  },
  {
    type: "free_gift",
    fields: [
      { id: "title", label: "Titel", labelEn: "Title", kind: "text", target: { key: "title" }, def: "" },
      { id: "subtitle", label: "Untertitel", labelEn: "Subtitle", kind: "text", target: { key: "subtitle" }, def: "" },
    ],
    presets: [
      { id: "accordion", label: "Accordion", labelEn: "Accordion", hint: "Aufklappbar, offen", settings: { enable_accordion: true, open_by_default: true, accent_color: "@accent" } },
      { id: "offen", label: "Immer offen", labelEn: "Always open", hint: "Ohne Aufklappen", settings: { enable_accordion: false, ui_style: "button", accent_color: "@accent" } },
      { id: "checkbox", label: "Checkbox", labelEn: "Checkbox", hint: "Auswahl per Häkchen", settings: { enable_accordion: false, ui_style: "checkbox", accent_color: "@accent" } },
    ],
  },
  {
    type: "delivery_timeline",
    fields: [
      { id: "label_1", label: "Schritt 1", labelEn: "Step 1", kind: "text", target: { key: "label_1" }, def: "" },
      { id: "label_2", label: "Schritt 2", labelEn: "Step 2", kind: "text", target: { key: "label_2" }, def: "" },
      { id: "label_3", label: "Schritt 3", labelEn: "Step 3", kind: "text", target: { key: "label_3" }, def: "" },
    ],
    presets: [
      { id: "gefuellt", label: "Gefüllt", labelEn: "Filled", hint: "Akzent-Kreise", settings: { circle_style: "filled", circle_bg: "@accent", icon_color: "#ffffff", countdown_color: "@accent" } },
      { id: "umriss", label: "Umriss", labelEn: "Outline", hint: "Nur Kreis-Linien", settings: { circle_style: "outlined", circle_border: "@accent", icon_color: "@accent", countdown_color: "@accent" } },
      { id: "kompakt", label: "Kompakt", labelEn: "Compact", hint: "Kleinere Kreise", settings: { circle_size: 44, circle_style: "filled", circle_bg: "@accent", icon_color: "#ffffff" } },
    ],
  },
  {
    type: "feature_box",
    fields: [
      { id: "title_1", label: "Box 1 — Titel", labelEn: "Box 1 title", kind: "text", target: { key: "title_1" }, def: "Premium-Qualität" },
      { id: "text_1", label: "Box 1 — Text", labelEn: "Box 1 text", kind: "text", target: { key: "text_1" }, def: "Sorgfältig geprüft" },
      { id: "title_2", label: "Box 2 — Titel", labelEn: "Box 2 title", kind: "text", target: { key: "title_2" }, def: "Blitzversand" },
      { id: "text_2", label: "Box 2 — Text", labelEn: "Box 2 text", kind: "text", target: { key: "text_2" }, def: "In 1–3 Werktagen" },
      { id: "title_3", label: "Box 3 — Titel", labelEn: "Box 3 title", kind: "text", target: { key: "title_3" }, def: "30 Tage Garantie" },
      { id: "text_3", label: "Box 3 — Text", labelEn: "Box 3 text", kind: "text", target: { key: "text_3" }, def: "Geld zurück" },
    ],
    presets: [
      { id: "glass", label: "Glass", labelEn: "Glass", hint: "Glas-Karten, 3 Spalten", settings: { card_style: "glass", columns: 3, accent_color: "@accent" } },
      { id: "elevated", label: "Schwebend", labelEn: "Elevated", hint: "Mit Schatten", settings: { card_style: "elevated", columns: 3, accent_color: "@accent" } },
      { id: "flach", label: "Flach 2er", labelEn: "Flat 2-col", hint: "2 flache Spalten", settings: { card_style: "flat", columns: 2, accent_color: "@accent" } },
      { id: "umriss", label: "Umriss", labelEn: "Outline", hint: "Akzent-Rahmen", settings: { card_style: "outlined", columns: 3, accent_color: "@accent", card_border: "@accent" } },
    ],
  },
  {
    type: "icon-with-text",
    fields: [
      { id: "heading_1", label: "Punkt 1", labelEn: "Item 1", kind: "text", target: { key: "heading_1" }, def: "Schneller Versand" },
      { id: "heading_2", label: "Punkt 2", labelEn: "Item 2", kind: "text", target: { key: "heading_2" }, def: "Einfache Rückgabe" },
      { id: "heading_3", label: "Punkt 3", labelEn: "Item 3", kind: "text", target: { key: "heading_3" }, def: "Sichere Zahlung" },
    ],
    presets: [
      { id: "reihe", label: "Reihe", labelEn: "Row", hint: "Nebeneinander", settings: { layout: "horizontal", icon_1: "truck", icon_2: "return", icon_3: "lock" } },
      { id: "spalten", label: "Untereinander", labelEn: "Stacked", hint: "Vertikal gestapelt", settings: { layout: "vertical", icon_1: "heart", icon_2: "leaf", icon_3: "star" } },
    ],
  },
  {
    type: "custom_accordion",
    fields: [
      { id: "heading", label: "Titel", labelEn: "Heading", kind: "text", target: { key: "heading" }, def: "Versand & Rückgabe" },
      { id: "content", label: "Inhalt", labelEn: "Content", kind: "textarea", target: { key: "content" }, def: "Versand in 1–3 Werktagen mit Sendungsverfolgung. 30 Tage Geld-zurück-Garantie.", html: true },
    ],
    presets: [
      { id: "info", label: "Info", labelEn: "Info", hint: "Mit Info-Icon", settings: { icon: "info" } },
      { id: "versand", label: "Versand", labelEn: "Shipping", hint: "Mit LKW-Icon", settings: { icon: "truck" } },
      { id: "garantie", label: "Garantie", labelEn: "Warranty", hint: "Mit Schild-Icon", settings: { icon: "shield" } },
    ],
  },
  {
    type: "collapsible_tab",
    fields: [
      { id: "heading", label: "Titel", labelEn: "Heading", kind: "text", target: { key: "heading" }, def: "Details & Pflege" },
      { id: "content", label: "Inhalt", labelEn: "Content", kind: "textarea", target: { key: "content" }, def: "Hochwertige Materialien, einfache Pflege — entwickelt für den täglichen Einsatz.", html: true },
    ],
    presets: [
      { id: "frage", label: "Frage", labelEn: "Question", hint: "Fragezeichen-Icon", settings: { icon: "question_mark" } },
      { id: "versand", label: "Versand", labelEn: "Shipping", hint: "LKW-Icon", settings: { icon: "truck" } },
      { id: "pflege", label: "Pflege", labelEn: "Care", hint: "Wasch-Icon", settings: { icon: "washing" } },
    ],
  },
  {
    type: "complementary",
    fields: [{ id: "block_heading", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "block_heading" }, def: "Passt perfekt dazu" }],
    presets: [
      { id: "reihe", label: "Offene Reihe", labelEn: "Open row", hint: "Produkte direkt sichtbar", settings: { make_collapsible_row: false, products_per_page: 2, image_ratio: "square", enable_quick_add: true } },
      { id: "aufklappbar", label: "Aufklappbar", labelEn: "Collapsible", hint: "Als Klapp-Reihe", settings: { make_collapsible_row: true, icon: "price_tag", products_per_page: 2 } },
    ],
  },
  {
    type: "text",
    fields: [{ id: "text", label: "Text", labelEn: "Text", kind: "textarea", target: { key: "text" }, def: "Handgefertigt, sorgfältig geprüft und mit Liebe zum Detail." }],
    presets: [
      { id: "body", label: "Fließtext", labelEn: "Body", hint: "Normaler Text", settings: { text_style: "body" } },
      { id: "untertitel", label: "Untertitel", labelEn: "Subtitle", hint: "Subtitle-Stil", settings: { text_style: "subtitle" } },
      { id: "gross", label: "Großbuchstaben", labelEn: "Uppercase", hint: "Uppercase-Stil", settings: { text_style: "uppercase" } },
    ],
  },
  { type: "share", fields: [{ id: "share_label", label: "Label", labelEn: "Label", kind: "text", target: { key: "share_label" }, def: "Teilen" }], presets: [] },
  { type: "description", fields: [], presets: [] },
  { type: "variant_picker", fields: [], presets: [] },
  { type: "quantity_selector", fields: [], presets: [] },
  { type: "custom_divider", fields: [], presets: [] },

  // ── NEU: nur Runtime-gerendert (kein echter Liquid-Blocktyp) ──
  {
    type: "trust_badges",
    fields: [
      { id: "label_1", label: "Badge 1", labelEn: "Badge 1", kind: "text", target: { key: "label_1" }, def: "Gratis Versand" },
      { id: "label_2", label: "Badge 2", labelEn: "Badge 2", kind: "text", target: { key: "label_2" }, def: "30 Tage Rückgabe" },
      { id: "label_3", label: "Badge 3", labelEn: "Badge 3", kind: "text", target: { key: "label_3" }, def: "Sicher bezahlen" },
      { id: "label_4", label: "Badge 4", labelEn: "Badge 4", kind: "text", target: { key: "label_4" }, def: "Top bewertet" },
    ],
    presets: [
      { id: "boxen", label: "Karten", labelEn: "Cards", hint: "Umrandete Badge-Karten", settings: { style: "cards", accent: "@accent" } },
      { id: "schlicht", label: "Schlicht", labelEn: "Plain", hint: "Nur Icons + Text", settings: { style: "plain", accent: "@accent" } },
      { id: "streifen", label: "Streifen", labelEn: "Strip", hint: "Getönter Balken", settings: { style: "strip", accent: "@accent" } },
    ],
  },
  {
    type: "stock_bar",
    fields: [
      { id: "text", label: "Text", labelEn: "Text", kind: "text", target: { key: "text" }, def: "Fast ausverkauft — nur noch wenige verfügbar" },
      { id: "left", label: "Restanzahl", labelEn: "Units left", kind: "text", target: { key: "left" }, def: "8" },
    ],
    presets: [
      { id: "dringend", label: "Dringend", labelEn: "Urgent", hint: "Roter Balken", settings: { color: "#e0332f", level: 18 } },
      { id: "akzent", label: "Akzent", labelEn: "Accent", hint: "In deiner Akzentfarbe", settings: { color: "@accent", level: 22 } },
      { id: "dezent", label: "Dezent", labelEn: "Subtle", hint: "Ruhiger Balken", settings: { color: "#f0a020", level: 30 } },
    ],
  },
  {
    type: "guarantee",
    fields: [
      { id: "title", label: "Titel", labelEn: "Title", kind: "text", target: { key: "title" }, def: "30 Tage Geld-zurück-Garantie" },
      { id: "subtitle", label: "Untertitel", labelEn: "Subtitle", kind: "text", target: { key: "subtitle" }, def: "Nicht zufrieden? Du bekommst dein Geld zurück — ohne Wenn und Aber." },
    ],
    presets: [
      { id: "box", label: "Box", labelEn: "Box", hint: "Umrandet mit Siegel", settings: { style: "box", accent: "@accent" } },
      { id: "akzent", label: "Akzent-Fläche", labelEn: "Accent fill", hint: "Getönter Hintergrund", settings: { style: "accent", accent: "@accent" } },
      { id: "minimal", label: "Minimal", labelEn: "Minimal", hint: "Nur Siegel + Text", settings: { style: "minimal", accent: "@accent" } },
    ],
  },
  {
    type: "highlights",
    fields: [
      { id: "item_1", label: "Highlight 1", labelEn: "Highlight 1", kind: "text", target: { key: "item_1" }, def: "Premium-Materialien, die lange halten" },
      { id: "item_2", label: "Highlight 2", labelEn: "Highlight 2", kind: "text", target: { key: "item_2" }, def: "In Sekunden einsatzbereit" },
      { id: "item_3", label: "Highlight 3", labelEn: "Highlight 3", kind: "text", target: { key: "item_3" }, def: "Für den täglichen Gebrauch gemacht" },
      { id: "item_4", label: "Highlight 4", labelEn: "Highlight 4", kind: "text", target: { key: "item_4" }, def: "Von tausenden Kunden geliebt" },
      { id: "item_5", label: "Highlight 5", labelEn: "Highlight 5", kind: "text", target: { key: "item_5" }, def: "" },
    ],
    presets: [
      { id: "akzent", label: "Akzent-Haken", labelEn: "Accent checks", hint: "Häkchen in Akzentfarbe", settings: { style: "accent", accent: "@accent" } },
      { id: "kreis", label: "Gefüllte Kreise", labelEn: "Filled circles", hint: "Häkchen in Kreisen", settings: { style: "circle", accent: "@accent" } },
      { id: "pfeil", label: "Pfeile", labelEn: "Arrows", hint: "Pfeil-Aufzählung", settings: { style: "arrow", accent: "@accent" } },
    ],
  },
  {
    type: "social_proof",
    fields: [
      { id: "text", label: "Text", labelEn: "Text", kind: "text", target: { key: "text" }, def: "sehen sich das gerade an" },
      { id: "count", label: "Anzahl", labelEn: "Count", kind: "text", target: { key: "count" }, def: "17" },
    ],
    presets: [
      { id: "betrachter", label: "Betrachter", labelEn: "Viewers", hint: "Augen-Icon, Live-Punkt", settings: { style: "viewers", accent: "@accent" } },
      { id: "verkauft", label: "Heute verkauft", labelEn: "Sold today", hint: "Warenkorb-Icon", settings: { style: "sold", accent: "@accent" } },
      { id: "trend", label: "Im Trend", labelEn: "Trending", hint: "Flammen-Icon", settings: { style: "trending", accent: "@accent" } },
    ],
  },
];

export function getBuyboxLib(type: string): BuyboxBlockLib | undefined {
  return BUYBOX_LIBRARY.find((b) => b.type === type);
}

export function getBuyboxPreset(type: string, presetId: string | undefined): PresetDef | undefined {
  const lib = getBuyboxLib(type);
  if (!lib || !lib.presets.length) return undefined;
  return lib.presets.find((p) => p.id === presetId) || lib.presets[0];
}

/**
 * Effektive Style-Art eines Bausteins: explizite Wahl des Kunden ODER —
 * für Vorteile-Liste/Timeline — implizit aus dem globalen Icon-Stil
 * (Design-Regler Dunkel/Akzent/Umriss). So landet der globale Icon-Stil
 * auch im Download, nicht nur in der Vorschau.
 */
export function effectiveBuyboxPresetId(
  type: string,
  cfg: { presetId?: string } | undefined,
  design?: { iconStyle: string },
): string {
  if (cfg?.presetId) return cfg.presetId;
  if (design) {
    if (type === "benefits_list") {
      return design.iconStyle === "accent" ? "akzent" : design.iconStyle === "outline" ? "umriss" : "dunkel";
    }
    if (type === "delivery_timeline") {
      return design.iconStyle === "outline" ? "umriss" : "gefuellt";
    }
  }
  return "";
}

/** Effektive Preset-Settings eines Kaufbox-Bausteins (Palette-Refs aufgelöst).
 *  Ohne effektive Style-Art → leeres Objekt (Basis-Settings bleiben). */
export function resolveBlockSettings(
  type: string,
  cfg: { presetId?: string } | undefined,
  palette: ColorPalette,
  design?: { iconStyle: string },
): Record<string, string | number | boolean> {
  const presetId = effectiveBuyboxPresetId(type, cfg, design);
  if (!presetId) return {};
  const preset = getBuyboxPreset(type, presetId);
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(preset?.settings || {})) out[k] = resolvePaletteRef(v, palette);
  return out;
}

// ─── Produktgalerie (pg_*-Settings der main-product-Section) ───────
// „Direkt am / unter dem Produktbild": Thumbnail-Position, Bildformat,
// Pfeile, Zähler, Autoplay — als wählbare Galerie-Style-Arten.

export const GALLERY_PRESETS: PresetDef[] = [
  { id: "thumbs-unten", label: "Thumbnails unten", labelEn: "Thumbs below", hint: "Klassisch: Vorschaubilder unter dem Hauptbild", settings: { pg_layout: "bottom", pg_ratio: "square", pg_arrows: true, pg_counter: false, pg_autoplay: false } },
  { id: "thumbs-links", label: "Thumbnails links", labelEn: "Thumbs left", hint: "Galerie-Leiste neben dem Hauptbild", settings: { pg_layout: "left", pg_ratio: "square", pg_arrows: false, pg_counter: false, pg_autoplay: false } },
  { id: "portrait", label: "Portrait + Zähler", labelEn: "Portrait + counter", hint: "Hochformat mit Bild-Zähler", settings: { pg_layout: "bottom", pg_ratio: "portrait", pg_arrows: true, pg_counter: true, pg_autoplay: false } },
  { id: "kino", label: "Kino-Slider", labelEn: "Cinema slider", hint: "Querformat, Autoplay, Pfeile", settings: { pg_layout: "bottom", pg_ratio: "landscape", pg_arrows: true, pg_counter: true, pg_autoplay: true, pg_transition: "slide" } },
];

export function getGalleryPreset(presetId: string | undefined): PresetDef {
  return GALLERY_PRESETS.find((p) => p.id === presetId) || GALLERY_PRESETS[0];
}

/** Galerie-Preset je Theme-Stil (Teil der Stil-Architektur). */
export const STYLE_GALLERY: Record<string, string> = {
  modern: "thumbs-unten",
  elegant: "thumbs-links",
  bold: "kino",
  playful: "thumbs-unten",
  minimal: "thumbs-links",
  noir: "portrait",
  sunset: "thumbs-unten",
  ocean: "thumbs-links",
  nature: "portrait",
  candy: "thumbs-unten",
  tech: "thumbs-links",
  royal: "portrait",
};

// ─── Theme-Stile v2: Default-Sektionskomposition je Stil ───────────
// Jeder Stil bringt eine eigene Seiten-ARCHITEKTUR mit (welche Sections in
// welcher Reihenfolge mit welchem Preset) — nicht nur Farben/Fonts.

export interface CompositionEntry {
  type: string;
  presetId: string;
}

export const STYLE_COMPOSITIONS: Record<string, CompositionEntry[]> = {
  modern: [
    { type: "bro-feature-grid", presetId: "icons" },
    { type: "bro-info-tabs", presetId: "mittig" },
    { type: "reviews2", presetId: "hell" },
    { type: "featured-collection", presetId: "galerie" },
    { type: "qanda", presetId: "glass" },
  ],
  elegant: [
    { type: "image-with-text", presetId: "overlap" },
    { type: "reviews", presetId: "ruhig" },
    { type: "trustpilot", presetId: "gross" },
    { type: "bro-info-tabs", presetId: "links" },
    { type: "collapsible-content", presetId: "sektion" },
  ],
  bold: [
    { type: "bro-cta-banner", presetId: "vollbild" },
    { type: "bro-feature-grid", presetId: "kacheln" },
    { type: "reviews2", presetId: "dunkel" },
    { type: "countdown", presetId: "akzent" },
    { type: "featured-collection", presetId: "slider" },
  ],
  playful: [
    { type: "animatedtext", presetId: "stern" },
    { type: "bro-feature-grid", presetId: "icons" },
    { type: "vids", presetId: "hell" },
    { type: "reviews2", presetId: "getoent" },
    { type: "qanda", presetId: "offen" },
  ],
  minimal: [
    { type: "rich-text", presetId: "mittig" },
    { type: "featured-collection", presetId: "editorial" },
    { type: "qanda", presetId: "kompakt" },
  ],
  noir: [
    { type: "scrollingbild", presetId: "kino" },
    { type: "reviews2", presetId: "dunkel" },
    { type: "trustpilot", presetId: "kompakt" },
    { type: "bro-cta-banner", presetId: "editorial" },
  ],
  sunset: [
    { type: "image-with-text", presetId: "split" },
    { type: "multicolumn", presetId: "karten" },
    { type: "reviews", presetId: "fade" },
    { type: "qanda", presetId: "glass" },
    { type: "socialicons", presetId: "mittig" },
  ],
  ocean: [
    { type: "bro-feature-grid", presetId: "icons" },
    { type: "video", presetId: "standard" },
    { type: "reviews2", presetId: "hell" },
    { type: "collapsible-content", presetId: "reihen" },
  ],
  nature: [
    { type: "image-with-text", presetId: "zentriert" },
    { type: "multicolumn", presetId: "drei" },
    { type: "reviews", presetId: "ruhig" },
    { type: "qanda", presetId: "glass" },
  ],
  candy: [
    { type: "animatedtext", presetId: "herz" },
    { type: "collage", presetId: "links" },
    { type: "reviews2", presetId: "getoent" },
    { type: "vids", presetId: "getoent" },
    { type: "countdown", presetId: "dunkel" },
  ],
  tech: [
    { type: "bro-feature-grid", presetId: "kompakt" },
    { type: "rich-text", presetId: "mittig" },
    { type: "trustpilot", presetId: "flow" },
    { type: "qanda", presetId: "kompakt" },
  ],
  royal: [
    { type: "bro-cta-banner", presetId: "karte" },
    { type: "image-with-text", presetId: "overlap" },
    { type: "reviews", presetId: "gross" },
    { type: "trustpilot", presetId: "gross" },
  ],
};

const FALLBACK_COMPOSITION: CompositionEntry[] = STYLE_COMPOSITIONS.modern;

/** Basis-Section der Theme-Basis (id + Typ), vom Preview-Endpoint geliefert. */
export interface BaseSectionInfo {
  id: string;
  type: string;
}

/**
 * Baut das initiale ThemeDocument für Produkt + Stil:
 * Komposition des Stils → Instanzen. Existiert in der Theme-Basis eine noch
 * unbenutzte Section gleichen Typs, wird sie wiederverwendet (source
 * "template" — behält echte Inhalte wie Kollektions-Verweise/Videos), sonst
 * wird frisch instanziiert (source "library").
 */
export function buildInitialDocument(
  productId: string,
  styleId: string,
  baseSections: BaseSectionInfo[],
  capabilities: string[],
  homeSections: BaseSectionInfo[] = [],
): ThemeDocument {
  const style = getThemeStyle(styleId);
  const caps = new Set(capabilities);
  const doc = emptyDocument();
  doc.productId = productId;
  doc.global = {
    styleId: style.id,
    colors: { ...style.palette },
    headingFont: style.headingFont,
    bodyFont: style.bodyFont,
    radius: typeof style.settingOverrides.buttons_radius === "number" ? style.settingOverrides.buttons_radius : 8,
    design: style.design ? { ...style.design } : { shadow: 1, border: 1, iconStyle: "dark" },
  };
  // order = NUR die AKTIVEN Bausteine. Vom Stil ausgeblendete Bausteine gelten
  // als „noch nicht hinzugefügt" → sie erscheinen NICHT in der Verschieben-
  // Liste, sondern nur in der Baustein-Galerie zum Hinzufügen. hidden bleibt
  // leer; die Compile-Engine entfernt alles, was nicht in order steht.
  const bbHidden = new Set(style.hiddenBlocks ?? []);
  const activeBuybox = (style.buyboxOrder ?? BUYBOX_DEFAULT_ORDER).filter((tp) => !bbHidden.has(tp));
  doc.buybox = {
    order: activeBuybox,
    hidden: [],
    benefitIcons: [...DEFAULT_BENEFIT_ICONS],
    blocks: {},
    gallery: { presetId: STYLE_GALLERY[style.id] || "thumbs-unten", badge: "" },
    spacing: 15,
  };

  const used = new Set<string>();
  const composition = STYLE_COMPOSITIONS[style.id] || FALLBACK_COMPOSITION;
  const sections: SectionInstance[] = [];
  for (const entry of composition) {
    if (caps.size && !caps.has(entry.type)) continue; // Basis kennt den Typ nicht
    const base = baseSections.find((b) => b.type === entry.type && !used.has(b.id));
    if (base) {
      used.add(base.id);
      sections.push({ uid: base.id, type: entry.type, presetId: entry.presetId, source: "template", texts: {} });
    } else {
      sections.push({ uid: newSectionUid(), type: entry.type, presetId: entry.presetId, source: "library", texts: {} });
    }
  }
  doc.sections = sections;

  // Startseite: Basis-Aufbau ÜBERNEHMEN (presetId "" = neutral, echte Inhalte
  // bleiben) — nur vom Stil ausgeblendete Typen (wave/map …) fliegen raus.
  // Der Kunde kann danach umsortieren, entfernen und neue Sections einfügen.
  const styleHidden = new Set(style.hiddenTypes || []);
  doc.home = homeSections
    .filter((b) => !styleHidden.has(b.type))
    .map((b) => ({ uid: b.id, type: b.type, presetId: "", source: "template" as const, texts: {} }));
  return doc;
}

/** Neue Section-Instanz aus der Bibliothek (für „+ Section einfügen"). */
export function createLibraryInstance(type: string, presetId?: string): SectionInstance {
  const def = getSectionDef(type);
  return {
    uid: newSectionUid(),
    type,
    presetId: presetId || def?.presets[0]?.id || "",
    source: "library",
    texts: {},
  };
}
