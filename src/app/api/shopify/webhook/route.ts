// ─── POST /api/shopify/webhook ───────────────────────────────
// Shopify → Hub. Replaces both Make.com and Shopify Flow. Handles
// two topics for the full Shopify-native subscription lifecycle:
//
//   orders/paid
//     • First order  → generate licence key, write Kunden row,
//                       stamp custom.license_key metafield so the
//                       order-confirmation email renders it.
//     • Renewal order → same customer (matched by email) → push
//                       subscriptionEndsAt forward, keep the key.
//
//   subscription_contracts/update
//     • status active    → set subscriptionEndsAt = next_billing_date
//     • status cancelled / expired / paused → wind the licence down
//       (access stays until the paid period ends, then auto-expires)
//
// The daily expire-cron + /api/license/validate already enforce
// subscriptionEndsAt, so a subscription that simply stops billing
// lapses on its own — these webhooks just keep the date accurate.
//
// HMAC: header X-Shopify-Hmac-Sha256 = base64(HMAC-SHA256(raw, secret)),
// compared timing-safe. Configure both webhooks in Shopify Admin →
// Settings → Notifications → Webhooks; paste the shared secret into
// Vercel as SHOPIFY_WEBHOOK_SECRET.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  findKundeByKey,
  findKundeByOrder,
  findKundeByEmail,
  getAllKunden,
  generateLicenseKey,
  logSystemEvent,
  updateKundeField,
  updateKundeProfile,
  upsertKundeByKey,
  type Kunde,
} from "@/lib/sheets";
import { sendLicenseEmail } from "@/lib/email";
import { writeOrderMetafield } from "@/lib/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rolling window applied on each paid order when we don't have an
// exact next-billing date. Monthly interval (~30d) + 5d grace so a
// brief billing delay never locks a paying customer out.
const SUBSCRIPTION_WINDOW_DAYS = 35;
// Grace added on top of an exact next_billing_date from a contract.
const BILLING_GRACE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Shopify payload subsets (only the fields we read) ──────────
interface ShopifyAddress { first_name?: string; last_name?: string }
interface ShopifyLineItem { sku?: string; title?: string }
interface ShopifyCustomer { id?: number; email?: string; first_name?: string; last_name?: string }
interface ShopifyOrder {
  id?: number;
  name?: string;
  order_number?: number;
  email?: string;
  contact_email?: string;
  total_price?: string;
  customer?: ShopifyCustomer;
  billing_address?: ShopifyAddress;
  shipping_address?: ShopifyAddress;
  line_items?: ShopifyLineItem[];
}
interface ShopifySubscriptionContract {
  id?: number;
  status?: string;            // active | cancelled | expired | failed | paused
  next_billing_date?: string;
  customer_id?: number;
  customer?: ShopifyCustomer;
}

function verifyHmac(rawBody: string, headerHmac: string, secret: string): boolean {
  if (!headerHmac) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  if (digest.length !== headerHmac.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(headerHmac));
  } catch {
    return false;
  }
}

function customerName(c: ShopifyCustomer | undefined, order?: ShopifyOrder): string {
  const first = c?.first_name || order?.billing_address?.first_name || order?.shipping_address?.first_name || "";
  const last = c?.last_name || order?.billing_address?.last_name || order?.shipping_address?.last_name || "";
  return `${first} ${last}`.trim();
}

const STATUS_DEAD = new Set(["cancelled", "canceled", "expired", "failed"]);

// A line item belongs to one of the 3 subscription tiers if its SKU
// contains bronze / silber / gold (case-insensitive substring, so
// "BRONZE", "abo-gold", "BROSPIFY-SILBER" all match). Everything else
// the shop sells — credits, one-off products — does NOT mint a licence.
const SUBSCRIPTION_SKU_KEYS = ["bronze", "silber", "silver", "gold"];
function isSubscriptionSku(sku: string | undefined): boolean {
  const s = (sku || "").toLowerCase();
  return s !== "" && SUBSCRIPTION_SKU_KEYS.some((k) => s.includes(k));
}

export async function POST(req: NextRequest) {
  const expected = (process.env.SHOPIFY_WEBHOOK_SECRET || "").trim();
  if (!expected) {
    console.error("[shopify/webhook] SHOPIFY_WEBHOOK_SECRET env var not set");
    return NextResponse.json({ ok: false, error: "Server nicht konfiguriert." }, { status: 503 });
  }

  // Raw body needed for HMAC — req.json() would consume the stream.
  const rawBody = await req.text();
  const headerHmac = req.headers.get("x-shopify-hmac-sha256") || "";
  if (!verifyHmac(rawBody, headerHmac, expected)) {
    console.warn("[shopify/webhook] HMAC mismatch — request rejected");
    return NextResponse.json({ ok: false, error: "Ungültige HMAC-Signatur." }, { status: 401 });
  }

  const topic = req.headers.get("x-shopify-topic") || "";
  const shopDomain = req.headers.get("x-shopify-shop-domain") || "";

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Body ist kein JSON." }, { status: 400 });
  }

  if (topic === "orders/paid") {
    return handleOrderPaid(payload as ShopifyOrder, shopDomain);
  }
  if (topic === "subscription_contracts/update" || topic === "subscription_contracts/create") {
    return handleSubscriptionUpdate(payload as ShopifySubscriptionContract, shopDomain);
  }

  void logSystemEvent({
    level: "info",
    actor: "shopify.webhook",
    action: "webhook.ignored",
    target: topic,
    details: { shopDomain, reason: "unsupported topic" },
  });
  return NextResponse.json({ ok: true, ignored: true, topic });
}

