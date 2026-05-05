// ─── /api/admin/credit-codes/bulk ────────────────────────────────
// Bulk-creates N random voucher codes in a single round-trip. Each
// code is XXXXX-XXXXX (10 alphanumerics, dash-separated). Codes are
// pre-checked against the existing list to avoid collisions; on
// collision we re-roll a few times before failing that single slot.
//
// Body: { count, credits, maxPerAccount?, prefix?, note? }
// Returns: { created: string[], skipped: number }

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  addCreditCode,
  findCreditCode,
} from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1 — easier to read
function randomCode(prefix?: string): string {
  const chunk = (n: number) =>
    Array.from({ length: n }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
  const body = `${chunk(5)}-${chunk(5)}`;
  return prefix ? `${prefix}-${body}` : body;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  let body: { count?: number; credits?: number; maxPerAccount?: number; prefix?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const count = Math.min(50, Math.max(1, Math.round(Number(body.count) || 0)));
  const credits = Math.round(Number(body.credits) || 0);
  const maxPerAccount = Math.max(1, Math.round(Number(body.maxPerAccount) || 1));
  const prefix = (body.prefix || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || undefined;
  const note = typeof body.note === "string" ? body.note.slice(0, 200) : "";

  if (!Number.isFinite(credits) || credits <= 0 || credits > 1_000_000) {
    return NextResponse.json(
      { error: "Credits muss zwischen 1 und 1.000.000 liegen." },
      { status: 400 },
    );
  }
  if (!count) {
    return NextResponse.json({ error: "count fehlt." }, { status: 400 });
  }

  const created: string[] = [];
  let skipped = 0;
  const now = new Date().toISOString();

  for (let i = 0; i < count; i++) {
    let chosen: string | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = randomCode(prefix);
      const existing = await findCreditCode(candidate).catch(() => null);
      if (!existing) {
        chosen = candidate;
        break;
      }
    }
    if (!chosen) {
      skipped++;
      continue;
    }
    try {
      await addCreditCode({
        code: chosen,
        credits,
        maxPerAccount,
        active: true,
        createdAt: now,
        note,
      });
      created.push(chosen);
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ created, skipped, count: created.length });
}
