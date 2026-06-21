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
  applySubscriptionRefill,
  type Kunde,
} from "@/lib/sheets";
import { sendLicenseEmail } from "@/lib/email";
import { writeOrderMetafield } from "@/lib/shopify";
import { tierFromSku, DEFAULT_TIERS, TIER_DISPLAY_LABEL, type TierKey } from "@/lib/tiers-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Laufzeit, die jede bezahlte Bestellung setzt: exakt 31 Tage ab
// Bestelldatum (subscriptionEndsAt = jetzt + 31 Tage).
const SUBSCRIPTION_WINDOW_DAYS = 31;
// Grace added on top of an exact next_billing_date from a contract.
const BILLING_GRACE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Shopify payload subsets (only the fields we read) ──────────
interface ShopifyAddress { first_name?: string; last_name?: string }
interface ShopifyLineItem { sku?: string; title?: string; variant_id?: number | string | null; product_id?: number | string | null }
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

// Welche SKU mintet eine Lizenz?
//  • Legacy-Tiers (bronze/silber/gold) per Substring — "BRONZE",
//    "abo-gold", "BROSPIFY-SILBER" matchen alle.
//  • Aktuelle Membership-SKUs (pro/abo/member/membership/mitglied/
//    mitgliedschaft) exakt über tierFromSku (SKU_TO_TIER) — so mintet
//    auch die neue 21-€-Membership eine Lizenz, ohne dass Credit-Packs
//    oder Einmalprodukte fälschlich eine bekommen.
// WICHTIG: Wenn das 21-€-Produkt eine eigene SKU hat (z. B.
// "brospify-membership"), diese in SKU_TO_TIER (tiers-shared.ts)
// ergänzen, dann greift es hier automatisch.
const LEGACY_SUBSCRIPTION_SKU_KEYS = ["bronze", "silber", "silver", "gold"];
function isSubscriptionSku(sku: string | undefined): boolean {
  const s = (sku || "").trim().toLowerCase();
  if (s === "") return false;
  if (LEGACY_SUBSCRIPTION_SKU_KEYS.some((k) => s.includes(k))) return true;
  return tierFromSku(s) !== null;
}

// Variant-IDs der Abo-Produkte, abgeleitet aus den Tier-CTA-URLs
// (…/cart/<variantId>:1). Das ist das ZUVERLÄSSIGSTE Signal: eine
// Membership-Bestellung mintet damit IMMER eine Lizenz — selbst wenn
// das Produkt (versehentlich) keine oder eine unbekannte SKU hat.
const MEMBERSHIP_VARIANT_IDS = new Set(
  DEFAULT_TIERS
    .map((t) => (t.ctaUrl || "").match(/\/cart\/(\d+)/)?.[1] || "")
    .filter(Boolean),
);

// Entscheidet pro Line-Item, ob es eine Lizenz auslöst. Reihenfolge nach
// Verlässlichkeit: Variant-ID → SKU → Titel. Credit-Packs / Einmal-
// produkte haben andere Variant-IDs und keinen Abo-Titel, bekommen also
// KEINE Lizenz (die Credits laufen über den separaten credits-fulfill-Hook).
function lineItemMintsLicense(li: ShopifyLineItem): boolean {
  const variantId = li.variant_id != null ? String(li.variant_id) : "";
  if (variantId && MEMBERSHIP_VARIANT_IDS.has(variantId)) return true;
  if (isSubscriptionSku(li.sku)) return true;
  const title = (li.title || "").toLowerCase();
  if (/\bmembership\b|mitglied|mitgliedschaft/.test(title)) return true;
  return false;
}

