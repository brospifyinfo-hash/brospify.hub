import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getLoadTestSession, markLoadTestSessionDone } from "@/lib/sheets";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  return session.isLoggedIn && session.isAdmin;
}

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
    return NextResponse.json({ ok: true, alreadyDone: true, status: session.status });
  }
  await markLoadTestSessionDone(session.rowIndex, "stopped");
  return NextResponse.json({ ok: true });
}
