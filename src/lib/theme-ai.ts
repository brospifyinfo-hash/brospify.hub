// ─── AI Co-Pilot: Plan-Generierung (server-only) ────────────────────
// Claude (Vision + Structured Output) bekommt das aktuelle ThemeDocument,
// den Nutzerwunsch und optionale Produktbilder und liefert einen PLAN:
// menschenlesbare Schritte + strukturierte Operationen aus der Whitelist in
// theme-ai-ops. Die AI führt NIE selbst aus — der Nutzer bestätigt zuerst.
//
// KOSTEN-ARCHITEKTUR (2026-07):
//  - Zwei Modi: "standard" (Claude Sonnet 5 — günstig, Alltag) und
//    "expert" (Claude Opus 4.8 — teurer, maximale Qualität).
//  - Prompt-Caching: der große statische System-Prompt (Regeln + Katalog)
//    trägt cache_control — Folge-Aufrufe innerhalb der TTL lesen ihn zu
//    ~10 % des Input-Preises. Deshalb darf NICHTS Dynamisches in den
//    System-Prompt (Produkt, Dokument, Lern-Hinweise → User-Content!).
//  - Dokument-Kompaktierung: lange Texte werden für den Prompt gekürzt
//    (die AI schreibt ohnehin neue) — spart je nach Doc 30–60 % Input.
//  - Lern-Hinweise (theme-ai-learn): bewährte Muster früherer Läufe der
//    gleichen Nische machen auch das Standard-Modell treffsicher.
// Kosten werden im Provider-Ledger verbucht (recordUsd).

import Anthropic from "@anthropic-ai/sdk";
import { recordUsd, anthropicCostUsd } from "@/lib/provider-usage";
import type { ThemeDocument } from "@/lib/theme-doc";
import {
  SECTION_LIBRARY,
  BUYBOX_LIBRARY,
  BUYBOX_CONTROLS,
  GALLERY_PRESETS,
  SECTION_ROLES,
} from "@/lib/theme-library";
import { THEME_STYLES } from "@/lib/theme-styles";
import { BUYBOX_DEFAULT_ORDER, BUYBOX_RUNTIME_ONLY, BUYBOX_CANONICAL_ORDER } from "@/lib/theme-sections";
import { THEME_ICONS } from "@/lib/theme-icons";
import { EDITOR_FONTS } from "@/components/theme-editor/editor-ui";

// ─── Modell-Modi ────────────────────────────────────────────────────

export type ThemeAiMode = "standard" | "expert";

export const THEME_AI_MODELS: Record<ThemeAiMode, string> = {
  standard: "claude-sonnet-5",
  expert: "claude-opus-4-8",
};

export function normalizeAiMode(v: unknown): ThemeAiMode {
  return v === "expert" ? "expert" : "standard";
}

export interface ThemeAiImage {
  /** image/png | image/jpeg | image/webp | image/gif */
  mediaType: string;
  /** Base64 OHNE data:-Prefix. */
  data: string;
}

export interface ThemeAiInput {
  doc: ThemeDocument;
  prompt: string;
  images: ThemeAiImage[];
  /** Client-seitig aus den Bildern extrahierte Farbtöne (Hex) — Zusatz-Hinweis. */
  paletteHints: string[];
  productTitle: string;
  lang: "de" | "en";
  mode: ThemeAiMode;
  /** Kompakter Wissens-Block aus früheren erfolgreichen Läufen (theme-ai-learn). */
  learnHints?: string;
  /** Vom Nutzer für die AI markierte Section-uids — die AI ändert primär diese. */
  focus?: string[];
}

export interface ThemeAiRawPlan {
  summary: string;
  steps: { title: string; detail: string }[];
  operations: unknown[];
}

// ─── Struktur-Schema der Antwort (Structured Output) ───────────────
// Alle Objekte mit additionalProperties:false (Pflicht bei json_schema);
// die Ops-Items tragen ALLE möglichen Felder als optionale Properties —
// die harte Validierung passiert danach in validateAiOps.

const DIVIDER_ENUM = ["none", "wave", "waves", "zigzag", "slant", "curve", "peaks"];

const OP_ITEM_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["op"],
  properties: {
    op: { type: "string" },
    styleId: { type: "string" },
    mode: { type: "string", enum: ["design", "full"] },
    colors: {
      type: "object",
      additionalProperties: false,
      properties: {
        button: { type: "string" },
        buttonText: { type: "string" },
        background: { type: "string" },
        text: { type: "string" },
        accent: { type: "string" },
      },
    },
    headingFont: { type: "string" },
    bodyFont: { type: "string" },
    radius: { type: "integer" },
    shadow: { type: "integer" },
    border: { type: "integer" },
    iconStyle: { type: "string" },
    page: { type: "string", enum: ["product", "home"] },
    type: { type: "string" },
    presetId: { type: "string" },
    position: { type: "integer" },
    uid: { type: "string" },
    to: { type: "integer" },
    field: { type: "string" },
    value: { anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }] },
    texts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "value"],
        properties: { field: { type: "string" }, value: { type: "string" } },
      },
    },
    blockType: { type: "string" },
    order: { type: "array", items: { type: "string" } },
    key: { type: "string" },
    badge: { type: "string" },
    spacing: { type: "integer" },
    tone: { type: "string", enum: ["none", "tint", "soft", "wash", "deep"] },
    divider: { type: "string", enum: DIVIDER_ENUM },
    dividerTop: { type: "string", enum: DIVIDER_ENUM },
    icons: { type: "array", items: { type: "string" } },
  },
};

