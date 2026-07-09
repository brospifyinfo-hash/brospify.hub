import "server-only";
// ─── Bro-Maskottchen: Admin-anpassbare Avatar-Bilder für den AI Co-Pilot ─
// 3 Gruppen à max. 3 Bilder: idle (AI macht nichts) · thinking (AI plant) ·
// working (AI setzt um). Die AI-Leiste zeigt Bro passend zum Zustand und
// rotiert die Bilder. Persistiert im Settings-Store (Key bro_mascot_v1).
// Fehler-tolerant: leerer Default → die Leiste zeigt dann Emoji-Fallbacks.

import { getAdminSetting, setAdminSetting } from "@/lib/sheets";

const SETTING_KEY = "bro_mascot_v1";
const TTL_MS = 60_000; // Lese-Cache pro Lambda-Instanz
const MAX_PER_GROUP = 3;

export interface BroMascotConfig {
  idle: string[];
  thinking: string[];
  working: string[];
}

const EMPTY: BroMascotConfig = { idle: [], thinking: [], working: [] };

let cache: { at: number; cfg: BroMascotConfig } | null = null;

/** Nur echte http(s)-URLs (Vercel-Blob-Uploads), max. 3 pro Gruppe. */
function sanitizeUrls(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u) && u.length <= 2000)
    .slice(0, MAX_PER_GROUP);
}

function normalize(raw: unknown): BroMascotConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    idle: sanitizeUrls(o.idle),
    thinking: sanitizeUrls(o.thinking),
    working: sanitizeUrls(o.working),
  };
}

/** Aktuelle Maskottchen-Bilder (immer ein gültiges Objekt, ggf. leere Arrays). */
export async function getBroMascot(): Promise<BroMascotConfig> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.cfg;
  let cfg = EMPTY;
  try {
    const raw = await getAdminSetting(SETTING_KEY);
    if (raw) cfg = normalize(JSON.parse(raw));
  } catch {
    /* nie fatal — leerer Default */
  }
  cache = { at: Date.now(), cfg };
  return cfg;
}

/** Admin-Speichern: validiert die URLs und persistiert (gibt die bereinigte
 *  Config zurück). */
export async function setBroMascot(input: unknown): Promise<BroMascotConfig> {
  const cfg = normalize(input);
  await setAdminSetting(SETTING_KEY, JSON.stringify(cfg));
  cache = { at: Date.now(), cfg };
  return cfg;
}
