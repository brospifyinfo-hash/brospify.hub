import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey } from "@/lib/sheets";
import { shopifyFetch } from "@/lib/shopify";

export const dynamic = "force-dynamic";

interface ShopifyImage {
  id: number;
  alt: string | null;
  src: string;
}

interface ShopifyProductFull {
  id: number;
  title: string;
  body_html: string | null;
  handle: string;
  images: ShopifyImage[];
  metafields_global_title_tag?: string;
  metafields_global_description_tag?: string;
}

interface ProductsResponse {
  products: ShopifyProductFull[];
}

interface MetafieldNode {
  namespace: string;
  key: string;
  value: string;
}

interface GraphQLMetafieldsResponse {
  data: {
    products: {
      edges: {
        node: {
          id: string;
          metafields: {
            edges: { node: MetafieldNode }[];
          };
        };
      }[];
      pageInfo: { hasNextPage: boolean; endCursor: string };
    };
  };
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde || !kunde.shopifyToken || !kunde.shopDomain) {
      return NextResponse.json(
        { error: "Shop nicht verbunden. Bitte verbinde deinen Shop unter Einstellungen." },
        { status: 400 }
      );
    }

    const domain = kunde.shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const token = kunde.shopifyToken;

    // Fetch all products (paginated, up to 250)
    const allProducts: ShopifyProductFull[] = [];
    let pageInfo = "";
    let hasMore = true;

    while (hasMore && allProducts.length < 1000) {
      const params = new URLSearchParams({
        limit: "250",
        fields: "id,title,body_html,handle,images",
      });
      if (pageInfo) params.set("page_info", pageInfo);

      const data = await shopifyFetch<ProductsResponse>({
        domain,
        token,
        path: `/products.json?${params.toString()}`,
      });

      allProducts.push(...data.products);

      // Check for pagination via Link header - REST API returns max 250
      hasMore = data.products.length === 250;
      if (hasMore && data.products.length > 0) {
        // Use since_id pagination
        const lastId = data.products[data.products.length - 1].id;
        pageInfo = "";
        const nextParams = new URLSearchParams({
          limit: "250",
          fields: "id,title,body_html,handle,images",
          since_id: String(lastId),
        });
        const nextData = await shopifyFetch<ProductsResponse>({
          domain,
          token,
          path: `/products.json?${nextParams.toString()}`,
        });
        allProducts.push(...nextData.products);
        hasMore = nextData.products.length === 250;
      } else {
        hasMore = false;
      }
    }

    // Fetch SEO metafields via GraphQL (seo_title, seo_description)
    const seoMeta = new Map<string, { seoTitle: string; seoDescription: string }>();
    try {
      const graphqlQuery = `{
        products(first: 250) {
          edges {
            node {
              id
              metafields(first: 10, namespace: "global") {
                edges {
                  node {
                    namespace
                    key
                    value
                  }
                }
              }
            }
          }
        }
      }`;

      const gqlRes = await fetch(`https://${domain}/admin/api/2024-01/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({ query: graphqlQuery }),
      });

      if (gqlRes.ok) {
        const gqlData: GraphQLMetafieldsResponse = await gqlRes.json();
        for (const edge of gqlData.data?.products?.edges || []) {
          const numericId = edge.node.id.replace(/\D/g, "");
          const metas = edge.node.metafields?.edges || [];
          const titleMeta = metas.find((m) => m.node.key === "title_tag");
          const descMeta = metas.find((m) => m.node.key === "description_tag");
          seoMeta.set(numericId, {
            seoTitle: titleMeta?.node.value || "",
            seoDescription: descMeta?.node.value || "",
          });
        }
      }
    } catch (e) {
      console.error("[SEO Audit] GraphQL metafields fetch failed:", e);
    }

    // Analyze each product
    const issues: {
      productId: number;
      productTitle: string;
      handle: string;
      problems: { type: string; detail: string }[];
    }[] = [];

    let totalImages = 0;
    let missingAltTexts = 0;
    let missingMetaDescriptions = 0;
    let shortDescriptions = 0;
    let missingTitles = 0;

    for (const product of allProducts) {
      const problems: { type: string; detail: string }[] = [];
      const meta = seoMeta.get(String(product.id));

      // Check images for alt text
      for (const img of product.images || []) {
        totalImages++;
        if (!img.alt || img.alt.trim().length === 0) {
          missingAltTexts++;
          problems.push({
            type: "missing_alt",
            detail: `Bild ${img.id} hat keinen Alt-Text`,
          });
        }
      }

      // Check meta description
      const metaDesc = meta?.seoDescription || "";
      if (!metaDesc || metaDesc.trim().length === 0) {
        missingMetaDescriptions++;
        problems.push({
          type: "missing_meta_description",
          detail: "Keine Meta-Description vorhanden",
        });
      }

      // Check body_html length (< 100 chars = too short)
      const bodyText = (product.body_html || "").replace(/<[^>]*>/g, "").trim();
      if (bodyText.length < 100) {
        shortDescriptions++;
        problems.push({
          type: "short_description",
          detail: `Beschreibung zu kurz (${bodyText.length} Zeichen, min. 100 empfohlen)`,
        });
      }

      // Check if product title is generic/missing
      if (!product.title || product.title.trim().length < 5) {
        missingTitles++;
        problems.push({
          type: "weak_title",
          detail: "Produkttitel zu kurz oder fehlend",
        });
      }

      if (problems.length > 0) {
        issues.push({
          productId: product.id,
          productTitle: product.title,
          handle: product.handle,
          problems,
        });
      }
    }

    // Calculate score (0-100)
    const totalProducts = allProducts.length;
    if (totalProducts === 0) {
      return NextResponse.json({
        score: 100,
        totalProducts: 0,
        totalImages: 0,
        metrics: {
          missingAltTexts: 0,
          missingMetaDescriptions: 0,
          shortDescriptions: 0,
          missingTitles: 0,
        },
        issues: [],
        message: "Keine Produkte im Shop gefunden.",
      });
    }

    const totalChecks = totalImages + totalProducts * 3; // alt texts + meta desc + description length + titles
    const totalFails = missingAltTexts + missingMetaDescriptions + shortDescriptions + missingTitles;
    const score = totalChecks > 0 ? Math.round(((totalChecks - totalFails) / totalChecks) * 100) : 100;

    return NextResponse.json({
      score,
      totalProducts,
      totalImages,
      metrics: {
        missingAltTexts,
        missingMetaDescriptions,
        shortDescriptions,
        missingTitles,
      },
      issues: issues.slice(0, 50), // Limit to first 50 products with issues
    });
  } catch (error) {
    console.error("[SEO Audit] Error:", error);
    return NextResponse.json({ error: "Fehler bei der SEO-Analyse." }, { status: 500 });
  }
}

// POST - Fix SEO issues (1-Click SEO Healer)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde || !kunde.shopifyToken || !kunde.shopDomain) {
      return NextResponse.json({ error: "Shop nicht verbunden." }, { status: 400 });
    }

    const domain = kunde.shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const token = kunde.shopifyToken;

    const { fixes } = await req.json();
    if (!Array.isArray(fixes) || fixes.length === 0) {
      return NextResponse.json({ error: "Keine Fixes angegeben." }, { status: 400 });
    }

    const results: { productId: number; success: boolean; error?: string }[] = [];

    for (const fix of fixes) {
      try {
        if (fix.type === "missing_alt" && fix.productId && fix.imageId) {
          // Update image alt text
          await shopifyFetch({
            domain,
            token,
            path: `/products/${fix.productId}/images/${fix.imageId}.json`,
            method: "PUT",
            body: {
              image: { id: fix.imageId, alt: fix.altText || fix.productTitle || "Produktbild" },
            },
          });
          results.push({ productId: fix.productId, success: true });
        } else if (fix.type === "missing_meta_description" && fix.productId) {
          // Update product metafield for SEO description
          const mutation = `mutation {
            productUpdate(input: {
              id: "gid://shopify/Product/${fix.productId}"
              seo: {
                description: "${(fix.metaDescription || "").replace(/"/g, '\\"')}"
              }
            }) {
              product { id }
              userErrors { field message }
            }
          }`;

          const gqlRes = await fetch(`https://${domain}/admin/api/2024-01/graphql.json`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": token,
            },
            body: JSON.stringify({ query: mutation }),
          });

          const gqlData = await gqlRes.json();
          const errors = gqlData?.data?.productUpdate?.userErrors || [];
          if (errors.length > 0) {
            results.push({ productId: fix.productId, success: false, error: errors[0].message });
          } else {
            results.push({ productId: fix.productId, success: true });
          }
        }
      } catch (e) {
        results.push({
          productId: fix.productId,
          success: false,
          error: e instanceof Error ? e.message : "Unbekannter Fehler",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    return NextResponse.json({
      success: true,
      fixed: successCount,
      total: results.length,
      results,
    });
  } catch (error) {
    console.error("[SEO Healer] Error:", error);
    return NextResponse.json({ error: "Fehler beim Reparieren." }, { status: 500 });
  }
}
