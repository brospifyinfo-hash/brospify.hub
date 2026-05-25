// ─── Shared Shopify API helper ──────────────────────────
// Centralizes authenticated fetch calls to Shopify REST Admin API

export interface ShopifyFetchOpts {
  domain: string;
  token: string;
  path: string;
  method?: string;
  body?: unknown;
}

export async function shopifyFetch<T = unknown>({ domain, token, path, method = "GET", body }: ShopifyFetchOpts): Promise<T> {
  const url = `https://${domain}/admin/api/2024-01${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Types for Shopify responses ────────────────────────

export interface ShopifyOrder {
  id: number;
  created_at: string;
  total_price: string;
  financial_status: string;
  line_items: ShopifyLineItem[];
  referring_site?: string;
  landing_site?: string;
  source_name?: string;
  checkout_id?: number;
  cart_token?: string;
}

export interface ShopifyLineItem {
  product_id: number;
  title: string;
  quantity: number;
  price: string;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  image?: { src: string };
  variants: { price: string }[];
}

// ─── Order metafield write ──────────────────────────────
// Attaches a custom metafield to a Shopify order. Used by the
// webhook handler to surface the license key in Shopify's own
// order-confirmation email — no external email service needed.
//
// Liquid render path in the email template:
//   {{ order.metafields.custom.license_key }}
//
// Requires the merchant's Admin API access token with the
// `write_order_metafields` scope. Token + shop domain come
// from the env vars SHOPIFY_ADMIN_TOKEN + SHOPIFY_SHOP_DOMAIN
// (the latter is the *.myshopify.com handle, e.g.
// "fxzu0e-6i.myshopify.com" — NOT the custom domain).

export interface WriteOrderMetafieldArgs {
  orderId: number;
  namespace?: string;
  key: string;
  value: string;
  type?: string;
}

// ─── Subscription contract cancel ───────────────────────
// Shopify Subscriptions live behind the GraphQL Admin API, not REST.
// Mutation: subscriptionContractCancel(subscriptionContractId: ID!)
// Required scopes: write_own_subscription_contracts (or
// write_customer_payment_methods + write_subscription_contracts when
// managing on behalf of a customer).
//
// We pass the contract GID (`gid://shopify/SubscriptionContract/<n>`).
// The caller usually has just the numeric id we stored in
// kundeProfile.subscriptionContractId — we accept both and normalize.

export interface CancelSubscriptionArgs {
  contractId: string; // numeric or full GID
}

export async function cancelShopifySubscription(
  args: CancelSubscriptionArgs,
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const domain = (process.env.SHOPIFY_SHOP_DOMAIN || "").trim();
  const token = (process.env.SHOPIFY_ADMIN_TOKEN || "").trim();
  if (!domain || !token) {
    return { ok: false, error: "SHOPIFY_SHOP_DOMAIN or SHOPIFY_ADMIN_TOKEN not configured" };
  }
  const raw = (args.contractId || "").trim();
  if (!raw) return { ok: false, error: "Missing contractId" };
  const gid = raw.startsWith("gid://") ? raw : `gid://shopify/SubscriptionContract/${raw}`;
  const query = `
    mutation cancel($id: ID!) {
      subscriptionContractCancel(subscriptionContractId: $id) {
        contract { id status }
        userErrors { field message }
      }
    }
  `;
  try {
    const url = `https://${domain}/admin/api/2024-01/graphql.json`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { id: gid } }),
    });
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, error: `Shopify ${res.status}: ${txt}` };
    }
    const data = (await res.json()) as {
      data?: {
        subscriptionContractCancel?: {
          contract?: { id?: string; status?: string };
          userErrors?: { field?: string[]; message?: string }[];
        };
      };
      errors?: { message?: string }[];
    };
    if (data.errors?.length) {
      return { ok: false, error: data.errors.map((e) => e.message).join("; ") };
    }
    const errs = data.data?.subscriptionContractCancel?.userErrors || [];
    if (errs.length) {
      return { ok: false, error: errs.map((e) => e.message).filter(Boolean).join("; ") };
    }
    return { ok: true, status: data.data?.subscriptionContractCancel?.contract?.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

export async function writeOrderMetafield(args: WriteOrderMetafieldArgs): Promise<{ ok: boolean; error?: string }> {
  const domain = (process.env.SHOPIFY_SHOP_DOMAIN || "").trim();
  const token = (process.env.SHOPIFY_ADMIN_TOKEN || "").trim();
  if (!domain || !token) {
    return { ok: false, error: "SHOPIFY_SHOP_DOMAIN or SHOPIFY_ADMIN_TOKEN not configured" };
  }
  try {
    await shopifyFetch({
      domain,
      token,
      path: `/orders/${args.orderId}/metafields.json`,
      method: "POST",
      body: {
        metafield: {
          namespace: args.namespace || "custom",
          key: args.key,
          value: args.value,
          type: args.type || "single_line_text_field",
        },
      },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
