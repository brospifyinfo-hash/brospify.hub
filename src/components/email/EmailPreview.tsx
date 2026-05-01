"use client";

// ─── Email Preview ───────────────────────────────────────────────
// Renders generated Liquid/HTML in an isolated iframe with a
// Gmail-style chrome. A comprehensive mock-data injector replaces
// ALL Liquid tags so the preview never shows raw {{ variable }} code.

import { useEffect, useMemo, useRef, useState } from "react";
import { Smartphone, Monitor } from "lucide-react";

interface EmailPreviewProps {
  liquid: string;
  subject?: string;
}

type ViewMode = "mobile" | "desktop";

// ─── Mock Data ───────────────────────────────────────────────────

const MOCK_LINE_ITEMS = [
  {
    title: "Premium Oversized Hoodie",
    variant_title: "XL · Steingrau",
    name: "Premium Oversized Hoodie - XL · Steingrau",
    quantity: "1",
    price: "89,00 €",
    final_price: "89,00 €",
    original_price: "89,00 €",
    line_price: "89,00 €",
    total_price: "89,00 €",
    sku: "HODIE-XL-GRY",
    vendor: "Brospify",
    product_type: "Apparel",
    image: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=200&h=200&fit=crop&auto=format",
    url: "#",
    product_id: "1001",
    requires_shipping: "true",
    taxable: "true",
    grams: "500",
    fulfillment_service: "manual",
    discount: "0,00 €",
    discounts: "",
  },
  {
    title: "Essential Crew Neck Tee",
    variant_title: "M · Weiß",
    name: "Essential Crew Neck Tee - M · Weiß",
    quantity: "2",
    price: "34,00 €",
    final_price: "34,00 €",
    original_price: "34,00 €",
    line_price: "68,00 €",
    total_price: "68,00 €",
    sku: "TEE-M-WHT",
    vendor: "Brospify",
    product_type: "Apparel",
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=200&h=200&fit=crop&auto=format",
    url: "#",
    product_id: "1002",
    requires_shipping: "true",
    taxable: "true",
    grams: "200",
    fulfillment_service: "manual",
    discount: "0,00 €",
    discounts: "",
  },
  {
    title: "Logo Cap Classic",
    variant_title: "One Size · Schwarz",
    name: "Logo Cap Classic - One Size · Schwarz",
    quantity: "1",
    price: "29,00 €",
    final_price: "29,00 €",
    original_price: "29,00 €",
    line_price: "29,00 €",
    total_price: "29,00 €",
    sku: "CAP-OS-BLK",
    vendor: "Brospify",
    product_type: "Accessories",
    image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=200&h=200&fit=crop&auto=format",
    url: "#",
    product_id: "1003",
    requires_shipping: "true",
    taxable: "true",
    grams: "150",
    fulfillment_service: "manual",
    discount: "0,00 €",
    discounts: "",
  },
];

const MOCK_TAX_LINES = [
  { title: "MwSt. 19%", rate: "19%", price: "26,24 €" },
];

const MOCK_DISCOUNT_CODES = [
  { code: "WELCOME10", amount: "20,00 €", type: "percentage" },
];

