import { NextResponse } from "next/server";
import { getTierConfig } from "@/lib/tiers";

// Public, read-only tier listing for the pricing page. Hidden tiers
// are filtered out so customers don't see admin-only tiers.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const all = await getTierConfig();
    const visible = all.filter((t) => !t.hidden);
    return NextResponse.json(
      { tiers: visible },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } },
    );
  } catch (err) {
    console.error("[/api/tiers] error:", err);
    return NextResponse.json({ tiers: [] });
  }
}
