// ─── /api/theme-editor-config — Start-Fenster-Config des Editors ───────
// Liefert dem Theme-Editor die vom Admin gewählte Ansicht (Black/White),
// ob ein Beispiel-Design hinterlegt ist (demoReady) und ob der Produkt-
// Picker gezeigt wird. BEWUSST ÖFFENTLICH (kein Login nötig): Die
// Standalone-Editor-Website zeigt Gästen sofort die 3 Start-Optionen —
// erst beim Wählen kommt das Login-Fenster. Es werden ausschließlich
// nicht-geheime Booleans/Enums ausgeliefert, NIE der Beispiel-Design-Code
// oder sonstiger Theme-Code (`demoReady` ist nur ein Flag).

import { NextResponse } from "next/server";
import { getThemeEditorConfig } from "@/lib/theme-demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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
