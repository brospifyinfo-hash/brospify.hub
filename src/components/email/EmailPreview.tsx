"use client";

// ─── Email Preview ───────────────────────────────────────────────
// Renders generated Liquid/HTML in an isolated iframe so the email
// styles cannot leak into the host app. Supports a Mobile/Desktop
// segmented toggle that resizes the inner viewport realistically.
//
// Liquid placeholders ({{ ... }}) are stubbed with sample values for
// the visual preview only — the real Liquid is what gets deployed.

import { useEffect, useMemo, useRef, useState } from "react";
import { Smartphone, Monitor } from "lucide-react";

interface EmailPreviewProps {
  liquid: string;
  subject?: string;
}

type ViewMode = "mobile" | "desktop";

const SAMPLE_VARS: Record<string, string> = {
  "shop.name": "Brospify Demo Store",
  "shop.url": "https://brospify-demo.myshopify.com",
  "shop.domain": "brospify-demo.myshopify.com",
  "shop.locale": "de",
  "customer.first_name": "Max",
  "customer.email": "max@example.com",
  "order.name": "#1024",
  "order.total_price": "€129,00",
  "order.order_status_url": "#",
  "order.cancel_reason": "customer",
  "fulfillment.tracking_number": "DPD-1Z999AA10123456784",
  "fulfillment.tracking_url": "#",
  "fulfillment.estimated_delivery_at": "morgen",
  "checkout.abandoned_checkout_url": "#",
  "refund.amount": "€42,00",
  "customer_account_activation_url": "#",
};

/** Replace `{{ var }}` placeholders with sample values for preview. */
function stubLiquid(html: string): string {
  // Replace sample vars
  let out = html.replace(/\{\{\s*([\w.]+)(\s*\|\s*[^}]+)?\s*\}\}/g, (_m, key) => {
    if (SAMPLE_VARS[key as string] !== undefined) return SAMPLE_VARS[key as string];
    return `<span style="color:#86868b;font-style:italic;">[${key}]</span>`;
  });

  // Replace {% for line in order.line_items %} ... {% endfor %} blocks with sample rows
  out = out.replace(
    /\{%\s*for\s+line\s+in\s+(?:order|checkout)\.line_items\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g,
    (_m, body: string) => {
      const samples = [
        { title: "Premium Hoodie", variant: "L · Schwarz", quantity: 1, price: "€69,00" },
        { title: "Cap Classic", variant: "One Size · Beige", quantity: 2, price: "€30,00" },
      ];
      return samples
        .map((s) =>
          body
            .replace(/\{\{\s*line\.title\s*\}\}/g, s.title)
            .replace(/\{\{\s*line\.variant_title\s*\}\}/g, s.variant)
            .replace(/\{\{\s*line\.quantity\s*\}\}/g, String(s.quantity))
            .replace(/\{\{\s*line\.price\s*(?:\|[^}]+)?\s*\}\}/g, s.price)
            .replace(/\{%\s*if\s+line\.variant_title\s*%\}/g, "")
            .replace(/\{%\s*endif\s*%\}/g, ""),
        )
        .join("");
    },
  );

  // Strip any remaining `{% if ... %}` blocks (keep inner content for preview)
  out = out.replace(/\{%\s*if\s+[^%]+%\}/g, "");
  out = out.replace(/\{%\s*endif\s*%\}/g, "");
  out = out.replace(/\{%\s*else\s*%\}/g, "");

  return out;
}

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

  const frameWidth = view === "mobile" ? 390 : 720;

  return (
    <div className="w-full">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-[12px] font-medium text-white/50 uppercase tracking-[0.14em]">
          Vorschau
        </div>
        <div className="segment" role="tablist" aria-label="Preview Größe">
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

      {/* Glass chrome */}
      <div className="preview-chrome">
        {/* Mac-style chrome bar */}
        <div className="preview-bar">
          <span className="dot" style={{ background: "#ff5f57" }} />
          <span className="dot" style={{ background: "#febc2e" }} />
          <span className="dot" style={{ background: "#28c840" }} />
          <div className="ml-3 flex-1 truncate text-[12px] font-medium text-white/55">
            {subject ?? "Vorschau"}
          </div>
        </div>

        {/* Frame */}
        <div className="flex justify-center bg-[#f5f5f7] py-8 px-4 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
          <div
            className="transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] rounded-2xl overflow-hidden bg-white shadow-2xl"
            style={{ width: `${frameWidth}px`, maxWidth: "100%" }}
          >
            <iframe
              ref={iframeRef}
              title="email-preview"
              sandbox="allow-same-origin"
              className="w-full block border-0"
              style={{ height: "780px" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
