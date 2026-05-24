import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/session";
import {
  getAllProdukte,
  type ProduktAds,
  type ProduktDropshippingExample,
  type ProduktDeepStats,
  type ProduktAudience,
  type ProduktAdStrategy,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";
// Pipeline runs ~40-100s (gruendlich kann mehr werden); Vercel clamped
// das ohnehin auf das Plan-Limit. Wir setzen großzügig.
export const maxDuration = 240;

// ─── Constants ───────────────────────────────────────────────────
const MODEL = "claude-sonnet-4-6";
const TAVILY_URL = "https://api.tavily.com/search";

// ─── Depth presets ───────────────────────────────────────────────
// Beide Modi sind eine feste Pipeline (kein Agent-Loop) — daher
// vorhersagbares Timing. "schnell" bleibt unter dem Vercel-Hobby-
// Cap, "gruendlich" darf länger laufen und macht mehr Ad-Suchen.
type Depth = "schnell" | "gruendlich";

interface DepthConfig {
  tavilyDepth: "basic" | "advanced";
  trendQueries: number;
  maxResults: number;
  /** Wie viele Ad-Plattformen wir parallel anpingen. 4 = TT/IG/FB/YT. */
  adPlatforms: number;
}

const DEPTH: Record<Depth, DepthConfig> = {
  schnell: { tavilyDepth: "basic", trendQueries: 3, maxResults: 6, adPlatforms: 4 },
  gruendlich: { tavilyDepth: "advanced", trendQueries: 4, maxResults: 8, adPlatforms: 4 },
};

// ─── Helpers ─────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function num(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}
function score(v: unknown): number {
  return Math.max(0, Math.min(100, Math.round(num(v))));
}

function aliSearchUrl(query: string): string {
  return `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(query)}`;
}

/**
 * Filter to clean, deduplicated product image URLs.
 *
 * Sehr permissiv: wir wollen LIEBER ein nicht-exakt-passendes Bild
 * zeigen als gar keins. Wir filtern nur eindeutigen Müll raus
 * (Logos, Tracking-Pixel, Mini-Thumbs, bekannte Nicht-Bild-Endungen).
 */
function cleanImages(urls: unknown[]): string[] {
  const NON_IMAGE_EXT = /\.(html?|php|aspx?|jsp|js|mjs|css|json|xml|pdf|svg)(?:\?|$|#)/i;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const u = typeof raw === "string" ? raw.trim() : "";
    if (!/^https?:\/\/\S{8,}/i.test(u)) continue;
    if (/(logo|sprite|favicon|avatar|pixel|tracker|tracking|placeholder|advert)/i.test(u))
      continue;
    if (/_(us|ss|sx|sy)\d{1,2}_/i.test(u)) continue;
    if (NON_IMAGE_EXT.test(u)) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= 12) break;
  }
  return out;
}

/**
 * Last-resort image fallback: a stable Unsplash-keyword URL.
 * Wenn alle Tavily-Quellen versagen, liefert das wenigstens EIN
 * thematisch passendes Bild statt einer leeren Slideshow.
 */
function placeholderImageFor(query: string): string {
  const q = encodeURIComponent((query || "product").trim().slice(0, 60));
  return `https://source.unsplash.com/800x600/?${q}`;
}

