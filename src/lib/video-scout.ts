// ─── Viral Video Scout — shared types & helpers (client-safe) ────
// Kein Server-Import — wird von der API-Route UND der Client-Seite
// genutzt.
//
// Wichtig fürs Vertrauen: die ECHTEN View-Counts kommen vom Apify-
// TikTok-Scraper. Die KI filtert ausschliesslich die RELEVANZ ("zeigt
// das Video zweifelsfrei das Produkt?"). Sortierung nach Views und die
// Formatierung passieren deterministisch hier/im Code — so kann das
// Modell niemals Zahlen erfinden.

import { CREDIT_COSTS } from "./credit-costs";

/** Erlaubte Mengen + zugehörige Credit-Kosten (Premium-Search-Tiers). */
export const VIDEO_SCOUT_TIERS = [
  { count: 3, cost: CREDIT_COSTS.VIDEO_SCOUT_3 },
  { count: 6, cost: CREDIT_COSTS.VIDEO_SCOUT_6 },
  { count: 9, cost: CREDIT_COSTS.VIDEO_SCOUT_9 },
] as const;

export type VideoCount = (typeof VIDEO_SCOUT_TIERS)[number]["count"];

export function isVideoCount(n: unknown): n is VideoCount {
  return n === 3 || n === 6 || n === 9;
}

export function costForCount(count: VideoCount): number {
  return (
    VIDEO_SCOUT_TIERS.find((t) => t.count === count)?.cost ??
    CREDIT_COSTS.VIDEO_SCOUT_3
  );
}

/** Credits, die ein einzelnes Video kostet — Basis für die Gutschrift,
 *  wenn ein Video unter der Viral-Schwelle bleibt. */
export function perVideoCost(count: VideoCount): number {
  return Math.round(costForCount(count) / count);
}

// ─── Viralitäts-Schwellen ────────────────────────────────────────
// Unter VIDEO_VIRAL_MIN gilt ein Video als "nicht viral genug": es wird
// dem Kunden gutgeschrieben. Findet sich GAR kein Video ≥ dieser Grenze,
// sucht das System erst gar nicht weiter ("Produkt geht aktuell nicht
// viral"). VIDEO_INCLUDE_MIN hält offensichtlichen Müll komplett raus.
export const VIDEO_VIRAL_MIN = 10_000;
export const VIDEO_INCLUDE_MIN = 1_000;

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
  /** True, wenn das Video unter der Viral-Schwelle lag und dem Kunden
   *  dafür Credits gutgeschrieben wurden. */
  refunded?: boolean;
  /** Wie viele Credits für dieses Video gutgeschrieben wurden. */
  refundAmount?: number;
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
