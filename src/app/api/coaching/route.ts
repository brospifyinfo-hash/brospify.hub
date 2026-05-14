// ─── /api/coaching ───────────────────────────────────────────────
// Customer-facing coaching feed. Gated by the `coaching` feature flag
// (Gold only). Returns active tips + the WhatsApp contact number so
// Gold customers can reach the admin directly.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllCoachingTips, getAdminSetting } from "@/lib/sheets";
import { requireFeature } from "@/lib/tier-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  const guard = await requireFeature(session, "coaching");
  if (!guard.ok) return guard.response;

  try {
    const [allTips, whatsapp] = await Promise.all([
      getAllCoachingTips(),
      getAdminSetting("coaching_whatsapp"),
    ]);
    const tips = allTips
      .filter((t) => t.active)
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .map((t) => ({
        id: t.id,
        title: t.title,
        body: t.body,
        mediaUrl: t.mediaUrl,
        author: t.author,
        createdAt: t.createdAt,
      }));
    return NextResponse.json({ tips, whatsapp: whatsapp || "" });
  } catch (error) {
    console.error("[coaching] GET error:", error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}
