// ─── /api/video-scout ────────────────────────────────────────────
// "Brospify Video Scout": findet zu einem Produkt die viralsten
// echten TikTok-Videos.
//
//   GET  → liefert die Produkte, die der Account auswählen darf: die im
//          Produkt-Drop bereits gezogenen Produkte (Admins bekommen den
//          ganzen Katalog zum Testen). Kein Credit-Abzug.
//   POST → scrapet zum gewählten Produkt virale Videos. Eingabe ist NUR
//          eine productId aus der erlaubten Liste (kein Freitext) — so
//          kann niemand beliebige/teure Suchen auslösen.
//
// Architektur (bewusst so, damit nie Zahlen halluziniert werden):
//   1) Tier-Gate (videoScout) + productId gegen die erlaubte Liste
//      prüfen + Credit-Vorabprüfung
//   2) Apify-TikTok-Scraper: Suche nach dem Produkttitel → echte
//      Videos mit echten playCount/Views
//   3) Claude filtert NUR die Relevanz (structured JSON: welche
//      Kandidaten zeigen zweifelsfrei das Produkt?)
//   4) deterministisch nach echten Views sortieren + auf die
//      gewünschte Menge kürzen (KEIN Auffüllen mit Irrelevantem)
//   5) Credits erst JETZT abziehen (nur wenn ≥1 Video) + JSON zurück
//
// Voraussetzung: APIFY_API_TOKEN (TikTok-Scraper) + ANTHROPIC_API_KEY.

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/session";
import { requireFeature } from "@/lib/tier-guard";
import {
  deductCredits,
  findKundeByKey,
  getAllProdukte,
  getCreditsState,
  updateKundeProfile,
  type Produkt,
} from "@/lib/sheets";
import {
  formatViews,
  isVideoCount,
  chargedCredits,
  LOW_VIEW_RETRY_THRESHOLD,
  VIDEO_INCLUDE_MIN,
  VIDEO_VIRAL_MIN,
  type SavedScoutVideo,
  type ScoutProduct,
  type ScoutVideo,
} from "@/lib/video-scout";
import { anthropicCostUsd, recordUsd } from "@/lib/provider-usage";
import { getCreditCost } from "@/lib/credit-config-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby kappt bei 60s. Apify-Run + Claude-Call müssen zusammen
// darunter bleiben — die Result-Caps unten halten den Scrape kurz.
export const maxDuration = 60;

type Session = Awaited<ReturnType<typeof getSession>>;

const MODEL = "claude-sonnet-4-6";
// Max. Kandidaten (nach Views sortiert), die an die Relevanz-KI gehen —
// begrenzt Tokens/Latenz. Viralitäts-Schwellen liegen in lib/video-scout.
const RELEVANCE_CANDIDATE_CAP = 30;

type ScoutPlatform = "TikTok" | "Instagram" | "YouTube";

// Apify-Actor je Plattform ("~" ersetzt in der API das "/"). Alle laufen
// über DENSELBEN Apify-Account/Token (APIFY_API_TOKEN ist account-weit) —
// es braucht KEINEN neuen Env-Key. Die IG-/YT-Feld-Mappings unten sind
// defensiv über mehrere Pfade gebaut; schlägt eine Quelle fehl oder ist
// der Actor nicht im Account verfügbar, liefert sie einfach 0 Treffer und
// die anderen Plattformen tragen das Ergebnis (siehe scrapeAll).
const APIFY_ACTORS: Record<ScoutPlatform, string> = {
  TikTok: "clockworks~tiktok-scraper",
  Instagram: "apify~instagram-scraper",
  YouTube: "streamers~youtube-scraper",
};

