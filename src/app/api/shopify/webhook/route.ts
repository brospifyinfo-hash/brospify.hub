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
  ensureStarterGrant,
  normalizeCredits,
  type Kunde,
} from "@/lib/sheets";
import { sendLicenseEmail } from "@/lib/email";
import { writeOrderMetafield } from "@/lib/shopify";
import { tierFromSku, isEditorTier, CANCEL_STATUS, DEFAULT_TIERS, TIER_DISPLAY_LABEL, type TierKey } from "@/lib/tiers-shared";

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
// Breite Substring-Erkennung: matcht auch zusammengesetzte SKUs wie
// „brospify-abo", „abo-21", „member-monthly". „pro"/„kauf" bleiben EXAKT
// (via tierFromSku), damit „product"/„kauf…" nicht versehentlich greifen.
const SUBSCRIPTION_SKU_SUBSTRINGS = [
  "bronze", "silber", "silver", "gold",
  "abo", "member", "mitglied", "mitgliedschaft", "membership",
];
function isSubscriptionSku(sku: string | undefined): boolean {
  const s = (sku || "").trim().toLowerCase();
  if (s === "") return false;
  if (SUBSCRIPTION_SKU_SUBSTRINGS.some((k) => s.includes(k))) return true;
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
  // Bewusst OHNE „brospify" — Credit-Packs heißen oft „Brospify Credits"
  // und dürfen KEINE Lizenz auslösen.
  if (/\bmembership\b|mitglied|mitgliedschaft|\babo\b|\bmember\b/.test(title)) return true;
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

// ─── Editor-Gratis-Konto → echte Mitgliedschaft hochstufen ──────
// Gemeinsam genutzt von orders/paid UND subscription_contracts: eine
// editor-free-Zeile ist KEIN Bestandsabo. Statt sie (falsch) als Renewal
// nur zu verlängern, wird sie zur vollen Membership umgeschrieben:
// SKU-Spalte + Abo-Fenster setzen, Editor-Flags entfernen, den
// 28-Tage-Recurring-Zyklus ab jetzt starten und die 1500 Willkommens-
// Credits idempotent nachtragen (starterGranted:false → ensureStarterGrant).
async function upgradeEditorFreeToMember(
  kunde: Kunde,
  opts: { sku: string; charge?: string; endsAt: string; customerId?: string; contractId?: string },
): Promise<void> {
  const nowIso = new Date().toISOString();
  const tierKey = resolveTierKey(opts.sku);
  await upsertKundeByKey({
    lizenzschluessel: kunde.lizenzschluessel,
    sku: opts.sku,
    charge: opts.charge || undefined,
    subscriptionEndsAt: opts.endsAt,
    profilePatch: {
      editorFree: undefined,
      noRecurringGrant: undefined,
      tier: tierKey,
      tierSince: nowIso,
      tierCanceledAt: undefined,
      creditsStartedAt: undefined,
      recurringPeriodsGranted: 0,
      lastRecurringGrantAt: undefined,
      credits: { ...normalizeCredits(kunde.profile.credits), starterGranted: false },
      shopifyCustomerId: kunde.profile.shopifyCustomerId || opts.customerId || undefined,
      subscriptionContractId: opts.contractId || kunde.profile.subscriptionContractId,
    },
  });
  const fresh = await findKundeByKey(kunde.lizenzschluessel);
  if (fresh) await ensureStarterGrant(fresh.rowIndex, fresh.profile);
  if (["abgelaufen", "expired"].includes((kunde.status || "").trim().toLowerCase())) {
    await updateKundeField(kunde.rowIndex, "C", "aktiv");
  }
}

function isEditorFreeRow(kunde: Kunde): boolean {
  return (
    kunde.profile.editorFree === true ||
    (kunde.sku || "").trim().toLowerCase() === "editor-free"
  );
}

// ─── Editor-Website-Abo (14/23/89€) aktivieren/verlängern ──────────
// Anders als die Hub-Membership (upgradeEditorFreeToMember): KEINE 1500
// Hub-Starter, KEIN 28-Tage-Hub-Zyklus (noRecurringGrant BLEIBT true).
// Die Plan-Credits (monthlyCreditAllowance: 1000/2000/8000) kommen je
// Abrechnungs-Order über applySubscriptionRefill (idempotent per Order),
// so bekommt der Kunde pro Monat genau die Credits seines Plans.
async function activateEditorPlan(
  kunde: Kunde,
  tierKey: TierKey,
  opts: { sku: string; charge?: string; endsAt: string; customerId?: string; contractId?: string; orderName?: string },
): Promise<void> {
  const nowIso = new Date().toISOString();
  await upsertKundeByKey({
    lizenzschluessel: kunde.lizenzschluessel,
    sku: opts.sku,
    charge: opts.charge || undefined,
    subscriptionEndsAt: opts.endsAt,
    profilePatch: {
      editorFree: undefined,        // nicht mehr das Gratis-Konto
      noRecurringGrant: true,       // KEIN Hub-1000/28d-Zyklus
      tier: tierKey,
      tierSince: kunde.profile.tierSince || nowIso, // Startdatum bei Renewal behalten
      tierCanceledAt: undefined,
      shopifyCustomerId: kunde.profile.shopifyCustomerId || opts.customerId || undefined,
      subscriptionContractId: opts.contractId || kunde.profile.subscriptionContractId,
    },
  });
  if (["abgelaufen", "expired"].includes((kunde.status || "").trim().toLowerCase())) {
    await updateKundeField(kunde.rowIndex, "C", "aktiv");
  }
  // Plan-Credits gutschreiben (idempotent per Order).
  const tierDef = DEFAULT_TIERS.find((t) => t.key === tierKey);
  if (tierDef && opts.orderName && tierDef.monthlyCreditAllowance > 0) {
    const fresh = await findKundeByKey(kunde.lizenzschluessel);
    if (fresh) {
      await applySubscriptionRefill(
        fresh.rowIndex,
        fresh.profile,
        tierDef.monthlyCreditAllowance,
        opts.orderName,
        TIER_DISPLAY_LABEL[tierKey],
      );
    }
  }
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
    // WARN + volle Line-Item-Daten (SKU, Variant-ID, Titel), damit man im
    // System-Log sofort sieht, WAS bestellt wurde und warum es nicht als
    // Abo erkannt wurde → exakt das, was zum Matchen fehlt.
    void logSystemEvent({
      level: "warn",
      actor: "shopify.webhook",
      action: "webhook.skipped_non_subscription",
      target: orderName,
      details: {
        shopDomain,
        email,
        lineItems: (payload.line_items || []).map((li) => ({
          sku: li.sku || "",
          variantId: li.variant_id != null ? String(li.variant_id) : "",
          title: li.title || "",
        })),
        knownMembershipVariantIds: [...MEMBERSHIP_VARIANT_IDS],
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

  const existing = await findKundeByEmail(email);

  // ── EDITOR-WEBSITE-ABO (14/23/89€) ───────────────────────────────
  // Eigener Pfad, komplett getrennt von der Hub-Membership: setzt den
  // Editor-Tier + Abo-Fenster, behält noRecurringGrant und schreibt die
  // Plan-Credits gut. Deckt Neukauf, editor-free-Upgrade UND Renewal ab.
  const purchasedTierKey = resolveTierKey(sku);
  if (isEditorTier(purchasedTierKey)) {
    const endsAt = new Date(Date.now() + SUBSCRIPTION_WINDOW_DAYS * DAY_MS).toISOString();
    let kunde = existing;
    if (!kunde) {
      // Direktkäufer ohne vorherige Editor-Registrierung → frische Zeile.
      let key = generateLicenseKey();
      for (let i = 0; i < 3 && (await findKundeByKey(key)); i += 1) key = generateLicenseKey();
      await upsertKundeByKey({
        lizenzschluessel: key,
        status: "aktiv",
        kundenEmail: email,
        bestellnummer: orderName || `EDITOR-PLAN-${key}`,
        sku,
        charge: charge || undefined,
        subscriptionEndsAt: endsAt,
        profilePatch: {
          noRecurringGrant: true,
          hasCompletedOnboarding: true,
          role: "user",
          signupAt: new Date().toISOString(),
          tier: purchasedTierKey,
          tierSince: new Date().toISOString(),
          shopifyCustomerId: customerId || undefined,
        },
      });
      kunde = await findKundeByKey(key);
      if (!kunde) {
        return NextResponse.json({ ok: false, error: "Editor-Plan nicht persistiert." }, { status: 500 });
      }
    }
    await activateEditorPlan(kunde, purchasedTierKey, { sku, charge, endsAt, customerId, orderName });
    if (orderId) {
      await writeOrderMetafield({ orderId, key: "license_key", value: kunde.lizenzschluessel });
    }
    void logSystemEvent({
      level: "audit",
      actor: "shopify.webhook",
      action: "webhook.editor_plan_activated",
      target: kunde.lizenzschluessel,
      details: { shopDomain, orderName, email, sku, plan: purchasedTierKey, via: "order", subscriptionEndsAt: endsAt },
    });
    return NextResponse.json({ ok: true, action: "editor_plan_activated", plan: purchasedTierKey, key: kunde.lizenzschluessel });
  }

  // 2. Renewal: customer already has a licence → extend the window,
  //    keep the same key. Each renewal order rolls subscriptionEndsAt
  //    forward, so the licence stays valid as long as billing runs.
  if (existing) {
    const newEndsAt = new Date(Date.now() + SUBSCRIPTION_WINDOW_DAYS * DAY_MS).toISOString();

    // ── Editor-Gratis-Konto kauft ERSTMALS die Membership ──────────
    // Der Order ist garantiert eine Membership — non-subscription-Orders
    // sind oben via lineItemMintsLicense bereits ausgesiebt. Editor-Zeilen
    // dürfen also nicht als Renewal (nur endsAt) behandelt, sondern müssen
    // zur echten Mitgliedschaft hochgestuft werden.
    if (isEditorFreeRow(existing)) {
      await upgradeEditorFreeToMember(existing, { sku, charge, endsAt: newEndsAt, customerId });
      if (orderId) {
        await writeOrderMetafield({ orderId, key: "license_key", value: existing.lizenzschluessel });
      }
      void logSystemEvent({
        level: "audit",
        actor: "shopify.webhook",
        action: "webhook.editor_upgraded",
        target: existing.lizenzschluessel,
        details: { shopDomain, orderName, email, sku, via: "order", subscriptionEndsAt: newEndsAt },
      });
      return NextResponse.json({ ok: true, action: "editor_upgraded", key: existing.lizenzschluessel });
    }

    // Re-read profile AFTER potential refill to avoid clobbering the
    // credits update. We update tier-window separately from refill so
    // each is independently traceable in the audit log.
    await updateKundeProfile(existing.rowIndex, {
      ...existing.profile,
      subscriptionEndsAt: newEndsAt,
      // Eine bezahlte Verlängerung hebt eine schwebende Kündigung auf —
      // sonst bliebe der Kunde trotz Zahlung nach Periodenende gesperrt
      // (resolvePlan prüft tierCanceledAt).
      tierCanceledAt: undefined,
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
    // Keep the status column live — a renewal un-expires a lapsed row
    // und hebt auch einen Kündigungs-Status auf (der Kunde zahlt ja
    // weiter). Harte Sperren (gesperrt/deaktiviert) bleiben bestehen.
    const renewStatus = (existing.status || "").normalize("NFKC").trim().toLowerCase();
    if (["abgelaufen", "expired"].includes(renewStatus) || CANCEL_STATUS.has(renewStatus)) {
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

  // Editor-Gratis-Zeile im Contract-Webhook: NICHT hochstufen. Der
  // Contract kennt die SKU nicht — ob es die Hub-Membership ODER ein
  // Editor-Plan (14/23/89€) ist, weiß nur der orders/paid-Webhook (der
  // die Line-Item-SKU trägt und immer feuert). Der aktiviert korrekt.
  // Hier also kein Tier setzen, nur überspringen — sonst bekäme ein
  // Editor-Plan-Käufer fälschlich die volle Hub-Membership.
  if (isEditorFreeRow(kunde)) {
    return NextResponse.json({ ok: true, skipped: "editor-free — activation via orders/paid" });
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
