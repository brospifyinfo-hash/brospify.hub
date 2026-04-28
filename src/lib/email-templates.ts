/**
 * Email-Template-Engine — Brospify Hub
 *
 * Definiert die Top-10 Shopify-Notification-Templates, die Brospify-Nutzer per
 * KI generieren und mit einem Klick in ihren Shop deployen können.
 *
 * Shopify-Hintergrund:
 *   Shopify hostet pro Shop eine feste Liste an Notification-Templates
 *   (Bestellbestätigung, Versand, etc.). Jedes Template hat einen kanonischen
 *   `name` (z. B. "order_confirmation") und einen Body in Liquid + HTML, der
 *   per Admin-API mutiert werden kann. Die Endpoints sind:
 *     - GET    /admin/api/2024-01/notifications.json
 *     - PUT    /admin/api/2024-01/notifications/{id}.json
 *
 *   Wir adressieren Templates über `name`, weil die `id` shop-spezifisch ist.
 */

export type EmailTemplateKey =
  | "order_confirmation"
  | "shipping_confirmation"
  | "abandoned_checkout"
  | "customer_account_welcome"
  | "order_refund"
  | "shipping_update"
  | "customer_account_activate"
  | "customer_password_reset"
  | "gift_card_notification"
  | "order_invoice";

export interface EmailTemplateMeta {
  /** Kanonischer Shopify-Notification-Name (1:1 wie in der API). */
  key: EmailTemplateKey;
  /** Anzeigename für die UI (deutsch). */
  title: string;
  /** Kurze Beschreibung — wird auf der Card und im Editor genutzt. */
  description: string;
  /** Lucide-Icon-Name (siehe `lucide-react`). */
  icon: string;
  /** Wann diese E-Mail in Shopify ausgelöst wird — als Hint für den Nutzer. */
  trigger: string;
  /** Standard-Subject (kann im Editor überschrieben werden). */
  defaultSubject: string;
}

/**
 * Die 10 wichtigsten automatisierten E-Mails eines Shopify-Shops.
 * Reihenfolge bestimmt das Grid-Layout (1 = oben links).
 */
export const TOP_10_TEMPLATES: EmailTemplateMeta[] = [
  {
    key: "order_confirmation",
    title: "Bestellbestätigung",
    description:
      "Die wichtigste E-Mail nach dem Kauf — bestätigt Auftrag, Summe und Lieferadresse.",
    icon: "ShoppingBag",
    trigger: "Direkt nach Kaufabschluss",
    defaultSubject: "Deine Bestellung {{ order.name }} ist eingegangen",
  },
  {
    key: "shipping_confirmation",
    title: "Versandbestätigung",
    description:
      "Informiert den Kunden, dass das Paket unterwegs ist — inkl. Tracking-Link.",
    icon: "Truck",
    trigger: "Sobald Tracking-Nummer vergeben wurde",
    defaultSubject: "Deine Bestellung {{ order.name }} ist auf dem Weg",
  },
  {
    key: "abandoned_checkout",
    title: "Warenkorbabbruch",
    description:
      "Holt verlorene Käufer zurück — der größte Umsatz-Hebel im E-Commerce.",
    icon: "ShoppingCart",
    trigger: "10 Stunden nach Checkout-Abbruch",
    defaultSubject: "Du hast etwas in deinem Warenkorb vergessen",
  },
  {
    key: "customer_account_welcome",
    title: "Willkommens-Mail",
    description:
      "Erste Berührung mit Neukunden — perfekt für Markenpositionierung & Rabatt.",
    icon: "Sparkles",
    trigger: "Nach Account-Erstellung",
    defaultSubject: "Willkommen bei {{ shop.name }}",
  },
  {
    key: "order_refund",
    title: "Rückerstattung",
    description:
      "Bestätigt erstattete Beträge und nennt den Erstattungs-Zeitraum.",
    icon: "RefreshCcw",
    trigger: "Bei Auslösen einer Rückerstattung",
    defaultSubject: "Rückerstattung für Bestellung {{ order.name }}",
  },
  {
    key: "shipping_update",
    title: "Lieferungs-Update",
    description:
      "Updates zum Sendungsstatus — z. B. wenn der Versanddienstleister Daten ändert.",
    icon: "PackageSearch",
    trigger: "Bei Tracking-Update durch Carrier",
    defaultSubject: "Update zu deiner Sendung {{ order.name }}",
  },
  {
    key: "customer_account_activate",
    title: "Konto aktivieren",
    description:
      "Für Shops mit klassischem Account-Flow — Aktivierungs-Link an den Kunden.",
    icon: "UserCheck",
    trigger: "Nach Aktivierungs-Aufforderung",
    defaultSubject: "Aktiviere dein {{ shop.name }} Konto",
  },
  {
    key: "customer_password_reset",
    title: "Passwort zurücksetzen",
    description:
      "Sicherheitsrelevante Mail — sollte minimalistisch und vertrauenswürdig wirken.",
    icon: "KeyRound",
    trigger: "Bei Klick auf 'Passwort vergessen?'",
    defaultSubject: "Setze dein Passwort zurück",
  },
  {
    key: "gift_card_notification",
    title: "Geschenkkarte",
    description:
      "Übermittelt einen Geschenkgutschein — emotional & geschmackvoll wirken!",
    icon: "Gift",
    trigger: "Beim Kauf einer Geschenkkarte",
    defaultSubject: "Deine Geschenkkarte von {{ shop.name }}",
  },
  {
    key: "order_invoice",
    title: "Rechnung",
    description:
      "Versendet die Rechnung als PDF — für B2B & Steuerunterlagen relevant.",
    icon: "FileText",
    trigger: "Manuell vom Händler ausgelöst",
    defaultSubject: "Rechnung zu Bestellung {{ order.name }}",
  },
];

