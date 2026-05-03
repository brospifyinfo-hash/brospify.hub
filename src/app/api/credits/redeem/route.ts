// ─── POST /api/credits/redeem ───────────────────────────────────
// Redeems a voucher code for the logged-in customer. Per-account
// limits live on the code (`maxPerAccount`), redemption counts live
// on the customer profile (`credits.redeemedCodes[CODE]`). Inactive
// or unknown codes are rejected with a generic message so admins
// can revoke compromised codes without leaking which ones existed.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  bumpCodeRedemptions,
  findCreditCode,
  findKundeByKey,
  getKundeProfile,
  redeemCode,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.lizenzschluessel) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const raw = typeof body.code === "string" ? body.code : "";
  const code = raw.trim().toUpperCase();
  if (!code || code.length < 3 || code.length > 64) {
    return NextResponse.json({ error: "Bitte gib einen gültigen Code ein." }, { status: 400 });
  }

  const kunde = await findKundeByKey(session.lizenzschluessel);
  if (!kunde) {
    return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });
  }

  const entry = await findCreditCode(code);
  if (!entry || !entry.active) {
    return NextResponse.json(
      { error: "Code ist ungültig oder nicht mehr aktiv." },
      { status: 404 },
    );
  }

  const profile = await getKundeProfile(kunde.rowIndex);
  const usedSoFar = profile.credits?.redeemedCodes?.[entry.code] ?? 0;
  if (usedSoFar >= entry.maxPerAccount) {
    return NextResponse.json(
      {
        error:
          entry.maxPerAccount === 1
            ? "Du hast diesen Code bereits eingelöst."
            : `Du hast diesen Code bereits ${entry.maxPerAccount}× eingelöst — das Maximum ist erreicht.`,
      },
      { status: 409 },
    );
  }

  const result = await redeemCode(kunde.rowIndex, profile, entry.code, entry.credits);
  // Best-effort lifetime counter bump. If this fails we still
  // credited the user; just log and move on.
  try {
    await bumpCodeRedemptions(entry.rowIndex);
  } catch (err) {
    console.error("[Redeem] bumpCodeRedemptions failed:", err);
  }

  return NextResponse.json({
    success: true,
    code: entry.code,
    creditsAdded: entry.credits,
    balance: result.balance,
  });
}
