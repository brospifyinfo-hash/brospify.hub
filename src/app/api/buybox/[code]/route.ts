// ─── GET /api/buybox/[code] — ÖFFENTLICH (Storefront-Endpoint) ──────
// Liefert Design-Plan + CSS der dynamischen Buy Box für einen Sync-Code.
// Wird von den Shopify-Shops der Kunden abgerufen (bspx-runtime.js) —
// KEIN Login, CORS offen, aggressiv CDN-gecacht (Design ändert sich nur,
// wenn der Kunde im Editor speichert; stale-while-revalidate überbrückt).
// Enthält KEINE personenbezogenen Daten — nur Design/Texte/Farben.
//
// ABO-GATE: Ist das Abo des Plan-Besitzers (Spalte B) inaktiv, kommt
// 200 { locked:true } — ein GÜLTIGES Verdikt, das die Runtime NICHT in
// den Cache-/Asset-Fallback laufen lässt (die native Fallback-Form bleibt
// kaufbar). Sheets-Ausfall beim Kunden-Lookup → fail-open ausliefern.

import { NextRequest, NextResponse } from "next/server";
import { getBuyboxPlanByCodeStrict } from "@/lib/sheets";
import { BUYBOX_CSS } from "@/lib/buybox-css";
import { storefrontOwnerVerdict } from "@/lib/storefront-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Pro Lambda kurz cachen — schützt die Sheets-Quota vor Traffic-Spitzen
// der Kunden-Shops; die eigentliche Lastabwehr macht der CDN-Cache.
// KURZ halten, damit „Live aktualisieren" im Hub schnell im Shop ankommt.
type BuyboxRow = Awaited<ReturnType<typeof getBuyboxPlanByCodeStrict>>;
const memCache = new Map<string, { row: BuyboxRow; ts: number }>();
const MEM_TTL_MS = 10_000;

// Abo-Verdikt pro Besitzer etwas länger cachen (wie /api/license/validate);
// fail-open wird NIE gecacht.
const verdictCache = new Map<string, { active: boolean; ts: number }>();
const VERDICT_TTL_MS = 60_000;

const CODE_RE = /^bspx_[a-z0-9]{10,40}$/;

async function ownerActive(owner: string): Promise<boolean> {
  const hit = verdictCache.get(owner);
  if (hit && Date.now() - hit.ts < VERDICT_TTL_MS) return hit.active;
  const verdict = await storefrontOwnerVerdict(owner);
  if (!verdict.failOpen) {
    verdictCache.set(owner, { active: verdict.active, ts: Date.now() });
    if (verdictCache.size > 500) verdictCache.clear();
  }
  return verdict.active;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!CODE_RE.test(code || "")) {
    return NextResponse.json({ error: "invalid code" }, { status: 404, headers: CORS_HEADERS });
  }

  let row: BuyboxRow;
  const hit = memCache.get(code);
  if (hit && Date.now() - hit.ts < MEM_TTL_MS) {
    row = hit.row;
  } else {
    try {
      // Strict-Variante: ein Sheets-Ausfall darf nicht wie „unbekannter
      // Code" enden (cachebare 404 vergiftet das CDN 60s; Memcache 10s).
      row = await getBuyboxPlanByCodeStrict(code);
    } catch {
      // Fail-open-Signal: 503 no-store — die Runtime fällt auf ihren
      // localStorage-Cache bzw. die native Fallback-Form zurück.
      return NextResponse.json(
        { error: "temporarily unavailable" },
        { status: 503, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
      );
    }
    memCache.set(code, { row, ts: Date.now() });
    if (memCache.size > 500) {
      const oldest = memCache.keys().next().value;
      if (oldest) memCache.delete(oldest);
    }
  }

  if (!row) {
    return NextResponse.json(
      { error: "unknown or inactive code" },
      { status: 404, headers: { ...CORS_HEADERS, "Cache-Control": "public, s-maxage=60" } },
    );
  }

  // Abo-Gate über den Plan-Besitzer — gleiche Logik wie render/status.
  if (!(await ownerActive(row.user))) {
    return NextResponse.json(
      { v: 1, locked: true, message: "Abo nicht aktiv." },
      { headers: { ...CORS_HEADERS, "Cache-Control": "public, s-maxage=30" } },
    );
  }

  let plan: unknown;
  try {
    plan = JSON.parse(row.planJson);
  } catch {
    return NextResponse.json({ error: "corrupt plan" }, { status: 500, headers: CORS_HEADERS });
  }

  return NextResponse.json(
    { v: 1, css: BUYBOX_CSS, plan },
    {
      headers: {
        ...CORS_HEADERS,
        // KURZ cachen, damit „Live aktualisieren" im Hub schnell im Shop
        // ankommt: 20s frisch am CDN, dann 40s stale-while-revalidate
        // (schützt die Sheets-Quota unter Last). Design-Änderungen sind
        // nach spätestens ~1 Minute (ggf. 1× neu laden) im Shop sichtbar.
        "Cache-Control": "public, s-maxage=20, stale-while-revalidate=40",
      },
    },
  );
}
