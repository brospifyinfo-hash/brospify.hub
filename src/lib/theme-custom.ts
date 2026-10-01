// ─── KI-Sections: vom AI Co-Pilot frei gebaute Sections ─────────────
// Gibt es die gewünschte Section nicht im Katalog (oder soll eine bestehende
// anders aufgebaut werden, als Presets/Textfelder es erlauben), baut die AI
// sie aus einem BAUPLAN (CustomSpec): einem Baum aus sicheren Bausteinen
// (Überschrift, Text, Bild, Icon, Liste, Tabelle, FAQ, Raster, Karte …).
//
// BEWUSST KEIN rohes HTML/CSS von der AI:
//  - Sicherheit: Dokumente lassen sich teilen/laden — fremdes HTML wäre
//    Stored-XSS auf der Hub-Domain. Hier wird jeder Text maskiert, jedes
//    Attribut stammt aus einer Whitelist.
//  - Mono-Design: Flächen kommen ausschließlich aus den neutralen Tokens,
//    Farbe nur als Akzent (Sub-Zeilen, Icons, Buttons) — die AI KANN gar
//    keine bunten Flächen oder Verläufe setzen.
//  - „Vorschau = Download": EIN Renderer erzeugt das HTML für die Editor-
//    Vorschau UND die Liquid-Datei im Theme (Shop/Storefront-Render).
// Client-safe (kein server-only Import).

import type { ColorPalette } from "@/lib/theme-placeholders";
import { monoTokens, mixHex, relLuminance, MONO } from "@/lib/theme-color";
import { getIconAny, resolveIconId } from "@/lib/theme-icon-resolver";

export const CUSTOM_SECTION_TYPE = "bspx-custom";

export const CUSTOM_NODE_TYPES = [
  "eyebrow", "heading", "text", "button", "image", "icon", "list", "stat", "rating",
  "quote", "badge", "divider", "price", "faq", "table",
  "grid", "columns", "card", "scroller",
] as const;
export type CustomNodeType = (typeof CUSTOM_NODE_TYPES)[number];
const CONTAINER_TYPES = new Set<CustomNodeType>(["grid", "columns", "card", "scroller"]);

export interface CustomListItem { icon?: string; text: string; sub?: string }
export interface CustomQa { q: string; a: string }

/** EIN Baustein. Flach gehalten (alle Felder optional) — das hält das
 *  Structured-Output-Schema der AI einfach; welche Felder zählen, bestimmt t. */
export interface CustomNode {
  t: CustomNodeType;
  text?: string;
  size?: "s" | "m" | "l" | "xl";
  muted?: boolean;
  accent?: boolean;
  /** button: Ziel (buy = zur Kaufbox oben, shop = alle Produkte, cart = Warenkorb). */
  link?: "buy" | "shop" | "cart";
  /** button: primary | secondary | link */
  style?: "primary" | "secondary" | "link";
  /** image: Produktbild 1–6 (0 = neutrale Fläche). */
  image?: number;
  ratio?: "1:1" | "4:3" | "3:4" | "4:5" | "16:9";
  /** icon/list: Icon-ID (aufgelöst aus freien englischen Keywords). */
  icon?: string;
  boxed?: boolean;
  items?: CustomListItem[];
  mark?: "check" | "cross" | "dot" | "number" | "icon";
  value?: string;
  label?: string;
  author?: string;
  meta?: string;
  qa?: CustomQa[];
  head?: string[];
  rows?: string[][];
  highlight?: number;
  cols?: 2 | 3 | 4;
  mcols?: 1 | 2;
  split?: "1:1" | "2:1" | "1:2";
  reverse?: boolean;
  gap?: "s" | "m" | "l";
  valign?: "start" | "center";
  card?: "surface" | "outline" | "plain";
  align?: "left" | "center";
  children?: CustomNode[];
}

export interface CustomSpec {
  v: 1;
  /** Anzeigename (Aufbau-Leiste, Shopify-Theme-Editor). */
  name: string;
  /** Fläche — IMMER neutral (Mono): Seite / dezent / Kontrast. */
  tone: "page" | "subtle" | "contrast";
  width: "narrow" | "normal" | "wide";
  align: "left" | "center";
  /** Vertikaler Abstand der Section. */
  space: "s" | "m" | "l";
  nodes: CustomNode[];
}

// ─── Grenzen (schützen Rendering, Prompt-Größe und die 50k-Sheets-Zelle) ──
const MAX_TOP = 14;
const MAX_CHILDREN = 12;
const MAX_NODES = 90;
const MAX_DEPTH = 3;
const MAX_SPEC_CHARS = 12000;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : undefined;
};
/** Mehrzeilige Texte: Zeilenumbrüche behalten (FAQ-Antworten, Fließtext). */
const strMl = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return s ? s.slice(0, max) : undefined;
};
function pick<T extends string | number>(v: unknown, allowed: readonly T[]): T | undefined {
  return allowed.includes(v as T) ? (v as T) : undefined;
}
const icon = (v: unknown): string | undefined => {
  const s = str(v, 60);
  return s ? resolveIconId(s) || undefined : undefined;
};