/** Extract a JSON object from a model text response. */
function parseJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  let body = text.trim();
  const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) body = fence[1].trim();
  else {
    const brace = body.match(/\{[\s\S]*\}/);
    if (brace) body = brace[0];
  }
  try {
    const obj = JSON.parse(body);
    return obj && typeof obj === "object" && !Array.isArray(obj)
      ? (obj as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

// ─── Tavily search ───────────────────────────────────────────────

interface TavilyResult {
  title: string;
  url: string;
  content: string;
}
interface TavilyResponse {
  answer: string;
  results: TavilyResult[];
  images: string[];
}

async function tavilySearch(
  apiKey: string,
  query: string,
  depth: "basic" | "advanced",
  maxResults: number,
  includeImages: boolean,
  includeDomains: string[] = [],
): Promise<TavilyResponse> {
  const res = await fetch(TAVILY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      query,
      search_depth: depth,
      max_results: maxResults,
      include_answer: true,
      include_images: includeImages,
      ...(includeDomains.length ? { include_domains: includeDomains } : {}),
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const d: any = await res.json();
  const results: TavilyResult[] = Array.isArray(d.results)
    ? d.results.map((r: any) => ({ title: str(r.title), url: str(r.url), content: str(r.content) }))
    : [];
  const topImages: unknown[] = Array.isArray(d.images) ? d.images : [];
  const resultImages: unknown[] = Array.isArray(d.results)
    ? d.results.flatMap((r: any) => (Array.isArray(r.images) ? r.images : []))
    : [];
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return {
    answer: str(d.answer),
    results,
    images: [...topImages, ...resultImages].filter((u): u is string => typeof u === "string"),
  };
}

/** First real AliExpress product-page URL among search results, if any. */
function findAliExpressUrl(results: TavilyResult[]): string {
  for (const r of results) {
    if (/aliexpress\.[a-z.]+\/item\/\d/i.test(r.url)) return r.url;
  }
  return "";
}

/**
 * Fetch a specific URL via Tavily's /extract endpoint — returns the
 * cleaned page text and the images found on the page.
 */
async function tavilyExtract(
  apiKey: string,
  url: string,
): Promise<{ content: string; images: string[] }> {
  const res = await fetch("https://api.tavily.com/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ urls: [url], include_images: true, extract_depth: "advanced" }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Tavily extract ${res.status}`);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const d: any = await res.json();
  const r = Array.isArray(d.results) ? d.results[0] : null;
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return {
    content: typeof r?.raw_content === "string" ? r.raw_content : "",
    images: Array.isArray(r?.images)
      ? r.images.filter((u: unknown): u is string => typeof u === "string")
      : [],
  };
}

// ─── Ad-Plattform-Suche ──────────────────────────────────────────
//
// Statt 4 separate Site-Filter zu jagen (die Tavily für TikTok/Instagram
// gerne mal mit 0 Treffern beantwortet), nutzen wir pro Plattform eine
// gezielte Query mit `include_domains`. Aus den Treffern picken wir die
// URLs heraus, die wirklich auf einem Video/Ad-Pfad der Plattform
// liegen — sonst landet schnell die Hilfe-Seite oder ein About-Link
// drin.

interface AdPlatform {
  key: keyof ProduktAds;
  /** Domain für Tavily include_domains. */
  domain: string;
  /** Query-Suffix für Tavily. */
  query: string;
  /** Filtert raus, ob ein Ergebnis-URL "echtes" Content auf der Plattform ist. */
  isContentUrl: (url: string) => boolean;
}

const AD_PLATFORMS: AdPlatform[] = [
  {
    key: "tiktok",
    domain: "tiktok.com",
    query: "viral video",
    isContentUrl: (u) => /tiktok\.com\/.+\/video\/\d|tiktok\.com\/t\//i.test(u),
  },
  {
    key: "instagram",
    domain: "instagram.com",
    query: "reel viral",
    isContentUrl: (u) => /instagram\.com\/(reel|reels|p|tv)\//i.test(u),
  },
  {
    key: "facebook",
    domain: "facebook.com",
    query: "ad video",
    isContentUrl: (u) =>
      /facebook\.com\/.+\/videos\/|facebook\.com\/watch|facebook\.com\/reel/i.test(u),
  },
  {
    key: "youtube",
    domain: "youtube.com",
    query: "review",
    isContentUrl: (u) => /youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\//i.test(u),
  },
];

async function searchAdsForPlatform(
  apiKey: string,
  platform: AdPlatform,
  productQuery: string,
): Promise<string[]> {
  try {
    const resp = await tavilySearch(
      apiKey,
      `${productQuery} ${platform.query}`,
      "basic",
      8,
      false,
      [platform.domain],
    );
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of resp.results) {
      const u = r.url;
      if (!u || seen.has(u)) continue;
      if (!platform.isContentUrl(u)) continue;
      seen.add(u);
      out.push(u);
      if (out.length >= 3) break;
    }
    return out;
  } catch (e) {
    console.warn(`[Discover] ad search failed for ${platform.key}:`, e);
    return [];
  }
}

/**
 * Suche nach einem realen Dropshipping-Shop, der das Produkt verkauft.
 * Wir scannen die Treffer auf typische Shop-Indizien: myshopify.com,
 * /products/ Pfad, /collections/, /shop/ Pfad — und sortieren
 * Marktplätze (Amazon/eBay/AliExpress) explizit raus.
 */
async function findDropshippingExample(
  apiKey: string,
  productQuery: string,
): Promise<ProduktDropshippingExample | undefined> {
  const MARKETPLACE_PATTERN =
    /(amazon\.|ebay\.|aliexpress\.|temu\.|wish\.|alibaba\.|walmart\.|etsy\.|target\.|costco\.|wayfair\.)/i;
  const SHOP_HINT =
    /(myshopify\.com|\/products\/|\/collections\/|\/shop\/|shopify-cdn|shopify-static)/i;

  // Zwei Queries parallel: einmal generisch "shop", einmal mit
  // typischen Shopify-Markern, damit wir auch Eigendomain-Shops finden
  // (viele Dropshipper haben eine eigene .com hinter Shopify).
  let results: TavilyResult[] = [];
  try {
    const settled = await Promise.allSettled([
      tavilySearch(apiKey, `${productQuery} buy shop online`, "basic", 10, false),
      tavilySearch(apiKey, `${productQuery} "add to cart" shop`, "basic", 8, false),
    ]);
    for (const s of settled) {
      if (s.status === "fulfilled") results.push(...s.value.results);
    }
  } catch (e) {
    console.warn("[Discover] dropshipping example search failed:", e);
  }
  results = results.filter((r) => r.url);

  for (const r of results) {
    if (MARKETPLACE_PATTERN.test(r.url)) continue;
    if (!SHOP_HINT.test(r.url)) continue;
    return { url: r.url, title: r.title || "" };
  }
  // Fallback: nimm den ersten nicht-marktplatz Treffer, falls da war.
  for (const r of results) {
    if (MARKETPLACE_PATTERN.test(r.url)) continue;
    return { url: r.url, title: r.title || "" };
  }
  return undefined;
}

// ─── Output schemas ──────────────────────────────────────────────

const PICK_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    produktName: { type: "string" },
    imageQuery: { type: "string" },
  },
  required: ["produktName", "imageQuery"],
  additionalProperties: false,
};

// SCHLANKES Core-Schema — nur die Felder die ABSOLUT da sein muessen
// damit ein Produkt anlegbar ist. Wenn Claude hier nicht liefert, geht
// das ganze Produkt zurueck als 502.
//
// Die Deep-Analytics-Felder (deepStats/audience/adStrategy) wurden hier
// rausgenommen weil sie als required-Pflicht Claude oft dazu brachten,
// JSON zu produzieren das schiefging — und dann blieben Titel/Preis
// kaputt. Sie laufen jetzt in einem getrennten optionalen Schritt.
const PRODUCT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    titel: { type: "string" },
    beschreibung: { type: "string" },
    kategorie: { type: "string" },
    finances: {
      type: "object",
      properties: {
        buyPrice: { type: "number" },
        recommendedSellPrice: { type: "number" },
      },
      required: ["buyPrice", "recommendedSellPrice"],
      additionalProperties: false,
    },
    stats: {
      type: "object",
      properties: {
        trendScore: { type: "integer" },
        viralScore: { type: "integer" },
        impulseBuyFactor: { type: "integer" },
        problemSolverIndex: { type: "integer" },
        marketSaturation: { type: "integer" },
      },
      required: ["trendScore", "viralScore", "impulseBuyFactor", "problemSolverIndex", "marketSaturation"],
      additionalProperties: false,
    },
    viralEvidence: { type: "string" },
  },
  required: ["titel", "beschreibung", "kategorie", "finances", "stats", "viralEvidence"],
  additionalProperties: false,
};

