import "server-only";
import AdmZip from "adm-zip";
import { Liquid } from "liquidjs";
import { getPlaceholderValues, recolorByRole, type ColorPalette, type ThemeCopy } from "@/lib/theme-placeholders";

// ─────────────────────────────────────────────────────────────────
// ECHTES Theme-Rendering: rendert die tatsächlichen Shopify-Liquid-Sections
// des Master-Themes (1:1 Layout, echte Settings, echtes CSS) zu HTML für die
// Live-Vorschau. LiquidJS + Shopify-Stubs (Tags/Filter/Objekte). Die Texte
// kommen aus themeCopy (Tokens ersetzt), die Farb-Palette + Schrift werden
// wie beim Download angewandt (recolorByRole + Farbschema-Variablen).
// ─────────────────────────────────────────────────────────────────

export interface RenderProduct {
  title: string;
  priceCents: number;
  compareCents: number;
  images: string[];
  descriptionHtml: string;
}

export const RENDER_FONTS: Record<string, { family: string; param: string }> = {
  work_sans_n4: { family: "Work Sans", param: "Work+Sans:wght@400;600;800" },
  acme_n4: { family: "Acme", param: "Acme" },
  assistant_n4: { family: "Assistant", param: "Assistant:wght@400;600;800" },
  montserrat_n4: { family: "Montserrat", param: "Montserrat:wght@400;600;800" },
  poppins_n4: { family: "Poppins", param: "Poppins:wght@400;600;800" },
  roboto_n4: { family: "Roboto", param: "Roboto:wght@400;500;700" },
  inter_n4: { family: "Inter", param: "Inter:wght@400;600;800" },
  lato_n4: { family: "Lato", param: "Lato:wght@400;700;900" },
  nunito_n4: { family: "Nunito", param: "Nunito:wght@400;600;800" },
  raleway_n4: { family: "Raleway", param: "Raleway:wght@400;600;800" },
  oswald_n4: { family: "Oswald", param: "Oswald:wght@400;600;700" },
  bebas_neue_n4: { family: "Bebas Neue", param: "Bebas+Neue" },
  playfair_n4: { family: "Playfair Display", param: "Playfair+Display:wght@400;600;800" },
  merriweather_n4: { family: "Merriweather", param: "Merriweather:wght@400;700;900" },
  dmsans_n4: { family: "DM Sans", param: "DM+Sans:wght@400;600;700" },
};

