import "server-only";
import {
  PRODUCT_COPY_SPEC,
  ENGLISH_EXAMPLES,
  coerceToSpec,
  type ThemeCopy,
} from "@/lib/theme-placeholders";

// ─────────────────────────────────────────────────────────────────
// Maker-Checker-KI-Pipeline für die Produkt-Theme-Texte — via DeepSeek.
//
//   1. Creator   → generiert verkaufsstarke Platzhalter-Texte (JSON, Keys =
//                  exakt unsere Theme-Platzhalter).
//   2. Validator → prüft den Entwurf gegen Best-Practice-Beispiele und gibt
//                  {isValid, feedback, correctedJson} zurück.
//
// DeepSeek-Chat (api.deepseek.com) im JSON-Modus (`response_format:
// json_object`). Robustes Parsing + coerceToSpec füllt fehlende Keys, sodass
// das Theme nie mit unvollständigen Texten endet.
// ─────────────────────────────────────────────────────────────────

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";

export interface CopyPipelineInput {
  name: string;
  brief?: string;
}

export interface CopyPipelineResult {
  draft: ThemeCopy;
  isValid: boolean;
  feedback: string;
  copy: ThemeCopy; // finales correctedJson → wird gespeichert
}

async function deepseekJson(
  system: string,
  user: string,
  temperature: number,
): Promise<Record<string, unknown>> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY fehlt — KI-Theme-Texte nicht verfügbar.");

  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DeepSeek-Fehler ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content || "";
  if (!content.trim()) throw new Error("DeepSeek lieferte eine leere Antwort.");

  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    // json_object liefert eigentlich valides JSON — als Fallback erstes {…} schneiden.
    const m = content.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as Record<string, unknown>;
    throw new Error("DeepSeek-Antwort war kein gültiges JSON.");
  }
}

// ─────────────────────────── Creator ──────────────────────────────

async function runCreator(input: CopyPipelineInput): Promise<ThemeCopy> {
  const keyList = PRODUCT_COPY_SPEC.map((s) => `  "${s.key}": ${s.hint}`).join("\n");
  const system = [
    "Du bist ein weltklasse Direct-Response-Copywriter für deutsche Dropshipping-Shops.",
    "Schreibe knackige, nutzenorientierte, conversion-starke Texte auf DEUTSCH (per du).",
    "Keine leeren Superlative, keine Emojis im Fließtext. Wo HTML angegeben ist (z. B.",
    "<p>, <strong>) darf es genutzt werden.",
    "",
    "Gib AUSSCHLIESSLICH ein JSON-Objekt zurück, dessen Keys EXAKT diese sind",
    "(keine zusätzlichen, keine fehlenden). Werte sind reine Strings:",
    keyList,
  ].join("\n");

  const user = [
    `Produktname: ${input.name}`,
    `Produkt-Briefing: ${input.brief || "(kein Briefing — leite aus dem Namen ab)"}`,
    "",
    "Antworte als JSON-Objekt mit genau diesen Keys.",
  ].join("\n");

  const json = await deepseekJson(system, user, 0.7);
  return coerceToSpec(json);
}

// ─────────────────────────── Validator ────────────────────────────

interface ValidatorResult {
  isValid: boolean;
  feedback: string;
  correctedJson: Record<string, string>;
}

async function runValidator(draft: ThemeCopy): Promise<ValidatorResult> {
  const system = [
    "Du bist ein strenger Conversion-Optimierungs-Lektor für Dropshipping-Texte.",
    "Bewerte den JSON-Entwurf anhand der Best-Practice-Beispiele (Tone of Voice &",
    "Conversion-Psychologie: Nutzen vor Features, Klarheit, glaubwürdiger Social Proof,",
    "starke CTAs, kein Hype/keine !!!).",
    "",
    "Gib AUSSCHLIESSLICH ein JSON-Objekt nach EXAKT diesem Schema zurück:",
    '{"isValid": boolean, "feedback": "string", "correctedJson": { … dieselben Keys, verbessert … }}',
    "- isValid=true nur, wenn der Entwurf bereits stark ist.",
    "- feedback: kurze, konkrete Begründung (1–3 Sätze, deutsch).",
    "- correctedJson MUSS alle Original-Keys enthalten (verbessert oder unverändert),",
    "  Sprache Deutsch + erlaubtes HTML beibehalten.",
  ].join("\n");

  const user = [
    "BEST-PRACTICE-BEISPIELE:",
    JSON.stringify(ENGLISH_EXAMPLES, null, 2),
    "",
    "ZU PRÜFENDER ENTWURF (JSON):",
    JSON.stringify(draft, null, 2),
    "",
    "Antworte als JSON mit isValid, feedback, correctedJson.",
  ].join("\n");

  const raw = await deepseekJson(system, user, 0.2);
  return {
    isValid: typeof raw.isValid === "boolean" ? raw.isValid : false,
    feedback: typeof raw.feedback === "string" ? raw.feedback : "",
    correctedJson:
      raw.correctedJson && typeof raw.correctedJson === "object"
        ? (raw.correctedJson as Record<string, string>)
        : {},
  };
}

// ─────────────────────────── Orchestrator ─────────────────────────

/** Lässt ein Produkt durch Creator → Validator laufen (DeepSeek). */
export async function generateThemeCopy(input: CopyPipelineInput): Promise<CopyPipelineResult> {
  if (!input?.name?.trim()) throw new Error("Produktname fehlt.");

  const draft = await runCreator({ name: input.name.trim(), brief: input.brief?.trim() });

  let review: ValidatorResult;
  try {
    review = await runValidator(draft);
  } catch {
    // Validator-Fehler darf die Pipeline nicht killen — Entwurf verwenden.
    review = { isValid: true, feedback: "Validator übersprungen (Entwurf übernommen).", correctedJson: {} };
  }

  const copy = coerceToSpec({ ...draft, ...review.correctedJson });
  return { draft, isValid: Boolean(review.isValid), feedback: String(review.feedback || ""), copy };
}
