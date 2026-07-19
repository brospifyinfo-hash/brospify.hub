import { NextRequest, NextResponse } from "next/server";
import { getAllKunden } from "@/lib/sheets";
import { CANCEL_STATUS, INACTIVE_STATUS } from "@/lib/tiers-shared";

// ─── GET /api/license/validate ───────────────────────────────────
// Public-ish licence check for the Shopify theme.
// The storefront calls this cross-origin with:
//   ?apikey=<shared-secret>&key=<licence>&domain=<shop>
//
// Response shape matches what the theme expects: { valid, message }.
// MUST never return `valid: false` because of an infrastructure
// hiccup — a falsely-locked storefront is a customer-facing outage.
//
// The `apikey` is a soft gate (it's visible in the storefront's HTML
// source, so it's not truly secret). It just stops random scraping
// of the endpoint.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

// Master licence keys — bypass the Shopify-theme licence gate.
// NOTE: this is SEPARATE from the Hub admin master-key list in
// /api/auth/login. Only `Hat-Jonas` belongs here historically.
// New Hub-admin-only keys (e.g. ILDCÜA) must NOT be added —
// they would unlock random storefronts. Case-sensitive exact match.
const MASTER_KEYS = ["Hat-Jonas"];

// Explicit kill words. Anything else (incl. "aktiv", "active", empty)
// counts as valid — never lock on a typo or blank cell.
// Geteilte Liste mit resolvePlan() (tiers-shared) — Theme-Gate und
// Hub-Gates dürfen nie auseinanderlaufen.
const INACTIVE = INACTIVE_STATUS;

const norm = (s: string) => (s || "").normalize("NFKC").trim().toLowerCase();

// Per-Lambda-Micro-Cache: jeder Storefront-Seitenaufruf ohne Client-Cache
// triggert sonst einen kompletten Kunden-Sheet-Read (Google-Quota!). 60 s
// Verdikt-Cache ist unkritisch: das Theme cached positive Antworten eh
// 10 min lokal; eine Sperrung greift damit in ≤ ~1 min.
const VERDICT_TTL_MS = 60_000;
const verdictCache = new Map<string, { t: number; body: Record<string, unknown> }>();

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const apiKey = (req.nextUrl.searchParams.get("apikey") || "").trim();
  const expected = (process.env.LICENSE_API_KEY || "").trim();

  // Fail OPEN if the env-var is missing — better than locking every shop
  // because of a deployment mishap. The error gets logged for ops.
  if (!expected) {
    console.error("[license/validate] LICENSE_API_KEY env var not set");
    return json({ valid: true, message: "Server nicht konfiguriert (fail-open)." });
  }

  if (apiKey !== expected) {
    return json({ valid: false, message: "Ungültiger API-Key." }, 403);
  }

  const key = (req.nextUrl.searchParams.get("key") || "").trim();
  const domain = (req.nextUrl.searchParams.get("domain") || "").trim();

  if (!key) {
    return json({ valid: false, message: "Kein Lizenzschlüssel angegeben." });
  }

  // Master key always passes — useful for testing & emergency unlock.
  if (MASTER_KEYS.includes(key)) {
    return json({ valid: true, message: "Master-Lizenz." });
  }

  const wanted = norm(key);
  const hit = verdictCache.get(wanted);
  if (hit && Date.now() - hit.t < VERDICT_TTL_MS) {
    return json(hit.body);
  }

  try {
    // Tolerant lookup: trim + case-fold so a stray space or a typo'd
    // case in the hand-edited sheet cannot lock a paying shop.
    // Zwei akzeptierte Werte je Kunde: der echte Lizenzschlüssel (Alt-
    // Installationen, Hand-Eingabe) ODER der Storefront-Site-Token
    // (SITE-…), den der Export seit dem Lizenz-Gate v2 vorbefüllt. Der
    // Token steht im öffentlichen Shop-HTML, taugt aber NICHT als
    // Hub-Login — der echte Schlüssel bleibt so privat.
    const kunden = await getAllKunden();
    const kunde = kunden.find(
      (k) =>
        norm(k.lizenzschluessel) === wanted ||
        (k.profile?.licenseSiteToken && norm(k.profile.licenseSiteToken) === wanted),
    );

    // Verdikt cachen (nur echte Verdikte — der Fail-open-Catch unten
    // cached bewusst NICHT, sonst würde ein Sheets-Schluckauf 60 s lang
    // als „gültig" festgeschrieben).
    const verdict = (body: Record<string, unknown>) => {
      if (verdictCache.size > 500) verdictCache.clear();
      verdictCache.set(wanted, { t: Date.now(), body });
      return json(body);
    };

    if (!kunde) {
      return verdict({ valid: false, message: "Lizenzschlüssel nicht gefunden." });
    }

    const statusNorm = norm(kunde.status);
    if (INACTIVE.has(statusNorm)) {
      // Kündigungs-Status: bezahlte Periode respektieren — der Shop
      // bleibt bis subscriptionEndsAt online („Kündigung zum Perioden-
      // ende"). Harte Kill-Words (gesperrt/inaktiv/…) sperren sofort.
      const graceTs = kunde.profile?.subscriptionEndsAt ? Date.parse(kunde.profile.subscriptionEndsAt) : NaN;
      const paidUntilFuture = Number.isFinite(graceTs) && graceTs > Date.now();
      if (!(CANCEL_STATUS.has(statusNorm) && paidUntilFuture)) {
        return verdict({ valid: false, message: "Lizenz ist nicht aktiv." });
      }
    }

    if (kunde.profile?.blocked === true) {
      return verdict({ valid: false, message: "Lizenz wurde gesperrt." });
    }

    // Time-based subscription gate. Make stamps profile.subscriptionEndsAt
    // on every renewal via /api/license/sync. If the date has passed,
    // reject immediately — the daily expire-cron will eventually flip
    // the status column too, but the live check is the authoritative gate.
    const endsAt = kunde.profile?.subscriptionEndsAt;
    if (endsAt) {
      const t = Date.parse(endsAt);
      if (Number.isFinite(t) && t < Date.now()) {
        return verdict({ valid: false, message: "Abo ist abgelaufen." });
      }
    }

    return verdict({
      valid: true,
      message: "Lizenz aktiv.",
      shop: domain || kunde.shopDomain,
    });
  } catch (err) {
    console.error("[license/validate]", err);
    // Fail OPEN — never take down a customer's storefront for a Sheets hiccup.
    return json({ valid: true, message: "Validierung übersprungen (Serverfehler)." });
  }
}
