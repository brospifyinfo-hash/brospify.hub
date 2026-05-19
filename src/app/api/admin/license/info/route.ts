// ─── /api/admin/license/info ──────────────────────────────────
// Admin-only. Returns the actual values of LICENSE_API_KEY and
// LICENSE_WRITE_KEY plus the canonical endpoint URLs so the
// admin UI can render copy-buttons + a ready-to-paste Make.com
// payload example without forcing the user to dig through
// Vercel env vars or .env.local.
//
// Why this is safe to expose under admin auth:
//   • Same trust boundary as the rest of the admin panel — anyone
//     who can reach this route can already mutate every customer
//     row, so showing the keys grants no extra capability.
//   • Hub-admin master keys (`Hat-Jonas`, `ILDCÜA`) are the only
//     out-of-band admin paths and are the user's intended fallback.
//     Note: `ILDCÜA` is Hub-admin-only — it does NOT bypass the
//     Shopify theme licence gate (only `Hat-Jonas` does there).
//
// Why we don't render values at SSR time / bake them into the
// page: the admin UI is a client component fetched per pageload.
// Keeping the value gated behind an on-demand fetch means the
// keys aren't sitting in HTML during routine navigation; a
// click is required to pull them.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
  return NextResponse.json({
    baseUrl,
    apiKey: process.env.LICENSE_API_KEY || "",
    writeKey: process.env.LICENSE_WRITE_KEY || "",
    endpoints: {
      validate: `${baseUrl}/api/license/validate`,
      sync: `${baseUrl}/api/license/sync`,
      issue: `${baseUrl}/api/license/issue`,
      cancel: `${baseUrl}/api/license/cancel`,
      expireOverdue: `${baseUrl}/api/admin/license/expire-overdue`,
    },
  });
}
