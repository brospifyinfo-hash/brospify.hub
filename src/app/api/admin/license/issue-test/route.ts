// ─── POST /api/admin/license/issue-test ─────────────────────────
// Admin-only: stellt manuell einen Lizenzschlüssel für eine E-Mail aus
// — exakt dieselbe Pipeline wie der Shopify orders/paid-Webhook, nur
// OHNE Shopify (kein Webhook/HMAC nötig). Damit kann man:
//   1. einem Kunden direkt einen Key + Mail schicken, und
//   2. testen/diagnostizieren, ob Sheets-Eintrag + Resend-Mail
//      überhaupt funktionieren (jeder Schritt wird einzeln gemeldet).
//
// Body: { email: string, sku?: string }  (sku default "abo")
// Antwort: { ok, key, sheetWritten, sheetError?, action?, emailSent, emailError? }

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey, generateLicenseKey, upsertKundeByKey } from "@/lib/sheets";
import { sendLicenseEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUBSCRIPTION_WINDOW_DAYS = 31;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  let body: { email?: string; sku?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const email = String(body.email || "").trim();
  const sku = String(body.sku || "").trim() || "abo";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Gültige E-Mail erforderlich." }, { status: 400 });
  }

  // 1) Kollisionsfreien Lizenzschlüssel erzeugen.
  let licenseKey = generateLicenseKey();
  for (let i = 0; i < 3; i += 1) {
    const clash = await findKundeByKey(licenseKey);
    if (!clash) break;
    licenseKey = generateLicenseKey();
  }

  // 2) In Google Sheets schreiben (Kunden-Zeile).
  let sheetWritten = false;
  let sheetError: string | undefined;
  let action: string | undefined;
  try {
    const r = await upsertKundeByKey({
      lizenzschluessel: licenseKey,
      status: "aktiv",
      kundenEmail: email,
      bestellnummer: `TEST-${Date.now()}`,
      sku,
      subscriptionEndsAt: new Date(Date.now() + SUBSCRIPTION_WINDOW_DAYS * DAY_MS).toISOString(),
    });
    sheetWritten = true;
    action = r.action;
  } catch (e) {
    sheetError = e instanceof Error ? e.message : "unknown";
  }

  // 3) Lizenz-Mail per Resend schicken.
  let emailSent = false;
  let emailError: string | undefined;
  try {
    const m = await sendLicenseEmail({ to: email, licenseKey, sku });
    emailSent = m.sent;
    emailError = m.error;
  } catch (e) {
    emailError = e instanceof Error ? e.message : "unknown";
  }

  return NextResponse.json({
    ok: sheetWritten && emailSent,
    key: licenseKey,
    sheetWritten,
    sheetError,
    action,
    emailSent,
    emailError,
  });
}