const PLAN_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "steps", "operations"],
  properties: {
    summary: { type: "string" },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail"],
        properties: { title: { type: "string" }, detail: { type: "string" } },
      },
    },
    operations: { type: "array", items: OP_ITEM_SCHEMA },
  },
};

// ─── Katalog: was die AI verwenden darf (kompakt, aus den Bibliotheken) ──

let catalogCache: string | null = null;
function buildCatalog(): string {
  if (catalogCache) return catalogCache;
  const styles = THEME_STYLES.map((s) => `${s.id} („${s.label}“ — ${s.hint})`).join(", ");
  const fonts = EDITOR_FONTS.map((f) => f.value).join(", ");
  const roleOf = (t: string) => SECTION_ROLES[t] || "story";
  const sections = SECTION_LIBRARY.map((d) => {
    const presets = d.presets.map((p) => p.id).join("|");
    const fields = d.fields.map((f) => f.id).join(",") || "-";
    return `  ${d.type} [rolle:${roleOf(d.type)}] „${d.label}“ · presets: ${presets} · textfelder: ${fields}`;
  }).join("\n");
  const libByType = new Map(BUYBOX_LIBRARY.map((b) => [b.type, b]));
  const allBlocks = Array.from(new Set([...BUYBOX_DEFAULT_ORDER, ...BUYBOX_RUNTIME_ONLY]));
  const blocks = allBlocks.map((t) => {
    const lib = libByType.get(t);
    const presets = lib?.presets.map((p) => p.id).join("|") || "-";
    const fields = lib?.fields.map((f) => f.id).join(",") || "-";
    const ctls = (BUYBOX_CONTROLS[t] || [])
      .map((c) => `${c.key}(${c.kind}${c.kind === "segment" ? ":" + (c.options || []).map((o) => o.value).join("/") : c.kind === "slider" ? `:${c.min}-${c.max}` : ""})`)
      .join(",");
    return `  ${t} · presets: ${presets} · textfelder: ${fields}${ctls ? ` · settings: ${ctls}` : ""}`;
  }).join("\n");
  const gallery = GALLERY_PRESETS.map((p) => p.id).join("|");
  const icons = THEME_ICONS.map((i) => `${i.id}(${i.label})`).join(", ");

  catalogCache = [
    `THEME-STILE (styleId): ${styles}`,
    `SCHRIFTEN (headingFont/bodyFont): ${fonts}`,
    `GALERIE-PRESETS (set_gallery.presetId): ${gallery}`,
    `BASIS-ICONS: ${icons}`,
    `WEITERE ICONS: Du hast zusätzlich Zugriff auf ~1.700 Lucide-Icons. Nutze dafür einfach englische kebab-case-Begriffe als Icon-Wert (z. B. "dog", "heart-pulse", "washing-machine", "sun", "battery-charging") — das System löst sie automatisch auf das passende Icon auf. Wähle IMMER das nischen-spezifischste Icon (Hundebett → "dog", nicht "check").`,
    `KAUFBOX-REIHENFOLGE (bewährtes Funnel-Muster für reorder_buybox): ${BUYBOX_CANONICAL_ORDER.join(" → ")}`,
    `SECTIONS (add_section.type — nur diese Typen/Presets/Felder; rolle = Platz im Funnel):\n${sections}`,
    `KAUFBOX-BAUSTEINE (blockType — nur diese Typen/Presets/Felder/Settings):\n${blocks}`,
  ].join("\n\n");
  return catalogCache;
}

// ─── System-Prompt ──────────────────────────────────────────────────
// WICHTIG: Der System-Prompt ist STATISCH (nur lang-abhängig) und wird per
// cache_control gecacht — niemals Produkt-/Dokument-/Zeit-Daten einbauen!

