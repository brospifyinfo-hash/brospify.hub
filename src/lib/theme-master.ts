import "server-only";
import { promises as fs } from "fs";
import path from "path";

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