const MOCK_VARS: Record<string, string> = {
  // Shop
  "shop.name": "Brospify Store",
  "shop.url": "https://brospify-store.de",
  "shop.domain": "brospify-store.myshopify.com",
  "shop.email": "hello@brospify-store.de",
  "shop.locale": "de",
  "shop.currency": "EUR",
  "shop.phone": "+49 30 12345678",
  "shop.description": "Premium Fashion für echte Persönlichkeiten.",
  "shop.taxes_included": "true",

  // Customer
  "customer.first_name": "Alexander",
  "customer.last_name": "Schmidt",
  "customer.name": "Alexander Schmidt",
  "customer.email": "alex.schmidt@example.de",
  "customer.phone": "+49 171 2345678",
  "customer.orders_count": "3",
  "customer.total_spent": "215,00 €",
  "customer.reset_password_url": "#",
  "customer.account_activation_url": "#",
  "customer_account_activation_url": "#",
  "customer.account_url": "#",

  // Order
  "order.name": "#2847",
  "order.order_number": "2847",
  "order.created_at": "1. Mai 2026",
  "order.processed_at": "1. Mai 2026",
  "order.updated_at": "1. Mai 2026",
  "order.total_price": "186,24 €",
  "order.subtotal_price": "160,00 €",
  "order.total_tax": "26,24 €",
  "order.total_discounts": "20,00 €",
  "order.financial_status": "bezahlt",
  "order.fulfillment_status": "versandt",
  "order.cancel_reason": "Kundenwunsch",
  "order.cancel_reason_label": "Vom Kunden storniert",
  "order.order_status_url": "#",
  "order.invoice_url": "#",
  "order.note": "",
  "order.item_count": "4",
  "order.currency": "EUR",

  // Top-level price aliases (used without order. prefix in Shopify Liquid)
  "total_price": "186,24 €",
  "subtotal_price": "160,00 €",
  "total_tax": "26,24 €",
  "total_discounts": "20,00 €",
  "refund_amount": "42,00 €",

  // Fulfillment / Shipping
  "fulfillment.tracking_number": "DHL-340434161094010",
  "fulfillment.tracking_url": "#",
  "fulfillment.tracking_company": "DHL",
  "fulfillment.estimated_delivery_at": "3. Mai 2026",
  "tracking_number": "DHL-340434161094010",
  "tracking_url": "#",
  "tracking_company": "DHL",

  // Checkout (abandoned)
  "checkout.abandoned_checkout_url": "#",
  "checkout.total_price": "186,24 €",
  "checkout.subtotal_price": "160,00 €",
  "checkout.email": "alex.schmidt@example.de",

  // Refund
  "refund.amount": "42,00 €",

  // Shipping address (object — rendered inline)
  "shipping_address": "Alexander Schmidt<br>Musterstraße 42<br>10115 Berlin<br>Deutschland",
  "shipping_address.first_name": "Alexander",
  "shipping_address.last_name": "Schmidt",
  "shipping_address.name": "Alexander Schmidt",
  "shipping_address.address1": "Musterstraße 42",
  "shipping_address.address2": "",
  "shipping_address.city": "Berlin",
  "shipping_address.zip": "10115",
  "shipping_address.province": "Berlin",
  "shipping_address.country": "Deutschland",
  "shipping_address.phone": "+49 171 2345678",

  // Billing address
  "billing_address": "Alexander Schmidt<br>Musterstraße 42<br>10115 Berlin<br>Deutschland",
  "billing_address.first_name": "Alexander",
  "billing_address.last_name": "Schmidt",
  "billing_address.name": "Alexander Schmidt",
  "billing_address.address1": "Musterstraße 42",
  "billing_address.city": "Berlin",
  "billing_address.zip": "10115",
  "billing_address.country": "Deutschland",

  // Misc
  "email": "alex.schmidt@example.de",
  "date": "1. Mai 2026",
};

// ─── Mock Data Injector ──────────────────────────────────────────

function formatMoney(raw: string): string {
  // If it looks like a number (possibly with dot decimal), format as EUR
  const clean = raw.replace(",", ".");
  const num = parseFloat(clean);
  if (isNaN(num)) return raw;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(num);
}

function applyLiquidFilters(value: string, filterStr: string): string {
  const filters = filterStr
    .split("|")
    .map((f) => f.trim())
    .filter(Boolean);
  let out = value;
  for (const f of filters) {
    if (f === "money" || f.startsWith("money_")) {
      out = formatMoney(out);
    } else if (f === "upcase") {
      out = out.toUpperCase();
    } else if (f === "downcase") {
      out = out.toLowerCase();
    } else if (f === "capitalize") {
      out = out.charAt(0).toUpperCase() + out.slice(1);
    } else if (f.startsWith("img_url") || f.startsWith("asset_url")) {
      // already a URL — leave as-is
    }
  }
  return out;
}

/** Expand a {% for loopVar in collection %}...{% endfor %} with mock items. */
function expandLoop(
  body: string,
  loopVar: string,
  items: Record<string, string>[],
): string {
  return items
    .map((item) => {
      let row = body;
      // Replace {{ loopVar.field | filters? }}
      row = row.replace(
        new RegExp(
          `\\{\\{\\s*${loopVar}\\.(\\w+)(?:\\s*\\|([^}]+))?\\s*\\}\\}`,
          "g",
        ),
        (_match, field: string, filterStr?: string) => {
          const val = item[field] ?? `[${field}]`;
          return filterStr ? applyLiquidFilters(val, filterStr) : val;
        },
      );
      // Remove leftover {% if loopVar.xxx %}...{% endif %} tags (keep body)
      row = row
        .replace(/\{%\s*if\s+[^%]+%\}/g, "")
        .replace(/\{%\s*elsif\s+[^%]+%\}/g, "")
        .replace(/\{%\s*else\s*%\}/g, "")
        .replace(/\{%\s*endif\s*%\}/g, "")
        .replace(/\{%\s*unless\s+[^%]+%\}/g, "")
        .replace(/\{%\s*endunless\s*%\}/g, "");
      return row;
    })
    .join("");
}