// Optional zweiter Claude-Call NUR fuer die Deep-Analytics. Bricht es,
// macht nichts — Produkt ist trotzdem komplett speicherbar.
const ANALYTICS_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    deepStats: {
      type: "object",
      properties: {
        competition: { type: "integer" },
        seasonality: { type: "integer" },
        peakMonths: { type: "array", items: { type: "integer" } },
        growth90d: { type: "integer" },
        repeatPurchaseRate: { type: "integer" },
      },
      required: ["competition", "seasonality", "peakMonths", "growth90d", "repeatPurchaseRate"],
      additionalProperties: false,
    },
    audience: {
      type: "object",
      properties: {
        primary: { type: "string" },
        ageRange: { type: "string" },
        genderSkew: { type: "string", enum: ["male", "female", "balanced"] },
        interests: { type: "array", items: { type: "string" } },
        painPoint: { type: "string" },
      },
      required: ["primary", "ageRange", "genderSkew", "interests", "painPoint"],
      additionalProperties: false,
    },
    adStrategy: {
      type: "object",
      properties: {
        dailyMinEur: { type: "number" },
        dailyRecommendedEur: { type: "number" },
        estimatedCpmEur: { type: "number" },
        bestFormat: { type: "string" },
        adHooks: { type: "array", items: { type: "string" } },
        testDurationDays: { type: "integer" },
      },
      required: ["dailyMinEur", "dailyRecommendedEur", "estimatedCpmEur", "bestFormat", "adHooks", "testDurationDays"],
      additionalProperties: false,
    },
  },
  required: ["deepStats", "audience", "adStrategy"],
  additionalProperties: false,
};