function buildSystem(lang: "de" | "en"): string {
  const answerLang = lang === "en" ? "Englisch" : "Deutsch";
  return `Du bist der AI Co-Pilot des Brospify Theme-Editors — ein Experte für hochkonvertierende Shopify-Dropshipping-Shops.

Du bekommst das aktuelle Theme-Dokument (JSON, lange Texte gekürzt), den Wunsch des Nutzers und optional Produktbilder. Du erstellst einen PLAN: verständliche Schritte + präzise Operationen. Du führst NICHTS selbst aus — der Nutzer bestätigt zuerst.

OPERATIONEN (Feld "op", nur diese):
- set_style {styleId, mode:"design"|"full"} — Gesamt-Stil. "design"=nur Farben/Schriften/Design (Aufbau bleibt), "full"=Seiten werden nach Stil-Komposition NEU gebaut (nur bei ausdrücklichem Komplett-Umbau-Wunsch).
- set_colors {colors:{button?,buttonText?,background?,text?,accent?}} — Hex #rrggbb.
- set_fonts {headingFont?, bodyFont?} · set_radius {radius:0-40} · set_design {shadow?:0|1|2, border?:1|2, iconStyle?:"dark"|"accent"|"outline"}.
- add_section {page:"product"|"home", type, presetId?, position?, texts?:[{field,value}], uid?:"new:1"} — uid als Platzhalter, um die neue Section in Folge-Ops zu referenzieren.
- remove_section {uid} · move_section {uid, to} · set_section_preset {uid, presetId} · set_section_text {uid, field, value}.
- set_section_tone {uid, tone:"none"|"tint"|"soft"|"wash"|"deep", divider?, dividerTop?} — kräftiger Hintergrund-Ton der Section, automatisch stimmig aus der Palette abgeleitet. divider/dividerTop = Formen-Kante unten/oben: "none"|"wave"|"waves"|"zigzag"|"slant"|"curve"|"peaks".
- set_section_setting {uid, key, value} — nur sec_bg/sec_bg2 (Hex), sec_divider, sec_divider_top, icon_1..icon_4 (Icon-ID oder englisches Keyword).
- set_benefit_icons {icons:["id","id","id","id"]} — die 4 Icons der Kaufbox-Vorteile (IDs oder englische Keywords).
- add_buybox_block {blockType, position?, presetId?} · remove_buybox_block {blockType} · reorder_buybox {order:[blockType,…]}.
- set_block_preset {blockType, presetId} · set_block_text {blockType, field, value} · set_block_setting {blockType, key, value}.
- set_gallery {presetId?, badge?} · set_buybox_spacing {spacing:4-40}.

HARTE REGELN:
1. Verwende AUSSCHLIESSLICH styleIds, Section-Typen, presetIds, Feld-IDs, blockTypes, Setting-Keys und Schriften aus dem Katalog unten. Icons dürfen zusätzlich freie englische Keywords sein.
2. Section-uids nur aus dem Dokument übernehmen — neue Sections bekommen "new:1", "new:2", ….
3. Farben immer als #rrggbb. Achte IMMER auf Kontrast: text lesbar auf background, buttonText lesbar auf button.
4. Produktbild dabei + keine expliziten Farbwünsche? → Leite eine stimmige Palette aus dem Bild ab (accent = markante Produkt-/Markenfarbe; background hell und dezent, außer ein dunkler Look passt/ist gewünscht).
5. set_style (falls genutzt) steht IMMER als erste Operation — Detail-Ops danach, damit sie den Stil verfeinern. Max. 48 Operationen.
6. summary (1–2 Sätze) und steps (2–8) auf ${answerLang}, für Laien verständlich — KEINE technischen op-Namen oder IDs in den Schritten. Jeder Schritt beschreibt eine sichtbare Veränderung.
7. Ist der Wunsch mit den verfügbaren Operationen nicht umsetzbar, liefere die nächstbeste sinnvolle Annäherung — operations darf nur leer sein, wenn wirklich gar nichts passt (das erklärst du dann in summary).

ART-DIRECTION (so entsteht ein Ergebnis auf Agentur-Niveau — dein Anspruch bei JEDEM Plan):
A. KOMPAKTE VOLLE SEITE als Funnel: Bei Nischen-/Umbau-Wünschen baue die Produktseite KOMPAKT mit 6–9 Sections (NICHT mehr — lieber wenige, dafür jede stark; 10–12 lange Sektionen wirken überladen UND dauern in der Generierung zu lange) entlang der Funnel-Rollen (Reihenfolge = Rollen-Reihenfolge): hero → benefits → authority → story → proof → objections → urgency/offer → guarantee → closing. Nicht jede Rolle muss vorkommen — wähle die 6–9 STÄRKSTEN für diese Nische, pro Rolle EINE Section aus den Alternativen im Katalog (Feld "rolle").
B. VIELFALT (Pflicht): Baue NICHT jedes Mal dieselben Sections! Pro Rolle gibt es mehrere gleichwertige Alternativen — wähle die, die zur Nische und zum Produkt passt, und folge der VIELFALTS-EMPFEHLUNG im Nutzer-Kontext, wenn vorhanden. Beispiele: hero = bro-hero-luxe (edel) ODER bro-hero-split (freundlich/bunt) ODER bro-cta-banner+scrollingbild (laut/street); proof = bro-spotlight ODER reviews2 ODER bro-chat-reviews ODER vids ODER bro-google-reviews (Google-/Trustpilot-Bewertungs-Karussell) ODER bro-transformation (schräge Vorher/Nachher-Fotos + Testimonial) ODER bro-compare-slider (ziehbarer Vorher/Nachher-Bildvergleich + Haken-Nutzen + Trustpilot-Bewertung); benefits = bro-icon-benefits ODER bro-benefit-cards ODER bro-feature-grid ODER bro-step-cards („So funktioniert's" — nummerierte Karten mit Icon); objections = qanda ODER bro-compare ODER bro-problem-solution; story = bro-callouts ODER image-with-text ODER bro-image-cards ODER bro-circle-gallery (runde Produktbilder mit Verlaufs-Ringen). bro-announce (Ankündigungsleiste, rolle hero) ist die schmale Leiste GANZ OBEN — nur einsetzen, wenn ausdrücklich gewünscht, immer an Position 0. Gleiche Begründung gilt für Kaufbox-Trust-Bausteine (avatar_proof/benefit_cards/usp_grid/review_quote/value_stack — variieren!).
C. FARB-PALETTE + MEHRFARBIGE SEITE (Pflicht bei Umbauten): PALETTE (set_colors): Der Seiten-Hintergrund MUSS neutral sein — fast weiß (z. B. #ffffff/#fafafa) ODER klar dunkel (z. B. #111318), NIE ein gesättigter/muddy Mid-Ton (kein Beige/Sand/Creme/Oliv/Senf/Taupe). Die FARBE kommt über den AKZENT (eine klare Marken-Farbe), Hintergrund + Akzent MÜSSEN harmonieren (nie z. B. beiger Hintergrund + blauer Akzent). Wähle Palette + Stil passend zur Nische: Sport/Fitness = kräftig/dunkel/energetisch (NIE pastellig/beige), Beauty/Spa = zart & hell, Tech = clean/kühl, Baby/Familie = sanft, Deal/Street = laut/kontrastreich. — Wechsle die Hintergrund-Töne wie ein Art Director — z. B. none → tint → none → wash → soft → none → deep (max. 1–2× deep pro Seite). Es gibt KEINE Fades/weichen Verläufe zwischen Sections — der Standard ist die DIREKTE Kante (Farbblock auf Farbblock, wirkt am hochwertigsten). Formen-Kanten (set_section_tone mit divider/dividerTop) sind das SALZ, nicht die Suppe: höchstens 1–2 pro Seite, bevorzugt die ruhigen Formen wave oder curve (zigzag/peaks nur für laute Stile wie street/deal, slant für modern/tech). Am stärksten wirkt EIN deep-Panel mit divider UND dividerTop als Höhepunkt der Seite. NIE zwei gleiche Töne direkt hintereinander, NIE alles getönt, NIE an jeder Kante eine Form.
D. ICONS ÜBERALL (Pflicht, hohe Priorität): Icons sind das wichtigste visuelle Mittel für einen hochwertigen, lebendigen Shop — nutze sie großzügig. Du hast ~1.750 Icons per freiem englischen Keyword. REGELN: (1) JEDE Icon-Band-Section (bro-icon-benefits) und JEDE Callout-Section (bro-callouts) bekommt IMMER alle icon_1..icon_4 gesetzt (set_section_setting key icon_1..icon_4). (2) set_benefit_icons IMMER setzen (4 nischen-passende Icons für die Kaufbox-Vorteile). (3) Wähle streng nischen-spezifisch (Hundebett → "dog"/"bone"/"paw-print", Beauty → "sparkles"/"droplet"/"sun", Fitness → "dumbbell"/"heart-pulse"/"flame", Baby → "baby"/"heart"/"shield", Tech → "cpu"/"wifi"/"battery-charging", Outdoor → "mountain"/"compass"/"tent", Küche → "chef-hat"/"utensils"/"coffee" …) — nie zweimal dasselbe Icon auf einer Section. (4) EMOJIS: Benefit-Karten (bro-benefit-cards) bekommen IMMER passende emoji_1..emoji_4 (set_section_text field emoji_1…), und in Kaufbox-Trust-Bausteinen (benefit_cards/usp_grid/value_stack) sowie kurzen Vorteil-Texten dürfen einzelne passende Emojis am Zeilenanfang stehen (sparsam, 1 pro Zeile, nur wenn es die Nische unterstreicht — nie in Überschriften/Fließtext-Absätzen).
E. SCHRIFTEN (Pflicht bei Umbauten): Setze set_fonts passend zur Nische — Paarungs-Leitfaden: edel/Beauty → playfair_n4|cormorant_n4|lora_n4 + lato_n4|karla_n4; modern/Tech → inter_n4|archivo_n4 + inter_n4|dmsans_n4; freundlich/Familie/Baby → quicksand_n4|poppins_n4|cabin_n4 + nunito_n4|karla_n4; Sport/Street/Deal → anton_n4|oswald_n4|bebas_neue_n4 + rubik_n4|roboto_n4|work_sans_n4; Natur/Editorial → alegreya_n4|merriweather_n4 + lato_n4|raleway_n4. Überschrift und Fließtext dürfen sich unterscheiden (Kontrast-Paarung wirkt hochwertiger als zweimal dieselbe Schrift).
F. COPY-QUALITÄT + TEXT-PFLICHT: JEDE Section, die du hinzufügst oder behältst, bekommt VOLLSTÄNDIG aufs Produkt geschriebene Texte (texts direkt im add_section oder set_section_text danach — alle Textfelder der Section, nicht nur die Überschrift). Beispieltexte/Platzhalter stehen lassen ist ein Fehler. Texte konkret, sensorisch und glaubwürdig — Zahlen und Alltagssituationen statt Floskeln. SINN-PFLICHT: NIE gegenteilige/sinnwidrige Aussagen — jede Aussage stellt den echten NUTZEN korrekt dar (ein Kraft-/Muskel-Produkt baut Muskeln AUF, NIE „zurückbilden"/„abbauen"; ein Anti-Aging-Produkt lässt Falten verschwinden, nicht entstehen). Widersprüchliche/negative Formulierungen sind ein schwerer Fehler. VERBOTEN: "revolutionär", "einzigartig", "Game-Changer", "unglaublich", generisches "Premium-Qualität". Kurze Sätze, aktive Verben, ${answerLang}. Überschriften max. 6 Wörter, Subtexte max. 16.
G. STIMMIGKEIT: Ein Look pro Seite — Töne/Icons/Presets/Schriften zahlen alle auf dieselbe Nische ein. Lieber 10 präzise Ops mehr als ein halbfertiger Umbau.
H. KAUFBOX: Die Reihenfolge snappt das System IMMER automatisch aufs bewährte Funnel-Muster (Dringlichkeit/Titel/Bewertung/Social-Proof/Preis/Knappheit ÜBER dem Kaufen-Button — Zahlarten/Vorteile/Garantie/Versand/Details DARUNTER). Deine Aufgabe ist die AUSWAHL, nicht die Position: ergänze per add_buybox_block 1–2 zur Nische passende Vertrauens-Bausteine, entferne Unpassendes (remove_buybox_block) und personalisiere JEDEN sichtbaren Baustein-Text auf die Nische (set_block_text, Emojis passend). Nicht stapeln: max. 2 neue Vertrauens-Bausteine, keine Dopplung mit vorhandenen.

KATALOG:
${buildCatalog()}`;
}

