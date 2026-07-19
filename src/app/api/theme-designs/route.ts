// ─── /api/theme-designs — Design-Speicherstände des Theme-Editors ──
// GET  ?productId=   → Liste der eigenen Designs (Name + Sync-Code + Datum)
// POST { name, document, code? } → speichert Design (Upsert per Code) UND
//      schreibt den Live-Buybox-Plan unter demselben Code → der Code ist
//      sofort im Shop nutzbar (Design-Wechsel = Code im Shopify-Block tauschen).
// Kostenlos (kein KI-Call — nur Sheet-Writes).

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  findKundeByKey,
  listThemeDesigns,
  getThemeDesign,
  saveThemeDesign,
  saveBuyboxPlan,
} from "@/lib/sheets";
import { resolveEditorProduct } from "@/lib/custom-products";
import { isValidDocument } from "@/lib/theme-compile";
import { buildBuyboxPlan, generateSyncCode } from "@/lib/buybox-plan";
import { countNamedDesigns, maxActiveDesignsFor } from "@/lib/editor-designs";
import { AUTO_LIVE_NAME, AUTO_SNAP_PREFIX } from "@/lib/design-autosave";
import type { ThemeDocument } from "@/lib/theme-doc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sessionUser(session: { isAdmin?: boolean; lizenzschluessel?: string }): string {
  return session.isAdmin ? "admin" : session.lizenzschluessel || "";
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const productId = req.nextUrl.searchParams.get("productId") || undefined;
  const designs = await listThemeDesigns(sessionUser(session), productId);
  return NextResponse.json({ designs }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  let body: { name?: string; document?: ThemeDocument; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 });
  }
  const doc = body.document && isValidDocument(body.document) ? body.document : null;
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!doc || !doc.productId) return NextResponse.json({ error: "Ungültiges Theme-Dokument." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Name fehlt." }, { status: 400 });
  // Reservierte Auto-Namen ("Aktueller Shop-Stand" / "Download …") sperren:
  // sie werden aus der Aktive-Designs-Zählung gefiltert — sonst könnte man
  // damit das Design-Limit umgehen (beliebig viele „unsichtbare" Designs).
  if (name === AUTO_LIVE_NAME || name.startsWith(AUTO_SNAP_PREFIX)) {
    return NextResponse.json({ error: "Dieser Name ist reserviert — bitte wähle einen anderen." }, { status: 400 });
  }

  const user = sessionUser(session);

  // Bestehenden Code aktualisieren? → Besitz prüfen.
  let code = typeof body.code === "string" ? body.code.trim() : "";
  if (code) {
    const existing = await getThemeDesign(code);
    if (!existing || (existing.user !== user && !session.isAdmin)) {
      return NextResponse.json({ error: "Design nicht gefunden." }, { status: 404 });
    }
  } else {
    // NEUES benanntes Design → Aktive-Designs-Limit des Plans prüfen
    // (nur Nicht-Admins; ein Update per Code zählt nicht dagegen).
    if (!session.isAdmin) {
      const kunde = await findKundeByKey(session.lizenzschluessel || "");
      const limit = kunde ? await maxActiveDesignsFor(kunde) : 0;
      if (limit !== -1) {
        const used = await countNamedDesigns(user);
        if (used >= limit) {
          return NextResponse.json(
            { error: "design_limit", limit, used, needsUpgrade: true },
            { status: 403 },
          );
        }
      }
    }
    code = generateSyncCode();
  }

  // Produkt auflösen wie beim Download: Katalog UND eigene Produkte
  // (resolveEditorProduct). Vorher wurde nur der Katalog durchsucht —
  // Speichern mit einem EIGENEN Produkt scheiterte deshalb IMMER mit
  // „Produkt nicht gefunden".
  let themeCopy: Record<string, string> | undefined;
  try {
    const resolved = await resolveEditorProduct(session, doc.productId);
    if (!resolved) return NextResponse.json({ error: "Produkt nicht gefunden." }, { status: 404 });
    themeCopy = resolved.produkt.extra?.themeCopy;
    if (!session.isAdmin && !resolved.owned) {
      return NextResponse.json({ error: "Dieses Produkt hast du noch nicht gezogen." }, { status: 403 });
    }
  } catch (err) {
    console.error("[theme-designs] Produktprüfung fehlgeschlagen:", err);
    return NextResponse.json({ error: "Produkte konnten nicht geladen werden." }, { status: 500 });
  }

  try {
    await saveThemeDesign(code, user, doc.productId, name, JSON.stringify(doc));
    // Live-Plan unter demselben Code → Code ist sofort im Shop einsetzbar.
    const plan = buildBuyboxPlan(doc, themeCopy);
    await saveBuyboxPlan(code, user, doc.productId, JSON.stringify(plan));
  } catch (err) {
    console.error("[theme-designs] Speichern fehlgeschlagen:", err);
    return NextResponse.json({ error: "Speichern fehlgeschlagen." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, code, name });
}
