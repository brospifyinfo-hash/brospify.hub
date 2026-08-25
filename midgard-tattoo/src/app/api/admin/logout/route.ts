// ─── POST /api/admin/logout ───────────────────────────────
import { NextResponse } from "next/server";
import { getStudioSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getStudioSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
