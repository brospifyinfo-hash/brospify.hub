// ─── Top 10 Shopify Notification Templates ───────────────────────
// Maps to Shopify's REST Admin API "notifications" resource.
// Shopify identifies each transactional email by a stable name.
// Reference: GET/PUT /admin/api/{version}/notifications/{id}.json
//
// We expose a curated list of the 10 most impactful customer-facing
// emails. The `shopifyName` field is the canonical Shopify identifier
// used to match entries returned by GET /notifications.json.

import type { LucideIcon } from "lucide-react";
import {
  ShoppingBag,
  Truck,
  ShoppingCart,
  Sparkles,
  RotateCcw,
  XCircle,
  PackageCheck,
  PackageOpen,
  CreditCard,
  UserPlus,
} from "lucide-react";

export interface EmailTemplateDef {
  /** Stable internal id used in URLs and storage. */
  id: string;
  /** Display title (German). */
  title: string;
  /** Short tagline shown on the card. */
  tagline: string;
  /** Longer description for the editor header. */
  description: string;
  /** Canonical Shopify notification name (REST API). */
  shopifyName: string;
  /** Liquid variables typically available in this template. */
  liquidVariables: string[];
  /** Icon component. */
  icon: LucideIcon;
  /** Accent gradient for hero glow on the card (Tailwind). */
  accent: string;
  /** Editorial category. */
  category: "transactional" | "lifecycle" | "recovery";
}

export const EMAIL_TEMPLATES: EmailTemplateDef[] = [
  {
    id: "order-confirmation",
    title: "Bestellbestätigung",
    tagline: "Erste Bestätigung nach Kauf",
    description:
      "Wird direkt nach erfolgreichem Checkout an den Kunden gesendet. Höchste Öffnungsrate aller Mails — ideal für Cross-Sell-Hinweise.",
    shopifyName: "order_confirmation",
    liquidVariables: [
      "order.name",
      "order.total_price",
      "order.line_items",
      "customer.first_name",
      "billing_address",
      "shipping_address",
      "shop.name",
    ],
    icon: ShoppingBag,
    accent: "from-emerald-400/20 to-teal-500/10",
    category: "transactional",
  },
  {
    id: "shipping-confirmation",
    title: "Versandbestätigung",
    tagline: "Paket ist unterwegs",
    description:
      "Wird ausgelöst, sobald eine Sendung erstellt wird. Enthält Tracking-Nummer und voraussichtliches Lieferdatum.",
    shopifyName: "shipping_confirmation",
    liquidVariables: [
      "order.name",
      "fulfillment.tracking_number",
      "fulfillment.tracking_url",
      "shipping_address",
      "customer.first_name",
    ],
    icon: Truck,
    accent: "from-sky-400/20 to-blue-500/10",
    category: "transactional",
  },
  {
    id: "abandoned-checkout",
    title: "Warenkorbabbruch",
    tagline: "Erinnerung an stehengelassene Artikel",
    description:
      "Recovery-Mail an Besucher, die den Checkout begonnen aber nicht abgeschlossen haben. Höchster ROI im gesamten Mail-Funnel.",
    shopifyName: "abandoned_checkout",
    liquidVariables: [
      "checkout.line_items",
      "checkout.abandoned_checkout_url",
      "customer.first_name",
      "shop.name",
    ],
    icon: ShoppingCart,
    accent: "from-amber-400/20 to-orange-500/10",
    category: "recovery",
  },
  {
    id: "customer-account-welcome",
    title: "Willkommens-Mail",
    tagline: "Account erfolgreich erstellt",
    description:
      "Begrüßt neue Kunden nach Account-Erstellung. Erste Berührung — Markenton entscheidet über Wiederkauf.",
    shopifyName: "customer_account_welcome",
    liquidVariables: ["customer.first_name", "customer.email", "shop.name", "shop.url"],
    icon: Sparkles,
    accent: "from-fuchsia-400/20 to-pink-500/10",
    category: "lifecycle",
  },
  {
    id: "order-refund",
    title: "Rückerstattung",
    tagline: "Refund wurde verarbeitet",
    description:
      "Bestätigt eine erfolgreich verarbeitete Rückerstattung. Klare, beruhigende Sprache reduziert Support-Tickets messbar.",
    shopifyName: "order_refund",
    liquidVariables: [
      "order.name",
      "refund.amount",
      "refund.refund_line_items",
      "customer.first_name",
    ],
    icon: RotateCcw,
    accent: "from-violet-400/20 to-purple-500/10",
    category: "transactional",
  },
  {
    id: "order-cancelled",
    title: "Bestellung storniert",
    tagline: "Kauf wurde aufgehoben",
    description:
      "Storno-Bestätigung mit transparenter Erklärung. Empfehlung: Rabatt-Code für späteren Wiederkauf einbauen.",
    shopifyName: "order_cancelled",
    liquidVariables: ["order.name", "order.cancel_reason", "customer.first_name", "shop.name"],
    icon: XCircle,
    accent: "from-rose-400/20 to-red-500/10",
    category: "transactional",
  },
  {
    id: "shipping-update",
    title: "In Zustellung",
    tagline: "Lieferung kommt heute",
    description:
      "Update bei Statuswechsel des Carriers. Erhöht wahrgenommene Servicequalität ohne zusätzlichen Aufwand.",
    shopifyName: "shipping_update",
    liquidVariables: [
      "fulfillment.tracking_number",
      "fulfillment.tracking_url",
      "fulfillment.estimated_delivery_at",
      "customer.first_name",
    ],
    icon: PackageOpen,
    accent: "from-cyan-400/20 to-sky-500/10",
    category: "transactional",
  },
  {
    id: "order-delivered",
    title: "Geliefert",
    tagline: "Paket wurde zugestellt",
    description:
      "Auslöser für Review-Anfragen und Cross-Sells. Optimaler Zeitpunkt: 2–4 h nach Zustellung.",
    shopifyName: "shipping_confirmation_multipackage",
    liquidVariables: ["order.name", "customer.first_name", "shop.url"],
    icon: PackageCheck,
    accent: "from-emerald-400/20 to-green-500/10",
    category: "lifecycle",
  },
  {
    id: "payment-receipt",
    title: "Zahlung erhalten",
    tagline: "Beleg & Rechnungsdetails",
    description:
      "Offizieller Zahlungsbeleg. Muss steuerrechtlich konforme Felder enthalten (Bestell-Nr., Betrag, USt.).",
    shopifyName: "payment_received",
    liquidVariables: [
      "order.name",
      "order.total_price",
      "order.tax_lines",
      "billing_address",
      "shop.name",
    ],
    icon: CreditCard,
    accent: "from-indigo-400/20 to-blue-500/10",
    category: "transactional",
  },
  {
    id: "customer-invitation",
    title: "Account-Einladung",
    tagline: "Konto aktivieren",
    description:
      "Aktivierungslink für eingeladene Kunden. Hohe Conversion bei klarem CTA und Markenton.",
    shopifyName: "customer_invitation",
    liquidVariables: [
      "customer.first_name",
      "customer_account_activation_url",
      "shop.name",
      "shop.url",
    ],
    icon: UserPlus,
    accent: "from-teal-400/20 to-emerald-500/10",
    category: "lifecycle",
  },
];

export function getTemplateById(id: string): EmailTemplateDef | undefined {
  return EMAIL_TEMPLATES.find((t) => t.id === id);
}
