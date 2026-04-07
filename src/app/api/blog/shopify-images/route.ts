import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey } from "@/lib/sheets";
import { shopifyFetch } from "@/lib/shopify";

export const dynamic = "force-dynamic";

interface ShopifyProductImage {
  id: number;
  title: string;
  images: { id: number; src: string; alt: string | null }[];
}

interface ProductsResponse {
  products: ShopifyProductImage[];
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
        { error: "Shop nicht verbunden." },
        { status: 400 }
      );
    }

    const domain = kunde.shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const token = kunde.shopifyToken;

    const data = await shopifyFetch<ProductsResponse>({
      domain,
      token,
      path: "/products.json?limit=50&fields=id,title,images",
    });

    const images = (data.products || []).flatMap((p) =>
      (p.images || []).map((img) => ({
        id: img.id,
        src: img.src,
        alt: img.alt || p.title,
        productTitle: p.title,
        productId: p.id,
      }))
    );

    return NextResponse.json({ images });
  } catch (error) {
    console.error("[Shopify Images] Error:", error);
    return NextResponse.json({ error: "Fehler beim Laden der Bilder." }, { status: 500 });
  }
}
