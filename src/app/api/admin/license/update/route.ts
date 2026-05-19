// ─── /api/admin/license/update ────────────────────────────────
// Admin-only inline edit for the Lizenzen tab. Lets the operator
// change a customer's status column and/or subscriptionEndsAt
// without going through the Make.com write path.
//
// Body: { key, status?, subscriptionEndsAt?, blocked? }
//   • key                  — required, the customer's lizenzschluessel
//   • status               — string, written to column C as-is
//   • subscriptionEndsAt   — ISO date/datetime OR empty string to CLEAR
//   • blocked              — boolean, mirrors profile.blocked
//
// Auth: admin session only (no API-key path — this is human-driven).

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  findKundeByKey,
  updateKundeField,
  updateKundeProfile,
  logSystemEvent,
} from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UpdateBody {
  key?: string;
  status?: string;
  subscriptionEndsAt?: string;
  blocked?: boolean;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  let body: UpdateBody;
  try {
    body = (await req.json()) as UpdateBody;
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const key = (body.key || "").trim();
  if (!key) {
    return NextResponse.json({ error: "key fehlt." }, { status: 400 });
  }

  const kunde = await findKundeByKey(key);
  if (!kunde) {
    return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });
  }

  // Normalize the date input. Empty string means "clear the field" —
  // the Lizenzen tab uses this when the admin wants to lift the
  // time-based gate entirely.
  let endsAtIso: string | undefined;
  let clearEndsAt = false;
  if (body.subscriptionEndsAt !== undefined) {
    const raw = (body.subscriptionEndsAt || "").trim();
    if (raw === "") {
      clearEndsAt = true;
    } else {
      const t = Date.parse(raw);
      if (!Number.isFinite(t)) {
        return NextResponse.json(
          { error: "subscriptionEndsAt ist kein gültiges Datum." },
          { status: 400 },
        );
      }
      endsAtIso = new Date(t).toISOString();
    }
  }

  try {
    if (typeof body.status === "string") {
      await updateKundeField(kunde.rowIndex, "C", body.status);
    }

    if (endsAtIso !== undefined || clearEndsAt || typeof body.blocked === "boolean") {
      const nextProfile = { ...kunde.profile };
      if (endsAtIso !== undefined) {
        nextProfile.subscriptionEndsAt = endsAtIso;
      } else if (clearEndsAt) {
        delete nextProfile.subscriptionEndsAt;
      }
      if (typeof body.blocked === "boolean") {
        nextProfile.blocked = body.blocked;
        if (body.blocked && !nextProfile.blockedAt) {
          nextProfile.blockedAt = new Date().toISOString();
        }
        if (!body.blocked) {
          delete nextProfile.blockedAt;
        }
      }
      await updateKundeProfile(kunde.rowIndex, nextProfile);
    }

    const actor = session.googleEmail || session.lizenzschluessel || "admin";
    await logSystemEvent({
      level: "audit",
      actor,
      action: "license.admin_update",
      target: key,
      details: {
        rowIndex: kunde.rowIndex,
        status: body.status,
        subscriptionEndsAt: endsAtIso ?? (clearEndsAt ? "(cleared)" : undefined),
        blocked: body.blocked,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/license/update]", err);
    return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
  }
}
