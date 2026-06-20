// ─── POST /api/admin/license/cleanup ────────────────────────────
// Danger-zone bulk cleanup: deletes every license/customer row whose
// key is NOT in the supplied whitelist. Used to wipe test/old
// licenses while keeping a small set alive.
//
//   Body: { keep: string[], dryRun?: boolean }
//   - `dryRun: true` only reports how many WOULD be deleted.
//
// Matching is case-insensitive + trimmed. The whitelist must be
// non-empty (so an empty payload can never nuke everything).

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllKunden, deleteKunde } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  let body: { keep?: unknown; dryRun?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 });
  }

  const keepRaw = Array.isArray(body.keep) ? body.keep : [];
  const keep = new Set(
    keepRaw
      .map((k) => String(k).trim().toUpperCase())
      .filter((k) => k.length > 0),
  );
  if (keep.size === 0) {
    return NextResponse.json(
      { error: "Die Whitelist darf nicht leer sein — sonst würden ALLE Lizenzen gelöscht." },
      { status: 400 },
    );
  }

  let kunden;
  try {
    kunden = await getAllKunden();
  } catch (e) {
    console.error("[license/cleanup] getAllKunden failed:", e);
    return NextResponse.json({ error: "Kunden konnten nicht geladen werden." }, { status: 502 });
  }

  const toDelete = kunden.filter((k) => {
    const key = (k.lizenzschluessel || "").trim();
    return key.length > 0 && !keep.has(key.toUpperCase());
  });
  const keptCount = kunden.filter((k) => (k.lizenzschluessel || "").trim().length > 0).length - toDelete.length;

  if (body.dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      wouldDelete: toDelete.length,
      kept: keptCount,
      keepList: [...keep],
    });
  }

  let deleted = 0;
  const failed: string[] = [];
  for (const k of toDelete) {
    try {
      await deleteKunde(k.rowIndex);
      deleted++;
    } catch (e) {
      console.error("[license/cleanup] delete failed for row", k.rowIndex, e);
      failed.push(k.lizenzschluessel);
    }
  }

  return NextResponse.json({
    ok: true,
    deleted,
    kept: keptCount,
    requested: toDelete.length,
    failed,
  });
}
