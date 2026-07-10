// ─── POST /api/theme-ai/plan — AI Co-Pilot: Plan erstellen ──────────
// Nimmt {document, prompt, images?, paletteHints?, productTitle?, lang?,
// mode?} und liefert einen bestätigungspflichtigen Plan: Schritte +
// validierte Operationen + Aufwands-Stufe + Credit-Kosten + signierten
// planToken (bindet mode/imageCount an die apply-Route — Kosten-Integrität).
// KOSTEN: Der Plan wird JETZT hier abgerechnet (Abzug bei der Plan-Erstellung,
// nicht mehr bei /apply — das ist prepaid/gratis). Die AI liefert IMMER: bei
// Claude-Fehler/Timeout/Rate-Limit greift ein deterministischer Fallback-Plan.
// KOSTEN-SPARER: identische Anfragen (gleicher Nutzer/Wunsch/Dokument/Modus,
// ohne Bilder) werden 10 Minuten lang aus dem Plan-Cache bedient (kein neuer
// Claude-Call UND kein erneuter Abzug). Gecacht wird NUR ein Plan, dessen
// Credit-Abzug erfolgreich war — sonst wäre er per Retry gratis abrufbar.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey, getCreditsState, logSystemEvent, deductCredits } from "@/lib/sheets";

