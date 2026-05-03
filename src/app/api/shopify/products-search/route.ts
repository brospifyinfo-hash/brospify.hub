import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string | null;
  handle: string;
  vendor?: string;
  product_type?: string;
  tags?: string;
  images: { id: number; src: string; alt: string | null }[];
}

// REST `products.json?title=` is an EXACT match — useless for the
// kind of fuzzy substring search a user expects from a product
// picker. Instead we pull up to 250 products in one request and
// substring-match them server-side. For shops with > 250 products
// we hop to the next page until we either fill the result set or
// run out of products.
const PER_PAGE = 250;
const MAX_PAGES = 4; // 1 000 products max — enough for any sensible shop
const RESULT_LIMIT = 50;

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde || !kunde.shopifyToken || !kunde.shopDomain) {
      return NextResponse.json(
        {
          error: "Shop nicht verbunden",
          message: "Verbinde deinen Shopify-Store unter /setup, um Produkte zu durchsuchen.",
          notConnected: true,
        },
        { status: 400 },
      );
    }

    const domain = kunde.shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const token = kunde.shopifyToken;
    const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();

    const matches: ShopifyProduct[] = [];
    let sinceId = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams({
        limit: String(PER_PAGE),
        fields: "id,title,body_html,handle,images,vendor,product_type,tags",
      });
      if (sinceId > 0) params.set("since_id", String(sinceId));

      const res = await fetch(
        `https://${domain}/admin/api/2024-01/products.json?${params.toString()}`,
        {
          headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
          // Shopify is the bottleneck here — let it cache nothing.
          cache: "no-store",
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[Products Search] Shopify error:", res.status, text);
        return NextResponse.json(
          { error: `Shopify-Fehler (${res.status})` },
          { status: 502 },
        );
      }
      const data = (await res.json()) as { products?: ShopifyProduct[] };
      const batch = data.products || [];
      if (batch.length === 0) break;

      // Substring filter across title, vendor, product_type, tags.
      // Empty query → return everything from the first page.
      if (q) {
        for (const p of batch) {
          const haystack = [
            p.title,
            p.vendor,
            p.product_type,
            p.tags,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (haystack.includes(q)) matches.push(p);
          if (matches.length >= RESULT_LIMIT) break;
        }
      } else {
        // No query → just surface the most recent products.
        for (const p of batch) {
          matches.push(p);
          if (matches.length >= RESULT_LIMIT) break;
        }
      }

      if (matches.length >= RESULT_LIMIT) break;
      if (batch.length < PER_PAGE) break;
      sinceId = batch[batch.length - 1].id;
    }

    const products = matches.map((p) => ({
      id: p.id,
      title: p.title,
      description: (p.body_html || "").replace(/<[^>]*>/g, "").substring(0, 240),
      handle: p.handle,
      image: p.images?.[0]?.src || null,
      images: (p.images || []).map((img) => ({
        src: img.src,
        alt: img.alt || p.title,
      })),
    }));

    return NextResponse.json({ products });
  } catch (error) {
    console.error("[Products Search] Error:", error);
    return NextResponse.json({ error: "Fehler bei der Suche" }, { status: 500 });
  }
}
