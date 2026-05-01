// ─── Top 10 Shopify Notification Templates ───────────────────────
// Maps to Shopify's REST Admin API "notifications" resource.

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
  id: string;
  title: string;
  tagline: string;
  description: string;
  /** Full sentence: when / why this email is triggered. Shown in context banner. */
  triggerContext: string;
  /** Short badge label shown alongside the category. */
  contextBadge: string;
  shopifyName: string;
  liquidVariables: string[];
  icon: LucideIcon;
  accent: string;
  category: "transactional" | "lifecycle" | "recovery";
}

export const EMAIL_TEMPLATES: EmailTemplateDef[] = [
  {
    id: "order-confirmation",
    title: "Bestellbestätigung",
    tagline: "Erste Bestätigung nach Kauf",
    description:
      "Wird direkt nach erfolgreichem Checkout an den Kunden gesendet. Höchste Öffnungsrate aller Mails — ideal für Cross-Sell-Hinweise.",
    triggerContext:
      "Wird sofort versendet, nachdem der Kunde den Checkout erfolgreich abgeschlossen hat. Mit ~80 % Öffnungsrate die wertvollste Mail im gesamten Funnel — nutze sie für Upsells und Vertrauen.",
    contextBadge: "Post-Purchase",
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
    triggerContext:
      "Ausgelöst, sobald ein Fulfillment-Eintrag im Shopify-Backend erstellt wird. Perfekter Moment, um Tracking-CTAs prominent zu platzieren und Vorfreude zu erzeugen.",
    contextBadge: "Fulfillment",
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
    triggerContext:
      "Automatisch versendet 6–24 Stunden nach Checkout-Abbruch. Höchster ROI im gesamten Mail-Funnel — ein optimiertes Template hier zahlt sich direkt aus.",
    contextBadge: "Recovery",
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
    triggerContext:
      "Erste E-Mail nach Account-Erstellung. Setzt den Ton für die gesamte Kundenbeziehung — hier entscheidet sich, ob der Kunde wiederkommt.",
    contextBadge: "Onboarding",
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
    triggerContext:
      "Versendet, sobald eine Rückerstattung im Admin verarbeitet wurde. Klare Kommunikation reduziert Support-Tickets — Ton und Klarheit sind hier entscheidend.",
    contextBadge: "Post-Service",
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
    triggerContext:
      "Versendet nach manuellem oder automatischem Storno. Empfehlung: Rabattcode für Wiederkauf einbauen — reduziert Frustration und sichert Folgebestellung.",
    contextBadge: "Retention",
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
    triggerContext:
      "Ausgelöst bei Statuswechsel des Carriers (z. B. 'Out for Delivery'). Erhöht die wahrgenommene Servicequalität erheblich — ohne manuellen Aufwand.",
    contextBadge: "Logistics",
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
    triggerContext:
      "Ausgelöst bei Zustellbestätigung durch den Carrier. Optimaler Zeitpunkt für Review-Anfragen, Cross-Sells und Loyalty-Programme — 2–4 Stunden nach Zustellung.",
    contextBadge: "Post-Delivery",
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
    triggerContext:
      "Versendet nach Zahlungseingang. Muss steuerrechtlich konforme Felder enthalten — Bestell-Nr., Betrag, Steuern. Wenig Spielraum für Kreativität, aber wichtig für Compliance.",
    contextBadge: "Compliance",
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
    triggerContext:
      "Versendet, wenn ein Admin-Benutzer einen Kunden manuell einlädt. Hohe Conversion bei klarem, einzigem CTA — vermeide ablenkende Elemente.",
    contextBadge: "Activation",
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