// ─── orders/paid ────────────────────────────────────────────────
async function handleOrderPaid(payload: ShopifyOrder, shopDomain: string): Promise<NextResponse> {
  const orderName = (payload.name || (payload.order_number ? `#${payload.order_number}` : "")).trim();
  const email = (payload.customer?.email || payload.email || payload.contact_email || "").trim();
  const charge = payload.total_price ? String(payload.total_price) : "";
  const customerId = payload.customer?.id ? String(payload.customer.id) : "";
  const orderId = payload.id;

  // Gate: only the 3 subscription tiers (bronze/silber/gold SKU) mint
  // a licence. Orders for any other product — credits, one-off items —
  // also fire orders/paid but must be ignored here. We pick the first
  // matching line item; its SKU is what gets stored in the sheet.
  const subItem = (payload.line_items || []).find((li) => isSubscriptionSku(li.sku));
  if (!subItem) {
    void logSystemEvent({
      level: "info",
      actor: "shopify.webhook",
      action: "webhook.skipped_non_subscription",
      target: orderName,
      details: {
        shopDomain,
        skus: (payload.line_items || []).map((li) => li.sku).filter(Boolean),
      },
    });
    // 200 — a non-subscription order is a valid event, just not ours.
    return NextResponse.json({ ok: true, skipped: "no subscription SKU" });
  }
  const sku = subItem.sku || "";

  if (!email) {
    void logSystemEvent({
      level: "warn",
      actor: "shopify.webhook",
      action: "webhook.no_email",
      target: orderName,
      details: { shopDomain, orderId },
    });
    // 200 so Shopify stops retrying — no email means nothing to recover.
    return NextResponse.json({ ok: true, skipped: "no customer email" });
  }

  // 1. Exact-retry idempotency: same order seen before → no-op replay.
  if (orderName) {
    const sameOrder = await findKundeByOrder(orderName);
    if (sameOrder) {
      if (orderId) {
        await writeOrderMetafield({ orderId, key: "license_key", value: sameOrder.lizenzschluessel });
      }
      return NextResponse.json({ ok: true, action: "replayed", key: sameOrder.lizenzschluessel });
    }
  }

  // 2. Renewal: customer already has a licence → extend the window,
  //    keep the same key. Each renewal order rolls subscriptionEndsAt
  //    forward, so the licence stays valid as long as billing runs.
  const existing = await findKundeByEmail(email);
  if (existing) {
    const newEndsAt = new Date(Date.now() + SUBSCRIPTION_WINDOW_DAYS * DAY_MS).toISOString();
    await updateKundeProfile(existing.rowIndex, {
      ...existing.profile,
      subscriptionEndsAt: newEndsAt,
      shopifyCustomerId: existing.profile.shopifyCustomerId || customerId || undefined,
    });
    // Keep the status column live — a renewal un-expires a lapsed row.
    if (["abgelaufen", "expired"].includes((existing.status || "").trim().toLowerCase())) {
      await updateKundeField(existing.rowIndex, "C", "aktiv");
    }
    if (orderId) {
      await writeOrderMetafield({ orderId, key: "license_key", value: existing.lizenzschluessel });
    }
    void logSystemEvent({
      level: "audit",
      actor: "shopify.webhook",
      action: "webhook.renewal",
      target: existing.lizenzschluessel,
      details: { shopDomain, orderName, email, subscriptionEndsAt: newEndsAt },
    });
    return NextResponse.json({ ok: true, action: "renewed", key: existing.lizenzschluessel });
  }

  // 3. New customer → fresh licence key.
  let licenseKey = generateLicenseKey();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const clash = await findKundeByKey(licenseKey);
    if (!clash) break;
    licenseKey = generateLicenseKey();
  }
  const endsAt = new Date(Date.now() + SUBSCRIPTION_WINDOW_DAYS * DAY_MS).toISOString();
  try {
    await upsertKundeByKey({
      lizenzschluessel: licenseKey,
      status: "aktiv",
      kundenEmail: email,
      shopDomain,
      bestellnummer: orderName,
      sku,
      charge,
      subscriptionEndsAt: endsAt,
      profilePatch: customerId ? { shopifyCustomerId: customerId } : undefined,
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
    // 500 → Shopify retries; the order is real, a Sheets hiccup is transient.
    return NextResponse.json({ ok: false, error: "Sheet-Fehler." }, { status: 500 });
  }

  // Primary delivery: stamp the key onto the order so Shopify's own
  // confirmation email renders {{ order.metafields.custom.license_key }}.
  let metafieldWritten = false;
  let metafieldError: string | undefined;
  if (orderId) {
    const mf = await writeOrderMetafield({ orderId, key: "license_key", value: licenseKey });
    metafieldWritten = mf.ok;
    metafieldError = mf.error;
  }

  // Fallback delivery: Resend, only when the metafield path is off.
  const mailResult = metafieldWritten
    ? { sent: false, error: undefined as string | undefined }
    : await sendLicenseEmail({
        to: email,
        customerName: customerName(payload.customer, payload) || undefined,
        licenseKey,
        orderNumber: orderName,
        sku,
      });

  void logSystemEvent({
    level: "audit",
    actor: "shopify.webhook",
    action: "webhook.issued",
    target: licenseKey,
    details: {
      shopDomain, orderName, email, sku, charge,
      deliveryPath: metafieldWritten ? "shopify-metafield" : "resend",
      metafieldError,
      emailSent: mailResult.sent,
      emailError: mailResult.error,
    },
  });

  return NextResponse.json({
    ok: true,
    action: "created",
    key: licenseKey,
    deliveryPath: metafieldWritten ? "shopify-metafield" : "resend",
  });
}

// ─── subscription_contracts/update ──────────────────────────────
async function handleSubscriptionUpdate(
  payload: ShopifySubscriptionContract,
  shopDomain: string,
): Promise<NextResponse> {
  const contractId = payload.id ? String(payload.id) : "";
  const customerId = payload.customer_id ? String(payload.customer_id) : "";
  const email = (payload.customer?.email || "").trim().toLowerCase();
  const status = (payload.status || "").trim().toLowerCase();

  // Resolve the licence row. Try the most precise key first:
  // contract id → customer id → email.
  let kunde: Kunde | null = null;
  const all = await getAllKunden();
  if (contractId) {
    kunde = all.find((k) => k.profile.subscriptionContractId === contractId) || null;
  }
  if (!kunde && customerId) {
    kunde = all.find((k) => k.profile.shopifyCustomerId === customerId) || null;
  }
  if (!kunde && email) {
    kunde = await findKundeByEmail(email);
  }

  if (!kunde) {
    void logSystemEvent({
      level: "warn",
      actor: "shopify.webhook",
      action: "webhook.sub_no_match",
      target: contractId || customerId || email,
      details: { shopDomain, status },
    });
    // 200 — nothing to retry; the licence simply isn't in the sheet.
    return NextResponse.json({ ok: true, skipped: "no matching licence" });
  }

  // Compute the new expiry. Active subscriptions expire at the next
  // billing date (+ grace); dead ones at the same date but no later —
  // the customer keeps access for the period they already paid for.
  const nextBilling = payload.next_billing_date ? Date.parse(payload.next_billing_date) : NaN;
  const isDead = STATUS_DEAD.has(status);
  let endsAt: string;
  if (Number.isFinite(nextBilling)) {
    endsAt = new Date(nextBilling + BILLING_GRACE_DAYS * DAY_MS).toISOString();
  } else if (isDead) {
    // Cancelled with no date → end of the rolling window we last set,
    // or now if there wasn't one.
    endsAt = kunde.profile.subscriptionEndsAt || new Date().toISOString();
  } else {
    endsAt = new Date(Date.now() + SUBSCRIPTION_WINDOW_DAYS * DAY_MS).toISOString();
  }

  await updateKundeProfile(kunde.rowIndex, {
    ...kunde.profile,
    subscriptionEndsAt: endsAt,
    subscriptionContractId: contractId || kunde.profile.subscriptionContractId,
    shopifyCustomerId: customerId || kunde.profile.shopifyCustomerId,
  });

  // Keep the human-readable status column in sync. The live gate at
  // /api/license/validate keys off subscriptionEndsAt regardless, but
  // the column drives the admin Lizenzen tab + the daily cron.
  if (isDead) {
    await updateKundeField(kunde.rowIndex, "C", "gekündigt");
  } else if (status === "active") {
    await updateKundeField(kunde.rowIndex, "C", "aktiv");
  }

  void logSystemEvent({
    level: "audit",
    actor: "shopify.webhook",
    action: `webhook.subscription_${isDead ? "ended" : "synced"}`,
    target: kunde.lizenzschluessel,
    details: { shopDomain, status, contractId, subscriptionEndsAt: endsAt },
  });

  return NextResponse.json({ ok: true, action: "subscription-synced", status, key: kunde.lizenzschluessel });
}