// Gemeinsame „gleich erneut"-Meldung für transiente Fehler (Überlastung,
// Timeout, Sheets-Quota) — der Nutzer weiß dann, dass ein Retry hilft.
const TRANSIENT_MSG = "Der AI-Dienst ist gerade überlastet oder langsam — bitte in ein paar Sekunden erneut versuchen.";
import { getCreditCost } from "@/lib/credit-config-server";
import { isValidDocument } from "@/lib/theme-compile";
import { generateThemePlan, buildFallbackPlan, normalizeAiMode, type ThemeAiImage, type ThemeAiRawPlan, type ThemeAiInput } from "@/lib/theme-ai";
import { getLearnHints } from "@/lib/theme-ai-learn";
import { signPlanToken } from "@/lib/theme-ai-token";
import { validateAiOps, aiEffortPoints, aiEffortTier, aiTierCreditKey } from "@/lib/theme-ai-ops";
import type { ThemeDocument } from "@/lib/theme-doc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 180 s (Vercel Pro): ein volles „passe das Theme dem Produkt an" (Expert/Opus,
// 6–9 Sektionen mit komplett aufs Produkt geschriebenen Texten, bis 16000 Output-
// Tokens) kann 60–140 s Generierung brauchen. Mit dem alten 120-s-Limit + 110-s-
// Abbruch wurde genau das gute Ergebnis noch abgewürgt. 180 s lässt den vollen
// Plan durch (AbortController 150 s) UND reserviert ~30 s für Abbuchung + Antwort.
export const maxDuration = 180;

// Rate-Limit pro Nutzer (Lambda-lokal): max. 30 Pläne in 10 Minuten. Höher als
// früher (10), weil ein rate-limitierter Request jetzt einen Fallback liefert,
// dessen „gleich nochmal senden"-Hinweis den Nutzer bei aggressivem Iterieren
// in eine Fallback-Schleife trieb. 30/10min lässt echtes Ausprobieren zu.
const RATE_MAX = 30;
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

// Plan-Cache (Lambda-lokal): identische Anfrage → gleicher Roh-Plan, ohne
// erneuten Claude-Call. Nur ohne Bilder (Bild-Bytes hashen lohnt nicht).
const PLAN_CACHE_TTL_MS = 10 * 60 * 1000;
const PLAN_CACHE_MAX = 40;
const planCache = new Map<string, { at: number; raw: ThemeAiRawPlan }>();
function hashStr(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
function planCacheGet(key: string): ThemeAiRawPlan | null {
  const hit = planCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > PLAN_CACHE_TTL_MS) {
    planCache.delete(key);
    return null;
  }
  return hit.raw;
}
function planCacheSet(key: string, raw: ThemeAiRawPlan): void {
  planCache.set(key, { at: Date.now(), raw });
  if (planCache.size > PLAN_CACHE_MAX) {
    const oldest = [...planCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) planCache.delete(oldest[0]);
  }
}

/** LLM-Ops: texts-Array → Record umformen (die Validierung erwartet Record). */
function toRecordOps(operations: unknown[]): unknown[] {
  return operations.map((o) => {
    if (o && typeof o === "object" && Array.isArray((o as { texts?: unknown }).texts)) {
      const rec: Record<string, string> = {};
      for (const t of (o as { texts: { field?: unknown; value?: unknown }[] }).texts) {
        if (typeof t?.field === "string" && typeof t?.value === "string") rec[t.field] = t.value;
      }
      return { ...(o as Record<string, unknown>), texts: rec };
    }
    return o;
  });
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
  /** "standard" (Sonnet, günstig) | "expert" (Opus, mehr Credits). */
  mode?: string;
  /** Section-Typen der Theme-Basis (Editor-Manifest) — hält Validierung/Kosten
   *  deckungsgleich mit dem, was der Client wirklich anwenden kann. */
  capabilities?: string[];
  /** Vom Nutzer markierte Section-uids — die AI ändert primär diese. */
  focus?: string[];
}

function cleanFocus(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((f): f is string => typeof f === "string" && f.length <= 64).slice(0, 12)
    : [];
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

  const mode = normalizeAiMode(body.mode);
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
  const productTitle = typeof body.productTitle === "string" ? body.productTitle.slice(0, 200) : "";
  const focus = cleanFocus(body.focus);

  // Mindest-Guthaben: wer die kleinste Stufe (des gewählten Modus) nicht
  // zahlen könnte, bekommt auch keinen (für uns kostenpflichtigen) Plan.
  const user = session.isAdmin ? "admin" : session.lizenzschluessel || "";
  // Kunde EINMAL laden — für den Vorab-Check UND den Credit-Abzug bei der
  // Plan-Erstellung (Kosten fallen jetzt beim Plan an, nicht erst beim Umsetzen).
  let kunde: Awaited<ReturnType<typeof findKundeByKey>> = null;
  if (!session.isAdmin) {
    if (!session.lizenzschluessel) return NextResponse.json({ error: "Kein Kundenkonto." }, { status: 403 });
    try {
      kunde = await findKundeByKey(session.lizenzschluessel);
      if (!kunde) return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });
      const minCost = await getCreditCost(aiTierCreditKey("small", mode));
      const balance = getCreditsState(kunde.profile).balance;
      if (minCost > 0 && balance < minCost) {
        return NextResponse.json(
          { error: `Nicht genug Credits — der AI Co-Pilot kostet ab ${minCost} Credits pro Umsetzung.`, creditsRemaining: balance },
          { status: 402 },
        );
      }
    } catch (err) {
      // Sheets-Quota/Hänger: nicht mit generischem 500 abstürzen, sondern
      // klar als transient ausweisen + protokollieren.
      console.error("[theme-ai] credit check failed:", err);
      await logSystemEvent({ level: "error", actor: user, action: "theme-ai.plan.credit_check_failed", details: { message: err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300) } });
      return NextResponse.json({ error: TRANSIENT_MSG }, { status: 503 });
    }
  }

  // Lern-Hinweise VOR dem Cache-Key laden (sie fließen in den Prompt ein).
  // Defensiv: ein Sheets-Hänger hier darf den ganzen Plan NICHT killen.
  let learnHints: string | null = null;
  try {
    learnHints = productTitle ? await getLearnHints(productTitle) : null;
  } catch (err) {
    console.warn("[theme-ai] getLearnHints failed (ignoriert):", err);
  }

  // Gemeinsame Eingabe für echten Plan UND deterministischen Fallback.
  const input: ThemeAiInput = {
    doc,
    prompt,
    images,
    paletteHints,
    productTitle,
    lang: body.lang === "en" ? "en" : "de",
    mode,
    learnHints: learnHints || undefined,
    focus,
  };

  // Cache-Key über ALLE prompt-relevanten Eingaben (inkl. paletteHints);
  // Trenner = Unit Separator (U+001F), damit Feldgrenzen eindeutig bleiben.
  const cacheKey = images.length
    ? null
    : hashStr(
        [user, mode, body.lang || "de", prompt, productTitle, paletteHints.join(","), focus.join(","), learnHints || "", JSON.stringify(doc)].join("\u001f"),
      );
  let raw = cacheKey ? planCacheGet(cacheKey) : null;
  const fromCache = !!raw;

  // Die AI liefert IMMER: klappt Claude nicht (Fehler/Timeout/Rate-Limit), gibt
  // es einen deterministischen Ersatz-Plan statt einer Fehlermeldung.
  let usedFallback = false;
  if (!raw) {
    if (rateLimited(user)) {
      // Kein API-Call → schützt unser Budget wie das Rate-Limit, aber ohne Fehler.
      raw = buildFallbackPlan(input);
      usedFallback = true;
    } else {
      // Zeit-Limit via AbortController unter dem maxDuration-Limit (180 s): die KI
      // hat massig Zeit (volle Produkt-Anpassung, Expert/Opus, 60–140 s), und es
      // bleiben ~30 s für Guthaben-Abbuchung + Antwort. Der Fallback greift damit
      // praktisch nur noch bei ECHTEN API-Fehlern, nicht als Ersatz für ein
      // langsames, aber gutes Ergebnis.
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 150000);
      try {
        raw = await generateThemePlan(input, { signal: ac.signal });
      } catch (err) {
        console.error("[theme-ai] plan failed → Fallback:", err);
        const status = (err as { status?: number } | null)?.status;
        // ZUERST den Fallback bauen, DANN loggen (fire-and-forget): logSystemEvent
        // schreibt ungetimeoutet in Sheets — ein hängender Sheets-Call darf NIEMALS
        // den Fallback blockieren und die Anfrage ins 180-s-Limit laufen lassen
        // (das wäre ein harter 502 statt des sauberen Ersatz-Plans).
        raw = buildFallbackPlan(input);
        usedFallback = true;
        void logSystemEvent({
          level: "warn",
          actor: user,
          action: "theme-ai.plan.fallback",
          target: mode,
          details: { status: status ?? null, message: err instanceof Error ? err.message.slice(0, 300) : "" },
        }).catch(() => {});
      } finally {
        clearTimeout(timer);
      }
    }
  }

  // Ops validieren — findet die AI nichts Umsetzbares, greift der Fallback
  // (nie ein 422-Fehler). Danach ist mindestens eine gültige Op garantiert.
  const caps = cleanCapabilities(body.capabilities);
  let ops = validateAiOps(toRecordOps(raw.operations), doc, caps);
  if (!ops.length) {
    raw = buildFallbackPlan(input);
    ops = validateAiOps(toRecordOps(raw.operations), doc, caps);
    usedFallback = true;
  }
  if (!ops.length) {
    // Letzte Absicherung (praktisch nie): simpler Design-Refresh im aktuellen Stil.
    raw = { summary: raw.summary || "Design aufgefrischt.", steps: raw.steps || [], operations: [{ op: "set_style", styleId: doc.global?.styleId || "modern", mode: "design" }] };
    ops = validateAiOps(raw.operations, doc, caps);
    usedFallback = true;
  }
  const points = aiEffortPoints(ops, images.length);
  const tier = aiEffortTier(points);
  // Auf dem Fallback-Pfad wird NIE abgebucht (siehe !usedFallback unten) → dort den
  // ungetimeouteten Sheets-Read von getCreditCost sparen: er wäre nur Kosten-Anzeige,
  // könnte aber bei einem Sheets-Hänger die Antwort ins 180-s-Limit schieben (502).
  const cost = session.isAdmin || usedFallback ? 0 : await getCreditCost(aiTierCreditKey(tier, mode));

  // ── Credits SOFORT bei der Plan-Erstellung abziehen (nicht erst beim
  //    Umsetzen). Cache-Treffer (identischer Wunsch innerhalb 10 Min) werden
  //    NICHT erneut belastet — ein Doppelklick kostet nicht doppelt.
  // Fallback = degradierter Notnagel (KI war aus) → GRATIS: dafür Credits zu
  // ziehen und den Nutzer dann für den Retry nochmal zahlen zu lassen wäre
  // unfair. Nur ECHTE KI-Pläne kosten (das war der Sinn von „immer abrechnen").
  let creditsRemaining: number | undefined;
  if (!session.isAdmin && !fromCache && !usedFallback && cost > 0 && session.lizenzschluessel) {
    try {
      // FRISCH nachladen unmittelbar vor dem Abzug: deductCredits überschreibt
      // die ganze Profilzeile (kein atomares Read-Modify-Write), sonst gingen
      // parallele Guthaben-Änderungen während der Plan-Erstellung verloren.
      const freshKunde = await findKundeByKey(session.lizenzschluessel);
      if (!freshKunde) return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });
      const result = await deductCredits(freshKunde.rowIndex, freshKunde.profile, cost, mode === "expert" ? "theme-ai-expert" : "theme-ai");
      if (!result.success) {
        return NextResponse.json(
          { error: `Nicht genug Credits — dieser Plan kostet ${cost} Credits.`, creditsRemaining: result.remaining },
          { status: 402 },
        );
      }
      creditsRemaining = result.remaining;
    } catch (err) {
      console.error("[theme-ai] plan deduct failed:", err);
      await logSystemEvent({ level: "error", actor: user, action: "theme-ai.plan.deduct_failed", target: mode, details: { cost, message: err instanceof Error ? err.message.slice(0, 300) : "" } });
      return NextResponse.json({ error: TRANSIENT_MSG }, { status: 503 });
    }
  }

  // Cachen NUR bei echtem KI-Plan (kein Fallback!) UND erst NACH erfolgreichem
  // Abzug. Grund 1: ein fehlgeschlagener Abzug (402/503) hat oben schon returned
  // → füllt den Cache nicht → kein Gratis-Retry. Grund 2: einen Fallback NIE
  // cachen, sonst liefert ein erneutes Senden 10 Min lang wieder den Fallback
  // statt eines frischen KI-Versuchs (der beim Retry meist klappt).
  if (cacheKey && !fromCache && !usedFallback) planCacheSet(cacheKey, raw);

  return NextResponse.json(
    {
      summary: raw.summary,
      steps: raw.steps,
      ops,
      tier,
      mode,
      cost,
      imageCount: images.length,
      dropped: Math.max(0, raw.operations.length - ops.length),
      fromCache,
      // Kosten wurden JETZT (bei der Plan-Erstellung) abgezogen; das Umsetzen
      // ist gratis. creditsRemaining = neuer Kontostand (undefined bei Admin/Cache).
      creditsRemaining,
      charged: cost > 0 && creditsRemaining !== undefined,
      // true = KI war ausgelastet, das ist nur ein schneller Ersatz-Entwurf
      // (kein volles „ans Produkt anpassen"). Client bittet dann um Retry.
      fallback: usedFallback,
      // Signiert (user, mode, imageCount, ops) — Pflicht für /apply.
      planToken: signPlanToken(user, mode, images.length, ops),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
