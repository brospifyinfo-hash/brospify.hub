// ─── /api/custom-products — Eigene Produkte für den Theme-Editor ────
// GET    → eigene Produkte des eingeloggten Nutzers
// POST   → anlegen/aktualisieren { id?, titel?, bildUrl?, preis?, beschreibung? }
//          (ALLE Felder optional — auch ein leeres Produkt ist erlaubt)
// DELETE → ?id=cust_… entfernen
// Kunden: Profil (customProducts) · Admin: Settings-Tab. Kostenlos.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey } from "@/lib/sheets";
import {
  listCustomProducts,
  saveCustomProducts,
  sanitizeCustomProduct,
  newCustomProductId,
  isCustomProductId,
  isProfileFullError,
  CUSTOM_PRODUCT_MAX,
} from "@/lib/custom-products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadKunde(session: { isAdmin: boolean; lizenzschluessel?: string }) {
  if (session.isAdmin || !session.lizenzschluessel) return null;
  return findKundeByKey(session.lizenzschluessel);
}

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  try {
    const products = await listCustomProducts(session);
    return NextResponse.json({ products }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[custom-products] GET failed:", err);
    return NextResponse.json({ error: "Eigene Produkte konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  if (!session.isAdmin && !session.lizenzschluessel) {
    return NextResponse.json({ error: "Kein Kundenkonto." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 });
  }

  try {
    const kunde = await loadKunde(session);
    if (!session.isAdmin && !kunde) {
      return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });
    }
    const list = await listCustomProducts(session, kunde);

    const requestedId = typeof body.id === "string" ? body.id : "";
    const existing = requestedId ? list.find((p) => p.id === requestedId) : undefined;
    if (requestedId && !existing) {
      return NextResponse.json({ error: "Produkt nicht gefunden." }, { status: 404 });
    }
    if (!existing && list.length >= CUSTOM_PRODUCT_MAX) {
      return NextResponse.json(
        { error: `Maximal ${CUSTOM_PRODUCT_MAX} eigene Produkte — bitte zuerst eines entfernen.` },
        { status: 400 },
      );
    }

    const id = existing?.id || newCustomProductId();
    const clean = sanitizeCustomProduct(body, id);
    const product = existing
      // Update: themeCopy/createdAt behalten; geänderte Kernfelder machen die
      // gecachten KI-Texte nicht ungültig (bewusst simpel — Texte sind generisch).
      ? { ...existing, ...clean }
      : { ...clean, createdAt: new Date().toISOString() };

    const next = existing ? list.map((p) => (p.id === id ? product : p)) : [product, ...list];
    await saveCustomProducts(session, next, kunde);
    return NextResponse.json({ product, products: next });
  } catch (err) {
    if (isProfileFullError(err)) {
      return NextResponse.json(
        { error: "Deine eigenen Produkte belegen zu viel Speicher — kürze Beschreibungen oder entferne ein Produkt." },
        { status: 400 },
      );
    }
    console.error("[custom-products] POST failed:", err);
    return NextResponse.json({ error: "Speichern fehlgeschlagen." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!isCustomProductId(id)) return NextResponse.json({ error: "Ungültige id." }, { status: 400 });
  try {
    const kunde = await loadKunde(session);
    if (!session.isAdmin && !kunde) {
      return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });
    }
    const list = await listCustomProducts(session, kunde);
    const next = list.filter((p) => p.id !== id);
    if (next.length !== list.length) await saveCustomProducts(session, next, kunde);
    return NextResponse.json({ ok: true, products: next });
  } catch (err) {
    console.error("[custom-products] DELETE failed:", err);
    return NextResponse.json({ error: "Entfernen fehlgeschlagen." }, { status: 500 });
  }
}
