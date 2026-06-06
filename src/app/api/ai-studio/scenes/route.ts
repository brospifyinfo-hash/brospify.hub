// ─── GET /api/ai-studio/scenes ───────────────────────────────────
// Public CORS-Endpoint: gibt die kuratierte Szenen-Liste (id/label/hint
// + visual gradients) an die Storefront-Section damit das Theme das
// Scene-Carousel ohne extra Konfiguration rendern kann.

import { NextResponse } from "next/server";
import { AI_STUDIO_SCENES } from "@/lib/ai-studio-scenes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=300",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export function GET() {
  const scenes = AI_STUDIO_SCENES.map((s) => ({
    id: s.id,
    label: s.label,
    hint: s.hint,
    visual: {
      background: s.visual.background,
      light: s.visual.light,
      surface: s.visual.surface,
      accent: s.visual.accent,
    },
  }));
  return NextResponse.json({ ok: true, scenes }, { headers: CORS });
}
