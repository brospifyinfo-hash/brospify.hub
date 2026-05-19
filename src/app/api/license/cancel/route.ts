import { NextRequest, NextResponse } from "next/server";
import { findKundeByKey, updateKundeField, updateKundeProfile, logSystemEvent } from "@/lib/sheets";

// ─── POST /api/license/cancel ─────────────────────────────────
// Make.com → Hub. Fires when a subscription is cancelled upstream
// (Shopify subscription webhook, manual refund flow, etc.) and
// locks the licence in one atomic operation:
//   • status column      → "gekündigt"
//   • profile.blocked    → true
//   • profile.blockedAt  → ISO now
//
// Validation gate (/api/license/validate) checks both the status
// kill-words AND profile.blocked, so this is double-belted.
//
// Auth: same X-Api-Key header as /api/license/sync. Idempotent —
// cancelling an already-cancelled licence is a no-op success.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  const expected = (process.env.LICENSE_WRITE_KEY || "").trim();
  if (!expected) {
    console.error("[license/cancel] LICENSE_WRITE_KEY env var not set");
    return bad("Server nicht konfiguriert.", 503);
  }

  const provided = (req.headers.get("x-api-key") || "").trim();
  if (provided !== expected) {
    return bad("Ungültiger API-Key.", 403);
  }

  let payload: { lizenzschluessel?: string; reason?: string };
  try {
    payload = (await req.json()) as { lizenzschluessel?: string; reason?: string };
  } catch {
    return bad("Body muss JSON sein.", 400);
  }

  const key = (payload?.lizenzschluessel || "").trim();
  if (!key) {
    return bad("Feld 'lizenzschluessel' fehlt.", 400);
  }

  try {
    const kunde = await findKundeByKey(key);
    if (!kunde) {
      return bad("Lizenzschlüssel nicht gefunden.", 404);
    }

    await updateKundeField(kunde.rowIndex, "C", "gekündigt");
    await updateKundeProfile(kunde.rowIndex, {
      ...kunde.profile,
      blocked: true,
      blockedAt: new Date().toISOString(),
      tierCanceledAt: kunde.profile?.tierCanceledAt || new Date().toISOString(),
    });

    await logSystemEvent({
      level: "audit",
      actor: "make.com",
      action: "license.cancelled",
      target: key,
      details: { rowIndex: kunde.rowIndex, reason: payload.reason },
    });

    return NextResponse.json({ ok: true, lizenzschluessel: key });
  } catch (err) {
    console.error("[license/cancel]", err);
    return bad("Interner Serverfehler.", 500);
  }
}
