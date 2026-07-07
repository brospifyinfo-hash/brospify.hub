import "server-only";
// ─── AI-Lernspeicher: die AI bildet sich mit jedem erfolgreichen Lauf weiter ─
// Nach jedem bestätigten Apply werden die WICHTIGEN Entscheidungen des Plans
// (Stil, Hero-/Proof-Section, Icons, Schrift-Paar) pro Produkt-Nische
// aggregiert und im Settings-Store persistiert (Key theme_ai_learn_v1).
// Beim nächsten Plan derselben Nische bekommt die AI dieses Wissen als
// kompakten Kontext-Block — dadurch trifft auch das günstige Standard-Modell
// (Sonnet) von Anfang an die richtigen Entscheidungen, Pläne werden kürzer
// und präziser, und die Credits-/API-Kosten sinken mit der Zeit.
// Alles ist fehler-tolerant: Lernen darf NIE einen Nutzer-Request brechen.

import { getAdminSetting, setAdminSetting } from "@/lib/sheets";
import { SECTION_ROLES } from "@/lib/theme-library";
import type { AiOp } from "@/lib/theme-ai-ops";

const SETTING_KEY = "theme_ai_learn_v1";
const TTL_MS = 60_000; // Lese-Cache pro Lambda-Instanz
// Google-Sheets-Zelle: hartes 50k-Zeichen-Limit. Eine volle Nische belegt
// ~0,9 KB JSON → 40 Nischen ≈ 36k. Zusätzlich sichert MAX_BLOB_CHARS als
// harter Byte-Guard (älteste Nischen fliegen, bis der Blob passt) — sonst
// würde JEDER künftige Save fehlschlagen und das Lernen still sterben.
const MAX_NICHES = 40;
const MAX_BLOB_CHARS = 42_000;
const MAX_COUNTER = 10; // Top-N pro Zähler-Map

type Counter = Record<string, number>;

interface NicheEntry {
  n: number; // Anzahl gelernter Läufe
  style: Counter;
  hero: Counter;
  proof: Counter;
  benefits: Counter;
  icons: Counter;
  fonts: Counter; // "heading|body"
  updated: string; // ISO — für LRU
}

interface LearnStore {
  v: 1;
  niches: Record<string, NicheEntry>;
}

let cache: { at: number; store: LearnStore } | null = null;

const STOPWORDS = new Set([
  "der", "die", "das", "und", "mit", "für", "fuer", "von", "aus", "the", "for",
  "and", "with", "pro", "set", "neu", "new", "premium", "original", "2024",
  "2025", "2026", "stück", "stueck", "pack", "xl", "xxl",
]);

