// ─── Library asset helpers (server-side) ─────────────────────────
// Anything that gets dropped into the user's Mediathek goes through
// here. Cost discipline:
//   • Source asset is recompressed to WebP @ 78 quality before upload
//   • A 320 px max-width WebP @ 70 quality thumbnail is generated for
//     the grid view — typically 5–15 KB per item
//   • PNG inputs that need transparency (cutouts) keep the alpha
//     channel intact; everything else is RGB-only
//   • The function is forgiving: any sharp failure falls back to the
//     original buffer so we never silently drop a user's asset
//
// Returns blob URLs only; the caller is responsible for writing the
// row to the Sheet via `addLibraryItem`.

import { put, del } from "@vercel/blob";
import sharp from "sharp";
import {
  addLibraryItem,
  deleteLibraryItem,
  getLibraryItems,
  pickLibraryItemsToEvict,
  type LibraryItem,
  type LibraryItemType,
  type LibrarySource,
} from "./sheets";

const ASSET_QUALITY = 78;
const THUMBNAIL_MAX_DIM = 320;
const THUMBNAIL_QUALITY = 70;

export interface PreparedAsset {
  assetUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  bytes: number;
  thumbBytes: number;
}

// ─── Compress + upload an image, also generating a webp thumbnail.
// `keepAlpha` should be true for cutouts (BG-removed PNGs).
export async function uploadImageWithThumbnail(
  buffer: Buffer,
  basename: string,
  keepAlpha: boolean,
): Promise<PreparedAsset> {
  // ── Encode the full asset ──────────────────────────────────────
  let assetBuffer: Buffer = buffer;
  let width = 0;
  let height = 0;
  try {
    const pipeline = sharp(buffer, { failOn: "none" }).rotate();
    const meta = await pipeline.metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
    assetBuffer = await pipeline
      .webp({
        quality: ASSET_QUALITY,
        alphaQuality: keepAlpha ? 90 : undefined,
        effort: 4,
      })
      .toBuffer();
  } catch (err) {
    console.warn("[library] webp encode failed, falling back to source:", err);
  }

  // ── Generate the thumbnail ─────────────────────────────────────
  let thumbBuffer: Buffer = assetBuffer;
  try {
    thumbBuffer = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize({
        width: THUMBNAIL_MAX_DIM,
        height: THUMBNAIL_MAX_DIM,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: THUMBNAIL_QUALITY,
        alphaQuality: keepAlpha ? 80 : undefined,
        effort: 4,
      })
      .toBuffer();
  } catch (err) {
    console.warn("[library] thumbnail encode failed, reusing asset:", err);
  }

  const stamp = Date.now();
  const safeBase = basename
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .slice(0, 60) || "asset";

  const [assetBlob, thumbBlob] = await Promise.all([
    put(`library/${stamp}-${safeBase}.webp`, assetBuffer, {
      access: "public",
      contentType: "image/webp",
    }),
    put(`library/${stamp}-${safeBase}-thumb.webp`, thumbBuffer, {
      access: "public",
      contentType: "image/webp",
    }),
  ]);

  return {
    assetUrl: assetBlob.url,
    thumbnailUrl: thumbBlob.url,
    width,
    height,
    bytes: assetBuffer.byteLength,
    thumbBytes: thumbBuffer.byteLength,
  };
}

