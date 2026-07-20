// ─── /api/storefront/status/[code] ────────────────────────────────
// Leichter Lizenz-Check fürs globale Gate (jede Shop-Seite): Gehört der
// Sync-Code zu einem Kunden mit AKTIVEM Abo? → { locked:false }, sonst
// { locked:true }. Kein Rendering, nur Status → schnell + gut cachebar.

import { NextRequest, NextResponse } from "next/server";
import { getThemeDesign, findKundeByKey } from "@/lib/sheets";
import { CANCEL_STATUS, INACTIVE_STATUS } from "@/lib/tiers-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const norm = (s: string) => (s || "").normalize("NFKC").trim().toLowerCase();

function json(body: Record<string, unknown>, status = 200, cache = "public, s-maxage=30, stale-while-revalidate=60") {
  return NextResponse.json(body, { status, headers: { ...CORS, "Cache-Control": cache } });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function licenseActive(kunde: Awaited<ReturnType<typeof findKundeByKey>>): boolean {
  if (!kunde) return false;
  if (kunde.profile?.blocked === true) return false;
  const status = norm(kunde.status);
  if (INACTIVE_STATUS.has(status) && !CANCEL_STATUS.has(status)) return false;
  const endsAt = kunde.profile?.subscriptionEndsAt ? Date.parse(kunde.profile.subscriptionEndsAt) : NaN;
  const paidFuture = Number.isFinite(endsAt) && endsAt > Date.now();
  if (CANCEL_STATUS.has(status) && !paidFuture) return false;
  if (Number.isFinite(endsAt) && endsAt < Date.now()) return false;
  return true;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = (code || "").trim();
  if (!clean) return json({ locked: true, message: "Kein Code." }, 200, "no-store");

  try {
    const design = await getThemeDesign(clean);
    if (!design) return json({ locked: true, message: "Code nicht gefunden." });

    const owner = design.user || "";
    // Master-/Admin-Designs sind immer offen (Demo/Test).
    if (owner === "admin" || owner === "Hat-Jonas") return json({ locked: false });

    let kunde: Awaited<ReturnType<typeof findKundeByKey>> = null;
    try {
      kunde = await findKundeByKey(owner);
    } catch {
      // Sheets-Ausfall → NICHT sperren (fail-open).
      return json({ locked: false }, 200, "no-store");
    }
    return json({ locked: !licenseActive(kunde), message: licenseActive(kunde) ? undefined : "Abo nicht aktiv." });
  } catch {
    // Fehler → fail-open (Shop nie wegen Störung sperren).
    return json({ locked: false }, 200, "no-store");
  }
}
