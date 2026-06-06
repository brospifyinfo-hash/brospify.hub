// ─── GET /api/charts/public ─────────────────────────────────────
// CORS-fähige Variante der internen /api/products für das Shopify-
// Storefront-Theme. Auth via licence key oder Customer-Email (gleiche
// Soft-Gate wie /api/credits/by-key). Tier-Check: nur Active-Sub
// Kunden bekommen die Liste — Gäste/Free bekommen ein leeres Array
// mit dem Hinweis, ihre Membership anzulegen.
//
// Response shape ist bewusst eine schlanke Projektion der Hub-Datei
// (Title/Preis/Bild/Stats/Finance/Link) damit die Storefront-Section
// keine Hub-internen Felder kennen muss.

import { NextRequest, NextResponse } from "next/server";
import {
  findKundeByEmail,
  findKundeByKey,
  getAllProdukte,
  type Produkt,
} from "@/lib/sheets";
import { isActiveSubFromKunde } from "@/lib/tiers-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function project(p: Produkt) {
  const stats = p.extra?.stats;
  const finances = p.extra?.finances;
  return {
    id: p.id,
    sku: p.sku,
    monat: p.monat || "",
    titel: p.titel,
    preis: p.preis,
    bildUrl: p.bildUrl,
    beschreibung: p.beschreibung,
    aliExpressLink: p.aliExpressLink,
    extraImages: Array.isArray(p.extra?.images) ? p.extra.images.slice(0, 8) : [],
    stats: stats
      ? {
          trendScore: Math.max(0, Math.min(100, Number(stats.trendScore) || 0)),
          viralScore: Math.max(0, Math.min(100, Number(stats.viralScore) || 0)),
          impulseBuyFactor: Math.max(0, Math.min(100, Number(stats.impulseBuyFactor) || 0)),
          problemSolverIndex: Math.max(0, Math.min(100, Number(stats.problemSolverIndex) || 0)),
          marketSaturation: Math.max(0, Math.min(100, Number(stats.marketSaturation) || 0)),
        }
      : null,
    finances: finances
      ? {
          buyPrice: Number(finances.buyPrice) || 0,
          recommendedSellPrice: Number(finances.recommendedSellPrice) || 0,
          profitMargin: Number(finances.profitMargin) || 0,
        }
      : null,
  };
}

export async function GET(req: NextRequest) {
  const apiKey = (req.nextUrl.searchParams.get("apikey") || "").trim();
  const expected = (process.env.LICENSE_API_KEY || "").trim();
  if (expected && apiKey !== expected) {
    return json({ ok: false, error: "auth" }, 401);
  }

  const key = (req.nextUrl.searchParams.get("key") || "").trim();
  const email = (req.nextUrl.searchParams.get("email") || "").trim();
  if (!key && !email) {
    return json({ ok: false, error: "missing-key-or-email" }, 400);
  }

  let kunde;
  try {
    kunde = key ? await findKundeByKey(key) : await findKundeByEmail(email);
  } catch (err) {
    console.error("[charts/public] kunde lookup failed:", err);
    return json({ ok: false, error: "upstream", produkte: [] }, 200);
  }
  if (!kunde) return json({ ok: false, error: "unknown-identifier", produkte: [] }, 404);

  if (!isActiveSubFromKunde(kunde)) {
    return json(
      {
        ok: true,
        gated: true,
        message: "Charts sind Teil der Membership.",
        produkte: [],
      },
      200,
    );
  }

  try {
    const all = await getAllProdukte();
    const list = all
      .filter((p) => p.id)
      .sort((a, b) => (b.extra?.stats?.trendScore ?? 0) - (a.extra?.stats?.trendScore ?? 0))
      .map(project);

    // Group by Monat (YYYY-MM oder MM/YYYY), Top-Stand zuerst.
    const byMonth = new Map<string, ReturnType<typeof project>[]>();
    for (const p of list) {
      const m = p.monat || "Aktuell";
      const bucket = byMonth.get(m);
      if (bucket) bucket.push(p);
      else byMonth.set(m, [p]);
    }
    const months = Array.from(byMonth.entries()).map(([monat, produkte]) => ({
      monat,
      produkte,
    }));

    return json({ ok: true, gated: false, count: list.length, produkte: list, months });
  } catch (err) {
    console.error("[charts/public] getAllProdukte failed:", err);
    return json({ ok: false, error: "upstream", produkte: [] }, 200);
  }
}
