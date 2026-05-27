// ─── Shopify GraphQL Admin API — load-test client ──────────────
// Strictly scoped to *.myshopify.com Development Stores. The Hub's
// admin LoadTest dashboard is the only caller. Every public helper
// validates the domain so a stray production credential cannot end
// up here.
//
// Why GraphQL (and not REST): orderCreate / draftOrderComplete are
// only available on GraphQL Admin API since 2024-10; REST is legacy.
//
// Rate-limit model (Shopify GraphQL Admin):
//   • Bucket: 100 cost points (1000 on Plus)
//   • Refill: 50 points/sec (100 on Plus)
//   • orderCreate ≈ 10 points, productsList(first:50) ≈ 12 points
//
// We DO NOT bypass that limit — we measure it. The response carries
// `extensions.cost.throttleStatus.currentlyAvailable`; we surface
// that to the dashboard so the user sees the wall as it gets hit.
// On 429 (THROTTLED) we exponential-back-off (250ms → 4s, capped)
// and return a flag so the browser-side chaos engine can count it.

const API_VERSION = "2024-10";

export class ShopifyDevStoreError extends Error {
  status: number;
  throttled: boolean;
  costDebug?: ShopifyCostDebug;
  constructor(opts: { message: string; status: number; throttled?: boolean; costDebug?: ShopifyCostDebug }) {
    super(opts.message);
    this.status = opts.status;
    this.throttled = !!opts.throttled;
    this.costDebug = opts.costDebug;
    this.name = "ShopifyDevStoreError";
  }
}

export interface ShopifyCostDebug {
  requested: number;
  actual: number;
  currentlyAvailable: number;
  maximumAvailable: number;
  restoreRate: number;
}

export interface ShopifyGraphQLResponse<T> {
  data?: T;
  errors?: { message: string; extensions?: { code?: string } }[];
  cost?: ShopifyCostDebug;
}

// Dev-store guard: only accept *.myshopify.com. Custom domains, IPs,
// or anything funky → reject. This is the single biggest safety rail
// that keeps the load tester away from a production storefront.
export function assertDevStoreDomain(domain: string): string {
  const clean = (domain || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!clean) {
    throw new Error("Dev store domain is empty.");
  }
  if (!/^[a-z0-9-]+\.myshopify\.com$/.test(clean)) {
    throw new Error(
      `Domain "${clean}" ist keine *.myshopify.com Adresse. ` +
      `Der Load-Tester akzeptiert nur Development-Store Handles, ` +
      `keine Custom-Domains und keine Produktiv-Shops.`,
    );
  }
  return clean;
}

interface RawGraphQLEnvelope<T> {
  data?: T;
  errors?: { message: string; extensions?: { code?: string } }[];
  extensions?: {
    cost?: {
      requestedQueryCost?: number;
      actualQueryCost?: number;
      throttleStatus?: {
        currentlyAvailable?: number;
        maximumAvailable?: number;
        restoreRate?: number;
      };
    };
  };
}

interface ShopifyCallOpts {
  domain: string;
  token: string;
  query: string;
  variables?: Record<string, unknown>;
  // Browser timing context — we don't use it server-side, but it
  // helps when the chaos engine wants to attribute a slow response
  // to a specific frequency mode.
  callerHint?: string;
}

// Tiny exponential backoff. We do at most 3 retries; if Shopify is
// truly saturated the right thing is to surface that to the dashboard
// so the user can see the wall they hit — not to silently retry away
// the very signal a load test is designed to expose.
async function callGraphQL<T>({ domain, token, query, variables }: ShopifyCallOpts): Promise<ShopifyGraphQLResponse<T>> {
  const clean = assertDevStoreDomain(domain);
  const url = `https://${clean}/admin/api/${API_VERSION}/graphql.json`;
  const maxRetries = 3;
  let attempt = 0;
  let delay = 250;

  while (true) {
    const start = Date.now();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: variables || {} }),
    });

    if (res.status === 429) {
      // Hard throttle. Honour Retry-After if present, else backoff.
      if (attempt >= maxRetries) {
        throw new ShopifyDevStoreError({
          message: "Shopify hat 429 (THROTTLED) zurueckgegeben — Bucket leer.",
          status: 429,
          throttled: true,
        });
      }
      const retryAfter = Number.parseFloat(res.headers.get("retry-after") || "0");
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : delay;
      await sleep(wait);
      delay = Math.min(delay * 2, 4000);
      attempt += 1;
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ShopifyDevStoreError({
        message: `Shopify HTTP ${res.status}: ${text.slice(0, 240) || res.statusText}`,
        status: res.status,
      });
    }

    const json = (await res.json()) as RawGraphQLEnvelope<T>;
    const cost = json.extensions?.cost;
    const costDebug: ShopifyCostDebug | undefined = cost
      ? {
          requested: cost.requestedQueryCost ?? 0,
          actual: cost.actualQueryCost ?? 0,
          currentlyAvailable: cost.throttleStatus?.currentlyAvailable ?? 0,
          maximumAvailable: cost.throttleStatus?.maximumAvailable ?? 0,
          restoreRate: cost.throttleStatus?.restoreRate ?? 0,
        }
      : undefined;

    // GraphQL-level THROTTLED comes back as 200 with errors[].extensions.code.
    // Retry if we still have budget; otherwise surface it.
    const throttledErr = (json.errors || []).find((e) => e.extensions?.code === "THROTTLED");
    if (throttledErr) {
      if (attempt >= maxRetries) {
        throw new ShopifyDevStoreError({
          message: throttledErr.message || "GraphQL THROTTLED",
          status: 429,
          throttled: true,
          costDebug,
        });
      }
      await sleep(delay);
      delay = Math.min(delay * 2, 4000);
      attempt += 1;
      continue;
    }

    // First successful (or business-error) response — surface latency
    // implicitly via Date.now() difference recorded by the caller.
    void start;
    return { data: json.data, errors: json.errors, cost: costDebug };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Dev-store verification ────────────────────────────────────
