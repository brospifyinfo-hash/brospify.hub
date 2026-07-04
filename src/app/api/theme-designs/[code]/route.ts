// ─── /api/theme-designs/[code] — Design laden / löschen ────────────
// GET    → { name, productId, document } (nur Besitzer/Admin)
// DELETE → entfernt den Speicherstand. Der Live-Plan unterm Code bleibt
//          bewusst aktiv, damit Shops mit diesem Code ihr Design behalten.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getThemeDesign, deleteThemeDesign } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sessionUser(session: { isAdmin?: boolean; lizenzschluessel?: string }): string {
  return session.isAdmin ? "admin" : session.lizenzschluessel || "";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const { code } = await params;
  const design = await getThemeDesign(code);
  if (!design || (design.user !== sessionUser(session) && !session.isAdmin)) {
    return NextResponse.json({ error: "Design nicht gefunden." }, { status: 404 });
  }
  let document: unknown = null;
  try {
    document = JSON.parse(design.docJson);
  } catch {
    return NextResponse.json({ error: "Design beschädigt." }, { status: 500 });
  }
  return NextResponse.json(
    { code, name: design.name, productId: design.productId, document },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const { code } = await params;
  const ok = await deleteThemeDesign(code, sessionUser(session));
  if (!ok) return NextResponse.json({ error: "Design nicht gefunden." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