function sanitizeNode(raw: unknown, depth: number, budget: { n: number }): CustomNode | null {
  if (!isObj(raw) || budget.n >= MAX_NODES) return null;
  const t = pick(raw.t, CUSTOM_NODE_TYPES);
  if (!t) return null;
  const container = CONTAINER_TYPES.has(t);
  // Container nur bis Ebene 2 (ihre Kinder liegen dann auf Ebene 3).
  if (container && depth >= MAX_DEPTH) return null;
  budget.n += 1;

  const long = t === "text" || t === "quote";
  const n: CustomNode = { t };
  const text = long ? strMl(raw.text, 420) : str(raw.text, t === "heading" ? 140 : 100);
  if (text) n.text = text;
  const size = pick(raw.size, ["s", "m", "l", "xl"] as const);
  if (size) n.size = size;
  if (raw.muted === true) n.muted = true;
  if (raw.accent === true) n.accent = true;
  const link = pick(raw.link, ["buy", "shop", "cart"] as const);
  if (link) n.link = link;
  const style = pick(raw.style, ["primary", "secondary", "link"] as const);
  if (style) n.style = style;
  if (typeof raw.image === "number" && Number.isFinite(raw.image)) n.image = Math.max(0, Math.min(6, Math.round(raw.image)));
  const ratio = pick(raw.ratio, ["1:1", "4:3", "3:4", "4:5", "16:9"] as const);
  if (ratio) n.ratio = ratio;
  const ic = icon(raw.icon);
  if (ic) n.icon = ic;
  if (raw.boxed === true) n.boxed = true;
  const mark = pick(raw.mark, ["check", "cross", "dot", "number", "icon"] as const);
  if (mark) n.mark = mark;
  for (const k of ["value", "label", "author", "meta"] as const) {
    const s = str(raw[k], k === "label" ? 90 : k === "value" ? 24 : 60);
    if (s) n[k] = s;
  }
  if (Array.isArray(raw.items)) {
    const items = raw.items
      .map((it): CustomListItem | null => {
        if (!isObj(it)) return null;
        const tx = str(it.text, 160);
        if (!tx) return null;
        const out: CustomListItem = { text: tx };
        const sub = str(it.sub, 220);
        if (sub) out.sub = sub;
        const ii = icon(it.icon);
        if (ii) out.icon = ii;
        return out;
      })
      .filter((x): x is CustomListItem => !!x)
      .slice(0, 8);
    if (items.length) n.items = items;
  }
  if (Array.isArray(raw.qa)) {
    const qa = raw.qa
      .map((x): CustomQa | null => {
        if (!isObj(x)) return null;
        const q = str(x.q, 160);
        const a = strMl(x.a, 520);
        return q && a ? { q, a } : null;
      })
      .filter((x): x is CustomQa => !!x)
      .slice(0, 10);
    if (qa.length) n.qa = qa;
  }
  if (Array.isArray(raw.head)) {
    const head = raw.head.map((h) => str(h, 40) || "").slice(0, 6);
    if (head.some(Boolean)) n.head = head;
  }
  if (Array.isArray(raw.rows)) {
    const rows = raw.rows
      .filter(Array.isArray)
      .map((r) => (r as unknown[]).map((c) => str(c, 80) || "").slice(0, 6))
      .filter((r) => r.some(Boolean))
      .slice(0, 12);
    if (rows.length) n.rows = rows;
  }
  if (typeof raw.highlight === "number" && Number.isFinite(raw.highlight)) n.highlight = Math.max(0, Math.min(5, Math.round(raw.highlight)));
  const cols = pick(Number(raw.cols), [2, 3, 4] as const);
  if (cols) n.cols = cols;
  const mcols = pick(Number(raw.mcols), [1, 2] as const);
  if (mcols) n.mcols = mcols;
  const split = pick(raw.split, ["1:1", "2:1", "1:2"] as const);
  if (split) n.split = split;
  if (raw.reverse === true) n.reverse = true;
  const gap = pick(raw.gap, ["s", "m", "l"] as const);
  if (gap) n.gap = gap;
  const valign = pick(raw.valign, ["start", "center"] as const);
  if (valign) n.valign = valign;
  const card = pick(raw.card, ["surface", "outline", "plain"] as const);
  if (card) n.card = card;
  const align = pick(raw.align, ["left", "center"] as const);
  if (align) n.align = align;

  if (container) {
    const kids = (Array.isArray(raw.children) ? raw.children : [])
      .slice(0, MAX_CHILDREN)
      .map((c) => sanitizeNode(c, depth + 1, budget))
      .filter((c): c is CustomNode => !!c);
    if (!kids.length) return null;
    n.children = t === "columns" ? kids.slice(0, 2) : kids;
    if (t === "columns" && n.children.length < 2) n.t = "card";
  }

  // Pflichtfelder je Typ — unvollständige Bausteine fliegen raus.
  switch (n.t) {
    case "eyebrow": case "heading": case "text": case "badge": case "button": case "quote":
      return n.text ? n : null;
    case "stat":
      return n.value ? n : null;
    case "list":
      return n.items ? n : null;
    case "faq":
      return n.qa ? n : null;
    case "table":
      return n.rows ? n : null;
    case "icon":
      if (!n.icon) n.icon = "sparkles";
      return n;
    default:
      return n;
  }
}

