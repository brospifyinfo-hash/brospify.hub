// ─── Gestaffelte User-Umfragen ──────────────────────────────────
// Client-safe: kein Server-Import. Geteilt von Home-Karte, Submit-Route
// und Admin-Auswertung.
//
// Prinzip: Mehrere Umfragen, die ZEITVERSETZT freigeschaltet werden
// (unlockAfterDays = Tage seit erstem Login / creditsStartedAt). Jede gibt
// beim Abschluss ein paar Credits. Antworten werden pro Abgabe als JSON
// gespeichert (sheets.ts addSurveyResponse), mit der surveyId.

export type SurveyQuestionType = "rating" | "single" | "multi" | "text";

export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  label: string;
  hint?: string;
  options?: string[];
  required?: boolean;
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  /** Credits, die der Abschluss gutschreibt. */
  creditReward: number;
  /** Ab wie vielen Tagen seit erstem Login die Umfrage erscheint. */
  unlockAfterDays: number;
  questions: SurveyQuestion[];
}

// ─── Die Umfragen (5 × 6 = 30 Fragen) ───────────────────────────
export const SURVEYS: readonly Survey[] = [
  {
    id: "welcome",
    title: "Willkommen bei Brospify 👋",
    description: "Erzähl uns kurz, wie du zu uns gefunden hast und was du vorhast.",
    creditReward: 50,
    unlockAfterDays: 0,
    questions: [
      { id: "source", type: "single", label: "Wie hast du von Brospify erfahren?", required: true, options: ["TikTok", "Instagram", "YouTube", "Google-Suche", "Freund / Empfehlung", "Bezahlte Werbung", "Sonstiges"] },
      { id: "reason", type: "single", label: "Was war dein Hauptgrund, Brospify zu testen?", options: ["Winning-Produkte finden", "KI-Produktfotos", "Theme / Shop-Setup", "Komplettlösung an einem Ort", "Einfach mal neugierig"] },
      { id: "experience", type: "single", label: "Wie viel Dropshipping-Erfahrung hast du?", options: ["Kompletter Anfänger", "Etwas Erfahrung", "Erfahren / mache es schon länger"] },
      { id: "goals", type: "multi", label: "Was möchtest du mit Brospify erreichen?", options: ["Ersten Verkauf machen", "Bestehenden Shop skalieren", "Zeit sparen", "Produkte recherchieren", "Bessere Creatives / Bilder"] },
      { id: "revenueGoal", type: "single", label: "Dein aktuelles monatliches Umsatzziel?", options: ["Unter 500 €", "500 – 2.000 €", "2.000 – 10.000 €", "Über 10.000 €", "Weiß noch nicht"] },
      { id: "firstImpression", type: "rating", label: "Wie ist dein erster Eindruck von Brospify?", hint: "1 = schlecht · 5 = top" },
    ],
  },
  {
    id: "onboarding",
    title: "Wie lief dein Start?",
    description: "Du bist jetzt eine Weile dabei — wie war der Einstieg?",
    creditReward: 50,
    unlockAfterDays: 7,
    questions: [
      { id: "easeOfStart", type: "rating", label: "Wie einfach war der Einstieg?", required: true, hint: "1 = kompliziert · 5 = kinderleicht" },
      { id: "themeSetup", type: "single", label: "Konntest du dein Theme im Shop einrichten?", options: ["Ja, problemlos", "Ja, mit etwas Mühe", "Noch nicht", "Brauche Hilfe dabei"] },
      { id: "firstTool", type: "single", label: "Welches Tool hast du zuerst ausprobiert?", options: ["Produkt-Drop", "Video Scout", "AI Studio", "Background Remover", "Theme / Shop"] },
      { id: "mostHelpful", type: "single", label: "Was war bisher am hilfreichsten?", options: ["Produkt-Drop", "Video Scout", "AI Studio", "Background Remover", "Tutorials / Anleitungen"] },
      { id: "lostWhere", type: "multi", label: "Wo hast du dir mehr Anleitung gewünscht?", options: ["Theme-Setup", "Produkt importieren", "Credits-System", "AliExpress / DSERS", "Nirgends — war klar"] },
      { id: "easierStart", type: "text", label: "Was hätte deinen Start einfacher gemacht?", hint: "Optional" },
    ],
  },
  {
    id: "tools",
    title: "Deine Tools im Check",
    description: "Wie gut funktionieren die einzelnen Tools für dich?",
    creditReward: 75,
    unlockAfterDays: 21,
    questions: [
      { id: "ratingDrop", type: "rating", label: "Wie zufrieden bist du mit dem Produkt-Drop?", hint: "1–5" },
      { id: "ratingScout", type: "rating", label: "Wie zufrieden bist du mit dem Video Scout?", hint: "1–5" },
      { id: "ratingStudio", type: "rating", label: "Wie zufrieden bist du mit AI Studio / den Bildern?", hint: "1–5" },
      { id: "mostUsed", type: "single", label: "Welches Tool nutzt du am meisten?", required: true, options: ["Produkt-Drop", "Video Scout", "AI Studio", "Background Remover", "Image Upscaler", "E-Mail-Generator"] },
      { id: "stability", type: "single", label: "Läuft alles flüssig und stabil?", options: ["Ja, alles top", "Meistens", "Oft langsam", "Häufig Fehler"] },
      { id: "improveTool", type: "text", label: "Welches Tool sollen wir verbessern — und wie?", hint: "Optional" },
    ],
  },
  {
    id: "roadmap",
    title: "Woran sollen wir arbeiten?",
    description: "Du entscheidest mit, was wir als Nächstes bauen.",
    creditReward: 75,
    unlockAfterDays: 42,
    questions: [
      { id: "focus", type: "multi", label: "Woran sollen wir als Nächstes arbeiten?", required: true, options: ["Mehr Winning-Produkte", "Video Scout", "AI Studio", "Background Remover / Upscaler", "Theme & Design", "Geschwindigkeit & Stabilität", "Mehr Tutorials", "Günstigere Preise"] },
      { id: "newTool", type: "multi", label: "Welches NEUE Tool wünschst du dir?", options: ["Ad-Creative-Generator", "Konkurrenz-Analyse", "Mehr Produktdaten / Metriken", "Upsell- / Bundle-Tools", "E-Mail-Flows", "TikTok-Trend-Radar"] },
      { id: "missingNiches", type: "single", label: "Fehlen dir Produkte oder Nischen?", options: ["Ja, oft", "Manchmal", "Nein, passt"] },
      { id: "priceFair", type: "single", label: "Sind die Credit-Preise fair?", options: ["Ja, fair", "Geht so", "Zu teuer"] },
      { id: "tutorialsImportance", type: "rating", label: "Wie wichtig sind dir Tutorials / Anleitungen?", hint: "1 = unwichtig · 5 = sehr wichtig" },
      { id: "biggestWish", type: "text", label: "Was ist dein größter Wunsch an Brospify?", hint: "Optional" },
    ],
  },
  {
    id: "satisfaction",
    title: "Wie zufrieden bist du?",
    description: "Dein ehrliches Gesamtfazit — das hilft uns am meisten.",
    creditReward: 100,
    unlockAfterDays: 70,
    questions: [
      { id: "overall", type: "rating", label: "Wie zufrieden bist du insgesamt mit Brospify?", required: true, hint: "1 = gar nicht · 5 = sehr" },
      { id: "recommend", type: "rating", label: "Wie wahrscheinlich empfiehlst du Brospify weiter?", hint: "1 = nie · 5 = auf jeden Fall" },
      { id: "stay", type: "single", label: "Wirst du Mitglied bleiben?", options: ["Ja, auf jeden Fall", "Wahrscheinlich", "Unsicher", "Eher nicht"] },
      { id: "keepsYou", type: "single", label: "Was hält dich am meisten bei Brospify?", options: ["Die Produkte", "Die KI-Tools", "Der Preis / das Gesamtpaket", "Der Support", "Die Community"] },
      { id: "churnRisk", type: "multi", label: "Was würde dich zum Kündigen bringen?", options: ["Zu teuer", "Zu wenig Produkte", "Tools fehlen", "Keine Verkäufe", "Schlechter Support", "Nichts davon"] },
      { id: "finalFeedback", type: "text", label: "Abschließendes Feedback?", hint: "Optional — sag uns alles." },
    ],
  },
];

