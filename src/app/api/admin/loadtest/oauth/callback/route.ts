import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSession } from "@/lib/session";
import { setAdminSetting } from "@/lib/sheets";
import {
  getLoadTestOAuthCreds,
  LOADTEST_KEY_DOMAIN,
  LOADTEST_KEY_TOKEN,
} from "@/lib/loadtest-creds";
import { assertDevStoreDomain, verifyDevStore } from "@/lib/shopify-graphql";

export const dynamic = "force-dynamic";

// Validate Shopify's `hmac` query parameter against the rest of the
// query. Spec: take all params except `hmac` and `signature`, sort
// them alphabetically by key, join as `k=v` pairs with `&`, then
// HMAC-SHA256 with the app's client secret. Result is hex; compare
// using timingSafeEqual to dodge timing attacks.
function verifyShopifyHmac(searchParams: URLSearchParams, clientSecret: string): boolean {
  const hmac = searchParams.get("hmac") || "";
  if (!hmac) return false;
  const pairs: [string, string][] = [];
  for (const [k, v] of searchParams.entries()) {
    if (k === "hmac" || k === "signature") continue;
    pairs.push([k, v]);
  }
  pairs.sort(([a], [b]) => a.localeCompare(b));
  const message = pairs.map(([k, v]) => `${k}=${v}`).join("&");
  const digest = crypto.createHmac("sha256", clientSecret).update(message).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(hmac, "hex"));
  } catch {
    return false;
  }
}

function renderResult(opts: { ok: boolean; title: string; message: string; redirect?: string }): Response {
  const safeMsg = opts.message.replace(/[<>]/g, "");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${opts.title}</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;background:#030303;color:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{max-width:480px;padding:32px;border-radius:20px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);text-align:center}
.ok{color:#95BF47}.err{color:#f87171}
.bar{margin-top:24px;text-align:center}
a{color:#95BF47;text-decoration:none;font-weight:bold}</style></head>
<body><div class="card">
<div class="${opts.ok ? "ok" : "err"}" style="font-size:48px;line-height:1">${opts.ok ? "✓" : "✗"}</div>
<h2>${opts.title}</h2>
<p style="color:#a1a1aa;font-size:14px">${safeMsg}</p>
<div class="bar"><a href="${opts.redirect || "/admin/loadtest"}">Zurück zum Load-Tester →</a></div>
</div>
<script>setTimeout(()=>{location.href=${JSON.stringify(opts.redirect || "/admin/loadtest")}},${opts.ok ? 1500 : 6000})</script>
</body></html>`;
  return new Response(html, { status: opts.ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } });
}

interface TokenResponse {
  access_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const code = params.get("code") || "";
  const shopRaw = params.get("shop") || "";
  const state = params.get("state") || "";

  if (!code || !shopRaw || !state) {
    return renderResult({ ok: false, title: "OAuth abgebrochen", message: "Pflicht-Parameter fehlen (code/shop/state)." });
  }

  let shop: string;
  try {
    shop = assertDevStoreDomain(shopRaw);
  } catch (err) {
    return renderResult({ ok: false, title: "Ungültige Domain", message: err instanceof Error ? err.message : "Domain Validation failed" });
  }

  // State must match what we stashed in /start.
  const expected = session.oauthNonce || "";
  if (!expected.startsWith(`loadtest:${shop}:`) || expected.split(":")[2] !== state) {
    return renderResult({ ok: false, title: "State-Mismatch", message: "OAuth state nonce passt nicht — möglicher Replay-Versuch." });
  }
  session.oauthNonce = "";
  await session.save();

  const creds = await getLoadTestOAuthCreds();
  if (!creds) {
    return renderResult({ ok: false, title: "OAuth-Creds fehlen", message: "Client ID + Secret nicht konfiguriert. Erst die App-Creds speichern, dann erneut versuchen." });
  }

  // HMAC validates that the callback came from Shopify and wasn't
  // tampered with in transit.
  if (!verifyShopifyHmac(params, creds.clientSecret)) {
    return renderResult({ ok: false, title: "HMAC ungültig", message: "Callback-Signatur stimmt nicht — Client Secret falsch eingegeben oder Request manipuliert." });
  }

  // Exchange code for offline access token.
  let tokenJson: TokenResponse;
  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "content-type": "application/json", "accept": "application/json" },
      body: JSON.stringify({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        code,
      }),
    });
    tokenJson = (await tokenRes.json()) as TokenResponse;
    if (!tokenRes.ok || tokenJson.error || !tokenJson.access_token) {
      return renderResult({
        ok: false,
        title: "Token-Exchange fehlgeschlagen",
        message: tokenJson.error_description || tokenJson.error || `HTTP ${tokenRes.status} ohne access_token.`,
      });
    }
  } catch (err) {
    return renderResult({
      ok: false,
      title: "Netzwerkfehler beim Token-Exchange",
      message: err instanceof Error ? err.message : "unknown",
    });
  }

  // Semantic guard: confirm dev-store plan AFTER OAuth so we never
  // persist a token to a production shop.
  const verdict = await verifyDevStore(shop, tokenJson.access_token);
  if (!verdict.ok) {
    return renderResult({
      ok: false,
      title: "Produktiv-Shop blockiert",
      message: verdict.error || "Shop ist nicht als Development store geflagged. Token wird verworfen.",
    });
  }

  await setAdminSetting(LOADTEST_KEY_DOMAIN, shop);
  await setAdminSetting(LOADTEST_KEY_TOKEN, tokenJson.access_token);

  return renderResult({
    ok: true,
    title: "Verbunden",
    message: `Shop "${verdict.shopName}" (${verdict.planName}) erfolgreich verbunden. Du wirst zurückgeleitet.`,
    redirect: "/admin/loadtest?oauth=ok",
  });
}
