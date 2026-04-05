import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey, getKundeProfile, updateKundeProfile, type KundeProfile } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// GET — load customer profile
export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.isAdmin || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde) {
      return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
    }

    const profile = await getKundeProfile(kunde.rowIndex);

    return NextResponse.json({
      profile,
      shopDomain: kunde.shopDomain,
      kundenEmail: kunde.kundenEmail,
      hasShopifyToken: !!kunde.shopifyToken,
    });
  } catch (error) {
    console.error("[Profile] GET error:", error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

// POST — save customer profile
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.isAdmin || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde) {
      return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
    }

    const body = await req.json();
    const current = await getKundeProfile(kunde.rowIndex);

    // Merge — only update fields that were sent
    const updated: KundeProfile = {
      ...current,
      ...(body.shopify_credentials !== undefined && { shopify_credentials: { ...current.shopify_credentials, ...body.shopify_credentials } }),
      ...(body.brand_kit !== undefined && { brand_kit: { ...current.brand_kit, ...body.brand_kit } }),
      ...(body.legal_data !== undefined && { legal_data: { ...current.legal_data, ...body.legal_data } }),
      // ai_usage is managed by the ai-optimize route, not here
    };

    console.log("[Profile] Saving for row:", kunde.rowIndex, JSON.stringify(updated));
    await updateKundeProfile(kunde.rowIndex, updated);

    return NextResponse.json({ success: true, profile: updated });
  } catch (error) {
    console.error("[Profile] POST error:", error);
    return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
  }
}
