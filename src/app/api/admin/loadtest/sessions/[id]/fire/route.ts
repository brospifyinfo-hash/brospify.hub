import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getLoadTestSession } from "@/lib/sheets";
import { getLoadTestCreds } from "@/lib/loadtest-creds";
import { fireSingleOrder } from "@/lib/shopify-graphql";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  return session.isLoggedIn && session.isAdmin;
}

// Thin proxy: one fire = one Shopify orderCreate. The browser chaos
// engine calls this in a loop. We do NOT batch — we want individual
// latency per request to be reported back so the dashboard can plot
// the actual throughput wall.
//
// Cheap pre-flight: confirm the session is still `running` so we don't
// fire orders for a stopped/expired test (browser tab still open after
// killswitch, etc.).
export async function POST(
  _req: Request,
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
  if (session.status !== "running") {
    return NextResponse.json({ error: `Session ist nicht aktiv (status=${session.status}).` }, { status: 409 });
  }
  if (Date.parse(session.endsAt) <= Date.now()) {
    return NextResponse.json({ error: "Session-Endzeit ist erreicht." }, { status: 409 });
  }

  const creds = await getLoadTestCreds();
  if (!creds) {
    return NextResponse.json({ error: "Dev-Store-Credentials fehlen." }, { status: 400 });
  }

  const result = await fireSingleOrder({
    domain: creds.domain,
    token: creds.token,
    variantId: session.variantId,
    unitPrice: session.unitPrice || "1.00",
    tag: session.tag,
    sessionId: session.id,
  });

  // Return everything the browser needs to update its in-memory
  // counters AND its rate-budget estimate without an extra round trip.
  return NextResponse.json({
    ok: result.ok,
    orderId: result.orderId,
    latencyMs: result.latencyMs,
    throttled: result.throttled,
    cost: result.cost,
    error: result.errorMessage,
  });
}