const PLACEHOLDER_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='800'><rect width='800' height='800' fill='%23ececf1'/></svg>`,
  );

// ─── Engine + statische Theme-Daten (pro Lambda-Instanz gecached) ──
interface ThemeEnv {
  engine: Liquid;
  zip: AdmZip;
  baseCss: string;
  styleBlock: string;
  themeLiquid: string;
  settingsData: Record<string, unknown>;
  productImagesRef: { current: string[] };
  translate: (key: string) => string;
}
let CACHE: ThemeEnv | null = null;

function readEntry(zip: AdmZip, name: string): string | null {
  const e = zip.getEntry(name);
  return e ? e.getData().toString("utf8") : null;
}

function buildEnv(masterZip: Buffer): ThemeEnv {
  const zip = new AdmZip(masterZip);
  const productImagesRef = { current: [] as string[] };

  // Locale fürs t-Filter UND zum Auflösen von Schema-`t:`-Defaults: Storefront
  // (*.default.json) + Schema (*.default.schema.json) zusammenführen.
  let locale: Record<string, unknown> = {};
  const deepMerge = (a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> => {
    for (const k of Object.keys(b)) {
      const bv = b[k];
      if (bv && typeof bv === "object" && !Array.isArray(bv)) {
        const av = a[k] && typeof a[k] === "object" ? (a[k] as Record<string, unknown>) : {};
        a[k] = deepMerge(av, bv as Record<string, unknown>);
      } else a[k] = bv;
    }
    return a;
  };
  for (const re of [/^locales\/[a-z-]+\.default\.json$/, /^locales\/[a-z-]+\.default\.schema\.json$/]) {
    const entry = zip.getEntries().find((e) => re.test(e.entryName));
    if (entry) {
      try {
        locale = deepMerge(locale, JSON.parse(entry.getData().toString("utf8")));
      } catch {
        /* ignore */
      }
    }
  }
  const tLookup = (key: string): string | null => {
    let cur: unknown = locale;
    for (const p of String(key).split(".")) {
      if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[p];
      else return null;
    }
    return typeof cur === "string" ? cur : null;
  };

  // Custom fs: löst {% render 'x' %} aus snippets/ der Zip auf.
  const snippetSrc = (name: string): string | null =>
    readEntry(zip, `snippets/${String(name).replace(/\.liquid$/, "").replace(/^\.?\//, "")}.liquid`);
  const liquidFs = {
    sep: "/",
    dirname: (p: string) => p,
    resolve: (_root: string, file: string) => String(file).replace(/\.liquid$/, ""),
    existsSync: (p: string) => snippetSrc(p) !== null,
    readFileSync: (p: string) => snippetSrc(p) ?? "",
    exists: (p: string) => Promise.resolve(snippetSrc(p) !== null),
    readFile: (p: string) => Promise.resolve(snippetSrc(p) ?? ""),
    contains: () => true,
    fallback: () => undefined,
  };

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const engine = new Liquid({
    fs: liquidFs,
    extname: ".liquid",
    jsTruthy: true,
    relativeReference: false,
    strictFilters: false,
    strictVariables: false,
    catchAllErrors: true,
  } as any);
  const eng: any = engine;

  // ── Block-Tags (schema/javascript ignorieren, style/stylesheet → <style>,
  //    form → <form>, paginate → Inhalt) ──
  const blockTag = (name: string) => ({
    parse(this: any, _token: any, remain: any) {
      this.tpls = [];
      const stream = eng.parser
        .parseStream(remain)
        .on(`tag:end${name}`, function (this: any) { this.stop(); })
        .on("template", (tpl: any) => this.tpls.push(tpl))
        .on("end", () => { throw new Error(`${name} not closed`); });
      stream.start();
    },
    *render(this: any, ctx: any, emitter: any): any {
      if (name === "style" || name === "stylesheet") {
        emitter.write("<style>");
        yield eng.renderer.renderTemplates(this.tpls, ctx, emitter);
        emitter.write("</style>");
      } else if (name === "javascript") {
        // Section-JS einbetten — die Custom-Elements (slider/gallery/…) brauchen es.
        emitter.write("<script>");
        yield eng.renderer.renderTemplates(this.tpls, ctx, emitter);
        emitter.write("</script>");
      } else if (name === "form") {
        emitter.write("<form>");
        yield eng.renderer.renderTemplates(this.tpls, ctx, emitter);
        emitter.write("</form>");
      } else if (name === "paginate") {
        yield eng.renderer.renderTemplates(this.tpls, ctx, emitter);
      }
      // schema → nichts ausgeben
    },
  });
  for (const tg of ["schema", "javascript", "style", "stylesheet", "form", "paginate"]) {
    eng.registerTag(tg, blockTag(tg));
  }
  eng.registerTag("section", { parse() {}, render: () => "" });
  eng.registerTag("sections", { parse() {}, render: () => "" });
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // ── Filter ──
  const money = (v: unknown) => {
    const n = typeof v === "number" ? v : parseFloat(String(v)) || 0;
    return (n / 100).toFixed(2).replace(".", ",") + " €";
  };
  const assetImg = (v: unknown) => {
    if (v && typeof v === "object") {
      const o = v as { src?: string; url?: string };
      if (o.src || o.url) return String(o.src || o.url);
    }
    const s = String(v ?? "");
    if (/^https?:/.test(s)) return s;
    return productImagesRef.current[0] || PLACEHOLDER_IMG;
  };
  const F: Record<string, (...a: unknown[]) => unknown> = {
    money,
    money_with_currency: money,
    money_without_currency: (v) => money(v).replace(" €", ""),
    t: (key) => tLookup(String(key)) || String(key).split(".").pop()!.replace(/_/g, " "),
    asset_url: (v) => String(v),
    asset_img_url: (v) => assetImg(v),
    file_url: (v) => String(v),
    image_url: (v) => assetImg(v),
    img_url: (v) => assetImg(v),
    image_tag: (url) => `<img src="${assetImg(url)}" loading="lazy" style="max-width:100%">`,
    stylesheet_tag: (url) => { const c = readEntry(zip, `assets/${String(url)}`); return c ? `<style>${c}</style>` : ""; },
    script_tag: () => "",
    inline_asset_content: (name) => readEntry(zip, `assets/${String(name)}`) ?? "",
    placeholder_svg_tag: () => `<svg viewBox="0 0 60 60" style="background:#eee;width:100%"><rect width="60" height="60" fill="#e9e9ee"/></svg>`,
    payment_type_svg_tag: () => "",
    handle: (v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    handleize: (v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    weight_with_unit: (v) => `${v} g`,
    // color-Filter (Style-Block)
    color_lighten: (v) => v,
    color_darken: (v) => v,
    color_saturate: (v) => v,
    color_desaturate: (v) => v,
    color_mix: (v) => v,
    color_modify: (v) => v,
    color_brightness: () => 128,
    color_to_rgb: (v) => v,
    color_extract: () => 128,
    color_contrast: () => 5,
    color_difference: () => 100,
    brightness_difference: () => 50,
    font_face: () => "",
    font_modify: (v) => v,
    font_url: () => "",
    metafield_tag: (v) => String(v ?? ""),
    metafield_text: (v) => String(v ?? ""),
  };
  for (const [k, fn] of Object.entries(F)) engine.registerFilter(k, fn);

  // settings_data
  const settingsRoot = (() => {
    try {
      return JSON.parse(readEntry(zip, "config/settings_data.json") || "{}").current || {};
    } catch {
      return {};
    }
  })();

  // theme.liquid Style-Block extrahieren + base.css
  const themeLiquid = readEntry(zip, "layout/theme.liquid") || "";
  const a = themeLiquid.indexOf("{% style %}");
  const b = themeLiquid.indexOf("{% endstyle %}");
  const styleBlock = a >= 0 && b >= 0 ? themeLiquid.slice(a, b + "{% endstyle %}".length) : "";
  const baseCss = readEntry(zip, "assets/base.css") || "";

  const translate = (key: string) => tLookup(key) || String(key).split(".").pop()!.replace(/_/g, " ");
  return { engine, zip, baseCss, styleBlock, themeLiquid, settingsData: settingsRoot, productImagesRef, translate };
}

// ─── Farb-/Settings-Helfer ───
function hexToColorObj(hex: string) {
  const h = String(hex || "#000000").replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const red = parseInt(f.slice(0, 2), 16) || 0, green = parseInt(f.slice(2, 4), 16) || 0, blue = parseInt(f.slice(4, 6), 16) || 0;
  return { red, green, blue, rgb: `${red}, ${green}, ${blue}`, alpha: 1, toString: () => "#" + f };
}
function fontObj(family: string) {
  return { family, fallback_families: "sans-serif", style: "normal", weight: "400", toString: () => family };
}
function buildSettings(settingsData: Record<string, unknown>, palette: ColorPalette, bodyFamily: string, headingFamily: string) {
  const s: Record<string, unknown> = JSON.parse(JSON.stringify(settingsData));
  const schemesObj = (settingsData.color_schemes as Record<string, { settings?: Record<string, string> }>) || {};
  s.color_schemes = Object.keys(schemesObj).map((id) => {
    const cs = schemesObj[id]?.settings || {};
    return {
      id,
      settings: {
        background: hexToColorObj(id === "scheme-1" ? palette.background : cs.background),
        background_gradient: "",
        text: hexToColorObj(id === "scheme-1" ? palette.text : cs.text),
        button: hexToColorObj(palette.button),
        button_label: hexToColorObj(palette.buttonText),
        secondary_button_label: hexToColorObj(cs.secondary_button_label || cs.text),
        shadow: hexToColorObj(cs.shadow || "#121212"),
      },
    };
  });
  s.type_body_font = fontObj(bodyFamily);
  s.type_header_font = fontObj(headingFamily);
  return s;
}

// ─── Section-Settings: Tokens ersetzen + Palette-Recolor ───
const TOKEN_RE = /\[\[([A-Z0-9_]+)\]\]/g;
function transformDeep(node: unknown, values: ThemeCopy, palette: ColorPalette): void {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      if (typeof node[i] === "string") node[i] = transformStr(node[i], values, palette, "");
      else transformDeep(node[i], values, palette);
    }
  } else if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      if (typeof obj[k] === "string") obj[k] = transformStr(obj[k] as string, values, palette, k);
      else transformDeep(obj[k], values, palette);
    }
  }
}
function transformStr(str: string, values: ThemeCopy, palette: ColorPalette, key: string): string {
  const recolored = recolorByRole(key, str, palette);
  if (recolored) return recolored;
  return str.replace(TOKEN_RE, (m, k: string) => (values[k] != null ? String(values[k]) : m));
}

