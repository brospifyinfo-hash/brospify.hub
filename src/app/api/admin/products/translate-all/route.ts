// ─── /api/admin/products/translate-all ───────────────────────────
// Wärmt den englischen Übersetzungs-Cache für ALLE aktuellen Produkte
// vor, damit der Produkt-Drop auf Englisch sofort (Cache-Treffer) lädt,
// statt beim ersten Zug live zu übersetzen (was zu Timeouts führte).
//
//   GET  → Status ohne KI: wie viele Produkte sind schon auf Englisch
//          vorbereitet, wie viele fehlen noch. Kein Credit-/KI-Verbrauch.
//   POST → Übersetzt die noch fehlenden Produkte (mit Zeitbudget, damit
//          der Request nicht in den Timeout läuft). Idempotent: bereits
//          gecachte Produkte werden übersprungen. Bei sehr vielen
//          Produkten einfach erneut aufrufen, bis `done: true`.
//
// Admin-only.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllProdukte } from "@/lib/sheets";
import { warmProductTranslation, productNeedsTranslation } from "@/lib/translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Wir hören rechtzeitig vor dem Plattform-Timeout auf und melden Fortschritt.
const TIME_BUDGET_MS = 250_000;

async function requireAdmin() {
  const session = await getSession();
  return session.isLoggedIn && session.isAdmin;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  try {
    const all = (await getAllProdukte()).filter((p) => p.id);
    let pending = 0;
    for (const p of all) {
      if (await productNeedsTranslation(p, "en")) pending++;
    }
    return NextResponse.json(
      { ok: true, total: all.length, done: all.length - pending, pending },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[translate-all] GET failed:", err);
    return NextResponse.json({ error: "Status konnte nicht geladen werden." }, { status: 500 });
  }
}

export async function POST() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  try {
    const all = (await getAllProdukte()).filter((p) => p.id);
    const startedAt = Date.now();
    let translatedNow = 0;
    let scanned = 0;
    let reachedEnd = true;

    for (const p of all) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        reachedEnd = false;
        break;
      }
      scanned++;
      try {
        if (await warmProductTranslation(p, "en")) translatedNow++;
      } catch (e) {
        console.warn("[translate-all] product failed:", p.id, e);
      }
    }

    // Fertig, wenn wir alle Produkte durchgegangen sind UND in diesem Lauf
    // nichts mehr zu übersetzen war (alles bereits im Cache).
    const done = reachedEnd && translatedNow === 0;

    return NextResponse.json(
      {
        ok: true,
        total: all.length,
        scanned,
        translatedNow,
        reachedEnd,
        done,
        message: done
          ? "Alle Produkte sind auf Englisch vorbereitet."
          : `${translatedNow} Produkt(e) übersetzt — bitte erneut starten, bis „fertig".`,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[translate-all] POST failed:", err);
    return NextResponse.json({ error: "Übersetzung fehlgeschlagen." }, { status: 500 });
  }
}
