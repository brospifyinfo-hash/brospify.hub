// ─── Video-Scout-Cache: wöchentlicher Link-Check & Prune ─────────
// Einmal pro Woche werden die im gemeinsamen ScoutCache gespeicherten
// Video-Links geprüft. Ist ein Video nachweislich weg, fliegt es AUS DEM
// CACHE (damit es kein neuer Kunde mehr gezogen bekommt). Die bereits bei
// Kunden gespeicherten Videos (profile.scoutVideos) werden NICHT angefasst
// — der Kunde sieht sein gezogenes Video weiter, nur der Link ist dann tot.
//
// Aufgehängt am täglichen `expire-overdue`-Cron (Vercel-Hobby erlaubt
// keinen 3. Cron). Ein Settings-State drosselt auf ~wöchentlich und merkt
// sich per Cursor, wo ein grosser Cache fortgesetzt werden muss, damit ein
// einzelner Lauf das Zeitbudget nicht sprengt.

import {
  listScoutCacheEntries,
  setScoutCacheVideos,
  getAdminSetting,
  setAdminSetting,
} from "./sheets";
import type { ScoutVideo } from "./video-scout";

const STATE_KEY = "scoutCachePruneState";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Sicherheits-Deckel pro Lauf, damit wir unter dem Funktions-Timeout
// bleiben. Reicht der Cache nicht in einen Lauf, macht der nächste (tägl.)
// Cron via Cursor weiter, bis der Voll-Durchlauf fertig ist.
const MAX_CHECKS_PER_RUN = 120;
const CONCURRENCY = 12;
const CHECK_TIMEOUT_MS = 4000;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

interface PruneState {
  /** Letzter KOMPLETT abgeschlossener Wochen-Durchlauf. */
  lastFullRunAt?: string;
  /** Resume-Cursor — gesetzt, solange ein Voll-Durchlauf noch läuft. */
  cursorProductId?: string;
  /** Letzter Lauf (auch ein Teil-Lauf), für die Admin-Anzeige. */
  lastRunAt?: string;
  lastChecked?: number;
  lastRemoved?: number;
  /** Kumulativ entfernte tote Links über alle Läufe. */
  totalRemoved?: number;
}

export interface PruneResult {
  ran: boolean;
  reason?: string;
  checked?: number;
  removed?: number;
  completed?: boolean;
}

export interface ScoutCacheStatus {
  products: number;
  videos: number;
  lastFullRunAt: string | null;
  lastRunAt: string | null;
  lastChecked: number;
  lastRemoved: number;
  totalRemoved: number;
  inProgress: boolean;
  nextDueAt: string | null;
}

async function readState(): Promise<PruneState> {
  try {
    const raw = await getAdminSetting(STATE_KEY);
    if (raw) return JSON.parse(raw) as PruneState;
  } catch {
    /* defekter State → frisch starten */
  }
  return {};
}

/** Status für die Admin-Anzeige: Cache-Grösse + letzter/​nächster Lauf. */
export async function getScoutCacheStatus(): Promise<ScoutCacheStatus> {
  const state = await readState();
  const entries = await listScoutCacheEntries();
  return {
    products: entries.length,
    videos: entries.reduce((s, e) => s + e.videos.length, 0),
    lastFullRunAt: state.lastFullRunAt ?? null,
    lastRunAt: state.lastRunAt ?? null,
    lastChecked: state.lastChecked ?? 0,
    lastRemoved: state.lastRemoved ?? 0,
    totalRemoved: state.totalRemoved ?? 0,
    inProgress: !!state.cursorProductId,
    nextDueAt: state.lastFullRunAt
      ? new Date(Date.parse(state.lastFullRunAt) + WEEK_MS).toISOString()
      : null,
  };
}

