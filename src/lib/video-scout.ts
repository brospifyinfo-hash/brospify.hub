// ─── Video Scout — shared types & helpers (client-safe) ────
// Kein Server-Import — wird von der API-Route UND der Client-Seite
// genutzt.
//
// Wichtig fürs Vertrauen: die ECHTEN View-Counts kommen vom Apify-
// TikTok-Scraper. Die KI filtert ausschliesslich die RELEVANZ ("zeigt
// das Video zweifelsfrei das Produkt?"). Sortierung nach Views und die
// Formatierung passieren deterministisch hier/im Code — so kann das
// Modell niemals Zahlen erfinden.

import { CREDIT_COSTS } from "./credit-costs";

/** Erlaubte Mengen + zugehörige Credit-Kosten (Premium-Search-Tiers).
 *  Bewusst klein gehalten (1–3): pro Suche laufen jetzt mehrere Apify-
 *  Runs (TikTok + Instagram Reels + YouTube Shorts), darum lieber wenige,
 *  dafür starke Videos. */
export const VIDEO_SCOUT_TIERS = [
  { count: 1, cost: CREDIT_COSTS.VIDEO_SCOUT_1 },
  { count: 2, cost: CREDIT_COSTS.VIDEO_SCOUT_2 },
  { count: 3, cost: CREDIT_COSTS.VIDEO_SCOUT_3 },
] as const;

export type VideoCount = (typeof VIDEO_SCOUT_TIERS)[number]["count"];

export function isVideoCount(n: unknown): n is VideoCount {
  return n === 1 || n === 2 || n === 3;
}

export function costForCount(count: VideoCount): number {
  return (
    VIDEO_SCOUT_TIERS.find((t) => t.count === count)?.cost ??
    CREDIT_COSTS.VIDEO_SCOUT_1
  );
}

// ─── Viralitäts-Schwellen & Qualitäts-Gates ──────────────────────
// Unter VIDEO_VIRAL_MIN gilt ein Video als "schwach" (weniger als 10k
// Views). VIDEO_INCLUDE_MIN hält offensichtlichen Müll komplett raus.
export const VIDEO_VIRAL_MIN = 10_000;
export const VIDEO_INCLUDE_MIN = 1_000;

// Findet die Suche MEHR als so viele schwache Videos (< VIDEO_VIRAL_MIN),
// ist der Pool zu schlecht → wir liefern nichts und bitten, es später
// erneut zu versuchen (kein Credit-Abzug).
export const LOW_VIEW_RETRY_THRESHOLD = 5;

/** Halb-Preis-Regel: enthält das gelieferte Set mindestens ein Video
 *  unter der Viral-Schwelle, zahlt der Kunde nur die HÄLFTE der Credits.
 *  Sonst den vollen Preis. */
export function chargedCredits(totalCost: number, hasWeakVideo: boolean): number {
  return hasWeakVideo ? Math.round(totalCost / 2) : totalCost;
}

/** Ein gefundenes Video im finalen Ausgabe-Schema. Die ersten fünf
 *  Felder entsprechen 1:1 dem Agent-Output-Format; thumbnail/author/
 *  likes sind App-Extras fürs UI. */
export interface ScoutVideo {
  url: string;
  platform: "TikTok" | "Instagram" | "YouTube";
  view_count: number;
  formatted_views: string;
  title_snippet: string;
  thumbnail?: string;
  author?: string;
  likes?: number;
  /** True, wenn das Video unter der Viral-Schwelle (10k Views) lag —
   *  ein solches "schwaches" Video löst die Halb-Preis-Regel aus. */
  refunded?: boolean;
}

/** Ein beim Kunden gespeichertes Video (Historie + Dedupe-Quelle). */
export interface SavedScoutVideo extends ScoutVideo {
  productId: string;
  savedAt: string;
}

export interface ScoutResult {
  product: string;
  requested_videos: number;
  credits_used: number;
  tier_status: string;
  videos_found: ScoutVideo[];
}

/** Schlanke Produkt-Projektion für die Auswahl-Liste im Scout. Quelle
 *  sind die vom Account im Produkt-Drop gezogenen Produkte (bzw. der
 *  gesamte Katalog für Admins). */
export interface ScoutProduct {
  id: string;
  titel: string;
  bildUrl: string;
  sku: string;
}

/** Kompakte View-Formatierung: 1500000 → "1.5M", 23400 → "23.4K". */
export function formatViews(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000_000) return `${trimZero(n / 1_000_000_000)}B`;
  if (n >= 1_000_000) return `${trimZero(n / 1_000_000)}M`;
  if (n >= 1_000) return `${trimZero(n / 1_000)}K`;
  return String(Math.round(n));
}

function trimZero(v: number): string {
  // Eine Nachkommastelle, aber ein nachgestelltes ".0" weglassen
  // (1.0M → 1M).
  const s = v.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}
