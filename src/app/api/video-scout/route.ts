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
  costForCount,
  formatViews,
  isVideoCount,
  perVideoCost,
  VIDEO_INCLUDE_MIN,
  VIDEO_VIRAL_MIN,
  type SavedScoutVideo,
  type ScoutProduct,
  type ScoutVideo,
} from "@/lib/video-scout";
import { anthropicCostUsd, recordUsd } from "@/lib/provider-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby kappt bei 60s. Apify-Run + Claude-Call müssen zusammen
// darunter bleiben — die Result-Caps unten halten den Scrape kurz.
export const maxDuration = 60;

type Session = Awaited<ReturnType<typeof getSession>>;

const MODEL = "claude-sonnet-4-6";
// Max. Kandidaten (nach Views sortiert), die an die Relevanz-KI gehen —
// begrenzt Tokens/Latenz. Viralitäts-Schwellen liegen in lib/video-scout.
const RELEVANCE_CANDIDATE_CAP = 25;
// clockworks/tiktok-scraper — in der Apify-API ersetzt "~" das "/".
const APIFY_ACTOR = "clockworks~tiktok-scraper";
const apifyRunUrl = (token: string) =>
  `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items` +
  `?token=${encodeURIComponent(token)}&timeout=50`;

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
}

// Robuste Feld-Extraktion (gegen echte Apify-Ausgabe verifiziert:
// playCount/webVideoUrl/text/authorMeta.name/videoMeta.coverUrl sind
// Top-Level). Mehrere Pfade als Sicherheit gegen Actor-Versionen.
/* eslint-disable @typescript-eslint/no-explicit-any */
function normalize(raw: any): Candidate | null {
  const url =
    str(raw?.webVideoUrl) ||
    str(raw?.url) ||
    str(raw?.postPage) ||
    str(raw?.videoUrl);
  if (!/tiktok\.com/i.test(url)) return null;
  const views = num(
    raw?.playCount ?? raw?.stats?.playCount ?? raw?.views ?? raw?.videoMeta?.playCount,
  );
  const likes = num(raw?.diggCount ?? raw?.stats?.diggCount ?? raw?.likes);
  const caption = str(raw?.text ?? raw?.title ?? raw?.desc ?? raw?.description);
  const author = str(
    raw?.authorMeta?.name ??
      raw?.authorMeta?.nickName ??
      raw?.author?.uniqueId ??
      raw?.author,
  );
  const thumbnail =
    str(raw?.videoMeta?.coverUrl) ||
    str(raw?.covers?.default) ||
    (Array.isArray(raw?.covers) ? str(raw.covers[0]) : "") ||
    str(raw?.thumbnail);
  return { url, views, likes, caption, author, thumbnail };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function scrapeTikTok(
  token: string,
  product: string,
  want: number,
): Promise<Candidate[]> {
  // Pool gross genug für genug virale Treffer nach den Filtern, aber
  // bewusst KLEIN gedeckelt: an echten Daten getestet liefern 12–18
  // Treffer zuverlässig 6–10 Videos ≥50k Views in 7–20s; bei ~30 lief
  // der Actor teils in den 50s-Timeout (run-failed). Reliabilität >
  // Pool-Grösse.
  const resultsPerPage = Math.min(18, Math.max(12, want * 3));
  const input = {
    searchQueries: [product],
    resultsPerPage,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
    proxyConfiguration: { useApifyProxy: true },
  };
  const res = await fetch(apifyRunUrl(token), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(52000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Apify ${res.status}: ${body.slice(0, 200)}`);
  }
  const items: unknown = await res.json();
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const it of items) {
    const c = normalize(it);
    if (!c || seen.has(c.url)) continue;
    seen.add(c.url);
    out.push(c);
  }
  return out;
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
    return NextResponse.json({ error: "Anzahl muss 3, 6 oder 9 sein." }, { status: 400 });
  }
  const cost = costForCount(count);

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

  // ── 2) Scrapen ──
  let candidates: Candidate[];
  try {
    candidates = await scrapeTikTok(apifyToken, searchQuery, count);
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
  // Greift der Filter zu hart (leer), nehmen wir trotzdem den Pool — das
  // Tool liefert generell Produkt-Videos, es refused nicht.
  const relevantIdx = await filterRelevant(client, product, pool);
  const relevant = relevantIdx.map((i) => pool[i]).filter(Boolean);
  const ranked = (relevant.length > 0 ? relevant : pool)
    .slice()
    .sort((a, b) => b.views - a.views);

  // ── 5) Top-N: die view-stärksten Videos zuerst (>10k priorisiert) ──
  const top = ranked.slice(0, count);

  // ── 6) Refund: Videos unter VIDEO_VIRAL_MIN werden gutgeschrieben ──
  // Thumbnails dauerhaft machen (nur wenn wir persistieren = kunde);
  // für Admin reicht die Original-URL (nur in-Session sichtbar).
  const perVideo = perVideoCost(count);
  let refundTotal = 0;
  const thumbs: string[] = kunde
    ? await Promise.all(top.map((c) => rehostThumbnail(c.thumbnail)))
    : top.map((c) => c.thumbnail);
  const videos_found: ScoutVideo[] = top.map((c, i) => {
    const refunded = c.views < VIDEO_VIRAL_MIN;
    if (refunded) refundTotal += perVideo;
    return {
      url: c.url,
      platform: "TikTok",
      view_count: c.views,
      formatted_views: formatViews(c.views),
      // Bewusst nur die ersten 15 Zeichen — keine volle Beschreibung.
      title_snippet: c.caption.slice(0, 15),
      thumbnail: thumbs[i] || c.thumbnail || undefined,
      likes: c.likes || undefined,
      refunded,
      refundAmount: refunded ? perVideo : undefined,
    };
  });
  const netCost = Math.max(0, cost - refundTotal);

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
      refundAmount: v.refundAmount,
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
  // Refund-Infos und creditsRemaining sind App-Extras fürs UI.
  return NextResponse.json(
    {
      product,
      productId,
      requested_videos: count,
      credits_used: netCost,
      credits_refunded: refundTotal,
      refunded_count: videos_found.filter((v) => v.refunded).length,
      per_video_refund: perVideo,
      tier_status: "Premium Search",
      videos_found,
      creditsRemaining,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
