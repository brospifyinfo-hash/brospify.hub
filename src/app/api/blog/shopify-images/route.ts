import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey } from "@/lib/sheets";
import { shopifyFetch } from "@/lib/shopify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ShopifyProductImage {
  id: number;
  title: string;
  images: { id: number; src: string; alt: string | null }[];
}

interface ProductsResponse {
  products: ShopifyProductImage[];
}

const PER_PAGE = 250;
const MAX_PAGES = 4; // 1 000 products = several thousand images, plenty.

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde || !kunde.shopifyToken || !kunde.shopDomain) {
      return NextResponse.json(
        {
          error: "Shop nicht verbunden.",
          message:
            "Verbinde deinen Shopify-Store unter /setup, um Produktbilder im Editor zu nutzen.",
          notConnected: true,
        },
        { status: 400 },
      );
    }

    const domain = kunde.shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const token = kunde.shopifyToken;

    const allProducts: ShopifyProductImage[] = [];
    let sinceId = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const path = `/products.json?limit=${PER_PAGE}&fields=id,title,images${
        sinceId > 0 ? `&since_id=${sinceId}` : ""
      }`;
      const data = await shopifyFetch<ProductsResponse>({ domain, token, path });
      const batch = data.products || [];
      if (batch.length === 0) break;
      allProducts.push(...batch);
      if (batch.length < PER_PAGE) break;
      sinceId = batch[batch.length - 1].id;
    }

    const images = allProducts.flatMap((p) =>
      (p.images || []).map((img) => ({
        id: img.id,
        src: img.src,
        alt: img.alt || p.title,
        productTitle: p.title,
        productId: p.id,
      })),
    );

    return NextResponse.json({ images, productCount: allProducts.length });
  } catch (error) {
    console.error("[Shopify Images] Error:", error);
    return NextResponse.json({ error: "Fehler beim Laden der Bilder." }, { status: 500 });
  }
}