function buildSectionObj(id: string, sec: { type: string; settings?: Record<string, unknown>; blocks?: Record<string, { type: string; settings?: Record<string, unknown> }>; block_order?: string[] }) {
  const blocks = (sec.block_order || Object.keys(sec.blocks || {})).map((bid) => {
    const bl = sec.blocks?.[bid];
    return { id: bid, type: bl?.type || "", settings: bl?.settings || {}, shopify_attributes: "" };
  });
  return { id, settings: sec.settings || {}, blocks, location: "template", index: 0, index0: 0, shopify_attributes: "" };
}

// ─── Leere Settings logisch füllen (wie Shopify: Schema-Defaults + Beispiele) ──
/* eslint-disable @typescript-eslint/no-explicit-any */
function imageObject(url: string) {
  return {
    src: url, url, width: 1200, height: 1200, aspect_ratio: 1, alt: "", id: 1, media_type: "image",
    preview_image: { src: url, url, width: 1200, height: 1200, aspect_ratio: 1 },
    toString: () => url,
  };
}

const SCHEMA_CACHE = new Map<string, { settings: any[]; blocks: { type: string; settings?: any[] }[] } | null>();
function getSchema(type: string, src: string) {
  if (SCHEMA_CACHE.has(type)) return SCHEMA_CACHE.get(type)!;
  const m = src.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
  let parsed: { settings?: any[]; blocks?: any[] } | null = null;
  if (m) {
    try { parsed = JSON.parse(m[1]); } catch { parsed = null; }
  }
  const result = parsed ? { settings: parsed.settings || [], blocks: parsed.blocks || [] } : null;
  SCHEMA_CACHE.set(type, result);
  return result;
}

