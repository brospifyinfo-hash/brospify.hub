// ─── /api/favicon ────────────────────────────────────────────────
// Liefert das aktuelle Favicon. Der Admin kann im Hub ein eigenes Favicon
// hochladen (Settings-Blob `faviconUrl`). Diese Route gibt das Bild DIREKT
// (HTTP 200) zurück — kein Redirect — damit auch Googles Favicon-Fetcher
// (Suchergebnisse) und andere Crawler es zuverlässig holen. Ohne Upload:
// Fallback aufs gebündelte Logo.
//
// Erreichbar als /favicon.ico (Rewrite in next.config) — diese URL ist von
// robots.txt erlaubt, /api/* dagegen nicht.

import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SETTINGS_KEY = "brospifyhub-settings.json";

function contentTypeFor(url: string): string {
  const u = url.toLowerCase();
  if (u.includes(".png")) return "image/png";
  if (u.includes(".svg")) return "image/svg+xml";
  if (u.includes(".jpg") || u.includes(".jpeg")) return "image/jpeg";
  if (u.includes(".webp")) return "image/webp";
  if (u.includes(".gif")) return "image/gif";
  if (u.includes(".avif")) return "image/avif";
  if (u.includes(".ico")) return "image/x-icon";
  return "image/x-icon";
}

export async function GET(req: Request) {
  try {
    const { blobs } = await list({ prefix: SETTINGS_KEY, limit: 1 });
    if (blobs.length > 0 && blobs[0].url) {
      const res = await fetch(blobs[0].url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const faviconUrl =
          typeof data.faviconUrl === "string" ? data.faviconUrl.trim() : "";
        if (faviconUrl) {
          const img = await fetch(faviconUrl, { cache: "no-store" });
          if (img.ok) {
            const buf = Buffer.from(await img.arrayBuffer());
            const ct = img.headers.get("content-type") || contentTypeFor(faviconUrl);
            return new NextResponse(buf, {
              status: 200,
              headers: {
                "Content-Type": ct,
                // Etwas länger cachen — Crawler/Browser holen es selten.
                "Cache-Control": "public, max-age=3600, s-maxage=3600",
              },
            });
          }
        }
      }
    }
  } catch (err) {
    console.error("[favicon] read error:", err);
  }
  // Kein eigenes Favicon gesetzt → auf das gebündelte Logo ausweichen.
  return NextResponse.redirect(new URL("/brospify-logo.png", req.url), 307);
}
