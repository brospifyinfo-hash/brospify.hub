"use client";

// ─── Inline-Text-Matching (Sections + Kaufbox-Bausteine) ────────────────────
// Ordnet einen in der Vorschau angeklickten sichtbaren Text dem passenden
// Feld zu — für Doc-Sections (resolveTexts) UND Kaufbox-Bausteine (BUYBOX_LIBRARY
// + BlockConfig.texts). Gemeinsame Normalisierung, damit Vorschau-Text und
// gespeicherter Wert vergleichbar sind.

import { getSectionDef, resolveTexts, getBuyboxLib } from "@/lib/theme-library";
import type { SectionInstance, BlockConfig } from "@/lib/theme-doc";

export interface FieldHit {
  field: string;
  multiline: boolean;
}

/** Einzeilig: NBSP/Whitespace → ein Space, trimmen. */
export function normSingle(s: string): string {
  return s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

/** Mehrzeilig: Zeilenumbrüche BEHALTEN, je Zeile horizontale Whitespaces
 *  kollabieren, Leerzeilen-Ketten begrenzen. */
export function normMulti(s: string): string {
  return s
    .replace(/ /g, " ")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function matchInFields(
  fields: { id: string; kind: string; html?: boolean }[],
  valueOf: (id: string) => string | undefined,
  shown: string,
): FieldHit | null {
  const nSingle = normSingle(shown);
  const nMulti = normMulti(shown);
  for (const f of fields) {
    if (f.kind !== "text" && f.kind !== "textarea") continue;
    if (f.html) continue;
    const val = valueOf(f.id);
    if (typeof val !== "string" || !val.trim() || val.includes("<")) continue;
    const multiline = f.kind === "textarea";
    const key = multiline ? normMulti(val) : normSingle(val);
    if (key === (multiline ? nMulti : nSingle)) return { field: f.id, multiline };
  }
  return null;
}

/** Sichtbaren Text → Feld einer Doc-Section-Instanz. */
export function matchSectionField(inst: SectionInstance, shown: string): FieldHit | null {
  const def = getSectionDef(inst.type);
  if (!def) return null;
  const texts = resolveTexts(inst);
  return matchInFields(def.fields, (id) => texts[id], shown);
}

/** Sichtbaren Text → Feld eines Kaufbox-Bausteins. Werte-Präzedenz EXAKT wie im
 *  Renderer (ThemePreview bt()): gesetzter Text (BlockConfig) ODER produkt-
 *  abgeleiteter Renderer-Fallback ODER Feld-Default. `fallbacks` liefert die
 *  data.*-Fallbacks, die der Renderer je Feld einspeist (sonst Default leer). */
export function matchBlockField(
  type: string,
  cfg: BlockConfig | undefined,
  shown: string,
  fallbacks?: Record<string, string>,
): FieldHit | null {
  const lib = getBuyboxLib(type);
  if (!lib) return null;
  return matchInFields(lib.fields, (id) => {
    const v = cfg?.texts?.[id];
    if (typeof v === "string" && v.trim()) return v;
    return fallbacks?.[id] || lib.fields.find((f) => f.id === id)?.def;
  }, shown);
}
