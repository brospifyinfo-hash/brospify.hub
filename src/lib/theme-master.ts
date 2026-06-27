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

  const filePath = path.join(process.cwd(), FILE_NAME);
  try {
    cached = await fs.readFile(filePath);
    return cached;
  } catch {
    throw new Error(
      `Master-Theme nicht gefunden (${FILE_NAME} im Repo-Root oder ENV MASTER_THEME_URL setzen).`,
    );
  }
}
