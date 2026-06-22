// ─── /api/favicon ────────────────────────────────────────────────
// Liefert das aktuelle Favicon. Der Admin kann im Hub ein eigenes Favicon
// hochladen (Settings-Blob `faviconUrl`); ist keins gesetzt, fällt es auf
// das gebündelte Logo zurück. layout.tsx verlinkt statisch auf diese Route,
// sodass der <head> statisch bleibt und das Favicon trotzdem dynamisch
// auflöst — ein einfacher Redirect auf die Blob-URL.

import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SETTINGS_KEY = "brospifyhub-settings.json";
const DEFAULT_ICON = "/brospify-logo.png";

export async function GET(req: Request) {
  let target = DEFAULT_ICON;
  try {
    const { blobs } = await list({ prefix: SETTINGS_KEY, limit: 1 });
    if (blobs.length > 0 && blobs[0].url) {
      const res = await fetch(blobs[0].url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.faviconUrl === "string" && data.faviconUrl.trim()) {
          target = data.faviconUrl.trim();
        }
      }
    }
  } catch (err) {
    console.error("[favicon] read error:", err);
  }
  // `target` kann absolut (Blob-URL) oder relativ (Default) sein — new URL
  // mit req.url als Basis löst beides korrekt auf.
  const res = NextResponse.redirect(new URL(target, req.url), 307);
  res.headers.set("Cache-Control", "public, max-age=60, s-maxage=60");
  return res;
}
