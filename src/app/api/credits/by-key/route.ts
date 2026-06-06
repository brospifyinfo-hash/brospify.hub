import { NextRequest, NextResponse } from "next/server";
import { findKundeByEmail, findKundeByKey, getKundeProfile } from "@/lib/sheets";

// ─── GET /api/credits/by-key ────────────────────────────────────
// Public-ish credit-balance endpoint for the Shopify theme header.
// The storefront calls this cross-origin with:
//   ?apikey=<shared-secret>&key=<licence>
//
// Returns minimal payload: { ok, balance, totalPurchased, totalUsed }.
// Same soft-gate as /api/license/validate — apikey is visible in the
// storefront HTML, the goal is only to block random scrapers.
//
// Auth model: licence key acts as the identifier. The Shopify theme
// already holds the customer's licence (license/validate result),
// so no extra login required.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  const apiKey = (req.nextUrl.searchParams.get("apikey") || "").trim();
  const expected = (process.env.LICENSE_API_KEY || "").trim();

  // Fail-open like license/validate: a misconfigured deploy must
  // not hide credits — better to return 0 than break the header.
  if (expected && apiKey !== expected) {
    return json({ ok: false, balance: 0, error: "auth" }, 401);
  }

  const key = (req.nextUrl.searchParams.get("key") || "").trim();
  const email = (req.nextUrl.searchParams.get("email") || "").trim();
  if (!key && !email) {
    return json({ ok: false, balance: 0, error: "missing-key-or-email" }, 400);
  }

  try {
    const kunde = key
      ? await findKundeByKey(key)
      : await findKundeByEmail(email);
    if (!kunde) return json({ ok: false, balance: 0, error: "unknown-identifier" }, 404);

    const profile = await getKundeProfile(kunde.rowIndex);
    const c = profile.credits;
    return json({
      ok: true,
      balance: Math.max(0, Number(c?.balance) || 0),
      totalPurchased: Math.max(0, Number(c?.totalPurchased) || 0),
      totalUsed: Math.max(0, Number(c?.totalUsed) || 0),
    });
  } catch (err) {
    console.error("[credits/by-key] sheet read failed:", err);
    // Fail-open: don't break the header on an upstream Sheets blip.
    return json({ ok: false, balance: 0, error: "upstream" }, 200);
  }
}
