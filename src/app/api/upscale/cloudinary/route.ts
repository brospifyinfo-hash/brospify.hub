// ─── POST /api/upscale/cloudinary ────────────────────────────────
// Premium / "High Quality" branch of the hybrid upscaler.
//
// Wire format
//   Client → us:        multipart/form-data { file }
//   Us → Cloudinary:    base64 data-URI via the v2 SDK uploader
//   Cloudinary → us:    JSON { secure_url, public_id, ... }
//   Us → Client:        JSON { url, width, height, bytes }
//
// We delegate the actual upscaling to Cloudinary's `e_upscale` AI
// effect (also asks for `q_auto:best` and `f_auto` so the served
// asset is as small as possible without quality loss). The Free Tier
// allows this transformation.
//
// Env: configure with the standard CLOUDINARY_URL
//      → cloudinary://<API_KEY>:<API_SECRET>@<CLOUD_NAME>

import { NextResponse } from "next/server";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 4 * 1024 * 1024; // Vercel body cap is 4.5 MB
const FOLDER = "brospifyhub/upscale";

function isCloudinaryConfigured(): boolean {
  // The SDK will read CLOUDINARY_URL automatically. We additionally
  // accept the split form (CLOUDINARY_CLOUD_NAME + …KEY + …SECRET).
  if (process.env.CLOUDINARY_URL) return true;
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

function ensureConfig() {
  // If the caller used the split-env form, wire it up explicitly.
  // Otherwise the SDK has already self-configured from CLOUDINARY_URL.
  if (!process.env.CLOUDINARY_URL) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
}

export async function POST(req: Request) {
  // 1) Configuration check
  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      {
        error:
          "Cloudinary ist nicht konfiguriert. Bitte CLOUDINARY_URL in der .env-Datei setzen.",
      },
      { status: 500 },
    );
  }
  ensureConfig();

  // 2) Parse multipart body
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Konnte FormData nicht lesen." },
      { status: 400 },
    );
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      { error: "Feld 'file' fehlt oder ist keine Datei." },
      { status: 400 },
    );
  }

  if (!ALLOWED_MIME.includes(fileEntry.type)) {
    return NextResponse.json(
      {
        error: `Format nicht unterstützt (${fileEntry.type}). Bitte JPG, PNG oder WebP.`,
      },
      { status: 400 },
    );
  }

  if (fileEntry.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        error: `Datei zu groß (${(fileEntry.size / 1024 / 1024).toFixed(
          1,
        )} MB). Max ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
      },
      { status: 413 },
    );
  }

  // 3) Convert File → base64 data URI (uploader.upload accepts this directly)
  const arrayBuffer = await fileEntry.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const dataUri = `data:${fileEntry.type};base64,${base64}`;

  // 4) Upload + apply Cloudinary's native AI upscale effect.
  //
  //    e_upscale         → AI super-resolution (Free Tier eligible)
  //    q_auto:best       → adaptive quality, no perceptible loss
  //    f_auto            → auto-format (WebP / AVIF when supported)
  //    fl_progressive    → progressive JPEG fallback
  let result: UploadApiResponse;
  try {
    result = await cloudinary.uploader.upload(dataUri, {
      folder: FOLDER,
      resource_type: "image",
      // `transformation` runs at upload time so the result asset is
      // already upscaled — no eager URL signing needed for the client.
      transformation: [
        { effect: "upscale" },
        { quality: "auto:best", fetch_format: "auto", flags: "progressive" },
      ],
      // Sensible defaults for our use case
      overwrite: false,
      use_filename: false,
      unique_filename: true,
    });
  } catch (err) {
    console.error("[Cloudinary upscale] upload failed:", err);
    const message =
      err instanceof Error ? err.message : "Unbekannter Cloudinary-Fehler.";

    // Surface the most common misconfiguration class with a friendly hint.
    if (/api[_ ]key|api[_ ]secret|cloud[_ ]name/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "Cloudinary-Zugangsdaten ungültig. Prüfe CLOUDINARY_URL in der .env-Datei.",
        },
        { status: 502 },
      );
    }

    if (/upscale/i.test(message) && /add[- ]?on|plan/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "Cloudinary AI-Upscale ist für dein Konto nicht aktiviert. Im Dashboard das 'AI Upscale'-Add-on freischalten.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: `Cloudinary-Fehler: ${message}` },
      { status: 502 },
    );
  }

  // 5) Return the upscaled asset URL + metadata to the client.
  return NextResponse.json(
    {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      format: result.format,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
