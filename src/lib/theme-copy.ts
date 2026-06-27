import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { anthropicCostUsd, recordUsd } from "@/lib/provider-usage";
import {
  PRODUCT_COPY_SPEC,
  AI_KEYS,
  ENGLISH_EXAMPLES,
  coerceToSpec,
  type ThemeCopy,
} from "@/lib/theme-placeholders";

// ─────────────────────────────────────────────────────────────────
// Maker-Checker-KI-Pipeline für die Produkt-Theme-Texte.
//
//   1. Creator   → generiert verkaufsstarke Platzhalter-Texte (JSON, Keys =
//                  exakt unsere Theme-Platzhalter).
//   2. Validator → prüft den Entwurf gegen Best-Practice-Beispiele und gibt
//                  {isValid, feedback, correctedJson} zurück.
//
// Strukturierter JSON-Output via `output_config.json_schema` (wie translate.ts)
// → kein fragiles Freitext-Parsing. Kosten werden über recordUsd gebucht.
// ─────────────────────────────────────────────────────────────────

const MODEL = "claude-sonnet-4-6";

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

function stringProps(keys: string[]) {
  const properties: Record<string, { type: "string" }> = {};
  for (const k of keys) properties[k] = { type: "string" };
  return { properties, required: keys };
}

function getClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY fehlt — KI-Theme-Texte nicht verfügbar.");
  return new Anthropic({ apiKey: key });
}

async function claudeJson<T>(opts: {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxTokens: number;
}): Promise<T> {
  const client = getClient();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens,
    thinking: { type: "disabled" },
    output_config: { format: { type: "json_schema", schema: opts.schema } },
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  await recordUsd("anthropic", anthropicCostUsd(MODEL, msg.usage));
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return JSON.parse(text) as T;
}

// ─────────────────────────── Creator ──────────────────────────────

async function runCreator(input: CopyPipelineInput): Promise<ThemeCopy> {
  const keyList = PRODUCT_COPY_SPEC.map((s) => `  "${s.key}": ${s.hint}`).join("\n");
  const system = [
    "Du bist ein weltklasse Direct-Response-Copywriter für deutsche Dropshipping-Shops.",
    "Schreibe knackige, nutzenorientierte, conversion-starke Texte auf DEUTSCH (per du).",
    "Keine leeren Superlative, keine Emojis im Fließtext. Wo HTML angegeben ist (z. B.",
    "<p>, <strong>) darf es genutzt werden. Fülle jeden Platzhalter passend zum Produkt.",
    "",
    "Bedeutung der Keys:",
    keyList,
  ].join("\n");

  const user = [
    `Produktname: ${input.name}`,
    `Produkt-Briefing: ${input.brief || "(kein Briefing — leite aus dem Namen ab)"}`,
  ].join("\n");

  const schema = {
    type: "object",
    ...stringProps(AI_KEYS),
    additionalProperties: false,
  };

  const json = await claudeJson<Record<string, unknown>>({ system, user, schema, maxTokens: 3000 });
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
    "isValid=true nur, wenn der Entwurf bereits stark ist.",
    "feedback: kurze, konkrete Begründung (1–3 Sätze, deutsch).",
    "correctedJson MUSS alle Original-Keys enthalten (verbessert oder unverändert),",
    "Sprache Deutsch + erlaubtes HTML beibehalten.",
  ].join("\n");

  const user = [
    "BEST-PRACTICE-BEISPIELE:",
    JSON.stringify(ENGLISH_EXAMPLES, null, 2),
    "",
    "ZU PRÜFENDER ENTWURF (JSON):",
    JSON.stringify(draft, null, 2),
  ].join("\n");

  const schema = {
    type: "object",
    properties: {
      isValid: { type: "boolean" },
      feedback: { type: "string" },
      correctedJson: { type: "object", ...stringProps(AI_KEYS), additionalProperties: false },
    },
    required: ["isValid", "feedback", "correctedJson"],
    additionalProperties: false,
  };

  return claudeJson<ValidatorResult>({ system, user, schema, maxTokens: 3500 });
}

// ─────────────────────────── Orchestrator ─────────────────────────

/** Lässt ein Produkt durch Creator → Validator laufen. */
export async function generateThemeCopy(input: CopyPipelineInput): Promise<CopyPipelineResult> {
  if (!input?.name?.trim()) throw new Error("Produktname fehlt.");

  const draft = await runCreator({ name: input.name.trim(), brief: input.brief?.trim() });
  const review = await runValidator(draft);

  const copy = coerceToSpec({ ...draft, ...review.correctedJson });
  return { draft, isValid: Boolean(review.isValid), feedback: String(review.feedback || ""), copy };
}