// ─── Aufruf ─────────────────────────────────────────────────────────

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  // Ersten balancierten, TATSÄCHLICH parsebaren {…}-Block suchen (String-/Escape-
  // bewusst). Wichtig gegen Reasoning-/Prosa-Text VOR dem JSON: ein gieriges
  // /\{[\s\S]*\}/ würde von einer Prosa-Klammer bis zur letzten } spannen und
  // ungültiges JSON liefern → JSON.parse wirft → unnötiger „ausgelastet"-Fallback.
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          const cand = text.slice(i, j + 1);
          try { JSON.parse(cand); return cand; } catch { /* evtl. trailing comma */ }
          const stripped = cand.replace(/,(\s*[}\]])/g, "$1");
          try { JSON.parse(stripped); return stripped; } catch { /* nächster Block */ }
          break; // dieser {-Block ist nicht parsebar → beim nächsten { neu ansetzen
        }
      }
    }
  }
  return text.trim();
}

/** Dokument für den Prompt kompaktieren: lange Texte kappen (die AI schreibt
 *  ohnehin neue) — spart deutlich Input-Tokens, Struktur bleibt vollständig. */
const COMPACT_TEXT = 90;
function compactDocForAi(doc: ThemeDocument): ThemeDocument {
  const cut = (s: string) => (s.length > COMPACT_TEXT ? s.slice(0, COMPACT_TEXT) + "…" : s);
  const cutTexts = (t: Record<string, string> | undefined) =>
    t ? Object.fromEntries(Object.entries(t).map(([k, v]) => [k, typeof v === "string" ? cut(v) : v])) : t;
  return {
    ...doc,
    sections: doc.sections.map((s) => ({ ...s, texts: cutTexts(s.texts) as Record<string, string> })),
    home: (doc.home || []).map((s) => ({ ...s, texts: cutTexts(s.texts) as Record<string, string> })),
    buybox: {
      ...doc.buybox,
      blocks: Object.fromEntries(
        Object.entries(doc.buybox.blocks || {}).map(([k, b]) => [
          k,
          { ...b, texts: cutTexts(b.texts) as Record<string, string> },
        ]),
      ),
    },
  };
}