/** Strikte Prüfung eines Bauplans (AI-Ausgabe, geladenes Dokument, Export).
 *  Unbekanntes fliegt raus; null = nichts Brauchbares übrig. */
export function sanitizeCustomSpec(raw: unknown): CustomSpec | null {
  if (!isObj(raw)) return null;
  const budget = { n: 0 };
  const nodes = (Array.isArray(raw.nodes) ? raw.nodes : [])
    .slice(0, MAX_TOP)
    .map((n) => sanitizeNode(n, 1, budget))
    .filter((n): n is CustomNode => !!n);
  if (!nodes.length) return null;
  const spec: CustomSpec = {
    v: 1,
    name: str(raw.name, 40) || "KI-Section",
    tone: pick(raw.tone, ["page", "subtle", "contrast"] as const) || "page",
    width: pick(raw.width, ["narrow", "normal", "wide"] as const) || "normal",
    align: pick(raw.align, ["left", "center"] as const) || "center",
    space: pick(raw.space, ["s", "m", "l"] as const) || "m",
    nodes,
  };
  // Harte Größen-Grenze (Dokument liegt in einer Sheets-Zelle + im Prompt).
  while (JSON.stringify(spec).length > MAX_SPEC_CHARS && spec.nodes.length > 1) spec.nodes.pop();
  return spec;
}

export function isCustomSection(inst: { type: string; custom?: unknown }): boolean {
  return inst.type === CUSTOM_SECTION_TYPE;
}

// ─── Eigene Text-Änderungen (Inline-Bearbeitung in der Vorschau) ─────
// Getippte Änderungen landen als texts["cx:<pfad>:<feld>"] an der Instanz
// und werden beim Rendern über den Bauplan gelegt. Baut die AI die Section
// neu, werden sie verworfen (sie gehören zum alten Aufbau).

export const CUSTOM_TEXT_PREFIX = "cx:";

function nodeAt(nodes: CustomNode[], path: string): CustomNode | undefined {
  let list: CustomNode[] | undefined = nodes;
  let node: CustomNode | undefined;
  for (const part of path.split(".")) {
    const i = Number(part);
    if (!list || !Number.isInteger(i)) return undefined;
    node = list[i];
    list = node?.children;
  }
  return node;
}

export function applyCustomOverrides(spec: CustomSpec, texts?: Record<string, string>): CustomSpec {
  const keys = Object.keys(texts || {}).filter((k) => k.startsWith(CUSTOM_TEXT_PREFIX));
  if (!keys.length) return spec;
  const out = JSON.parse(JSON.stringify(spec)) as CustomSpec;
  for (const key of keys) {
    const value = String(texts![key] ?? "");
    const rest = key.slice(CUSTOM_TEXT_PREFIX.length);
    const at = rest.indexOf(":");
    if (at < 0) continue;
    const node = nodeAt(out.nodes, rest.slice(0, at));
    if (!node) continue;
    const f = rest.slice(at + 1).split(".");
    const v = value.slice(0, 600);
    if (f.length === 1 && ["text", "value", "label", "author", "meta"].includes(f[0])) {
      (node as unknown as Record<string, string>)[f[0]] = v;
    } else if (f[0] === "items" && node.items?.[Number(f[1])] && (f[2] === "text" || f[2] === "sub")) {
      node.items[Number(f[1])][f[2] as "text" | "sub"] = v;
    } else if (f[0] === "qa" && node.qa?.[Number(f[1])] && (f[2] === "q" || f[2] === "a")) {
      node.qa[Number(f[1])][f[2] as "q" | "a"] = v;
    } else if (f[0] === "head" && node.head && Number(f[1]) < node.head.length) {
      node.head[Number(f[1])] = v;
    } else if (f[0] === "rows" && node.rows?.[Number(f[1])] && Number(f[2]) < node.rows[Number(f[1])].length) {
      node.rows[Number(f[1])][Number(f[2])] = v;
    }
  }
  return out;
}

// ─── Rendering (EIN Renderer für Vorschau + Liquid) ─────────────────

export interface CustomRenderOpts {
  /** Instanz-uid (CSS-Scope). */
  uid: string;
  mode: "preview" | "liquid";
  palette: ColorPalette;
  /** Ecken-Radius (nur liquid — die Vorschau nutzt --pv-r). */
  radius?: number;
  /** Vorschau: Produktbilder / Preise. */
  images?: string[];
  price?: string;
  compare?: string;
  /** Inline-Text-Änderungen (texts der Instanz). */
  texts?: Record<string, string>;
  /** Flächen-Override aus den Einstellungen (settings.cx_tone). */
  tone?: string;
}

