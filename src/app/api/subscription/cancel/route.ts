// POST /api/subscription/cancel
// User-initiated subscription cancel. Two layers:
//
//   1. LOCAL: set profile.tierCanceledAt = now → /api/license/validate
//      will continue to allow access until subscriptionEndsAt elapses
//      (= the period the customer already paid for). The Hub
//      immediately reflects the cancellation in the UI (status badge,
//      no further renewal-driven credit refills will be granted
//      after the next billing cycle because Shopify won't fire
//      orders/paid).
//
//   2. SHOPIFY: call the GraphQL subscriptionContractCancel mutation
//      so Shopify itself stops billing the customer on the next
//      cycle. We need:
//        - SHOPIFY_ADMIN_TOKEN (write_own_subscription_contracts)
//        - SHOPIFY_SHOP_DOMAIN
//        - profile.subscriptionContractId (stored by webhook on first
//          subscription_contracts/create or .../update event)
//      If any of these is missing, we still mark the cancellation
//      locally and return a soft warning telling the user to contact
//      support — never silently leave the user thinking they're
//      cancelled when Shopify will still charge them.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey, updateKundeProfile, logSystemEvent } from "@/lib/sheets";
import { cancelShopifySubscription } from "@/lib/shopify";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  void req;
  const session = await getSession();
  if (!session.isLoggedIn || !session.lizenzschluessel) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const kunde = await findKundeByKey(session.lizenzschluessel);
  if (!kunde) {
    return NextResponse.json({ error: "Konto nicht gefunden." }, { status: 404 });
  }

  // Already cancelled? Return existing state idempotently.
  if (kunde.profile.tierCanceledAt) {
    return NextResponse.json({
      ok: true,
      action: "already-canceled",
      tierCanceledAt: kunde.profile.tierCanceledAt,
      subscriptionEndsAt: kunde.profile.subscriptionEndsAt,
      shopifyCanceled: false,
      message: "Abo war bereits gekündigt.",
    });
  }

  const now = new Date().toISOString();

  // Step 1: local cancel — write it immediately so the UI updates
  // even if Shopify's side is misconfigured.
  await updateKundeProfile(kunde.rowIndex, {
    ...kunde.profile,
    tierCanceledAt: now,
  });

  // Step 2: Shopify-side cancel. Soft-fails — never block the user
  // from cancelling locally because Shopify is unreachable.
  let shopifyCanceled = false;
  let shopifyError: string | undefined;
  const contractId = (kunde.profile.subscriptionContractId || "").trim();
  if (contractId) {
    const cancelResult = await cancelShopifySubscription({ contractId });
    shopifyCanceled = cancelResult.ok;
    shopifyError = cancelResult.error;
  } else {
    shopifyError = "Kein Shopify-Vertrag verknüpft — bitte support@brospify.com kontaktieren um die Wiederkehrenden Zahlungen zu stoppen.";
  }

  void logSystemEvent({
    level: "audit",
    actor: "user.settings",
    action: "subscription.cancel",
    target: kunde.lizenzschluessel,
    details: {
      tierCanceledAt: now,
      subscriptionEndsAt: kunde.profile.subscriptionEndsAt,
      shopifyCanceled,
      shopifyError,
      contractId: contractId || null,
    },
  });

  return NextResponse.json({
    ok: true,
    action: "canceled",
    tierCanceledAt: now,
    subscriptionEndsAt: kunde.profile.subscriptionEndsAt,
    shopifyCanceled,
    shopifyError,
    message: shopifyCanceled
      ? "Dein Abo wurde erfolgreich gekündigt. Du hast bis zum Ende der laufenden Periode Zugriff."
      : "Lokal gekündigt. " + (shopifyError || "Bitte support@brospify.com kontaktieren um die Shopify-Verlängerung zu stoppen."),
  });
}