// Wir landen hier NUR für Abo-Bestellungen (Gate oben). Falls die SKU
// nicht auf einen Tier mappt (leere/unbekannte SKU), fallen wir auf den
// einzigen Membership-Tier zurück — so wird die monatliche Credit-
// Gutschrift trotzdem ausgelöst.
const FALLBACK_TIER_KEY: TierKey = DEFAULT_TIERS[0]?.key ?? "pro";
function resolveTierKey(sku: string): TierKey {
  return tierFromSku(sku) ?? FALLBACK_TIER_KEY;
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
  const topic = req.headers.get("x-shopify-topic") || "";
  const shopDomain = req.headers.get("x-shopify-shop-domain") || "";

  if (!verifyHmac(rawBody, headerHmac, expected)) {
    console.warn("[shopify/webhook] HMAC mismatch — request rejected");
    // SICHTBAR machen: ein HMAC-Fehler bedeutet fast immer, dass das im
    // Hub gesetzte SHOPIFY_WEBHOOK_SECRET nicht (mehr) zum Signing-Secret
    // des Shopify-Webhooks passt → Bestellungen kommen nie an, KEINE
    // Lizenz, KEINE Mail. Wird nur für echte Shopify-Requests geloggt
    // (x-shopify-topic gesetzt), damit Scraper die Logs nicht fluten.
    if (topic) {
      void logSystemEvent({
        level: "error",
        actor: "shopify.webhook",
        action: "webhook.hmac_rejected",
        target: topic,
        details: {
          shopDomain,
          hint: "SHOPIFY_WEBHOOK_SECRET im Hub stimmt nicht mit dem Signing-Secret des Shopify-Webhooks überein. In Vercel das korrekte Secret setzen.",
        },
      });
    }
    return NextResponse.json({ ok: false, error: "Ungültige HMAC-Signatur." }, { status: 401 });
  }

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
  const subItem = (payload.line_items || []).find(lineItemMintsLicense);
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
    // Re-read profile AFTER potential refill to avoid clobbering the
    // credits update. We update tier-window separately from refill so
    // each is independently traceable in the audit log.
    await updateKundeProfile(existing.rowIndex, {
      ...existing.profile,
      subscriptionEndsAt: newEndsAt,
      shopifyCustomerId: existing.profile.shopifyCustomerId || customerId || undefined,
    });
    // ── Monthly credits refill ──────────────────────────────────
    // Allowance read from the live tier config (DEFAULT_TIERS or admin
    // override). Idempotent via orderId, so a Shopify retry never
    // double-credits the customer.
    const tierKey = resolveTierKey(sku);
    const tierDef = DEFAULT_TIERS.find((t) => t.key === tierKey) || null;
    let refillAmount = 0;
    let refillStatus: "skipped" | "applied" | "duplicate" | "error" = "skipped";
    if (tierDef && orderName && tierDef.monthlyCreditAllowance > 0) {
      try {
        // Re-fetch profile to pick up the tierSince update we just wrote.
        const fresh = await findKundeByEmail(email);
        if (fresh) {
          const refill = await applySubscriptionRefill(
            fresh.rowIndex,
            fresh.profile,
            tierDef.monthlyCreditAllowance,
            orderName,
            TIER_DISPLAY_LABEL[tierKey],
          );
          refillAmount = tierDef.monthlyCreditAllowance;
          refillStatus = refill.alreadyFulfilled ? "duplicate" : "applied";
        }
      } catch (e) {
        refillStatus = "error";
        console.error("[shopify/webhook] refill failed on renewal:", e);
      }
    }
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
      details: { shopDomain, orderName, email, subscriptionEndsAt: newEndsAt, refillAmount, refillStatus },
    });
    return NextResponse.json({ ok: true, action: "renewed", key: existing.lizenzschluessel, refillAmount, refillStatus });
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

  // SICHERHEITSNETZ: sofort gegenlesen, dass die Zeile WIRKLICH im Sheet
  // gelandet ist. Eine generierte, aber nicht hinterlegte Lizenz darf NIE
  // passieren — lieber 500 (Shopify wiederholt die Bestellung) als eine
  // Mail mit einem Key zu schicken, der im Hub/Sheet fehlt.
  const persisted = await findKundeByKey(licenseKey);
  if (!persisted) {
    console.error("[shopify/webhook] Lizenz nach upsert NICHT auffindbar:", licenseKey);
    void logSystemEvent({
      level: "error",
      actor: "shopify.webhook",
      action: "webhook.persist_failed",
      target: licenseKey,
      details: {
        shopDomain,
        orderName,
        email,
        hint: "upsertKundeByKey warf keine Exception, aber die Zeile ist nicht im Sheet. Google-Sheets-Schreibrechte/Quota oder GOOGLE_SHEET_ID prüfen.",
      },
    });
    return NextResponse.json({ ok: false, error: "Lizenz nicht persistiert." }, { status: 500 });
  }

  // ── Monthly credits refill for the first paid order ────────────
  // Same logic as renewal but on the row we just upserted. We re-read
  // by license key so applySubscriptionRefill operates on the fresh
  // profile that includes the just-set tier/sku from upsertKundeByKey.
  const tierKey = resolveTierKey(sku);
  const tierDef = DEFAULT_TIERS.find((t) => t.key === tierKey) || null;
  let refillAmount = 0;
  let refillStatus: "skipped" | "applied" | "duplicate" | "error" = "skipped";
  if (tierDef && orderName && tierDef.monthlyCreditAllowance > 0) {
    try {
      const fresh = await findKundeByKey(licenseKey);
      if (fresh) {
        const refill = await applySubscriptionRefill(
          fresh.rowIndex,
          fresh.profile,
          tierDef.monthlyCreditAllowance,
          orderName,
          TIER_DISPLAY_LABEL[tierKey],
        );
        refillAmount = tierDef.monthlyCreditAllowance;
        refillStatus = refill.alreadyFulfilled ? "duplicate" : "applied";
      }
    } catch (e) {
      refillStatus = "error";
      console.error("[shopify/webhook] refill failed on new customer:", e);
    }
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

  // Lizenz-Mail IMMER per Resend schicken — zuverlässig und unabhängig
  // davon, ob das Shopify-Confirmation-Template das license_key-Metafeld
  // rendert. Das Metafeld wird zusätzlich gesetzt (oben), schadet nicht.
  const mailResult = await sendLicenseEmail({
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
      deliveryPath: metafieldWritten ? "resend+metafield" : "resend",
      metafieldError,
      emailSent: mailResult.sent,
      emailError: mailResult.error,
      refillAmount, refillStatus,
    },
  });

  return NextResponse.json({
    ok: true,
    action: "created",
    key: licenseKey,
    deliveryPath: metafieldWritten ? "resend+metafield" : "resend",
    refillAmount,
    refillStatus,
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
