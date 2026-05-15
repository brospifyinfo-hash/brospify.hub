import { NextRequest, NextResponse } from "next/server";
import { getAllKunden } from "@/lib/sheets";

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

// Master key — Hat-Jonas always unlocks, mirroring the Hub admin fallback.
const MASTER_KEYS = ["Hat-Jonas"];

// Explicit kill words. Anything else (incl. "aktiv", "active", empty)
// counts as valid — never lock on a typo or blank cell.
const INACTIVE = new Set([
  "gesperrt", "blocked", "inaktiv", "inactive", "abgelaufen", "expired",
  "deaktiviert", "disabled", "gekündigt", "gekuendigt", "cancelled",
  "canceled", "ungültig", "ungueltig", "invalid", "false", "0", "nein", "no",
]);

const norm = (s: string) => (s || "").normalize("NFKC").trim().toLowerCase();

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

  try {
    // Tolerant lookup: trim + case-fold so a stray space or a typo'd
    // case in the hand-edited sheet cannot lock a paying shop.
    const kunden = await getAllKunden();
    const wanted = norm(key);
    const kunde = kunden.find((k) => norm(k.lizenzschluessel) === wanted);

    if (!kunde) {
      return json({ valid: false, message: "Lizenzschlüssel nicht gefunden." });
    }

    if (INACTIVE.has(norm(kunde.status))) {
      return json({ valid: false, message: "Lizenz ist nicht aktiv." });
    }

    if (kunde.profile?.blocked === true) {
      return json({ valid: false, message: "Lizenz wurde gesperrt." });
    }

    return json({
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
