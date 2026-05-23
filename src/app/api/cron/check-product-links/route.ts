// ─── /api/cron/check-product-links ────────────────────────────
// Geht jede Produktzeile durch und prüft ihre 3 Links auf
// Erreichbarkeit:
//   1. extra.links.aliExpressProduct  (oder Top-Level aliExpressLink, falls Altdaten)
//   2. extra.links.aliExpressCategory
//   3. extra.links.dropshippingExample.url
// Das Ergebnis landet in `extra.linkStatus` — die Charts-UI lest
// das und zeigt nur dann die "Link evtl. nicht mehr verfügbar"-
// Warnung, wenn ein Status auf false steht. So muss der User die
// Warnung NICHT permanent sehen, nur wenn ein Link wirklich
// kaputt ist.
//
// Authentifizierung: identisch zu den anderen Cron-Routen:
//   - `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron)
//   - oder Admin-Session (manueller Trigger im Admin-Panel)

import { NextRequest, NextResponse } from "next/server";
import {
  getAllProdukte,
  updateProduktExtra,
  logSystemEvent,
  type ProduktExtra,
  type ProduktLinkStatus,
} from "@/lib/sheets";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const URL_TIMEOUT_MS = 6000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function isUrlReachable(url: string | undefined | null): Promise<boolean> {
  if (!url || typeof url !== "string") return false;
  // Best-effort URL-Validierung — falsch geformte URLs zählen als down.
  try {
    new URL(url);
  } catch {
    return false;
  }
  try {
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(URL_TIMEOUT_MS),
      headers: { "User-Agent": UA },
    });
    // 5xx = Server kaputt → wir markieren broken. 4xx zählen wir als
    // erreichbar (URL existiert, der Server antwortet) — auch 404 ist
    // technisch eine Antwort vom Server; der Produktlink darf trotzdem
    // grün bleiben, nur 5xx + Timeout sind eindeutig "weg".
    // Ausnahme: 404 für /item/<id> ist ein eindeutiges "Produkt
    // entfernt" und sollte als broken zählen.
    if (r.status >= 500) return false;
    if (r.status === 404 && /\/item\/\d/.test(url)) return false;
    return true;
  } catch {
    return false;
  }
}

async function isAuthorised(req: NextRequest): Promise<{ ok: boolean; actor: string }> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") || "";
    if (auth === `Bearer ${cronSecret}`) {
      return { ok: true, actor: "cron" };
    }
  }
  const session = await getSession();
  if (session.isLoggedIn && session.isAdmin) {
    return {
      ok: true,
      actor: session.googleEmail || session.lizenzschluessel || "admin",
    };
  }
  return { ok: false, actor: "" };
}

interface CheckSummary {
  scanned: number;
  updated: number;
  errors: number;
  brokenProduct: number;
  brokenCategory: number;
  brokenDropshipping: number;
}

async function run(req: NextRequest) {
  const auth = await isAuthorised(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const summary: CheckSummary = {
    scanned: 0,
    updated: 0,
    errors: 0,
    brokenProduct: 0,
    brokenCategory: 0,
    brokenDropshipping: 0,
  };

  try {
    const produkte = await getAllProdukte();
    const checkedAt = new Date().toISOString();

    for (const p of produkte) {
      if (!p.id) continue;
      summary.scanned++;

      const extra: ProduktExtra = p.extra || {};
      const links = extra.links || {};
      // Backwards-compat: falls die strukturierten Links noch nicht
      // gesetzt sind, nutzen wir den Top-Level aliExpressLink als
      // Produkt-URL — so checken wir auch Altdaten mit.
      const productUrl = links.aliExpressProduct || p.aliExpressLink || "";
      const categoryUrl = links.aliExpressCategory || "";
      const dropUrl = links.dropshippingExample?.url || "";

      try {
        const [productOk, categoryOk, dropOk] = await Promise.all([
          productUrl ? isUrlReachable(productUrl) : Promise.resolve(undefined),
          categoryUrl ? isUrlReachable(categoryUrl) : Promise.resolve(undefined),
          dropUrl ? isUrlReachable(dropUrl) : Promise.resolve(undefined),
        ]);

        if (productOk === false) summary.brokenProduct++;
        if (categoryOk === false) summary.brokenCategory++;
        if (dropOk === false) summary.brokenDropshipping++;

        const nextStatus: ProduktLinkStatus = {
          ...(productOk !== undefined ? { aliExpressProductOk: productOk } : {}),
          ...(categoryOk !== undefined ? { aliExpressCategoryOk: categoryOk } : {}),
          ...(dropOk !== undefined ? { dropshippingExampleOk: dropOk } : {}),
          lastCheckedAt: checkedAt,
        };

        // Nur schreiben, wenn sich was geändert hat — spart Sheets-
        // Schreibquota auf großen Katalogen.
        const prev = extra.linkStatus || {};
        const changed =
          prev.aliExpressProductOk !== nextStatus.aliExpressProductOk ||
          prev.aliExpressCategoryOk !== nextStatus.aliExpressCategoryOk ||
          prev.dropshippingExampleOk !== nextStatus.dropshippingExampleOk ||
          !prev.lastCheckedAt;

        if (changed) {
          const nextExtra: ProduktExtra = { ...extra, linkStatus: nextStatus };
          await updateProduktExtra(p.rowIndex, nextExtra);
          summary.updated++;
          // Kleiner Throttle alle 5 Schreibvorgänge — Sheets hat
          // ein 60-write-per-minute Limit pro User.
          if (summary.updated % 5 === 0) {
            await new Promise((r) => setTimeout(r, 800));
          }
        }
      } catch (err) {
        console.error(`[check-product-links] row ${p.rowIndex}:`, err);
        summary.errors++;
      }
    }

    void logSystemEvent({
      level:
        summary.brokenProduct + summary.brokenCategory + summary.brokenDropshipping > 0
          ? "audit"
          : "info",
      actor: auth.actor,
      action: "products.check_links",
      target: "",
      details: { ...summary },
    });

    return NextResponse.json({ success: true, ...summary });
  } catch (err) {
    console.error("[check-product-links] error:", err);
    void logSystemEvent({
      level: "error",
      actor: auth.actor,
      action: "products.check_links.fail",
      target: "",
      details: { message: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Linkcheck fehlgeschlagen." },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