/** Deterministische Vielfalts-Empfehlung pro Produkt: nudged die AI, nicht
 *  immer dieselben Sections zu wählen — gleiche Produkt-ID → gleiche
 *  Empfehlung (Plan bleibt bei Wiederholung stabil). */
export function varietyHints(productId: string): string {
  let h = 0;
  for (const c of productId || "x") h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const pick = <T,>(arr: T[], salt: number) => arr[(h + salt) % arr.length];
  const hero = pick(["bro-hero-luxe", "bro-hero-split", "bro-cta-banner + scrollingbild"], 1);
  const benefits = pick(["bro-icon-benefits", "bro-benefit-cards", "bro-feature-grid", "bro-step-cards"], 2);
  const proof = pick(["bro-spotlight", "reviews2", "bro-chat-reviews", "vids", "bro-google-reviews", "bro-transformation", "bro-compare-slider"], 3);
  const story = pick(["bro-callouts", "image-with-text", "bro-image-cards", "bro-circle-gallery"], 4);
  const objections = pick(["qanda", "bro-compare", "bro-problem-solution"], 5);
  const trustBlock = pick(["avatar_proof", "benefit_cards", "usp_grid", "review_quote", "value_stack"], 6);
  return `VIELFALTS-EMPFEHLUNG für dieses Produkt (bevorzuge diese Alternativen, weiche nur ab wenn die Nische klar dagegen spricht): hero=${hero}, benefits=${benefits}, proof=${proof}, story=${story}, objections=${objections}, kaufbox-trust=${trustBlock}.`;
}

