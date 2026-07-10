// ─── /api/theme-editor-config — Editor-Ansicht für eingeloggte Nutzer ──
// Liefert dem Theme-Editor die vom Admin gewählte Ansicht (Black/White)
// und ob ein Beispiel-Design für das Start-Fenster hinterlegt ist.
// Bewusst schlank: Code selbst wird NIE an Kunden ausgeliefert.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getThemeEditorConfig } from "@/lib/theme-demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  try {
    const config = await getThemeEditorConfig();
    return NextResponse.json(
      {
        appearance: config.appearance,
        demoReady: !!config.demoDesignCode,
        showProductPicker: config.showProductPicker,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[theme-editor-config] public GET failed:", err);
    // Editor soll trotzdem starten — Default-Ansicht, keine Demo, kein Picker.
    return NextResponse.json({ appearance: "black", demoReady: false, showProductPicker: false });
  }
}