// ─── Re-fetch + reuse an existing remote URL for the library.
// Used when a tool (Upscaler, BG Remover, AI Studio) already pushed
// a result to Blob and we just want to clone it as a Library entry.
export async function ingestRemoteImage(
  remoteUrl: string,
  basename: string,
  keepAlpha: boolean,
): Promise<PreparedAsset> {
  const res = await fetch(remoteUrl);
  if (!res.ok) {
    throw new Error(`Remote-Fetch fehlgeschlagen (${res.status}).`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return uploadImageWithThumbnail(buf, basename, keepAlpha);
}

// ─── High-level: persist a fully-prepared item to Sheet + enforce cap.
// Caller has already produced the asset/thumb URLs. We append the row
// then evict overflow (oldest first) so the user can never balloon
// past LIBRARY_MAX_ITEMS.
export async function persistLibraryItem(
  userKey: string,
  itemPartial: {
    type: LibraryItemType;
    source: LibrarySource;
    title: string;
    assetUrl: string;
    thumbnailUrl: string;
    body?: string;
    meta?: Record<string, unknown>;
  },
): Promise<LibraryItem> {
  const row: Omit<LibraryItem, "rowIndex"> = {
    id: `lib_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userKey,
    type: itemPartial.type,
    source: itemPartial.source,
    title: itemPartial.title.slice(0, 200) || "Unbenannt",
    assetUrl: itemPartial.assetUrl,
    thumbnailUrl: itemPartial.thumbnailUrl,
    body: itemPartial.body || "",
    meta: itemPartial.meta || {},
    createdAt: new Date().toISOString(),
    active: true,
  };
  await addLibraryItem(row);

  // Best-effort eviction — don't block the response if it fails.
  evictOverflow(userKey).catch((err) =>
    console.warn("[library] eviction failed:", err),
  );

  return { ...row, rowIndex: -1 };
}

async function evictOverflow(userKey: string): Promise<void> {
  const items = await getLibraryItems(userKey);
  const evict = pickLibraryItemsToEvict(items);
  if (evict.length === 0) return;

  for (const item of evict) {
    try {
      await deleteLibraryItem(item.rowIndex);
      const blobs = [item.assetUrl, item.thumbnailUrl].filter(Boolean);
      if (blobs.length > 0) {
        await del(blobs).catch(() => {
          /* blob may already be gone — fine */
        });
      }
    } catch (err) {
      console.warn("[library] failed to evict", item.id, err);
    }
  }
}

// ─── Auto-Save aus den Generierungs-Routen ───────────────────────
// Wird SERVERSEITIG direkt nach dem Generieren aufgerufen, damit jedes
// Bild / jede E-Mail automatisch in der Mediathek landet — auch wenn der
// User den Tab schliesst, solange die Route durchläuft. Niemals fatal:
// schlägt das Speichern fehl, wird nur geloggt, das Tool-Ergebnis bleibt.
export async function autoSaveLibraryImage(opts: {
  userKey: string | null | undefined;
  source: LibrarySource;
  title: string;
  remoteUrl: string;
  keepAlpha?: boolean;
  meta?: Record<string, unknown>;
}): Promise<void> {
  if (!opts.userKey || !opts.remoteUrl) return;
  try {
    const prepared = await ingestRemoteImage(opts.remoteUrl, opts.title || opts.source, !!opts.keepAlpha);
    await persistLibraryItem(opts.userKey, {
      type: "image",
      source: opts.source,
      title: opts.title || "Generiertes Bild",
      assetUrl: prepared.assetUrl,
      thumbnailUrl: prepared.thumbnailUrl,
      meta: {
        ...(opts.meta || {}),
        width: prepared.width,
        height: prepared.height,
        bytes: prepared.bytes,
        autoSaved: true,
      },
    });
  } catch (err) {
    console.warn("[library] auto-save image failed (non-fatal):", err);
  }
}

export async function autoSaveLibraryEmail(opts: {
  userKey: string | null | undefined;
  subject: string;
  liquid: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  if (!opts.userKey || !opts.liquid) return;
  try {
    await persistLibraryItem(opts.userKey, {
      type: "email",
      source: "email-templates",
      title: opts.subject || "E-Mail-Vorlage",
      assetUrl: "",
      thumbnailUrl: "",
      body: opts.liquid,
      meta: { ...(opts.meta || {}), subject: opts.subject, autoSaved: true },
    });
  } catch (err) {
    console.warn("[library] auto-save email failed (non-fatal):", err);
  }
}

// ─── Utility: hard-delete a single item (sheet row + blobs).
export async function purgeLibraryItem(item: LibraryItem): Promise<void> {
  await deleteLibraryItem(item.rowIndex);
  const blobs = [item.assetUrl, item.thumbnailUrl].filter(Boolean);
  if (blobs.length === 0) return;
  await del(blobs).catch(() => {
    /* ignore — blob already gone */
  });
}
