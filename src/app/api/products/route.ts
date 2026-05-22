import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllProdukte } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.isAdmin) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    // Every logged-in customer sees the full product list — no SKU,
    // niche or month segmentation.
    const produkte = await getAllProdukte();

    const list = produkte
      .filter((p) => p.titel || p.bildUrl)
      .sort(
        (a, b) =>
          (b.extra?.stats?.trendScore ?? 0) - (a.extra?.stats?.trendScore ?? 0),
      );

    return NextResponse.json({ produkte: list });
  } catch (error) {
    console.error("Products fetch error:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Produkte." },
      { status: 500 }
    );
  }
}