/** Maskiert Text für HTML UND Liquid ({ } würden sonst als Liquid gelesen). */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");
}
const escMl = (s: string) => esc(s).replace(/\n/g, "<br>");

export function customScopeId(uid: string): string {
  return (uid || "x").toLowerCase().replace(/[^a-z0-9]/g, "").slice(-24) || "x";
}

function svgIcon(id: string, size: number, cls = ""): string {
  const paths = getIconAny(id).paths.map((d) => `<path d="${esc(d)}"/>`).join("");
  return `<svg class="bxc-svg ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}
const CHECK = "check";
const CROSS = "x";

interface Ctx {
  mode: "preview" | "liquid";
  images: string[];
  price: string;
  compare: string;
  usesProduct: { v: boolean };
}

/** Editierbares Text-Element (Vorschau: data-ef für die Inline-Bearbeitung). */
function tx(ctx: Ctx, tag: string, cls: string, path: string, field: string, text: string, ml = false): string {
  const edit = ctx.mode === "preview" ? ` data-ef="${CUSTOM_TEXT_PREFIX}${path}:${field}"${ml ? " data-ml" : ""}` : "";
  return `<${tag} class="${cls}"${edit}>${ml ? escMl(text) : esc(text)}</${tag}>`;
}

function imageHtml(ctx: Ctx, n: CustomNode): string {
  const ratio = (n.ratio || "4:3").replace(":", " / ");
  const idx = Math.max(0, Math.min(6, n.image ?? 1));
  const ph = `<div class="bxc-ph">${svgIcon("image", 28)}</div>`;
  let inner = ph;
  if (idx > 0) {
    if (ctx.mode === "preview") {
      const src = ctx.images.length ? ctx.images[(idx - 1) % ctx.images.length] : "";
      if (src) inner = `<img src="${esc(src)}" alt="" loading="lazy">`;
    } else {
      ctx.usesProduct.v = true;
      const i = idx - 1;
      inner = `{%- if bx_p.images[${i}] -%}<img src="{{ bx_p.images[${i}] | image_url: width: 1400 }}" alt="{{ bx_p.title | escape }}" loading="lazy">{%- elsif bx_p.featured_image -%}<img src="{{ bx_p.featured_image | image_url: width: 1400 }}" alt="{{ bx_p.title | escape }}" loading="lazy">{%- else -%}${ph}{%- endif -%}`;
    }
  }
  return `<figure class="bxc-img" style="aspect-ratio:${ratio}">${inner}</figure>`;
}

function priceHtml(ctx: Ctx): string {
  if (ctx.mode === "preview") {
    return `<div class="bxc-price"><strong>${esc(ctx.price || "29,99 €")}</strong>${ctx.compare ? `<s>${esc(ctx.compare)}</s>` : ""}</div>`;
  }
  ctx.usesProduct.v = true;
  return `<div class="bxc-price"><strong>{{ bx_p.price | money }}</strong>{%- if bx_p.compare_at_price > bx_p.price -%}<s>{{ bx_p.compare_at_price | money }}</s>{%- endif -%}</div>`;
}

function buttonHref(link?: string): string {
  if (link === "shop") return "/collections/all";
  if (link === "cart") return "/cart";
  return "#";
}

function renderNode(ctx: Ctx, n: CustomNode, path: string): string {
  switch (n.t) {
    case "eyebrow":
      return tx(ctx, "p", "bxc-eyebrow", path, "text", n.text || "");
    case "heading": {
      const size = n.size || "l";
      return tx(ctx, size === "xl" || size === "l" ? "h2" : "h3", `bxc-h bxc-h-${size}${n.accent ? " bxc-accent" : ""}`, path, "text", n.text || "");
    }
    case "text":
      return tx(ctx, "p", `bxc-p bxc-p-${n.size || "m"}${n.muted ? " bxc-muted" : ""}${n.accent ? " bxc-accent" : ""}`, path, "text", n.text || "", true);
    case "badge":
      return `<div class="bxc-badge-wrap">${tx(ctx, "span", "bxc-badge", path, "text", n.text || "")}</div>`;
    case "button": {
      const style = n.style || "primary";
      const edit = ctx.mode === "preview" ? ` data-ef="${CUSTOM_TEXT_PREFIX}${path}:text"` : "";
      return `<div class="bxc-btn-wrap"><a class="bxc-btn bxc-btn-${style}" href="${buttonHref(n.link)}"><span${edit}>${esc(n.text || "")}</span></a></div>`;
    }
    case "image":
      return imageHtml(ctx, n);
    case "icon":
      return `<div class="bxc-icon${n.boxed ? " bxc-icon-boxed" : ""} bxc-icon-${n.size || "m"}">${svgIcon(n.icon || "sparkles", n.size === "l" || n.size === "xl" ? 34 : n.size === "s" ? 20 : 26)}</div>`;
    case "divider":
      return `<hr class="bxc-hr">`;
    case "price":
      return priceHtml(ctx);
    case "stat":
      return `<div class="bxc-stat">${tx(ctx, "div", "bxc-stat-v", path, "value", n.value || "")}${n.label ? tx(ctx, "div", "bxc-stat-l", path, "label", n.label) : ""}</div>`;
    case "rating": {
      const val = n.value || "4.9";
      return `<div class="bxc-rating"><span class="bxc-stars" aria-hidden="true">★★★★★</span>${tx(ctx, "strong", "bxc-rating-v", path, "value", val)}${n.label ? tx(ctx, "span", "bxc-rating-l", path, "label", n.label) : ""}</div>`;
    }
    case "quote":
      return `<figure class="bxc-quote"><span class="bxc-stars" aria-hidden="true">★★★★★</span>${tx(ctx, "blockquote", "bxc-quote-t", path, "text", n.text || "", true)}${n.author || n.meta ? `<figcaption>${n.author ? tx(ctx, "strong", "bxc-quote-a", path, "author", n.author) : ""}${n.meta ? tx(ctx, "span", "bxc-quote-m", path, "meta", n.meta) : ""}</figcaption>` : ""}</figure>`;
    case "list": {
      const mark = n.mark || "check";
      const items = (n.items || []).map((it, i) => {
        const m =
          mark === "number" ? `<span class="bxc-li-num">${i + 1}</span>`
          : mark === "dot" ? `<span class="bxc-li-dot"></span>`
          : mark === "cross" ? `<span class="bxc-li-ic bxc-li-x">${svgIcon(CROSS, 18)}</span>`
          : mark === "icon" ? `<span class="bxc-li-ic">${svgIcon(it.icon || n.icon || "sparkles", 20)}</span>`
          : `<span class="bxc-li-ic">${svgIcon(CHECK, 18)}</span>`;
        return `<li>${m}<div>${tx(ctx, "span", "bxc-li-t", path, `items.${i}.text`, it.text)}${it.sub ? tx(ctx, "span", "bxc-li-s", path, `items.${i}.sub`, it.sub) : ""}</div></li>`;
      }).join("");
      return `<ul class="bxc-list bxc-list-${mark}">${items}</ul>`;
    }
    case "faq":
      return `<div class="bxc-faq">${(n.qa || []).map((x, i) => `<details${i === 0 ? " open" : ""}><summary>${tx(ctx, "span", "bxc-faq-q", path, `qa.${i}.q`, x.q)}<span class="bxc-faq-plus" aria-hidden="true"></span></summary>${tx(ctx, "div", "bxc-faq-a", path, `qa.${i}.a`, x.a, true)}</details>`).join("")}</div>`;
    case "table": {
      const hl = typeof n.highlight === "number" ? n.highlight : -1;
      const cell = (v: string, field: string, ci: number, head = false) => {
        const cls = `${ci === hl ? "bxc-hl" : ""}${ci === 0 ? " bxc-td0" : ""}`;
        const tag = head ? "th" : "td";
        const mark = v.trim();
        if (!head && (mark === "✓" || mark === "✔" || mark.toLowerCase() === "ja" || mark.toLowerCase() === "yes")) return `<${tag} class="${cls} bxc-c">${svgIcon(CHECK, 20, "bxc-yes")}</${tag}>`;
        if (!head && (mark === "✗" || mark === "✘" || mark === "×" || mark === "-" || mark.toLowerCase() === "nein" || mark.toLowerCase() === "no")) return `<${tag} class="${cls} bxc-c">${svgIcon(CROSS, 20, "bxc-no")}</${tag}>`;
        return tx(ctx, tag, cls, path, field, v);
      };
      const head = n.head ? `<thead><tr>${n.head.map((h, ci) => cell(h, `head.${ci}`, ci, true)).join("")}</tr></thead>` : "";
      const body = (n.rows || []).map((r, ri) => `<tr>${r.map((c, ci) => cell(c, `rows.${ri}.${ci}`, ci)).join("")}</tr>`).join("");
      return `<div class="bxc-table-wrap"><table class="bxc-table">${head}<tbody>${body}</tbody></table></div>`;
    }
    case "grid":
    case "scroller":
    case "card":
    case "columns": {
      const kids = (n.children || []).map((c, i) => renderNode(ctx, c, `${path}.${i}`));
      const gap = n.gap || "m";
      const al = n.align ? ` bxc-a-${n.align}` : "";
      if (n.t === "grid") {
        return `<div class="bxc-grid bxc-cols-${n.cols || 3} bxc-mcols-${n.mcols || 1} bxc-gap-${gap}${n.valign === "center" ? " bxc-vc" : ""}">${kids.map((k) => `<div class="bxc-cell${al}">${k}</div>`).join("")}</div>`;
      }
      if (n.t === "scroller") {
        return `<div class="bxc-scroll bxc-gap-${gap}">${kids.map((k) => `<div class="bxc-slide${al}">${k}</div>`).join("")}</div>`;
      }
      if (n.t === "columns") {
        return `<div class="bxc-cols2 bxc-split-${(n.split || "1:1").replace(":", "")} bxc-gap-${gap}${n.reverse ? " bxc-rev" : ""}${n.valign === "start" ? "" : " bxc-vc"}">${kids.map((k) => `<div class="bxc-col${al}">${k}</div>`).join("")}</div>`;
      }
      return `<div class="bxc-card bxc-card-${n.card || "surface"}${al}">${kids.join("")}</div>`;
    }
    default:
      return "";
  }
}

// ─── CSS ─────────────────────────────────────────────────────────────
// Eine gemeinsame Regelbasis (.bxc …) + Variablen pro Instanz. Mobil greift
// in der Vorschau über .pm-mobile (Handy-Ansicht des Editors), im Shop über
// eine Media-Query — identische Regeln, zwei Auslöser.

const BASE_CSS = `
.bxc{background:var(--bx-bg);color:var(--bx-text);font-family:var(--bx-b);padding:var(--bx-pad) 0}
.bxc *{box-sizing:border-box}
.bxc-in{margin:0 auto;padding:0 20px;display:flex;flex-direction:column;gap:18px}
.bxc-w-narrow{max-width:760px}.bxc-w-normal{max-width:1080px}.bxc-w-wide{max-width:1280px}
.bxc-a-center{text-align:center;align-items:center}.bxc-a-left{text-align:left;align-items:flex-start}
.bxc-in>*{width:100%}
.bxc-a-center>.bxc-p,.bxc-a-center .bxc-p{margin-left:auto;margin-right:auto}
.bxc .bxc-eyebrow{margin:0;color:var(--bx-accent);font-size:12.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;line-height:1.3}
.bxc .bxc-h{margin:0;font-family:var(--bx-h);font-weight:800;line-height:1.1;letter-spacing:-.02em;color:inherit}
.bxc .bxc-h-xl{font-size:46px}.bxc .bxc-h-l{font-size:36px}.bxc .bxc-h-m{font-size:24px}.bxc .bxc-h-s{font-size:18px;letter-spacing:-.01em}
.bxc .bxc-p{margin:0;line-height:1.6;max-width:66ch;color:inherit}
.bxc .bxc-p-s{font-size:14px}.bxc .bxc-p-m{font-size:16px}.bxc .bxc-p-l{font-size:19px}
.bxc .bxc-muted{color:var(--bx-muted)}.bxc .bxc-accent{color:var(--bx-accent)}
.bxc-badge-wrap{display:flex}.bxc-a-center .bxc-badge-wrap,.bxc-a-center>.bxc-badge-wrap{justify-content:center}
.bxc .bxc-badge{display:inline-block;padding:6px 12px;border:1.5px solid var(--bx-accent);color:var(--bx-accent);border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.04em}
.bxc-btn-wrap{display:flex}.bxc-a-center .bxc-btn-wrap{justify-content:center}
.bxc .bxc-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:50px;padding:14px 28px;border-radius:var(--bx-r);font-weight:700;font-size:15.5px;text-decoration:none;line-height:1.2;transition:filter .2s}
.bxc .bxc-btn-primary{background:var(--bx-btn);color:var(--bx-btn-text)}
.bxc .bxc-btn-secondary{border:1.5px solid currentColor;color:inherit;background:transparent}
.bxc .bxc-btn-link{padding:0;min-height:0;color:var(--bx-accent);text-decoration:underline;text-underline-offset:4px}
.bxc .bxc-btn:hover{filter:brightness(1.08)}
.bxc-img{margin:0;width:100%;border-radius:var(--bx-r);overflow:hidden;background:var(--bx-card)}
.bxc-img img{display:block;width:100%;height:100%;object-fit:cover}
.bxc-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--bx-muted)}
.bxc-icon{display:flex;color:var(--bx-accent)}.bxc-a-center .bxc-icon,.bxc-a-center>.bxc-icon{justify-content:center}
.bxc-icon-boxed .bxc-svg{box-sizing:content-box;padding:12px;border-radius:calc(var(--bx-r) + 4px);background:var(--bx-card)}
.bxc-svg{flex-shrink:0;display:block}
.bxc-hr{width:100%;border:0;border-top:1px solid var(--bx-line);margin:4px 0}
.bxc-price{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.bxc-a-center .bxc-price{justify-content:center}
.bxc-price strong{font-family:var(--bx-h);font-size:30px;font-weight:800}.bxc-price s{color:var(--bx-muted);font-size:17px}
.bxc-stat-v{font-family:var(--bx-h);font-size:40px;font-weight:800;line-height:1;color:var(--bx-accent);letter-spacing:-.02em}
.bxc-stat-l{margin-top:6px;font-size:14px;color:var(--bx-muted);line-height:1.4}
.bxc-rating{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.bxc-a-center .bxc-rating{justify-content:center}
.bxc-stars{color:var(--bx-accent);letter-spacing:2px;font-size:16px}
.bxc-rating-l{color:var(--bx-muted);font-size:14px}
.bxc-quote{margin:0;display:flex;flex-direction:column;gap:10px}
.bxc .bxc-quote-t{margin:0;font-size:16px;line-height:1.6;font-style:normal}
.bxc-quote figcaption{display:flex;flex-direction:column;gap:2px;font-size:13.5px}.bxc-quote-m{color:var(--bx-muted)}
.bxc-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px;text-align:left}
.bxc-a-center .bxc-list{max-width:560px;margin:0 auto}
.bxc-list li{display:flex;gap:12px;align-items:flex-start}
.bxc-li-ic{color:var(--bx-accent);display:flex;margin-top:1px}.bxc-li-x{color:var(--bx-muted)}
.bxc-li-num{flex-shrink:0;width:26px;height:26px;border-radius:50%;border:1.5px solid var(--bx-accent);color:var(--bx-accent);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700}
.bxc-li-dot{flex-shrink:0;width:7px;height:7px;border-radius:50%;background:var(--bx-accent);margin-top:9px}
.bxc-li-t{display:block;font-weight:600;line-height:1.45}.bxc-li-s{display:block;margin-top:2px;color:var(--bx-muted);font-size:14px;line-height:1.5}
.bxc-faq{display:flex;flex-direction:column;text-align:left;width:100%}
.bxc-faq details{border-bottom:1px solid var(--bx-line)}
.bxc-faq summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 0;font-weight:700;font-size:16px}
.bxc-faq summary::-webkit-details-marker{display:none}
.bxc-faq-plus{position:relative;width:14px;height:14px;flex-shrink:0}
.bxc-faq-plus::before,.bxc-faq-plus::after{content:"";position:absolute;left:0;top:6px;width:14px;height:2px;background:var(--bx-accent);transition:transform .2s}
.bxc-faq-plus::after{transform:rotate(90deg)}.bxc-faq details[open] .bxc-faq-plus::after{transform:rotate(0)}
.bxc-faq-a{padding:0 0 18px;color:var(--bx-muted);line-height:1.6;font-size:15px}
.bxc-table-wrap{width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}
.bxc-table{width:100%;border-collapse:collapse;font-size:15px;min-width:420px}
.bxc-table th,.bxc-table td{padding:14px 12px;border-bottom:1px solid var(--bx-line);text-align:center;vertical-align:middle}
.bxc-table th{font-family:var(--bx-h);font-weight:800;font-size:15px}
.bxc-table .bxc-td0{text-align:left;font-weight:600}
.bxc-table .bxc-hl{background:var(--bx-card)}
.bxc-table th.bxc-hl{color:var(--bx-accent);box-shadow:inset 0 3px 0 var(--bx-accent)}
.bxc-table .bxc-c .bxc-svg{margin:0 auto}.bxc-yes{color:var(--bx-accent)}.bxc-no{color:var(--bx-muted)}
.bxc-grid{display:grid;width:100%}
.bxc-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.bxc-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.bxc-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}
.bxc-gap-s{gap:12px}.bxc-gap-m{gap:20px}.bxc-gap-l{gap:32px}
.bxc-vc{align-items:center}
.bxc-cell,.bxc-col,.bxc-slide{display:flex;flex-direction:column;gap:12px;min-width:0}
.bxc-cell.bxc-a-center,.bxc-col.bxc-a-center,.bxc-slide.bxc-a-center{align-items:center}
.bxc-cols2{display:grid;width:100%}
.bxc-split-11{grid-template-columns:1fr 1fr}.bxc-split-21{grid-template-columns:2fr 1fr}.bxc-split-12{grid-template-columns:1fr 2fr}
.bxc-scroll{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:6px;width:100%;-webkit-overflow-scrolling:touch;scrollbar-width:thin}
.bxc-slide{flex:0 0 min(300px,80%);scroll-snap-align:start}
.bxc-card{display:flex;flex-direction:column;gap:12px;padding:24px;border-radius:var(--bx-r);height:100%;width:100%;text-align:left}
.bxc-card.bxc-a-center{text-align:center;align-items:center}
.bxc-card-surface{background:var(--bx-card)}.bxc-card-outline{border:1px solid var(--bx-line)}.bxc-card-plain{padding:0}
`;

const MOBILE_RULES: [string, string][] = [
  [".bxc", "padding:calc(var(--bx-pad) * .7) 0"],
  [".bxc .bxc-h-xl", "font-size:32px"],
  [".bxc .bxc-h-l", "font-size:27px"],
  [".bxc .bxc-h-m", "font-size:21px"],
  [".bxc .bxc-p-l", "font-size:17px"],
  [".bxc-in", "gap:14px"],
  [".bxc-mcols-1", "grid-template-columns:1fr"],
  [".bxc-mcols-2", "grid-template-columns:repeat(2,minmax(0,1fr))"],
  [".bxc-cols2", "grid-template-columns:1fr"],
  [".bxc-rev>.bxc-col:first-child", "order:2"],
  [".bxc-card", "padding:20px"],
  [".bxc-card-plain", "padding:0"],
  [".bxc-stat-v", "font-size:32px"],
  [".bxc-gap-l", "gap:22px"],
];

let cssCache: { preview: string; liquid: string } | null = null;
function baseCss(mode: "preview" | "liquid"): string {
  if (!cssCache) {
    const pv = MOBILE_RULES.map(([s, d]) => `.pm-mobile ${s}{${d}}`).join("\n");
    const lq = `@media screen and (max-width:749px){${MOBILE_RULES.map(([s, d]) => `${s}{${d}}`).join("")}}`;
    const min = (s: string) => s.replace(/\n+/g, "");
    cssCache = { preview: min(BASE_CSS + pv), liquid: min(BASE_CSS + lq) };
  }
  return cssCache[mode];
}

function toneVars(tone: string, palette: ColorPalette): { bg: string; text: string; card: string } {
  const tk = monoTokens(palette);
  if (tone === "contrast") {
    const bg = tk.dark ? MONO.inkSoft : MONO.ink;
    return { bg, text: MONO.textDark, card: mixHex(bg, "#ffffff", 0.08) };
  }
  if (tone === "subtle") return { bg: tk.surface, text: tk.text, card: tk.page };
  return { bg: tk.page, text: tk.text, card: tk.surface };
}

/** Rendert eine KI-Section komplett (Wrapper + Stil + Inhalt). Im Liquid-
 *  Modus werden Produktbild/-preis als echte Liquid-Ausdrücke eingesetzt. */
export function renderCustomSection(spec: CustomSpec, opts: CustomRenderOpts): string {
  const s = applyCustomOverrides(spec, opts.texts);
  const tone = pick(opts.tone, ["page", "subtle", "contrast"] as const) || s.tone;
  const v = toneVars(tone, opts.palette);
  const muted = mixHex(v.text, v.bg, 0.38);
  const line = mixHex(v.text, v.bg, 0.86);
  const scope = `bxc-${customScopeId(opts.uid)}`;
  const pad = s.space === "s" ? "36px" : s.space === "l" ? "96px" : "64px";
  const fonts = opts.mode === "preview"
    ? "--bx-h:var(--pv-h);--bx-b:var(--pv-b);--bx-r:var(--pv-r,10px)"
    : `--bx-h:var(--font-heading-family,inherit);--bx-b:var(--font-body-family,inherit);--bx-r:${Math.max(0, Math.min(40, Math.round(opts.radius ?? 10)))}px`;
  // Button muss sich von der Fläche abheben (z. B. schwarzer Button auf der
  // dunklen Kontrast-Fläche) — sonst invertiert: Textfarbe als Button.
  const lowContrast = Math.abs(relLuminance(opts.palette.button) - relLuminance(v.bg)) < 0.2;
  const btn = lowContrast ? v.text : opts.palette.button;
  const btnText = lowContrast ? v.bg : opts.palette.buttonText;
  const vars = `.${scope}{--bx-bg:${v.bg};--bx-text:${v.text};--bx-muted:${muted};--bx-line:${line};--bx-card:${v.card};--bx-accent:${opts.palette.accent};--bx-btn:${btn};--bx-btn-text:${btnText};--bx-pad:${pad};${fonts}}`;

  const ctx: Ctx = {
    mode: opts.mode,
    images: opts.images || [],
    price: opts.price || "",
    compare: opts.compare || "",
    usesProduct: { v: false },
  };
  const body = s.nodes.map((n, i) => renderNode(ctx, n, String(i))).join("");
  const html = `<section class="bxc ${scope}" data-bxc><style>${baseCss(opts.mode)}${vars}</style><div class="bxc-in bxc-w-${s.width} bxc-a-${s.align}">${body}</div></section>`;
  if (opts.mode === "liquid" && ctx.usesProduct.v) {
    // Startseite hat kein product-Objekt → erstes Produkt des Shops.
    return `{%- assign bx_p = product -%}{%- if bx_p == blank -%}{%- assign bx_p = collections.all.products.first -%}{%- endif -%}${html}`;
  }
  return html;
}

/** Liquid-Datei einer KI-Section für das Theme (sections/<typ>.liquid). */
export function customSectionLiquid(spec: CustomSpec, opts: Omit<CustomRenderOpts, "mode" | "images" | "price" | "compare">): string {
  const html = renderCustomSection(spec, { ...opts, mode: "liquid" });
  // Shopify: Schema-Name max. 25 Zeichen.
  const name = `KI: ${spec.name}`.slice(0, 25);
  const schema = { name, settings: [] as unknown[] };
  return `${html}\n{% schema %}\n${JSON.stringify(schema, null, 2)}\n{% endschema %}\n`;
}

/** Section-Typ (= Dateiname) einer KI-Section im Theme. */
export function customSectionFileType(uid: string): string {
  return `bspx-ai-${customScopeId(uid)}`;
}
