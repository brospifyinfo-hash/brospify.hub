// ─── GET /api/buybox/[code] — ÖFFENTLICH (Storefront-Endpoint) ──────
// Liefert Design-Plan + CSS der dynamischen Buy Box für einen Sync-Code.
// Wird von den Shopify-Shops der Kunden abgerufen (bspx-runtime.js) —
// KEIN Login, CORS offen, aggressiv CDN-gecacht (Design ändert sich nur,
// wenn der Kunde im Editor speichert; stale-while-revalidate überbrückt).
// Enthält KEINE personenbezogenen Daten — nur Design/Texte/Farben.

import { NextRequest, NextResponse } from "next/server";
import { getBuyboxPlanByCode } from "@/lib/sheets";
import { BUYBOX_CSS } from "@/lib/buybox-css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Pro Lambda kurz cachen — schützt die Sheets-Quota vor Traffic-Spitzen
// der Kunden-Shops; die eigentliche Lastabwehr macht der CDN-Cache.
const memCache = new Map<string, { json: string | null; ts: number }>();
const MEM_TTL_MS = 60_000;

const CODE_RE = /^bspx_[a-z0-9]{10,40}$/;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!CODE_RE.test(code || "")) {
    return NextResponse.json({ error: "invalid code" }, { status: 404, headers: CORS_HEADERS });
  }

  let planJson: string | null;
  const hit = memCache.get(code);
  if (hit && Date.now() - hit.ts < MEM_TTL_MS) {
    planJson = hit.json;
  } else {
    planJson = await getBuyboxPlanByCode(code);
    memCache.set(code, { json: planJson, ts: Date.now() });
    if (memCache.size > 500) {
      const oldest = memCache.keys().next().value;
      if (oldest) memCache.delete(oldest);
    }
  }

  if (!planJson) {
    return NextResponse.json(
      { error: "unknown or inactive code" },
      { status: 404, headers: { ...CORS_HEADERS, "Cache-Control": "public, s-maxage=60" } },
    );
  }

  let plan: unknown;
  try {
    plan = JSON.parse(planJson);
  } catch {
    return NextResponse.json({ error: "corrupt plan" }, { status: 500, headers: CORS_HEADERS });
  }

  return NextResponse.json(
    { v: 1, css: BUYBOX_CSS, plan },
    {
      headers: {
        ...CORS_HEADERS,
        // 5 Min frisch am CDN, danach bis zu 7 Tage stale ausliefern während
        // revalidiert wird — Kunden-Shops laden immer schnell, Updates
        // erscheinen innerhalb weniger Minuten.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=604800",
      },
    },
  );
}
