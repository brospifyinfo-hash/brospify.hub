// ─── /api/admin/products/discover-from-url ───────────────────
// Admin gibt einen Link (Instagram-Reel, TikTok-Video, TikTok-Shop,
// Shopify-Produkt, AliExpress-Item, beliebige Produkt-URL) und die KI
// extrahiert daraus alle Produktdaten:
//
//   - Tavily-Extract auf die URL → Inhalt + Bilder
//   - Falls TikTok/IG-Video: Tavily-Such-Anfrage mit dem extrahierten
//     Caption/Title um das tatsaechliche Produkt zu finden
//   - Claude: synthesisiert Titel/Beschreibung/Preis/Stats wie die
//     normale Discover-Route — startet aber mit dem konkreten Hinweis
//     aus der URL statt mit einer Trend-Suche
//   - Optionaler Analytics-Pass (deepStats/audience/adStrategy)
//   - Multiple Dropshipping-Shops + Ads-Suche wie gewohnt
//
// Antwort hat die gleiche Form wie /discover — Admin-Frontend kann
// dieselbe Modal-Logik wiederverwenden.

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/session";
import {
  type ProduktAds,
  type ProduktDropshippingExample,
  type ProduktDeepStats,
  type ProduktAudience,
  type ProduktAdStrategy,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-6";
const TAVILY_URL = "https://api.tavily.com/search";
const TAVILY_EXTRACT_URL = "https://api.tavily.com/extract";

// ─── Helpers (kopiert aus discover/route.ts, bewusst dupliziert
// damit beide Endpoints unabhaengig deploybar bleiben) ─────────────

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

interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

async function tavilySearch(
  apiKey: string,
  query: string,
  depth: "basic" | "advanced",
  maxResults: number,
  includeImages: boolean,
  includeDomains: string[] = [],
): Promise<{ answer: string; results: TavilyResult[]; images: string[] }> {
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

async function tavilyExtract(
  apiKey: string,
  url: string,
): Promise<{ content: string; images: string[]; title?: string }> {
  const res = await fetch(TAVILY_EXTRACT_URL, {
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

function placeholderImageFor(query: string): string {
  const q = encodeURIComponent((query || "product").trim().slice(0, 60));
  return `https://source.unsplash.com/800x600/?${q}`;
}

// ─── URL-Typ-Erkennung ─────────────────────────────────────────

type UrlType = "tiktok-video" | "tiktok-shop" | "instagram-reel" | "instagram-post" | "shopify-product" | "aliexpress" | "amazon" | "youtube" | "other";

function detectUrlType(url: string): UrlType {
  const u = url.toLowerCase();
  if (/tiktok\.com\/.+\/video\//.test(u)) return "tiktok-video";
  if (/(tiktok\.com\/.*shop|shop\.tiktok\.com|vt\.tiktok\.com)/.test(u)) return "tiktok-shop";
  if (/instagram\.com\/(reel|reels)\//.test(u)) return "instagram-reel";
  if (/instagram\.com\/p\//.test(u)) return "instagram-post";
  if (/myshopify\.com|\/products\/[a-z0-9-]+/.test(u)) return "shopify-product";
  if (/aliexpress\.[a-z.]+\/item\//.test(u)) return "aliexpress";
  if (/amazon\.[a-z.]+\/.*\/dp\//.test(u)) return "amazon";
  if (/youtube\.com\/watch|youtu\.be\//.test(u)) return "youtube";
  return "other";
}

// ─── Output schemas (gleich wie /discover) ─────────────────────

const PRODUCT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    titel: { type: "string" },
    beschreibung: { type: "string" },
    kategorie: { type: "string" },
    imageQuery: { type: "string" },
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
  required: ["titel", "beschreibung", "kategorie", "imageQuery", "finances", "stats", "viralEvidence"],
  additionalProperties: false,
};

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

  let url = "";
  try {
    const body = await req.json();
    url = String(body?.url || "").trim();
  } catch {
    // no body
  }
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json(
      { error: "Bitte eine gueltige URL angeben (https://…)." },
      { status: 400 },
    );
  }

  const urlType = detectUrlType(url);
  console.log(`[discover-from-url] type=${urlType} url=${url}`);

  try {
    const client = new Anthropic({ apiKey: anthropicKey });
    const monthYear = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

    // ─── 1. URL extrahieren (Tavily) ──────────────────────────
    let extractContent = "";
    let extractImages: string[] = [];
    try {
      const ext = await tavilyExtract(tavilyKey, url);
      extractContent = ext.content;
      extractImages = ext.images;
    } catch (e) {
      console.warn("[discover-from-url] tavily extract failed:", e);
    }

    // ─── 2. Wenn Social-Video: zusaetzliche Suche nach dem Produkt
    let extraSearchContext = "";
    if (urlType === "tiktok-video" || urlType === "tiktok-shop" || urlType === "instagram-reel" || urlType === "instagram-post" || urlType === "youtube") {
      // Aus dem Extract die ersten Worte als Search-Hint nehmen
      const hint = extractContent.slice(0, 200);
      if (hint) {
        try {
          const search = await tavilySearch(
            tavilyKey,
            `${hint} product buy dropshipping`,
            "basic",
            6,
            true,
          );
          extraSearchContext = search.results
            .slice(0, 5)
            .map((r) => `- ${r.title}\n  ${r.url}\n  ${r.content.slice(0, 300)}`)
            .join("\n\n");
          extractImages = [...extractImages, ...search.images];
        } catch (e) {
          console.warn("[discover-from-url] supplemental search failed:", e);
        }
      }
    }

    // ─── 3. Bild-Suche zur Anreicherung (mehr Bildmaterial) ───
    // Wir warten mit dieser Suche bis nach Claude — sonst muessten wir
    // den imageQuery raten. Direkt jetzt nur Extract-Bilder verwenden.

    // ─── 4. Claude: Produktdaten extrahieren ──────────────────
    const parsed = await claudeJson(
      client,
      `Du bist ein E-Commerce-Experte. Der User hat eine URL geschickt, aus der du ein vollstaendiges Produkt extrahieren sollst.

URL-Typ: ${urlType}
URL: ${url}

REGELN:
- SPRACHE: Titel + Beschreibung auf DEUTSCH
- Beschreibung als sauberes HTML: <p>, <ul><li>, <strong>
- Wenn die URL ein konkretes Produkt zeigt (Shopify-Produkt, AliExpress, Amazon), extrahiere Titel + Preis direkt aus dem Inhalt
- Wenn die URL ein Social-Media-Video ist, identifiziere das beworbene Produkt aus Caption/Beschreibung und ergaenze aus der Web-Suche
- Wenn ein konkreter Preis im Content steht, nimm ihn als buyPrice; sonst schaetze konservativ
- Verkaufspreis: marktueblich fuer Dropshipping in EUR (typisch 3-5x Einkauf)
- Kategorie: WÄHLE EXAKT EINE aus dieser Liste (1:1 schreibweise, keine eigenen Erfindungen): Sport & Fitness, Beauty & Pflege, Haushalt & Ordnung, Küche & Kochen, Gadgets & Tech, Haustier, Kinder & Baby, Auto & Outdoor, Garten & Pflanzen, Mode & Accessoires, Wellness & Schlaf, Heim-Deko & Licht
- imageQuery: 3-6 englische Worte zum Nachfinden von Produktbildern in einer Bildersuche

Antworte NUR mit JSON:
{
  "titel": "deutscher Titel, max 70 Zeichen",
  "beschreibung": "<p>HTML</p>",
  "kategorie": "kurze Kategorie",
  "imageQuery": "english product image search 3-6 words",
  "finances": { "buyPrice": 0.0, "recommendedSellPrice": 0.0 },
  "stats": { "trendScore": 0, "viralScore": 0, "impulseBuyFactor": 0, "problemSolverIndex": 0, "marketSaturation": 0 },
  "viralEvidence": "2-3 Saetze warum das Produkt potenziell viral ist (basiert auf der URL)"
}`,
      `Monat: ${monthYear}\n\nURL-EXTRACT (Inhalt der gegebenen URL):\n${extractContent.slice(0, 4000) || "(kein Inhalt extrahierbar — vermutlich Login-Wall oder Bot-Schutz)"}\n\n${extraSearchContext ? `ZUSATZ-SUCHE (basierend auf URL-Inhalt):\n${extraSearchContext.slice(0, 3000)}` : ""}`,
      3500,
      PRODUCT_SCHEMA,
    );

    if (!parsed || !str(parsed.titel)) {
      return NextResponse.json(
        {
          error:
            "Aus dieser URL konnten keine Produktdaten extrahiert werden. Versuche eine andere URL (direkt zum Produkt) oder nutze die normale KI-Suche.",
        },
        { status: 502 },
      );
    }

    const titel = str(parsed.titel);
    const imageQuery = str(parsed.imageQuery) || titel;
    const sku = str(parsed.kategorie);

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

    // ─── 5. Bild-Anreicherung + Shop/Ads parallel ────────────
    const [imgSearch, dropExamplesRes, ...adsRes] = await Promise.allSettled([
      tavilySearch(tavilyKey, `${imageQuery} product photo`, "basic", 10, true),
      tavilySearch(tavilyKey, `${imageQuery} inurl:/products/`, "advanced", 10, false),
      tavilySearch(tavilyKey, `${imageQuery} tiktok video`, "basic", 6, false, ["tiktok.com"]),
      tavilySearch(tavilyKey, `${imageQuery} instagram reel`, "basic", 6, false, ["instagram.com"]),
      tavilySearch(tavilyKey, `${imageQuery} facebook ad`, "basic", 6, false, ["facebook.com"]),
      tavilySearch(tavilyKey, `${imageQuery} youtube review`, "basic", 6, false, ["youtube.com"]),
    ]);

    const imageSearchImages =
      imgSearch.status === "fulfilled" ? imgSearch.value.images : [];
    let images = cleanImages([...extractImages, ...imageSearchImages]);
    if (images.length === 0) images = [placeholderImageFor(imageQuery)];

    // Dropshipping-Shops aus den Search-Ergebnissen.
    const BANNED = /(amazon\.|ebay\.|aliexpress\.|temu\.|walmart\.|etsy\.|target\.|tiktok\.|instagram\.|facebook\.|youtube\.|reddit\.|pinterest\.|wikipedia\.|wirecutter\.|forbes\.|hearstapps\.|nytimes\.|thegoodtrade\.)/i;
    const STRONG_SHOP = /(myshopify\.com|\/products\/[a-z0-9-]{3,}|\/collections\/|shopify-cdn|shopify-static)/i;
    const dropShopResults = dropExamplesRes.status === "fulfilled" ? dropExamplesRes.value.results : [];
    const byDomain = new Map<string, ProduktDropshippingExample>();
    for (const r of dropShopResults) {
      if (!r.url || BANNED.test(r.url)) continue;
      if (!STRONG_SHOP.test(r.url)) continue;
      if (/(\d+ best|top \d+|review|guide)/i.test(r.title)) continue;
      const d = (() => { try { return new URL(r.url).hostname.replace(/^www\./, ""); } catch { return r.url; } })();
      if (byDomain.has(d)) continue;
      byDomain.set(d, { url: r.url, title: r.title || "" });
      if (byDomain.size >= 5) break;
    }
    const dropExamples = Array.from(byDomain.values());

    // Ads (TikTok/IG/FB/YT).
    const ads: ProduktAds = {};
    const adKeys: (keyof ProduktAds)[] = ["tiktok", "instagram", "facebook", "youtube"];
    const adFilters: Record<keyof ProduktAds, RegExp> = {
      tiktok: /tiktok\.com\/.+\/video\/\d|tiktok\.com\/t\//i,
      instagram: /instagram\.com\/(reel|reels|p|tv)\//i,
      facebook: /facebook\.com\/.+\/videos\/|facebook\.com\/watch|facebook\.com\/reel/i,
      youtube: /youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\//i,
    };
    adKeys.forEach((key, i) => {
      const r = adsRes[i];
      if (!r || r.status !== "fulfilled") return;
      const urls: string[] = [];
      const seen = new Set<string>();
      for (const res of r.value.results) {
        if (!res.url || seen.has(res.url)) continue;
        if (!adFilters[key].test(res.url)) continue;
        urls.push(res.url);
        seen.add(res.url);
        if (urls.length >= 3) break;
      }
      // Wenn die Original-URL zur passenden Plattform passt, auch
      // diese als erstes Beispiel mit aufnehmen.
      if (adFilters[key].test(url) && !seen.has(url)) {
        urls.unshift(url);
      }
      if (urls.length > 0) ads[key] = urls;
    });

    // ─── 6. AliExpress-Link: aus URL ableiten falls's eine ist,
    // sonst Such-Fallback.
    const aliExpressProduct = urlType === "aliexpress" ? url : aliSearchUrl(imageQuery);
    const aliExpressCategory = aliSearchUrl(imageQuery);

    // ─── 7. OPTIONALE Analytics (separater Claude-Call) ──────
    let analytics: Record<string, unknown> | null = null;
    try {
      analytics = await claudeJson(
        client,
        `Du bist E-Commerce-Stratege. Liefere zu dem gegebenen Produkt knappe Audience- und Ad-Strategie-Empfehlungen.

Antworte NUR mit JSON:
{
  "deepStats": { "competition": 0, "seasonality": 0, "peakMonths": [], "growth90d": 0, "repeatPurchaseRate": 0 },
  "audience": { "primary": "", "ageRange": "", "genderSkew": "balanced", "interests": [], "painPoint": "" },
  "adStrategy": { "dailyMinEur": 0, "dailyRecommendedEur": 0, "estimatedCpmEur": 0, "bestFormat": "", "adHooks": [], "testDurationDays": 0 }
}`,
        `Produkt: ${titel}\nKategorie: ${sku}\nBeschreibung: ${str(parsed.beschreibung).slice(0, 600)}`,
        2200,
        ANALYTICS_SCHEMA,
      );
    } catch (e) {
      console.warn("[discover-from-url] analytics call failed:", e);
    }

    const aObj = (analytics || {}) as Record<string, unknown>;
    const ds = (aObj.deepStats ?? {}) as Record<string, unknown>;
    const deepStats: ProduktDeepStats = {
      competition: score(ds.competition),
      seasonality: score(ds.seasonality),
      peakMonths: Array.isArray(ds.peakMonths)
        ? ds.peakMonths.map((m) => Math.round(num(m))).filter((m) => m >= 1 && m <= 12)
        : [],
      growth90d: Math.max(-100, Math.min(500, Math.round(num(ds.growth90d)))),
      repeatPurchaseRate: score(ds.repeatPurchaseRate),
    };
    const au = (aObj.audience ?? {}) as Record<string, unknown>;
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
    const adS = (aObj.adStrategy ?? {}) as Record<string, unknown>;
    const adStrategy: ProduktAdStrategy = {
      dailyMinEur: Math.max(0, Math.round(num(adS.dailyMinEur))),
      dailyRecommendedEur: Math.max(0, Math.round(num(adS.dailyRecommendedEur))),
      estimatedCpmEur: Math.round(num(adS.estimatedCpmEur) * 100) / 100,
      bestFormat: str(adS.bestFormat),
      adHooks: Array.isArray(adS.adHooks)
        ? adS.adHooks.map((x) => str(x)).filter(Boolean).slice(0, 3)
        : [],
      testDurationDays: Math.max(1, Math.min(60, Math.round(num(adS.testDurationDays)))),
    };

    return NextResponse.json({
      produkt: {
        titel,
        beschreibung: str(parsed.beschreibung),
        sku,
        aliExpressLink: aliExpressProduct,
        images,
        stats,
        finances: { buyPrice, recommendedSellPrice, profitMargin },
        links: {
          aliExpressProduct,
          aliExpressCategory,
          dropshippingExample: dropExamples[0],
          dropshippingExamples: dropExamples,
        },
        ads,
        deepStats,
        audience,
        adStrategy,
        sourceUrl: url,
      },
      viralEvidence: str(parsed.viralEvidence),
      imageCount: images.length,
      shopCount: dropExamples.length,
    });
  } catch (error) {
    console.error("[discover-from-url] error:", error);
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Anthropic-Fehler (${error.status ?? "?"}).` },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "URL-Discovery fehlgeschlagen." },
      { status: 500 },
    );
  }
}
