// ─── POST /api/license/issue ──────────────────────────────────
// Shopify Flow → Hub. Fires from a "Order paid" trigger to:
//   1. Generate a fresh licence key (idempotent — same orderId
//      returns the same key on retries, so Flow re-runs are safe)
//   2. Create/update the Kunden row with the customer's data
//   3. Return { key, action: "created" | "existing" } so the
//      next Flow step can include the key in the email it sends
//
// This replaces what Make.com previously did (generate key + write
// row + send email). Email-send stays in Shopify Flow via the
// built-in "Send email" action, which references the response body.
//
// Auth: same `X-Api-Key: <LICENSE_WRITE_KEY>` header as /sync and
// /cancel. Server-only secret; do NOT put this in any storefront
// or theme code.

import { NextRequest, NextResponse } from "next/server";
import {
  findKundeByKey,
  findKundeByOrder,
  generateLicenseKey,
  logSystemEvent,
  upsertKundeByKey,
} from "@/lib/sheets";
import { sendLicenseEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface IssueBody {
  kundenEmail?: string;
  shopDomain?: string;
  bestellnummer?: string;
  sku?: string;
  charge?: string;
  shopifyToken?: string;
  /** ISO date/datetime or YYYY-MM-DD. Optional — Shopify Flow can
   *  pass the subscription's nextBillingDate here for time-based gates. */
  subscriptionEndsAt?: string;
  /** Status to write to column C. Default "aktiv". */
  status?: string;
}

function bad(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  const expected = (process.env.LICENSE_WRITE_KEY || "").trim();
  if (!expected) {
    console.error("[license/issue] LICENSE_WRITE_KEY env var not set");
    return bad("Server nicht konfiguriert.", 503);
  }

  const provided = (req.headers.get("x-api-key") || "").trim();
  if (provided !== expected) {
    return bad("Ungültiger API-Key.", 403);
  }

  let payload: IssueBody;
  try {
    payload = (await req.json()) as IssueBody;
  } catch {
    return bad("Body muss JSON sein.", 400);
  }

  // Idempotency: if the same bestellnummer already has a licence,
  // return the existing key. Shopify Flow may retry the HTTP step
  // on transient failures, and we MUST NOT issue a second licence
  // for the same order.
  const bestellnummer = (payload.bestellnummer || "").trim();
  if (bestellnummer) {
    const existing = await findKundeByOrder(bestellnummer);
    if (existing) {
      return NextResponse.json({
        ok: true,
        action: "existing",
        key: existing.lizenzschluessel,
        lizenzschluessel: existing.lizenzschluessel,
      });
    }
  }

  // Normalize optional expiry timestamp.
  let endsAtIso: string | undefined;
  if (typeof payload.subscriptionEndsAt === "string" && payload.subscriptionEndsAt.trim()) {
    const t = Date.parse(payload.subscriptionEndsAt.trim());
    if (!Number.isFinite(t)) {
      return bad("Feld 'subscriptionEndsAt' ist kein gültiges Datum.", 400);
    }
    endsAtIso = new Date(t).toISOString();
  }

  // Generate a unique key. The probability of collision is
  // astronomically low (32^12), but if it ever happens we just
  // re-roll instead of returning a duplicate.
  let key = generateLicenseKey();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const clash = await findKundeByKey(key);
    if (!clash) break;
    key = generateLicenseKey();
  }

  try {
    const result = await upsertKundeByKey({
      lizenzschluessel: key,
      status: payload.status ?? "aktiv",
      shopDomain: payload.shopDomain,
      kundenEmail: payload.kundenEmail,
      bestellnummer,
      charge: payload.charge,
      sku: payload.sku,
      shopifyToken: payload.shopifyToken,
      subscriptionEndsAt: endsAtIso,
    });

    // Lizenz-Mail serverseitig per Resend schicken — NICHT auf den
    // Shopify-Flow-"Send email"-Schritt verlassen. Fail-open: ein
    // Mail-Fehler darf die Key-Ausstellung nie blockieren.
    let emailSent = false;
    let emailError: string | undefined;
    const toEmail = (payload.kundenEmail || "").trim();
    if (toEmail.includes("@")) {
      try {
        const m = await sendLicenseEmail({
          to: toEmail,
          licenseKey: key,
          orderNumber: bestellnummer || undefined,
          sku: payload.sku,
        });
        emailSent = m.sent;
        emailError = m.error;
      } catch (e) {
        emailError = e instanceof Error ? e.message : "unknown";
      }
    }

    await logSystemEvent({
      level: "audit",
      actor: "shopify.flow",
      action: "license.issued",
      target: key,
      details: {
        rowIndex: result.rowIndex,
        bestellnummer,
        kundenEmail: payload.kundenEmail,
        sku: payload.sku,
        subscriptionEndsAt: endsAtIso,
        emailSent,
        emailError,
      },
    });

    return NextResponse.json({
      ok: true,
      action: "created",
      key,
      lizenzschluessel: key,
      rowIndex: result.rowIndex,
      emailSent,
      emailError,
    });
  } catch (err) {
    console.error("[license/issue]", err);
    return bad("Interner Serverfehler.", 500);
  }
}