// ─── Claude (synthesis only — no tools) ──────────────────────────

async function claudeJson(
  client: Anthropic,
  system: string,
  user: string,
  maxTokens: number,
  schema: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: "disabled" },
    output_config: { format: { type: "json_schema", schema } },
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return parseJson(text);
}

/** Compact a list of Tavily results into prompt context. */
function resultsToContext(label: string, r: TavilyResponse): string {
  const lines = r.results
    .slice(0, 8)
    .map((x, i) => `[${i + 1}] ${x.title}\n${x.content}`.slice(0, 700));
  return `${label}\nZusammenfassung: ${r.answer}\n\n${lines.join("\n\n")}`;
}

/**
 * Light-weight HEAD/GET check: gibt der Server überhaupt eine
 * brauchbare Antwort zurück? Verwenden wir auch für aliExpressOk
 * unten + (gleicher Code-Pfad) im Linkcheck-Cron, damit beide
 * dieselbe Definition von "reachable" haben.
 */
async function isUrlReachable(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
    return r.status < 500;
  } catch {
    return false;
  }
}

// ─── Route ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!anthropicKey || !tavilyKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY oder TAVILY_API_KEY ist nicht konfiguriert." },
      { status: 500 },
    );
  }

  let depth: Depth = "schnell";
  let kategorie = "";
  try {
    const body = await req.json();
    if (body?.depth === "gruendlich") depth = "gruendlich";
    if (typeof body?.kategorie === "string") kategorie = body.kategorie.trim().slice(0, 60);
  } catch {
    // no body — keep the defaults
  }
  const cfg = DEPTH[depth];

  try {
    // Existing catalog titles → exclusion list.
    let existingTitles: string[] = [];
    try {
      const all = await getAllProdukte();
      existingTitles = all.map((p) => p.titel).filter(Boolean).slice(-40);
    } catch (e) {
      console.error("[Discover] could not load existing products:", e);
    }

    const client = new Anthropic({ apiKey: anthropicKey });
    const monthYear = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

    // ─── Phase A — trend discovery ───────────────────────────────
    const kat = kategorie ? ` ${kategorie}` : "";
    const trendQueries = [
      `Facebook Meta Ad Library winning${kat} dropshipping products ${monthYear}`,
      `viral trending${kat} dropshipping products ${monthYear} TikTok`,
      `TikTok made me buy it best selling${kat} product ${monthYear}`,
      `winning${kat} dropshipping products to sell ${monthYear}`,
    ].slice(0, cfg.trendQueries);

    const settled = await Promise.allSettled(
      trendQueries.map((q) => tavilySearch(tavilyKey, q, cfg.tavilyDepth, cfg.maxResults, false)),
    );
    const trendResults = settled
      .filter((s): s is PromiseFulfilledResult<TavilyResponse> => s.status === "fulfilled")
      .map((s) => s.value);
    if (trendResults.length === 0) {
      return NextResponse.json(
        { error: "Trend-Suche fehlgeschlagen. Versuche es erneut." },
        { status: 502 },
      );
    }

    // ─── Claude 1 — pick one viral product ───────────────────────
    const trendContext = trendResults
      .map((r, i) => resultsToContext(`SUCHE ${i + 1}:`, r))
      .join("\n\n──────\n\n");
    const exclude = existingTitles.length
      ? `\n\nDiese Produkte sind bereits im Katalog — wähle ein ANDERES:\n${existingTitles.map((t) => `- ${t}`).join("\n")}`
      : "";
    const katNote = kategorie
      ? `\n\nWICHTIG: Das gewählte Produkt MUSS klar in die Kategorie "${kategorie}" passen.`
      : "";

    const pick = await claudeJson(
      client,
      `Du bist ein Dropshipping-Experte. Du erhältst aktuelle Web-Suchergebnisse (u.a. aus der Meta/Facebook Ad Library und von TikTok) zu viralen US-Dropshipping-Trends. Wähle daraus EIN konkretes, gerade besonders virales Produkt (kein generischer Evergreen). Antworte NUR mit JSON, ohne weiteren Text:
{"produktName": "kurzer Produktname auf Deutsch", "imageQuery": "english product name for a shopping/image search, 3-6 words"}`,
      `Heutiger Monat: ${monthYear}.${katNote}\n\n${trendContext}${exclude}`,
      600,
      PICK_SCHEMA,
    );
    const produktName = str(pick?.produktName);
    const imageQuery = str(pick?.imageQuery) || produktName;
    if (!produktName) {
      console.error("[Discover] product pick failed");
      return NextResponse.json(
        { error: "Kein Produkt gefunden. Versuche es erneut." },
        { status: 502 },
      );
    }

    // ─── Phase B — Detail, AliExpress, Ads, Dropshipping (parallel) ──
    // Sechs Tavily-Calls parallel. Wenn einer scheitert, fallen wir
    // weich zurück (leere Listen) statt die ganze Pipeline abzubrechen.
    const adPlatforms = AD_PLATFORMS.slice(0, cfg.adPlatforms);

    const [
      detailRes,
      aliRes,
      imageRes,
      dropExampleResult,
      ...adResults
    ] = await Promise.allSettled([
      tavilySearch(tavilyKey, `${imageQuery} buy price`, cfg.tavilyDepth, cfg.maxResults + 2, true),
      tavilySearch(tavilyKey, imageQuery, "basic", 10, false, ["aliexpress.com"]),
      // Dedizierte Bild-Suche: viel breiter, damit wir auch dann Bilder
      // haben, wenn die AliExpress-Extract-Bilder im Browser blocken
      // (Referer-Header / Hotlink-Sperre).
      tavilySearch(tavilyKey, `${imageQuery} product photo`, "basic", 10, true),
      findDropshippingExample(tavilyKey, imageQuery),
      ...adPlatforms.map((p) => searchAdsForPlatform(tavilyKey, p, imageQuery)),
    ]);

    const detail: TavilyResponse =
      detailRes.status === "fulfilled"
        ? detailRes.value
        : { answer: "", results: [], images: [] };
    if (detailRes.status === "rejected") {
      console.error("[Discover] detail search failed:", detailRes.reason);
    }
    const aliResults: TavilyResult[] =
      aliRes.status === "fulfilled" ? aliRes.value.results : [];
    const imageSearchImages: string[] =
      imageRes.status === "fulfilled" ? imageRes.value.images : [];
    const dropExample: ProduktDropshippingExample | undefined =
      dropExampleResult.status === "fulfilled" ? dropExampleResult.value : undefined;

    // Ads zurück zu ihrer Plattform mappen
    const ads: ProduktAds = {};
    adPlatforms.forEach((platform, i) => {
      const r = adResults[i];
      const urls = r && r.status === "fulfilled" ? r.value : [];
      if (urls.length > 0) ads[platform.key] = urls;
    });

    // ─── Links: AliExpress Produkt + Kategorie ───────────────────
    const aliExpressProduct =
      findAliExpressUrl([...aliResults, ...detail.results]) ||
      aliSearchUrl(imageQuery || produktName);
    // Kategorie-Link nimmt entweder den Admin-Wert oder den
    // Produktnamen — auf jeden Fall ein /wholesale-Sucheinstieg.
    const aliExpressCategory = aliSearchUrl(kategorie || imageQuery || produktName);

    // ─── Bilder: extract AliExpress-Produktseite + alles mixen ──
    let aliExtractedContent = "";
    let aliExtractedImages: string[] = [];
    if (/aliexpress\.[a-z.]+\/item\/\d/i.test(aliExpressProduct)) {
      try {
        const ext = await tavilyExtract(tavilyKey, aliExpressProduct);
        aliExtractedContent = ext.content;
        aliExtractedImages = ext.images;
      } catch (e) {
        console.error("[Discover] aliexpress extract failed:", e);
      }
    }
    // Reihenfolge: erst die produkt-spezifischen AliExpress-Bilder
    // (passen am genauesten), dann generische Shop/Image-Suche, dann
    // Trefferbilder aus der Detail-Suche. cleanImages dedupliziert.
    let images = cleanImages([
      ...aliExtractedImages,
      ...imageSearchImages,
      ...detail.images,
    ]);
    // GARANTIE: nie eine leere Bilderliste — sonst sieht der User
    // "Kein Bild verfügbar". Ein thematisches Unsplash-Bild ist
    // besser als nichts.
    if (images.length === 0) {
      console.warn("[Discover] no images from Tavily — using Unsplash fallback");
      images = [placeholderImageFor(imageQuery || produktName)];
    }

    // ─── Claude 2 — CORE-Synthese (Titel/Preis/Beschreibung/Stats) ──
    // Schlank gehalten: nur die Pflichtfelder. Wenn das hier schiefgeht
    // bricht alles ab — also wollen wir nichts riskieren mit zu vielen
    // required-Feldern.
    const parsed = await claudeJson(
      client,
      `Du bist ein E-Commerce-Experte für den deutschen Markt. Erstelle aus den gegebenen Web-Rechercheergebnissen einen fertigen, verkaufsstarken Charts-Eintrag.

SPRACHE: Titel und Beschreibung auf DEUTSCH. Beschreibung als sauberes, verkaufsstarkes HTML — nutze <p> für Absätze, <ul><li> für Aufzählungen und <strong> für Hervorhebungen. Kein übertriebener Emoji-Einsatz.
KATEGORIE: ${kategorie ? `Verwende exakt "${kategorie}".` : "Wähle eine kurze, treffende Produktkategorie (z. B. Beauty, Haushalt, Sport, Haustier, Küche, Gadgets)."}
PREISE: Falls eine ALIEXPRESS-PRODUKTSEITE im Kontext gegeben ist, übernimm den dort gelisteten Preis EXAKT als buyPrice (rechne USD bei Bedarf grob mit Faktor 0.93 in EUR um). Sonst schätze realistisch. Verkaufspreis = marktüblicher Dropshipping-Preis in EUR. WICHTIG: Beide Preise sind nur Richtwerte — der Hub zeigt dem Nutzer einen "Preis kann schwanken"-Hinweis.
SCORES (0-100): trendScore = aktuelle Trendstärke, viralScore = Social-Media-Viralität, impulseBuyFactor = Impulskauf-Eignung, problemSolverIndex = wie stark es ein Problem löst, marketSaturation = Marktsättigung (höher = gesättigter).
VIRALITÄT: stütze dich ehrlich auf die gegebenen Quellen (TikTok, Meta/Facebook Ad Library, Trend-Plattformen).

Antworte NUR mit JSON, ohne weiteren Text:
{
  "titel": "verkaufsstarker deutscher Titel, max 70 Zeichen",
  "beschreibung": "<p>HTML-Beschreibung mit <ul><li>Vorteilen</li></ul></p>",
  "kategorie": "kurze Produktkategorie",
  "finances": { "buyPrice": 0.0, "recommendedSellPrice": 0.0 },
  "stats": { "trendScore": 0, "viralScore": 0, "impulseBuyFactor": 0, "problemSolverIndex": 0, "marketSaturation": 0 },
  "viralEvidence": "2-4 Sätze: warum dieses Produkt gerade viral ist, mit konkreten Signalen aus den Quellen."
}`,
      `Produkt: ${produktName}\nMonat: ${monthYear}\n\n${trendContext}\n\n──────\n\n${resultsToContext("PRODUKT-DETAILSUCHE:", detail)}${aliExtractedContent ? `\n\n──────\n\nALIEXPRESS-PRODUKTSEITE (für exakten Preis):\n${aliExtractedContent.slice(0, 3500)}` : ""}`,
      4000,
      PRODUCT_SCHEMA,
    );

    if (!parsed || !str(parsed.titel)) {
      console.error("[Discover] synthesis failed");
      return NextResponse.json(
        { error: "Die KI-Antwort konnte nicht verarbeitet werden. Versuche es erneut." },
        { status: 502 },
      );
    }

    // ─── Normalize ───────────────────────────────────────────────
    const titel = str(parsed.titel);
    const sku = kategorie || str(parsed.kategorie);

    const fin = (parsed.finances ?? {}) as Record<string, unknown>;
    const buyPrice = Math.round(num(fin.buyPrice) * 100) / 100;
    const recommendedSellPrice = Math.round(num(fin.recommendedSellPrice) * 100) / 100;
    const profitMargin = Math.round((recommendedSellPrice - buyPrice) * 100) / 100;

    const st = (parsed.stats ?? {}) as Record<string, unknown>;
    const stats = {
      trendScore: score(st.trendScore),
      viralScore: score(st.viralScore),
      impulseBuyFactor: score(st.impulseBuyFactor),
      problemSolverIndex: score(st.problemSolverIndex),
      marketSaturation: score(st.marketSaturation),
    };

    // ─── Claude 3 — OPTIONALE Deep-Analytics (separater Call) ──
    // Schlaegt das hier fehl, ist es egal — wir geben einfach leere
    // Defaults zurueck und das Produkt ist trotzdem komplett.
    let analytics: Record<string, unknown> | null = null;
    try {
      analytics = await claudeJson(
        client,
        `Du bist E-Commerce-Stratege. Liefere fuer das gegebene Produkt eine kurze Audience- und Ad-Strategie.

DEEP STATS:
- competition (0-100): Konkurrenz im deutschen Markt (100 = stark umkaempft)
- seasonality (0-100): 0 = Evergreen, 100 = stark saisonal
- peakMonths: Monatsnummern 1-12 wo Nachfrage Peak hat ([] wenn ganzjaehrig)
- growth90d (-100..500): geschaetztes Nachfrage-Wachstum 90 Tage in Prozent
- repeatPurchaseRate (0-100): Wiederkauf-Wahrscheinlichkeit

AUDIENCE:
- primary: knapp die Hauptzielgruppe
- ageRange: "18-34", "25-54" etc.
- genderSkew: "male" | "female" | "balanced"
- interests: 3-5 Targeting-Interessen
- painPoint: 1 Satz Problem das das Produkt loest

AD STRATEGY:
- dailyMinEur: Mindest-Tagesbudget zum Validieren (10-50)
- dailyRecommendedEur: empfohlenes Tagesbudget (50-300)
- estimatedCpmEur: typischer CPM (5-25)
- bestFormat: konkrete Format-Empfehlung in einem Satz
- adHooks: 3 konkrete deutsche Hookline-Beispiele
- testDurationDays: empfohlene Testdauer (3-14)

Antworte NUR mit JSON:
{
  "deepStats": { "competition": 0, "seasonality": 0, "peakMonths": [], "growth90d": 0, "repeatPurchaseRate": 0 },
  "audience": { "primary": "", "ageRange": "", "genderSkew": "balanced", "interests": [], "painPoint": "" },
  "adStrategy": { "dailyMinEur": 0, "dailyRecommendedEur": 0, "estimatedCpmEur": 0, "bestFormat": "", "adHooks": [], "testDurationDays": 0 }
}`,
        `Produkt: ${str(parsed.titel)}\nKategorie: ${kategorie || str(parsed.kategorie)}\nBeschreibung: ${str(parsed.beschreibung).slice(0, 800)}`,
        2500,
        ANALYTICS_SCHEMA,
      );
    } catch (e) {
      console.warn("[Discover] analytics call failed (optional):", e);
    }

    // ─── Deep Analytics normalisieren ────────────────────────────
    // Source: analytics-call ODER parsed (falls jemand das doch noch
    // im Core schickt). Fallback: leere Defaults.
    const analyticsObj = (analytics || parsed) as Record<string, unknown>;
    const ds = (analyticsObj.deepStats ?? {}) as Record<string, unknown>;
    const peakRaw = Array.isArray(ds.peakMonths) ? ds.peakMonths : [];
    const deepStats: ProduktDeepStats = {
      competition: score(ds.competition),
      seasonality: score(ds.seasonality),
      peakMonths: peakRaw
        .map((m) => Math.round(num(m)))
        .filter((m) => m >= 1 && m <= 12),
      growth90d: Math.max(-100, Math.min(500, Math.round(num(ds.growth90d)))),
      repeatPurchaseRate: score(ds.repeatPurchaseRate),
    };

    const au = (analyticsObj.audience ?? {}) as Record<string, unknown>;
    const genderRaw = str(au.genderSkew).toLowerCase();
    const audience: ProduktAudience = {
      primary: str(au.primary),
      ageRange: str(au.ageRange),
      genderSkew:
        genderRaw === "male" || genderRaw === "female" ? genderRaw : "balanced",
      interests: Array.isArray(au.interests)
        ? au.interests.map((x) => str(x)).filter(Boolean).slice(0, 5)
        : [],
      painPoint: str(au.painPoint),
    };

    const ad = (analyticsObj.adStrategy ?? {}) as Record<string, unknown>;
    const adStrategy: ProduktAdStrategy = {
      dailyMinEur: Math.max(0, Math.round(num(ad.dailyMinEur))),
      dailyRecommendedEur: Math.max(0, Math.round(num(ad.dailyRecommendedEur))),
      estimatedCpmEur: Math.round(num(ad.estimatedCpmEur) * 100) / 100,
      bestFormat: str(ad.bestFormat),
      adHooks: Array.isArray(ad.adHooks)
        ? ad.adHooks.map((x) => str(x)).filter(Boolean).slice(0, 3)
        : [],
      testDurationDays: Math.max(
        1,
        Math.min(60, Math.round(num(ad.testDurationDays))),
      ),
    };

    // Initial-Linkcheck — beide Ali-Links + Dropshipping-Beispiel.
    // Wir prüfen sofort, damit der Admin im Edit-Modal sieht, was
    // erreichbar ist und was nicht. Der Cron läuft dann täglich.
    const [aliProductOk, aliCategoryOk, dropOk] = await Promise.all([
      isUrlReachable(aliExpressProduct),
      isUrlReachable(aliExpressCategory),
      dropExample ? isUrlReachable(dropExample.url) : Promise.resolve(false),
    ]);

    const linkStatus = {
      aliExpressProductOk: aliProductOk,
      aliExpressCategoryOk: aliCategoryOk,
      dropshippingExampleOk: dropExample ? dropOk : undefined,
      lastCheckedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      produkt: {
        titel,
        beschreibung: str(parsed.beschreibung),
        sku,
        // Kompatibilität: weiterhin das Produkt-URL als Top-Level-Link
        // ablegen, damit alte Importer das findet.
        aliExpressLink: aliExpressProduct,
        images,
        stats,
        finances: { buyPrice, recommendedSellPrice, profitMargin },
        // Neue, strukturierte Felder. Charts-View + Admin-View lesen
        // primär aus `links`/`ads`/`linkStatus`.
        links: {
          aliExpressProduct,
          aliExpressCategory,
          dropshippingExample: dropExample,
        },
        ads,
        linkStatus,
        // Deep Analytics — Wettbewerb, Saison, Zielgruppe, Ad-Strategie.
        deepStats,
        audience,
        adStrategy,
      },
      viralEvidence: str(parsed.viralEvidence),
      // Backwards-Kompat: alte Felder unverändert mitgeben.
      aliExpressOk: aliProductOk,
      imageCount: images.length,
      adsCount: Object.values(ads).reduce(
        (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
        0,
      ),
    });
  } catch (error) {
    console.error("[Discover] error:", error);
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Anthropic API-Key ungültig. Prüfe ANTHROPIC_API_KEY." },
        { status: 500 },
      );
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Anthropic-Fehler (${error.status ?? "?"}). Versuche es in einem Moment erneut.` },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "KI-Produktsuche fehlgeschlagen. Versuche es erneut." },
      { status: 500 },
    );
  }
}
