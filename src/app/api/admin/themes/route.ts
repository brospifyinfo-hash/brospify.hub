// ─── /api/admin/themes ───────────────────────────────────────────
// Admin-Verwaltung der Shopify-Theme-ZIPs. Der eigentliche ZIP-Upload
// läuft über /api/upload (Vercel Blob, Ordner themes/); hier werden nur
// die Metadaten gepflegt. Es werden immer nur die 10 NEUESTEN Versionen
// behalten — beim Anlegen werden ältere automatisch entfernt.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { addTheme, deleteTheme, getAllThemes } from "@/lib/sheets";

export const dynamic = "force-dynamic";

const MAX_THEMES = 10;

function byNewest(a: { createdAt: string }, b: { createdAt: string }) {
  return (b.createdAt || "").localeCompare(a.createdAt || "");
}

// GET — alle Themes (zum Verwalten, inkl. rowIndex)
export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  try {
    const themes = (await getAllThemes()).sort(byNewest);
    return NextResponse.json({ themes });
  } catch (e) {
    console.error("[admin/themes] GET error:", e);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

// POST — neues Theme anlegen (Metadaten); danach auf 10 neueste prunen
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const url = String(body.url || "").trim();
    const fileName = String(body.fileName || "").trim();
    const version = String(body.version || "").trim() || "v1";
    const sizeBytes = Number(body.sizeBytes) || 0;
    if (!name) {
      return NextResponse.json({ error: "Name fehlt." }, { status: 400 });
    }
    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: "Gültige Datei-URL fehlt (erst ZIP hochladen)." }, { status: 400 });
    }

    await addTheme({
      id: `theme_${Date.now()}`,
      name,
      version,
      url,
      fileName,
      sizeBytes,
      createdAt: new Date().toISOString(),
    });

    // Prune: nur die 10 neuesten behalten.
    const all = (await getAllThemes()).sort(byNewest);
    for (const t of all.slice(MAX_THEMES)) {
      await deleteTheme(t.rowIndex);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[admin/themes] POST error:", e);
    return NextResponse.json({ error: "Fehler beim Speichern." }, { status: 500 });
  }
}

// DELETE — Theme entfernen (nur Metadaten; die Blob-Datei bleibt liegen)
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  try {
    const { rowIndex } = await req.json();
    if (!rowIndex) {
      return NextResponse.json({ error: "rowIndex fehlt." }, { status: 400 });
    }
    await deleteTheme(Number(rowIndex));
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[admin/themes] DELETE error:", e);
    return NextResponse.json({ error: "Fehler beim Löschen." }, { status: 500 });
  }
}
