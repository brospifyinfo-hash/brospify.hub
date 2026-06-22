// ─── /api/admin/scout-cache ──────────────────────────────────────
// Admin-Statusfläche für den gemeinsamen Video-Scout-Cache + den
// wöchentlichen Link-Prune.
//   GET  → Cache-Grösse + letzter/nächster Prune-Lauf (Anzeige).
//   POST → Prune SOFORT auslösen (umgeht die Wochen-Drossel, "force").

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getScoutCacheStatus, maybePruneScoutCache } from "@/lib/scout-cache-prune";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }
  try {
    const status = await getScoutCacheStatus();
    return NextResponse.json({ ok: true, status }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[admin/scout-cache] status failed:", e);
    return NextResponse.json({ error: "Status konnte nicht geladen werden." }, { status: 500 });
  }
}

export async function POST() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }
  try {
    const result = await maybePruneScoutCache(true);
    const status = await getScoutCacheStatus();
    return NextResponse.json({ ok: true, result, status }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[admin/scout-cache] prune failed:", e);
    return NextResponse.json({ error: "Prüfung fehlgeschlagen." }, { status: 500 });
  }
}
