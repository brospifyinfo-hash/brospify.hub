// ─── POST /api/shopify/webhooks/credits-fulfill ──────────────────
// Shopify "orders/paid" (or "orders/create") webhook target. Tops up
// the customer's credit balance the moment a credit-pack purchase
// settles in the brospify.com store.
//
// Configure on Shopify side:
//   Settings → Notifications → Webhooks
//   Event:  Order payment / Order creation
//   URL:    https://hub.brospify.com/api/shopify/webhooks/credits-fulfill
//   Format: JSON
//   Secret: env SHOPIFY_WEBHOOK_SECRET
//
// Idempotency: every successful top-up appends the order ID to
// `profile.credits.fulfilledOrders` — replays from Shopify (it does
// retry on non-2xx) cannot double-credit a customer.
//
// SECURITY: HMAC verification is mandatory. If SHOPIFY_WEBHOOK_SECRET
// is missing in production we 503 rather than silently skipping it.

import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  addCredits,
  findKundeByEmail,
  getKundeProfile,
} from "@/lib/sheets";
import { packageByVariantId } from "@/lib/credit-costs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ShopifyWebhookLineItem {
  variant_id: number | string | null;
  product_id?: number | string | null;
  quantity: number;
  title?: string;
  sku?: string | null;
}

interface ShopifyWebhookOrder {
  id: number | string;
  order_number?: number;
  email?: string | null;
  contact_email?: string | null;
  financial_status?: string;
  customer?: { email?: string | null } | null;
  line_items?: ShopifyWebhookLineItem[];
}

function timingSafeEq(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function verifyHmac(rawBody: string, hmacHeader: string | null): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret || !hmacHeader) return false;
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  return timingSafeEq(digest, hmacHeader);
}

export async function POST(req: Request) {
  // Read the raw body text — must be the EXACT byte stream Shopify
  // signed, so don't run req.json() before HMAC verification.
  const rawBody = await req.text();
  const hmacHeader = req.headers.get("x-shopify-hmac-sha256");

  // In production we require a configured secret. In dev we let the
  // call through so a tunnel + Shopify CLI can be exercised.
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Webhook fulfill] SHOPIFY_WEBHOOK_SECRET not set in production");
      return NextResponse.json({ error: "webhook secret not configured" }, { status: 503 });
    }
    console.warn("[Webhook fulfill] SHOPIFY_WEBHOOK_SECRET missing — skipping HMAC (dev only)");
  } else if (!verifyHmac(rawBody, hmacHeader)) {
    console.warn("[Webhook fulfill] HMAC verification failed");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let order: ShopifyWebhookOrder;
  try {
    order = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const orderId = String(order.id ?? "").trim();
  if (!orderId) {
    return NextResponse.json({ error: "missing order id" }, { status: 400 });
  }

  // Only act on paid orders. Shopify also fires this hook on
  // create/update; "paid" is the only state that should top up.
  if (order.financial_status && order.financial_status !== "paid") {
    return NextResponse.json({
      ok: true,
      skipped: `financial_status=${order.financial_status}`,
    });
  }

  const customerEmail =
    (order.email || order.contact_email || order.customer?.email || "")
      .trim()
      .toLowerCase();
  if (!customerEmail) {
    console.warn(`[Webhook fulfill] order ${orderId} has no email — cannot fulfil`);
    return NextResponse.json({ ok: true, skipped: "no customer email" });
  }

  // Sum every credit-pack line item in the order. A customer COULD
  // buy two different packs in one checkout — we credit them all.
  const items = order.line_items || [];
  let creditsToAdd = 0;
  const matchedPackages: { variantId: string; credits: number; quantity: number }[] = [];
  for (const li of items) {
    const variantId = li.variant_id != null ? String(li.variant_id) : "";
    const pkg = packageByVariantId(variantId);
    if (!pkg) continue;
    const quantity = Math.max(1, Math.round(li.quantity ?? 1));
    creditsToAdd += pkg.credits * quantity;
    matchedPackages.push({
      variantId: pkg.variantId,
      credits: pkg.credits,
      quantity,
    });
  }

  if (creditsToAdd <= 0) {
    return NextResponse.json({
      ok: true,
      skipped: "no credit-pack line items in order",
    });
  }

  // Locate the customer in our sheet by email.
  const kunde = await findKundeByEmail(customerEmail);
  if (!kunde) {
    console.warn(
      `[Webhook fulfill] order ${orderId}: no Brospify customer for email ${customerEmail}`,
    );
    // Return 200 so Shopify stops retrying — we'll surface the orphan
    // through logs so support can manually credit the user.
    return NextResponse.json({
      ok: true,
      skipped: "no matching brospify customer for email",
      email: customerEmail,
    });
  }

  // Re-read profile fresh (the sheet might have changed since
  // findKundeByEmail loaded the row).
  const profile = await getKundeProfile(kunde.rowIndex);
  const result = await addCredits(kunde.rowIndex, profile, creditsToAdd, orderId);

  console.log(
    `[Webhook fulfill] order ${orderId} → ${customerEmail}: +${creditsToAdd} credits` +
      (result.alreadyFulfilled ? " (idempotent skip)" : ` → balance ${result.balance}`),
  );

  return NextResponse.json({
    ok: true,
    orderId,
    email: customerEmail,
    creditsAdded: result.alreadyFulfilled ? 0 : creditsToAdd,
    balance: result.balance,
    alreadyFulfilled: result.alreadyFulfilled,
    matched: matchedPackages,
  });
}

// Shopify pings GET sometimes when validating the URL — return 200.
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "credits-fulfill webhook" });
}