// Apify-Run-Timeout je Quelle (Sekunden). Bewusst knapp: alle Quellen
// laufen PARALLEL, die Wand-Zeit ist also ~die langsamste Quelle, nicht
// die Summe. Budget bis maxDuration (60s): Query-Gen (~3s) + Scrape
// (~33s worst) + Relevanz (~6s) + Thumbnail-Rehost (~8s) ≈ 50s. Die
// kleinen Pools unten laufen real in 7–20s, der Timeout ist nur die
// Reissleine — kippt eine Quelle, tragen die anderen das Ergebnis.
const SOURCE_TIMEOUT_S = 30;
const apifyRunUrl = (slug: string, token: string) =>
  `https://api.apify.com/v2/acts/${slug}/run-sync-get-dataset-items` +
  `?token=${encodeURIComponent(token)}&timeout=${SOURCE_TIMEOUT_S}`;

// ─── Helpers ─────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function num(v: unknown): number {
  const n =
    typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function projectProduct(p: Produkt): ScoutProduct {
  return { id: p.id, titel: p.titel, bildUrl: p.bildUrl, sku: p.sku };
}

/** Auswählbare Produkte + bereits gespeicherte Videos dieses Accounts:
 *  - Admin / ohne Lizenz → der gesamte Katalog, keine Historie
 *  - regulärer Kunde     → seine im Produkt-Drop gezogenen Produkte
 *                          (neueste zuerst) + seine gespeicherten Videos. */
async function getScoutState(
  session: Session,
): Promise<{ products: ScoutProduct[]; savedVideos: SavedScoutVideo[] }> {
  const all = (await getAllProdukte()).filter((p) => p.id);
  if (session.isAdmin || !session.lizenzschluessel) {
    return { products: all.map(projectProduct), savedVideos: [] };
  }
  const kunde = await findKundeByKey(session.lizenzschluessel);
  if (!kunde) return { products: [], savedVideos: [] };
  const drawnIds = Array.isArray(kunde.profile.drawnProducts)
    ? kunde.profile.drawnProducts
    : [];
  const byId = new Map(all.map((p) => [p.id, p]));
  const products = drawnIds
    .map((id) => byId.get(id))
    .filter((p): p is Produkt => !!p)
    .reverse()
    .map(projectProduct);
  const savedVideos = Array.isArray(kunde.profile.scoutVideos)
    ? kunde.profile.scoutVideos
    : [];
  return { products, savedVideos };
}

interface Candidate {
  url: string;
  views: number;
  likes: number;
  caption: string;
  author: string;
  thumbnail: string;
  platform: ScoutPlatform;
}

