// ─── /api/admin/customers/ensure-starter ────────────────────────
// Runs ensureStarterGrant() for every Kunde row. It's idempotent —
// customers who already received the starter (starterGranted=true)
// are skipped silently. Use this after fixing the credit bug to
// guarantee every legacy account has its 500 welcome credits at
// least once.
//
// Returns: { granted: number, skipped: number, errors: string[] }

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  ensureStarterGrant,
  getAllKunden,
  getKundeProfile,
} from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  let granted = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    const kunden = await getAllKunden();
    for (const kunde of kunden) {
      if (!kunde.lizenzschluessel) continue;
      try {
        // Re-read the profile to get the FRESHEST credits state — getAllKunden
        // returns a snapshot that might be stale by the time we mutate.
        const fresh = await getKundeProfile(kunde.rowIndex);
        const before = fresh.credits?.starterGranted === true;
        if (before) {
          skipped++;
          continue;
        }
        await ensureStarterGrant(kunde.rowIndex, fresh);
        granted++;
      } catch (err) {
        errors.push(
          `${kunde.lizenzschluessel}: ${err instanceof Error ? err.message : "unknown"}`,
        );
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fehler beim Laden der Kundenliste." },
      { status: 500 },
    );
  }

  return NextResponse.json({ granted, skipped, errors });
}
