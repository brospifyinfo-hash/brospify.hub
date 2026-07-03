// ─── POST /api/buybox/update — Design live aktualisieren ───────────
// Speichert den Buybox-Render-Plan des aktuellen Editor-Stands unter dem
// BESTEHENDEN Sync-Code des Kunden für dieses Produkt. Alle Shops mit dem
// Code sehen das neue Design nach dem CDN-Refresh — ohne neues Theme-ZIP.
// KOSTENLOS (verursacht keine API-Kosten: kein KI-Call, nur Sheet-Write).

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllProdukte, findKundeByKey, saveBuyboxPlan } from "@/lib/sheets";
import { isValidDocument } from "@/lib/theme-compile";
import { buildBuyboxPlan } from "@/lib/buybox-plan";
import type { ThemeDocument } from "@/lib/theme-doc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  let body: { document?: ThemeDocument; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 });
  }
  const doc = body.document && isValidDocument(body.document) ? body.document : null;
  if (!doc || !doc.productId) return NextResponse.json({ error: "Ungültiges Theme-Dokument." }, { status: 400 });

  // Produkt (für gecachte KI-Texte im Plan).
  let produkt;
  try {
    produkt = (await getAllProdukte()).find((p) => p.id === doc.productId);
  } catch {
    return NextResponse.json({ error: "Produkte konnten nicht geladen werden." }, { status: 500 });
  }
  if (!produkt) return NextResponse.json({ error: "Produkt nicht gefunden." }, { status: 404 });

  // Code auflösen: Kunde → gespeicherter Code fürs Produkt; Admin → body.code.
  let code = "";
  let user = "admin";
  if (session.isAdmin) {
    code = typeof body.code === "string" ? body.code : "";
  } else {
    if (!session.lizenzschluessel) return NextResponse.json({ error: "Kein Kundenkonto." }, { status: 403 });
    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde) return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });
    const drawn = Array.isArray(kunde.profile?.drawnProducts) ? kunde.profile.drawnProducts : [];
    if (!drawn.includes(doc.productId)) {
      return NextResponse.json({ error: "Dieses Produkt hast du noch nicht gezogen." }, { status: 403 });
    }
    user = session.lizenzschluessel;
    code = kunde.profile?.buyboxCodes?.[doc.productId] || "";
  }
  if (!code) {
    // Noch kein Code → es gab noch keinen Download für dieses Produkt.
    return NextResponse.json({ error: "no_code", needsExport: true }, { status: 404 });
  }

  const plan = buildBuyboxPlan(doc, produkt.extra?.themeCopy);
  try {
    await saveBuyboxPlan(code, user, doc.productId, JSON.stringify(plan));
  } catch (err) {
    console.error("[buybox/update] save failed:", err);
    return NextResponse.json({ error: "Speichern fehlgeschlagen." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, code });
}