// Liefert TRUE nur bei einem KLAREN „weg"-Signal. Bei Timeout/Netzfehler/
// Bot-Blockade (unsicher) geben wir FALSE zurück — wir löschen lieber zu
// wenig als ein noch lebendes Video aus dem Cache zu werfen.
async function isDead(video: ScoutVideo): Promise<boolean> {
  const url = video.url;
  if (!url) return false;
  try {
    if (video.platform === "TikTok") {
      // TikTok-oEmbed: existiert das Video nicht (mehr), kommt 404.
      const r = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
        { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS), headers: { "User-Agent": UA } },
      );
      return r.status === 404;
    }
    if (video.platform === "YouTube") {
      // YouTube-oEmbed: 404 = gelöscht, 401 = privat/gesperrt.
      const r = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
        { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS), headers: { "User-Agent": UA } },
      );
      return r.status === 404 || r.status === 401;
    }
    // Instagram & Sonstige: kein verlässliches oEmbed → direkter Aufruf,
    // nur eindeutige 404/410 zählen als tot.
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      headers: { "User-Agent": UA },
    });
    return r.status === 404 || r.status === 410;
  } catch {
    return false;
  }
}

/** Tote-Flags für eine Video-Liste mit begrenzter Parallelität. */
async function deadFlags(videos: ScoutVideo[]): Promise<boolean[]> {
  const out = new Array<boolean>(videos.length).fill(false);
  let cursor = 0;
  async function worker() {
    while (cursor < videos.length) {
      const i = cursor++;
      out[i] = await isDead(videos[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, videos.length) }, () => worker()),
  );
  return out;
}

/** Wöchentlich (gedrosselt) den ScoutCache auf tote Links prüfen und diese
 *  entfernen. Nie fatal — Fehler werden geloggt, nicht geworfen.
 *  `force` (Admin-Button) umgeht die Wochen-Drossel. */
export async function maybePruneScoutCache(force = false): Promise<PruneResult> {
  const state = await readState();

  const now = Date.now();
  const last = state.lastFullRunAt ? Date.parse(state.lastFullRunAt) : 0;
  const due = force || !!state.cursorProductId || !last || now - last >= WEEK_MS;
  if (!due) return { ran: false, reason: "not_due" };

  const entries = await listScoutCacheEntries();
  const nowIso = new Date().toISOString();
  if (entries.length === 0) {
    await setAdminSetting(
      STATE_KEY,
      JSON.stringify({
        lastFullRunAt: nowIso,
        lastRunAt: nowIso,
        lastChecked: 0,
        lastRemoved: 0,
        totalRemoved: state.totalRemoved ?? 0,
      }),
    );
    return { ran: true, checked: 0, removed: 0, completed: true };
  }

  let startIdx = 0;
  if (state.cursorProductId) {
    const i = entries.findIndex((e) => e.productId === state.cursorProductId);
    startIdx = i >= 0 ? i : 0;
  }

  let checked = 0;
  let removed = 0;
  let completed = true;
  let nextCursor: string | undefined;

  for (let i = startIdx; i < entries.length; i++) {
    if (checked >= MAX_CHECKS_PER_RUN) {
      completed = false;
      nextCursor = entries[i].productId;
      break;
    }
    const entry = entries[i];
    if (entry.videos.length === 0) continue;
    let flags: boolean[];
    try {
      flags = await deadFlags(entry.videos);
    } catch (e) {
      console.warn(`[scout-prune] check failed for ${entry.productId}:`, e);
      continue;
    }
    checked += entry.videos.length;
    const alive = entry.videos.filter((_, idx) => !flags[idx]);
    if (alive.length !== entry.videos.length) {
      removed += entry.videos.length - alive.length;
      try {
        await setScoutCacheVideos(entry.rowNumber, entry.productId, alive);
      } catch (e) {
        console.warn(`[scout-prune] write failed for ${entry.productId}:`, e);
      }
    }
  }

  const newState: PruneState = {
    lastFullRunAt: completed ? nowIso : state.lastFullRunAt,
    cursorProductId: completed ? undefined : nextCursor,
    lastRunAt: nowIso,
    lastChecked: checked,
    lastRemoved: removed,
    totalRemoved: (state.totalRemoved ?? 0) + removed,
  };
  try {
    await setAdminSetting(STATE_KEY, JSON.stringify(newState));
  } catch (e) {
    console.warn("[scout-prune] state save failed:", e);
  }

  return { ran: true, checked, removed, completed };
}
