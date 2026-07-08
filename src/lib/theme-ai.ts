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
A. VOLLE SEITE als Funnel: Bei Nischen-/Umbau-Wünschen baue die Produktseite mit MINDESTENS 9 (besser 10–12) Sections entlang der Funnel-Rollen (Reihenfolge = Rollen-Reihenfolge): hero → benefits → authority → story → proof → objections → urgency/offer → guarantee → closing. Pro Rolle wählst du EINE Section aus den Alternativen im Katalog (Feld "rolle").
B. VIELFALT (Pflicht): Baue NICHT jedes Mal dieselben Sections! Pro Rolle gibt es mehrere gleichwertige Alternativen — wähle die, die zur Nische und zum Produkt passt, und folge der VIELFALTS-EMPFEHLUNG im Nutzer-Kontext, wenn vorhanden. Beispiele: hero = bro-hero-luxe (edel) ODER bro-hero-split (freundlich/bunt) ODER bro-cta-banner+scrollingbild (laut/street); proof = bro-spotlight ODER reviews2 ODER bro-chat-reviews ODER vids; benefits = bro-icon-benefits ODER bro-benefit-cards ODER bro-feature-grid; objections = qanda ODER bro-compare ODER bro-problem-solution; story = bro-callouts ODER image-with-text ODER bro-image-cards. Gleiche Begründung gilt für Kaufbox-Trust-Bausteine (avatar_proof/benefit_cards/usp_grid/review_quote/value_stack — variieren!).
C. MEHRFARBIGE SEITE MIT DIREKTEN KANTEN (Pflicht bei Umbauten): Wechsle die Hintergrund-Töne wie ein Art Director — z. B. none → tint → none → wash → soft → none → deep (max. 1–2× deep pro Seite). Es gibt KEINE Fades/weichen Verläufe zwischen Sections — der Standard ist die DIREKTE Kante (Farbblock auf Farbblock, wirkt am hochwertigsten). Formen-Kanten (set_section_tone mit divider/dividerTop) sind das SALZ, nicht die Suppe: höchstens 1–2 pro Seite, bevorzugt die ruhigen Formen wave oder curve (zigzag/peaks nur für laute Stile wie street/deal, slant für modern/tech). Am stärksten wirkt EIN deep-Panel mit divider UND dividerTop als Höhepunkt der Seite. NIE zwei gleiche Töne direkt hintereinander, NIE alles getönt, NIE an jeder Kante eine Form.
D. ICONS ÜBERALL (Pflicht, hohe Priorität): Icons sind das wichtigste visuelle Mittel für einen hochwertigen, lebendigen Shop — nutze sie großzügig. Du hast ~1.750 Icons per freiem englischen Keyword. REGELN: (1) JEDE Icon-Band-Section (bro-icon-benefits) und JEDE Callout-Section (bro-callouts) bekommt IMMER alle icon_1..icon_4 gesetzt (set_section_setting key icon_1..icon_4). (2) set_benefit_icons IMMER setzen (4 nischen-passende Icons für die Kaufbox-Vorteile). (3) Wähle streng nischen-spezifisch (Hundebett → "dog"/"bone"/"paw-print", Beauty → "sparkles"/"droplet"/"sun", Fitness → "dumbbell"/"heart-pulse"/"flame", Baby → "baby"/"heart"/"shield", Tech → "cpu"/"wifi"/"battery-charging", Outdoor → "mountain"/"compass"/"tent", Küche → "chef-hat"/"utensils"/"coffee" …) — nie zweimal dasselbe Icon auf einer Section. (4) EMOJIS: Benefit-Karten (bro-benefit-cards) bekommen IMMER passende emoji_1..emoji_4 (set_section_text field emoji_1…), und in Kaufbox-Trust-Bausteinen (benefit_cards/usp_grid/value_stack) sowie kurzen Vorteil-Texten dürfen einzelne passende Emojis am Zeilenanfang stehen (sparsam, 1 pro Zeile, nur wenn es die Nische unterstreicht — nie in Überschriften/Fließtext-Absätzen).
E. SCHRIFTEN (Pflicht bei Umbauten): Setze set_fonts passend zur Nische — Paarungs-Leitfaden: edel/Beauty → playfair_n4|cormorant_n4|lora_n4 + lato_n4|karla_n4; modern/Tech → inter_n4|archivo_n4 + inter_n4|dmsans_n4; freundlich/Familie/Baby → quicksand_n4|poppins_n4|cabin_n4 + nunito_n4|karla_n4; Sport/Street/Deal → anton_n4|oswald_n4|bebas_neue_n4 + rubik_n4|roboto_n4|work_sans_n4; Natur/Editorial → alegreya_n4|merriweather_n4 + lato_n4|raleway_n4. Überschrift und Fließtext dürfen sich unterscheiden (Kontrast-Paarung wirkt hochwertiger als zweimal dieselbe Schrift).
F. COPY-QUALITÄT + TEXT-PFLICHT: JEDE Section, die du hinzufügst oder behältst, bekommt VOLLSTÄNDIG aufs Produkt geschriebene Texte (texts direkt im add_section oder set_section_text danach — alle Textfelder der Section, nicht nur die Überschrift). Beispieltexte/Platzhalter stehen lassen ist ein Fehler. Texte konkret, sensorisch und glaubwürdig — Zahlen und Alltagssituationen statt Floskeln. VERBOTEN: "revolutionär", "einzigartig", "Game-Changer", "unglaublich", generisches "Premium-Qualität". Kurze Sätze, aktive Verben, ${answerLang}. Überschriften max. 6 Wörter, Subtexte max. 16.
G. STIMMIGKEIT: Ein Look pro Seite — Töne/Icons/Presets/Schriften zahlen alle auf dieselbe Nische ein. Lieber 10 präzise Ops mehr als ein halbfertiger Umbau.
H. KAUFBOX: Die Reihenfolge snappt das System IMMER automatisch aufs bewährte Funnel-Muster (Dringlichkeit/Titel/Bewertung/Social-Proof/Preis/Knappheit ÜBER dem Kaufen-Button — Zahlarten/Vorteile/Garantie/Versand/Details DARUNTER). Deine Aufgabe ist die AUSWAHL, nicht die Position: ergänze per add_buybox_block 1–2 zur Nische passende Vertrauens-Bausteine, entferne Unpassendes (remove_buybox_block) und personalisiere JEDEN sichtbaren Baustein-Text auf die Nische (set_block_text, Emojis passend). Nicht stapeln: max. 2 neue Vertrauens-Bausteine, keine Dopplung mit vorhandenen.

