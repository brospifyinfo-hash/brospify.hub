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
    // Berechneter Ref: zarte Pastell-Tönung der Akzentfarbe (Karten-Hintergründe).
    if (value === "@accentSoft") return mixHex("#ffffff", palette.accent, 0.12);
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
 *  presetId "" = NEUTRAL: keine Preset-Overrides — die Section behält ihren
 *  Basis-Zustand (wichtig für übernommene Startseiten-Sections). Instanz-
 *  Feineinstellungen (instance.settings — Design-Layer, Icons) liegen IMMER
 *  über den Preset-Werten; identische Auflösung in Vorschau UND Compile. */
export function resolvePresetSettings(instance: SectionInstance, palette: ColorPalette): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (instance.presetId) {
    const def = getSectionDef(instance.type);
    const preset = getPresetDef(def, instance.presetId);
    for (const [k, v] of Object.entries(preset?.settings || {})) out[k] = resolvePaletteRef(v, palette);
  }
  for (const [k, v] of Object.entries(instance.settings || {})) out[k] = resolvePaletteRef(v, palette);
  return out;
}

// ─── Section-Design-Layer: Hintergrund-Töne + Übergänge (alle Sections) ──
// Jede eigene Section versteht dieselben Schema-Keys — Vorschau (Replica-
// Frame) und Liquid (bspx-section-frame-Snippet, wird beim Export generiert)
// rendern sie identisch:
//   sec_bg / sec_bg2    Hintergrund (2. Farbe = vertikaler Verlauf)
//   sec_divider         Formen-Kante am unteren Rand (Welle/Zacken/Bogen …)
//   sec_divider_top     Formen-Kante am oberen Rand
//   sec_fade            NUR NOCH Legacy (Alt-Designs) — neue Designs nutzen
//                       direkte Kanten oder Formen-Übergänge, keine Fades
//   sec_pagebg          Seiten-Hintergrund (auto mit @background gefüllt —
//                       Füllfarbe der Divider-Formen)
export const SECTION_DESIGN_KEYS = ["sec_bg", "sec_bg2", "sec_fade", "sec_divider", "sec_divider_top", "sec_pagebg"] as const;
/** Section-Typen, deren Liquid den Design-Layer versteht (eigene Sections —
 *  Dawn-Basis-Sections bringen eigene Farbschemata mit und bleiben außen vor,
 *  damit Vorschau ≠ Download nie passieren kann). */
export const SECTION_DESIGN_TYPES = new Set([
  "bro-cta-banner", "bro-chat-reviews", "bro-compare", "bro-feature-grid",
  "bro-guarantee", "bro-info-tabs", "bro-problem-solution", "bro-stats",
  "bro-steps", "qanda", "reviews", "reviews2", "trustpilot", "vids",
  "countdown", "benefits", "photo", "kollektionen", "socialicons",
  "animatedtext", "map", "slideshow2",
  "bro-icon-benefits", "bro-spotlight", "bro-callouts", "bro-gradient-cta",
  "bro-logo-badges", "bro-image-cards",
  "bro-hero-luxe", "bro-hero-split", "bro-benefit-cards",
]);
export function sectionSupportsDesign(type: string): boolean {
  return SECTION_DESIGN_TYPES.has(type);
}
export const SECTION_FADES = ["none", "top", "bottom", "both"] as const;
/** Divider-Formen — synchron mit DIVIDER_PATHS/DIVIDER_TOP_PATHS (theme-frame.ts). */
export const SECTION_DIVIDERS = ["none", "wave", "waves", "zigzag", "slant", "curve", "peaks"] as const;
export type SectionTone = "none" | "tint" | "soft" | "wash" | "deep";
export const SECTION_TONES: SectionTone[] = ["none", "tint", "soft", "wash", "deep"];

function mixHex(a: string, b: string, t: number): string {
  const pa = /^#([0-9a-f]{6})$/i.exec(a)?.[1];
  const pb = /^#([0-9a-f]{6})$/i.exec(b)?.[1];
  if (!pa || !pb) return a;
  const c = (o: number) => {
    const va = parseInt(pa.slice(o, o + 2), 16);
    const vb = parseInt(pb.slice(o, o + 2), 16);
    return Math.round(va + (vb - va) * t).toString(16).padStart(2, "0");
  };
  return `#${c(0)}${c(2)}${c(4)}`;
}

/**
 * Übersetzt einen benannten Hintergrund-Ton in konkrete Design-Settings —
 * deterministisch aus der Palette (Vorschau = Download; auch die AI nutzt
 * genau diese Auflösung, damit Töne immer stimmig statt „AI-bunt" sind).
 * Kontraste bewusst kräftig: mehrfarbige Seiten mit DIREKTEN Kanten bzw.
 * Formen-Übergängen (kein Fade — Design-Entscheidung 2026-07).
 *   tint  = deutlicher Akzent-Hauch (≈14 %)   soft = kräftiger Akzent-Verlauf
 *   wash  = ruhiger Grauton (≈10 %)           deep = dunkles Panel (heller Text)
 */
