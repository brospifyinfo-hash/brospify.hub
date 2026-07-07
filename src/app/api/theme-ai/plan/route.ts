// ─── POST /api/theme-ai/plan — AI Co-Pilot: Plan erstellen ──────────
// Nimmt {document, prompt, images?, paletteHints?, productTitle?, lang?}
// und liefert einen bestätigungspflichtigen Plan: Schritte + validierte
// Operationen + Aufwands-Stufe + Credit-Kosten. Der Plan selbst kostet
// KEINE Credits (Abzug erst bei /api/theme-ai/apply) — gegen Dauerfeuer
// gibt es ein Rate-Limit + Mindest-Guthaben-Check.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey, getCreditsState } from "@/lib/sheets";
import { getCreditCost } from "@/lib/credit-config-server";
import { isValidDocument } from "@/lib/theme-compile";
import { generateThemePlan, type ThemeAiImage } from "@/lib/theme-ai";
import { validateAiOps, aiEffortPoints, aiEffortTier, AI_TIER_KEYS } from "@/lib/theme-ai-ops";
import type { ThemeDocument } from "@/lib/theme-doc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Rate-Limit pro Nutzer (Lambda-lokal, bewusst pragmatisch): max. 10 Pläne
// in 10 Minuten — jeder Plan kostet UNS einen Claude-Call.
const RATE_MAX = 10;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const rateMap = new Map<string, number[]>();
function rateLimited(user: string): boolean {
  const now = Date.now();
  const hits = (rateMap.get(user) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) return true;
  hits.push(now);
  rateMap.set(user, hits);
  return false;
}

const DATA_URL_RE = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/;
const MAX_IMAGE_B64 = 6_000_000; // ~4,5 MB pro Bild

interface Body {
  document?: ThemeDocument;
  prompt?: string;
  images?: { dataUrl?: string }[];
  paletteHints?: string[];
  productTitle?: string;
  lang?: string;
  /** Section-Typen der Theme-Basis (Editor-Manifest) — hält Validierung/Kosten
   *  deckungsgleich mit dem, was der Client wirklich anwenden kann. */
  capabilities?: string[];
}

function cleanCapabilities(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((c): c is string => typeof c === "string" && c.length <= 64).slice(0, 100)
    : [];
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 });
  }

  const doc = body.document && isValidDocument(body.document) ? body.document : null;
  if (!doc) return NextResponse.json({ error: "Ungültiges Theme-Dokument." }, { status: 400 });

  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 2000) : "";
  const images: ThemeAiImage[] = [];
  if (Array.isArray(body.images)) {
    for (const img of body.images.slice(0, 3)) {
      const m = typeof img?.dataUrl === "string" && img.dataUrl.length <= MAX_IMAGE_B64 + 64
        ? img.dataUrl.match(DATA_URL_RE)
        : null;
      if (m) images.push({ mediaType: m[1], data: m[2] });
    }
  }
  if (!prompt && !images.length) {
    return NextResponse.json({ error: "Beschreibe deinen Wunsch oder zieh ein Bild hinein." }, { status: 400 });
  }
  const paletteHints = Array.isArray(body.paletteHints)
    ? body.paletteHints.filter((h): h is string => typeof h === "string" && /^#[0-9a-fA-F]{6}$/.test(h)).slice(0, 8)
    : [];

  // Mindest-Guthaben: wer die kleinste Stufe nicht zahlen könnte, bekommt
  // auch keinen (für uns kostenpflichtigen) Plan.
  const user = session.isAdmin ? "admin" : session.lizenzschluessel || "";
  if (!session.isAdmin) {
    if (!session.lizenzschluessel) return NextResponse.json({ error: "Kein Kundenkonto." }, { status: 403 });
    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde) return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });
    const minCost = await getCreditCost("THEME_AI_SMALL");
    const balance = getCreditsState(kunde.profile).balance;
    if (minCost > 0 && balance < minCost) {
      return NextResponse.json(
        { error: `Nicht genug Credits — der AI Co-Pilot kostet ab ${minCost} Credits pro Umsetzung.`, creditsRemaining: balance },
        { status: 402 },
      );
    }
  }
  if (rateLimited(user)) {
    return NextResponse.json({ error: "Zu viele Anfragen — warte kurz und versuch es erneut." }, { status: 429 });
  }

  let raw;
  try {
    raw = await generateThemePlan({
      doc,
      prompt,
      images,
      paletteHints,
      productTitle: typeof body.productTitle === "string" ? body.productTitle.slice(0, 200) : "",
      lang: body.lang === "en" ? "en" : "de",
    });
  } catch (err) {
    console.error("[theme-ai] plan failed:", err);
    const msg = err instanceof Error ? err.message : "Plan konnte nicht erstellt werden.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // LLM-Ops → texts-Array in Record umformen, dann STRIKT validieren.
  const normalized = raw.operations.map((o) => {
    if (o && typeof o === "object" && Array.isArray((o as { texts?: unknown }).texts)) {
      const rec: Record<string, string> = {};
      for (const t of (o as { texts: { field?: unknown; value?: unknown }[] }).texts) {
        if (typeof t?.field === "string" && typeof t?.value === "string") rec[t.field] = t.value;
      }
      return { ...(o as Record<string, unknown>), texts: rec };
    }
    return o;
  });
  const ops = validateAiOps(normalized, doc, cleanCapabilities(body.capabilities));
  if (!ops.length) {
    return NextResponse.json(
      { error: "Dazu hat die AI keine umsetzbaren Änderungen gefunden — formuliere den Wunsch etwas konkreter.", summary: raw.summary },
      { status: 422 },
    );
  }

  const points = aiEffortPoints(ops, images.length);
  const tier = aiEffortTier(points);
  const cost = session.isAdmin ? 0 : await getCreditCost(AI_TIER_KEYS[tier]);

  return NextResponse.json(
    {
      summary: raw.summary,
      steps: raw.steps,
      ops,
      tier,
      cost,
      imageCount: images.length,
      dropped: Math.max(0, raw.operations.length - ops.length),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
