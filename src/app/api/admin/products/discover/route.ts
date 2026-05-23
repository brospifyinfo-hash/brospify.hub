import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/session";
import { getAllProdukte } from "@/lib/sheets";

export const dynamic = "force-dynamic";
// Pipeline runs ~30-70s; Vercel clamps this to the plan limit anyway.
export const maxDuration = 180;

// ─── Constants ───────────────────────────────────────────────────
const MODEL = "claude-sonnet-4-6";
const TAVILY_URL = "https://api.tavily.com/search";

// ─── Depth presets ───────────────────────────────────────────────
// Both modes are a fixed pipeline (no agent loop), so timing is
// predictable. "schnell" stays under Vercel's 60s Hobby cap.
type Depth = "schnell" | "gruendlich";

interface DepthConfig {
  tavilyDepth: "basic" | "advanced";
  trendQueries: number;
  maxResults: number;
}

const DEPTH: Record<Depth, DepthConfig> = {
  schnell: { tavilyDepth: "basic", trendQueries: 3, maxResults: 6 },
  gruendlich: { tavilyDepth: "advanced", trendQueries: 4, maxResults: 8 },
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

/** Filter to clean, deduplicated product image URLs (drop logos/icons). */
function cleanImages(urls: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const u = typeof raw === "string" ? raw.trim() : "";
    if (!/^https?:\/\/\S+$/i.test(u)) continue;
    if (!/\.(jpe?g|png|webp)(\?|$)/i.test(u)) continue; // real image files only
    if (/(logo|sprite|favicon|avatar|icon)/i.test(u)) continue;
    if (/_(us|ss|sx|sy)\d{1,2}_/i.test(u)) continue; // skip tiny thumbnails
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out.slice(0, 8);
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
 * cleaned page text and the images found on the page. Used to pull
 * the real product images + price off the linked AliExpress page.
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

// ─── Output schemas ──────────────────────────────────────────────
// Structured outputs constrain the model to valid JSON matching the
// schema — a stray quote in a description can no longer break parsing.

const PICK_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    produktName: { type: "string" },
    imageQuery: { type: "string" },
  },
  required: ["produktName", "imageQuery"],
  additionalProperties: false,
};

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

    // ─── Phase A — trend discovery (parallel Tavily searches) ────
    // The Meta Ad Library query is first so it is included even in
    // "schnell" mode. ${kat} narrows everything to the chosen category.
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

    // ─── Phase B — product detail, real images, AliExpress link ──
    let detail: TavilyResponse = { answer: "", results: [], images: [] };
    let aliResults: TavilyResult[] = [];
    const [detailRes, aliRes] = await Promise.allSettled([
      tavilySearch(tavilyKey, `${imageQuery} buy price`, cfg.tavilyDepth, cfg.maxResults + 2, true),
      tavilySearch(tavilyKey, imageQuery, "basic", 10, false, ["aliexpress.com"]),
    ]);
    if (detailRes.status === "fulfilled") detail = detailRes.value;
    else console.error("[Discover] detail search failed:", detailRes.reason);
    if (aliRes.status === "fulfilled") aliResults = aliRes.value.results;
    const aliExpressLink =
      findAliExpressUrl([...aliResults, ...detail.results]) || aliSearchUrl(imageQuery || produktName);

    // If we have a real AliExpress product page, extract its actual
    // images + content so the images match the linked product and the
    // price can be taken 1:1 from AliExpress.
    let aliExtractedContent = "";
    let aliExtractedImages: string[] = [];
    if (/aliexpress\.[a-z.]+\/item\/\d/i.test(aliExpressLink)) {
      try {
        const ext = await tavilyExtract(tavilyKey, aliExpressLink);
        aliExtractedContent = ext.content;
        aliExtractedImages = ext.images;
      } catch (e) {
        console.error("[Discover] aliexpress extract failed:", e);
      }
    }
    // Prefer images straight from the linked AliExpress product so they
    // actually match the product. Only fall back to the broader image
    // pool when the AliExpress page yielded too few.
    const images =
      aliExtractedImages.length >= 2
        ? cleanImages(aliExtractedImages)
        : cleanImages([...aliExtractedImages, ...detail.images]);

    // ─── Claude 2 — synthesize the finished product ──────────────
    const parsed = await claudeJson(
      client,
      `Du bist ein E-Commerce-Experte für den deutschen Markt. Erstelle aus den gegebenen Web-Rechercheergebnissen einen fertigen, verkaufsstarken Charts-Eintrag.

SPRACHE: Titel und Beschreibung auf DEUTSCH. Beschreibung als sauberes, verkaufsstarkes HTML — nutze <p> für Absätze, <ul><li> für Aufzählungen und <strong> für Hervorhebungen. Kein übertriebener Emoji-Einsatz.
KATEGORIE: ${kategorie ? `Verwende exakt "${kategorie}".` : "Wähle eine kurze, treffende Produktkategorie (z. B. Beauty, Haushalt, Sport, Haustier, Küche, Gadgets)."}
PREISE: Falls eine ALIEXPRESS-PRODUKTSEITE im Kontext gegeben ist, übernimm den dort gelisteten Preis EXAKT als buyPrice (rechne USD bei Bedarf grob mit Faktor 0.93 in EUR um). Sonst schätze realistisch. Verkaufspreis = marktüblicher Dropshipping-Preis in EUR.
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
    // Admin-chosen category wins; otherwise the AI's suggestion.
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

    let aliExpressOk = false;
    try {
      const r = await fetch(aliExpressLink, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(5000),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        },
      });
      aliExpressOk = r.status < 500;
    } catch {
      aliExpressOk = false;
    }

    return NextResponse.json({
      produkt: {
        titel,
        beschreibung: str(parsed.beschreibung),
        sku,
        aliExpressLink,
        images,
        stats,
        finances: { buyPrice, recommendedSellPrice, profitMargin },
      },
      viralEvidence: str(parsed.viralEvidence),
      aliExpressOk,
      imageCount: images.length,
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