KATALOG:
${buildCatalog()}`;
}

// ─── Aufruf ─────────────────────────────────────────────────────────

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  const brace = text.match(/\{[\s\S]*\}/);
  return brace ? brace[0] : text.trim();
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
  const benefits = pick(["bro-icon-benefits", "bro-benefit-cards", "bro-feature-grid"], 2);
  const proof = pick(["bro-spotlight", "reviews2", "bro-chat-reviews", "vids"], 3);
  const story = pick(["bro-callouts", "image-with-text", "bro-image-cards"], 4);
  const objections = pick(["qanda", "bro-compare", "bro-problem-solution"], 5);
  const trustBlock = pick(["avatar_proof", "benefit_cards", "usp_grid", "review_quote", "value_stack"], 6);
  return `VIELFALTS-EMPFEHLUNG für dieses Produkt (bevorzuge diese Alternativen, weiche nur ab wenn die Nische klar dagegen spricht): hero=${hero}, benefits=${benefits}, proof=${proof}, story=${story}, objections=${objections}, kaufbox-trust=${trustBlock}.`;
}

/** Baut den FOKUS-Block: der Nutzer hat bestimmte Sections markiert — die AI
 *  soll ihre Änderungen primär auf genau diese uids beziehen. */
function focusNote(input: ThemeAiInput): string {
  const uids = (input.focus || []).filter((u) => typeof u === "string");
  if (!uids.length) return "";
  const all = [...input.doc.sections, ...(input.doc.home || [])];
  const lines: string[] = [];
  for (const uid of uids.slice(0, 12)) {
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
export async function generateThemePlan(input: ThemeAiInput): Promise<ThemeAiRawPlan> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY fehlt.");
  const client = new Anthropic({ apiKey });
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
      max_tokens: 6400,
      thinking: { type: "disabled" },
      output_config: { format: { type: "json_schema", schema: PLAN_SCHEMA } },
      system,
      messages: [{ role: "user", content }],
    });
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
      max_tokens: 6400,
      thinking: { type: "disabled" },
      system: [
        {
          type: "text",
          text: `${buildSystem(input.lang)}\n\nAntworte AUSSCHLIESSLICH mit einem JSON-Objekt {summary, steps:[{title,detail}], operations:[…]} — kein Text davor oder danach.`,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content }],
    });
  }

  try {
    await recordUsd("anthropic", anthropicCostUsd(model, msg.usage));
  } catch {
    /* Ledger nie fatal */
  }

  if (msg.stop_reason === "refusal") {
    throw new Error("Die AI hat die Anfrage abgelehnt — bitte formuliere den Wunsch anders.");
  }

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  if (!text.trim()) throw new Error("Leere AI-Antwort.");

  const parsed = JSON.parse(extractJson(text)) as Partial<ThemeAiRawPlan>;
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
