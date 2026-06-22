// ─── User-Umfrage (System-Verbesserung) ─────────────────────────
// Client-safe: kein Server-Import. Wird von der Home-Umfrage-Karte, der
// Submit-Route UND der Admin-Auswertung geteilt, damit Fragen-IDs/Labels
// überall identisch sind.
//
// Antworten werden pro Abgabe als JSON gespeichert (siehe sheets.ts
// addSurveyResponse). Erhöhe SURVEY_VERSION, wenn sich die Fragen ändern —
// so kann man später Antworten nach Fragebogen-Version trennen.

export const SURVEY_VERSION = "v1";

export type SurveyQuestionType = "rating" | "single" | "multi" | "text";

export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  label: string;
  hint?: string;
  /** Für single/multi. */
  options?: string[];
  required?: boolean;
}

export const SURVEY_QUESTIONS: readonly SurveyQuestion[] = [
  {
    id: "satisfaction",
    type: "rating",
    label: "Wie zufrieden bist du insgesamt mit Brospify?",
    hint: "1 = gar nicht · 5 = sehr zufrieden",
    required: true,
  },
  {
    id: "recommend",
    type: "rating",
    label: "Wie wahrscheinlich empfiehlst du Brospify weiter?",
    hint: "1 = eher nicht · 5 = auf jeden Fall",
  },
  {
    id: "focus",
    type: "multi",
    label: "Woran sollen wir als Nächstes arbeiten?",
    hint: "Mehrfachauswahl möglich",
    options: [
      "Mehr Winning-Produkte",
      "Video Scout",
      "AI Studio (Produktfotos)",
      "Background Remover / Upscaler",
      "Theme & Design",
      "Geschwindigkeit & Stabilität",
      "Mehr Tutorials / Anleitungen",
      "Günstigere Preise / mehr Credits",
    ],
  },
  {
    id: "mostUsed",
    type: "single",
    label: "Welches Tool nutzt du am meisten?",
    options: [
      "Produkt-Drop",
      "Video Scout",
      "AI Studio",
      "Background Remover",
      "Image Upscaler",
      "E-Mail-Generator",
    ],
  },
  {
    id: "missing",
    type: "text",
    label: "Was fehlt dir oder was sollen wir verbessern?",
    hint: "Optional — dein Vorschlag hilft uns am meisten.",
  },
];

/** Antworten einer Abgabe: questionId → Wert (Zahl, Text oder Liste). */
export type SurveyAnswers = Record<string, number | string | string[]>;

export interface SurveyResponseRecord {
  id: string;
  /** Lizenzschlüssel oder E-Mail — nur in der Admin-Auswertung sichtbar. */
  user: string;
  submittedAt: string;
  answers: SurveyAnswers;
}

export interface SurveyAggregate {
  total: number;
  /** Ø pro Rating-Frage (null, wenn keine Antworten). */
  ratingAvg: Record<string, number | null>;
  /** Verteilung pro Option (single/multi). */
  optionCounts: Record<string, Record<string, number>>;
  /** Freitext-Antworten pro Text-Frage (neueste zuerst). */
  texts: Record<string, string[]>;
}

/** Validiert + säubert eingehende Antworten gegen die Fragen-Definition. */
export function sanitizeAnswers(input: unknown): SurveyAnswers {
  const out: SurveyAnswers = {};
  if (!input || typeof input !== "object") return out;
  const raw = input as Record<string, unknown>;
  for (const q of SURVEY_QUESTIONS) {
    const v = raw[q.id];
    if (v === undefined || v === null) continue;
    if (q.type === "rating") {
      const n = Math.round(Number(v));
      if (Number.isFinite(n) && n >= 1 && n <= 5) out[q.id] = n;
    } else if (q.type === "single") {
      const s = String(v);
      if (q.options?.includes(s)) out[q.id] = s;
    } else if (q.type === "multi") {
      const arr = Array.isArray(v) ? v.map(String).filter((x) => q.options?.includes(x)) : [];
      if (arr.length > 0) out[q.id] = Array.from(new Set(arr));
    } else if (q.type === "text") {
      const s = String(v).trim().slice(0, 1000);
      if (s) out[q.id] = s;
    }
  }
  return out;
}

/** Alle Pflichtfragen beantwortet? */
export function hasRequiredAnswers(answers: SurveyAnswers): boolean {
  return SURVEY_QUESTIONS.every((q) => !q.required || answers[q.id] !== undefined);
}

/** Aggregiert eine Liste von Abgaben für die Admin-Gesamtansicht. */
export function aggregateSurvey(records: SurveyResponseRecord[]): SurveyAggregate {
  const ratingSum: Record<string, { sum: number; n: number }> = {};
  const optionCounts: Record<string, Record<string, number>> = {};
  const texts: Record<string, string[]> = {};

  for (const q of SURVEY_QUESTIONS) {
    if (q.type === "rating") ratingSum[q.id] = { sum: 0, n: 0 };
    if (q.type === "single" || q.type === "multi") {
      optionCounts[q.id] = {};
      for (const o of q.options || []) optionCounts[q.id][o] = 0;
    }
    if (q.type === "text") texts[q.id] = [];
  }

  for (const rec of records) {
    for (const q of SURVEY_QUESTIONS) {
      const v = rec.answers[q.id];
      if (v === undefined) continue;
      if (q.type === "rating" && typeof v === "number") {
        ratingSum[q.id].sum += v;
        ratingSum[q.id].n += 1;
      } else if (q.type === "single" && typeof v === "string") {
        optionCounts[q.id][v] = (optionCounts[q.id][v] || 0) + 1;
      } else if (q.type === "multi" && Array.isArray(v)) {
        for (const o of v) optionCounts[q.id][o] = (optionCounts[q.id][o] || 0) + 1;
      } else if (q.type === "text" && typeof v === "string") {
        texts[q.id].push(v);
      }
    }
  }

  const ratingAvg: Record<string, number | null> = {};
  for (const [id, { sum, n }] of Object.entries(ratingSum)) {
    ratingAvg[id] = n > 0 ? Math.round((sum / n) * 10) / 10 : null;
  }

  return { total: records.length, ratingAvg, optionCounts, texts };
}
