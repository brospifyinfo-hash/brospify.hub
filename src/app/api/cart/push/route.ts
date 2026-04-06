import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllKunden, getKundeProfile } from "@/lib/sheets";
import { shopifyFetch } from "@/lib/shopify";

export const dynamic = "force-dynamic";

/** Resolve Shopify credentials */
async function resolveShopify(session: { shopifyToken?: string; shopDomain?: string; lizenzschluessel?: string }) {
  if (session.shopifyToken && session.shopDomain) {
    return { token: session.shopifyToken, domain: session.shopDomain };
  }
  if (!session.lizenzschluessel) return null;
  const kunden = await getAllKunden();
  const kunde = kunden.find((k) => k.lizenzschluessel === session.lizenzschluessel);
  if (!kunde?.shopifyToken || !kunde?.shopDomain) return null;
  return { token: kunde.shopifyToken, domain: kunde.shopDomain };
}

/** Build the Liquid snippet for cart trust badges, timer, progress bar */
function buildCartSnippet(settings: {
  paypal?: boolean; klarna?: boolean; visa?: boolean; guarantee?: boolean; secureCheckout?: boolean;
  cartTimer?: boolean; freeShippingBar?: boolean; freeShippingThreshold?: number;
  accentColor?: string;
}): string {
  const accent = settings.accentColor || "#95BF47";
  const badges: string[] = [];

  if (settings.paypal) badges.push(`<span class="brospify-badge"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> PayPal</span>`);
  if (settings.klarna) badges.push(`<span class="brospify-badge" style="color:#ec4899"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Klarna</span>`);
  if (settings.visa) badges.push(`<span class="brospify-badge" style="color:#3b82f6"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Visa / MC</span>`);
  if (settings.guarantee) badges.push(`<span class="brospify-badge" style="color:#22c55e"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12l5 5L21 6"/></svg> 30-Day Guarantee</span>`);
  if (settings.secureCheckout) badges.push(`<span class="brospify-badge" style="color:${accent}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> SSL Secure</span>`);

  let html = `<!-- BrospifyHub Cart Enhancements -->
<style>
.brospify-cart-enhancements{font-family:system-ui,-apple-system,sans-serif;margin:1rem 0}
.brospify-badges{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}
.brospify-badge{display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:8px;font-size:11px;font-weight:600;background:rgba(0,0,0,0.04);color:#374151}
.brospify-timer{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;font-size:13px;font-weight:500;background:${accent}10;color:${accent};margin:10px 0}
.brospify-timer svg{flex-shrink:0}
.brospify-shipping-bar{margin:12px 0}
.brospify-shipping-bar .bar-track{height:6px;background:rgba(0,0,0,0.06);border-radius:99px;overflow:hidden}
.brospify-shipping-bar .bar-fill{height:100%;background:${accent};border-radius:99px;transition:width 0.5s ease}
.brospify-shipping-bar .bar-label{font-size:12px;color:#666;margin-top:4px}
</style>
<div class="brospify-cart-enhancements">
`;

  // Cart Timer
  if (settings.cartTimer) {
    html += `<div class="brospify-timer" id="brospify-timer">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
  <span>Reserved for you: <strong id="brospify-countdown">15:00</strong></span>
</div>
<script>
(function(){var t=900,el=document.getElementById('brospify-countdown');if(!el)return;setInterval(function(){if(t<=0)return;t--;var m=Math.floor(t/60),s=t%60;el.textContent=m+':'+(s<10?'0':'')+s;},1000);})();
</script>
`;
  }

  // Free Shipping Progress Bar
  if (settings.freeShippingBar) {
    const threshold = settings.freeShippingThreshold || 50;
    html += `<div class="brospify-shipping-bar">
  <div class="bar-label">
    {% assign cart_total_eur = cart.total_price | divided_by: 100.0 %}
    {% assign threshold = ${threshold} %}
    {% assign remaining = threshold | minus: cart_total_eur %}
    {% if remaining > 0 %}
      Noch {{ remaining | money_without_currency }} € bis zum kostenlosen Versand!
    {% else %}
      ✓ Kostenloser Versand freigeschaltet!
    {% endif %}
  </div>
  <div class="bar-track">
    <div class="bar-fill" style="width:{% if cart_total_eur >= ${threshold} %}100{% else %}{{ cart_total_eur | times: 100 | divided_by: ${threshold} }}{% endif %}%"></div>
  </div>
</div>
`;
  }

  // Trust Badges
  if (badges.length > 0) {
    html += `<div class="brospify-badges">\n${badges.join("\n")}\n</div>\n`;
  }

  html += `</div>\n<!-- /BrospifyHub Cart Enhancements -->`;
  return html;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const creds = await resolveShopify(session);
    if (!creds) {
      return NextResponse.json({ error: "Shopify not connected" }, { status: 400 });
    }

    const { domain, token } = creds;
    const body = await req.json();

    // Get the active theme
    const { themes } = await shopifyFetch<{ themes: { id: number; role: string }[] }>({
      domain, token, path: "/themes.json",
    });
    const mainTheme = themes.find((t) => t.role === "main");
    if (!mainTheme) {
      return NextResponse.json({ error: "No active theme found" }, { status: 404 });
    }

    // Build the snippet
    const snippet = buildCartSnippet(body);

    // Push as a snippet file (non-destructive, doesn't overwrite existing templates)
    await shopifyFetch({
      domain, token,
      path: `/themes/${mainTheme.id}/assets.json`,
      method: "PUT",
      body: {
        asset: {
          key: "snippets/brospify-cart-enhancements.liquid",
          value: snippet,
        },
      },
    });

    // Load the customer's profile for additional info
    const kunden = await getAllKunden();
    const kunde = kunden.find((k) => k.lizenzschluessel === session.lizenzschluessel);

    return NextResponse.json({
      ok: true,
      themeId: mainTheme.id,
      snippetKey: "snippets/brospify-cart-enhancements.liquid",
      note: "Snippet pushed. Add {% render 'brospify-cart-enhancements' %} to your cart template.",
      shopDomain: kunde?.shopDomain,
    });
  } catch (error) {
    console.error("[Cart Push] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