// ─── Deterministischer Fallback-Plan ─────────────────────────────────────────
// Damit die AI IMMER liefert (nie eine Fehlermeldung): ist Claude nicht
// erreichbar/zu langsam, leiten wir aus dem Wunsch einen passenden Stil ab und
// übernehmen dessen DESIGN (Farben/Schriften/Ecken) — ohne die vorhandenen
// Sections zu zerstören (mode "design", nicht "full"). Ergebnis ist ein echter,
// kuratierter Entwurf, kein Platzhalter.
const FALLBACK_STYLE_KEYWORDS: [RegExp, string][] = [
  [/dunkel|dark|schwarz|nacht|noir/, "noir"],
  [/edel|luxu|premium|nobel|exklusiv/, "luxe"],
  [/elegan|serif|klassisch/, "elegant"],
  [/sport|fitness|gym|athlet|power|workout/, "sport"],
  [/baby|kinder|famil/, "family"],
  [/verspielt|fröhlich|froehlich|playful|spass|spaß/, "playful"],
  [/candy|süß|suess|pastell|sweet|bonbon/, "candy"],
  [/minimal|schlicht|reduz|puristisch/, "minimal"],
  [/tech|technik|gadget|elektro|digital|smart/, "tech"],
  [/beauty|spa|kosmetik|wellness|haut|skin|serum/, "spa"],
  [/pflege|gesund|medic|clinic|arzt|derma|apotheke/, "clinic"],
  [/natur|öko|oeko|bio|nachhaltig|green|grün|gruen|pflanz/, "nature"],
  [/street|urban|hype|sneaker|graffiti/, "street"],
  [/sale|rabatt|deal|angebot|günstig|guenstig|discount/, "deal"],
  [/ozean|meer|wasser|ocean|see|maritim/, "ocean"],
  [/sunset|sommer|warm|sonne|beach|strand/, "sunset"],
  [/bold|laut|kräftig|kraeftig|stark|kontrast/, "bold"],
  [/royal|könig|koenig|gold|prunk|luxus/, "royal"],
  [/cozy|gemütlich|gemuetlich|zuhause|wohn|home|decke/, "cozy"],
  [/outdoor|camping|berg|abenteuer|wander|trekking/, "outdoor"],
  [/retro|vintage|nostalg|80er|90er/, "retro"],
  [/carbon|auto|car|motor|fahrzeug|tuning/, "carbon"],
  [/fresh|food|essen|frisch|küche|kueche|kochen|snack/, "fresh"],
  [/modern|clean|zeitgemäß|zeitgemaess/, "modern"],
];

/** Immer-verfügbarer Plan ohne Claude — leitet Stil + optional Akzentfarbe aus
 *  dem Wunsch ab. Die Ops sind garantiert gültig (set_style ⊕ optional set_colors). */
