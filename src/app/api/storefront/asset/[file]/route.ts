// ─── GET /api/storefront/asset/[file]?code=… — ABO-GEGATETES ASSET-SERVING ──
// Liefert das kritische CSS/JS des geschützten Themes (Sektions-Loader,
// Kaufbox-Runtime, Kaufbox-Kern-CSS) NUR bei aktivem Abo des Design-
// Besitzers. Die Dateien liegen dadurch nicht mehr im Kunden-ZIP: Kündigt
// der Kunde, laden die Assets nicht mehr — zusätzlich zu den bestehenden
// Gates (render/status). Öffentlich (kein Login), CDN-gecacht pro URL
// (code+shop stecken in der URL → jede Installation cached ihr Verdikt).
//
// Schutz gegen Direktzugriff: Browser-Navigationen tragen
// Sec-Fetch-Dest: document → 403. Das ist Best-Effort (curl kann Header
// fälschen, CDN-Hits umgehen die Prüfung) — die eigentliche Absicherung
// ist das Abo-Gate über den unratbaren Sync-Code.
//
// INVARIANTEN (wie render/status/validate):
//   - Sheets-Ausfall → fail-open AUSLIEFERN (nie einen zahlenden Shop
//     wegen einer Störung sperren); fail-open nie lange cachen.
//   - Sperr-Antworten kurz cachen (s-maxage=60), damit Kündigung schnell
//     greift und Reaktivierung nicht ewig klemmt.
//   - Antworten dürfen NIE über einen Redirect laufen (www→Apex trägt
//     keine CORS-Header) — Themes referenzieren den Apex direkt.

import { NextRequest, NextResponse } from "next/server";
import { promises as fsp } from "fs";
import path from "path";
import { getThemeDesignStrict } from "@/lib/sheets";
import { BUYBOX_CSS } from "@/lib/buybox-css";
import { storefrontOwnerVerdict } from "@/lib/storefront-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED: Record<string, { contentType: string; source: "public" | "buybox-css" }> = {
  "bspx-sections.js": { contentType: "application/javascript; charset=utf-8", source: "public" },
  "bspx-runtime.js": { contentType: "application/javascript; charset=utf-8", source: "public" },
  "bspx-core.css": { contentType: "text/css; charset=utf-8", source: "buybox-css" },
};

// Datei-Inhalte pro Lambda cachen (Pfad-Kandidaten wegen Vercel-Tracing).
const fileCache = new Map<string, string>();
async function readPublicAsset(name: string): Promise<string> {
  const hit = fileCache.get(name);
  if (hit) return hit;
  for (const p of [path.join(process.cwd(), "public", name), path.join(process.cwd(), "..", "public", name)]) {
    try {
      const content = await fsp.readFile(p, "utf8");
      if (content.trim()) {
        fileCache.set(name, content);
        return content;
      }
    } catch {
      /* nächster Kandidat */
    }
  }
  return "";
}

// Verdikt pro Sync-Code kurz cachen (schützt die Sheets-Quota, wie der
// 60s-Cache in /api/license/validate). Fail-open wird NIE gecacht.
type CachedVerdict = { found: boolean; active: boolean; ts: number };
const verdictCache = new Map<string, CachedVerdict>();
const VERDICT_TTL_MS = 60_000;

async function verdictForCode(code: string): Promise<{ found: boolean; active: boolean; failOpen: boolean }> {
  const hit = verdictCache.get(code);
  if (hit && Date.now() - hit.ts < VERDICT_TTL_MS) return { ...hit, failOpen: false };

  let design: Awaited<ReturnType<typeof getThemeDesignStrict>> = null;
  try {
    // WICHTIG: die Strict-Variante — getThemeDesign() schluckt Sheets-
    // Fehler zu null, ein Ausfall sähe sonst wie „unbekannter Code" aus
    // und würde als 404 gecacht (zahlende Shops wären blank).
    design = await getThemeDesignStrict(code);
  } catch {
    // Sheets-Ausfall → fail-open ausliefern, nicht cachen.
    return { found: true, active: true, failOpen: true };
  }
  if (!design) {
    const v = { found: false, active: false, ts: Date.now() };
    cacheVerdict(code, v);
    return { ...v, failOpen: false };
  }
  const verdict = await storefrontOwnerVerdict(design.user || "");
  if (verdict.failOpen) return { found: true, active: verdict.active, failOpen: true };
  const v = { found: true, active: verdict.active, ts: Date.now() };
  cacheVerdict(code, v);
  return { ...v, failOpen: false };
}