/** Produkt-Titel → stabiler Nischen-Schlüssel (1–2 aussagekräftige Wörter). */
export function nicheKeyFromTitle(title: string): string {
  const words = (title || "")
    .toLowerCase()
    .replace(/[^a-zäöüß0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  if (!words.length) return "allgemein";
  return words.slice(0, 2).join("-");
}

async function loadStore(): Promise<LearnStore> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.store;
  let store: LearnStore = { v: 1, niches: {} };
  try {
    const raw = await getAdminSetting(SETTING_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LearnStore;
      if (parsed && parsed.v === 1 && parsed.niches && typeof parsed.niches === "object") store = parsed;
    }
  } catch {
    /* nie fatal — leerer Store */
  }
  cache = { at: Date.now(), store };
  return store;
}

function bump(c: Counter, key: string): void {
  if (!key) return;
  c[key] = (c[key] || 0) + 1;
  // Deckel: nur die Top-Einträge behalten (Blob klein halten)
  const entries = Object.entries(c).sort((a, b) => b[1] - a[1]);
  if (entries.length > MAX_COUNTER) {
    for (const [k] of entries.slice(MAX_COUNTER)) delete c[k];
  }
}

function top(c: Counter, n = 3): string[] {
  return Object.entries(c)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

/**
 * Kompakter Wissens-Block für den Plan-Prompt (oder null, wenn zur Nische
 * noch nichts gelernt wurde). Bewusst klein (~1 Kurzabsatz) — er landet im
 * User-Content, nicht im gecachten System-Prompt.
 */
export async function getLearnHints(productTitle: string): Promise<string | null> {
  try {
    const store = await loadStore();
    const key = nicheKeyFromTitle(productTitle);
    let entry = store.niches[key];
    if (!entry) {
      // Fallback: Nische über das erste Titel-Wort suchen (z. B. "hundebett-plüsch" ↔ "hundebett")
      const first = key.split("-")[0];
      const alt = Object.keys(store.niches).find((k) => k === first || k.startsWith(first + "-"));
      if (alt) entry = store.niches[alt];
    }
    if (!entry || entry.n < 1) return null;
    const parts: string[] = [];
    const styles = top(entry.style, 2);
    if (styles.length) parts.push(`bewährte Stile: ${styles.join(", ")}`);
    const heroes = top(entry.hero, 2);
    if (heroes.length) parts.push(`Hero: ${heroes.join(" oder ")}`);
    const proofs = top(entry.proof, 2);
    if (proofs.length) parts.push(`Social Proof: ${proofs.join(" oder ")}`);
    const bens = top(entry.benefits, 2);
    if (bens.length) parts.push(`Vorteile: ${bens.join(" oder ")}`);
    const icons = top(entry.icons, 6);
    if (icons.length) parts.push(`Icons, die gut ankamen: ${icons.join(", ")}`);
    const fonts = top(entry.fonts, 2).map((f) => f.replace("|", " + "));
    if (fonts.length) parts.push(`Schrift-Paare: ${fonts.join(" oder ")}`);
    if (!parts.length) return null;
    return `Nische „${key}" (${entry.n} frühere Läufe): ${parts.join("; ")}.`;
  } catch {
    return null;
  }
}

/**
 * Lernt aus einem BESTÄTIGTEN Plan (apply-Route). Fehler werden geschluckt —
 * der Nutzer-Request ist längst erfolgreich, Lernen ist Bonus.
 */
export async function learnFromApply(productTitle: string, ops: AiOp[]): Promise<void> {
  try {
    if (!productTitle || !ops.length) return;
    const store = await loadStore();
    const key = nicheKeyFromTitle(productTitle);
    const entry: NicheEntry = store.niches[key] || {
      n: 0, style: {}, hero: {}, proof: {}, benefits: {}, icons: {}, fonts: {},
      updated: new Date().toISOString(),
    };
    entry.n += 1;
    entry.updated = new Date().toISOString();
    let heading = "";
    let body = "";
    for (const op of ops) {
      switch (op.op) {
        case "set_style":
          bump(entry.style, op.styleId);
          break;
        case "add_section": {
          const role = SECTION_ROLES[op.type];
          if (role === "hero") bump(entry.hero, op.type);
          else if (role === "proof") bump(entry.proof, op.type);
          else if (role === "benefits") bump(entry.benefits, op.type);
          break;
        }
        case "set_benefit_icons":
          for (const ic of op.icons) bump(entry.icons, ic);
          break;
        case "set_section_setting":
          if (op.key.startsWith("icon_")) bump(entry.icons, op.value);
          break;
        case "set_fonts":
          heading = op.headingFont || heading;
          body = op.bodyFont || body;
          break;
        default:
          break;
      }
    }
    if (heading || body) bump(entry.fonts, `${heading || "?"}|${body || "?"}`);
    store.niches[key] = entry;
    // LRU-Deckel: älteste Nischen fliegen raus — erst nach Anzahl, dann als
    // harter Byte-Guard gegen das 50k-Zellen-Limit (Blob muss IMMER passen).
    const oldestFirst = () =>
      Object.keys(store.niches).sort(
        (a, b) => (store.niches[a].updated || "").localeCompare(store.niches[b].updated || ""),
      );
    let keys = oldestFirst();
    if (keys.length > MAX_NICHES) {
      for (const k of keys.slice(0, keys.length - MAX_NICHES)) delete store.niches[k];
    }
    let blob = JSON.stringify(store);
    while (blob.length > MAX_BLOB_CHARS) {
      keys = oldestFirst();
      if (keys.length <= 1) break; // die aktuelle Nische behalten wir immer
      delete store.niches[keys[0]];
      blob = JSON.stringify(store);
    }
    await setAdminSetting(SETTING_KEY, blob);
    cache = { at: Date.now(), store };
  } catch (e) {
    console.warn("[theme-ai-learn] Lernen übersprungen:", e);
  }
}
