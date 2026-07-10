// ─── /api/theme-demo — Beispiel-Shop für das Start-Fenster ──────────
// Liefert das vom Admin vorbereitete Beispiel-Design (Dokument + Preview-
// Daten seines Produkts) an JEDEN eingeloggten Nutzer — bewusst OHNE
// Besitz-Prüfung: das Demo-Produkt gehört dem Admin, Kunden sehen nur zu.
// Kein AI-Call, keine Credits — die „Generierung" wird clientseitig
// inszeniert (GenerationTheater), Ziel ist exakt dieses Dokument.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getThemeEditorConfig, loadDemoDesign } from "@/lib/theme-demo";
import { buildProductPreviewPayload, getBaseManifestCached } from "@/lib/theme-preview-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Die Antwort ist für ALLE Nutzer identisch und kostet pro Miss mehrere
// ungecachte Sheets-Reads (Config + Design-Tabelle + Produkt) — ein kurzer
// Modul-Cache kappt die Quota-Amplifikation (Muster: buybox memCache).
// Key = Design-Code: hinterlegt der Admin einen neuen Code, greift er sofort;
// Inhalts-Updates unter demselben Code brauchen max. TTL.
const DEMO_TTL_MS = 60_000;
let demoCache: { code: string; body: string; at: number } | null = null;

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  try {
    const config = await getThemeEditorConfig();
    if (!config.demoDesignCode) {
      return NextResponse.json({ error: "Es ist noch kein Beispiel-Design hinterlegt." }, { status: 404 });
    }
    if (demoCache && demoCache.code === config.demoDesignCode && Date.now() - demoCache.at < DEMO_TTL_MS) {
      return new NextResponse(demoCache.body, {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }
    const demo = await loadDemoDesign(config.demoDesignCode);
    if ("error" in demo) {
      console.warn("[theme-demo] Beispiel-Design nicht ladbar:", demo.error);
      return NextResponse.json({ error: "Die Demo ist gerade nicht verfügbar." }, { status: 404 });
    }

    const manifest = await getBaseManifestCached();
    const body = JSON.stringify({
      document: demo.document,
      name: demo.name,
      preview: buildProductPreviewPayload(demo.produkt, manifest),
    });
    demoCache = { code: config.demoDesignCode, body, at: Date.now() };
    return new NextResponse(body, {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[theme-demo] GET failed:", err);
    return NextResponse.json({ error: "Die Demo ist gerade nicht verfügbar." }, { status: 500 });
  }
}
