import { NextRequest, NextResponse } from "next/server";
import { upsertKundeByKey, logSystemEvent, type KundeUpsertInput } from "@/lib/sheets";

// ─── POST /api/license/sync ───────────────────────────────────
// Make.com → Hub upsert. Replaces Make's previous direct-to-Sheet
// write, so the Sheet is firewalled behind one endpoint with one
// shared secret that we can rotate without touching every Make
// scenario.
//
// Auth: header `X-Api-Key: <LICENSE_WRITE_KEY>`. This key is
// SEPARATE from the storefront-facing LICENSE_API_KEY — the read
// key lives in the theme HTML and is therefore semi-public; the
// write key must never appear in any client-shipped code.
//
// Body (JSON): see KundeUpsertInput in lib/sheets.ts. Only
// `lizenzschluessel` is required; all other fields are optional
// and skipped if undefined, so a renewal call carrying only
// { lizenzschluessel, subscriptionEndsAt } won't overwrite the
// rest of the row.
//
// Behavior is idempotent: re-calling with the same key updates
// in place. Make can safely retry on network errors.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  const expected = (process.env.LICENSE_WRITE_KEY || "").trim();

  // Fail CLOSED on writes — unlike validate (which fails open to
  // protect storefronts), an unconfigured write key MUST refuse
  // requests. Anything else would let a deployment without the
  // env-var accept anonymous writes.
  if (!expected) {
    console.error("[license/sync] LICENSE_WRITE_KEY env var not set");
    return bad("Server nicht konfiguriert.", 503);
  }

  const provided = (req.headers.get("x-api-key") || "").trim();
  if (provided !== expected) {
    return bad("Ungültiger API-Key.", 403);
  }

  let payload: Partial<KundeUpsertInput>;
  try {
    payload = (await req.json()) as Partial<KundeUpsertInput>;
  } catch {
    return bad("Body muss JSON sein.", 400);
  }

  const key = (payload?.lizenzschluessel || "").trim();
  if (!key) {
    return bad("Feld 'lizenzschluessel' fehlt.", 400);
  }

  // Normalize subscriptionEndsAt to ISO so the validator's
  // Date.parse always sees a clean string. Accept either a full
  // ISO timestamp ("2026-12-31T00:00:00Z") or a YYYY-MM-DD date —
  // the latter is what Make sends most easily.
  let endsAtIso: string | undefined;
  if (typeof payload.subscriptionEndsAt === "string" && payload.subscriptionEndsAt.trim()) {
    const raw = payload.subscriptionEndsAt.trim();
    const t = Date.parse(raw);
    if (!Number.isFinite(t)) {
      return bad("Feld 'subscriptionEndsAt' ist kein gültiges Datum.", 400);
    }
    endsAtIso = new Date(t).toISOString();
  }

  try {
    const result = await upsertKundeByKey({
      lizenzschluessel: key,
      status: payload.status,
      shopDomain: payload.shopDomain,
      kundenEmail: payload.kundenEmail,
      bestellnummer: payload.bestellnummer,
      charge: payload.charge,
      suplied: payload.suplied,
      sku: payload.sku,
      shopifyToken: payload.shopifyToken,
      subscriptionEndsAt: endsAtIso,
    });

    await logSystemEvent({
      level: "audit",
      actor: "make.com",
      action: `license.${result.action}`,
      target: key,
      details: {
        rowIndex: result.rowIndex,
        sku: payload.sku,
        status: payload.status,
        subscriptionEndsAt: endsAtIso,
      },
    });

    return NextResponse.json({
      ok: true,
      action: result.action,
      rowIndex: result.rowIndex,
      lizenzschluessel: key,
    });
  } catch (err) {
    console.error("[license/sync]", err);
    return bad("Interner Serverfehler.", 500);
  }
}