const IMG_TYPES = new Set(["image_picker"]);
const TEXT_TYPES = new Set(["text", "textarea", "richtext", "inline_richtext", "html", "liquid"]);
// Polierte, realistische Beispiel-Copy (rotiert) — sieht aus wie ein echter
// Shop, nicht wie Dev-Platzhalter („Beispieltext").
const EX_COPY: Record<string, string[]> = {
  heading: ["Spürbar besser im Alltag", "Qualität, die man fühlt", "Dafür wirst du es lieben", "Mehr als nur ein Produkt", "Das macht den Unterschied"],
  sub: ["Von tausenden Kunden geliebt", "Premium-Qualität, fairer Preis", "Entwickelt für deinen Alltag", "Darum lohnt es sich"],
  body: [
    "Hochwertige Materialien und ein durchdachtes Design — für ein Ergebnis, das du jeden Tag spürst.",
    "Wir verbinden Funktion mit Stil, damit du dich auf das Wesentliche konzentrieren kannst.",
    "Sorgfältig ausgewählt, fair produziert und gemacht, um lange zu halten.",
    "Einfach, durchdacht und zuverlässig — genau so, wie du es brauchst.",
  ],
  button: ["Jetzt entdecken", "Mehr erfahren", "Jetzt sichern", "Zum Angebot"],
  quote: [
    "Beste Entscheidung seit langem — ich nutze es täglich.",
    "Top Qualität, blitzschnelle Lieferung. Klare Empfehlung!",
    "Hat meine Erwartungen wirklich übertroffen.",
    "Endlich ein Produkt, das hält was es verspricht.",
    "Würde ich jederzeit wieder kaufen. Fünf Sterne!",
  ],
  name: ["Sarah M.", "Tom K.", "Laura B.", "Nico W.", "Julia S.", "Petra H."],
  loc: ["München", "Berlin", "Hamburg", "Köln", "Frankfurt", "Stuttgart"],
  date: ["vor 2 Tagen", "vor 1 Woche", "vor 3 Tagen", "vor 5 Tagen", "vor 4 Tagen"],
  label: ["Qualität", "Design", "Komfort", "Haltbarkeit", "Preis-Leistung"],
};
function exampleText(id: string, label: unknown, idx: number): string {
  const k = (id + " " + (typeof label === "string" ? label : "")).toLowerCase();
  const pick = (arr: string[]) => arr[idx % arr.length];
  if (/(sub|unter|eyebrow|subtitle|subheading|lede)/.test(k)) return pick(EX_COPY.sub);
  if (/(button|btn|cta)/.test(k)) return pick(EX_COPY.button);
  if (/(quote|review|bewert|message|testimonial)/.test(k)) return pick(EX_COPY.quote);
  if (/(author|autor|^name|_name)/.test(k)) return pick(EX_COPY.name);
  if (/(location|^ort|_ort|city|stadt)/.test(k)) return pick(EX_COPY.loc);
  if (/(date|datum)/.test(k)) return pick(EX_COPY.date);
  if (/(price|preis|amount)/.test(k)) return "29,99€";
  if (/(head|title|titel|über|headline|heading)/.test(k)) return pick(EX_COPY.heading);
  if (/(desc|text|body|content|absatz|para|info|antwort)/.test(k)) return pick(EX_COPY.body);
  if (/label/.test(k)) return pick(EX_COPY.label);
  return pick(EX_COPY.heading);
}
/** Merged Schema-Defaults in die Settings (wie Shopify) und füllt leere
 *  Text-/Bild-Settings mit Beispielen, damit keine Lücken bleiben. */
