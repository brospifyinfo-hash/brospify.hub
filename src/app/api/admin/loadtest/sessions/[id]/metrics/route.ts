import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getLoadTestSession,
  updateLoadTestSessionMetrics,
  markLoadTestSessionDone,
  type LoadTestStatus,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  return session.isLoggedIn && session.isAdmin;
}

// The dashboard pings this every ~5 seconds with the latest counters
// the browser-side chaos engine has accumulated. We cap call rate via
// the browser (one batched update per 5s) so we never exceed Sheets'
// 60-write-per-minute-per-user quota even with concurrent sessions.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  const { id } = await params;
  const session = await getLoadTestSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session nicht gefunden" }, { status: 404 });
  }

  const body = await req.json();
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : undefined;
  const str = (v: unknown): string | undefined =>
    typeof v === "string" ? v : undefined;

  await updateLoadTestSessionMetrics(session.rowIndex, {
    ordersAttempted: num(body.ordersAttempted),
    ordersSucceeded: num(body.ordersSucceeded),
    ordersFailed: num(body.ordersFailed),
    rateLimited: num(body.rateLimited),
    avgLatencyMs: typeof body.avgLatencyMs === "number" && Number.isFinite(body.avgLatencyMs) ? body.avgLatencyMs : undefined,
    lastError: str(body.lastError),
  });

  // Optional final-status flip when the browser's countdown ends.
  if (body.finalStatus && ["completed", "stopped", "failed"].includes(body.finalStatus)) {
    await markLoadTestSessionDone(session.rowIndex, body.finalStatus as LoadTestStatus);
  }

  return NextResponse.json({ ok: true });
}