export function buildFallbackPlan(input: ThemeAiInput): ThemeAiRawPlan {
  const valid = new Set(THEME_STYLES.map((s) => s.id));
  let current = input.doc?.global?.styleId || "modern";
  if (!valid.has(current)) current = "modern";
  let style = current;
  const p = (input.prompt || "").toLowerCase();
  for (const [re, sid] of FALLBACK_STYLE_KEYWORDS) {
    if (re.test(p) && valid.has(sid)) { style = sid; break; }
  }
  const ops: unknown[] = [{ op: "set_style", styleId: style, mode: "design" }];
  const hint = (input.paletteHints || []).find((h) => /^#[0-9a-fA-F]{6}$/.test(h));
  if (hint) ops.push({ op: "set_colors", colors: { accent: hint } });
  const label = THEME_STYLES.find((s) => s.id === style)?.label || style;
  const de = input.lang !== "en";
  return {
    summary: de
      ? `Frisches Design im Stil „${label}" — der AI-Dienst war kurz sehr gefragt, du bekommst aber trotzdem sofort einen professionellen Entwurf, den du direkt weiter anpassen kannst.`
      : `A fresh "${label}" design — the AI service was briefly busy, but you still get a professional draft right away that you can keep customising.`,
    steps: [
      de
        ? { title: `Stil „${label}"`, detail: "Farben, Schriften und Ecken im gewählten Stil übernommen — deine Sections und Texte bleiben erhalten." }
        : { title: `"${label}" style`, detail: "Applied the style's colours, fonts and corners — your sections and texts stay." },
      ...(hint
        ? [de
            ? { title: "Farbe übernommen", detail: `Akzentfarbe ${hint} aus deinem Bild gesetzt.` }
            : { title: "Colour applied", detail: `Accent ${hint} taken from your image.` }]
        : []),
    ],
    operations: ops,
  };
}

/** Baut den FOKUS-Block: der Nutzer hat bestimmte Sections markiert — die AI
 *  soll ihre Änderungen primär auf genau diese uids beziehen. */
function focusNote(input: ThemeAiInput): string {
  const uids = (input.focus || []).filter((u) => typeof u === "string");
  if (!uids.length) return "";
  const all = [...input.doc.sections, ...(input.doc.home || [])];
  const lines: string[] = [];
  for (const uid of uids.slice(0, 12)) {
    if (uid === "__buybox") {
      lines.push(`- die KAUFBOX (Produktinfo-Spalte neben dem Bild): Bausteine, Reihenfolge (add_buybox_block/remove_buybox_block/reorder_buybox) und deren Texte (set_block_text) sowie Galerie/Icons.`);
      continue;
    }
    const s = all.find((x) => x.uid === uid);
    if (!s) continue;
    const firstText = Object.values(s.texts || {}).find((v) => typeof v === "string" && v.trim());
    lines.push(`- uid "${uid}" · Typ ${s.type}${firstText ? ` · aktueller Text: „${String(firstText).slice(0, 60)}"` : ""}`);
  }
  if (!lines.length) return "";
  return (
    `FOKUS DES NUTZERS — er hat GENAU diese Section(s) markiert; deine Änderungen sollen sich PRIMÄR darauf beziehen (nutze ihre uids in den Ops):\n${lines.join("\n")}\n` +
    `Ändere andere Sections nur, wenn es der Wunsch ausdrücklich verlangt oder die Stimmigkeit es erzwingt. Baue KEINE komplette neue Seite, wenn der Wunsch sich auf die markierten Sections bezieht.`
  );
}

function buildUserContent(input: ThemeAiInput): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = [];
  for (const img of input.images.slice(0, 3)) {
    blocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
        data: img.data,
      },
    });
  }
  const parts = [
    `AKTUELLES THEME-DOKUMENT (JSON, lange Texte gekürzt):\n${JSON.stringify(compactDocForAi(input.doc))}`,
    input.productTitle ? `PRODUKT: ${input.productTitle}` : "",
    focusNote(input),
    varietyHints(input.doc.productId || input.productTitle),
    input.learnHints ? `GELERNTES WISSEN (bewährte Muster aus früheren erfolgreichen Generierungen dieser Nische — nutze es als Ausgangspunkt):\n${input.learnHints}` : "",
    input.paletteHints.length ? `AUTOMATISCH AUS DEN BILDERN EXTRAHIERTE FARBTÖNE (Hinweis): ${input.paletteHints.join(", ")}` : "",
    `WUNSCH DES NUTZERS:\n${input.prompt || "(kein Text — richte dich nach den Bildern)"}`,
  ].filter(Boolean);
  blocks.push({ type: "text", text: parts.join("\n\n") });
  return blocks;
}

/**
 * Erstellt den Plan via Claude. Wirft bei fehlendem Key/Refusal/Parse-Fehler
 * (Route übersetzt in saubere HTTP-Fehler). Kosten → Provider-Ledger.
 */
