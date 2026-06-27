// ─── /api/admin/products/generate-theme-copy ─────────────────────
// Admin-only. Lässt ein Produkt durch die Maker-Checker-KI-Pipeline laufen
// (Creator → Validator) und speichert die finalen Theme-Landingpage-Texte in
// `produkt.extra.themeCopy`. Diese Texte nutzt der Kunden-Theme-Export.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getProduktByRowIndex,
  getAllProdukte,
  updateProduktExtra,
  type Produkt,
} from "@/lib/sheets";
import { generateThemeCopy } from "@/lib/theme-copy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Zwei sequentielle Claude-Calls (Creator + Validator) → mehr Headroom.
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  let body: { rowIndex?: number; productId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 });
  }

  // Produkt laden (per rowIndex bevorzugt, sonst per id).
  let produkt: Produkt | null = null;
  if (typeof body.rowIndex === "number" && body.rowIndex > 0) {
    produkt = await getProduktByRowIndex(body.rowIndex);
  } else if (body.productId) {
    produkt = (await getAllProdukte()).find((p) => p.id === body.productId) || null;
  }
  if (!produkt) {
    return NextResponse.json({ error: "Produkt nicht gefunden." }, { status: 404 });
  }
  if (!produkt.titel?.trim()) {
    return NextResponse.json({ error: "Produkt hat keinen Titel." }, { status: 400 });
  }

  try {
    // Maker-Checker-Pipeline.
    const result = await generateThemeCopy({
      name: produkt.titel,
      brief: produkt.beschreibung,
    });

    // Nur die Extra-Spalte aktualisieren (Titel/Preis bleiben unberührt).
    await updateProduktExtra(produkt.rowIndex, {
      ...produkt.extra,
      themeCopy: result.copy,
    });

    return NextResponse.json({
      success: true,
      isValid: result.isValid,
      feedback: result.feedback,
      keys: Object.keys(result.copy).length,
    });
  } catch (err) {
    console.error("[generate-theme-copy] failed:", err);
    const msg = err instanceof Error ? err.message : "Generierung fehlgeschlagen.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
