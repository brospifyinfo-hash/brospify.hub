// ─── POST /api/admin/license/manual ─────────────────────────────
// Admin-only: stellt manuell eine ECHTE Lizenz für eine E-Mail aus —
// gleiche Pipeline wie der Shopify-Webhook (Key → Sheet-Zeile → Mail),
// aber ohne Shopify. Für sauberes Nachtragen betroffener Kunden.
//
// Unterschied zu /issue-test: echte/eigene Bestellnummer (kein „TEST-…",
// wird also NICHT vom Test-Cleanup gelöscht) + De-Duplizierung über die
// E-Mail (existiert der Kunde schon, wird seine Lizenz reaktiviert /
// verlängert statt eine zweite Zeile anzulegen).
//
// Body: { email: string, orderNumber?: string, sku?: string }
// Antwort: { ok, key, action, sheetWritten, sheetError?, emailSent, emailError? }

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  findKundeByEmail,
  findKundeByKey,
  generateLicenseKey,
  upsertKundeByKey,
} from "@/lib/sheets";
import { sendLicenseEmail } from "@/lib/email";
import { resolveTier, tierFromSku } from "@/lib/tiers-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUBSCRIPTION_WINDOW_DAYS = 31;
const DAY_MS = 24 * 60 * 60 * 1000;

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `MANUELL-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  let body: { email?: string; orderNumber?: string; sku?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const email = String(body.email || "").trim();
  // requestedSku = vom Admin BEWUSST gewählt; ohne Angabe gilt "abo" nur
  // für NEUE Zeilen — bei Bestandskunden bleibt deren Plan erhalten.
  const requestedSku = String(body.sku || "").trim();
  const sku = requestedSku || "abo";
  const orderNumber = String(body.orderNumber || "").trim() || stamp();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Gültige E-Mail erforderlich." }, { status: 400 });
  }

  const endsAt = new Date(Date.now() + SUBSCRIPTION_WINDOW_DAYS * DAY_MS).toISOString();

  let licenseKey = "";
  let action: "created" | "renewed" = "created";
  let sheetWritten = false;
  let sheetError: string | undefined;

  try {
    // De-Dup: existiert für die E-Mail schon eine Lizenz → reaktivieren
    // + Laufzeit setzen, gleichen Key behalten (keine zweite Zeile).
    // Plan-Felder wie der Shopify-Webhook mitschreiben — sonst hat eine
    // manuell ausgestellte Lizenz zwar SKU/Status, aber keinen profile.tier
    // und taucht im Admin als „Kein Plan" auf.
    const nowIso = new Date().toISOString();
    const existing = await findKundeByEmail(email);
    if (existing) {
      // Bestehenden Plan NICHT stillschweigend überschreiben: nur eine
      // explizit mitgegebene SKU ändert den Plan (z. B. editor-pro →
      // hub-membership); sonst bleibt der eingetragene Plan bestehen.
      const keepTier =
        resolveTier(existing.profile.tier) || tierFromSku(existing.sku) || null;
      const tierKey = requestedSku
        ? tierFromSku(requestedSku) || "pro"
        : keepTier || "pro";
      licenseKey = existing.lizenzschluessel;
      action = "renewed";
      await upsertKundeByKey({
        lizenzschluessel: licenseKey,
        status: "aktiv",
        subscriptionEndsAt: endsAt,
        profilePatch: {
          tier: tierKey,
          tierSince: existing.profile.tierSince || nowIso,
          tierCanceledAt: undefined,
          blocked: undefined,
        },
      });
      sheetWritten = true;
    } else {
      // Kollisionsfreien Key erzeugen.
      licenseKey = generateLicenseKey();
      for (let i = 0; i < 3; i += 1) {
        const clash = await findKundeByKey(licenseKey);
        if (!clash) break;
        licenseKey = generateLicenseKey();
      }
      await upsertKundeByKey({
        lizenzschluessel: licenseKey,
        status: "aktiv",
        kundenEmail: email,
        bestellnummer: orderNumber,
        sku,
        subscriptionEndsAt: endsAt,
        profilePatch: {
          tier: tierFromSku(sku) || "pro",
          tierSince: nowIso,
        },
      });
      sheetWritten = true;
    }
  } catch (e) {
    sheetError = e instanceof Error ? e.message : "unknown";
  }

  // Mail mit dem Key schicken (immer, damit der Kunde reinkommt).
  let emailSent = false;
  let emailError: string | undefined;
  if (licenseKey) {
    try {
      const m = await sendLicenseEmail({ to: email, licenseKey, orderNumber, sku });
      emailSent = m.sent;
      emailError = m.error;
    } catch (e) {
      emailError = e instanceof Error ? e.message : "unknown";
    }
  }

  return NextResponse.json({
    ok: sheetWritten && emailSent,
    key: licenseKey,
    action,
    sheetWritten,
    sheetError,
    emailSent,
    emailError,
  });
}
