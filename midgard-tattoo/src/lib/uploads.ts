// ─── Bild-Ablage ─────────────────────────────────────────────────
// Hochgeladene Bilder wandern durch dieselbe Aufbereitung wie die
// mitgelieferten Motive: auf 1400 px begrenzt, als WebP kodiert, dazu
// ein 12 px breiter Blur-Platzhalter als Data-URI.
//
// Zwei Ablagen, automatisch gewählt:
//   • Vercel Blob — sobald BLOB_READ_WRITE_TOKEN gesetzt ist
//   • public/uploads/ — sonst, für die lokale Entwicklung
//
// Anders als der Termin-Store dürfen Bilder öffentlich liegen: sie
// gehören ohnehin auf die Website. Deshalb hier kein abgeleiteter,
// unerratbarer Dateiname, sondern ein zufälliger — der reicht, um
// Kollisionen auszuschließen.

import { randomUUID } from "node:crypto";
import sharp from "sharp";

/** Größte Kantenlänge. Darüber lohnt sich nichts mehr: die Galerie
 *  zeigt Kacheln, der Hero skaliert ohnehin auf die Bildschirmbreite. */
const MAX_WIDTH = 1400;
const QUALITY = 82;
const BLUR_WIDTH = 12;

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export interface PreparedImage {
  url: string;
  width: number;
  height: number;
  blur: string;
}

function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Konvertiert, verkleinert und legt das Bild ab. */
export async function storeImage(input: Buffer, originalName: string): Promise<PreparedImage> {
  // `rotate()` ohne Argument wendet die EXIF-Ausrichtung an. Ohne das
  // stünden Handyfotos im Hochformat quer.
  const pipeline = sharp(input, { failOn: "none" }).rotate();
  const meta = await pipeline.metadata();

  const webp = await pipeline
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 5 })
    .toBuffer({ resolveWithObject: true });

  const blurBuffer = await sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width: BLUR_WIDTH })
    .webp({ quality: 35 })
    .toBuffer();
  const blur = `data:image/webp;base64,${blurBuffer.toString("base64")}`;

  // Dateiname aus dem Original ableiten, damit man im Speicher noch
  // erkennt, was man vor sich hat — aber entschärft, damit nichts aus
  // dem Pfad ausbricht.
  const stem = originalName
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "bild";
  const filename = `${stem}-${randomUUID().slice(0, 8)}.webp`;

  const width = webp.info.width;
  const height = webp.info.height;
  void meta;

  if (blobConfigured()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`tattoo-media/${filename}`, webp.data, {
      access: "public",
      addRandomSuffix: false,
      contentType: "image/webp",
    });
    return { url: blob.url, width, height, blur };
  }

  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), webp.data);
  return { url: `/uploads/${filename}`, width, height, blur };
}

/** Räumt die Datei zu einem gelöschten Eintrag weg. Fehlschläge sind
 *  nicht fatal — ein verwaistes Bild ist harmloser als ein Eintrag, der
 *  sich nicht löschen lässt. */
export async function removeImage(url: string): Promise<void> {
  try {
    if (url.startsWith("http")) {
      if (!blobConfigured()) return;
      const { del } = await import("@vercel/blob");
      await del(url);
      return;
    }
    if (!url.startsWith("/uploads/")) return;
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    await fs.unlink(path.join(process.cwd(), "public", url.replace(/^\//, "")));
  } catch (error) {
    console.warn("[uploads] Datei konnte nicht entfernt werden:", url, error);
  }
}
