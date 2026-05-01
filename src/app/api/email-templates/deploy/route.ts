// ─── POST /api/email-templates/deploy ────────────────────────────
// Pushes the generated Liquid into the user's connected Shopify
// shop by overwriting the matching transactional notification.
//
// Shopify Admin REST API (2024-01) reference:
//   GET  /admin/api/{version}/notifications.json
//        → returns a list with { id, name, subject, body }
//   PUT  /admin/api/{version}/notifications/{id}.json
//        body: { "notification": { "id": <id>, "subject": "…", "body": "…" } }
//
// We:
//   1. Resolve the template's shopifyName → real notification id by
//      listing notifications once.
//   2. PUT the new subject + body (Liquid).
//
// Required Shopify access scope: write_email_templates (or, on
// merchant accounts that still expose it, the legacy
// "write_themes" permission also lets the Admin API edit
// notifications). Make sure your OAuth setup requests the right
// scope.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { shopifyFetch } from "@/lib/shopify";
import { getTemplateById } from "@/lib/email-templates";

interface DeployBody {
  templateId?: string;
  liquid?: string;
  subject?: string;
}

interface ShopifyNotification {
  id: number;
  name: string;
  subject: string;
  body: string;
}

interface NotificationsListResponse {
  notifications: ShopifyNotification[];
}

interface NotificationUpdateResponse {
  notification: ShopifyNotification;
}

export async function POST(req: Request) {
  // ─── Auth ─────────────────────────────────────────────
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }
  if (!session.shopDomain || !session.shopifyToken) {
    return NextResponse.json(
      { error: "Kein verbundener Shopify-Shop in der Session." },
      { status: 400 },
    );
  }

  // ─── Validate input ──────────────────────────────────
  let body: DeployBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }
  if (!body.templateId || !body.liquid || !body.subject) {
    return NextResponse.json(
      { error: "templateId, liquid und subject sind erforderlich." },
      { status: 400 },
    );
  }

  const tpl = getTemplateById(body.templateId);
  if (!tpl) {
    return NextResponse.json({ error: "Unbekannte templateId." }, { status: 404 });
  }

  const { shopDomain, shopifyToken } = session;

  try {
    // ─── 1. List notifications, find the one matching shopifyName
    const list = await shopifyFetch<NotificationsListResponse>({
      domain: shopDomain,
      token: shopifyToken,
      path: "/notifications.json",
    });

    const target = list.notifications.find((n) => n.name === tpl.shopifyName);

    if (!target) {
      return NextResponse.json(
        {
          error:
            `Notification "${tpl.shopifyName}" nicht im Shop gefunden. ` +
            `Stelle sicher, dass dein OAuth-Scope das Bearbeiten von ` +
            `Email-Templates erlaubt (write_email_templates / write_themes).`,
        },
        { status: 404 },
      );
    }

    // ─── 2. PUT the new subject + body
    const updated = await shopifyFetch<NotificationUpdateResponse>({
      domain: shopDomain,
      token: shopifyToken,
      path: `/notifications/${target.id}.json`,
      method: "PUT",
      body: {
        notification: {
          id: target.id,
          subject: body.subject,
          body: body.liquid,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      notificationId: updated.notification.id,
      name: updated.notification.name,
      deployedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    // Common case: 401 from Shopify means the token is stale or scope missing.
    return NextResponse.json(
      {
        error:
          "Push an Shopify fehlgeschlagen. " +
          (message.includes("401")
            ? "Token ungültig oder fehlende Berechtigung (write_email_templates)."
            : message),
      },
      { status: 502 },
    );
  }
}
