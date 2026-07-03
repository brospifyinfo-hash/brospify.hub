// ─── Theme-Platzhalter-Schema ────────────────────────────────────
// Single Source of Truth für die Tokens der Master-Schablone.
//
// Konvention: Keys sind OHNE Klammern (z. B. `PRODUCT_USP_1`). Im Theme
// steht das Token MIT Klammern (`[[PRODUCT_USP_1]]`). Die Injection
// (theme-inject.ts) ersetzt `[[KEY]]` → Wert.
//
// Quelle der Keys: hub_template_mapping.md der Schablone (aktive Sections).

export interface ThemeCopySpecItem {
  key: string;
  hint: string;
}

/** Vom KI-„Creator" zu generierende Verkaufstexte (Key → was reingehört). */
export const PRODUCT_COPY_SPEC: ThemeCopySpecItem[] = [
  { key: "SLIDE_1_HEADING", hint: "Knackige Hook-Headline (max. 6 Wörter), Nutzen + Emotion." },
  { key: "SLIDE_1_SUBHEADING", hint: "1 Satz, der den Hauptvorteil zuspitzt." },
  { key: "SLIDE_1_BTN_TEXT", hint: "Handlungsstarker CTA in Großbuchstaben, 2–3 Wörter." },
  { key: "EXPLAIN_SUBTITLE", hint: "Neugier-Frage als Eyebrow (z. B. 'Warum X?')." },
  { key: "EXPLAIN_TITLE", hint: "Kurzer Abschnittstitel (1–2 Wörter)." },
  { key: "EXPLAIN_TEXT", hint: "2–3 Sätze, die das Produkt/Prinzip erklären. Darf <strong> nutzen." },
  { key: "BRAND_TITLE", hint: "Vertrauens-/Markenversprechen als Headline." },
  { key: "BRAND_DESCRIPTION", hint: "Kurzer Markenabsatz (1–2 Sätze), in <p>…</p>." },
  { key: "CONTENT_HEADING", hint: "Feature-Block-Headline (Großbuchstaben erlaubt)." },
  { key: "CONTENT_TEXT", hint: "1–2 Sätze Story/Feature, in <p>…</p>." },
  { key: "PRODUCT_USP_1", hint: "USP/Trust-Item 1 (3–4 Wörter), z. B. Versand." },
  { key: "PRODUCT_USP_2", hint: "USP/Trust-Item 2 (3–4 Wörter), z. B. Rückgabe." },
  { key: "PRODUCT_USP_3", hint: "USP/Trust-Item 3 (3–4 Wörter), z. B. Bezahlung." },
  { key: "PRODUCT_USP_4", hint: "USP/Trust-Item 4 (3–4 Wörter), z. B. Qualität." },
  { key: "PRODUCT_STOCK_TEXT", hint: "Verfügbarkeits-/Dringlichkeits-Hinweis, 2–4 Wörter." },
  { key: "BUNDLE_HEADING", hint: "Angebots-Überschrift über den Mengen-Optionen." },
  { key: "ACCORDION_1_HEADING", hint: "FAQ/Info-Akkordeon-Titel." },
  { key: "ACCORDION_1_CONTENT", hint: "Antwort/Detailtext im Akkordeon, in <p>…</p>." },
  { key: "INFO_TAB_1_BODY", hint: "Produktbeschreibung (2–3 Sätze), in <p>…</p>." },
  { key: "REVIEWS_HEADING", hint: "Social-Proof-Überschrift in Großbuchstaben." },
  { key: "REVIEW2_1_QUOTE", hint: "Authentisches Kundenzitat (1–2 Sätze)." },
  { key: "REVIEW2_1_AUTHOR", hint: "Vorname + Initiale, z. B. 'Sarah M.'." },
  { key: "PARALLAX_HEADLINE", hint: "Großer Vollbild-Claim (1 Satz)." },
  { key: "PARALLAX_TEXT", hint: "1 Satz Untertext, in <p>…</p>, darf <strong> nutzen." },
];

export const AI_KEYS: string[] = PRODUCT_COPY_SPEC.map((s) => s.key);

export type ThemeCopy = Record<string, string>;

/**
 * Defaults für shop-generische / strukturelle Platzhalter, die NICHT pro
 * Produkt generiert werden — damit im Export kein rohes `[[…]]` stehen bleibt.
 * Produkt-Werte überschreiben Defaults.
 */
