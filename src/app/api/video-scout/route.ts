// ─── POST /api/video-scout ───────────────────────────────────────
// "Brospify Viral Video Scout": findet zu einem Produkt die viralsten
// echten TikTok-Videos.
//
// Architektur (bewusst so, damit nie Zahlen halluziniert werden):
//   1) Tier-Gate (videoScout) + Credit-Vorabprüfung
//   2) Apify-TikTok-Scraper: Suche nach dem Produktnamen → echte
//      Videos mit echten playCount/Views
//   3) Claude filtert NUR die Relevanz (structured JSON: welche
//      Kandidaten zeigen zweifelsfrei das Produkt?)
//   4) deterministisch nach echten Views sortieren + auf die
//      gewünschte Menge kürzen (KEIN Auffüllen mit Irrelevantem)
//   5) Credits erst JETZT abziehen (nur wenn ≥1 Video) + JSON zurück
//
// Voraussetzung: APIFY_API_TOKEN (TikTok-Scraper) + ANTHROPIC_API_KEY.
// Fehlt einer der Keys, degradiert die Route mit klarer Meldung und
// zieht keine Credits ab.

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/session";
import { requireFeature } from "@/lib/tier-guard";
import {
  deductCredits,
  findKundeByKey,
  getCreditsState,
  getKundeProfile,
} from "@/lib/sheets";
import {
  costForCount,
  formatViews,
  isVideoCount,
  type ScoutVideo,
} from "@/lib/video-scout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby kappt bei 60s. Apify-Run + Claude-Call müssen zusammen
// darunter bleiben — die Result-Caps unten halten den Scrape kurz.
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-6";
// clockworks/tiktok-scraper — in der Apify-API ersetzt "~" das "/".
const APIFY_ACTOR = "clockworks~tiktok-scraper";
const apifyRunUrl = (token: string) =>
  `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items` +
  `?token=${encodeURIComponent(token)}&timeout=55`;

// ─── Helpers ─────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function num(v: unknown): number {
  const n =
    typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

interface Candidate {
  url: string;
  views: number;
  likes: number;
  caption: string;
  author: string;
  thumbnail: string;
}

// Robuste Feld-Extraktion: TikTok-Scraper-Outputs variieren je nach
// Actor-Version, daher mehrere Pfade abklopfen.
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
  // Genug Kandidaten holen, damit nach dem Relevanzfilter noch genug
  // übrig bleiben — aber eng genug, dass der Run unter 60s bleibt.
  const resultsPerPage = Math.min(40, Math.max(12, want * 4));
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
    signal: AbortSignal.timeout(57000),
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

  const system = `Du bist der "Brospify Viral Video Scout", ein rein analytischer Filter für E-Commerce/Dropshipping.
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

// ─── Route ───────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await getSession();
  const guard = await requireFeature(session, "videoScout");
  if (!guard.ok) return guard.response;

  // ── Input ──
  let body: { product?: unknown; count?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }
  const product = str(body.product).slice(0, 120);
  const count =
    typeof body.count === "number" ? body.count : Number(body.count);
  if (!product || product.length < 2) {
    return NextResponse.json({ error: "Bitte gib ein Produkt an." }, { status: 400 });
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

  // ── Credit-Vorabprüfung (Admin umgeht den Zähler) ──
  let kundeRowIndex: number | null = null;
  let kundeProfile: Awaited<ReturnType<typeof getKundeProfile>> | null = null;
  if (!session.isAdmin && session.lizenzschluessel) {
    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde) {
      return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });
    }
    kundeRowIndex = kunde.rowIndex;
    kundeProfile = await getKundeProfile(kunde.rowIndex);
    const credits = getCreditsState(kundeProfile);
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

  // ── 1) Scrapen ──
  let candidates: Candidate[];
  try {
    candidates = await scrapeTikTok(apifyToken, product, count);
  } catch (e) {
    console.error("[video-scout] scrape failed:", e);
    const timedOut = e instanceof Error && /timeout|abort/i.test(e.message);
    return NextResponse.json(
      {
        error: timedOut
          ? "Die Suche hat zu lange gedauert. Versuche es mit einem genaueren Produktnamen erneut."
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

  // ── 2) Relevanz filtern (KI entscheidet nur, WAS passt) ──
  const client = new Anthropic({ apiKey: anthropicKey });
  const relevantIdx = await filterRelevant(client, product, candidates);
  const relevant = relevantIdx.map((i) => candidates[i]).filter(Boolean);
  if (relevant.length === 0) {
    return NextResponse.json(
      {
        error: "Keine eindeutig passenden Videos gefunden. Es wurden keine Credits abgezogen.",
        videos_found: [],
      },
      { status: 404 },
    );
  }

  // ── 3) Nach ECHTEN Views sortieren + auf gewünschte Menge kürzen ──
  const top = relevant
    .slice()
    .sort((a, b) => b.views - a.views)
    .slice(0, count);

  const videos_found: ScoutVideo[] = top.map((c) => ({
    url: c.url,
    platform: "TikTok",
    view_count: c.views,
    formatted_views: formatViews(c.views),
    title_snippet: c.caption.slice(0, 50),
    thumbnail: c.thumbnail || undefined,
    author: c.author || undefined,
    likes: c.likes || undefined,
  }));

  // ── 4) Credits abziehen (erst jetzt, wo wir ≥1 Video liefern) ──
  let creditsRemaining: number | undefined;
  if (kundeRowIndex !== null && kundeProfile !== null) {
    try {
      const result = await deductCredits(kundeRowIndex, kundeProfile, cost, "video-scout");
      if (!result.success) {
        return NextResponse.json(
          {
            error: `Nicht genug Credits — die Suche kostet ${cost}.`,
            creditsRemaining: result.remaining,
          },
          { status: 402 },
        );
      }
      creditsRemaining = result.remaining;
    } catch (e) {
      console.error("[video-scout] deduct failed:", e);
      return NextResponse.json({ error: "Abrechnung fehlgeschlagen." }, { status: 500 });
    }
  }

  // Antwort hält das Agent-Schema (product/requested_videos/credits_used/
  // tier_status/videos_found) ein; creditsRemaining ist ein App-Extra,
  // damit die Credits-Pille sofort aktualisiert.
  return NextResponse.json(
    {
      product,
      requested_videos: count,
      credits_used: cost,
      tier_status: "Premium Search",
      videos_found,
      creditsRemaining,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
