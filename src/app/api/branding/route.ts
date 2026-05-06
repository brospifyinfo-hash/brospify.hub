import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

// Public endpoint: returns the logoUrl + brandName so the login screen
// (where there is no session yet) can render the white-label brand.
// Only safe-to-expose fields are returned.

export const dynamic = "force-dynamic";

const SETTINGS_KEY = "brospifyhub-settings.json";

interface PublicBranding {
  logoUrl: string;
  brandName: string;
  brandAccent: string;
}

export async function GET() {
  let logoUrl = "";
  let brandName = "";
  let brandAccent = "";

  try {
    const { blobs } = await list({ prefix: SETTINGS_KEY, limit: 1 });
    if (blobs.length > 0 && blobs[0].url) {
      const res = await fetch(blobs[0].url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.logoUrl === "string") logoUrl = data.logoUrl;
        if (typeof data.brandName === "string") brandName = data.brandName;
        if (typeof data.brandAccent === "string") brandAccent = data.brandAccent;
      }
    }
  } catch (err) {
    console.error("[Branding] read error:", err);
  }

  const body: PublicBranding = { logoUrl, brandName, brandAccent };
  return NextResponse.json(body, {
    // Short cache so updates propagate within a minute, no auth check needed
    headers: { "Cache-Control": "public, max-age=30, s-maxage=30" },
  });
}
