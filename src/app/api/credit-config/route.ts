// ─── GET /api/credit-config ─────────────────────────────────────
// Public, read-only. Lets any tool UI render the *effective* credit
// cost + credit icon + shop packages without bundling stale defaults.
// No auth: these are non-sensitive display values. Short-cached.

import { NextResponse } from "next/server";
import { getCreditConfig } from "@/lib/credit-config-server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cfg = await getCreditConfig();
    return NextResponse.json(
      { icon: cfg.icon, costs: cfg.costs, packages: cfg.packages },
      { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } },
    );
  } catch {
    // Never block a tool UI — let it fall back to its bundled defaults.
    return NextResponse.json({ icon: "🪙", costs: {}, packages: [] }, { status: 200 });
  }
}
