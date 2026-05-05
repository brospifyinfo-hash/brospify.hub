// ─── /api/admin/activity ────────────────────────────────────────
// Unified, paginated transaction feed across every Kunde row.
// Each transaction is enriched with the customer's license and
// email so the admin UI can render context inline. Filters narrow
// the result set server-side.
//
// Query params:
//   limit       — page size (default 50, max 200)
//   offset      — skip N entries (default 0)
//   type        — comma list: deduct,topup,voucher,starter,admin-grant,admin-revoke
//   customer    — substring match on license, email, shop, sku
//   sinceDays   — only transactions newer than N days

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getAllKunden,
  type CreditTransaction,
} from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ActivityEntry extends CreditTransaction {
  customerKey: string;
  email: string;
  shopDomain: string;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  const url = req.nextUrl;
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const typeRaw = url.searchParams.get("type")?.trim() || "";
  const allowedTypes = typeRaw
    ? new Set(typeRaw.split(",").map((s) => s.trim()).filter(Boolean))
    : null;
  const customerQ = (url.searchParams.get("customer") || "").trim().toLowerCase();
  const sinceDays = Math.max(0, Number(url.searchParams.get("sinceDays")) || 0);
  const sinceMs = sinceDays > 0 ? Date.now() - sinceDays * 24 * 60 * 60 * 1000 : 0;

  try {
    const kunden = await getAllKunden();
    const all: ActivityEntry[] = [];

    for (const k of kunden) {
      if (!k.lizenzschluessel) continue;
      // Customer filter
      if (customerQ) {
        const hay = `${k.lizenzschluessel} ${k.kundenEmail} ${k.shopDomain} ${k.sku} ${k.bestellnummer}`.toLowerCase();
        if (!hay.includes(customerQ)) continue;
      }
      const log = Array.isArray(k.profile.credits?.log) ? k.profile.credits!.log! : [];
      for (const tx of log) {
        // Type filter
        if (allowedTypes && !allowedTypes.has(tx.type)) continue;
        // Date filter
        if (sinceMs > 0) {
          const ts = Date.parse(tx.ts);
          if (!Number.isFinite(ts) || ts < sinceMs) continue;
        }
        all.push({
          ...tx,
          customerKey: k.lizenzschluessel,
          email: k.kundenEmail,
          shopDomain: k.shopDomain,
        });
      }
    }

    // Newest first
    all.sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));

    const total = all.length;
    const page = all.slice(offset, offset + limit);

    return NextResponse.json({
      total,
      offset,
      limit,
      hasMore: offset + page.length < total,
      entries: page,
    });
  } catch (err) {
    console.error("[admin/activity] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fehler beim Laden der Aktivität." },
      { status: 500 },
    );
  }
}
