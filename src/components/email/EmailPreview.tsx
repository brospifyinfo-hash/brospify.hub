"use client";

// ─── Email Preview ───────────────────────────────────────────────
// Renders the generated Liquid/HTML in an iframe with a Gmail-style
// chrome. Mock data replaces every Liquid tag so the preview never
// shows raw {{ variable }}.
//
// Editing model — single toggle, no AI:
//
//   • Default ("Vorschau"):
//       The iframe is a pure preview. No outlines, no hover effects,
//       no clickable areas. Links are still suppressed so the user
//       can't accidentally navigate away.
//
//   • Toggle on ("Editor-Modus"):
//       Every text leaf becomes tappable. Tapping turns it into a
//       contenteditable element with a sticky Save / Cancel bar at
//       the bottom of the viewport. Edits flow back to the parent
//       through postMessage so the source Liquid stays in sync.

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Smartphone, Monitor, Coins, Pencil, Eye } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface EmailPreviewProps {
  liquid: string;
  subject?: string;
  fontStack?: string;
  /** Called when the user finishes inline-editing a text node. */
  onTextEdit?: (originalText: string, newText: string) => void;
}

export interface EmailPreviewHandle {
  refresh: () => void;
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
    image:
      "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=200&h=200&fit=crop&auto=format",
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
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=200&h=200&fit=crop&auto=format",
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
    image:
      "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=200&h=200&fit=crop&auto=format",
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
const MOCK_TAX_LINES = [{ title: "MwSt. 19%", rate: "19%", price: "26,24 €" }];
const MOCK_DISCOUNT_CODES = [
  { code: "WELCOME10", amount: "20,00 €", type: "percentage" },
];

const MOCK_VARS: Record<string, string> = {
  "shop.name": "Brospify Store",
  "shop.url": "https://brospify-store.de",
  "shop.domain": "brospify-store.myshopify.com",
  "shop.email": "hello@brospify-store.de",
  "shop.locale": "de",
  "shop.currency": "EUR",
  "shop.phone": "+49 30 12345678",
  "shop.description": "Premium Fashion für echte Persönlichkeiten.",
  "shop.taxes_included": "true",
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
  total_price: "186,24 €",
  subtotal_price: "160,00 €",
  total_tax: "26,24 €",
  total_discounts: "20,00 €",
  refund_amount: "42,00 €",
  "fulfillment.tracking_number": "DHL-340434161094010",
  "fulfillment.tracking_url": "#",
  "fulfillment.tracking_company": "DHL",
  "fulfillment.estimated_delivery_at": "3. Mai 2026",
  tracking_number: "DHL-340434161094010",
  tracking_url: "#",
  tracking_company: "DHL",
  "checkout.abandoned_checkout_url": "#",
  "checkout.total_price": "186,24 €",
  "checkout.subtotal_price": "160,00 €",
  "checkout.email": "alex.schmidt@example.de",
  "refund.amount": "42,00 €",
  "shipping_address":
    "Alexander Schmidt<br>Musterstraße 42<br>10115 Berlin<br>Deutschland",
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
  "billing_address":
    "Alexander Schmidt<br>Musterstraße 42<br>10115 Berlin<br>Deutschland",
  "billing_address.first_name": "Alexander",
  "billing_address.last_name": "Schmidt",
  "billing_address.name": "Alexander Schmidt",
  "billing_address.address1": "Musterstraße 42",
  "billing_address.city": "Berlin",
  "billing_address.zip": "10115",
  "billing_address.country": "Deutschland",
  email: "alex.schmidt@example.de",
  date: "1. Mai 2026",
};

// ─── Mock Data Injector ──────────────────────────────────────────

function formatMoney(raw: string): string {
  const clean = raw.replace(",", ".");
  const num = parseFloat(clean);
  if (isNaN(num)) return raw;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(num);
}

function applyLiquidFilters(value: string, filterStr: string): string {
  const filters = filterStr.split("|").map((f) => f.trim()).filter(Boolean);
  let out = value;
  for (const f of filters) {
    if (f === "money" || f.startsWith("money_")) out = formatMoney(out);
    else if (f === "upcase") out = out.toUpperCase();
    else if (f === "downcase") out = out.toLowerCase();
    else if (f === "capitalize")
      out = out.charAt(0).toUpperCase() + out.slice(1);
  }
  return out;
}

function expandLoop(
  body: string,
  loopVar: string,
  items: Record<string, string>[],
): string {
  return items
    .map((item) => {
      let row = body;
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
  out = out.replace(
    /\{%\s*for\s+(\w+)\s+in\s+(?:order\.|checkout\.)?line_items\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g,
    (_m, loopVar: string, body: string) =>
      expandLoop(body, loopVar, MOCK_LINE_ITEMS),
  );
  out = out.replace(
    /\{%\s*for\s+(\w+)\s+in\s+(?:order\.)?tax_lines\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g,
    (_m, loopVar: string, body: string) =>
      expandLoop(body, loopVar, MOCK_TAX_LINES),
  );
  out = out.replace(
    /\{%\s*for\s+(\w+)\s+in\s+(?:order\.)?discount_codes?\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g,
    (_m, loopVar: string, body: string) =>
      expandLoop(body, loopVar, MOCK_DISCOUNT_CODES),
  );
  out = out.replace(
    /\{%\s*for\s+[\s\S]*?\{%\s*endfor\s*%\}/g,
    "<!-- [loop removed in preview] -->",
  );
  out = out.replace(
    /\{\{\s*([\w.]+)(?:\s*\|([^}]+))?\s*\}\}/g,
    (_m, key: string, filterStr?: string) => {
      const val = MOCK_VARS[key];
      if (val !== undefined) {
        return filterStr ? applyLiquidFilters(val, filterStr) : val;
      }
      return `<span style="color:#86868b;font-style:italic;font-size:0.9em;">[${key}]</span>`;
    },
  );
  out = out.replace(/\{%[\s\S]*?%\}/g, "");
  return out;
}

// ─── In-iframe Editor Script ─────────────────────────────────────
//
// Two messages flow from the parent into the iframe:
//   { kind: "bsf:set-mode", mode: "preview" | "edit" }
//   { kind: "bsf:cancel"  }   — abort an in-progress text edit
//
// Two messages flow back:
//   { kind: "bsf:height", height }
//   { kind: "bsf:text-edit", original, next }
//
// In "preview" mode the iframe disables every interaction: links
// are blocked, the cursor stays default, no outlines appear. In
// "edit" mode tapping any text leaf turns it into a contenteditable.

const EDITOR_SCRIPT = `(function(){
  var mode = "preview";
  var editingNode = null;

  function tagTexts() {
    var TEXTY = ["P","H1","H2","H3","H4","H5","H6","SPAN","A","TD","LI","DIV","STRONG","EM","B","I"];
    Array.prototype.forEach.call(
      document.querySelectorAll(TEXTY.join(",")),
      function (el) {
        if (el.children.length !== 0) return;
        if (el.dataset && el.dataset.bsfUi === "1") return;
        var t = (el.textContent || "").trim();
        if (t.length < 1 || t.length > 800) return;
        el.dataset.bsfText = "1";
        el.dataset.bsfOriginal = el.textContent || "";
      },
    );
  }

  function ensureUI() {
    if (document.getElementById("bsf-savebar")) return;
    var s = document.createElement("div");
    s.id = "bsf-savebar";
    s.setAttribute("data-bsf-ui", "1");
    s.style.cssText =
      "position:fixed;left:50%;bottom:14px;transform:translateX(-50%) translateY(160%);z-index:99999;display:flex;align-items:center;gap:8px;padding:8px;border-radius:14px;background:linear-gradient(180deg,#1a1a1a,#0d0d0d);border:1px solid rgba(255,255,255,0.16);box-shadow:0 24px 60px -16px rgba(0,0,0,0.7),0 2px 8px rgba(0,0,0,0.4);font-family:-apple-system,system-ui,sans-serif;color:#f5f5f5;transition:transform 240ms cubic-bezier(0.22,1,0.36,1);max-width:calc(100vw - 24px);";
    s.innerHTML =
      '<span data-bsf-ui="1" style="display:inline-flex;align-items:center;gap:6px;padding:0 12px;font-size:12.5px;font-weight:600;color:rgba(255,255,255,0.7);white-space:nowrap;">' +
      '<span data-bsf-ui="1" style="width:6px;height:6px;border-radius:50%;background:#95BF47;"></span>' +
      "Bearbeitung" +
      "</span>" +
      '<button id="bsf-cancel-btn" data-bsf-ui="1" type="button" style="height:42px;min-width:96px;border-radius:10px;border:0;background:rgba(255,255,255,0.06);color:#f5f5f5;font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;">Abbrechen</button>' +
      '<button id="bsf-save-btn" data-bsf-ui="1" type="button" style="height:42px;min-width:120px;border-radius:10px;border:0;background:linear-gradient(180deg,#a3cc4f,#88b03f);color:#0a1604;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;letter-spacing:-0.01em;">Übernehmen</button>';
    document.body.appendChild(s);
  }

  function showSavebar() {
    var s = document.getElementById("bsf-savebar");
    if (s) s.style.transform = "translateX(-50%) translateY(0)";
  }
  function hideSavebar() {
    var s = document.getElementById("bsf-savebar");
    if (s) s.style.transform = "translateX(-50%) translateY(160%)";
  }

  function startTextEdit(textEl) {
    if (!textEl || mode !== "edit") return;
    if (editingNode && editingNode !== textEl) cancelTextEdit(true);
    editingNode = textEl;
    textEl.setAttribute("contenteditable", "plaintext-only");
    textEl.style.outline = "2px solid #95BF47";
    textEl.style.outlineOffset = "2px";
    textEl.style.borderRadius = "3px";
    textEl.style.background = "rgba(149,191,71,0.06)";
    textEl.focus();
    try {
      var range = document.createRange();
      range.selectNodeContents(textEl);
      range.collapse(false);
      var sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } catch (e) {}
    showSavebar();
  }

  function cancelTextEdit(restore) {
    var el = editingNode;
    editingNode = null;
    hideSavebar();
    if (!el) return;
    if (restore) el.textContent = el.dataset.bsfOriginal || "";
    el.removeAttribute("contenteditable");
    el.style.outline = "";
    el.style.outlineOffset = "";
    el.style.background = "";
    el.style.borderRadius = "";
  }

  function commitTextEdit() {
    var el = editingNode;
    if (!el) {
      hideSavebar();
      return;
    }
    var original = el.dataset.bsfOriginal || "";
    var next = el.textContent || "";
    if (next !== original) {
      try {
        window.parent.postMessage(
          { kind: "bsf:text-edit", original: original, next: next },
          "*",
        );
      } catch (e) {}
      el.dataset.bsfOriginal = next;
    }
    cancelTextEdit(false);
  }

  function isInsideUI(node) {
    while (node && node !== document.body) {
      if (node.nodeType === 1 && node.dataset && node.dataset.bsfUi === "1")
        return true;
      node = node.parentNode;
    }
    return false;
  }

  function onClick(e) {
    var t = e.target;
    if (!t) return;

    // Always block link navigation, in any mode.
    var anchor = t.closest && t.closest("a[href]");
    if (anchor) e.preventDefault();

    if (isInsideUI(t)) {
      var sId = (t.closest && t.closest("[id]") && t.closest("[id]").id) || "";
      if (sId === "bsf-save-btn") {
        e.preventDefault();
        e.stopPropagation();
        commitTextEdit();
      } else if (sId === "bsf-cancel-btn") {
        e.preventDefault();
        e.stopPropagation();
        cancelTextEdit(true);
      }
      return;
    }

    if (mode !== "edit") {
      // Pure preview: swallow taps on links so nothing navigates.
      if (anchor) e.stopPropagation();
      return;
    }

    var textEl = t.closest && t.closest("[data-bsf-text]");
    if (textEl) {
      e.preventDefault();
      e.stopPropagation();
      startTextEdit(textEl);
    }
  }

  function onParentMessage(e) {
    if (!e.data || typeof e.data !== "object") return;
    if (e.data.kind === "bsf:set-mode") {
      var next = e.data.mode === "edit" ? "edit" : "preview";
      if (next === mode) return;
      if (next === "preview" && editingNode) cancelTextEdit(true);
      mode = next;
      document.body.dataset.bsfMode = mode;
    } else if (e.data.kind === "bsf:cancel") {
      if (editingNode) cancelTextEdit(true);
    }
  }

  function init() {
    tagTexts();
    ensureUI();
    document.body.dataset.bsfMode = mode;

    document.addEventListener("click", onClick, true);
    window.addEventListener("message", onParentMessage);

    // Auto-commit when the user taps outside the active text node.
    document.addEventListener(
      "pointerdown",
      function (e) {
        if (!editingNode) return;
        var t = e.target;
        if (!t) return;
        if (isInsideUI(t)) return;
        if (t === editingNode) return;
        if (editingNode.contains && editingNode.contains(t)) return;
        commitTextEdit();
      },
      true,
    );

    document.addEventListener("keydown", function (e) {
      if (!editingNode) return;
      if (e.key === "Escape") {
        e.preventDefault();
        cancelTextEdit(true);
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        commitTextEdit();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();`;

// ─── Component ───────────────────────────────────────────────────

export const EmailPreview = forwardRef<EmailPreviewHandle, EmailPreviewProps>(
  function EmailPreview({ liquid, subject, fontStack, onTextEdit }, ref) {
    const { t } = useI18n();
    const [view, setView] = useState<ViewMode>("desktop");
    const [editorOn, setEditorOn] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const html = useMemo(() => stubLiquid(liquid), [liquid]);

    const inject = useCallback(() => {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;

      const fontHead = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:wght@400;500;600;700&family=Bricolage+Grotesque:wght@400;500;600;700&family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&family=EB+Garamond:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Lato:wght@400;700&family=Lora:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=Merriweather:wght@400;700&family=Montserrat:wght@400;500;600;700&family=Nunito:wght@400;600;700&family=Open+Sans:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Raleway:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&family=Work+Sans:wght@400;500;600;700&display=swap">
`;

      // Hover/cursor effects only apply when the body is in edit mode.
      // Pure preview mode is visually identical to a real email.
      const baseStyle = `
* { -webkit-tap-highlight-color: transparent; }
body { margin: 0; min-height: 100%; ${fontStack ? `font-family: ${fontStack};` : ""} }
body[data-bsf-mode="edit"] [data-bsf-text] {
  cursor: text;
  border-radius: 2px;
  transition: background-color 120ms ease;
}
@media (hover: hover) {
  body[data-bsf-mode="edit"] [data-bsf-text]:hover {
    background-color: rgba(149, 191, 71, 0.08);
  }
}
[data-bsf-text][contenteditable]:focus {
  outline: 2px solid #95BF47 !important;
  outline-offset: 2px;
}
`;

      const fullDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">${fontHead}<style>${baseStyle}</style></head><body>${html}<script>${EDITOR_SCRIPT}<\/script></body></html>`;

      doc.open();
      doc.write(fullDoc);
      doc.close();
    }, [html, fontStack]);

    useImperativeHandle(ref, () => ({ refresh: inject }), [inject]);

    useEffect(() => {
      inject();
    }, [inject]);

    // Push the active mode into the iframe whenever it changes
    // (and after every re-inject, since the iframe forgets state).
    useEffect(() => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      const t = setTimeout(() => {
        try {
          win.postMessage(
            { kind: "bsf:set-mode", mode: editorOn ? "edit" : "preview" },
            "*",
          );
        } catch {}
      }, 80);
      return () => clearTimeout(t);
    }, [editorOn, html]);

    // When the user toggles the editor off, abort any in-progress edit.
    useEffect(() => {
      if (editorOn) return;
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      try {
        win.postMessage({ kind: "bsf:cancel" }, "*");
      } catch {}
    }, [editorOn]);

    // Listen for messages from the iframe.
    useEffect(() => {
      function onMessage(e: MessageEvent) {
        if (!e.data || typeof e.data !== "object") return;
        const data = e.data as {
          kind?: string;
          original?: string;
          next?: string;
        };
        if (data.kind === "bsf:text-edit" && data.original && data.next) {
          onTextEdit?.(data.original, data.next);
        }
      }
      window.addEventListener("message", onMessage);
      return () => window.removeEventListener("message", onMessage);
    }, [onTextEdit]);

    const frameWidth = view === "mobile" ? 390 : 680;

    return (
      <div className="w-full">
        {/* Header row: editor toggle + viewport toggle */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          {/* Editor toggle */}
          <button
            type="button"
            onClick={() => setEditorOn((v) => !v)}
            aria-pressed={editorOn}
            className={`inline-flex items-center gap-2 h-10 px-3.5 rounded-xl text-[13px] font-semibold transition border ${
              editorOn
                ? "bg-[#95BF47] text-black border-[#95BF47]"
                : "bg-white/[0.04] text-white/70 border-white/[0.08] hover:text-white hover:bg-white/[0.06]"
            }`}
          >
            {editorOn ? (
              <>
                <Pencil className="w-3.5 h-3.5" strokeWidth={2.4} />
                {t.emailGen.epEditorMode}
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-black/45" />
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" strokeWidth={2.2} />
                {t.emailGen.preview}
                <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-white/45 ml-1">
                  {t.emailGen.epTapToEdit}
                </span>
              </>
            )}
          </button>

          {/* Viewport toggle pushed to the right */}
          <div className="segment ml-auto" role="tablist">
            <button
              role="tab"
              data-active={view === "desktop"}
              onClick={() => setView("desktop")}
              type="button"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop</span>
            </button>
            <button
              role="tab"
              data-active={view === "mobile"}
              onClick={() => setView("mobile")}
              type="button"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile</span>
            </button>
          </div>
        </div>

        {/* Edit-mode hint (only when on) */}
        {editorOn && (
          <div className="mb-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[#95BF47]/8 border border-[#95BF47]/20 text-[12px] leading-snug text-white/75">
            <Pencil className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#95BF47]" />
            <span>{t.emailGen.epEditorHelp}</span>
          </div>
        )}

        {/* Preview chrome */}
        <div className="preview-chrome">
          <div className="preview-bar">
            <span className="dot" style={{ background: "#ff5f57" }} />
            <span className="dot" style={{ background: "#febc2e" }} />
            <span className="dot" style={{ background: "#28c840" }} />
            <div className="ml-3 flex-1 text-[12px] font-medium text-white/45 truncate">
              {subject ?? "E-Mail Vorschau"}
            </div>
          </div>

          {/* Gmail-style header — hidden on mobile */}
          <div
            className="hidden sm:block"
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
                  ["Von", "Brospify Store", "noreply@brospify-store.myshopify.com"],
                  ["An", "Alexander Schmidt", "alex.schmidt@example.de"],
                ].map(([label, name, addr]) => (
                  <tr key={label}>
                    <td style={{ width: "40px", color: "#5f6368", fontSize: "13px", paddingBottom: "4px", verticalAlign: "top" }}>{label}</td>
                    <td style={{ color: "#202124", fontSize: "13px", paddingBottom: "4px" }}>
                      <strong style={{ fontWeight: 500 }}>{name}</strong>{" "}
                      <span style={{ color: "#5f6368" }}>&lt;{addr}&gt;</span>
                    </td>
                    <td style={{ color: "#5f6368", fontSize: "13px", textAlign: "right", whiteSpace: "nowrap" }}>
                      {label === "Von" ? "1. Mai 2026, 14:32" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Email frame — outer wrapper fits content; iframe scrolls
              internally just like a real Gmail / Apple Mail message. */}
          <div className="flex justify-center bg-[#f6f8fc] py-4 sm:py-6 px-2 sm:px-4">
            <div
              className="rounded-xl overflow-hidden bg-white shadow-xl transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ width: `${frameWidth}px`, maxWidth: "100%" }}
            >
              <iframe
                ref={iframeRef}
                title="email-preview"
                sandbox="allow-same-origin allow-scripts"
                className="w-full block border-0"
                style={{
                  height: view === "mobile" ? "70vh" : 720,
                  minHeight: 420,
                  maxHeight: 820,
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-2.5 sm:py-3 border-t border-white/[0.05] bg-white/[0.015] text-[11px] text-white/35">
            <span className="inline-flex items-center gap-1.5">
              <Coins className="w-3 h-3" />
              <span className="hidden sm:inline">
                {t.emailGen.epTextEditsFull}
              </span>
              <span className="sm:hidden">{t.emailGen.epTextEditsFree}</span>
            </span>
            <span>{frameWidth}px</span>
          </div>
        </div>
      </div>
    );
  },
);
