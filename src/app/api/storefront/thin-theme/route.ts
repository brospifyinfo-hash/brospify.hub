// ─── /api/storefront/thin-theme?code=<sync-code> ──────────────────
// Lädt das GESCHÜTZTE Theme (Beta): die Design-Sektionen liegen NICHT
// mehr als Liquid im ZIP, sondern werden live vom Hub gerendert
// (/api/storefront/render/<code>) und nur bei aktiver Lizenz gezeigt.
// Kaufbox + Header/Footer/Impressum bleiben normal. Getrennt vom
// normalen Download (der bleibt unverändert), damit man beides testen
// kann. Auth: eingeloggt + Besitzer des Designs (oder Admin).

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getThemeDesign, getAllProdukte, type Produkt } from "@/lib/sheets";
import { listCustomProductsOfOwner, customToProdukt } from "@/lib/custom-products";
import { isValidDocument } from "@/lib/theme-compile";
import { compileThinDocumentZip } from "@/lib/theme-thin";
import { getEditorBaseThemeZip } from "@/lib/theme-master";
import type { ThemeDocument } from "@/lib/theme-doc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BSPX_HUB_URL = "https://brospifyhub.com";

async function resolveProduct(user: string, productId: string): Promise<Produkt | null> {
  try {
    const hit = (await getAllProdukte()).find((p) => p.id === productId);
    if (hit) return hit;
  } catch { /* Custom */ }
  try {
    const cp = (await listCustomProductsOfOwner(user)).find((p) => p.id === productId);
    if (cp) return customToProdukt(cp);
  } catch { /* egal */ }
  return null;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const code = (req.nextUrl.searchParams.get("code") || "").trim();
  if (!code) return NextResponse.json({ error: "code fehlt. Speichere zuerst dein Projekt und nimm dessen Sync-Code." }, { status: 400 });

  const design = await getThemeDesign(code);
  if (!design) return NextResponse.json({ error: "Kein Projekt mit diesem Code gefunden." }, { status: 404 });

  const owner = session.isAdmin ? design.user : session.lizenzschluessel || "";
  if (!session.isAdmin && design.user !== owner) {
    return NextResponse.json({ error: "Dieses Projekt gehört nicht zu deinem Konto." }, { status: 403 });
  }

  let doc: ThemeDocument;
  try {
    const parsed = JSON.parse(design.docJson);
    if (!isValidDocument(parsed)) throw new Error("ungültig");
    doc = parsed;
  } catch {
    return NextResponse.json({ error: "Projekt-Dokument beschädigt." }, { status: 500 });
  }

  try {
    const produkt = await resolveProduct(design.user, design.productId || doc.productId);
    const themeCopy = produkt?.extra?.themeCopy || {};

    const { zip: master, key } = await getEditorBaseThemeZip();
    // Feld = der Sync-Code selbst (identifiziert Design + gatet via Besitzer).
    const licenseKey = code;

    // Runtimes/Plan werden NICHT mehr eingebacken — das Theme lädt sie
    // abo-gegated vom Hub (/api/storefront/asset/…, /api/buybox/<code>).
    const zip = compileThinDocumentZip(
      master,
      doc,
      themeCopy,
      key,
      { syncCode: code, hubUrl: BSPX_HUB_URL },
      licenseKey,
    );

    return new Response(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="brospify-geschuetzt-${code}.zip"`,
        "Content-Length": String(zip.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[thin-theme]", err);
    const msg = err instanceof Error ? err.message : "Theme-Erstellung fehlgeschlagen.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