export const DEFAULTS: ThemeCopy = {
  SLIDE_2_HEADING: "Überzeugt auf den ersten Blick",
  SLIDE_2_SUBHEADING: "Tausende zufriedene Kunden vertrauen uns bereits.",
  SLIDE_2_BTN_TEXT: "JETZT SICHERN",
  SLIDE_1_BOX1_LABEL: "Einzelpack",
  SLIDE_1_BOX1_PRICE: "29,99€",
  SLIDE_1_BOX2_LABEL: "Vorteilspack",
  SLIDE_1_BOX2_PRICE: "49,99€",
  SLIDE_1_BOX2_BADGE: "Beliebt",
  SLIDE_2_BOX1_LABEL: "Einzelpack",
  SLIDE_2_BOX1_PRICE: "29,99€",
  SLIDE_2_BOX2_LABEL: "Vorteilspack",
  SLIDE_2_BOX2_PRICE: "49,99€",
  SLIDE_2_BOX2_BADGE: "Beliebt",
  BENEFIT_1_TITLE: "Bequem auf Rechnung",
  BENEFIT_1_TEXT: "Bezahle entspannt mit <strong>PayPal</strong> oder <strong>Klarna</strong>.",
  BENEFIT_2_TITLE: "Schneller DHL-Versand",
  BENEFIT_2_TEXT: "Dein Paket ist in <strong>1–3 Tagen</strong> bei dir Zuhause.",
  BRAND_SUBTITLE: "Unsere Marke",
  BRAND_BUTTON_LABEL: "MEHR ENTDECKEN",
  CONTENT_BUTTON_TEXT: "JETZT ENTDECKEN",
  MAP_ADDRESS: "Berlin, Germany",
  MAP_SUBTITLE: "Besuche uns",
  MAP_TITLE: "Unser Standort",
  MAP_TEXT: "<p>Wir sind für dich da — bei Fragen melde dich jederzeit gerne bei uns.</p>",
  MAP_BTN_LABEL: "Route planen",
  REVIEWS_HIGHLIGHT: "10.000+",
  REVIEWS_TOTAL_TEXT: "Basierend auf tausenden Bewertungen",
  REVIEW_CAT_1_LABEL: "Qualität",
  REVIEW_CAT_2_LABEL: "Haltbarkeit",
  REVIEW_CAT_3_LABEL: "Design",
  REVIEW_CAT_4_LABEL: "Preis-Leistung",
  REVIEWS2_EYEBROW: "Aus der Community",
  REVIEWS2_HEADLINE: "Echte Stimmen,",
  REVIEWS2_HEADLINE_EM: "echte Ergebnisse.",
  REVIEWS2_SUBLINE: "Unsere Kunden teilen ihre Erfahrungen — ehrlich und ungefiltert.",
  PRODUCT_BADGE_TEXT: "BESTSELLER",
  PRODUCT_RATING_TEXT: "Top bewertet",
  BUNDLE_OPT2_BADGE: "Am beliebtesten",
  GIFT_TITLE: "Sichere dir dein Geschenk",
  GIFT_SUBTITLE: "Lege einen Gratis-Artikel in deinen Warenkorb.",
  ACCORDION_2_HEADING: "Versand & Lieferung",
  ACCORDION_2_CONTENT: "<p>Schneller, versicherter Versand mit Sendungsverfolgung.</p>",
  INFO_TABS_HEADING: "Mehr über das Produkt",
  INFO_TAB_2_BODY: "<p>Kostenloser, schneller Versand.</p>",
  INFO_TAB_3_BODY: "<p>30 Tage Geld-zurück-Garantie.</p>",
  INFO_TAB_4_BODY: "<p>Pflegeleicht und langlebig.</p>",
  PARALLAX_CTA_PRIMARY: "Jetzt kaufen",
  PARALLAX_CTA_SECONDARY: "Mehr erfahren",
  SOCIAL_HEADING: "Folge uns gerne ❤️",
  VIDS_TITLE: "Das sagen unsere Kunden",
  VIDS_SUBTITLE: "Echte Erfahrungen in Bild & Ton",
  FEATURED_COLLECTION_TITLE: "Beliebte Produkte",
  P_REVIEWS_HIGHLIGHT: "10.000+",
  P_REVIEWS_HEADING: "KUNDEN LIEBEN ES",
  P_REVIEWS_TOTAL_TEXT: "Basierend auf tausenden Bewertungen",
  P_REVIEWS2_EYEBROW: "Aus der Community",
  P_REVIEWS2_HEADLINE: "Echte Stimmen,",
  P_REVIEWS2_HEADLINE_EM: "echte Ergebnisse.",
  P_REVIEWS2_SUBLINE: "Tausende zufriedene Kunden — sieh selbst.",
};

