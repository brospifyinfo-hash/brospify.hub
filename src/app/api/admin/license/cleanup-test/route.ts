// ─── POST /api/admin/license/cleanup-test ───────────────────────
// Admin-only: räumt die beim Testen erzeugten Lizenz-Zeilen auf —
// genau die, deren Bestellnummer mit "TEST-" beginnt (vom Test-Tool
// /admin/license/issue-test). Echte Bestellungen bleiben unberührt.
//
// "Löschen" = Zellen der Zeile leeren (wie deleteProdukt), kein
// Row-Shift. Antwort: { ok, deletedCount, deleted[] }.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllKunden, deleteKunde } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  let all;
  try {
    all = await getAllKunden();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Kunden konnten nicht geladen werden." },
      { status: 500 },
    );
  }

  const testRows = all.filter((k) =>
    (k.bestellnummer || "").trim().toUpperCase().startsWith("TEST-"),
  );

  const deleted: string[] = [];
  for (const k of testRows) {
    try {
      await deleteKunde(k.rowIndex);
      deleted.push(k.lizenzschluessel || `Zeile ${k.rowIndex}`);
    } catch {
      /* einzelne Zeile übersprungen — Rest weiter aufräumen */
    }
  }

  return NextResponse.json({ ok: true, deletedCount: deleted.length, deleted });
}
