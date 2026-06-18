// ─── GET /api/themes ─────────────────────────────────────────────
// Kunden-Liste der verfügbaren Shopify-Themes (neueste zuerst). Liefert
// nur die für den Download nötigen Felder — kein rowIndex.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllThemes } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  try {
    const themes = (await getAllThemes()).sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || ""),
    );
    return NextResponse.json(
      {
        themes: themes.map((t) => ({
          id: t.id,
          name: t.name,
          version: t.version,
          url: t.url,
          fileName: t.fileName,
          sizeBytes: t.sizeBytes,
          createdAt: t.createdAt,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[themes] GET error:", e);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}
