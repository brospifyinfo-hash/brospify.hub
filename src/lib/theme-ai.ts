// ─── AI Co-Pilot: Plan-Generierung (server-only) ────────────────────
// Claude (Opus 4.8, Vision + Structured Output) bekommt das aktuelle
// ThemeDocument, den Nutzerwunsch und optionale Produktbilder und liefert
// einen PLAN: menschenlesbare Schritte + strukturierte Operationen aus der
// Whitelist in theme-ai-ops. Die AI führt NIE selbst aus — der Nutzer
// bestätigt den Plan, erst dann wendet der Editor die Ops an.
// Kosten werden im Provider-Ledger verbucht (recordUsd).

import Anthropic from "@anthropic-ai/sdk";
import { recordUsd, anthropicCostUsd } from "@/lib/provider-usage";
import type { ThemeDocument } from "@/lib/theme-doc";
import {
  SECTION_LIBRARY,
  BUYBOX_LIBRARY,
  BUYBOX_CONTROLS,
  GALLERY_PRESETS,
} from "@/lib/theme-library";
import { THEME_STYLES } from "@/lib/theme-styles";
import { BUYBOX_DEFAULT_ORDER, BUYBOX_RUNTIME_ONLY } from "@/lib/theme-sections";
import { THEME_ICONS } from "@/lib/theme-icons";
import { EDITOR_FONTS } from "@/components/theme-editor/editor-ui";

const MODEL = "claude-opus-4-8";

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
    fade: { type: "string", enum: ["none", "top", "bottom", "both"] },
    divider: { type: "string", enum: ["none", "wave", "slant", "curve"] },
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
  const sections = SECTION_LIBRARY.map((d) => {
    const presets = d.presets.map((p) => p.id).join("|");
    const fields = d.fields.map((f) => f.id).join(",") || "-";
    return `  ${d.type} [${d.category}] „${d.label}“ · presets: ${presets} · textfelder: ${fields}`;
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
    `ICONS (für set_benefit_icons + icon_1..icon_4 bei Icon-Band/Callouts — wähle NISCHEN-PASSEND): ${icons}`,
    `SECTIONS (add_section.type — nur diese Typen/Presets/Felder):\n${sections}`,
    `KAUFBOX-BAUSTEINE (blockType — nur diese Typen/Presets/Felder/Settings):\n${blocks}`,
  ].join("\n\n");
  return catalogCache;
}

// ─── System-Prompt ──────────────────────────────────────────────────

