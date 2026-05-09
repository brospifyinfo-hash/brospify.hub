// ─── /api/admin/users/tier ───────────────────────────────────────
// Manual tier override. Body: { key, tier, cancel? }
// - tier:  one of TIER_KEYS to set/upgrade/downgrade
// - cancel:true → soft-cancel current tier (sets tierCanceledAt,
//                 keeps the tier itself for current-period access)

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  cancelUserTier,
  findKundeByKey,
  getKundeProfile,
  logSystemEvent,
  setUserTier,
} from "@/lib/sheets";
import { TIER_KEYS, type TierKey } from "@/lib/tiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isTierKey(v: unknown): v is TierKey {
  return typeof v === "string" && (TIER_KEYS as readonly string[]).includes(v);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  let body: { key?: string; tier?: string; cancel?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const key = String(body.key || "").trim();
  if (!key) {
    return NextResponse.json({ error: "key fehlt." }, { status: 400 });
  }

  const kunde = await findKundeByKey(key);
  if (!kunde) {
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  }

  const profile = await getKundeProfile(kunde.rowIndex);
  const actor = session.googleEmail || session.lizenzschluessel || "admin";

  if (body.cancel) {
    await cancelUserTier(kunde.rowIndex, profile);
    void logSystemEvent({
      level: "audit",
      actor,
      action: "tier.cancel",
      target: kunde.lizenzschluessel,
      details: { tier: profile.tier || "" },
    });
    return NextResponse.json({ success: true, canceled: true });
  }

  if (!isTierKey(body.tier)) {
    return NextResponse.json(
      { error: `tier muss einer von: ${TIER_KEYS.join(", ")}` },
      { status: 400 },
    );
  }

  const prev = profile.tier || "";
  await setUserTier(kunde.rowIndex, profile, body.tier);

  void logSystemEvent({
    level: "audit",
    actor,
    action: "tier.set",
    target: kunde.lizenzschluessel,
    details: { prev, next: body.tier, email: kunde.kundenEmail },
  });

  return NextResponse.json({ success: true, tier: body.tier, prev });
}