// ─── Generischer Apify-Run ───────────────────────────────────────
// Startet einen Actor synchron und gibt die Dataset-Items zurück. Wirft
// bei HTTP-Fehler/Timeout — der Aufrufer (scrapeAll) fängt das pro Quelle
// ab, damit eine kaputte Plattform die anderen nicht mitreisst.
/* eslint-disable @typescript-eslint/no-explicit-any */
async function runApifyActor(
  slug: string,
  token: string,
  input: Record<string, unknown>,
): Promise<any[]> {
  const res = await fetch(apifyRunUrl(slug, token), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    // Etwas mehr als der Actor-Run-Timeout, damit wir dessen Fehlermeldung
    // noch lesen können, bevor wir selbst abbrechen.
    signal: AbortSignal.timeout((SOURCE_TIMEOUT_S + 3) * 1000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Apify ${slug} ${res.status}: ${body.slice(0, 160)}`);
  }
  const items: unknown = await res.json();
  return Array.isArray(items) ? items : [];
}

// ─── Feld-Mappings je Plattform ──────────────────────────────────
// TikTok (clockworks/tiktok-scraper) ist gegen echte Ausgabe verifiziert:
// playCount/webVideoUrl/text/authorMeta.name/videoMeta.coverUrl sind
// Top-Level. IG/YT sind defensiv über mehrere mögliche Pfade gebaut, weil
// die genaue Form je Actor-Version variiert — fehlt ein Feld, fällt es auf
// 0/"" zurück statt zu crashen. (Live-Test gegen Apify empfohlen.)

function normalizeTikTok(raw: any): Candidate | null {
  const url =
    str(raw?.webVideoUrl) || str(raw?.url) || str(raw?.postPage) || str(raw?.videoUrl);
  if (!/tiktok\.com/i.test(url)) return null;
  return {
    url,
    views: num(raw?.playCount ?? raw?.stats?.playCount ?? raw?.views ?? raw?.videoMeta?.playCount),
    likes: num(raw?.diggCount ?? raw?.stats?.diggCount ?? raw?.likes),
    caption: str(raw?.text ?? raw?.title ?? raw?.desc ?? raw?.description),
    author: str(raw?.authorMeta?.name ?? raw?.authorMeta?.nickName ?? raw?.author?.uniqueId ?? raw?.author),
    thumbnail:
      str(raw?.videoMeta?.coverUrl) ||
      str(raw?.covers?.default) ||
      (Array.isArray(raw?.covers) ? str(raw.covers[0]) : "") ||
      str(raw?.thumbnail),
    platform: "TikTok",
  };
}

function normalizeInstagram(raw: any): Candidate | null {
  const url = str(raw?.url) || str(raw?.postUrl) || str(raw?.inputUrl);
  if (!/instagram\.com/i.test(url)) return null;
  // Nur Video-/Reel-Posts — Fotos haben keine Views und sind für den
  // Scout uninteressant.
  const type = str(raw?.type ?? raw?.productType).toLowerCase();
  const isVideo =
    type.includes("video") ||
    type.includes("clip") ||
    type.includes("reel") ||
    /\/reels?\//i.test(url) ||
    num(raw?.videoViewCount ?? raw?.videoPlayCount) > 0;
  if (!isVideo) return null;
  return {
    url,
    views: num(raw?.videoViewCount ?? raw?.videoPlayCount ?? raw?.viewsCount ?? raw?.views),
    likes: num(raw?.likesCount ?? raw?.likes),
    caption: str(raw?.caption ?? raw?.text ?? raw?.title),
    author: str(raw?.ownerUsername ?? raw?.ownerFullName ?? raw?.owner?.username),
    thumbnail:
      str(raw?.displayUrl) ||
      str(raw?.thumbnailUrl) ||
      (Array.isArray(raw?.images) ? str(raw.images[0]) : "") ||
      str(raw?.thumbnail),
    platform: "Instagram",
  };
}

function normalizeYouTube(raw: any): Candidate | null {
  const url = str(raw?.url) || str(raw?.videoUrl) || str(raw?.shortUrl);
  if (!/youtube\.com|youtu\.be/i.test(url)) return null;
  // Wir wollen Shorts: bevorzugt /shorts/-URLs. Liefert der Actor nur
  // normale Watch-URLs, lassen wir sie zu (besser als gar kein YouTube),
  // markieren sie aber weiter als YouTube.
  return {
    url,
    views: num(raw?.viewCount ?? raw?.views ?? raw?.viewCountInt ?? raw?.statistics?.viewCount),
    likes: num(raw?.likes ?? raw?.likeCount ?? raw?.numberOfLikes),
    caption: str(raw?.title ?? raw?.text),
    author: str(raw?.channelName ?? raw?.channelUsername ?? raw?.author),
    thumbnail:
      str(raw?.thumbnailUrl) ||
      str(raw?.thumbnail) ||
      (Array.isArray(raw?.thumbnails) ? str(raw.thumbnails[raw.thumbnails.length - 1]?.url) : "") ||
      "",
    platform: "YouTube",
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Pro Plattform: Input-Builder + Normalizer. `want` steuert die Pool-
// Grösse; bewusst klein, damit jeder Run zuverlässig unter dem Timeout
// bleibt (siehe TikTok-Lasttest-Notizen).
const SOURCES: Record<
  ScoutPlatform,
  { input: (q: string, perPage: number) => Record<string, unknown>; normalize: (raw: unknown) => Candidate | null }
> = {
  TikTok: {
    input: (q, perPage) => ({
      searchQueries: [q],
      resultsPerPage: perPage,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSubtitles: false,
      proxyConfiguration: { useApifyProxy: true },
    }),
    normalize: normalizeTikTok,
  },
  Instagram: {
    input: (q, perPage) => ({
      search: q,
      searchType: "hashtag",
      searchLimit: 1,
      resultsType: "posts",
      resultsLimit: perPage,
      addParentData: false,
    }),
    normalize: normalizeInstagram,
  },
  YouTube: {
    input: (q, perPage) => ({
      searchKeywords: q,
      maxResults: perPage,
      maxResultsShorts: perPage,
      sortBy: "relevance",
      uploadDate: "all",
    }),
    normalize: normalizeYouTube,
  },
};

async function scrapeSource(
  platform: ScoutPlatform,
  token: string,
  query: string,
  perPage: number,
): Promise<Candidate[]> {
  const { input, normalize } = SOURCES[platform];
  const items = await runApifyActor(APIFY_ACTORS[platform], token, input(query, perPage));
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const it of items) {
    const c = normalize(it);
    if (!c || !c.url || seen.has(c.url)) continue;
    seen.add(c.url);
    out.push(c);
  }
  return out;
}

// Alle Plattformen PARALLEL scrapen und zusammenführen. Jede Quelle ist
// für sich fehlertolerant (Promise.allSettled) — fällt Instagram oder
// YouTube aus, liefert TikTok das Ergebnis trotzdem. Über alle Quellen
// hinweg wird per URL dedupliziert.
async function scrapeAll(
  token: string,
  query: string,
  want: number,
): Promise<Candidate[]> {
  // Pro Quelle bewusst klein (TikTok-Lasttest: 12–18 laufen zuverlässig).
  const perPage = Math.min(15, Math.max(10, want * 4));
  const results = await Promise.allSettled(
    (Object.keys(SOURCES) as ScoutPlatform[]).map((p) =>
      scrapeSource(p, token, query, perPage),
    ),
  );
  const seen = new Set<string>();
  const merged: Candidate[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const c of r.value) {
        if (seen.has(c.url)) continue;
        seen.add(c.url);
        merged.push(c);
      }
    } else {
      console.warn("[video-scout] source failed:", r.reason);
    }
  }
  return merged;
}

// ─── Thumbnail dauerhaft machen ──────────────────────────────────
// TikTok-Cover-URLs sind signiert und laufen nach ~1 Tag ab. Damit die
// gespeicherte Galerie dauerhaft Vorschaubilder zeigt, laden wir das
// Cover einmal herunter und legen es auf Vercel Blob ab (kurze, stabile
// URL — gut auch fürs Profil-Zellen-Limit). Schlägt etwas fehl, geben
// wir "" zurück → die UI zeigt dann einen Platzhalter.
async function rehostThumbnail(srcUrl: string): Promise<string> {
  if (!srcUrl) return "";
  try {
    const res = await fetch(srcUrl, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    });
    if (!res.ok) return "";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 3 * 1024 * 1024) return "";
    const blob = await put(
      `scout-thumbs/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`,
      buf,
      { access: "public", contentType: "image/jpeg" },
    );
    return blob.url;
  } catch {
    return "";
  }
}

// ─── Claude-Relevanzfilter (gibt nur Indizes zurück) ─────────────

const RELEVANCE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    relevant_indices: { type: "array", items: { type: "integer" } },
  },
  required: ["relevant_indices"],
  additionalProperties: false,
};

function extractJson(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  const brace = text.match(/\{[\s\S]*\}/);
  return brace ? brace[0] : text.trim();
}

// ─── Such-Begriff aus dem Produkttitel ableiten ──────────────────
// Lange deutsche Marketing-Titel ("LED-Hundehalsband – Sicherheit bei
// Nacht für deinen Hund") finden auf TikTok kaum virale Videos. Ein
// knapper, generischer Begriff (bevorzugt Englisch) trifft die virale
// Dropshipping-Welt viel besser. Fällt der Call aus, nehmen wir den
// Titel als Fallback.

const QUERY_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: { query: { type: "string" } },
  required: ["query"],
  additionalProperties: false,
};

async function generateSearchQuery(client: Anthropic, title: string): Promise<string> {
  const system = `Du wandelst einen deutschen Produkt-Titel in EINEN kurzen TikTok-Suchbegriff um.
REGELN:
- 2 bis 4 Wörter, bevorzugt ENGLISCH (so taggen die meisten viralen Dropshipping-Creator).
- Nur der Produkt-Typ / Kern-Gegenstand. KEINE Marketing-Wörter (Premium, Set, Deluxe, 2024, "für deinen Hund", Adjektive wie "innovativ").
- Keine Sonderzeichen, keine Anführungszeichen, kein Hashtag.
Antworte ausschliesslich als JSON: {"query":"..."}.`;
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 100,
      thinking: { type: "disabled" },
      output_config: { format: { type: "json_schema", schema: QUERY_SCHEMA } },
      system,
      messages: [{ role: "user", content: `Produkt-Titel: ${title}` }],
    });
    await recordUsd("anthropic", anthropicCostUsd(MODEL, msg.usage));
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const parsed = JSON.parse(extractJson(text)) as { query?: unknown };
    const q = typeof parsed?.query === "string" ? parsed.query.trim().slice(0, 60) : "";
    return q || title;
  } catch (e) {
    console.warn("[video-scout] query-gen failed, using title:", e);
    return title;
  }
}

async function filterRelevant(
  client: Anthropic,
  product: string,
  candidates: Candidate[],
): Promise<number[]> {
  const list = candidates
    .map(
      (c, i) =>
        `[${i}] ${c.caption || "(keine Caption)"} — @${c.author || "?"} · ${c.views} Views`,
    )
    .join("\n");

  const system = `Du bist der "Brospify Video Scout", ein rein analytischer Filter für E-Commerce/Dropshipping.
Aufgabe: Entscheide, welche der gelisteten TikTok-Videos ZWEIFELSFREI das angefragte Produkt zeigen oder bewerben.
REGELN:
- RELEVANZ: Nur Videos, die klar dieses Produkt selbst zeigen. Ignoriere generische Compilations, Spam, falsche oder nur grob verwandte Produkte rigoros.
- Im Zweifel AUSSCHLIESSEN.
- Du sortierst NICHT und erfindest nichts — gib ausschliesslich die Indizes der relevanten Videos zurück.
Antworte ausschliesslich als JSON: {"relevant_indices": [0, 2, ...]}.`;
  const user = `Zielprodukt: ${product}\n\nKandidaten:\n${list}`;

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      thinking: { type: "disabled" },
      output_config: { format: { type: "json_schema", schema: RELEVANCE_SCHEMA } },
      system,
      messages: [{ role: "user", content: user }],
    });
    await recordUsd("anthropic", anthropicCostUsd(MODEL, msg.usage));
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const parsed = JSON.parse(extractJson(text)) as { relevant_indices?: unknown };
    const idx = parsed?.relevant_indices;
    if (!Array.isArray(idx)) return [];
    return idx
      .map((n) => (typeof n === "number" ? Math.round(n) : NaN))
      .filter((n) => Number.isInteger(n) && n >= 0 && n < candidates.length);
  } catch (e) {
    console.warn("[video-scout] relevance filter failed, heuristic fallback:", e);
    // Degradierter Modus: simple Keyword-Heuristik auf der Caption,
    // damit eine bezahlte Suche nicht komplett leer zurückkommt.
    const tokens = product
      .toLowerCase()
      .split(/[^a-zà-ÿ0-9]+/)
      .filter((t) => t.length >= 3);
    if (tokens.length === 0) return candidates.map((_, i) => i);
    return candidates
      .map((c, i) => ({ i, hit: tokens.some((t) => c.caption.toLowerCase().includes(t)) }))
      .filter((x) => x.hit)
      .map((x) => x.i);
  }
}

// ─── GET: erlaubte Produkte (gezogene Produkte / Katalog) ────────

export async function GET() {
  const session = await getSession();
  const guard = await requireFeature(session, "videoScout");
  if (!guard.ok) return guard.response;
  try {
    const { products, savedVideos } = await getScoutState(session);
    return NextResponse.json(
      { ok: true, products, savedVideos },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[video-scout] GET products failed:", e);
    return NextResponse.json(
      { error: "Produkte konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}

// ─── POST: Videos zum gewählten Produkt scrapen ──────────────────

export async function POST(req: Request) {
  const session = await getSession();
  const guard = await requireFeature(session, "videoScout");
  if (!guard.ok) return guard.response;

  // ── Input ──
  let body: { productId?: unknown; count?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }
  const productId = str(body.productId);
  const count = typeof body.count === "number" ? body.count : Number(body.count);
  if (!productId) {
    return NextResponse.json({ error: "Bitte wähle ein Produkt aus." }, { status: 400 });
  }
  if (!isVideoCount(count)) {
    return NextResponse.json({ error: "Anzahl muss 1, 2 oder 3 sein." }, { status: 400 });
  }
  // Admin-editable price (falls back to the bundled default).
  const cost = await getCreditCost(`VIDEO_SCOUT_${count}`);

  // ── Keys ──
  const apifyToken = process.env.APIFY_API_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!apifyToken) {
    return NextResponse.json(
      {
        error:
          "Video-Scraper ist nicht konfiguriert (APIFY_API_TOKEN fehlt). Bitte später erneut versuchen.",
      },
      { status: 503 },
    );
  }
  if (!anthropicKey) {
    return NextResponse.json(
      { error: "KI ist nicht konfiguriert (ANTHROPIC_API_KEY fehlt)." },
      { status: 503 },
    );
  }

  // ── Katalog laden + erlaubte Produkte bestimmen ──
  let allProds: Produkt[];
  try {
    allProds = (await getAllProdukte()).filter((p) => p.id);
  } catch (e) {
    console.error("[video-scout] getAllProdukte failed:", e);
    return NextResponse.json(
      { error: "Produkte konnten nicht geladen werden." },
      { status: 500 },
    );
  }

  // Kunde nur für reguläre Accounts (für drawn-Set + Credits). Admins
  // dürfen jedes Produkt zum Testen wählen und umgehen den Zähler.
  let kunde: Awaited<ReturnType<typeof findKundeByKey>> | null = null;
  let allowedIds: Set<string>;
  if (session.isAdmin || !session.lizenzschluessel) {
    allowedIds = new Set(allProds.map((p) => p.id));
  } else {
    kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde) {
      return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });
    }
    const drawnIds = Array.isArray(kunde.profile.drawnProducts)
      ? kunde.profile.drawnProducts
      : [];
    allowedIds = new Set(drawnIds);
  }

  if (!allowedIds.has(productId)) {
    return NextResponse.json(
      { error: "Bitte wähle eines deiner gezogenen Produkte." },
      { status: 400 },
    );
  }
  const picked = allProds.find((p) => p.id === productId);
  const product = str(picked?.titel).slice(0, 120);
  if (!picked || !product) {
    return NextResponse.json(
      { error: "Dieses Produkt hat noch keinen Titel für die Suche." },
      { status: 400 },
    );
  }

  // ── Credit-Vorabprüfung (Admin umgeht den Zähler) ──
  if (kunde) {
    const credits = getCreditsState(kunde.profile);
    if (credits.balance < cost) {
      return NextResponse.json(
        {
          error: `Nicht genug Credits — du brauchst ${cost}, hast aber nur ${credits.balance}. Lade dein Konto unter /credits auf.`,
          creditsRemaining: credits.balance,
        },
        { status: 402 },
      );
    }
  }

  // ── KI-Client (für Query-Gen + Relevanzfilter) ──
  const client = new Anthropic({ apiKey: anthropicKey });

  // ── 1) Besten Suchbegriff aus dem Titel ableiten ──
  const searchQuery = await generateSearchQuery(client, product);

  // ── 2) Scrapen — TikTok + Instagram Reels + YouTube Shorts (parallel) ──
  // scrapeAll ist in sich fehlertolerant: solange EINE Quelle liefert,
  // bekommen wir Kandidaten. Wirft es trotzdem, war alles kaputt.
  let candidates: Candidate[];
  try {
    candidates = await scrapeAll(apifyToken, searchQuery, count);
  } catch (e) {
    console.error("[video-scout] scrape failed:", e);
    const timedOut = e instanceof Error && /timeout|abort/i.test(e.message);
    return NextResponse.json(
      {
        error: timedOut
          ? "Die Suche hat zu lange gedauert. Bitte versuche es gleich erneut."
          : "Video-Suche fehlgeschlagen. Versuche es in einem Moment erneut.",
      },
      { status: 502 },
    );
  }
  if (candidates.length === 0) {
    return NextResponse.json(
      {
        error: "Keine passenden Videos gefunden. Es wurden keine Credits abgezogen.",
        videos_found: [],
      },
      { status: 404 },
    );
  }

  // ── 3) Müll raus + bereits gezogene Videos ausschliessen ──
  // Kein Video kann zweimal gezogen werden: gegen die gespeicherten URLs
  // dieses Kunden deduplizieren. Offensichtlichen Müll (< INCLUDE_MIN)
  // ganz raus. Nach echten Views sortieren, Pool deckeln.
  const savedUrls = new Set(
    (kunde && Array.isArray(kunde.profile.scoutVideos) ? kunde.profile.scoutVideos : []).map(
      (v) => v.url,
    ),
  );
  const pool = candidates
    .filter((c) => c.views >= VIDEO_INCLUDE_MIN && !savedUrls.has(c.url))
    .sort((a, b) => b.views - a.views)
    .slice(0, RELEVANCE_CANDIDATE_CAP);

  // Nur wenn GAR nichts (mehr) da ist, geben wir auf — sonst liefern wir
  // generell Videos zum Produkt (die view-stärksten zuerst, >10k oben).
  if (pool.length === 0) {
    return NextResponse.json(
      {
        noResults: true,
        error:
          "Aktuell konnten keine weiteren Videos zu diesem Produkt gefunden werden. Es wurden keine Credits abgezogen.",
        videos_found: [],
      },
      { status: 404 },
    );
  }

  // ── 4) Relevanz filtern (hält das Produkt-Thema zusammen) ──
  // Greift der Filter zu hart (leer), nehmen wir trotzdem den Pool.
  const relevantIdx = await filterRelevant(client, product, pool);
  const relevant = relevantIdx.map((i) => pool[i]).filter(Boolean);
  const ranked = (relevant.length > 0 ? relevant : pool)
    .slice()
    .sort((a, b) => b.views - a.views);

  // ── 5) Qualitäts-Gate: zu viele schwache Treffer → später erneut ──
  // Findet die Suche MEHR als LOW_VIEW_RETRY_THRESHOLD relevante Videos
  // unter 10k Views, ist der Pool für dieses Produkt gerade zu schwach.
  // Wir liefern nichts und ziehen KEINE Credits ab.
  const weakSeen = ranked.filter((c) => c.views < VIDEO_VIRAL_MIN).length;
  if (weakSeen > LOW_VIEW_RETRY_THRESHOLD) {
    return NextResponse.json(
      {
        retryLater: true,
        error:
          "Aktuell finden sich überwiegend schwache Videos (unter 10k Views) zu diesem Produkt. Es wurden keine Credits abgezogen — bitte versuche es später erneut.",
        videos_found: [],
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  // ── 6) Verifier: liefert die Suche WIRKLICH die gewünschte Anzahl? ──
  // Reichen die gefundenen, relevanten Videos nicht für die angeforderte
  // Menge, wird NICHT mit Schwachem aufgefüllt — auch hier: später erneut,
  // keine Credits.
  const top = ranked.slice(0, count);
  if (top.length < count) {
    return NextResponse.json(
      {
        retryLater: true,
        error: `Es konnten gerade nur ${top.length} statt ${count} passende Videos gefunden werden. Es wurden keine Credits abgezogen — bitte versuche es später erneut.`,
        videos_found: [],
        found: top.length,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  // ── 7) Halb-Preis-Regel: ist ≥1 geliefertes Video schwach (<10k), zahlt
  //      der Kunde nur die Hälfte der Credits. Sonst den vollen Preis. ──
  // Thumbnails dauerhaft machen (nur wenn wir persistieren = kunde);
  // für Admin reicht die Original-URL (nur in-Session sichtbar).
  const thumbs: string[] = kunde
    ? await Promise.all(top.map((c) => rehostThumbnail(c.thumbnail)))
    : top.map((c) => c.thumbnail);
  const videos_found: ScoutVideo[] = top.map((c, i) => ({
    url: c.url,
    platform: c.platform,
    view_count: c.views,
    formatted_views: formatViews(c.views),
    // Bewusst nur die ersten 15 Zeichen — keine volle Beschreibung.
    title_snippet: c.caption.slice(0, 15),
    thumbnail: thumbs[i] || c.thumbnail || undefined,
    likes: c.likes || undefined,
    refunded: c.views < VIDEO_VIRAL_MIN,
  }));
  const hasWeakVideo = videos_found.some((v) => v.refunded);
  const netCost = chargedCredits(cost, hasWeakVideo);
  const creditsSaved = Math.max(0, cost - netCost);

  // ── 7) Videos beim Kunden speichern + Netto-Credits abziehen (atomar) ──
  // deductCredits schreibt `{ ...profile, credits }`, nimmt also unser
  // erweitertes scoutVideos mit — ein einziger Write, keine halben Zustände.
  let creditsRemaining: number | undefined;
  if (kunde) {
    const nowIso = new Date().toISOString();
    const newRecords: SavedScoutVideo[] = videos_found.map((v) => ({
      url: v.url,
      platform: v.platform,
      view_count: v.view_count,
      formatted_views: v.formatted_views,
      title_snippet: v.title_snippet, // nur 15 Zeichen
      thumbnail: v.thumbnail, // dauerhafte Blob-URL (oder leer)
      likes: v.likes,
      refunded: v.refunded,
      productId,
      savedAt: nowIso,
    }));
    const existing = Array.isArray(kunde.profile.scoutVideos) ? kunde.profile.scoutVideos : [];
    // Neueste zuerst, global auf 60 begrenzt (Profil-Zelle nicht sprengen).
    const merged = [...newRecords, ...existing].slice(0, 60);
    const updatedProfile = { ...kunde.profile, scoutVideos: merged };
    try {
      if (netCost > 0) {
        const result = await deductCredits(kunde.rowIndex, updatedProfile, netCost, "video-scout");
        if (!result.success) {
          return NextResponse.json(
            { error: `Nicht genug Credits — die Suche kostet ${cost}.`, creditsRemaining: result.remaining },
            { status: 402 },
          );
        }
        creditsRemaining = result.remaining;
      } else {
        // Alles gutgeschrieben (theoretisch) — nur speichern, nichts abziehen.
        await updateKundeProfile(kunde.rowIndex, updatedProfile);
        creditsRemaining = getCreditsState(updatedProfile).balance;
      }
    } catch (e) {
      console.error("[video-scout] save+deduct failed:", e);
      return NextResponse.json({ error: "Abrechnung fehlgeschlagen." }, { status: 500 });
    }
  }

  // Antwort: videos_found hält das Agent-Schema ein; productId, die
  // Credit-/Verifier-Infos und creditsRemaining sind App-Extras fürs UI.
  return NextResponse.json(
    {
      product,
      productId,
      requested_videos: count,
      credits_used: netCost,
      credits_saved: creditsSaved,
      half_price: hasWeakVideo,
      weak_count: videos_found.filter((v) => v.refunded).length,
      tier_status: "Premium Search",
      // Verifier-Beleg: gewünscht vs. tatsächlich geliefert (immer gleich,
      // sonst wäre oben schon retryLater gegriffen).
      verification: { requested: count, delivered: videos_found.length, weak_seen: weakSeen },
      videos_found,
      creditsRemaining,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
