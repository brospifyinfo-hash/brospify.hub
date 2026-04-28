/**
 * POST /api/email-templates/deploy
 *
 * Schreibt den generierten Liquid-/HTML-Body in das gewählte Shopify-Notification-
 * Template. "One-Click-Live": Frontend ruft das nach Generierung mit dem aktuell
 * gerenderten Body auf.
 *
 * Body (JSON):
 *   {
 *     templateKey: EmailTemplateKey,
 *     html: string,            // der zu deployende Body (Liquid + HTML)
 *     subject?: string         // optional, sonst bleibt der bisherige Subject
 *   }
 *
 * Response:
 *   { success: true, notification: ShopifyNotification }
 *
 * Fehler-Mapping:
 *   401 — Session ungültig oder Shopify-Token abgelaufen
 *   400 — Validierung (kein Token verbunden, ungültiger Key, leerer Body)
 *   422 — Shopify lehnte das Liquid ab (Detail in `error`)
 *   500 — sonstige Fehler
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey } from "@/lib/sheets";
import { deployByKey, type EmailTemplateKey } from "@/lib/email-templates";

const VALID_KEYS: EmailTemplateKey[] = [
  "order_confirmation",
  "shipping_confirmation",
  "abandoned_checkout",
  "customer_account_welcome",
  "order_refund",
  "shipping_update",
  "customer_account_activate",
  "customer_password_reset",
  "gift_card_notification",
  "order_invoice",
];

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.isAdmin || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await req.json();
    const { templateKey, html, subject } = body ?? {};

    if (!VALID_KEYS.includes(templateKey)) {
      return NextResponse.json(
        { error: "Ungültiger Template-Key." },
        { status: 400 }
      );
    }
    if (typeof html !== "string" || html.trim().length < 30) {
      return NextResponse.json(
        { error: "Body fehlt oder ist zu kurz." },
        { status: 400 }
      );
    }

    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde?.shopifyToken || !kunde?.shopDomain) {
      return NextResponse.json(
        {
          error:
            "Shop ist nicht verbunden. Bitte zuerst in den Einstellungen verbinden.",
        },
        { status: 400 }
      );
    }

    const notification = await deployByKey(
      {
        shopDomain: kunde.shopDomain,
        accessToken: kunde.shopifyToken,
      },
      templateKey,
      html,
      typeof subject === "string" && subject.trim().length > 0
        ? subject.trim()
        : undefined
    );

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("email-templates/deploy error:", msg);

    // Token-Probleme → 401
    if (/401|403|invalid_token/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Shopify-Zugang ungültig. Bitte aktualisiere die Verbindungsdaten.",
        },
        { status: 401 }
      );
    }

    // Liquid-Validierung von Shopify → 422
    if (/422/.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Shopify hat das Liquid-Template abgelehnt. Bitte prüfe den Body oder generiere neu.",
          detail: msg,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: "Deployment fehlgeschlagen. Bitte versuche es erneut." },
      { status: 500 }
    );
  }
}
