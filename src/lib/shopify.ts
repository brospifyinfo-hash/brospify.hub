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