export async function generateThemePlan(input: ThemeAiInput, opts?: { signal?: AbortSignal }): Promise<ThemeAiRawPlan> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY fehlt.");
  // WICHTIG: Der Abbruch-Zeitpunkt wird vom AbortController der Route gesteuert
  // Abbruch steuert der AbortController der Route (150 s, unter maxDuration 180 s)
  // — NICHT das SDK. Zwei frühere Fehler hier behoben:
  // (1) timeout 42000 kappte JEDEN vollen „passe das Theme dem Produkt an"-Plan
  //     (Opus 4.8 Expert, 45–140 s Generierung) schon nach 42 s → simpler Fallback.
  // (2) maxRetries: 2 → bei 429/529 schläft das SDK den vom Server geforderten
  //     retry-after AB, OHNE das Route-Signal zu beachten (der Backoff-Sleep bekommt
  //     kein AbortSignal) → der Sleep kann das Funktions-Limit REISSEN → harter 502
  //     statt sauberem Fallback. Darum jetzt maxRetries: 0: transiente 429/529/5xx
  //     werfen SOFORT → Route-catch liefert den graziösen Fallback-Plan.
  // timeout 160000 (> 150-s-AbortController) ist nur ein Backstop; das Signal greift zuerst.
  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 160000 });
  const model = THEME_AI_MODELS[input.mode] || THEME_AI_MODELS.standard;
  // System-Prompt als Block mit cache_control: der statische Teil (Regeln +
  // Katalog, ~6k Tokens) wird gecacht — Folge-Calls zahlen ~10 % dafür.
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: buildSystem(input.lang), cache_control: { type: "ephemeral" } },
  ];
  const content = buildUserContent(input);

  let msg: Anthropic.Message;
  try {
    msg = await client.messages.create({
      model,
      max_tokens: 16000,
      thinking: { type: "disabled" },
      output_config: { format: { type: "json_schema", schema: PLAN_SCHEMA } },
      system,
      messages: [{ role: "user", content }],
    }, { signal: opts?.signal });
  } catch (err) {
    // Fallback ohne Structured Output NUR bei 400/invalid_request (Feature/
    // SDK-Feld auf der Plattform nicht verfügbar). Bei 429/529/5xx/Auth-
    // Fehlern KEIN Zweit-Call — das SDK hat bereits intern retried; ein
    // weiterer voller Call (inkl. Bilder + System-Prompt) würde Overload
    // verschärfen und die eigentliche Ursache im Log maskieren.
    const status = (err as { status?: number } | null)?.status;
    if (status !== 400) throw err;
    console.warn("[theme-ai] structured output fehlgeschlagen (400), Fallback auf Freitext-JSON:", err);
    msg = await client.messages.create({
      model,
      max_tokens: 16000,
      thinking: { type: "disabled" },
      system: [
        {
          type: "text",
          text: `${buildSystem(input.lang)}\n\nAntworte AUSSCHLIESSLICH mit einem JSON-Objekt {summary, steps:[{title,detail}], operations:[…]} — kein Text davor oder danach.`,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content }],
    }, { signal: opts?.signal });
  }

  try {
    await recordUsd("anthropic", anthropicCostUsd(model, msg.usage));
  } catch {
    /* Ledger nie fatal */
  }

  if (msg.stop_reason === "refusal") {
    throw new Error("Die AI hat die Anfrage abgelehnt — bitte formuliere den Wunsch anders.");
  }
  // Token-Limit erreicht → JSON ist mitten im Objekt abgeschnitten und NICHT
  // parsebar. Das war der zweite Haupt-Auslöser: mit dem alten max_tokens: 6400
  // riss genau der volle Produkt-Anpassungs-Plan das Limit → abgeschnittenes JSON
  // → JSON.parse warf ungefangen → „ausgelastet"-Fallback (ohne dass irgendwo
  // stand warum). max_tokens ist jetzt 16000, sodass reale Pläne das nicht mehr
  // reißen; falls doch, ein klarer, geloggter Fehler statt eines Parse-Absturzes.
  if (msg.stop_reason === "max_tokens") {
    throw new Error("AI-Antwort durch Token-Limit abgeschnitten — Plan zu groß.");
  }

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  if (!text.trim()) throw new Error("Leere AI-Antwort.");

  let parsed: Partial<ThemeAiRawPlan>;
  try {
    parsed = JSON.parse(extractJson(text)) as Partial<ThemeAiRawPlan>;
  } catch (err) {
    // Nie als nackter SyntaxError abstürzen (extractJson hat bereits versucht,
    // den ersten gültigen Block zu finden) — klar benennen, was schief ging.
    throw new Error("AI-Antwort war kein gültiges JSON: " + (err instanceof Error ? err.message : String(err)));
  }
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 500) : "",
    steps: Array.isArray(parsed.steps)
      ? parsed.steps
          .filter((s): s is { title: string; detail: string } => !!s && typeof s.title === "string" && typeof s.detail === "string")
          .slice(0, 8)
          .map((s) => ({ title: s.title.slice(0, 120), detail: s.detail.slice(0, 300) }))
      : [],
    operations: Array.isArray(parsed.operations) ? parsed.operations : [],
  };
}
