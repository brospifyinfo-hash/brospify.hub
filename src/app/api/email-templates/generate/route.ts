// ─── POST /api/email-templates/generate ──────────────────────────
// Generates Shopify Liquid/HTML for one of the Top 10 notification
// templates, given a brand tone and optional notes.
//
// Today this calls the deterministic generator in
// `lib/ai-email-generator.ts`. To swap in a real LLM, point this
// route at `generateWithLLM(...)` once you've wired an API key.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  generateEmailTemplate,
  type BrandTone,
  type GenerateInput,
} from "@/lib/ai-email-generator";
import { getTemplateById } from "@/lib/email-templates";

const ALLOWED_TONES: BrandTone[] = [
  "seriös",
  "locker",
  "luxuriös",
  "verspielt",
  "minimalistisch",
];

export async function POST(req: Request) {
  // ─── Auth ─────────────────────────────────────────────
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  // ─── Validate input ──────────────────────────────────
  let body: Partial<GenerateInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const templateId = body.templateId;
  if (!templateId || typeof templateId !== "string") {
    return NextResponse.json({ error: "templateId fehlt." }, { status: 400 });
  }
  const tpl = getTemplateById(templateId);
  if (!tpl) {
    return NextResponse.json({ error: "Unbekannte templateId." }, { status: 404 });
  }

  const brandTone = (body.brandTone ?? "seriös") as BrandTone;
  if (!ALLOWED_TONES.includes(brandTone)) {
    return NextResponse.json({ error: "Ungültiger brandTone." }, { status: 400 });
  }

  // Cap notes length to keep prompts predictable
  const specialNotes =
    typeof body.specialNotes === "string" ? body.specialNotes.slice(0, 600) : "";

  const primaryColor =
    typeof body.primaryColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.primaryColor)
      ? body.primaryColor
      : "#95BF47";

  // ─── Generate ────────────────────────────────────────
  try {
    const result = generateEmailTemplate({
      templateId,
      brandTone,
      specialNotes,
      primaryColor,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generierung fehlgeschlagen." },
      { status: 500 },
    );
  }
}