// Wiederkehrende Defaults (Reviews, Testimonials, Kategorien, Bilder).
const REVIEW_FILLER: [string, string, string, string][] = [
  ["Top Qualität, schnelle Lieferung — absolut empfehlenswert!", "Sarah M.", "München", "vor 2 Tagen"],
  ["Hat meine Erwartungen übertroffen. Klare Kaufempfehlung.", "Tom K.", "Berlin", "vor 1 Woche"],
  ["Endlich ein Produkt, das hält was es verspricht.", "Laura B.", "Hamburg", "vor 3 Tagen"],
  ["Super Preis-Leistung, gerne wieder.", "Nico W.", "Köln", "vor 5 Tagen"],
  ["Schnell geliefert und top verpackt. 5 Sterne!", "Julia S.", "Frankfurt", "vor 4 Tagen"],
  ["Genau wie beschrieben, sehr zufrieden.", "Petra H.", "Stuttgart", "vor 1 Monat"],
];
for (let i = 1; i <= 6; i++) {
  const [q, a, l, d] = REVIEW_FILLER[i - 1];
  DEFAULTS[`REVIEW2_${i}_QUOTE`] = q;
  DEFAULTS[`REVIEW2_${i}_AUTHOR`] = a;
  DEFAULTS[`REVIEW2_${i}_LOCATION`] = l;
  DEFAULTS[`REVIEW2_${i}_DATE`] = d;
}
for (let i = 1; i <= 5; i++) {
  const [q, a, l, d] = REVIEW_FILLER[i - 1];
  DEFAULTS[`P_REVIEW2_${i}_QUOTE`] = q;
  DEFAULTS[`P_REVIEW2_${i}_AUTHOR`] = a;
  DEFAULTS[`P_REVIEW2_${i}_LOCATION`] = l;
  DEFAULTS[`P_REVIEW2_${i}_DATE`] = d;
  DEFAULTS[`P_REVIEW_CAT_${i}_LABEL`] = ["Qualität", "Haltbarkeit", "Design", "Preis-Leistung", "Verarbeitung"][i - 1];
  DEFAULTS[`VIDS_T${i}_NAME`] = REVIEW_FILLER[i - 1][1];
  DEFAULTS[`VIDS_T${i}_MESSAGE`] = REVIEW_FILLER[i - 1][0];
}
// Bild-Links: Default leer (= kein Bild statt rohem Token). Echte Bild-URLs
// können über dieselben Keys (IMAGE_URL_1 … _7) injiziert werden.
for (let i = 1; i <= 7; i++) DEFAULTS[`IMAGE_URL_${i}`] = "";

/** Best-Practice-Beispiele, gegen die der Validator prüft. */
export const ENGLISH_EXAMPLES = [
  { note: "Benefit-driven hook, not feature-driven.", good: "Sleep Through Any Noise — Finally.", bad: "High-Density Foam Earplugs 32dB" },
  { note: "Concrete sensory benefit + light urgency, no hype.", good: "Soothes sore muscles in minutes — so you recover faster.", bad: "The best amazing revolutionary item ever!!!" },
  { note: "Human, specific social proof.", good: "\"After one week my back pain was basically gone.\" — Mark T.", bad: "Great product. Five stars." },
  { note: "CTA = action + value, short and confident.", good: "CLAIM MY DISCOUNT", bad: "Submit" },
];

/**
 * Beispiel-Texte für die AI-Keys (PRODUCT_COPY_SPEC) — greifen NUR, wenn für
 * ein Produkt (noch) kein generierter Text vorliegt. So steht in Vorschau UND
 * Download nie ein rohes `[[SLIDE_1_HEADING]]` o. Ä. Echte Produkt-Texte
 * überschreiben diese Beispiele.
 */
