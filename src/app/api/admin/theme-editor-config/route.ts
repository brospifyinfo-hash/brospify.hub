// ─── /api/admin/theme-editor-config — Start-Erlebnis des Theme-Editors ──
// GET  → aktuelle Config + Validierungs-Info zum hinterlegten Beispiel-Design
// POST → { demoDesignCode?, appearance? } speichern; ein nicht-leerer Code
//        wird SOFORT validiert (Design + Produkt auflösbar), damit Kunden
//        nie eine kaputte Demo sehen. Nur Admins.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getThemeEditorConfig, saveThemeEditorConfig, loadDemoDesign,
  normalizeAppearance, type ThemeEditorConfig,
} from "@/lib/theme-demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DemoInfo {
  ok: boolean;
  name?: string;
  productTitle?: string;
  sections?: number;
  error?: string;
}

async function demoInfoFor(code: string): Promise<DemoInfo | null> {
  if (!code) return null;
  try {
    const demo = await loadDemoDesign(code);
    if ("error" in demo) return { ok: false, error: demo.error };
    return {
      ok: true,
      name: demo.name,
      productTitle: demo.produkt.titel,
      sections: demo.document.sections.length,
    };
  } catch (err) {
    console.error("[theme-editor-config] Demo-Validierung fehlgeschlagen:", err);
    return { ok: false, error: "Design konnte gerade nicht geprüft werden." };
  }
}

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  try {
    const config = await getThemeEditorConfig();
    const demo = await demoInfoFor(config.demoDesignCode);
    return NextResponse.json({ config, demo }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[theme-editor-config] GET failed:", err);
    return NextResponse.json({ error: "Config konnte nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  let body: { demoDesignCode?: unknown; appearance?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 });
  }

  try {
    const current = await getThemeEditorConfig();
    const codeInBody = typeof body.demoDesignCode === "string";
    const next: ThemeEditorConfig = {
      demoDesignCode: codeInBody ? (body.demoDesignCode as string).trim().slice(0, 64) : current.demoDesignCode,
      appearance: body.appearance !== undefined ? normalizeAppearance(body.appearance) : current.appearance,
    };

    // Ein MITGESCHICKTER nicht-leerer Code muss auf ein ladbares Design +
    // Produkt zeigen — sonst 400 mit der konkreten Ursache. Ein reiner
    // Appearance-Toggle validiert den GESPEICHERTEN Code bewusst NICHT:
    // wird das hinterlegte Design später gelöscht, darf das die Ansicht-
    // Umschaltung nicht blockieren (die Demo-Info kommt trotzdem mit).
    const demo = await demoInfoFor(next.demoDesignCode);
    if (codeInBody && demo && !demo.ok) {
      return NextResponse.json({ error: demo.error || "Design-Code ungültig.", demo }, { status: 400 });
    }

    await saveThemeEditorConfig(next);
    return NextResponse.json({ ok: true, config: next, demo });
  } catch (err) {
    console.error("[theme-editor-config] POST failed:", err);
    return NextResponse.json({ error: "Speichern fehlgeschlagen." }, { status: 500 });
  }
}
