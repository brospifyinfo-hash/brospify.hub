// ─── /api/admin/customer-action ─────────────────────────────────
// Multi-purpose endpoint for admin moderation actions on a single
// customer. Body: { key, action, payload? }
//
// Actions:
//   set-note     payload: { note: string }      — set adminNote
//   set-vip      payload: { vip: boolean }      — toggle VIP flag
//   set-blocked  payload: { blocked: boolean }  — block / unblock account
//   reset-starter                                — re-grant starter
//                                                  (resets starterGranted to
//                                                  false, then runs ensure)
//
// Every mutation goes through updateKundeProfile so the JSON cell in
// the sheet stays consistent. reset-starter additionally writes a
// log entry so the audit trail shows admin re-granted credits.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  ensureStarterGrant,
  findKundeByKey,
  getKundeProfile,
  setCreditsBalance,
  updateKundeProfile,
} from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  let body: { key?: string; action?: string; payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const key = String(body.key || "").trim();
  const action = String(body.action || "").trim();
  if (!key || !action) {
    return NextResponse.json({ error: "key + action sind erforderlich." }, { status: 400 });
  }

  const kunde = await findKundeByKey(key);
  if (!kunde) {
    return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });
  }

  // Always work from the freshest profile snapshot.
  const profile = await getKundeProfile(kunde.rowIndex);

  switch (action) {
    case "set-note": {
      const note = String((body.payload?.note as string | undefined) ?? "");
      await updateKundeProfile(kunde.rowIndex, { ...profile, adminNote: note.slice(0, 1000) });
      return NextResponse.json({ success: true, adminNote: note });
    }

    case "set-vip": {
      const vip = body.payload?.vip === true;
      await updateKundeProfile(kunde.rowIndex, { ...profile, vip });
      return NextResponse.json({ success: true, vip });
    }

    case "set-blocked": {
      const blocked = body.payload?.blocked === true;
      await updateKundeProfile(kunde.rowIndex, {
        ...profile,
        blocked,
        blockedAt: blocked ? new Date().toISOString() : "",
      });
      return NextResponse.json({ success: true, blocked });
    }

    case "reset-starter": {
      // Force-clear the flag so ensureStarterGrant grants again.
      const cleared = {
        ...profile,
        credits: profile.credits
          ? { ...profile.credits, starterGranted: false }
          : undefined,
      };
      await updateKundeProfile(kunde.rowIndex, cleared);
      const updated = await ensureStarterGrant(kunde.rowIndex, cleared);
      return NextResponse.json({
        success: true,
        balance: updated.credits?.balance ?? 0,
      });
    }

    case "set-credits": {
      const target = Number(body.payload?.balance);
      if (!Number.isFinite(target) || target < 0 || target > 10_000_000) {
        return NextResponse.json(
          { error: "balance muss zwischen 0 und 10.000.000 liegen." },
          { status: 400 },
        );
      }
      const result = await setCreditsBalance(
        kunde.rowIndex,
        profile,
        target,
        `admin:${session.googleEmail || "unknown"}`,
      );
      return NextResponse.json({
        success: true,
        balance: result.balance,
        delta: result.delta,
      });
    }

    default:
      return NextResponse.json(
        { error: `Unbekannte Aktion: ${action}` },
        { status: 400 },
      );
  }
}