export function stubLiquid(html: string): string {
  let out = html;

  // ── 1. Expand line-item loops ───────────────────────────────────
  // Handles: order.line_items, checkout.line_items, line_items
  out = out.replace(
    /\{%\s*for\s+(\w+)\s+in\s+(?:order\.|checkout\.)?line_items\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g,
    (_m, loopVar: string, body: string) =>
      expandLoop(body, loopVar, MOCK_LINE_ITEMS),
  );

  // ── 2. Expand tax line loops ────────────────────────────────────
  out = out.replace(
    /\{%\s*for\s+(\w+)\s+in\s+(?:order\.)?tax_lines\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g,
    (_m, loopVar: string, body: string) =>
      expandLoop(body, loopVar, MOCK_TAX_LINES),
  );

  // ── 3. Expand discount code loops ──────────────────────────────
  out = out.replace(
    /\{%\s*for\s+(\w+)\s+in\s+(?:order\.)?discount_codes?\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g,
    (_m, loopVar: string, body: string) =>
      expandLoop(body, loopVar, MOCK_DISCOUNT_CODES),
  );

  // ── 4. Remove remaining {% for ... %}...{% endfor %} (unsupported) ─
  out = out.replace(
    /\{%\s*for\s+[\s\S]*?\{%\s*endfor\s*%\}/g,
    "<!-- [loop removed in preview] -->",
  );

  // ── 5. Replace {{ var | filter }} and {{ var }} ─────────────────
  out = out.replace(
    /\{\{\s*([\w.]+)(?:\s*\|([^}]+))?\s*\}\}/g,
    (_m, key: string, filterStr?: string) => {
      const val = MOCK_VARS[key];
      if (val !== undefined) {
        return filterStr ? applyLiquidFilters(val, filterStr) : val;
      }
      // Fallback: show a subtle placeholder so the preview isn't broken
      return `<span style="color:#86868b;font-style:italic;font-size:0.9em;">[${key}]</span>`;
    },
  );

  // ── 6. Strip all remaining {% ... %} Liquid tags ───────────────
  out = out.replace(/\{%[\s\S]*?%\}/g, "");

  return out;
}

// ─── Component ───────────────────────────────────────────────────

export function EmailPreview({ liquid, subject }: EmailPreviewProps) {
  const [view, setView] = useState<ViewMode>("desktop");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const html = useMemo(() => stubLiquid(liquid), [liquid]);

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
  }, [html]);

  const frameWidth = view === "mobile" ? 390 : 680;

  return (
    <div className="w-full">
      {/* Toggle */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-medium text-white/40 uppercase tracking-[0.14em]">
          Live-Vorschau
        </p>
        <div className="segment" role="tablist">
          <button
            role="tab"
            data-active={view === "desktop"}
            onClick={() => setView("desktop")}
          >
            <Monitor className="w-3.5 h-3.5" />
            Desktop
          </button>
          <button
            role="tab"
            data-active={view === "mobile"}
            onClick={() => setView("mobile")}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Mobile
          </button>
        </div>
      </div>

      {/* Preview chrome */}
      <div className="preview-chrome">
        {/* Mac dots */}
        <div className="preview-bar">
          <span className="dot" style={{ background: "#ff5f57" }} />
          <span className="dot" style={{ background: "#febc2e" }} />
          <span className="dot" style={{ background: "#28c840" }} />
          <div className="ml-3 flex-1 text-[12px] font-medium text-white/45 truncate">
            {subject ?? "E-Mail Vorschau"}
          </div>
        </div>

        {/* Gmail-style header */}
        <div
          style={{
            background: "#fff",
            borderBottom: "1px solid #e0e0e0",
            padding: "16px 24px",
            fontFamily: '"Google Sans", Roboto, sans-serif',
          }}
        >
          <div
            style={{
              fontSize: "20px",
              fontWeight: 500,
              color: "#202124",
              marginBottom: "12px",
              lineHeight: 1.3,
            }}
          >
            {subject ?? "E-Mail Vorschau"}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {[
                [
                  "Von",
                  "Brospify Store",
                  "noreply@brospify-store.myshopify.com",
                ],
                ["An", "Alexander Schmidt", "alex.schmidt@example.de"],
              ].map(([label, name, addr]) => (
                <tr key={label}>
                  <td
                    style={{
                      width: "40px",
                      color: "#5f6368",
                      fontSize: "13px",
                      paddingBottom: "4px",
                      verticalAlign: "top",
                    }}
                  >
                    {label}
                  </td>
                  <td
                    style={{
                      color: "#202124",
                      fontSize: "13px",
                      paddingBottom: "4px",
                    }}
                  >
                    <strong style={{ fontWeight: 500 }}>{name}</strong>{" "}
                    <span style={{ color: "#5f6368" }}>
                      &lt;{addr}&gt;
                    </span>
                  </td>
                  <td
                    style={{
                      color: "#5f6368",
                      fontSize: "13px",
                      textAlign: "right",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label === "Von" ? "1. Mai 2026, 14:32" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Email frame */}
        <div className="flex justify-center bg-[#f6f8fc] py-8 px-4 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] overflow-y-auto max-h-[900px]">
          <div
            className="transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] rounded-xl overflow-hidden bg-white shadow-xl"
            style={{ width: `${frameWidth}px`, maxWidth: "100%" }}
          >
            <iframe
              ref={iframeRef}
              title="email-preview"
              sandbox="allow-same-origin"
              className="w-full block border-0"
              style={{ height: "820px" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
