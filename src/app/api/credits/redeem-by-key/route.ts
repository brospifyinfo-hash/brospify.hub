// ─── POST /api/credits/redeem-by-key ────────────────────────────
// CORS-fähige Variante von /api/credits/redeem für den Shopify-Storefront.
// Auth via Lizenzschlüssel + shared API-Key (gleiche Soft-Gate wie
// /api/license/validate und /api/credits/by-key).
//
// Body: { code: string, key: string, apikey?: string }
// Statt Session-Cookies wird der Kunde über den Lizenzschlüssel
// resolved — identisch zur GET /api/credits/by-key Logik.

import { NextRequest, NextResponse } from "next/server";
import {
  bumpCodeRedemptions,
  findCreditCode,
  findKundeByEmail,
  findKundeByKey,
  getKundeProfile,
  redeemCode,
} from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  let body: { code?: unknown; key?: unknown; email?: unknown; apikey?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Ungültiger Request-Body." }, 400);
  }

  const apiKey = typeof body.apikey === "string" ? body.apikey.trim() : "";
  const expected = (process.env.LICENSE_API_KEY || "").trim();
  if (expected && apiKey !== expected) {
    return json({ error: "Nicht autorisiert." }, 401);
  }

  const key = typeof body.key === "string" ? body.key.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!key && !email) return json({ error: "Lizenzschlüssel oder Email fehlt." }, 400);

  const raw = typeof body.code === "string" ? body.code : "";
  const code = raw.trim().toUpperCase();
  if (!code || code.length < 3 || code.length > 64) {
    return json({ error: "Bitte gib einen gültigen Code ein." }, 400);
  }

  const kunde = key ? await findKundeByKey(key) : await findKundeByEmail(email);
  if (!kunde) return json({ error: "Kunde nicht gefunden." }, 404);

  const entry = await findCreditCode(code);
  if (!entry || !entry.active) {
    return json({ error: "Code ist ungültig oder nicht mehr aktiv." }, 404);
  }

  const profile = await getKundeProfile(kunde.rowIndex);
  const usedSoFar = profile.credits?.redeemedCodes?.[entry.code] ?? 0;
  if (usedSoFar >= entry.maxPerAccount) {
    return json(
      {
        error:
          entry.maxPerAccount === 1
            ? "Du hast diesen Code bereits eingelöst."
            : `Du hast diesen Code bereits ${entry.maxPerAccount}× eingelöst — das Maximum ist erreicht.`,
      },
      409,
    );
  }

  const result = await redeemCode(kunde.rowIndex, profile, entry.code, entry.credits);
  try {
    await bumpCodeRedemptions(entry.rowIndex);
  } catch (err) {
    console.error("[RedeemByKey] bumpCodeRedemptions failed:", err);
  }

  return json({
    success: true,
    code: entry.code,
    creditsAdded: entry.credits,
    balance: result.balance,
  });
}
