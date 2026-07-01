import "server-only";
import { promises as fs } from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { getAllThemes } from "@/lib/sheets";

// ─────────────────────────────────────────────────────────────────
// Liefert das Master-Theme (Schablone) als Zip-Buffer.
//
// Primär aus dem gebündelten `master-theme.zip` im Repo-Root (per
// next.config `outputFileTracingIncludes` in die Function getraced).
// Optional übersteuerbar via ENV `MASTER_THEME_URL` (z. B. Vercel Blob),
// falls die Schablone ohne Redeploy aktualisierbar sein soll.
//
// Ergebnis wird pro Lambda-Instanz gecached (ändert sich nur beim Deploy).
// ─────────────────────────────────────────────────────────────────

const FILE_NAME = "master-theme.zip";
let cached: Buffer | null = null;

export async function getMasterThemeZip(): Promise<Buffer> {
  if (cached) return cached;

  const override = process.env.MASTER_THEME_URL;
  if (override) {
    const res = await fetch(override, { cache: "no-store" });
    if (!res.ok) throw new Error(`Master-Theme-Download fehlgeschlagen (${res.status}).`);
    cached = Buffer.from(await res.arrayBuffer());
    return cached;
  }

  // Mehrere Kandidaten, falls das File-Tracing den Pfad anders auflöst.
  const candidates = [
    path.join(process.cwd(), FILE_NAME),
    path.join(process.cwd(), "..", FILE_NAME),
    path.join(__dirname, FILE_NAME),
    path.join(__dirname, "..", "..", "..", FILE_NAME),
  ];
  for (const p of candidates) {
    try {
      cached = await fs.readFile(p);
      return cached;
    } catch {
      /* nächsten Pfad probieren */
    }
  }
  throw new Error(
    `Master-Theme nicht gefunden (${FILE_NAME}). Gesucht in: ${candidates.join(" | ")}. ` +
      "Alternativ ENV MASTER_THEME_URL auf eine erreichbare ZIP setzen.",
  );
}

// ─── Hochgeladenes Theme als Editor-Basis ──────────────────────────
// Lädt eine Theme-ZIP von einer URL (Vercel Blob) und cached sie pro URL
// (Blobs sind unveränderlich → sicher). Validiert den ZIP-Header (PK).
const urlCache = new Map<string, Buffer>();

export async function fetchThemeZipFromUrl(url: string): Promise<Buffer> {
  const hit = urlCache.get(url);
  if (hit) return hit;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Theme-Download fehlgeschlagen (${res.status}).`);
  const buf = Buffer.from(await res.arrayBuffer());
  // ZIP beginnt mit "PK" (0x50 0x4B) — Schutz vor HTML-Fehlerseiten etc.
  if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    throw new Error("Heruntergeladene Datei ist kein gültiges ZIP.");
  }
  urlCache.set(url, buf);
  return buf;
}

// Prüft, ob ein hochgeladenes ZIP ein echtes Brospify-Theme MIT Produktseite
// ist (und nicht z. B. ein leeres Standard-Dawn). Nur dann taugt es als Basis
// für den Editor — sonst käme ein Theme ohne die Brospify-Produktseite raus.
function isBrospifyTheme(buf: Buffer): boolean {
  try {
    const zip = new AdmZip(buf);
    const e = zip.getEntry("templates/product.json");
    if (!e) return false;
    const data = JSON.parse(e.getData().toString("utf8")) as { sections?: Record<string, { type?: string }> };
    const types = Object.values(data.sections || {}).map((s) => String(s.type || ""));
    // Kennzeichen der Brospify-Produktseite (Custom-Sections der Schablone).
    return types.some((t) => /bro-info-tabs|brospify-hero|reviews2|vids|scrollingbild/.test(t));
  } catch {
    return false;
  }
}

// Editor-Basis: das ZULETZT vom Admin hochgeladene Theme (/admin/themes) —
// ABER nur, wenn es ein echtes Brospify-Theme mit Produktseite ist. Sonst (oder
// wenn nichts Passendes hochgeladen wurde) die eingebaute Brospify-Schablone,
// die garantiert die vollständige, funktionierende Produktseite enthält.
// `key` identifiziert das Theme stabil (URL bzw. "bundled") fürs Env-Caching.
export async function getEditorBaseThemeZip(): Promise<{ zip: Buffer; source: string; key: string }> {
  try {
    const themes = await getAllThemes();
    const candidates = themes
      .filter((t) => /^https?:\/\//i.test(t.url || ""))
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    for (const t of candidates) {
      const zip = await fetchThemeZipFromUrl(t.url);
      if (isBrospifyTheme(zip)) {
        return { zip, source: t.name || "Upload", key: t.url };
      }
      console.warn(`[theme-master] Upload „${t.name}" ist kein Brospify-Theme mit Produktseite — übersprungen.`);
    }
  } catch (e) {
    console.warn("[theme-master] hochgeladene Themes nicht nutzbar, nutze Schablone:", e);
  }
  return { zip: await getMasterThemeZip(), source: "Schablone", key: "bundled" };
}
