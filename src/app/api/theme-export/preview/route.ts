// ─── /api/theme-export/preview ───────────────────────────────────
// Liefert die DATEN für die getreue Nachbildung der Produktseiten-Oberseite
// (main-product bis VOR der Beschreibung). Inhalte/Reihenfolge/Icons exakt wie
// im echten Brospify-Theme; Verkaufstexte aus themeCopy, sonst die Theme-
// Defaults — nie ein rohes [[TOKEN]]. Kostenlos, kein Liquid (zuverlässig).
// Payload-Bau lebt in src/lib/theme-preview-data.ts (geteilt mit /api/theme-demo).

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { type Produkt } from "@/lib/sheets";
import { resolveEditorProduct } from "@/lib/custom-products";
import { buildProductPreviewPayload, getBaseManifestCached } from "@/lib/theme-preview-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const productId = req.nextUrl.searchParams.get("productId") || "";
  if (!productId) return NextResponse.json({ error: "productId fehlt." }, { status: 400 });

  // Katalog-Produkt (gezogen/Admin) ODER eigenes Produkt des Nutzers.
  let produkt: Produkt;
  try {
    const resolved = await resolveEditorProduct(session, productId);
    if (!resolved) return NextResponse.json({ error: "Produkt nicht gefunden." }, { status: 404 });
    if (!resolved.owned) {
      return NextResponse.json({ error: "Dieses Produkt hast du noch nicht gezogen." }, { status: 403 });
    }
    produkt = resolved.produkt;
  } catch (err) {
    console.error("[theme-preview] Produkt-Resolve failed:", err);
    return NextResponse.json({ error: "Produkte konnten nicht geladen werden." }, { status: 500 });
  }

  const manifest = await getBaseManifestCached();

  return NextResponse.json(
    buildProductPreviewPayload(produkt, manifest),
    { headers: { "Cache-Control": "no-store" } },
  );
}