export type SurveyStatus = "available" | "completed" | "locked";

export type SurveyAnswers = Record<string, number | string | string[]>;

// Hintergrund-Tracking: misst, wie schnell der Nutzer geantwortet hat, um
// „nur schnell durchgeklickt"-Abgaben zu erkennen. Wird clientseitig aus den
// Zeitstempeln der Antworten berechnet und serverseitig verifiziert
// (rushed-Flag wird IMMER server-side neu bestimmt, nie vom Client geglaubt).
export interface SurveyResponseMeta {
  /** Gesamtdauer Start → Absenden (ms). */
  durationMs: number;
  /** Wie viele Fragen beantwortet wurden. */
  answeredCount: number;
  /** Antworten schneller als FAST_GAP_MS nach der vorherigen. */
  fastCount: number;
  /** Median-Abstand zwischen aufeinanderfolgenden Antworten (ms). */
  medianGapMs: number;
  /** Kleinster Abstand zwischen zwei Antworten (ms). */
  minGapMs: number;
  /** Heuristik: wirkt durchgeklickt? (server-side bestimmt) */
  rushed: boolean;
}

// Schwellen fürs „durchgeklickt"-Erkennen. Bewusst streng (lieber einmal zu
// viel markieren) — hier justieren, falls es zu hart/zu lasch greift.
export const FAST_GAP_MS = 1500;            // Antwort < 1,5s nach der vorherigen = „schnell"
const RUSH_MEDIAN_GAP_MS = 2500;            // Median-Abstand darunter = gehetzt
const RUSH_MS_PER_QUESTION = 3500;          // < 3,5s pro Frage gesamt = gehetzt
const RUSH_FAST_FRACTION = 0.34;            // ≥ 1/3 der Antworten schnell = gehetzt

