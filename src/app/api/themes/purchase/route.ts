// ─── /api/themes/purchase ────────────────────────────────────────
// One-time per-theme unlock for users with an active subscription.
// The user pays with their credit balance — 1 EUR = 50 credits, the
// same conversion the cheapest credit pack uses (500 credits / 9.95
// EUR ≈ 50 credits/EUR). The unlock is recorded in the customer's
// profile (`themesPurchased`) and is honoured ONLY while the sub is
// active — this matches the requirement that "Kündigt der User sein
// Abo, verliert er auch den Zugriff auf alle einzeln gekauften Themes."
//
// Body: { themeId: string }

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  deductCredits,
  findKundeByKey,
  getKundeProfile,
  updateKundeProfile,
} from "@/lib/sheets";
import { isActiveSub } from "@/lib/tiers-shared";
import { list } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SETTINGS_KEY = "brospifyhub-settings.json";
const CREDITS_PER_EUR = 50;

interface RawTheme {
  id: string;
  name: string;
  priceEur?: number;
  active?: boolean;
}

async function findTheme(themeId: string): Promise<RawTheme | null> {
  try {
    const { blobs } = await list({ prefix: SETTINGS_KEY, limit: 1 });
    if (blobs.length === 0 || !blobs[0].url) return null;
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data.themes)) return null;
    return data.themes.find((t: RawTheme) => t && t.id === themeId) || null;
  } catch (err) {
    console.error("[themes/purchase] settings read error:", err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.lizenzschluessel) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  let body: { themeId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Body" }, { status: 400 });
  }

  const themeId = typeof body.themeId === "string" ? body.themeId : "";
  if (!themeId) {
    return NextResponse.json({ error: "themeId fehlt" }, { status: 400 });
  }

  const theme = await findTheme(themeId);
  if (!theme || theme.active === false) {
    return NextResponse.json({ error: "Theme nicht verfügbar." }, { status: 404 });
  }

  const kunde = await findKundeByKey(session.lizenzschluessel);
  if (!kunde) {
    return NextResponse.json({ error: "Konto nicht gefunden." }, { status: 404 });
  }

  if (!isActiveSub(kunde.profile)) {
    return NextResponse.json(
      {
        error: "NO_ACTIVE_SUB",
        message:
          "Ein einmaliger Kauf ist nur mit aktivem Abo möglich. Bitte wähle zuerst einen Plan.",
      },
      { status: 403 },
    );
  }

  const purchased = Array.isArray(kunde.profile.themesPurchased)
    ? kunde.profile.themesPurchased
    : [];
  if (purchased.includes(themeId)) {
    return NextResponse.json({
      success: true,
      alreadyOwned: true,
      themeId,
    });
  }

  const priceEur = typeof theme.priceEur === "number" && theme.priceEur >= 0 ? theme.priceEur : 0;
  const creditsRequired = Math.max(0, Math.round(priceEur * CREDITS_PER_EUR));

  if (creditsRequired > 0) {
    // Re-read profile inside the txn so we have the latest balance.
    const fresh = await getKundeProfile(kunde.rowIndex);
    const result = await deductCredits(
      kunde.rowIndex,
      fresh,
      creditsRequired,
      `Theme-Kauf: ${theme.name}`,
    );
    if (!result.success) {
      return NextResponse.json(
        {
          error: "INSUFFICIENT_CREDITS",
          message: `Nicht genug Credits — du brauchst ${creditsRequired} Credits (${priceEur} €).`,
          required: creditsRequired,
          balance: result.remaining,
        },
        { status: 402 },
      );
    }
  }

  // Re-read once more to merge with the deduct write.
  const merged = await getKundeProfile(kunde.rowIndex);
  const updatedPurchased = Array.from(new Set([
    ...(Array.isArray(merged.themesPurchased) ? merged.themesPurchased : []),
    themeId,
  ]));
  await updateKundeProfile(kunde.rowIndex, {
    ...merged,
    themesPurchased: updatedPurchased,
  });

  return NextResponse.json({
    success: true,
    themeId,
    creditsCharged: creditsRequired,
    priceEur,
  });
}