function fillSettings(settings: Record<string, unknown>, schemaSettings: any[], pickImg: () => string, resolveT: (k: string) => string, idxRef: { n: number }) {
  for (const def of schemaSettings || []) {
    if (!def || !def.id || def.type === "header" || def.type === "paragraph") continue;
    const id: string = def.id;
    if (IMG_TYPES.has(def.type)) {
      // Icons/Logos/SVGs NICHT durch Beispielbilder ersetzen — die sollen so
      // bleiben wie im Theme. Nur „echte" Bild-Slots füllen.
      if (/icon|logo|svg|badge/i.test(id)) continue;
      settings[id] = imageObject(pickImg()); // leere/Shopify-Bilder → echtes Beispielbild
      continue;
    }
    const cur = settings[id];
    const empty = cur === undefined || cur === null || (typeof cur === "string" && cur.trim() === "");
    if (!empty) continue;
    // Schema-Default (Shopify-`t:`-Übersetzungskeys auflösen).
    let dv = def.default;
    if (typeof dv === "string" && dv.startsWith("t:")) dv = resolveT(dv.slice(2));
    if (dv !== undefined && dv !== "") settings[id] = dv;
    else if (TEXT_TYPES.has(def.type)) settings[id] = exampleText(id, def.label, idxRef.n++);
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function buildProductObj(p: RenderProduct) {
  const imgs = (p.images.length ? p.images : [PLACEHOLDER_IMG]).map((url) => ({
    src: url, url, width: 1200, height: 1200, aspect_ratio: 1, alt: p.title, id: 1, media_type: "image",
    preview_image: { src: url, url, width: 1200, height: 1200, aspect_ratio: 1 },
  }));
  const variant = {
    id: 1, available: true, price: p.priceCents, compare_at_price: p.compareCents || null,
    title: "Standard", featured_image: imgs[0], featured_media: imgs[0], options: [],
    inventory_management: null, selected: true, quantity_rule: { min: 1, max: null, increment: 1 },
  };
  return {
    id: 1, title: p.title, handle: "produkt", url: "/products/produkt",
    description: p.descriptionHtml, content: p.descriptionHtml, vendor: "",
    price: p.priceCents, price_min: p.priceCents, price_max: p.priceCents,
    compare_at_price: p.compareCents || null, compare_at_price_max: p.compareCents || null,
    available: true, first_available_variant: variant, selected_or_first_available_variant: variant,
    selected_variant: null, variants: [variant], options_with_values: [], has_only_default_variant: true,
    featured_image: imgs[0], featured_media: imgs[0], images: imgs, media: imgs, type: "", tags: [],
    options: [], metafields: {}, collections: [],
  };
}

// ─── Öffentliche API ───
export interface RenderPageOpts {
  template: "index.json" | "product.json";
  themeCopy: ThemeCopy;
  product: RenderProduct;
  palette: ColorPalette;
  font: string; // Body-Schrift
  headingFont?: string; // Überschriften-Schrift (default = Body)
  limitSections?: number; // Vorschau: nur die ersten N Content-Sections (0 = alle)
  hiddenTypes?: string[]; // Section-Typen, die der Style ausblendet
  settingOverrides?: Record<string, unknown>; // globale settings-Overrides (Style)
}

export async function renderThemePage(masterZip: Buffer, opts: RenderPageOpts): Promise<string> {
  if (!CACHE) CACHE = buildEnv(masterZip);
  const env = CACHE;
  env.productImagesRef.current = opts.product.images;

  const bodyMeta = RENDER_FONTS[opts.font] || RENDER_FONTS.work_sans_n4;
  const headMeta = RENDER_FONTS[opts.headingFont || ""] || bodyMeta;
  const fontMeta = { param: headMeta.param === bodyMeta.param ? bodyMeta.param : `${headMeta.param}&family=${bodyMeta.param}` };
  const settings = buildSettings(env.settingsData, opts.palette, bodyMeta.family, headMeta.family);
  if (opts.settingOverrides) Object.assign(settings, opts.settingOverrides); // Style-Overrides (Radius/Spacing …)
  const product = buildProductObj(opts.product);

  // IMAGE_URL-Tokens mit echten Produktbildern füllen (sonst leere Bilder).
  const values: ThemeCopy = getPlaceholderValues(opts.themeCopy);
  const imgs = opts.product.images;
  if (imgs.length) for (let i = 1; i <= 7; i++) values[`IMAGE_URL_${i}`] = imgs[(i - 1) % imgs.length];

  const ctxBase: Record<string, unknown> = {
    settings,
    product,
    shop: { name: "Dein Shop", url: "", permanent_domain: "", currency: "EUR", money_format: "{{amount}} €", enabled_payment_types: [] },
    routes: { root_url: "/", cart_url: "/cart", account_url: "/account", search_url: "/search", all_products_collection_url: "/collections/all", predictive_search_url: "/search/suggest", cart_add_url: "/cart/add" },
    request: { design_mode: false, visual_preview_mode: false, page_type: opts.template === "product.json" ? "product" : "index", locale: { iso_code: "de" } },
    cart: { item_count: 0, items: [], total_price: 0 },
    collection: { products: [], all_products_count: 0, title: "Kollektion" },
    collections: {},
    recommendations: { products: [], performed: false },
    predictive_search: { performed: false, resources: {} },
    template: { name: opts.template.replace(".json", "") },
    canonical_url: "/",
    blank: false,
  };

  // Objekte, die der theme.liquid-Head/Body referenziert.
  ctxBase.content_for_header = "";
  ctxBase.localization = { available_countries: [], available_languages: [], country: {}, language: {} };

  const tplJson = JSON.parse(readEntry(env.zip, `templates/${opts.template}`) || "{}");
  const order: string[] = Array.isArray(tplJson.order) ? tplJson.order : [];

  // Beispielbilder zum Füllen leerer Bild-Settings (zyklisch durch die echten
  // Produktbilder, sonst Platzhalter).
  const prodImgs = opts.product.images.length ? opts.product.images : [PLACEHOLDER_IMG];
  let imgIdx = 0;
  const pickImg = () => prodImgs[imgIdx++ % prodImgs.length];
  const idxRef = { n: 0 }; // rotiert die Beispiel-Copy über alle Sections hinweg

  // Aktive Sections rendern: Tokens ersetzt + Recolor + Schema-Defaults gemerged
  // + leere Texte/Bilder mit Beispielen gefüllt. Pro Section fehlertolerant.
  const hidden = new Set(opts.hiddenTypes || []);
  const limit = opts.limitSections || 0;
  let contentCount = 0;
  let body = "";
  for (const id of order) {
    const sec = tplJson.sections[id];
    if (!sec || sec.disabled === true) continue;
    if (hidden.has(sec.type)) continue; // vom gewählten Style ausgeblendet
    const liquidSrc = readEntry(env.zip, `sections/${sec.type}.liquid`);
    if (!liquidSrc || !liquidSrc.trim()) continue; // leere/fehlende Sections überspringen
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const secClone: any = JSON.parse(JSON.stringify(sec));
    transformDeep(secClone, values, opts.palette);
    const schema = getSchema(sec.type, liquidSrc);
    if (schema) {
      if (!secClone.settings) secClone.settings = {};
      fillSettings(secClone.settings, schema.settings, pickImg, env.translate, idxRef);
      if (secClone.blocks) {
        for (const bid of Object.keys(secClone.blocks)) {
          const bl = secClone.blocks[bid];
          if (!bl) continue;
          if (!bl.settings) bl.settings = {};
          const bdef = (schema.blocks || []).find((x: any) => x.type === bl.type);
          if (bdef) fillSettings(bl.settings, bdef.settings || [], pickImg, env.translate, idxRef);
        }
      }
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */
    try {
      const html = await env.engine.parseAndRender(liquidSrc, { ...ctxBase, section: buildSectionObj(id, secClone) });
      body += `<div class="shopify-section">${html}</div>\n`;
      if (sec.type !== "wave") contentCount++; // Wellen zählen nicht als „Section"
    } catch {
      /* einzelne Section überspringen statt alles zu brechen */
    }
    if (limit > 0 && contentCount >= limit) break; // Vorschau: nur die ersten N
  }

  const fontLink = `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${fontMeta.param}&display=swap">`;
  const resetCss = `<style>html{scroll-behavior:auto}img{max-width:100%;height:auto}a{cursor:default}.shopify-section{position:relative}</style>`;
  // Minimaler Shopify-JS-Stub, damit das eingebettete Theme-JS nicht crasht.
  const shopifyStub = `<script>window.Shopify=window.Shopify||{};Shopify.designMode=false;Shopify.routes=Shopify.routes||{root:'/'};Shopify.locale='de';Shopify.currency={active:'EUR',rate:'1.0'};Shopify.country='DE';Shopify.shop='preview.myshopify.com';window.ShopifyAnalytics=window.ShopifyAnalytics||{lib:{track:function(){},page:function(){}}};</script>`;

  // Bindet die Theme-JS-Assets inline ein (Custom-Elements brauchen sie). Externe
  // (https) bzw. nicht vorhandene Skripte werden verworfen.
  const inlineScripts = (html: string) =>
    html.replace(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (_m, src: string) => {
      const nm = String(src).replace(/^.*\//, "").replace(/\?.*$/, "");
      if (!/\.js$/i.test(nm) || /^https?:/i.test(src)) return "";
      const js = readEntry(env.zip, `assets/${nm}`);
      return js ? `<script>\n${js}\n</script>` : "";
    });

  // DAS GANZE theme.liquid rendern → Head 1:1 (beide Style-Blöcke, base.css,
  // alle CSS-Variablen) + Body-Wrapper. header-/footer-group werden über das
  // section/sections-Stub übersprungen.
  try {
    let doc = String(await env.engine.parseAndRender(env.themeLiquid, { ...ctxBase, content_for_layout: body }));
    doc = inlineScripts(doc);
    doc = doc.replace(/<head([^>]*)>/i, `<head$1>${fontLink}${resetCss}${shopifyStub}`);
    return doc;
  } catch (err) {
    console.error("[theme-render] theme.liquid render failed, fallback:", err);
    // Fallback: nur Style-Block + base.css + Sections.
    let headStyle = "";
    try {
      headStyle = String(await env.engine.parseAndRender(env.styleBlock, ctxBase));
    } catch {
      /* ignore */
    }
    return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${fontLink}${headStyle}<style>${env.baseCss}</style>${resetCss}
</head><body class="gradient color-scheme-1"><main id="MainContent">${body}</main></body></html>`;
  }
}