function buildSystem(lang: "de" | "en"): string {
  const answerLang = lang === "en" ? "Englisch" : "Deutsch";
  return `Du bist der AI Co-Pilot des Brospify Theme-Editors — ein Experte für hochkonvertierende Shopify-Dropshipping-Shops.

Du bekommst das aktuelle Theme-Dokument (JSON), den Wunsch des Nutzers und optional Produktbilder. Du erstellst einen PLAN: verständliche Schritte + präzise Operationen. Du führst NICHTS selbst aus — der Nutzer bestätigt zuerst.

OPERATIONEN (Feld "op", nur diese):
- set_style {styleId, mode:"design"|"full"} — Gesamt-Stil. "design"=nur Farben/Schriften/Design (Aufbau bleibt), "full"=Seiten werden nach Stil-Komposition NEU gebaut (nur bei ausdrücklichem Komplett-Umbau-Wunsch).
- set_colors {colors:{button?,buttonText?,background?,text?,accent?}} — Hex #rrggbb.
- set_fonts {headingFont?, bodyFont?} · set_radius {radius:0-40} · set_design {shadow?:0|1|2, border?:1|2, iconStyle?:"dark"|"accent"|"outline"}.
- add_section {page:"product"|"home", type, presetId?, position?, texts?:[{field,value}], uid?:"new:1"} — uid als Platzhalter, um die neue Section in Folge-Ops zu referenzieren.
- remove_section {uid} · move_section {uid, to} · set_section_preset {uid, presetId} · set_section_text {uid, field, value}.
- set_section_tone {uid, tone:"none"|"tint"|"soft"|"wash"|"deep", fade?:"none"|"top"|"bottom"|"both", divider?:"none"|"wave"|"slant"|"curve"} — Hintergrund-Ton der Section, automatisch stimmig aus der Palette abgeleitet, mit weichem Übergang (fade) bzw. dekorativer Unterkante (divider).
- set_section_setting {uid, key, value} — nur sec_bg/sec_bg2 (Hex), sec_fade, sec_divider, icon_1..icon_4 (Icon-IDs, bei Icon-Band/Callouts).
- set_benefit_icons {icons:["id","id","id","id"]} — die 4 Icons der Kaufbox-Vorteile.
- add_buybox_block {blockType, position?, presetId?} · remove_buybox_block {blockType} · reorder_buybox {order:[blockType,…]}.
- set_block_preset {blockType, presetId} · set_block_text {blockType, field, value} · set_block_setting {blockType, key, value}.
- set_gallery {presetId?, badge?} · set_buybox_spacing {spacing:4-40}.

HARTE REGELN:
1. Verwende AUSSCHLIESSLICH styleIds, Section-Typen, presetIds, Feld-IDs, blockTypes, Setting-Keys, Icon-IDs und Schriften aus dem Katalog unten. Nichts erfinden.
2. Section-uids nur aus dem Dokument übernehmen — neue Sections bekommen "new:1", "new:2", ….
3. Farben immer als #rrggbb. Achte IMMER auf Kontrast: text lesbar auf background, buttonText lesbar auf button.
4. Produktbild dabei + keine expliziten Farbwünsche? → Leite eine stimmige Palette aus dem Bild ab (accent = markante Produkt-/Markenfarbe; background hell und dezent, außer ein dunkler Look passt/ist gewünscht).
5. set_style (falls genutzt) steht IMMER als erste Operation — Detail-Ops danach, damit sie den Stil verfeinern. Max. 40 Operationen.
6. summary (1–2 Sätze) und steps (2–8) auf ${answerLang}, für Laien verständlich — KEINE technischen op-Namen oder IDs in den Schritten. Jeder Schritt beschreibt eine sichtbare Veränderung.
7. Ist der Wunsch mit den verfügbaren Operationen nicht umsetzbar, liefere die nächstbeste sinnvolle Annäherung — operations darf nur leer sein, wenn wirklich gar nichts passt (das erklärst du dann in summary).

ART-DIRECTION (so entsteht ein Ergebnis auf Agentur-Niveau — dein Anspruch bei JEDEM Plan):
A. VOLLE SEITE statt Flickwerk: Bei Nischen-/Umbau-Wünschen baue die Produktseite als vollständigen Funnel mit 8–12 Sections: Einstieg/Hook (bro-gradient-cta ODER bro-cta-banner ODER scrollingbild) → Icon-Vorteile (bro-icon-benefits, Icons zur Nische!) → Autorität (bro-logo-badges) → Social Proof (bro-spotlight oder reviews2/bro-chat-reviews) → Produkt-Details (bro-callouts oder image-with-text/bro-image-cards) → Zahlen (bro-stats) → Einwände (qanda oder bro-compare/bro-problem-solution) → Garantie (bro-guarantee) → Abschluss (bro-gradient-cta). Die neuen Premium-Typen (bro-icon-benefits, bro-spotlight, bro-callouts, bro-gradient-cta, bro-logo-badges, bro-image-cards) sind erste Wahl.
B. TON-RHYTHMUS (Pflicht bei Umbauten): Wechsle die Hintergrund-Töne der Sections wie ein Art Director — z. B. none → tint → none → wash → soft → none → deep (max. 1–2× deep pro Seite) → none. Nutze set_section_tone mit fade "both" für weiche Übergänge; setze auf 1–2 getönte Sections zusätzlich divider "wave" oder "curve". NIE zwei gleiche Töne direkt hintereinander, NIE alles getönt.
C. ICONS: Wähle Icons streng nischen-passend (Haustier→paw, Beauty→droplet/sparkle/sun, Fitness→bolt/pulse/battery, Baby→baby/heart/shield, Tech→chip/wifi/plug, Outdoor→mountain/compass/tree, Küche→utensils/coffee …). Setze IMMER set_benefit_icons UND die icon_1..icon_4 der eingefügten Icon-Band/Callout-Sections.
D. COPY-QUALITÄT: Texte konkret, sensorisch und glaubwürdig — Zahlen und Alltagssituationen statt Floskeln. VERBOTEN: "revolutionär", "einzigartig", "Game-Changer", "unglaublich", generisches "Premium-Qualität". Kurze Sätze, aktive Verben, ${answerLang}. Überschriften max. 6 Wörter, Subtexte max. 16.
E. STIMMIGKEIT: Ein Look pro Seite — Töne/Icons/Presets zahlen alle auf dieselbe Nische ein. Lieber 10 präzise Ops mehr als ein halbfertiger Umbau.

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
    `AKTUELLES THEME-DOKUMENT (JSON):\n${JSON.stringify(input.doc)}`,
    input.productTitle ? `PRODUKT: ${input.productTitle}` : "",
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
  const system = buildSystem(input.lang);
  const content = buildUserContent(input);

  let msg: Anthropic.Message;
  try {
    msg = await client.messages.create({
      model: MODEL,
      max_tokens: 6400,
      thinking: { type: "disabled" },
      output_config: { format: { type: "json_schema", schema: PLAN_SCHEMA } },
      system,
      messages: [{ role: "user", content }],
    });
  } catch (err) {
    // Fallback ohne Structured Output (z. B. falls das Feature/SDK-Feld auf
    // der Plattform nicht verfügbar ist) — dann robustes JSON-Extrahieren.
    console.warn("[theme-ai] structured output fehlgeschlagen, Fallback auf Freitext-JSON:", err);
    msg = await client.messages.create({
      model: MODEL,
      max_tokens: 6400,
      thinking: { type: "disabled" },
      system: `${system}\n\nAntworte AUSSCHLIESSLICH mit einem JSON-Objekt {summary, steps:[{title,detail}], operations:[…]} — kein Text davor oder danach.`,
      messages: [{ role: "user", content }],
    });
  }

  try {
    await recordUsd("anthropic", anthropicCostUsd(MODEL, msg.usage));
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