export function getTemplateMeta(key: EmailTemplateKey): EmailTemplateMeta {
  const meta = TOP_10_TEMPLATES.find((t) => t.key === key);
  if (!meta) throw new Error(`Unbekanntes Template: ${key}`);
  return meta;
}

// ---------------------------------------------------------------------------
// Shopify Notification API Helpers
// ---------------------------------------------------------------------------

/** Ein Notification-Eintrag, wie ihn die Shopify Admin REST API liefert. */
export interface ShopifyNotification {
  id: number;
  name: string;
  subject: string;
  body: string; // Liquid + HTML
}

interface ShopifyAuth {
  shopDomain: string; // z. B. "dein-shop.myshopify.com"
  accessToken: string; // Admin API access token (shpat_...)
}

const SHOPIFY_API_VERSION = "2024-01";

/**
 * Lädt alle Notification-Templates eines Shops.
 * Wir filtern später auf unsere TOP_10_TEMPLATES.
 */
export async function listShopifyNotifications(
  auth: ShopifyAuth
): Promise<ShopifyNotification[]> {
  const res = await fetch(
    `https://${auth.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/notifications.json`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": auth.accessToken,
      },
      // Notifications sind shop-spezifisch und ändern sich selten — trotzdem
      // KEIN Caching, damit der Editor immer den Live-Stand zeigt.
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error(
      `Shopify Notifications GET failed: ${res.status} ${res.statusText}`
    );
  }

  const data = (await res.json()) as { notifications: ShopifyNotification[] };
  return data.notifications;
}

/**
 * Findet die Notification-ID eines Templates für den verbundenen Shop.
 * Wir cachen das Ergebnis NICHT — bei großen Shops sind das ~80 Templates,
 * die Latenz ist akzeptabel, und das spart uns einen Cache-Layer.
 */
export async function resolveNotificationId(
  auth: ShopifyAuth,
  key: EmailTemplateKey
): Promise<number> {
  const all = await listShopifyNotifications(auth);
  const match = all.find((n) => n.name === key);
  if (!match) {
    throw new Error(
      `Template "${key}" wurde im verbundenen Shop nicht gefunden. ` +
        `Möglicherweise nutzt der Shop eine veraltete Notification-Variante.`
    );
  }
  return match.id;
}

/**
 * Schreibt einen neuen Body (Liquid + HTML) in das gewählte Notification-Template.
 * Optional: subject ebenfalls überschreiben.
 *
 * WICHTIG: Shopify validiert das Liquid serverseitig. Bei ungültigem Liquid
 * gibt die API 422 zurück — wir reichen die Fehlermeldung an den Caller durch,
 * damit das Frontend dem Nutzer eine konkrete Begründung anzeigen kann.
 */
export async function deployNotificationTemplate(
  auth: ShopifyAuth,
  notificationId: number,
  body: string,
  subject?: string
): Promise<ShopifyNotification> {
  const payload: Record<string, unknown> = { body };
  if (subject) payload.subject = subject;

  const res = await fetch(
    `https://${auth.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/notifications/${notificationId}.json`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": auth.accessToken,
      },
      body: JSON.stringify({ notification: payload }),
    }
  );

  if (!res.ok) {
    let detail = "";
    try {
      const json = await res.json();
      detail = JSON.stringify(json);
    } catch {
      detail = await res.text();
    }
    throw new Error(
      `Shopify Notifications PUT failed: ${res.status} — ${detail}`
    );
  }

  const data = (await res.json()) as { notification: ShopifyNotification };
  return data.notification;
}

/**
 * Höhere Abstraktion: Deploy via Template-Key (statt numerischer ID).
 * Spart dem Frontend einen Roundtrip — wir lookup'en die ID server-seitig.
 */
export async function deployByKey(
  auth: ShopifyAuth,
  key: EmailTemplateKey,
  body: string,
  subject?: string
): Promise<ShopifyNotification> {
  const id = await resolveNotificationId(auth, key);
  return deployNotificationTemplate(auth, id, body, subject);
}
