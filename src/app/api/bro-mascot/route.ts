// ─── /api/bro-mascot — Maskottchen-Bilder lesen (public) / speichern (admin) ─
// GET: die 9 Avatar-URLs (idle/thinking/working) — der AI Co-Pilot lädt sie
//   beim Mount, um Bro passend zum Zustand zu zeigen. Bewusst öffentlich
//   (nur Bild-URLs, keine sensiblen Daten) und kurz cachebar.
// POST: nur Admin — speichert die vom Admin-Bereich hochgeladenen URLs.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getBroMascot, setBroMascot } from "@/lib/bro-mascot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = await getBroMascot();
  return NextResponse.json(cfg, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isAdmin) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 });
  }
  const cfg = await setBroMascot(body);
  return NextResponse.json(cfg, { headers: { "Cache-Control": "no-store" } });
}
