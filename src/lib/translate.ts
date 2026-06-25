import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import { getTranslationCache, addTranslationEntries } from "@/lib/sheets";
import { anthropicCostUsd, recordUsd } from "@/lib/provider-usage";

// ─────────────────────────────────────────────────────────────────
// KI-Übersetzung mit dauerhaftem Cache.
//
// `translateBatch` ist die Basis: Quell-Phrasen (Deutsch) → Zielsprache.
// Jede einzigartige Phrase wird genau EINMAL per Claude übersetzt und im
// Sheet-Tab „Translations" gecached (Schlüssel = sha1). Danach kostenlos.
//
// `localizeObject` / `localizeArray` laufen rekursiv durch beliebige
// Objekte (z. B. Produkte), sammeln alle menschenlesbaren Strings,
// übersetzen sie gebündelt (dedupliziert) und bauen das Objekt neu auf —
// so wird der KOMPLETTE Inhalt übersetzt, ohne jedes Feld einzeln zu
// pflegen. Fail-safe: ohne API-Key oder bei Fehlern kommt der deutsche
// Originaltext zurück (die Seite bricht nie).
// ─────────────────────────────────────────────────────────────────

export type Lang = "de" | "en";

const MODEL = "claude-sonnet-4-6";

function hash(text: string): string {
  return crypto.createHash("sha1").update(text).digest("hex").slice(0, 16);
}

// Warm-Cache pro Lambda-Instanz, damit nicht bei jedem Request der ganze
// Translations-Tab neu gelesen wird (60s TTL).
const warm: Record<string, { map: Map<string, string>; ts: number }> = {};
const WARM_TTL_MS = 60_000;

async function loadCache(lang: string): Promise<Map<string, string>> {
  const hit = warm[lang];
  if (hit && Date.now() - hit.ts < WARM_TTL_MS) return hit.map;
  const map = await getTranslationCache(lang);
  warm[lang] = { map, ts: Date.now() };
  return map;
}

async function claudeTranslate(texts: string[], lang: Lang): Promise<string[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || texts.length === 0) return texts;

  const target = lang === "en" ? "English" : "German";
  const system =
    `You are a professional translator for a German e-commerce / dropshipping web app. ` +
    `Translate each input string into natural, fluent ${target}. ` +
    `Keep the same tone and meaning. Do NOT translate brand names, product/model names, ` +
    `URLs, e-mail addresses, currency amounts or numbers, or placeholders like {name} or %s. ` +
    `Preserve any HTML tags, markdown and line breaks exactly. ` +
    `Return ONLY a JSON object {"translations": string[]} with EXACTLY the same number of ` +
    `items, in the same order as the input. Never add or drop items.`;

  try {
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "disabled" },
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: { translations: { type: "array", items: { type: "string" } } },
            required: ["translations"],
            additionalProperties: false,
          },
        },
      },
      system,
      messages: [{ role: "user", content: JSON.stringify(texts) }],
    });
    await recordUsd("anthropic", anthropicCostUsd(MODEL, msg.usage));
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const parsed = JSON.parse(text) as { translations?: unknown };
    const arr = parsed.translations;
    if (Array.isArray(arr) && arr.length === texts.length) {
      return arr.map((v, i) => (typeof v === "string" && v.trim() ? v : texts[i]));
    }
  } catch (err) {
    console.error("[translate] Claude failed:", err);
  }
  return texts; // Fallback: Original
}

/** Übersetzt eine Liste von Strings (dedupliziert + gecached). */
export async function translateBatch(texts: string[], lang: Lang): Promise<string[]> {
  const inputs = texts.map((t) => (t == null ? "" : String(t)));
  if (lang === "de") return inputs; // Deutsch = Quellsprache

  // Eindeutige, nicht-leere Phrasen bestimmen.
  const uniq = Array.from(new Set(inputs.filter((t) => t.trim())));
  if (uniq.length === 0) return inputs;

  const cache = await loadCache(lang);
  const misses = uniq.filter((t) => !cache.has(hash(t)));

  if (misses.length > 0) {
    const translated = await claudeTranslate(misses, lang);
    const toWrite: { key: string; source: string; value: string }[] = [];
    misses.forEach((src, i) => {
      const value = translated[i] ?? src;
      const k = hash(src);
      cache.set(k, value);
      if (value !== src) toWrite.push({ key: k, source: src, value });
    });
    try {
      await addTranslationEntries(lang, toWrite);
    } catch (err) {
      console.error("[translate] cache write failed:", err);
    }
  }

  return inputs.map((t) => (t.trim() ? cache.get(hash(t)) ?? t : t));
}

// ─── Generischer Objekt-Walker ───────────────────────────────────

// Felder, deren Werte NICHT übersetzt werden (URLs, IDs, Codes, Zahlen …).
const SKIP_KEYS = new Set([
  "id", "sku", "url", "link", "links", "href", "bildUrl", "imageUrl", "image",
  "images", "aliExpressLink", "previewImageUrl", "youtubeUrl", "thumbnail",
  "monat", "preis", "price", "color", "icon", "platform", "type", "status",
  "key", "slug", "email", "lang", "language", "currency", "code",
]);

function isTranslatable(key: string, val: string): boolean {
  const t = val.trim();
  if (!t || t.length < 2) return false;
  if (SKIP_KEYS.has(key)) return false;
  if (/^https?:\/\//i.test(t)) return false; // URL
  if (/^[\w.-]+@[\w.-]+$/.test(t)) return false; // E-Mail
  if (/^[\d.,%€$\s\-x×/+]+$/.test(t)) return false; // reine Zahl/Preis
  return /\p{L}/u.test(t); // enthält mindestens einen Buchstaben
}

interface Slot {
  value: string;
  set: (v: string) => void;
}

function collect(node: unknown, key: string, slots: Slot[]): void {
  if (Array.isArray(node)) {
    node.forEach((item, i) => {
      if (typeof item === "string") {
        if (isTranslatable(key, item)) slots.push({ value: item, set: (v) => (node[i] = v) });
      } else {
        collect(item, key, slots);
      }
    });
  } else if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (typeof v === "string") {
        if (isTranslatable(k, v)) slots.push({ value: v, set: (nv) => (obj[k] = nv) });
      } else {
        collect(v, k, slots);
      }
    }
  }
}

/** Übersetzt alle menschenlesbaren Strings in einem Array von Objekten
 *  (z. B. Produkten) in EINEM gebündelten, deduplizierten Aufruf. */
export async function localizeArray<T>(items: T[], lang: Lang): Promise<T[]> {
  if (lang === "de" || items.length === 0) return items;
  const clone: T[] = structuredClone(items);
  const slots: Slot[] = [];
  clone.forEach((item) => collect(item, "", slots));
  if (slots.length === 0) return clone;
  const translated = await translateBatch(slots.map((s) => s.value), lang);
  slots.forEach((s, i) => s.set(translated[i]));
  return clone;
}

/** Wie localizeArray, aber für ein einzelnes Objekt. */
export async function localizeObject<T>(obj: T, lang: Lang): Promise<T> {
  if (lang === "de" || obj == null) return obj;
  const [out] = await localizeArray([obj], lang);
  return out;
}
