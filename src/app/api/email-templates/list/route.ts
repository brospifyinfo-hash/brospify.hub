/**
 * GET /api/email-templates/list
 *
 * Liefert die 10 Brospify-Top-Templates und — falls der Shop verbunden ist —
 * deren aktuellen Live-Stand aus Shopify (subject + body).
 *
 * Response-Form:
 *   {
 *     templates: Array<EmailTemplateMeta & { live?: { subject, body, id } }>,
 *     shopConnected: boolean,
 *     shopDomain?: string
 *   }
 *
 * Wenn der Shop nicht verbunden ist, liefern wir trotzdem die Metadaten zurück
 * (UI kann das Grid bauen) und setzen `shopConnected: false`. Der Live-Stand
 * fehlt dann.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey } from "@/lib/sheets";
import {
  TOP_10_TEMPLATES,
  listShopifyNotifications,
  type ShopifyNotification,
} from "@/lib/email-templates";

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.isAdmin || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const kunde = await findKundeByKey(session.lizenzschluessel);
    const connected = !!(kunde?.shopifyToken && kunde?.shopDomain);

    if (!connected || !kunde) {
      return NextResponse.json({
        templates: TOP_10_TEMPLATES,
        shopConnected: false,
      });
    }

    // Live-Stand parallel zur Metadaten-Liste auflösen.
    let live: ShopifyNotification[] = [];
    try {
      live = await listShopifyNotifications({
        shopDomain: kunde.shopDomain,
        accessToken: kunde.shopifyToken,
      });
    } catch (err) {
      // Wenn die Notification-API einmal scheitert (z. B. abgelaufenes Token),
      // liefern wir die Templates ohne Live-Stand zurück — die UI zeigt dann
      // "noch nicht angepasst".
      console.error("Notifications GET failed, returning meta only:", err);
    }

    const templates = TOP_10_TEMPLATES.map((meta) => {
      const match = live.find((n) => n.name === meta.key);
      return match
        ? {
            ...meta,
            live: { id: match.id, subject: match.subject, body: match.body },
          }
        : meta;
    });

    return NextResponse.json({
      templates,
      shopConnected: true,
      shopDomain: kunde.shopDomain,
    });
  } catch (error) {
    console.error("email-templates/list error:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Templates." },
      { status: 500 }
    );
  }
}
