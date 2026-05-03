// ─── /api/admin/credit-codes ─────────────────────────────────────
// Admin-only CRUD for voucher codes. The customer-facing redeem
// endpoint lives in /api/credits/redeem.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  addCreditCode,
  deleteCreditCode,
  findCreditCode,
  getAllCreditCodes,
  updateCreditCode,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireAdmin() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 403 });
  }
  return null;
}

// GET — list all codes for the admin grid.
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const codes = await getAllCreditCodes();
    return NextResponse.json({ codes });
  } catch (err) {
    console.error("[Admin/credit-codes] GET error:", err);
    return NextResponse.json({ error: "Laden fehlgeschlagen." }, { status: 500 });
  }
}

// POST — create a new code.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await req.json();
    const code = String(body.code ?? "").trim().toUpperCase();
    const credits = Math.round(Number(body.credits ?? 0));
    const maxPerAccount = Math.max(1, Math.round(Number(body.maxPerAccount ?? 1)));
    const note = typeof body.note === "string" ? body.note.slice(0, 200) : "";

    if (!/^[A-Z0-9_-]{3,64}$/.test(code)) {
      return NextResponse.json(
        { error: "Code: 3–64 Zeichen, nur A-Z, 0-9, _ und -." },
        { status: 400 },
      );
    }
    if (!Number.isFinite(credits) || credits <= 0 || credits > 1_000_000) {
      return NextResponse.json(
        { error: "Credits muss zwischen 1 und 1.000.000 liegen." },
        { status: 400 },
      );
    }

    const existing = await findCreditCode(code);
    if (existing) {
      return NextResponse.json(
        { error: "Diesen Code gibt es bereits." },
        { status: 409 },
      );
    }

    await addCreditCode({
      code,
      credits,
      maxPerAccount,
      active: true,
      createdAt: new Date().toISOString(),
      note,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Admin/credit-codes] POST error:", err);
    return NextResponse.json({ error: "Anlegen fehlgeschlagen." }, { status: 500 });
  }
}

// PATCH — update credits/limit/active/note for an existing code.
export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await req.json();
    const rowIndex = Number(body.rowIndex);
    if (!Number.isInteger(rowIndex) || rowIndex < 2) {
      return NextResponse.json({ error: "rowIndex fehlt." }, { status: 400 });
    }
    const updates: Parameters<typeof updateCreditCode>[1] = {};
    if (body.credits !== undefined) {
      const v = Math.round(Number(body.credits));
      if (!Number.isFinite(v) || v <= 0 || v > 1_000_000) {
        return NextResponse.json({ error: "Credits ungültig." }, { status: 400 });
      }
      updates.credits = v;
    }
    if (body.maxPerAccount !== undefined) {
      const v = Math.max(1, Math.round(Number(body.maxPerAccount)));
      updates.maxPerAccount = v;
    }
    if (body.active !== undefined) {
      updates.active = Boolean(body.active);
    }
    if (typeof body.note === "string") {
      updates.note = body.note.slice(0, 200);
    }
    await updateCreditCode(rowIndex, updates);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Admin/credit-codes] PATCH error:", err);
    return NextResponse.json({ error: "Update fehlgeschlagen." }, { status: 500 });
  }
}

// DELETE — wipe the row. (Existing per-account redemption ledger
// entries on customer profiles stay, but they become inert because
// the code can no longer be looked up.)
export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await req.json();
    const rowIndex = Number(body.rowIndex);
    if (!Number.isInteger(rowIndex) || rowIndex < 2) {
      return NextResponse.json({ error: "rowIndex fehlt." }, { status: 400 });
    }
    await deleteCreditCode(rowIndex);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Admin/credit-codes] DELETE error:", err);
    return NextResponse.json({ error: "Löschen fehlgeschlagen." }, { status: 500 });
  }
}