function cacheVerdict(code: string, v: CachedVerdict) {
  verdictCache.set(code, v);
  if (verdictCache.size > 500) verdictCache.clear();
}

// CORS: <script>/<link> brauchen kein CORS — Header werden nur gesetzt,
// wenn die Origin plausibel ein Shopify-Shop ist (…myshopify.com oder die
// per ?shop= übergebene Domain). Alles andere bekommt bewusst KEIN
// Access-Control-Allow-Origin (kein Auslesen per fetch von fremden Seiten).
function corsFor(req: NextRequest, shopParam: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin, Sec-Fetch-Dest",
  };
  const origin = (req.headers.get("origin") || "").trim();
  if (!origin) return headers;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    const shopHost = shopParam.toLowerCase().replace(/^https?:\/\//, "").replace(/[/?#].*$/, "");
    if (/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(host) || (shopHost && host === shopHost)) {
      headers["Access-Control-Allow-Origin"] = origin;
    }
  } catch {
    /* unbrauchbare Origin → kein ACAO */
  }
  return headers;
}

function reply(body: string, status: number, contentType: string, cache: string, cors: Record<string, string>) {
  return new NextResponse(body, {
    status,
    headers: {
      ...cors,
      "Content-Type": contentType,
      "Cache-Control": cache,
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsFor(req, "") });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const shop = (req.nextUrl.searchParams.get("shop") || "").trim();
  const cors = corsFor(req, shop);

  const spec = ALLOWED[file || ""];
  if (!spec) {
    return reply("/* not found */", 404, "text/plain; charset=utf-8", "public, s-maxage=300", cors);
  }
  const comment = (msg: string) => `/* Brospify: ${msg} */\n`;

  // Direktzugriff im Browser (Adresszeile/Link) blocken — Script-/Style-
  // Loads schicken sec-fetch-dest: script|style, Navigationen: document.
  const dest = (req.headers.get("sec-fetch-dest") || "").toLowerCase();
  if (dest === "document" || dest === "iframe" || dest === "embed" || dest === "object") {
    return reply(comment("Direktzugriff nicht erlaubt."), 403, "text/plain; charset=utf-8", "no-store", cors);
  }

  const code = (req.nextUrl.searchParams.get("code") || "").trim();
  if (!code || code.length > 80) {
    return reply(comment("Sync-Code fehlt."), 403, spec.contentType, "public, s-maxage=60", cors);
  }

  const verdict = await verdictForCode(code);
  if (!verdict.found) {
    return reply(comment("Unbekannter Sync-Code."), 404, spec.contentType, "public, s-maxage=60", cors);
  }
  if (!verdict.active) {
    // Abo inaktiv → 403 mit leerem Kommentar-Body. Kurz cachen: Sperren
    // greifen in ≤ ~1 min, Reaktivierung klemmt maximal 60 s.
    return reply(comment("Abo inaktiv — Asset gesperrt."), 403, spec.contentType, "public, s-maxage=60", cors);
  }

  const body = spec.source === "buybox-css" ? BUYBOX_CSS : await readPublicAsset(file);
  if (!body.trim()) {
    // Datei fehlt im Deployment (Tracing-Problem) → NIE als leere 200
    // ausliefern oder cachen; der Shop fällt auf seine Fallbacks zurück.
    return reply(comment("Asset derzeit nicht verfügbar."), 503, spec.contentType, "no-store", cors);
  }

  // Aktiv: großzügig cachen (Browser 5 min, CDN 10 min + 1 Tag SWR) —
  // der Shop bleibt schnell, die Sperr-Latenz bestimmt die 403-s-maxage.
  // Fail-open (Sheets-Störung): nur kurz, damit kein langes CDN-Fenster
  // auf einem ungeprüften Verdikt steht.
  const cache = verdict.failOpen
    ? "public, max-age=60, s-maxage=60"
    : "public, max-age=300, s-maxage=600, stale-while-revalidate=86400";
  return reply(body, 200, spec.contentType, cache, cors);
}