export function sectionToneSettings(
  tone: SectionTone,
  palette: ColorPalette,
  opts: {
    fade?: (typeof SECTION_FADES)[number];
    divider?: (typeof SECTION_DIVIDERS)[number];
    dividerTop?: (typeof SECTION_DIVIDERS)[number];
  } = {},
): Record<string, string> {
  const bg = palette.background;
  const out: Record<string, string> = {
    // Merker für UI/AI (im Liquid-Schema unbekannt → von Shopify ignoriert).
    sec_tone: tone,
    sec_pagebg: bg,
    // Fades nur noch explizit (Legacy) — Standard ist die direkte Kante.
    sec_fade: opts.fade ?? "none",
    sec_divider: opts.divider ?? "none",
    sec_divider_top: opts.dividerTop ?? "none",
  };
  switch (tone) {
    case "tint":
      out.sec_bg = mixHex(bg, palette.accent, 0.14);
      out.sec_bg2 = "";
      break;
    case "soft":
      out.sec_bg = mixHex(bg, palette.accent, 0.18);
      out.sec_bg2 = mixHex(bg, palette.accent, 0.36);
      break;
    case "wash":
      out.sec_bg = mixHex(bg, palette.text, 0.1);
      out.sec_bg2 = "";
      break;
    case "deep":
      out.sec_bg = mixHex(palette.text, palette.button, 0.35);
      out.sec_bg2 = mixHex(mixHex(palette.text, palette.button, 0.35), palette.accent, 0.22);
      break;
    default:
      out.sec_bg = "";
      out.sec_bg2 = "";
  }
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
      { id: "vollbild", label: "Vollbild-Hero", labelEn: "Full-bleed hero", hint: "Hoch, zentriert, dramatisch", settings: { align: "center", min_height_desktop: 560, h_size_desktop: 64, overlay_opacity: 55, radius: 0, max_width: 860, padding_y: 112, accent_color: "@accent", btn_primary_bg: "@button", btn_primary_text: "@buttonText" } },
      { id: "karte", label: "Karten-Banner", labelEn: "Card banner", hint: "Abgerundet, kompakt, edel", settings: { align: "center", min_height_desktop: 340, h_size_desktop: 40, radius: 28, max_width: 720, padding_y: 64, overlay_opacity: 35, accent_color: "@accent", btn_primary_bg: "@button", btn_primary_text: "@buttonText" } },
      { id: "editorial", label: "Editorial links", labelEn: "Editorial left", hint: "Linksbündig, ruhig, hochwertig", settings: { align: "left", min_height_desktop: 460, h_size_desktop: 52, radius: 0, max_width: 640, overlay_opacity: 50, accent_color: "@accent", btn_primary_bg: "@button", btn_primary_text: "@buttonText" } },
      { id: "streifen", label: "Kompakt-Streifen", labelEn: "Compact strip", hint: "Flacher, breiter Abschluss-Streifen", settings: { align: "center", min_height_desktop: 240, h_size_desktop: 34, radius: 16, max_width: 940, padding_y: 44, overlay_opacity: 40, accent_color: "@accent", btn_primary_bg: "@button", btn_primary_text: "@buttonText" } },
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
      { id: "getoent", label: "Getönt", labelEn: "Tinted", hint: "Warm getönter Streifen", settings: { bg_color: "#f7f5f2", heading_color: "#2a2520", accent_color: "@accent" } },
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
      { id: "portrait3", label: "Drei Portrait", labelEn: "Three portrait", hint: "3 hohe Portrait-Karten", settings: { columns_desktop: 3, image_ratio: "portrait", heading_size: "h2", products_to_show: 3, enable_desktop_slider: false } },
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
      { id: "kompakt", label: "Kompakt links", labelEn: "Compact left", hint: "Kleine Pillen, linksbündig", settings: { alignment: "flex-start", font_size_desktop: 14, padding_x_desktop: 18, padding_y_desktop: 8 } },
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
      { id: "sand", label: "Sand", labelEn: "Sand", hint: "Warmer Sand-Ton, weiße Karten", settings: { color_bg: "#efe9e1", color_card: "#ffffff", color_accent: "@accent", color_text: "#2a2520" } },
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
      { id: "ruhig", label: "Ruhig", labelEn: "Calm", hint: "Ohne Animation, schmal", settings: { animation_type: "none", heading_size: 32, max_width: 750, star_color: "@accent" } },
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
      { id: "gross", label: "Groß & ruhig", labelEn: "Large & calm", hint: "Große Karten, langsamer Lauf", settings: { scroll_speed: 20, card_padding: 20, review_image_size: 150, text_size: 15 }, blocks: trustBlocks() },
      { id: "kompakt", label: "Kompakt", labelEn: "Compact", hint: "Dichte, kleine Karten", settings: { scroll_speed: 35, card_padding: 8, review_image_size: 80, text_size: 12 }, blocks: trustBlocks() },
      { id: "premium", label: "Premium ruhig", labelEn: "Premium calm", hint: "Große Karten, sehr langsamer Lauf", settings: { scroll_speed: 15, card_padding: 22, review_image_size: 120, text_size: 15 }, blocks: trustBlocks() },
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
      { id: "sand", label: "Sand", labelEn: "Sand", hint: "Warmer Sand-Hintergrund", settings: { bg_color: "#efe9e1" } },
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
      { id: "kompakt", label: "Kompakt", labelEn: "Compact", hint: "Kleine Icons, wenig Abstand", settings: { icon_size: 30, section_padding_top: 25, section_padding_bottom: 25, icon_alignment: "center", heading_alignment: "center" } },
      { id: "gross", label: "Groß", labelEn: "Large", hint: "Große Icons mit Hover-Zoom", settings: { icon_size: 55, hover_scale: 1.3, icon_alignment: "center", heading_alignment: "center" } },
      { id: "links", label: "Linksbündig", labelEn: "Left", hint: "Icons links, kompakt", settings: { icon_alignment: "flex-start", heading_alignment: "left", icon_size: 35 } },
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
      { id: "duo", label: "Zwei zentriert", labelEn: "Two centered", hint: "2 große zentrierte Karten", settings: { columns_desktop: 2, card_align: "center", heading_align: "center", card_padding: 32, card_radius: 24, icon_size: 40, accent_color: "@accent" }, blocks: featureBlocks(2) },
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
      { id: "bildrechts", label: "Bild rechts", labelEn: "Image right", hint: "Text links, Bild rechts", settings: { desktop_image_width: "medium", layout: "text_first", height: "adapt", desktop_content_position: "middle", desktop_content_alignment: "left", content_layout: "no-overlap" }, blocks: [{ type: "heading", settings: {} }, { type: "text", settings: {} }, { type: "button", settings: {} }] },
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
      { id: "zwei", label: "Zwei breit", labelEn: "Two wide", hint: "2 breite Spalten, linksbündig", settings: { columns_desktop: 2, column_alignment: "left", background_style: "none", heading_size: "h2" }, blocks: FEATURES.slice(0, 2).map((f) => ({ type: "column", settings: { title: f.title, text: `<p>${f.text}</p>` } })) },
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
      { id: "rechts", label: "Rechtsbündig", labelEn: "Right", hint: "Text rechts ausgerichtet", settings: { desktop_content_position: "right", content_alignment: "right", full_width: false }, blocks: [{ type: "heading", settings: {} }, { type: "text", settings: {} }] },
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
      { id: "panorama", label: "Panorama", labelEn: "Panorama", hint: "Sehr breiter, flacher Streifen", settings: { size_mode: "ratio", aspect_desktop: "21 / 9", corner_radius: 0, side_margin: 0, overlay_style: "bottom" } },
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
      { id: "kartenrechts", label: "Karten rechts", labelEn: "Cards right", hint: "Karten-Rahmen, groß rechts", settings: { desktop_layout: "right", card_styles: "product-card-wrapper", heading_size: "h2" }, blocks: [{ type: "image", settings: {} }, { type: "image", settings: {} }, { type: "image", settings: {} }] },
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
      { id: "luftig", label: "Luftig", labelEn: "Airy", hint: "Viel Abstand, ruhig", settings: { auto_close: true, padding_top: 72, padding_bottom: 72, icon_color: "@accent" }, blocks: faqBlocks() },
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
      { id: "reihenoffen", label: "Reihen (erste offen)", labelEn: "Rows (first open)", hint: "Reihen-Karten, erste offen, linksbündig", settings: { layout: "row", heading_alignment: "left", open_first_collapsible_row: true }, blocks: FAQ_ROWS.map((r) => ({ type: "collapsible_row", settings: { heading: r.q, row_content: r.a } })) },
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
      { id: "kompakt", label: "Kompakt", labelEn: "Compact", hint: "Schmaler Container, wenig Innenraum", settings: { container_radius: 12, panel_padding: 20, heading_align: "center", tab_align: "center", accent_color: "@accent" } },
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
      { id: "hoch", label: "Hoch & dramatisch", labelEn: "Tall & dramatic", hint: "Sehr großer Vollbild-Hero", settings: { full_width: true, corner_radius: 0, height_desktop: 820, dot_active: "@accent" }, blocks: [{ type: "slide", settings: { btn_bg_color: "@button", btn_text_color: "@buttonText" } }] },
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
      { id: "luftig", label: "Luftig", labelEn: "Airy", hint: "Mehr Abstand", settings: { padding_vertical: 50 } },
      { id: "schmal", label: "Sehr kompakt", labelEn: "Very compact", hint: "Schmale, dichte Leiste", settings: { padding_vertical: 10 } },
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
      { id: "dunkel", label: "Dunkel", labelEn: "Dark", hint: "Dunkler, edler Hintergrund", settings: { bg_color: "#101014", btn_bg_color: "@button", btn_text_color: "@buttonText" } },
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
      { id: "linksdunkel", label: "Links dunkel", labelEn: "Left dark", hint: "Karte links im Dark-Look", settings: { layout: "map_left", map_filter: "dark", pin_color: "@accent", btn_bg_color: "@button", btn_text_color: "@buttonText" } },
    ],
  },

  // ─── Conversion-Pack (neue CRO-Sections, Liquid in der Master-Schablone) ───
  {
    type: "bro-compare",
    category: "conversion",
    label: "Vergleichs-Tabelle",
    labelEn: "Comparison table",
    desc: "„Wir vs. Andere“ — der Klassiker gegen den Preisvergleichs-Absprung.",
    descEn: "\"Us vs. them\" — the classic against price-comparison bounce.",
    fields: [
      { id: "heading", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "heading" }, def: "Warum wir die bessere Wahl sind" },
      { id: "subheading", label: "Unterzeile", labelEn: "Subheading", kind: "text", target: { key: "subheading" }, def: "Der direkte Vergleich zeigt den Unterschied" },
      { id: "us_label", label: "Spalte „Wir“", labelEn: "\"Us\" column", kind: "text", target: { key: "us_label" }, def: "Wir" },
      { id: "them_label", label: "Spalte „Andere“", labelEn: "\"Others\" column", kind: "text", target: { key: "them_label" }, def: "Andere Anbieter" },
      { id: "row_1", label: "Kriterium 1", labelEn: "Criterion 1", kind: "text", target: { key: "row_1" }, def: "Premium-Qualität" },
      { id: "row_2", label: "Kriterium 2", labelEn: "Criterion 2", kind: "text", target: { key: "row_2" }, def: "30 Tage Geld-zurück-Garantie" },
      { id: "row_3", label: "Kriterium 3", labelEn: "Criterion 3", kind: "text", target: { key: "row_3" }, def: "Deutscher Kundenservice" },
      { id: "row_4", label: "Kriterium 4", labelEn: "Criterion 4", kind: "text", target: { key: "row_4" }, def: "Schneller Versand" },
      { id: "row_5", label: "Kriterium 5", labelEn: "Criterion 5", kind: "text", target: { key: "row_5" }, def: "Geprüfte Materialien" },
      { id: "row_6", label: "Kriterium 6 (optional)", labelEn: "Criterion 6 (optional)", kind: "text", target: { key: "row_6" }, def: "" },
      { id: "ribbon", label: "Band über der Wir-Spalte", labelEn: "Ribbon", kind: "text", target: { key: "ribbon" }, def: "Beliebteste Wahl" },
      { id: "cta_label", label: "Button-Text", labelEn: "Button label", kind: "text", target: { key: "cta_label" }, def: "Jetzt die bessere Wahl treffen" },
    ],
    presets: [
      { id: "klassisch", label: "Klassisch", labelEn: "Classic", hint: "Tabelle, Wir-Spalte hervorgehoben", settings: { layout: "table", dark: false, accent_color: "@accent", radius: 16 } },
      { id: "karten", label: "Karten", labelEn: "Cards", hint: "Wir-Spalte als erhabene Karte", settings: { layout: "cards", dark: false, accent_color: "@accent", radius: 18 } },
      { id: "dunkel", label: "Dunkel", labelEn: "Dark", hint: "Premium-Look auf Dunkel", settings: { layout: "table", dark: true, accent_color: "@accent", radius: 16 } },
    ],
  },
  {
    type: "bro-guarantee",
    category: "conversion",
    label: "Garantie-Abschluss",
    labelEn: "Guarantee closer",
    desc: "Großes Garantie-Siegel als Risiko-Umkehr fürs Seitenende.",
    descEn: "Big guarantee seal as a risk-reversal closer.",
    fields: [
      { id: "seal_text", label: "Siegel-Text", labelEn: "Seal text", kind: "text", target: { key: "seal_text" }, def: "30 Tage" },
      { id: "heading", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "heading" }, def: "Du liebst es – oder du bekommst dein Geld zurück" },
      { id: "text", label: "Text", labelEn: "Text", kind: "textarea", target: { key: "text" }, def: "Teste es 30 Tage lang völlig risikofrei. Wenn du nicht begeistert bist, erstatten wir dir jeden Cent – ohne Fragen, ohne Kleingedrucktes." },
      { id: "bullet_1", label: "Punkt 1", labelEn: "Bullet 1", kind: "text", target: { key: "bullet_1" }, def: "100 % Geld-zurück-Garantie" },
      { id: "bullet_2", label: "Punkt 2", labelEn: "Bullet 2", kind: "text", target: { key: "bullet_2" }, def: "Unkomplizierte Rückgabe" },
      { id: "bullet_3", label: "Punkt 3", labelEn: "Bullet 3", kind: "text", target: { key: "bullet_3" }, def: "Deutscher Support antwortet in 24 h" },
      { id: "cta_label", label: "Button-Text", labelEn: "Button label", kind: "text", target: { key: "cta_label" }, def: "Jetzt risikofrei bestellen" },
      { id: "note", label: "Hinweiszeile", labelEn: "Note", kind: "text", target: { key: "note" }, def: "Heute versandkostenfrei" },
    ],
    presets: [
      { id: "siegel", label: "Siegel zentriert", labelEn: "Seal centered", hint: "Siegel oben, alles mittig", settings: { layout: "center", accent_color: "@accent", radius: 20 } },
      { id: "split", label: "Mit Produktbild", labelEn: "With product image", hint: "Garantie links, Bild rechts", settings: { layout: "split", accent_color: "@accent", radius: 20 } },
      { id: "akzent", label: "Vollflächig", labelEn: "Full accent", hint: "Akzentfarbe als Fläche", settings: { layout: "accent", accent_color: "@accent", radius: 20 } },
    ],
  },
  {
    type: "bro-steps",
    category: "content",
    label: "So funktioniert's",
    labelEn: "How it works",
    desc: "3 nummerierte Schritte — nimmt die „Ist das kompliziert?“-Hürde.",
    descEn: "3 numbered steps — removes the \"is this complicated?\" objection.",
    fields: [
      { id: "heading", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "heading" }, def: "So einfach geht's" },
      { id: "subheading", label: "Unterzeile", labelEn: "Subheading", kind: "text", target: { key: "subheading" }, def: "In 3 Schritten zum Ergebnis" },
      { id: "s1_title", label: "Schritt 1 — Titel", labelEn: "Step 1 — title", kind: "text", target: { key: "s1_title" }, def: "Bestellen" },
      { id: "s1_text", label: "Schritt 1 — Text", labelEn: "Step 1 — text", kind: "text", target: { key: "s1_text" }, def: "Heute bestellt – in wenigen Tagen bei dir" },
      { id: "s2_title", label: "Schritt 2 — Titel", labelEn: "Step 2 — title", kind: "text", target: { key: "s2_title" }, def: "Auspacken" },
      { id: "s2_text", label: "Schritt 2 — Text", labelEn: "Step 2 — text", kind: "text", target: { key: "s2_text" }, def: "Sofort einsatzbereit, ganz ohne Einrichtung" },
      { id: "s3_title", label: "Schritt 3 — Titel", labelEn: "Step 3 — title", kind: "text", target: { key: "s3_title" }, def: "Genießen" },
      { id: "s3_text", label: "Schritt 3 — Text", labelEn: "Step 3 — text", kind: "text", target: { key: "s3_text" }, def: "Spüre den Unterschied ab dem ersten Tag" },
      { id: "cta_label", label: "Button-Text (optional)", labelEn: "Button label (optional)", kind: "text", target: { key: "cta_label" }, def: "" },
    ],
    presets: [
      { id: "kreise", label: "Nummern-Kreise", labelEn: "Number circles", hint: "Horizontal mit Verbindungslinie", settings: { layout: "row", accent_color: "@accent", radius: 16 } },
      { id: "timeline", label: "Timeline", labelEn: "Timeline", hint: "Vertikal mit Linie", settings: { layout: "timeline", accent_color: "@accent", radius: 16 } },
      { id: "karten", label: "Karten", labelEn: "Cards", hint: "3 Karten mit Nummern-Badge", settings: { layout: "cards", accent_color: "@accent", radius: 16 } },
    ],
  },
  {
    type: "bro-stats",
    category: "social",
    label: "Statistik-Band",
    labelEn: "Stats band",
    desc: "Große Kennzahlen (Kunden, Bewertung, Garantie) — Social Proof in 1 Sekunde.",
    descEn: "Big numbers (customers, rating, guarantee) — social proof in a second.",
    fields: [
      { id: "heading", label: "Überschrift (optional)", labelEn: "Heading (optional)", kind: "text", target: { key: "heading" }, def: "" },
      { id: "n1", label: "Zahl 1", labelEn: "Number 1", kind: "text", target: { key: "n1" }, def: "25.000+" },
      { id: "l1", label: "Unterzeile 1", labelEn: "Label 1", kind: "text", target: { key: "l1" }, def: "zufriedene Kunden" },
      { id: "n2", label: "Zahl 2", labelEn: "Number 2", kind: "text", target: { key: "n2" }, def: "4,8/5" },
      { id: "l2", label: "Unterzeile 2", labelEn: "Label 2", kind: "text", target: { key: "l2" }, def: "Durchschnittsbewertung" },
      { id: "n3", label: "Zahl 3", labelEn: "Number 3", kind: "text", target: { key: "n3" }, def: "93 %" },
      { id: "l3", label: "Unterzeile 3", labelEn: "Label 3", kind: "text", target: { key: "l3" }, def: "würden uns weiterempfehlen" },
      { id: "n4", label: "Zahl 4 (optional)", labelEn: "Number 4 (optional)", kind: "text", target: { key: "n4" }, def: "30 Tage" },
      { id: "l4", label: "Unterzeile 4", labelEn: "Label 4", kind: "text", target: { key: "l4" }, def: "Geld-zurück-Garantie" },
      { id: "note", label: "Fußnote (optional)", labelEn: "Footnote (optional)", kind: "text", target: { key: "note" }, def: "" },
    ],
    presets: [
      { id: "band", label: "Akzent-Band", labelEn: "Accent band", hint: "Vollflächig in Akzentfarbe", settings: { layout: "band", accent_color: "@accent", countup: true } },
      { id: "hell", label: "Hell", labelEn: "Light", hint: "Mit Trennlinien", settings: { layout: "light", accent_color: "@accent", countup: true } },
      { id: "karten", label: "Karten", labelEn: "Cards", hint: "4 Karten mit Rahmen", settings: { layout: "cards", accent_color: "@accent", countup: true } },
    ],
  },
  {
    type: "bro-problem-solution",
    category: "content",
    label: "Problem & Lösung",
    labelEn: "Problem & solution",
    desc: "PAS-Formel: Schmerzpunkte anteasern, dann das Produkt als Lösung.",
    descEn: "PAS formula: agitate the pain, then present the product as the fix.",
    fields: [
      { id: "p_heading", label: "Problem-Überschrift", labelEn: "Problem heading", kind: "text", target: { key: "p_heading" }, def: "Kennst du das?" },
      { id: "p_1", label: "Problem-Punkt 1", labelEn: "Problem 1", kind: "text", target: { key: "p_1" }, def: "Du hast schon alles ausprobiert – ohne Erfolg" },
      { id: "p_2", label: "Problem-Punkt 2", labelEn: "Problem 2", kind: "text", target: { key: "p_2" }, def: "Teure Alternativen halten nicht, was sie versprechen" },
      { id: "p_3", label: "Problem-Punkt 3", labelEn: "Problem 3", kind: "text", target: { key: "p_3" }, def: "Das Problem kommt immer wieder zurück" },
      { id: "bridge", label: "Übergangs-Satz", labelEn: "Bridge line", kind: "text", target: { key: "bridge" }, def: "Damit ist jetzt Schluss." },
      { id: "s_heading", label: "Lösungs-Überschrift", labelEn: "Solution heading", kind: "text", target: { key: "s_heading" }, def: "Die Lösung" },
      { id: "s_1", label: "Lösungs-Punkt 1", labelEn: "Solution 1", kind: "text", target: { key: "s_1" }, def: "Wirkt ab der ersten Anwendung" },
      { id: "s_2", label: "Lösungs-Punkt 2", labelEn: "Solution 2", kind: "text", target: { key: "s_2" }, def: "Entwickelt für den Alltag" },
      { id: "s_3", label: "Lösungs-Punkt 3", labelEn: "Solution 3", kind: "text", target: { key: "s_3" }, def: "Tausendfach bewährt" },
      { id: "cta_label", label: "Button-Text", labelEn: "Button label", kind: "text", target: { key: "cta_label" }, def: "Problem jetzt lösen" },
    ],
    presets: [
      { id: "gestapelt", label: "Gestapelt", labelEn: "Stacked", hint: "Problem rot, Lösung grün getönt", settings: { layout: "stack", accent_color: "@accent", radius: 20 } },
      { id: "split", label: "Nebeneinander", labelEn: "Side by side", hint: "Problem links, Lösung rechts", settings: { layout: "split", accent_color: "@accent", radius: 20 } },
      { id: "kontrast", label: "Kontrast", labelEn: "Contrast", hint: "Problem dunkel, Lösung hell", settings: { layout: "contrast", accent_color: "@accent", radius: 20 } },
    ],
  },
  {
    type: "bro-chat-reviews",
    category: "social",
    label: "Chat-Bewertungen",
    labelEn: "Chat testimonials",
    desc: "Kundenstimmen als Messenger-Chats — UGC-Optik ohne echte Daten.",
    descEn: "Testimonials as messenger chats — UGC look without real data.",
    fields: [
      { id: "heading", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "heading" }, def: "Das schreiben uns unsere Kunden" },
      { id: "c1_name", label: "Chat 1 — Name", labelEn: "Chat 1 — name", kind: "text", target: { key: "c1_name" }, def: "Lisa" },
      { id: "c1_m1", label: "Chat 1 — Nachricht 1", labelEn: "Chat 1 — message 1", kind: "text", target: { key: "c1_m1" }, def: "Hey, mein Paket ist heute angekommen 😍" },
      { id: "c1_m2", label: "Chat 1 — Nachricht 2", labelEn: "Chat 1 — message 2", kind: "text", target: { key: "c1_m2" }, def: "Ich bin ehrlich überrascht, wie gut das funktioniert!" },
      { id: "c1_time", label: "Chat 1 — Uhrzeit", labelEn: "Chat 1 — time", kind: "text", target: { key: "c1_time" }, def: "14:32" },
      { id: "c2_name", label: "Chat 2 — Name", labelEn: "Chat 2 — name", kind: "text", target: { key: "c2_name" }, def: "Jonas" },
      { id: "c2_m1", label: "Chat 2 — Nachricht 1", labelEn: "Chat 2 — message 1", kind: "text", target: { key: "c2_m1" }, def: "Ich nutze es jetzt seit 2 Wochen jeden Tag" },
      { id: "c2_m2", label: "Chat 2 — Nachricht 2", labelEn: "Chat 2 — message 2", kind: "text", target: { key: "c2_m2" }, def: "Beste Entscheidung dieses Jahr 💪" },
      { id: "c2_time", label: "Chat 2 — Uhrzeit", labelEn: "Chat 2 — time", kind: "text", target: { key: "c2_time" }, def: "09:18" },
      { id: "c3_name", label: "Chat 3 — Name", labelEn: "Chat 3 — name", kind: "text", target: { key: "c3_name" }, def: "Marie" },
      { id: "c3_m1", label: "Chat 3 — Nachricht 1", labelEn: "Chat 3 — message 1", kind: "text", target: { key: "c3_m1" }, def: "Mein Paket kam schneller als gedacht!" },
      { id: "c3_m2", label: "Chat 3 — Nachricht 2", labelEn: "Chat 3 — message 2", kind: "text", target: { key: "c3_m2" }, def: "Qualität ist deutlich besser als erwartet" },
      { id: "c3_time", label: "Chat 3 — Uhrzeit", labelEn: "Chat 3 — time", kind: "text", target: { key: "c3_time" }, def: "19:47" },
      { id: "note", label: "Disclaimer (optional)", labelEn: "Disclaimer (optional)", kind: "text", target: { key: "note" }, def: "" },
    ],
    presets: [
      { id: "whatsapp", label: "WhatsApp-Look", labelEn: "WhatsApp look", hint: "Beiger Chat, grüne Haken", settings: { look: "whatsapp", accent_color: "@accent" } },
      { id: "imessage", label: "iMessage-Look", labelEn: "iMessage look", hint: "Weiß mit grauen Bubbles", settings: { look: "imessage", accent_color: "@accent" } },
      { id: "neutral", label: "Theme-Farben", labelEn: "Theme colors", hint: "Bubbles in Akzent-Tönung", settings: { look: "neutral", accent_color: "@accent" } },
    ],
  },

  // ── Premium-Sections (v3): hochwertig, mit Icon- und Design-Layer ──
  {
    type: "bro-icon-benefits",
    category: "content",
    label: "Icon-Band",
    labelEn: "Icon band",
    desc: "3–4 Produkt-Vorteile mit passenden Icons — der Klassiker unter dem Hero.",
    descEn: "3–4 product benefits with matching icons — the classic under the hero.",
    fields: [
      { id: "heading", label: "Überschrift (optional)", labelEn: "Heading (optional)", kind: "text", target: { key: "heading" }, def: "" },
      { id: "t1", label: "Vorteil 1 — Titel", labelEn: "Benefit 1 — title", kind: "text", target: { key: "t1" }, def: "Sofort spürbar" },
      { id: "d1", label: "Vorteil 1 — Text", labelEn: "Benefit 1 — text", kind: "text", target: { key: "d1" }, def: "Wirkung ab der ersten Anwendung" },
      { id: "t2", label: "Vorteil 2 — Titel", labelEn: "Benefit 2 — title", kind: "text", target: { key: "t2" }, def: "Für jeden Tag" },
      { id: "d2", label: "Vorteil 2 — Text", labelEn: "Benefit 2 — text", kind: "text", target: { key: "d2" }, def: "In unter 10 Minuten angewendet" },
      { id: "t3", label: "Vorteil 3 — Titel", labelEn: "Benefit 3 — title", kind: "text", target: { key: "t3" }, def: "Geprüfte Qualität" },
      { id: "d3", label: "Vorteil 3 — Text", labelEn: "Benefit 3 — text", kind: "text", target: { key: "d3" }, def: "Streng getestet und zertifiziert" },
      { id: "t4", label: "Vorteil 4 — Titel (optional)", labelEn: "Benefit 4 — title (optional)", kind: "text", target: { key: "t4" }, def: "30 Tage testen" },
      { id: "d4", label: "Vorteil 4 — Text", labelEn: "Benefit 4 — text", kind: "text", target: { key: "d4" }, def: "Geld-zurück-Garantie inklusive" },
    ],
    presets: [
      { id: "band", label: "Band", labelEn: "Band", hint: "Icons in Akzent-Kreisen, luftig", settings: { layout: "band", accent_color: "@accent" } },
      { id: "karten", label: "Karten", labelEn: "Cards", hint: "4 Karten mit Schatten", settings: { layout: "karten", accent_color: "@accent" } },
      { id: "minimal", label: "Kompakt", labelEn: "Compact", hint: "Einzeilig, dezent", settings: { layout: "minimal", accent_color: "@accent" } },
    ],
  },
  {
    type: "bro-spotlight",
    category: "social",
    label: "Kunden-Spotlight",
    labelEn: "Customer spotlight",
    desc: "EIN großes Testimonial mit Serifen-Zitat, Sternen und Avatar — Editorial-Klasse.",
    descEn: "ONE big testimonial with serif quote, stars and avatar — editorial class.",
    fields: [
      { id: "quote", label: "Zitat", labelEn: "Quote", kind: "textarea", target: { key: "quote" }, def: "Ich war skeptisch — aber schon nach einer Woche wollte ich es nicht mehr hergeben. Es fühlt sich einfach hochwertig an." },
      { id: "name", label: "Name", labelEn: "Name", kind: "text", target: { key: "name" }, def: "Anna K." },
      { id: "role", label: "Zeile unter dem Namen", labelEn: "Line under the name", kind: "text", target: { key: "role" }, def: "Verifizierte Käuferin" },
    ],
    presets: [
      { id: "editorial", label: "Editorial", labelEn: "Editorial", hint: "Frei stehend, großes Zitat", settings: { layout: "editorial", accent_color: "@accent" } },
      { id: "karte", label: "Karte", labelEn: "Card", hint: "Als Premium-Karte mit Schatten", settings: { layout: "karte", accent_color: "@accent" } },
    ],
  },
  {
    type: "bro-callouts",
    category: "content",
    label: "Produkt-Callouts",
    labelEn: "Product callouts",
    desc: "Produktbild in der Mitte, Feature-Punkte mit Icons und Linien außen — DTC-Premium.",
    descEn: "Product image center, feature points with icons and lines around it — DTC premium.",
    fields: [
      { id: "heading", label: "Überschrift (optional)", labelEn: "Heading (optional)", kind: "text", target: { key: "heading" }, def: "Im Detail durchdacht" },
      { id: "c1", label: "Punkt 1", labelEn: "Point 1", kind: "text", target: { key: "c1" }, def: "Hochwertige Materialien" },
      { id: "c2", label: "Punkt 2", labelEn: "Point 2", kind: "text", target: { key: "c2" }, def: "Entwickelt für den Alltag" },
      { id: "c3", label: "Punkt 3", labelEn: "Point 3", kind: "text", target: { key: "c3" }, def: "Einfach zu bedienen" },
      { id: "c4", label: "Punkt 4", labelEn: "Point 4", kind: "text", target: { key: "c4" }, def: "Langlebig & robust" },
    ],
    presets: [
      { id: "hell", label: "Klar", labelEn: "Clean", hint: "Ruhig, ohne Glow", settings: { layout: "hell", accent_color: "@accent" } },
      { id: "glow", label: "Akzent-Glow", labelEn: "Accent glow", hint: "Weicher Farbschein hinter dem Produkt", settings: { layout: "glow", accent_color: "@accent" } },
    ],
  },
  {
    type: "bro-gradient-cta",
    category: "conversion",
    label: "Gradient-CTA",
    labelEn: "Gradient CTA",
    desc: "Abschluss-Band mit Premium-Farbverlauf, Benefit-Chips und großem Kauf-Button.",
    descEn: "Closing band with premium gradient, benefit chips and a big CTA.",
    fields: [
      { id: "eyebrow", label: "Eyebrow (optional)", labelEn: "Eyebrow (optional)", kind: "text", target: { key: "eyebrow" }, def: "Bereit, wenn du es bist" },
      { id: "heading", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "heading" }, def: "Starte heute — risikofrei" },
      { id: "subheading", label: "Untertitel", labelEn: "Subheading", kind: "textarea", target: { key: "subheading" }, def: "Schließe dich tausenden zufriedenen Kunden an und überzeuge dich selbst." },
      { id: "chip1", label: "Chip 1", labelEn: "Chip 1", kind: "text", target: { key: "chip1" }, def: "Gratis Versand" },
      { id: "chip2", label: "Chip 2", labelEn: "Chip 2", kind: "text", target: { key: "chip2" }, def: "30 Tage Rückgabe" },
      { id: "chip3", label: "Chip 3 (optional)", labelEn: "Chip 3 (optional)", kind: "text", target: { key: "chip3" }, def: "Käuferschutz" },
      { id: "cta", label: "Button-Text", labelEn: "Button label", kind: "text", target: { key: "cta" }, def: "Jetzt bestellen" },
      { id: "note", label: "Zeile unter dem Button (optional)", labelEn: "Line under button (optional)", kind: "text", target: { key: "note" }, def: "" },
    ],
    presets: [
      { id: "aurora", label: "Aurora", labelEn: "Aurora", hint: "Akzent → Button-Farbe, kühl", settings: { g1: "@accent", g2: "@button", g3: "", radius: 26 } },
      { id: "deep", label: "Deep", labelEn: "Deep", hint: "Dunkel mit Akzent-Schimmer", settings: { g1: "@text", g2: "@button", g3: "@accent", radius: 26 } },
      { id: "mono", label: "Mono", labelEn: "Mono", hint: "Nur Akzent, satt", settings: { g1: "@accent", g2: "@accent", g3: "", radius: 26 } },
    ],
  },
  {
    type: "bro-logo-badges",
    category: "social",
    label: "Bekannt-aus-Band",
    labelEn: "Featured-in band",
    desc: "Presse-/Badge-Namen als elegantes Laufband — Autorität in einer Zeile.",
    descEn: "Press/badge names as an elegant marquee — authority in one line.",
    fields: [
      { id: "heading", label: "Kopfzeile", labelEn: "Header line", kind: "text", target: { key: "heading" }, def: "Bekannt aus" },
      { id: "b1", label: "Badge 1", labelEn: "Badge 1", kind: "text", target: { key: "b1" }, def: "GALILEO" },
      { id: "b2", label: "Badge 2", labelEn: "Badge 2", kind: "text", target: { key: "b2" }, def: "VOGUE" },
      { id: "b3", label: "Badge 3", labelEn: "Badge 3", kind: "text", target: { key: "b3" }, def: "FOCUS" },
      { id: "b4", label: "Badge 4", labelEn: "Badge 4", kind: "text", target: { key: "b4" }, def: "STERN" },
      { id: "b5", label: "Badge 5 (optional)", labelEn: "Badge 5 (optional)", kind: "text", target: { key: "b5" }, def: "TREND" },
    ],
    presets: [
      { id: "marquee", label: "Laufband", labelEn: "Marquee", hint: "Läuft langsam durch", settings: { layout: "marquee" } },
      { id: "statisch", label: "Statisch", labelEn: "Static", hint: "Eine ruhige Zeile", settings: { layout: "statisch" } },
    ],
  },
  {
    type: "bro-image-cards",
    category: "media",
    label: "Premium Bild-Karten",
    labelEn: "Premium image cards",
    desc: "3 große Bild-Karten mit Verlauf und Caption — Lookbook-Gefühl statt Raster.",
    descEn: "3 big image cards with gradient and caption — lookbook feel instead of a grid.",
    fields: [
      { id: "heading", label: "Überschrift (optional)", labelEn: "Heading (optional)", kind: "text", target: { key: "heading" }, def: "" },
      { id: "c1_t", label: "Karte 1 — Titel", labelEn: "Card 1 — title", kind: "text", target: { key: "c1_t" }, def: "Für deinen Alltag" },
      { id: "c1_d", label: "Karte 1 — Untertitel", labelEn: "Card 1 — caption", kind: "text", target: { key: "c1_d" }, def: "Jeden Tag im Einsatz" },
      { id: "c2_t", label: "Karte 2 — Titel", labelEn: "Card 2 — title", kind: "text", target: { key: "c2_t" }, def: "Bis ins Detail" },
      { id: "c2_d", label: "Karte 2 — Untertitel", labelEn: "Card 2 — caption", kind: "text", target: { key: "c2_d" }, def: "Durchdacht verarbeitet" },
      { id: "c3_t", label: "Karte 3 — Titel", labelEn: "Card 3 — title", kind: "text", target: { key: "c3_t" }, def: "Bereit für dich" },
      { id: "c3_d", label: "Karte 3 — Untertitel", labelEn: "Card 3 — caption", kind: "text", target: { key: "c3_d" }, def: "In wenigen Tagen bei dir" },
    ],
    presets: [
      { id: "drei", label: "Drei gleich", labelEn: "Three equal", hint: "Ruhig und ausgewogen", settings: { layout: "drei", radius: 20 } },
      { id: "versetzt", label: "Versetzt", labelEn: "Staggered", hint: "Mittlere Karte versetzt", settings: { layout: "versetzt", radius: 20 } },
      { id: "breit", label: "Eine breit", labelEn: "One wide", hint: "Erste Karte doppelt breit", settings: { layout: "breit", radius: 20 } },
    ],
  },

  // ─── Referenz-Nachbauten v4 (Kunden-Screenshots) ───
  {
    type: "bro-hero-luxe",
    category: "media",
    label: "Hero Luxe",
    labelEn: "Hero luxe",
    desc: "Fullscreen-Bild mit Glas-Karte unten: Trustpilot-Zeile, Serifen-Headline, großer weißer Button.",
    descEn: "Fullscreen image with a glass card at the bottom: Trustpilot line, serif headline, big white button.",
    fields: [
      { id: "trust_label", label: "Trust-Zeile (leer = aus)", labelEn: "Trust line (empty = off)", kind: "text", target: { key: "trust_label" }, def: "Hervorragend" },
      { id: "trust_score", label: "Bewertung", labelEn: "Rating", kind: "text", target: { key: "trust_score" }, def: "4,6" },
      { id: "heading", label: "Überschrift", labelEn: "Heading", kind: "textarea", target: { key: "heading" }, def: "Spürbar besser — vom ersten Tag an" },
      { id: "text", label: "Beschreibung", labelEn: "Description", kind: "textarea", target: { key: "text" }, def: "Entwickelt für deinen Alltag: hochwertige Materialien, durchdachtes Design und ein Ergebnis, das man sieht." },
      { id: "cta", label: "Button-Text", labelEn: "Button label", kind: "text", target: { key: "cta" }, def: "Jetzt entdecken" },
    ],
    presets: [
      { id: "glas", label: "Glas", labelEn: "Glass", hint: "Milchglas-Karte auf dem Bild", settings: { look: "glass", card_pos: "left", height: "full", overlay: 28, serif: true } },
      { id: "hell", label: "Hell", labelEn: "Light", hint: "Weiße Karte, dunkler Button", settings: { look: "light", card_pos: "left", height: "tall", overlay: 20, serif: true } },
      { id: "dunkel", label: "Dunkel", labelEn: "Dark", hint: "Dunkle Karte, mittig", settings: { look: "dark", card_pos: "center", height: "full", overlay: 36, serif: false } },
    ],
  },
  {
    type: "bro-hero-split",
    category: "media",
    label: "Hero Split",
    labelEn: "Hero split",
    desc: "Farbfläche mit Avataren + Bewertung, fetter Headline mit unterstrichenem Wort, 2 Buttons + Produktbild.",
    descEn: "Flat color hero with avatars + rating, bold headline with underlined word, 2 buttons + product photo.",
    fields: [
      { id: "customers", label: "Kunden-Zeile", labelEn: "Customers line", kind: "text", target: { key: "customers" }, def: "50.000+ zufriedene Kunden" },
      { id: "rating", label: "Bewertung (leer = aus)", labelEn: "Rating (empty = off)", kind: "text", target: { key: "rating" }, def: "4,7" },
      { id: "heading_pre", label: "Überschrift — Teil 1", labelEn: "Heading — part 1", kind: "text", target: { key: "heading_pre" }, def: "Dein Alltag." },
      { id: "heading_mark", label: "Unterstrichenes Wort", labelEn: "Underlined word", kind: "text", target: { key: "heading_mark" }, def: "Nur besser" },
      { id: "heading_post", label: "Überschrift — Teil 2 (optional)", labelEn: "Heading — part 2 (optional)", kind: "text", target: { key: "heading_post" }, def: "" },
      { id: "text", label: "Beschreibung", labelEn: "Description", kind: "textarea", target: { key: "text" }, def: "Das Original, dem tausende vertrauen: durchdacht bis ins Detail und in wenigen Tagen bei dir." },
      { id: "cta1", label: "Button 1", labelEn: "Button 1", kind: "text", target: { key: "cta1" }, def: "Jetzt bestellen" },
      { id: "cta2", label: "Button 2 (leer = aus)", labelEn: "Button 2 (empty = off)", kind: "text", target: { key: "cta2" }, def: "Mehr erfahren" },
    ],
    presets: [
      { id: "rosa", label: "Rosé", labelEn: "Rose", hint: "Zarte Rosa-Fläche wie im Referenz-Look", settings: { bg: "#f6cdd6", text_color: "#1c1417" } },
      { id: "creme", label: "Creme", labelEn: "Cream", hint: "Warmer Creme-Ton", settings: { bg: "#f3ead9", text_color: "#241d12" } },
      { id: "akzent", label: "Akzent", labelEn: "Accent", hint: "Nutzt die Akzentfarbe der Palette", settings: { bg: "@accent", text_color: "#ffffff" } },
    ],
  },
  {
    type: "bro-benefit-cards",
    category: "info",
    label: "Benefit-Karten",
    labelEn: "Benefit cards",
    desc: "2–4 pastellgetönte Karten mit Emoji, Titel und Text — ruhiger Vertrauens-Block ohne KI-Optik.",
    descEn: "2–4 pastel-tinted cards with emoji, title and text — a calm trust block.",
    fields: [
      { id: "heading", label: "Überschrift (optional)", labelEn: "Heading (optional)", kind: "text", target: { key: "heading" }, def: "" },
      { id: "emoji_1", label: "Karte 1 — Emoji", labelEn: "Card 1 — emoji", kind: "text", target: { key: "emoji_1" }, def: "😊" },
      { id: "title_1", label: "Karte 1 — Titel", labelEn: "Card 1 — title", kind: "text", target: { key: "title_1" }, def: "Kostenlose Rückgabe" },
      { id: "text_1", label: "Karte 1 — Text", labelEn: "Card 1 — text", kind: "textarea", target: { key: "text_1" }, def: "Du wirst es lieben — und falls nicht, schick es einfach 30 Tage lang kostenlos zurück." },
      { id: "emoji_2", label: "Karte 2 — Emoji", labelEn: "Card 2 — emoji", kind: "text", target: { key: "emoji_2" }, def: "🌳" },
      { id: "title_2", label: "Karte 2 — Titel", labelEn: "Card 2 — title", kind: "text", target: { key: "title_2" }, def: "Gutes tun inklusive" },
      { id: "text_2", label: "Karte 2 — Text", labelEn: "Card 2 — text", kind: "textarea", target: { key: "text_2" }, def: "Für jede Bestellung pflanzen wir gemeinsam mit unseren Partnern einen Baum." },
      { id: "emoji_3", label: "Karte 3 — Emoji", labelEn: "Card 3 — emoji", kind: "text", target: { key: "emoji_3" }, def: "🚚" },
      { id: "title_3", label: "Karte 3 — Titel (leer = aus)", labelEn: "Card 3 — title (empty = off)", kind: "text", target: { key: "title_3" }, def: "" },
      { id: "text_3", label: "Karte 3 — Text", labelEn: "Card 3 — text", kind: "textarea", target: { key: "text_3" }, def: "" },
      { id: "emoji_4", label: "Karte 4 — Emoji", labelEn: "Card 4 — emoji", kind: "text", target: { key: "emoji_4" }, def: "🔒" },
      { id: "title_4", label: "Karte 4 — Titel (leer = aus)", labelEn: "Card 4 — title (empty = off)", kind: "text", target: { key: "title_4" }, def: "" },
      { id: "text_4", label: "Karte 4 — Text", labelEn: "Card 4 — text", kind: "textarea", target: { key: "text_4" }, def: "" },
    ],
    presets: [
      { id: "duo", label: "Pastell-Duo", labelEn: "Pastel duo", hint: "Creme + Mint wie im Referenz-Look", settings: { bg_1: "#f7f4ec", bg_2: "#eaf4ec", bg_3: "#eef1f6", bg_4: "#f6ecf1" } },
      { id: "quartett", label: "Pastell-Quartett", labelEn: "Pastel quartet", hint: "4 Karten in 4 zarten Tönen", settings: { bg_1: "#f7f4ec", bg_2: "#eaf4ec", bg_3: "#eef1f6", bg_4: "#f6ecf1", title_3: "Schnelle Lieferung", text_3: "In 2–4 Werktagen bei dir — mit Sendungsverfolgung.", title_4: "Sichere Zahlung", text_4: "SSL-verschlüsselt mit Käuferschutz bei jeder Bestellung." } },
      { id: "akzent", label: "Akzent-Töne", labelEn: "Accent tints", hint: "Karten in der Palette getönt", settings: { bg_1: "@accentSoft", bg_2: "@accentSoft", bg_3: "@accentSoft", bg_4: "@accentSoft" } },
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
  {
    type: "countdown_timer",
    fields: [{ id: "text", label: "Hinweis-Text", labelEn: "Label", kind: "text", target: { key: "text" }, def: "Angebot endet in" }],
    presets: [
      { id: "dringend", label: "Dringend", labelEn: "Urgent", hint: "Rote Kacheln, 8 Std", settings: { color: "#e0332f", hours: 8 } },
      { id: "akzent", label: "Akzent", labelEn: "Accent", hint: "In deiner Akzentfarbe, 12 Std", settings: { color: "@accent", hours: 12 } },
      { id: "dezent", label: "Dezent", labelEn: "Subtle", hint: "Warmes Orange, 24 Std", settings: { color: "#f0a020", hours: 24 } },
    ],
  },
  {
    type: "press_bar",
    fields: [
      { id: "heading", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "heading" }, def: "Bekannt aus" },
      { id: "label_1", label: "Logo/Name 1", labelEn: "Logo/Name 1", kind: "text", target: { key: "label_1" }, def: "PRESSE" },
      { id: "label_2", label: "Logo/Name 2", labelEn: "Logo/Name 2", kind: "text", target: { key: "label_2" }, def: "BLOG" },
      { id: "label_3", label: "Logo/Name 3", labelEn: "Logo/Name 3", kind: "text", target: { key: "label_3" }, def: "TV" },
      { id: "label_4", label: "Logo/Name 4", labelEn: "Logo/Name 4", kind: "text", target: { key: "label_4" }, def: "PODCAST" },
    ],
    presets: [
      { id: "schlicht", label: "Schlicht", labelEn: "Plain", hint: "Nur Namen, zentriert", settings: { style: "plain", accent: "@accent" } },
      { id: "streifen", label: "Streifen", labelEn: "Strip", hint: "Getönter Balken", settings: { style: "strip", accent: "@accent" } },
      { id: "akzent", label: "Akzent", labelEn: "Accent", hint: "Namen in Akzentfarbe", settings: { style: "accent", accent: "@accent" } },
    ],
  },
  {
    type: "spec_list",
    fields: [
      { id: "label_1", label: "Zeile 1 — Bezeichnung", labelEn: "Row 1 — label", kind: "text", target: { key: "label_1" }, def: "Material" },
      { id: "value_1", label: "Zeile 1 — Wert", labelEn: "Row 1 — value", kind: "text", target: { key: "value_1" }, def: "Premium-Qualität" },
      { id: "label_2", label: "Zeile 2 — Bezeichnung", labelEn: "Row 2 — label", kind: "text", target: { key: "label_2" }, def: "Größe" },
      { id: "value_2", label: "Zeile 2 — Wert", labelEn: "Row 2 — value", kind: "text", target: { key: "value_2" }, def: "Universal" },
      { id: "label_3", label: "Zeile 3 — Bezeichnung", labelEn: "Row 3 — label", kind: "text", target: { key: "label_3" }, def: "Versand" },
      { id: "value_3", label: "Zeile 3 — Wert", labelEn: "Row 3 — value", kind: "text", target: { key: "value_3" }, def: "1–3 Werktage" },
    ],
    presets: [
      { id: "linien", label: "Linien", labelEn: "Lines", hint: "Zeilen mit Trennlinie", settings: { style: "lines", accent: "@accent" } },
      { id: "kompakt", label: "Kompakt", labelEn: "Compact", hint: "Dicht, ohne Linien", settings: { style: "compact", accent: "@accent" } },
      { id: "karte", label: "Karte", labelEn: "Card", hint: "In umrandeter Box", settings: { style: "card", accent: "@accent" } },
    ],
  },

  // ─── Conversion-Pack (CRO-Bausteine, rein Runtime/design-basiert) ───
  {
    type: "value_stack",
    fields: [
      { id: "heading", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "heading" }, def: "Das bekommst du heute:" },
      { id: "item_1", label: "Position 1", labelEn: "Item 1", kind: "text", target: { key: "item_1" }, def: "1× Premium-Produkt" },
      { id: "value_1", label: "Wert 1 (oder GRATIS)", labelEn: "Value 1 (or GRATIS)", kind: "text", target: { key: "value_1" }, def: "49,95 €" },
      { id: "item_2", label: "Position 2", labelEn: "Item 2", kind: "text", target: { key: "item_2" }, def: "Premium-E-Book (Deutsch)" },
      { id: "value_2", label: "Wert 2 (oder GRATIS)", labelEn: "Value 2 (or GRATIS)", kind: "text", target: { key: "value_2" }, def: "GRATIS" },
      { id: "item_3", label: "Position 3", labelEn: "Item 3", kind: "text", target: { key: "item_3" }, def: "Express-Versand" },
      { id: "value_3", label: "Wert 3 (oder GRATIS)", labelEn: "Value 3 (or GRATIS)", kind: "text", target: { key: "value_3" }, def: "GRATIS" },
      { id: "item_4", label: "Position 4 (optional)", labelEn: "Item 4 (optional)", kind: "text", target: { key: "item_4" }, def: "" },
      { id: "value_4", label: "Wert 4 (oder GRATIS)", labelEn: "Value 4 (or GRATIS)", kind: "text", target: { key: "value_4" }, def: "" },
      { id: "total_label", label: "Gesamtwert-Zeile", labelEn: "Total line", kind: "text", target: { key: "total_label" }, def: "Gesamtwert: 89,80 €" },
      { id: "today_label", label: "Heute-Preis-Zeile", labelEn: "Today price line", kind: "text", target: { key: "today_label" }, def: "Heute nur: 49,95 €" },
      { id: "save_text", label: "Ersparnis-Zeile", labelEn: "Savings line", kind: "text", target: { key: "save_text" }, def: "Du sparst 39,85 € (44 %)" },
    ],
    presets: [
      { id: "checkliste", label: "Checkliste", labelEn: "Checklist", hint: "Häkchen + GRATIS-Badges", settings: { style: "list", accent: "@accent" } },
      { id: "bon", label: "Kassenbon", labelEn: "Receipt", hint: "Rechnungs-Optik mit Summenzeile", settings: { style: "receipt", accent: "@accent" } },
      { id: "akzent", label: "Akzent-Box", labelEn: "Accent box", hint: "Getönte Box in Akzentfarbe", settings: { style: "accent", accent: "@accent" } },
    ],
  },
  {
    type: "review_quote",
    fields: [
      { id: "text", label: "Zitat", labelEn: "Quote", kind: "textarea", target: { key: "text" }, def: "Ich war skeptisch – aber schon nach einer Woche will ich es nicht mehr hergeben!" },
      { id: "name", label: "Name + Ort", labelEn: "Name + city", kind: "text", target: { key: "name" }, def: "Melanie K. aus Köln" },
      { id: "initials", label: "Initialen (Avatar)", labelEn: "Initials (avatar)", kind: "text", target: { key: "initials" }, def: "MK" },
      { id: "verified", label: "Verifiziert-Label", labelEn: "Verified label", kind: "text", target: { key: "verified" }, def: "Verifizierter Kauf" },
    ],
    presets: [
      { id: "sprechblase", label: "Sprechblase", labelEn: "Bubble", hint: "Bubble + Initialen-Avatar", settings: { style: "bubble", accent: "@accent" } },
      { id: "karte", label: "Karte", labelEn: "Card", hint: "Karte mit großem Anführungszeichen", settings: { style: "card", accent: "@accent" } },
      { id: "minimal", label: "Minimal", labelEn: "Minimal", hint: "Kursives Zitat ohne Rahmen", settings: { style: "plain", accent: "@accent" } },
    ],
  },

  // ─── Trust-Pack v4 (nach Kunden-Referenzen — Emoji + Pastell-Optik) ───
  {
    type: "benefit_cards",
    fields: [
      { id: "e1", label: "Karte 1 — Emoji", labelEn: "Card 1 — emoji", kind: "text", target: { key: "e1" }, def: "😊" },
      { id: "t1", label: "Karte 1 — Titel", labelEn: "Card 1 — title", kind: "text", target: { key: "t1" }, def: "Kostenlose Rückgabe" },
      { id: "d1", label: "Karte 1 — Text", labelEn: "Card 1 — text", kind: "text", target: { key: "d1" }, def: "Du wirst es lieben — 30 Tage risikofrei testen." },
      { id: "e2", label: "Karte 2 — Emoji", labelEn: "Card 2 — emoji", kind: "text", target: { key: "e2" }, def: "🌳" },
      { id: "t2", label: "Karte 2 — Titel", labelEn: "Card 2 — title", kind: "text", target: { key: "t2" }, def: "Gutes tun inklusive" },
      { id: "d2", label: "Karte 2 — Text", labelEn: "Card 2 — text", kind: "text", target: { key: "d2" }, def: "1 Bestellung = 1 gepflanzter Baum." },
    ],
    presets: [
      { id: "pastell", label: "Pastell-Duo", labelEn: "Pastel duo", hint: "Creme + Mint wie im Referenz-Look", settings: { style: "pastel", c1_bg: "#f7f4ec", c2_bg: "#eaf4ec", accent: "@accent" } },
      { id: "akzent", label: "Akzent-Tönung", labelEn: "Accent tint", hint: "Beide Karten im Palette-Ton", settings: { style: "tint", accent: "@accent" } },
      { id: "umriss", label: "Umriss", labelEn: "Outline", hint: "Weiße Karten mit feinem Rand", settings: { style: "outline", accent: "@accent" } },
    ],
  },
  {
    type: "usp_grid",
    fields: [
      { id: "e1", label: "Feld 1 — Emoji", labelEn: "Cell 1 — emoji", kind: "text", target: { key: "e1" }, def: "🏆" },
      { id: "t1", label: "Feld 1 — Titel", labelEn: "Cell 1 — title", kind: "text", target: { key: "t1" }, def: "Gratis Versand" },
      { id: "s1", label: "Feld 1 — Unterzeile", labelEn: "Cell 1 — subline", kind: "text", target: { key: "s1" }, def: "ab 25 € Bestellwert" },
      { id: "e2", label: "Feld 2 — Emoji", labelEn: "Cell 2 — emoji", kind: "text", target: { key: "e2" }, def: "🔒" },
      { id: "t2", label: "Feld 2 — Titel", labelEn: "Cell 2 — title", kind: "text", target: { key: "t2" }, def: "Sichere Zahlung" },
      { id: "s2", label: "Feld 2 — Unterzeile", labelEn: "Cell 2 — subline", kind: "text", target: { key: "s2" }, def: "SSL-verschlüsselt" },
      { id: "e3", label: "Feld 3 — Emoji", labelEn: "Cell 3 — emoji", kind: "text", target: { key: "e3" }, def: "⭐" },
      { id: "t3", label: "Feld 3 — Titel", labelEn: "Cell 3 — title", kind: "text", target: { key: "t3" }, def: "Geprüfte Qualität" },
      { id: "s3", label: "Feld 3 — Unterzeile", labelEn: "Cell 3 — subline", kind: "text", target: { key: "s3" }, def: "von Kunden bewertet" },
      { id: "e4", label: "Feld 4 — Emoji", labelEn: "Cell 4 — emoji", kind: "text", target: { key: "e4" }, def: "🚚" },
      { id: "t4", label: "Feld 4 — Titel", labelEn: "Cell 4 — title", kind: "text", target: { key: "t4" }, def: "Schnelle Lieferung" },
      { id: "s4", label: "Feld 4 — Unterzeile", labelEn: "Cell 4 — subline", kind: "text", target: { key: "s4" }, def: "mit Sendungsverfolgung" },
      { id: "e5", label: "Feld 5 — Emoji", labelEn: "Cell 5 — emoji", kind: "text", target: { key: "e5" }, def: "💬" },
      { id: "t5", label: "Feld 5 — Titel", labelEn: "Cell 5 — title", kind: "text", target: { key: "t5" }, def: "Persönlicher Support" },
      { id: "s5", label: "Feld 5 — Unterzeile", labelEn: "Cell 5 — subline", kind: "text", target: { key: "s5" }, def: "antwortet innerhalb 24 h" },
      { id: "e6", label: "Feld 6 — Emoji", labelEn: "Cell 6 — emoji", kind: "text", target: { key: "e6" }, def: "📮" },
      { id: "t6", label: "Feld 6 — Titel", labelEn: "Cell 6 — title", kind: "text", target: { key: "t6" }, def: "Kostenlose Rückgabe" },
      { id: "s6", label: "Feld 6 — Unterzeile", labelEn: "Cell 6 — subline", kind: "text", target: { key: "s6" }, def: "30 Tage" },
    ],
    presets: [
      { id: "linien", label: "Linien-Raster", labelEn: "Line grid", hint: "Feine Trennlinien wie im Referenz-Look", settings: { style: "lines", accent: "@accent" } },
      { id: "karten", label: "Mini-Karten", labelEn: "Mini cards", hint: "6 kleine Karten", settings: { style: "cards", accent: "@accent" } },
      { id: "kompakt", label: "Kompakt", labelEn: "Compact", hint: "Ohne Unterzeilen, dichter", settings: { style: "compact", accent: "@accent" } },
    ],
  },
  {
    type: "avatar_proof",
    fields: [
      { id: "name", label: "Name (fett, mit ✓)", labelEn: "Name (bold, with ✓)", kind: "text", target: { key: "name" }, def: "David" },
      { id: "join", label: "Verbinder (z. B. „und“)", labelEn: "Connector (e.g. \"and\")", kind: "text", target: { key: "join" }, def: "und" },
      { id: "count", label: "Zahl (fett)", labelEn: "Count (bold)", kind: "text", target: { key: "count" }, def: "1.500+" },
      { id: "text", label: "Text danach", labelEn: "Text after", kind: "text", target: { key: "text" }, def: "andere lieben unser Produkt und haben mehr als einmal bestellt!" },
      { id: "initials", label: "Avatar-Initialen (3, mit Komma)", labelEn: "Avatar initials (3, comma)", kind: "text", target: { key: "initials" }, def: "SM,TK,LB" },
    ],
    presets: [
      { id: "pill", label: "Graue Pille", labelEn: "Gray pill", hint: "Heller Banner wie im Referenz-Look", settings: { style: "pill", accent: "@accent" } },
      { id: "akzent", label: "Akzent-Tönung", labelEn: "Accent tint", hint: "Leicht eingefärbt", settings: { style: "tint", accent: "@accent" } },
      { id: "schlicht", label: "Ohne Hintergrund", labelEn: "Plain", hint: "Nur Avatare + Zeile", settings: { style: "plain", accent: "@accent" } },
    ],
  },
  {
    type: "ship_countdown",
    fields: [
      { id: "before", label: "Text vor dem Countdown", labelEn: "Text before countdown", kind: "text", target: { key: "before" }, def: "Bestelle innerhalb von" },
      { id: "after", label: "Text nach dem Countdown", labelEn: "Text after countdown", kind: "text", target: { key: "after" }, def: "— Versand noch heute!" },
      { id: "late", label: "Text nach Annahmeschluss", labelEn: "Text after cutoff", kind: "text", target: { key: "late" }, def: "Bestelle jetzt – Versand am nächsten Werktag" },
      { id: "eta_label", label: "Lieferdatum-Label", labelEn: "Delivery date label", kind: "text", target: { key: "eta_label" }, def: "Zustellung voraussichtlich:" },
    ],
    presets: [
      { id: "zeile", label: "Zeile", labelEn: "Inline", hint: "Eine Zeile mit Uhr-Icon", settings: { style: "inline", accent: "@accent", cutoff: 16, eta_min: 2, eta_max: 4 } },
      { id: "gruen", label: "Versand-Box", labelEn: "Shipping box", hint: "Grüne Box + Lieferdatum fett", settings: { style: "box", accent: "#1d9e55", cutoff: 16, eta_min: 2, eta_max: 4 } },
      { id: "zweizeilig", label: "Zweizeilig", labelEn: "Two lines", hint: "Countdown oben, Datum darunter", settings: { style: "stack", accent: "@accent", cutoff: 16, eta_min: 2, eta_max: 4 } },
    ],
  },
  {
    type: "return_promise",
    fields: [
      { id: "title", label: "Überschrift", labelEn: "Title", kind: "text", target: { key: "title" }, def: "30 Tage Rückgaberecht" },
      { id: "subtitle", label: "Unterzeile", labelEn: "Subtitle", kind: "text", target: { key: "subtitle" }, def: "Einfache Rückgabe – ohne Wenn und Aber" },
    ],
    presets: [
      { id: "zeile", label: "Zeile", labelEn: "Inline", hint: "Kompakte Icon-Zeile", settings: { style: "line", accent: "@accent" } },
      { id: "box", label: "Soft-Box", labelEn: "Soft box", hint: "Umrandete Box", settings: { style: "box", accent: "@accent" } },
      { id: "gruen", label: "Grüner Haken", labelEn: "Green check", hint: "Grün getönt mit Häkchen", settings: { style: "check", accent: "#1d9e55" } },
    ],
  },
  {
    type: "fit_check",
    fields: [
      { id: "heading", label: "Überschrift", labelEn: "Heading", kind: "text", target: { key: "heading" }, def: "Ist das etwas für dich?" },
      { id: "yes_title", label: "Titel Positiv-Block", labelEn: "Positive title", kind: "text", target: { key: "yes_title" }, def: "Perfekt für dich, wenn …" },
      { id: "yes_1", label: "Positiv-Punkt 1", labelEn: "Positive 1", kind: "text", target: { key: "yes_1" }, def: "… du eine Lösung willst, die wirklich funktioniert" },
      { id: "yes_2", label: "Positiv-Punkt 2", labelEn: "Positive 2", kind: "text", target: { key: "yes_2" }, def: "… du keine Lust auf teure Alternativen hast" },
      { id: "yes_3", label: "Positiv-Punkt 3", labelEn: "Positive 3", kind: "text", target: { key: "yes_3" }, def: "… du Wert auf einfache Anwendung legst" },
      { id: "no_title", label: "Titel Negativ-Block", labelEn: "Negative title", kind: "text", target: { key: "no_title" }, def: "Eher nichts für dich, wenn …" },
      { id: "no_1", label: "Negativ-Punkt", labelEn: "Negative 1", kind: "text", target: { key: "no_1" }, def: "… du keine 2 Minuten am Tag investieren willst" },
      { id: "closing", label: "Abschluss-Satz", labelEn: "Closing line", kind: "text", target: { key: "closing" }, def: "Klingt nach dir? Dann ist das hier deine Lösung." },
    ],
    presets: [
      { id: "karte", label: "Karte", labelEn: "Card", hint: "Beide Blöcke untereinander", settings: { style: "card", accent: "@accent" } },
      { id: "spalten", label: "Spalten", labelEn: "Columns", hint: "Grün/Grau nebeneinander", settings: { style: "cols", accent: "@accent" } },
      { id: "schlicht", label: "Schlicht", labelEn: "Plain", hint: "Ohne Rahmen", settings: { style: "plain", accent: "@accent" } },
    ],
  },
  {
    type: "mini_compare",
    fields: [
      { id: "title", label: "Titel", labelEn: "Title", kind: "text", target: { key: "title" }, def: "Der Unterschied ist klar" },
      { id: "us_label", label: "Spalte links (Wir)", labelEn: "Left column (us)", kind: "text", target: { key: "us_label" }, def: "Wir" },
      { id: "them_label", label: "Spalte rechts (Andere)", labelEn: "Right column (others)", kind: "text", target: { key: "them_label" }, def: "Andere" },
      { id: "row_1", label: "Kriterium 1", labelEn: "Criterion 1", kind: "text", target: { key: "row_1" }, def: "Premium-Material" },
      { id: "row_2", label: "Kriterium 2", labelEn: "Criterion 2", kind: "text", target: { key: "row_2" }, def: "30 Tage Geld-zurück" },
      { id: "row_3", label: "Kriterium 3", labelEn: "Criterion 3", kind: "text", target: { key: "row_3" }, def: "Deutscher Support" },
      { id: "row_4", label: "Kriterium 4", labelEn: "Criterion 4", kind: "text", target: { key: "row_4" }, def: "Blitzversand" },
    ],
    presets: [
      { id: "karte", label: "Karte", labelEn: "Card", hint: "Kopfzeile in Akzentfarbe", settings: { style: "card", accent: "@accent" } },
      { id: "liste", label: "Liste", labelEn: "List", hint: "Ohne Rahmen", settings: { style: "list", accent: "@accent" } },
      { id: "pills", label: "Badges", labelEn: "Pills", hint: "Wir/Andere als Badges", settings: { style: "pills", accent: "@accent" } },
    ],
  },
  {
    type: "coupon_code",
    fields: [
      { id: "title", label: "Überschrift", labelEn: "Title", kind: "text", target: { key: "title" }, def: "Nur heute: 10 % Extra-Rabatt" },
      { id: "code", label: "Rabatt-Code", labelEn: "Code", kind: "text", target: { key: "code" }, def: "HEUTE10" },
      { id: "button", label: "Button-Text", labelEn: "Button text", kind: "text", target: { key: "button" }, def: "Code kopieren" },
      { id: "copied", label: "Text nach dem Kopieren", labelEn: "Copied text", kind: "text", target: { key: "copied" }, def: "Kopiert! Wird an der Kasse eingelöst" },
      { id: "note", label: "Kleingedrucktes", labelEn: "Fine print", kind: "text", target: { key: "note" }, def: "Gültig nur heute" },
    ],
    presets: [
      { id: "coupon", label: "Coupon", labelEn: "Coupon", hint: "Gestrichelte Kante + Schere", settings: { style: "coupon", accent: "@accent" } },
      { id: "kopierbutton", label: "Kopier-Button", labelEn: "Copy button", hint: "Akzent-Button mit Haken", settings: { style: "button", accent: "@accent" } },
      { id: "leiste", label: "Leiste", labelEn: "Strip", hint: "Schmale Zeile mit Geschenk-Icon", settings: { style: "strip", accent: "@accent" } },
    ],
  },
  {
    type: "price_per_day",
    fields: [
      { id: "text", label: "Text ({betrag} = Preis/Tag)", labelEn: "Text ({betrag} = price/day)", kind: "text", target: { key: "text" }, def: "Nur {betrag} pro Tag – weniger als dein Kaffee" },
      { id: "days", label: "Zeitraum in Tagen", labelEn: "Days", kind: "text", target: { key: "days" }, def: "90" },
    ],
    presets: [
      { id: "zeile", label: "Dezente Zeile", labelEn: "Subtle line", hint: "Kleine Zeile unter dem Preis", settings: { style: "line", accent: "@accent" } },
      { id: "badge", label: "Badge", labelEn: "Badge", hint: "Highlight in Akzentfarbe", settings: { style: "badge", accent: "@accent" } },
      { id: "rechnung", label: "Rechnung", labelEn: "Math", hint: "Preis ÷ Tage = X €/Tag", settings: { style: "math", accent: "@accent" } },
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

/** Effektive Settings eines Kaufbox-Bausteins: Preset-Werte (Palette-Refs
 *  aufgelöst) + darüber die Feineinstellungen des Kunden (cfg.settings). */
export function resolveBlockSettings(
  type: string,
  cfg: { presetId?: string; settings?: Record<string, string | number | boolean> } | undefined,
  palette: ColorPalette,
  design?: { iconStyle: string },
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  const presetId = effectiveBuyboxPresetId(type, cfg, design);
  if (presetId) {
    const preset = getBuyboxPreset(type, presetId);
    for (const [k, v] of Object.entries(preset?.settings || {})) out[k] = resolvePaletteRef(v, palette);
  }
  // Feineinstellungen (Farbe/Größe/Ausrichtung …) überschreiben die Preset-Werte.
  for (const [k, v] of Object.entries(cfg?.settings || {})) out[k] = resolvePaletteRef(v, palette);
  return out;
}

// ─── Feineinstellungen je Kaufbox-Baustein (Regler im Inspector) ────
// Kuratierte, sehr verständliche Regler auf ECHTEN Schema-Keys (gegen das
// main-product-Schema verifiziert). kind: color | slider | segment.
export interface BuyboxControl {
  key: string;
  label: string; labelEn: string;
  kind: "color" | "slider" | "segment";
  min?: number; max?: number; step?: number; suffix?: string;
  options?: { value: string; label: string; labelEn: string }[];
}

const ALIGN3 = (keyLR = false) => [
  { value: keyLR ? "flex-start" : "left", label: "Links", labelEn: "Left" },
  { value: "center", label: "Mitte", labelEn: "Center" },
  { value: keyLR ? "flex-end" : "right", label: "Rechts", labelEn: "Right" },
];

export const BUYBOX_CONTROLS: Record<string, BuyboxControl[]> = {
  custom_title: [
    { key: "alignment", label: "Ausrichtung", labelEn: "Alignment", kind: "segment", options: ALIGN3() },
    { key: "font_size_desktop", label: "Schriftgröße", labelEn: "Font size", kind: "slider", min: 16, max: 60, suffix: "px" },
    { key: "text_color", label: "Textfarbe", labelEn: "Text color", kind: "color" },
  ],
  custom_price: [
    { key: "alignment", label: "Ausrichtung", labelEn: "Alignment", kind: "segment", options: ALIGN3() },
    { key: "price_size_desk", label: "Preisgröße", labelEn: "Price size", kind: "slider", min: 16, max: 60, suffix: "px" },
    { key: "price_color", label: "Preisfarbe", labelEn: "Price color", kind: "color" },
    { key: "badge_bg", label: "Rabatt-Badge", labelEn: "Discount badge", kind: "color" },
  ],
  custom_rating: [
    { key: "alignment", label: "Ausrichtung", labelEn: "Alignment", kind: "segment", options: ALIGN3(true) },
    { key: "star_size", label: "Sterngröße", labelEn: "Star size", kind: "slider", min: 12, max: 32, suffix: "px" },
    { key: "star_color", label: "Sternfarbe", labelEn: "Star color", kind: "color" },
    { key: "text_color", label: "Textfarbe", labelEn: "Text color", kind: "color" },
  ],
  sale_banner: [
    { key: "bg", label: "Hintergrund", labelEn: "Background", kind: "color" },
    { key: "t_color", label: "Textfarbe", labelEn: "Text color", kind: "color" },
    { key: "radius", label: "Ecken", labelEn: "Corners", kind: "slider", min: 0, max: 20, suffix: "px" },
  ],
  urgency_text: [
    { key: "alignment", label: "Ausrichtung", labelEn: "Alignment", kind: "segment", options: ALIGN3() },
    { key: "font_size", label: "Schriftgröße", labelEn: "Font size", kind: "slider", min: 12, max: 30, suffix: "px" },
    { key: "text_color", label: "Textfarbe", labelEn: "Text color", kind: "color" },
  ],
  stock_indicator: [
    { key: "alignment", label: "Ausrichtung", labelEn: "Alignment", kind: "segment", options: ALIGN3(true) },
    { key: "text_color", label: "Textfarbe", labelEn: "Text color", kind: "color" },
    { key: "dot_color", label: "Punkt-Farbe", labelEn: "Dot color", kind: "color" },
  ],
  benefits_list: [
    { key: "icon_bg", label: "Icon-Hintergrund", labelEn: "Icon background", kind: "color" },
    { key: "icon_color", label: "Icon-Farbe", labelEn: "Icon color", kind: "color" },
    { key: "text_color", label: "Textfarbe", labelEn: "Text color", kind: "color" },
    { key: "font_size", label: "Schriftgröße", labelEn: "Font size", kind: "slider", min: 12, max: 22, suffix: "px" },
  ],
  bundle_selector: [
    { key: "card_radius", label: "Karten-Ecken", labelEn: "Card corners", kind: "slider", min: 0, max: 28, suffix: "px" },
    { key: "active_border", label: "Aktiv-Rahmen", labelEn: "Active border", kind: "color" },
    { key: "savings_color", label: "Ersparnis-Farbe", labelEn: "Savings color", kind: "color" },
  ],
  buy_buttons: [
    { key: "cart_size", label: "Größe", labelEn: "Size", kind: "segment", options: [{ value: "md", label: "M", labelEn: "M" }, { value: "lg", label: "L", labelEn: "L" }, { value: "xl", label: "XL", labelEn: "XL" }] },
    { key: "btn_shape", label: "Form", labelEn: "Shape", kind: "segment", options: [{ value: "round", label: "Rund", labelEn: "Round" }, { value: "pill", label: "Pill", labelEn: "Pill" }, { value: "sharp", label: "Kantig", labelEn: "Sharp" }] },
    { key: "primary_bg", label: "Button-Farbe", labelEn: "Button color", kind: "color" },
    { key: "primary_fg", label: "Button-Text", labelEn: "Button text", kind: "color" },
  ],
  payment_icons: [
    { key: "alignment", label: "Ausrichtung", labelEn: "Alignment", kind: "segment", options: ALIGN3(true) },
    { key: "icon_width", label: "Icon-Größe", labelEn: "Icon size", kind: "slider", min: 24, max: 72, suffix: "px" },
  ],
  guarantee: [{ key: "accent", label: "Akzentfarbe", labelEn: "Accent color", kind: "color" }],
  trust_badges: [{ key: "accent", label: "Icon-Farbe", labelEn: "Icon color", kind: "color" }],
  highlights: [{ key: "accent", label: "Akzentfarbe", labelEn: "Accent color", kind: "color" }],
  social_proof: [{ key: "accent", label: "Akzentfarbe", labelEn: "Accent color", kind: "color" }],
  stock_bar: [{ key: "color", label: "Balkenfarbe", labelEn: "Bar color", kind: "color" }, { key: "level", label: "Füllstand", labelEn: "Fill level", kind: "slider", min: 6, max: 60, suffix: "%" }],
  feature_box: [{ key: "accent_color", label: "Akzentfarbe", labelEn: "Accent color", kind: "color" }],
  ship_countdown: [
    { key: "cutoff", label: "Annahmeschluss (Uhrzeit)", labelEn: "Cutoff (hour)", kind: "slider", min: 8, max: 22, suffix: " Uhr" },
    { key: "eta_min", label: "Lieferzeit ab (Werktage)", labelEn: "Delivery from (workdays)", kind: "slider", min: 1, max: 10, suffix: " Tage" },
    { key: "eta_max", label: "Lieferzeit bis (Werktage)", labelEn: "Delivery to (workdays)", kind: "slider", min: 1, max: 14, suffix: " Tage" },
  ],
  benefit_cards: [
    { key: "c1_bg", label: "Karte 1 — Hintergrund", labelEn: "Card 1 — background", kind: "color" },
    { key: "c2_bg", label: "Karte 2 — Hintergrund", labelEn: "Card 2 — background", kind: "color" },
    { key: "accent", label: "Akzentfarbe", labelEn: "Accent color", kind: "color" },
  ],
  usp_grid: [{ key: "accent", label: "Akzentfarbe", labelEn: "Accent color", kind: "color" }],
  avatar_proof: [{ key: "accent", label: "Akzentfarbe", labelEn: "Accent color", kind: "color" }],
};

export function getBuyboxControls(type: string): BuyboxControl[] {
  return BUYBOX_CONTROLS[type] || [];
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
  luxe: "portrait",
  street: "kino",
  clinic: "thumbs-unten",
  cozy: "thumbs-links",
  sport: "kino",
  fresh: "thumbs-unten",
  family: "thumbs-unten",
  carbon: "portrait",
  retro: "thumbs-links",
  spa: "portrait",
  outdoor: "kino",
  deal: "thumbs-unten",
};

// ─── Theme-Stile v2: Default-Sektionskomposition je Stil ───────────
// Jeder Stil bringt eine eigene Seiten-ARCHITEKTUR mit (welche Sections in
// welcher Reihenfolge mit welchem Preset) — nicht nur Farben/Fonts.

export interface CompositionEntry {
  type: string;
  presetId: string;
  /** Optionale Instanz-Settings (Design-Layer: Töne/Fades/Divider, Icons) —
   *  Palette-Refs erlaubt; landen als instance.settings auf der Section. */
  settings?: Record<string, string | number | boolean>;
}

export const STYLE_COMPOSITIONS: Record<string, CompositionEntry[]> = {
  modern: [
    { type: "bro-feature-grid", presetId: "icons" },
    { type: "bro-icon-benefits", presetId: "band", settings: { sec_tone: "tint" } },
    { type: "bro-logo-badges", presetId: "marquee" },
    { type: "bro-info-tabs", presetId: "mittig" },
    { type: "reviews2", presetId: "hell", settings: { sec_tone: "wash", sec_divider: "curve" } },
    { type: "featured-collection", presetId: "galerie" },
    { type: "qanda", presetId: "glass" },
    { type: "bro-gradient-cta", presetId: "aurora" },
  ],
  elegant: [
    { type: "bro-hero-luxe", presetId: "hell" },
    { type: "image-with-text", presetId: "overlap" },
    { type: "bro-spotlight", presetId: "editorial", settings: { sec_tone: "tint" } },
    { type: "bro-logo-badges", presetId: "statisch" },
    { type: "reviews", presetId: "ruhig" },
    { type: "bro-image-cards", presetId: "versetzt", settings: { sec_tone: "wash" } },
    { type: "bro-info-tabs", presetId: "links" },
    { type: "collapsible-content", presetId: "sektion" },
  ],
  bold: [
    { type: "bro-cta-banner", presetId: "vollbild" },
    { type: "bro-icon-benefits", presetId: "band", settings: { sec_tone: "deep", sec_divider: "slant" } },
    { type: "bro-feature-grid", presetId: "kacheln" },
    { type: "bro-stats", presetId: "band" },
    { type: "reviews2", presetId: "dunkel" },
    { type: "countdown", presetId: "akzent" },
    { type: "featured-collection", presetId: "slider" },
    { type: "bro-gradient-cta", presetId: "deep" },
  ],
  playful: [
    { type: "animatedtext", presetId: "stern" },
    { type: "bro-icon-benefits", presetId: "karten", settings: { sec_tone: "soft", sec_divider: "wave" } },
    { type: "bro-feature-grid", presetId: "icons" },
    { type: "vids", presetId: "hell" },
    { type: "bro-spotlight", presetId: "karte", settings: { sec_tone: "tint" } },
    { type: "reviews2", presetId: "getoent" },
    { type: "qanda", presetId: "offen" },
    { type: "bro-gradient-cta", presetId: "mono" },
  ],
  minimal: [
    { type: "rich-text", presetId: "mittig" },
    { type: "bro-icon-benefits", presetId: "minimal" },
    { type: "bro-benefit-cards", presetId: "duo" },
    { type: "featured-collection", presetId: "editorial" },
    { type: "bro-spotlight", presetId: "editorial", settings: { sec_tone: "wash" } },
    { type: "qanda", presetId: "kompakt" },
  ],
  noir: [
    { type: "bro-hero-luxe", presetId: "dunkel" },
    { type: "bro-logo-badges", presetId: "statisch" },
    { type: "bro-icon-benefits", presetId: "band", settings: { sec_tone: "deep" } },
    { type: "reviews2", presetId: "dunkel" },
    { type: "bro-image-cards", presetId: "drei" },
    { type: "trustpilot", presetId: "kompakt" },
    { type: "bro-cta-banner", presetId: "editorial" },
  ],
  sunset: [
    { type: "image-with-text", presetId: "split" },
    { type: "bro-icon-benefits", presetId: "band", settings: { sec_tone: "tint", sec_divider: "wave" } },
    { type: "multicolumn", presetId: "karten" },
    { type: "bro-spotlight", presetId: "karte", settings: { sec_tone: "soft" } },
    { type: "reviews", presetId: "fade" },
    { type: "qanda", presetId: "glass" },
    { type: "bro-gradient-cta", presetId: "mono" },
  ],
  ocean: [
    { type: "bro-feature-grid", presetId: "icons" },
    { type: "bro-icon-benefits", presetId: "band", settings: { sec_tone: "tint" } },
    { type: "video", presetId: "standard" },
    { type: "bro-callouts", presetId: "hell", settings: { sec_tone: "wash", sec_divider: "curve" } },
    { type: "reviews2", presetId: "hell" },
    { type: "collapsible-content", presetId: "reihen" },
    { type: "bro-gradient-cta", presetId: "aurora" },
  ],
  nature: [
    { type: "image-with-text", presetId: "zentriert" },
    { type: "bro-icon-benefits", presetId: "band", settings: { sec_tone: "tint", icon_1: "leaf", icon_2: "sprout", icon_3: "shield", icon_4: "rotate" } },
    { type: "bro-benefit-cards", presetId: "duo" },
    { type: "multicolumn", presetId: "drei" },
    { type: "bro-spotlight", presetId: "editorial", settings: { sec_tone: "wash" } },
    { type: "reviews", presetId: "ruhig" },
    { type: "qanda", presetId: "glass" },
  ],
  candy: [
    { type: "bro-hero-split", presetId: "rosa" },
    { type: "animatedtext", presetId: "herz" },
    { type: "bro-icon-benefits", presetId: "karten", settings: { sec_tone: "soft", sec_divider: "wave" } },
    { type: "collage", presetId: "links" },
    { type: "reviews2", presetId: "getoent" },
    { type: "vids", presetId: "getoent" },
    { type: "countdown", presetId: "dunkel" },
    { type: "bro-gradient-cta", presetId: "mono" },
  ],
  tech: [
    { type: "bro-feature-grid", presetId: "kompakt" },
    { type: "bro-icon-benefits", presetId: "minimal", settings: { sec_tone: "wash", icon_1: "chip", icon_2: "battery", icon_3: "wifi", icon_4: "shield" } },
    { type: "bro-callouts", presetId: "glow" },
    { type: "rich-text", presetId: "mittig" },
    { type: "bro-stats", presetId: "hell", settings: { sec_tone: "tint" } },
    { type: "trustpilot", presetId: "flow" },
    { type: "qanda", presetId: "kompakt" },
    { type: "bro-gradient-cta", presetId: "aurora" },
  ],
  royal: [
    { type: "bro-cta-banner", presetId: "karte" },
    { type: "bro-logo-badges", presetId: "statisch" },
    { type: "image-with-text", presetId: "overlap" },
    { type: "bro-spotlight", presetId: "karte", settings: { sec_tone: "tint" } },
    { type: "reviews", presetId: "gross" },
    { type: "bro-image-cards", presetId: "breit", settings: { sec_tone: "wash" } },
    { type: "trustpilot", presetId: "gross" },
  ],
  luxe: [
    { type: "bro-hero-luxe", presetId: "glas" },
    { type: "bro-logo-badges", presetId: "statisch" },
    { type: "image-with-text", presetId: "bildrechts" },
    { type: "bro-spotlight", presetId: "editorial", settings: { sec_tone: "tint" } },
    { type: "bro-image-cards", presetId: "versetzt" },
    { type: "reviews", presetId: "gross", settings: { sec_tone: "wash" } },
    { type: "featured-collection", presetId: "editorial" },
    { type: "qanda", presetId: "luftig" },
  ],
  street: [
    { type: "bro-cta-banner", presetId: "streifen" },
    { type: "bro-logo-badges", presetId: "marquee", settings: { sec_tone: "deep" } },
    { type: "scrollingbild", presetId: "vollbild" },
    { type: "bro-icon-benefits", presetId: "band", settings: { sec_tone: "tint", icon_1: "fire", icon_2: "bolt", icon_3: "truck", icon_4: "shield" } },
    { type: "bro-stats", presetId: "band" },
    { type: "reviews2", presetId: "dunkel" },
    { type: "countdown", presetId: "akzent" },
    { type: "bro-gradient-cta", presetId: "deep" },
  ],
  clinic: [
    { type: "bro-steps", presetId: "kreise" },
    { type: "bro-icon-benefits", presetId: "karten", settings: { sec_tone: "tint", icon_1: "medic", icon_2: "shield", icon_3: "pulse", icon_4: "rotate" } },
    { type: "bro-guarantee", presetId: "siegel" },
    { type: "bro-callouts", presetId: "hell", settings: { sec_tone: "wash", sec_divider: "curve" } },
    { type: "bro-feature-grid", presetId: "duo" },
    { type: "reviews", presetId: "ruhig" },
    { type: "qanda", presetId: "kompakt" },
    { type: "bro-gradient-cta", presetId: "aurora" },
  ],
  cozy: [
    { type: "image-with-text", presetId: "split" },
    { type: "bro-icon-benefits", presetId: "band", settings: { sec_tone: "tint", icon_1: "home", icon_2: "bed", icon_3: "heart", icon_4: "truck" } },
    { type: "bro-benefit-cards", presetId: "duo" },
    { type: "collage", presetId: "karten" },
    { type: "bro-spotlight", presetId: "karte", settings: { sec_tone: "soft", sec_divider: "wave" } },
    { type: "benefits", presetId: "luftig" },
    { type: "reviews2", presetId: "sand" },
    { type: "photo", presetId: "getoent" },
  ],
  sport: [
    { type: "bro-cta-banner", presetId: "vollbild" },
    { type: "bro-icon-benefits", presetId: "band", settings: { sec_tone: "deep", sec_divider: "slant", icon_1: "bolt", icon_2: "pulse", icon_3: "battery", icon_4: "trophy" } },
    { type: "bro-stats", presetId: "hell" },
    { type: "vids", presetId: "dunkel" },
    { type: "bro-callouts", presetId: "glow", settings: { sec_tone: "wash" } },
    { type: "bro-feature-grid", presetId: "kacheln" },
    { type: "reviews2", presetId: "hell" },
    { type: "bro-gradient-cta", presetId: "deep" },
  ],
  fresh: [
    { type: "benefits", presetId: "standard" },
    { type: "bro-icon-benefits", presetId: "band", settings: { sec_tone: "tint", icon_1: "utensils", icon_2: "leaf", icon_3: "clock", icon_4: "smile" } },
    { type: "bro-benefit-cards", presetId: "quartett" },
    { type: "multicolumn", presetId: "karten" },
    { type: "bro-chat-reviews", presetId: "whatsapp", settings: { sec_tone: "wash", sec_divider: "wave" } },
    { type: "image-with-text", presetId: "zentriert" },
    { type: "bro-spotlight", presetId: "karte", settings: { sec_tone: "soft" } },
    { type: "qanda", presetId: "offen" },
  ],
  family: [
    { type: "bro-hero-split", presetId: "creme" },
    { type: "bro-feature-grid", presetId: "icons" },
    { type: "bro-icon-benefits", presetId: "karten", settings: { sec_tone: "soft", sec_divider: "wave", icon_1: "baby", icon_2: "heart", icon_3: "shield", icon_4: "smile" } },
    { type: "bro-chat-reviews", presetId: "imessage" },
    { type: "image-with-text", presetId: "overlap" },
    { type: "bro-spotlight", presetId: "karte", settings: { sec_tone: "tint" } },
    { type: "qanda", presetId: "luftig" },
    { type: "bro-guarantee", presetId: "akzent" },
  ],
  carbon: [
    { type: "video", presetId: "vollbreit" },
    { type: "bro-icon-benefits", presetId: "minimal", settings: { sec_tone: "deep", icon_1: "chip", icon_2: "battery", icon_3: "plug", icon_4: "wifi" } },
    { type: "bro-compare", presetId: "dunkel" },
    { type: "bro-callouts", presetId: "glow" },
    { type: "bro-stats", presetId: "band" },
    { type: "reviews2", presetId: "dunkel" },
    { type: "collapsible-content", presetId: "schlicht" },
    { type: "bro-gradient-cta", presetId: "deep" },
  ],
  retro: [
    { type: "bro-problem-solution", presetId: "gestapelt" },
    { type: "bro-logo-badges", presetId: "statisch", settings: { sec_tone: "wash" } },
    { type: "image-with-text", presetId: "bildrechts" },
    { type: "bro-spotlight", presetId: "editorial", settings: { sec_tone: "tint" } },
    { type: "reviews", presetId: "fade" },
    { type: "multicolumn", presetId: "zwei" },
    { type: "bro-cta-banner", presetId: "karte" },
  ],
  spa: [
    { type: "bro-hero-luxe", presetId: "glas" },
    { type: "image-with-text", presetId: "overlap" },
    { type: "bro-icon-benefits", presetId: "band", settings: { sec_tone: "tint", sec_divider: "wave", icon_1: "droplet", icon_2: "sun", icon_3: "sprout", icon_4: "smile" } },
    { type: "bro-steps", presetId: "timeline" },
    { type: "bro-benefit-cards", presetId: "duo" },
    { type: "bro-spotlight", presetId: "editorial", settings: { sec_tone: "soft" } },
    { type: "reviews", presetId: "ruhig" },
    { type: "bro-image-cards", presetId: "versetzt", settings: { sec_tone: "wash" } },
    { type: "photo", presetId: "hell" },
    { type: "qanda", presetId: "luftig" },
  ],
  outdoor: [
    { type: "scrollingbild", presetId: "panorama" },
    { type: "bro-icon-benefits", presetId: "band", settings: { sec_tone: "tint", icon_1: "mountain", icon_2: "compass", icon_3: "shield", icon_4: "feather" } },
    { type: "bro-feature-grid", presetId: "kacheln" },
    { type: "bro-stats", presetId: "karten", settings: { sec_tone: "wash", sec_divider: "slant" } },
    { type: "bro-image-cards", presetId: "breit" },
    { type: "reviews2", presetId: "sand" },
    { type: "map", presetId: "rechts" },
    { type: "bro-gradient-cta", presetId: "deep" },
  ],
  deal: [
    { type: "countdown", presetId: "akzent" },
    { type: "bro-icon-benefits", presetId: "band", settings: { sec_tone: "tint", icon_1: "percent", icon_2: "truck", icon_3: "rotate", icon_4: "lock" } },
    { type: "bro-compare", presetId: "klassisch" },
    { type: "bro-problem-solution", presetId: "kontrast" },
    { type: "bro-stats", presetId: "band" },
    { type: "reviews2", presetId: "getoent" },
    { type: "bro-guarantee", presetId: "akzent" },
    { type: "qanda", presetId: "kompakt" },
    { type: "bro-gradient-cta", presetId: "mono" },
  ],
};

// ─── Zufalls-Baukasten: optionale Zusatz-Sections je Stil ──────────
// Der Zufallsmodus („individuelle Anordnung") mischt die Mitte der Stil-
// Komposition und würfelt 1–2 dieser stil-passenden Extras dazu — so entsteht
// aus demselben Stil jedes Mal eine eigene Seiten-Architektur.
export const STYLE_COMPOSITION_EXTRAS: Record<string, CompositionEntry[]> = {
  modern: [
    { type: "trustpilot", presetId: "flow" },
    { type: "bro-stats", presetId: "hell" },
    { type: "rich-text", presetId: "mittig" },
    { type: "bro-guarantee", presetId: "split" },
  ],
  elegant: [
    { type: "photo", presetId: "getoent" },
    { type: "rich-text", presetId: "links" },
    { type: "bro-steps", presetId: "timeline" },
  ],
  bold: [
    { type: "bro-problem-solution", presetId: "kontrast" },
    { type: "bro-stats", presetId: "band" },
    { type: "vids", presetId: "dunkel" },
  ],
  playful: [
    { type: "bro-chat-reviews", presetId: "imessage" },
    { type: "collage", presetId: "links" },
    { type: "socialicons", presetId: "mittig" },
  ],
  minimal: [
    { type: "image-with-text", presetId: "zentriert" },
    { type: "reviews", presetId: "ruhig" },
    { type: "collapsible-content", presetId: "schlicht" },
  ],
  noir: [
    { type: "video", presetId: "vollbreit" },
    { type: "bro-stats", presetId: "band" },
    { type: "image-with-text", presetId: "bildrechts" },
  ],
  sunset: [
    { type: "photo", presetId: "getoent" },
    { type: "benefits", presetId: "luftig" },
    { type: "bro-guarantee", presetId: "akzent" },
  ],
  ocean: [
    { type: "bro-steps", presetId: "kreise" },
    { type: "bro-stats", presetId: "hell" },
    { type: "image-with-text", presetId: "split" },
  ],
  nature: [
    { type: "bro-guarantee", presetId: "siegel" },
    { type: "photo", presetId: "hell" },
    { type: "bro-steps", presetId: "timeline" },
  ],
  candy: [
    { type: "bro-chat-reviews", presetId: "imessage" },
    { type: "socialicons", presetId: "gross" },
    { type: "photo", presetId: "getoent" },
  ],
  tech: [
    { type: "bro-compare", presetId: "karten" },
    { type: "video", presetId: "standard" },
    { type: "bro-stats", presetId: "band" },
  ],
  royal: [
    { type: "scrollingbild", presetId: "karte" },
    { type: "bro-guarantee", presetId: "siegel" },
    { type: "reviews2", presetId: "getoent" },
  ],
  luxe: [
    { type: "collage", presetId: "rechts" },
    { type: "trustpilot", presetId: "premium" },
    { type: "rich-text", presetId: "breit" },
  ],
  street: [
    { type: "vids", presetId: "dunkel" },
    { type: "bro-problem-solution", presetId: "kontrast" },
    { type: "socialicons", presetId: "links" },
  ],
  clinic: [
    { type: "bro-stats", presetId: "hell" },
    { type: "collapsible-content", presetId: "reihen" },
    { type: "trustpilot", presetId: "kompakt" },
  ],
  cozy: [
    { type: "multicolumn", presetId: "zwei" },
    { type: "qanda", presetId: "offen" },
    { type: "bro-guarantee", presetId: "split" },
  ],
  sport: [
    { type: "bro-steps", presetId: "kreise" },
    { type: "bro-problem-solution", presetId: "split" },
    { type: "countdown", presetId: "dunkel" },
  ],
  fresh: [
    { type: "bro-steps", presetId: "kreise" },
    { type: "photo", presetId: "hell" },
    { type: "featured-collection", presetId: "galerie" },
  ],
  family: [
    { type: "benefits", presetId: "luftig" },
    { type: "multicolumn", presetId: "drei" },
    { type: "photo", presetId: "hell" },
  ],
  carbon: [
    { type: "bro-feature-grid", presetId: "kompakt" },
    { type: "trustpilot", presetId: "flow" },
    { type: "rich-text", presetId: "mittig" },
  ],
  retro: [
    { type: "collage", presetId: "links" },
    { type: "qanda", presetId: "offen" },
    { type: "trustpilot", presetId: "kompakt" },
  ],
  spa: [
    { type: "benefits", presetId: "schmal" },
    { type: "collage", presetId: "kartenrechts" },
    { type: "bro-chat-reviews", presetId: "neutral" },
  ],
  outdoor: [
    { type: "vids", presetId: "sand" },
    { type: "image-with-text", presetId: "split" },
    { type: "bro-problem-solution", presetId: "gestapelt" },
  ],
  deal: [
    { type: "bro-stats", presetId: "hell" },
    { type: "vids", presetId: "getoent" },
    { type: "bro-chat-reviews", presetId: "whatsapp" },
  ],
};

// ─── Verkaufs-Funnel: jede Section hat eine Rolle mit fester Stufe ─────────
// Hook → Vorteile → Autorität → Produkt-Story → Social Proof → Einwände →
// Dringlichkeit → Cross-Sell → Garantie → Abschluss → Fußbereich.
// Kompositionen werden hiernach STABIL sortiert (kuratierte Reihenfolge
// innerhalb einer Stufe bleibt) — nie wieder „FAQ vor dem Hero".

export type SectionRole =
  | "hero" | "benefits" | "authority" | "story" | "proof" | "objections"
  | "urgency" | "offer" | "guarantee" | "closing" | "footer";

const ROLE_RANK: Record<SectionRole, number> = {
  hero: 0, benefits: 1, authority: 2, story: 3, proof: 4, objections: 5,
  urgency: 6, offer: 7, guarantee: 8, closing: 9, footer: 10,
};

export const SECTION_ROLES: Record<string, SectionRole> = {
  "slideshow2": "hero", "bro-hero-luxe": "hero", "bro-hero-split": "hero",
  // bro-cta-banner ist in noir/retro der ABSCHLUSS-CTA (closing) — als Hook
  // funktioniert er nur als Anker an Position 0 (street), die der Funnel-Sort
  // ohnehin nie anfasst.
  "bro-cta-banner": "closing",
  "bro-icon-benefits": "benefits", "benefits": "benefits", "bro-feature-grid": "benefits",
  "bro-benefit-cards": "benefits", "multicolumn": "benefits",
  "bro-logo-badges": "authority", "trustpilot": "authority",
  "image-with-text": "story", "bro-callouts": "story", "bro-image-cards": "story",
  "scrollingbild": "story", "photo": "story", "collage": "story", "video": "story",
  "bro-steps": "story", "bro-info-tabs": "story", "rich-text": "story", "animatedtext": "story",
  "reviews2": "proof", "reviews": "proof", "bro-chat-reviews": "proof", "vids": "proof",
  "bro-spotlight": "proof", "bro-stats": "proof",
  "bro-compare": "objections", "bro-problem-solution": "objections", "qanda": "objections",
  "collapsible-content": "objections",
  "countdown": "urgency",
  "featured-collection": "offer", "kollektionen": "offer",
  "bro-guarantee": "guarantee",
  "bro-gradient-cta": "closing",
  "socialicons": "footer", "map": "footer",
};

export function sectionRoleRank(type: string): number {
  const role = SECTION_ROLES[type];
  return role ? ROLE_RANK[role] : ROLE_RANK.story; // Unbekanntes in die Mitte
}

/** Sortiert eine Komposition stabil nach dem Verkaufs-Funnel — der erste
 *  Eintrag bleibt als Anker (kuratierter Hook, z. B. Countdown bei „deal"). */
export function sortCompositionByFunnel(entries: CompositionEntry[]): CompositionEntry[] {
  if (entries.length <= 2) return entries;
  const [head, ...rest] = entries;
  return [head, ...[...rest].sort((a, b) => sectionRoleRank(a.type) - sectionRoleRank(b.type))];
}

/**
 * Mischt die Komposition eines Stils zu einer individuellen Variante:
 * Die erste Section bleibt als Anker (Hero-Charakter), innerhalb jeder
 * Funnel-Stufe wird permutiert und 1–2 stil-passende Extra-Sections kommen
 * dazu — das Ergebnis folgt IMMER dem Verkaufs-Funnel (Vielfalt ohne Chaos).
 * `rnd` ist injizierbar (Client-Events: Math.random).
 */
// Rollengleiche Alternativen für den Vielfalts-Tausch: gleiche Funnel-Stufe,
// gleicher Zweck — nur ein anderes Gesicht. Nur Typen mit generischen
// Inhalten (keine Kollektions-/Video-Bindung).
const ROLE_SWAP_POOLS: string[][] = [
  ["bro-icon-benefits", "bro-benefit-cards", "bro-feature-grid"],
  ["reviews2", "bro-chat-reviews", "bro-spotlight", "reviews"],
  ["qanda", "bro-compare", "bro-problem-solution"],
  ["image-with-text", "bro-callouts", "bro-image-cards"],
  ["bro-logo-badges", "trustpilot"],
];

export function shuffleComposition(styleId: string, rnd: () => number = Math.random): CompositionEntry[] {
  const base = STYLE_COMPOSITIONS[styleId] || FALLBACK_COMPOSITION;
  const head = base.slice(0, 1);
  const middle = base.slice(1).map((e) => ({ ...e }));
  for (let i = middle.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [middle[i], middle[j]] = [middle[j], middle[i]];
  }
  const used = new Set(base.map((e) => e.type));
  // 1–2 Sections gegen ROLLENGLEICHE Alternativen tauschen — dadurch sehen
  // zwei Produkte im selben Stil wirklich unterschiedlich aus (nicht nur
  // andere Reihenfolge). Ton-Marker (settings) wandern mit.
  let swaps = 0;
  for (const entry of middle) {
    if (swaps >= 2) break;
    const pool = ROLE_SWAP_POOLS.find((p) => p.includes(entry.type));
    if (!pool || rnd() >= 0.45) continue;
    const candidates = pool.filter((t) => t !== entry.type && !used.has(t));
    if (!candidates.length) continue;
    const nextType = candidates[Math.floor(rnd() * candidates.length)];
    const def = getSectionDef(nextType);
    if (!def?.presets.length) continue;
    used.delete(entry.type);
    used.add(nextType);
    entry.type = nextType;
    entry.presetId = def.presets[Math.floor(rnd() * def.presets.length)].id;
    swaps++;
  }
  const pool = (STYLE_COMPOSITION_EXTRAS[styleId] || []).filter((e) => !used.has(e.type));
  const take = pool.length ? 1 + Math.floor(rnd() * Math.min(2, pool.length)) : 0;
  for (let k = 0; k < take; k++) {
    const idx = Math.floor(rnd() * pool.length);
    const [extra] = pool.splice(idx, 1);
    middle.splice(Math.floor(rnd() * (middle.length + 1)), 0, extra);
  }
  // Volle Permutation + stabile Funnel-Sortierung = Zufall NUR innerhalb
  // der Funnel-Stufen; die Stufen selbst stehen immer richtig.
  return sortCompositionByFunnel([...head, ...middle]);
}

const FALLBACK_COMPOSITION: CompositionEntry[] = STYLE_COMPOSITIONS.modern;

/** Deterministischer PRNG (mulberry32) aus einem String-Seed — Client und
 *  Server erzeugen für dasselbe Produkt+Stil exakt dieselbe Komposition. */
export function seededRnd(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
  /** Optionale Kompositions-Variante (z. B. aus shuffleComposition) statt der Stil-Default-Komposition. */
  compositionOverride?: CompositionEntry[],
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
  // Komposition immer durch den Verkaufs-Funnel normalisieren (Anker bleibt) —
  // egal ob Stil-Default, Shuffle-Variante oder ältere Overrides.
  // OHNE Override: pro Produkt+Stil deterministisch „gewürfelt" (Seed) —
  // zwei Produkte im selben Stil sehen nie identisch aus, aber dasselbe
  // Produkt baut immer dasselbe Dokument (Client/Server-Parität für AI-Ops).
  const composition = sortCompositionByFunnel(
    compositionOverride?.length
      ? compositionOverride
      : shuffleComposition(style.id, seededRnd(`${productId}|${style.id}`)),
  );
  const sections: SectionInstance[] = [];
  // Formen-Rhythmus: getönte Sections OHNE explizite Übergangs-Marker bekommen
  // deterministisch (Stil + Position) eine Formen-Kante — Wellen/Zacken statt
  // Fades; dunkle Panels werden oben UND unten von der Seitenfarbe angeschnitten.
  const styleOffset = Array.from(style.id).reduce((a, c) => a + c.charCodeAt(0), 0);
  let toneIdx = 0;
  for (const entry of composition) {
    if (caps.size && !caps.has(entry.type)) continue; // Basis kennt den Typ nicht
    const base = baseSections.find((b) => b.type === entry.type && !used.has(b.id));
    // Kompakte Ton-Marker ({ sec_tone: "tint", … }) in konkrete Design-
    // Settings der Stil-Palette expandieren (Vorschau = Download).
    let settings = entry.settings ? { ...entry.settings } : undefined;
    if (settings && typeof settings.sec_tone === "string" && SECTION_TONES.includes(settings.sec_tone as SectionTone)) {
      const { sec_tone, sec_fade, sec_divider, sec_divider_top, ...rest } = settings;
      const tone = sec_tone as SectionTone;
      let divider = typeof sec_divider === "string" ? (sec_divider as (typeof SECTION_DIVIDERS)[number]) : undefined;
      let dividerTop = typeof sec_divider_top === "string" ? (sec_divider_top as (typeof SECTION_DIVIDERS)[number]) : undefined;
      const hasExplicitEdge = divider !== undefined || dividerTop !== undefined || typeof sec_fade === "string";
      if (!hasExplicitEdge && tone !== "none") {
        const shapes = SECTION_DIVIDERS.filter((d) => d !== "none");
        divider = shapes[(styleOffset + toneIdx) % shapes.length];
        if (tone === "deep") dividerTop = shapes[(styleOffset + toneIdx + 2) % shapes.length];
        toneIdx++;
      }
      settings = {
        ...sectionToneSettings(tone, style.palette, {
          fade: typeof sec_fade === "string" ? (sec_fade as (typeof SECTION_FADES)[number]) : undefined,
          divider,
          dividerTop,
        }),
        ...rest,
      };
    }
    if (base) {
      used.add(base.id);
      sections.push({ uid: base.id, type: entry.type, presetId: entry.presetId, source: "template", texts: {}, settings });
    } else {
      sections.push({ uid: newSectionUid(), type: entry.type, presetId: entry.presetId, source: "library", texts: {}, settings });
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
