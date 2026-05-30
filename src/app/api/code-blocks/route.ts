// ─── /api/code-blocks ────────────────────────────────────────────
// Customer-facing list of active code blocks. Gated by the
// `codeBlocks` feature flag (active Membership). Returns everything
// the /code-blocks customiser needs: code, preview image, and the
// admin-confirmed option list.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllCodeBlocks } from "@/lib/sheets";
import { requireFeature } from "@/lib/tier-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  const guard = await requireFeature(session, "codeBlocks");
  if (!guard.ok) return guard.response;

  try {
    const all = await getAllCodeBlocks();
    const blocks = all
      .filter((b) => b.active)
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .map((b) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        code: b.code,
        previewImageUrl: b.previewImageUrl,
        options: b.options,
        createdAt: b.createdAt,
      }));
    return NextResponse.json({ blocks });
  } catch (error) {
    console.error("[code-blocks] GET error:", error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}
