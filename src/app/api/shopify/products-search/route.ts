import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey } from "@/lib/sheets";

export const dynamic = "force-dynamic";

interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string | null;
  handle: string;
  images: { id: number; src: string; alt: string | null }[];
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde || !kunde.shopifyToken || !kunde.shopDomain) {
      return NextResponse.json({ error: "Shop nicht verbunden" }, { status: 400 });
    }

    const domain = kunde.shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const token = kunde.shopifyToken;

    const query = req.nextUrl.searchParams.get("q") || "";

    // Use Shopify REST API to search products
    const params = new URLSearchParams({
      limit: "20",
      fields: "id,title,body_html,handle,images",
    });
    if (query) params.set("title", query);

    const res = await fetch(
      `https://${domain}/admin/api/2024-01/products.json?${params.toString()}`,
      { headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" } }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Shopify-Fehler" }, { status: 502 });
    }

    const data = await res.json();
    const products = (data.products || []).map((p: ShopifyProduct) => ({
      id: p.id,
      title: p.title,
      description: (p.body_html || "").replace(/<[^>]*>/g, "").substring(0, 200),
      handle: p.handle,
      image: p.images?.[0]?.src || null,
      images: (p.images || []).map((img) => ({ src: img.src, alt: img.alt || p.title })),
    }));

    return NextResponse.json({ products });
  } catch (error) {
    console.error("[Products Search] Error:", error);
    return NextResponse.json({ error: "Fehler bei der Suche" }, { status: 500 });
  }
}