export const AI_EXAMPLE: ThemeCopy = {
  SLIDE_1_HEADING: "Spürbar besser — ab dem ersten Tag",
  SLIDE_1_SUBHEADING: "Der einfache Weg zu einem Ergebnis, das du wirklich merkst.",
  SLIDE_1_BTN_TEXT: "JETZT SICHERN",
  EXPLAIN_SUBTITLE: "Warum funktioniert es?",
  EXPLAIN_TITLE: "So einfach geht's",
  EXPLAIN_TEXT: "Durchdachtes Design trifft <strong>Premium-Qualität</strong> — für ein Ergebnis, das du jeden Tag spürst.",
  BRAND_TITLE: "Qualität, der tausende vertrauen",
  BRAND_DESCRIPTION: "<p>Wir entwickeln Produkte, die halten, was sie versprechen — fair produziert und sorgfältig getestet.</p>",
  CONTENT_HEADING: "Gemacht für deinen Alltag",
  CONTENT_TEXT: "<p>Einfach, zuverlässig und durchdacht bis ins Detail — damit du dich auf das Wesentliche konzentrieren kannst.</p>",
  PRODUCT_USP_1: "Kostenloser Versand",
  PRODUCT_USP_2: "30 Tage Rückgabe",
  PRODUCT_USP_3: "Sichere Bezahlung",
  PRODUCT_USP_4: "Premium-Qualität",
  PRODUCT_STOCK_TEXT: "Nur noch wenige verfügbar",
  BUNDLE_HEADING: "Wähle dein Paket",
  ACCORDION_1_HEADING: "Häufige Fragen",
  ACCORDION_1_CONTENT: "<p>Alles, was du wissen musst — klar und ehrlich beantwortet.</p>",
  INFO_TAB_1_BODY: "<p>Hochwertige Materialien, durchdachtes Design und eine Verarbeitung, die überzeugt.</p>",
  REVIEWS_HEADING: "DAS SAGEN UNSERE KUNDEN",
  PARALLAX_HEADLINE: "Erlebe den Unterschied",
  PARALLAX_TEXT: "<p>Tausende haben es schon entdeckt — <strong>jetzt bist du dran.</strong></p>",
};

const RAW_TOKEN_RE = /^\[\[[A-Z0-9_]+\]\]$/;

/** Finale Werte für die Injection: Defaults ⊕ AI-Beispiele ⊕ echte Produkt-Texte.
 *  Leere oder als rohes `[[TOKEN]]` gespeicherte Produkt-Werte werden ignoriert,
 *  damit sie die Beispiel-Defaults nicht „überschreiben". */
export function getPlaceholderValues(themeCopy?: ThemeCopy | null): ThemeCopy {
  const clean: ThemeCopy = {};
  if (themeCopy) {
    for (const [k, v] of Object.entries(themeCopy)) {
      if (typeof v === "string" && v.trim() && !RAW_TOKEN_RE.test(v.trim())) clean[k] = v;
    }
  }
  return { ...DEFAULTS, ...AI_EXAMPLE, ...clean };
}

// ─── Farb-Palette → Section-Settings (geteilt: Inject UND Live-Vorschau) ──
// Damit das, was der Kunde in der Vorschau sieht, EXAKT dem Download
// entspricht, nutzen beide dieselbe Rollen-Zuordnung: bestimmte Setting-Keys
// (in den aktiven Sections) werden auf eine Palette-Rolle umgefärbt.

export interface ColorPalette {
  button: string;
  buttonText: string;
  background: string;
  text: string;
  accent: string;
}

export const RECOLOR_ROLES = {
  accent: [
    "accent_color", "star_color", "wave_color", "underline_color", "dot_active",
    "pin_color", "color_accent", "btn_border_color", "box2_badge_bg",
    "badge_bg_color", "box_border_color", "heading_highlight_color",
    // Kaufbox (main-product): Bundle-Auswahl/-Badge, Galerie-Badge & aktiver
    // Thumb-Rahmen, Timeline-Kreise/Countdown — die Vorschau färbt all das
    // per --pv-accent, also MUSS der Export dieselben Keys umfärben.
    "active_border", "badge_bg", "pg_badge_bg", "pg_thumb_active_border",
    "countdown_color", "circle_bg",
  ],
  button: ["btn_bg_color", "button_bg", "btn_primary_bg", "cta_bg", "primary_bg"],
  buttonText: ["btn_text_color", "button_text_color", "btn_primary_text", "primary_fg"],
} as const;

const COLORISH = /^(#[0-9a-fA-F]{3,8}|rgba?\([\d.,\s%]+\))$/;

/** Liefert die Palette-Farbe für einen Setting-Key — oder null (Wert behalten). */
export function recolorByRole(key: string, value: string, palette: ColorPalette): string | null {
  if (typeof value !== "string" || !COLORISH.test(value)) return null;
  if ((RECOLOR_ROLES.accent as readonly string[]).includes(key)) return palette.accent;
  if ((RECOLOR_ROLES.button as readonly string[]).includes(key)) return palette.button;
  if ((RECOLOR_ROLES.buttonText as readonly string[]).includes(key)) return palette.buttonText;
  return null;
}

/** Stellt sicher, dass nur die Spec-Keys vorhanden sind (fehlende → Token). */
export function coerceToSpec(obj: Record<string, unknown> | null | undefined): ThemeCopy {
  const out: ThemeCopy = {};
  for (const key of AI_KEYS) {
    const v = obj && typeof obj[key] === "string" ? (obj[key] as string).trim() : "";
    out[key] = v || `[[${key}]]`;
  }
  return out;
}