// The `*.myshopify.com` regex blocks custom domains but a production
// shop with a stock subdomain (e.g. `brospify.myshopify.com`) would
// still pass — that's the difference between syntactic and semantic
// guards. Shopify exposes the real signal on `shop.plan.partnerDevelopment`:
// it returns true only for stores created as Development stores in
// the Partner Dashboard. We call this once on config save so a stray
// production credential is rejected before any orderCreate can fire.

const SHOP_INFO_QUERY = `
  query {
    shop {
      name
      myshopifyDomain
      plan { partnerDevelopment shopifyPlus displayName }
    }
  }
`;

interface ShopInfoData {
  shop: {
    name: string;
    myshopifyDomain: string;
    plan: { partnerDevelopment: boolean; shopifyPlus: boolean; displayName: string };
  };
}

export interface VerifyDevStoreResult {
  ok: boolean;
  shopName?: string;
  planName?: string;
  isDevStore?: boolean;
  error?: string;
}

export async function verifyDevStore(domain: string, token: string): Promise<VerifyDevStoreResult> {
  try {
    const res = await callGraphQL<ShopInfoData>({
      domain,
      token,
      query: SHOP_INFO_QUERY,
    });
    if (res.errors?.length) {
      return { ok: false, error: res.errors[0].message };
    }
    const shop = res.data?.shop;
    if (!shop) {
      return { ok: false, error: "Konnte Shop-Info nicht laden — Token ungültig oder fehlende Scopes?" };
    }
    const isDev = !!shop.plan?.partnerDevelopment;
    if (!isDev) {
      return {
        ok: false,
        shopName: shop.name,
        planName: shop.plan?.displayName,
        isDevStore: false,
        error: `"${shop.name}" (Plan: ${shop.plan?.displayName || "unknown"}) ist KEIN Development-Store. Der Load-Tester verweigert Tokens zu Produktiv-Shops, damit Bestseller-Ranking, Conversion und Analytics nicht durch synthetische Orders verfälscht werden.`,
      };
    }
    return { ok: true, shopName: shop.name, planName: shop.plan.displayName, isDevStore: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

// ─── Products list ─────────────────────────────────────────────
// Used by the "New Run" form's dropdown. Returns a flat list of
// (productId, variantId, title, price) so the dashboard can show
// the user what they're about to flood the dev store with.

export interface DevStoreProduct {
  productId: string;
  productTitle: string;
  variantId: string;
  variantTitle: string;
  price: string;
  available: number | null;
}

const LIST_PRODUCTS_QUERY = `
  query ListProducts($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          status
          variants(first: 1) {
            edges {
              node {
                id
                title
                price
                inventoryQuantity
              }
            }
          }
        }
      }
    }
  }
`;

interface ListProductsData {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: {
      node: {
        id: string;
        title: string;
        status: string;
        variants: { edges: { node: { id: string; title: string; price: string; inventoryQuantity: number | null } }[] };
      };
    }[];
  };
}

export async function listDevStoreProducts(domain: string, token: string): Promise<DevStoreProduct[]> {
  const out: DevStoreProduct[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 6; page += 1) {
    const res: ShopifyGraphQLResponse<ListProductsData> = await callGraphQL<ListProductsData>({
      domain,
      token,
      query: LIST_PRODUCTS_QUERY,
      variables: { cursor },
    });
    if (res.errors?.length) {
      throw new ShopifyDevStoreError({
        message: `Produkte konnten nicht geladen werden: ${res.errors[0].message}`,
        status: 400,
      });
    }
    const data = res.data;
    if (!data) break;
    for (const edge of data.products.edges) {
      if (edge.node.status !== "ACTIVE") continue;
      const variant = edge.node.variants.edges[0]?.node;
      if (!variant) continue;
      out.push({
        productId: edge.node.id,
        productTitle: edge.node.title,
        variantId: variant.id,
        variantTitle: variant.title,
        price: variant.price,
        available: variant.inventoryQuantity,
      });
    }
    if (!data.products.pageInfo.hasNextPage || !data.products.pageInfo.endCursor) break;
    cursor = data.products.pageInfo.endCursor;
  }
  return out;
}

// ─── Order create (single fire) ────────────────────────────────
// The chaos engine calls this once per "tick" via /api/admin/loadtest/.../fire.
// Each order is tagged so a Shopify-side bulk-delete-by-tag cleanup
// stays trivial; the dashboard never tracks individual order IDs in
// the DB because Sheets cannot keep up with sub-second writes.
//
// `sendReceipt:false` keeps the test silent on the dev store — there's
// no real customer to email, and it would spam the dev account's inbox.

export interface FireOrderInput {
  domain: string;
  token: string;
  variantId: string;          // gid://shopify/ProductVariant/...
  unitPrice: string;          // numeric string, e.g. "29.99"
  tag: string;                // unique-per-session tag for cleanup
  sessionId: string;          // included in note for traceability
}

export interface FireOrderResult {
  ok: boolean;
  orderId?: string;
  latencyMs: number;
  throttled: boolean;
  cost?: ShopifyCostDebug;
  errorMessage?: string;
  // Diagnostic echo of what Shopify actually stored — surfaces the
  // sourceName Shopify accepted (or silently rewrote) so we can spot
  // when "loadtester" gets fallback'd to "import" without an error.
  diagnostics?: {
    storedSourceName?: string | null;
    storedSourceIdentifier?: string | null;
    appTitle?: string | null;
  };
}

// orderCreate takes TWO args in API 2024-10:
//   order:   OrderCreateOrderInput!     — line items, financial status, tags, …
//   options: OrderCreateOptionsInput    — sendReceipt, sendFulfillmentReceipt,
//                                         inventoryBehaviour
// Putting the notification toggles inside `order` is rejected with
// "Field is not defined on OrderCreateOrderInput".
const ORDER_CREATE_MUTATION = `
  mutation LoadTestOrderCreate($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
    orderCreate(order: $order, options: $options) {
      order {
        id
        name
        sourceName
        sourceIdentifier
        app { id title }
      }
      userErrors { field message }
    }
  }
`;

interface OrderCreateData {
  orderCreate: {
    order: {
      id: string;
      name: string;
      sourceName?: string | null;
      sourceIdentifier?: string | null;
      app?: { id?: string; title?: string } | null;
    } | null;
    userErrors: { field: string[] | null; message: string }[];
  };
}

export async function fireSingleOrder(input: FireOrderInput): Promise<FireOrderResult> {
  const start = Date.now();
  try {
    const res = await callGraphQL<OrderCreateData>({
      domain: input.domain,
      token: input.token,
      query: ORDER_CREATE_MUTATION,
      variables: {
        order: {
          lineItems: [{ variantId: input.variantId, quantity: 1, priceSet: { shopMoney: { amount: input.unitPrice, currencyCode: "EUR" } } }],
          tags: [input.tag, "loadtest", "brospify-hub"],
          note: `Brospify Hub load test · session=${input.sessionId}`,
          financialStatus: "PAID",
          // Custom non-protected sourceName so the mobile notification
          // shows "via loadtester" instead of the default "via import".
          // Shopify reserves values like "web", "pos", "iphone" for its
          // own first-party surfaces and rejects them from API clients
          // with "Order Source name cannot be set to a protected value
          // by an untrusted API client" — we use our app's name.
          sourceName: "loadtester",
        },
        options: {
          sendReceipt: false,
          sendFulfillmentReceipt: false,
          // Load tests should never deplete inventory — otherwise a
          // tracked product runs out after a few hundred fires and
          // every subsequent order fails with "out of stock", which
          // measures the wrong thing.
          inventoryBehaviour: "BYPASS",
        },
      },
    });
    const latencyMs = Date.now() - start;

    if (res.errors?.length) {
      const first = res.errors[0];
      return {
        ok: false,
        latencyMs,
        throttled: false,
        cost: res.cost,
        errorMessage: first.message,
      };
    }
    const userErr = res.data?.orderCreate.userErrors || [];
    if (userErr.length) {
      return {
        ok: false,
        latencyMs,
        throttled: false,
        cost: res.cost,
        errorMessage: userErr.map((e) => `${(e.field || []).join(".")}: ${e.message}`).join("; "),
      };
    }
    const order = res.data?.orderCreate.order;
    return {
      ok: !!order,
      orderId: order?.id,
      latencyMs,
      throttled: false,
      cost: res.cost,
      errorMessage: order ? undefined : "Shopify returned no order and no userErrors.",
      diagnostics: order ? {
        storedSourceName: order.sourceName ?? null,
        storedSourceIdentifier: order.sourceIdentifier ?? null,
        appTitle: order.app?.title ?? null,
      } : undefined,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    if (err instanceof ShopifyDevStoreError) {
      return {
        ok: false,
        latencyMs,
        throttled: err.throttled,
        cost: err.costDebug,
        errorMessage: err.message,
      };
    }
    return {
      ok: false,
      latencyMs,
      throttled: false,
      errorMessage: err instanceof Error ? err.message : "unknown error",
    };
  }
}
