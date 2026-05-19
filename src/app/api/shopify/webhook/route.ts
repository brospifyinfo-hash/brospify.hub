// ─── POST /api/shopify/webhook ───────────────────────────────
// Shopify → Hub. Replaces both Make.com and Shopify Flow:
// Shopify fires this endpoint on every `orders/paid` event,
// Hub verifies the HMAC signature, generates a licence key,
// writes the Kunden row, and sends the customer the key via
// Resend — all in one round-trip.
//
// Configuration in Shopify Admin (one-time):
//   Settings → Notifications → Webhooks → Create webhook
//     Event:  Order paid
//     Format: JSON
//     URL:    https://hub.brospify.com/api/shopify/webhook
//     → Shopify reveals a "Shared secret" once
//   Paste that secret into Vercel as SHOPIFY_WEBHOOK_SECRET.
//
// HMAC verification rules per Shopify:
//   header X-Shopify-Hmac-Sha256 = base64(HMAC-SHA256(rawBody, secret))
// We compare with timing-safe equal to thwart side-channel guesses.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
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

// Subset of Shopify's orders/paid payload — we only touch what
// we need. Shopify sends much more; everything else is ignored.
interface ShopifyAddress {
  first_name?: string;
  last_name?: string;
}
interface ShopifyLineItem {
  sku?: string;
  title?: string;
}
interface ShopifyCustomer {
  email?: string;
  first_name?: string;
  last_name?: string;
}
interface ShopifyOrder {
  id?: number;
  name?: string;                  // e.g. "#1024"
  order_number?: number;
  email?: string;
  contact_email?: string;
  total_price?: string;
  currency?: string;
  customer?: ShopifyCustomer;
  billing_address?: ShopifyAddress;
  shipping_address?: ShopifyAddress;
  line_items?: ShopifyLineItem[];
}

function verifyHmac(rawBody: string, headerHmac: string, secret: string): boolean {
  if (!headerHmac) return false;
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  // Timing-safe compare; require equal length to avoid throwing.
  if (digest.length !== headerHmac.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(headerHmac));
  } catch {
    return false;
  }
}

function customerName(order: ShopifyOrder): string {
  const c = order.customer || {};
  const first = c.first_name || order.billing_address?.first_name || order.shipping_address?.first_name || "";
  const last = c.last_name || order.billing_address?.last_name || order.shipping_address?.last_name || "";
  return `${first} ${last}`.trim();
}

export async function POST(req: NextRequest) {
  const expected = (process.env.SHOPIFY_WEBHOOK_SECRET || "").trim();
  if (!expected) {
    console.error("[shopify/webhook] SHOPIFY_WEBHOOK_SECRET env var not set");
    return NextResponse.json({ ok: false, error: "Server nicht konfiguriert." }, { status: 503 });
  }

  // We need the RAW body for HMAC; req.json() consumes the stream
  // and discards the original bytes. Reading as text is the right
  // primitive here.
  const rawBody = await req.text();
  const headerHmac = req.headers.get("x-shopify-hmac-sha256") || "";
  if (!verifyHmac(rawBody, headerHmac, expected)) {
    console.warn("[shopify/webhook] HMAC mismatch — request rejected");
    return NextResponse.json({ ok: false, error: "Ungültige HMAC-Signatur." }, { status: 401 });
  }

  // Parse only after we know the signature is good.
  let payload: ShopifyOrder;
  try {
    payload = JSON.parse(rawBody) as ShopifyOrder;
  } catch {
    return NextResponse.json({ ok: false, error: "Body ist kein JSON." }, { status: 400 });
  }

  const topic = req.headers.get("x-shopify-topic") || "";
  const shopDomain = req.headers.get("x-shopify-shop-domain") || "";

  // We only act on orders/paid for now. Other events (cancellations,
  // refunds) are intentionally ignored — explicit handlers will be
  // added when they're needed.
  if (topic !== "orders/paid") {
    void logSystemEvent({
      level: "info",
      actor: "shopify.webhook",
      action: "webhook.ignored",
      target: topic,
      details: { shopDomain, reason: "unsupported topic" },
    });
    return NextResponse.json({ ok: true, ignored: true, topic });
  }

  const orderName = (payload.name || (payload.order_number ? `#${payload.order_number}` : "")).trim();
  const email = (payload.customer?.email || payload.email || payload.contact_email || "").trim();
  const sku = payload.line_items?.find((li) => li.sku)?.sku || "";
  const charge = payload.total_price ? String(payload.total_price) : "";

  if (!email) {
    void logSystemEvent({
      level: "warn",
      actor: "shopify.webhook",
      action: "webhook.no_email",
      target: orderName,
      details: { shopDomain, orderId: payload.id },
    });
    // Still 200 so Shopify doesn't retry forever — we have no
    // address to recover the situation, so retrying is pointless.
    return NextResponse.json({ ok: true, skipped: "no customer email" });
  }

  // Idempotency: same order arrives twice (Shopify retries on
  // 5xx, or merchants test from the admin) → return existing key.
  let licenseKey = "";
  let action: "created" | "existing" = "created";
  if (orderName) {
    const existing = await findKundeByOrder(orderName);
    if (existing) {
      licenseKey = existing.lizenzschluessel;
      action = "existing";
    }
  }

  if (!licenseKey) {
    licenseKey = generateLicenseKey();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const clash = await findKundeByKey(licenseKey);
      if (!clash) break;
      licenseKey = generateLicenseKey();
    }
    try {
      await upsertKundeByKey({
        lizenzschluessel: licenseKey,
        status: "aktiv",
        kundenEmail: email,
        shopDomain,
        bestellnummer: orderName,
        sku,
        charge,
      });
    } catch (err) {
      console.error("[shopify/webhook] upsert failed:", err);
      void logSystemEvent({
        level: "error",
        actor: "shopify.webhook",
        action: "webhook.upsert_failed",
        target: orderName,
        details: { shopDomain, error: err instanceof Error ? err.message : "unknown" },
      });
      // Return 500 so Shopify retries — the order is real and the
      // customer is owed a key; Sheets hiccups are transient.
      return NextResponse.json({ ok: false, error: "Sheet-Fehler." }, { status: 500 });
    }
  }

  // Send the licence email. If Resend isn't configured this fails
  // open and only logs — the row is already in the sheet, so the
  // operator can still recover via the admin Lizenzen tab.
  const mailResult = await sendLicenseEmail({
    to: email,
    customerName: customerName(payload) || undefined,
    licenseKey,
    orderNumber: orderName,
    sku,
  });

  void logSystemEvent({
    level: "audit",
    actor: "shopify.webhook",
    action: `webhook.${action === "existing" ? "replayed" : "issued"}`,
    target: licenseKey,
    details: {
      shopDomain,
      orderName,
      email,
      sku,
      charge,
      emailSent: mailResult.sent,
      emailError: mailResult.error,
    },
  });

  return NextResponse.json({
    ok: true,
    action,
    key: licenseKey,
    emailSent: mailResult.sent,
  });
}