export interface SurveyResponseRecord {
  id: string;
  surveyId: string;
  /** Lizenzschlüssel oder E-Mail — nur in der Admin-Auswertung sichtbar. */
  user: string;
  submittedAt: string;
  answers: SurveyAnswers;
  meta?: SurveyResponseMeta;
}

/** Säubert + verifiziert das Timing-Meta. Bestimmt `rushed` IMMER neu aus
 *  den Metriken (Client-Flag wird ignoriert). */
export function sanitizeMeta(input: unknown, questionCount: number): SurveyResponseMeta | undefined {
  if (!input || typeof input !== "object") return undefined;
  const m = input as Record<string, unknown>;
  const num = (v: unknown) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const durationMs = num(m.durationMs);
  const answeredCount = num(m.answeredCount);
  const fastCount = num(m.fastCount);
  const medianGapMs = num(m.medianGapMs);
  const minGapMs = num(m.minGapMs);
  // „Durchgeklickt", wenn die Antworten im Schnitt schnell kamen ODER die
  // ganze Umfrage unrealistisch kurz war ODER schon ein Drittel der Antworten
  // im Schnellklick-Tempo lag.
  const q = Math.max(1, questionCount);
  const rushed =
    answeredCount > 0 &&
    ((medianGapMs > 0 && medianGapMs < RUSH_MEDIAN_GAP_MS) ||
      (durationMs > 0 && durationMs < q * RUSH_MS_PER_QUESTION) ||
      fastCount >= Math.ceil(q * RUSH_FAST_FRACTION));
  return { durationMs, answeredCount, fastCount, medianGapMs, minGapMs, rushed };
}

export interface SurveyAggregate {
  total: number;
  ratingAvg: Record<string, number | null>;
  optionCounts: Record<string, Record<string, number>>;
  texts: Record<string, string[]>;
}

export function getSurveyById(id: string): Survey | undefined {
  return SURVEYS.find((s) => s.id === id);
}

/** Status einer Umfrage für einen Nutzer. */
export function surveyStatus(
  survey: Survey,
  daysSinceStart: number,
  completedIds: string[],
): SurveyStatus {
  if (completedIds.includes(survey.id)) return "completed";
  if (daysSinceStart >= survey.unlockAfterDays) return "available";
  return "locked";
}

export interface SurveyWithStatus extends Survey {
  status: SurveyStatus;
  /** Tage bis zur Freischaltung (nur wenn locked). */
  unlocksInDays: number;
}

export function surveysWithStatus(
  daysSinceStart: number,
  completedIds: string[],
): SurveyWithStatus[] {
  return SURVEYS.map((s) => ({
    ...s,
    status: surveyStatus(s, daysSinceStart, completedIds),
    unlocksInDays: Math.max(0, Math.ceil(s.unlockAfterDays - daysSinceStart)),
  }));
}

/** Validiert + säubert eingehende Antworten gegen die Fragen einer Umfrage. */
export function sanitizeAnswers(survey: Survey, input: unknown): SurveyAnswers {
  const out: SurveyAnswers = {};
  if (!input || typeof input !== "object") return out;
  const raw = input as Record<string, unknown>;
  for (const q of survey.questions) {
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

export function hasRequiredAnswers(survey: Survey, answers: SurveyAnswers): boolean {
  return survey.questions.every((q) => !q.required || answers[q.id] !== undefined);
}

/** Aggregiert die Antworten EINER Umfrage für die Admin-Gesamtansicht. */
export function aggregateSurvey(survey: Survey, records: SurveyResponseRecord[]): SurveyAggregate {
  const ratingSum: Record<string, { sum: number; n: number }> = {};
  const optionCounts: Record<string, Record<string, number>> = {};
  const texts: Record<string, string[]> = {};

  for (const q of survey.questions) {
    if (q.type === "rating") ratingSum[q.id] = { sum: 0, n: 0 };
    if (q.type === "single" || q.type === "multi") {
      optionCounts[q.id] = {};
      for (const o of q.options || []) optionCounts[q.id][o] = 0;
    }
    if (q.type === "text") texts[q.id] = [];
  }

  for (const rec of records) {
    for (const q of survey.questions) {
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
