import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { put, list } from "@vercel/blob";

export const dynamic = "force-dynamic";

// Settings stored as JSON in Vercel Blob
const SETTINGS_KEY = "brospifyhub-settings.json";

interface AppSettings {
  logoUrl?: string;
  youtubeUrl?: string;
  themeFileUrl?: string;
  themeFileName?: string;
  themeVersion?: string;
  brandPrimary?: string;
  brandAccent?: string;
  typography?: string;
  toneOfVoice?: string;
  themeChangelog?: string;
}

async function getSettings(): Promise<AppSettings> {
  try {
    // Use list() to find the settings blob by prefix — no manual URL needed
    const { blobs } = await list({ prefix: SETTINGS_KEY, limit: 1 });
    if (blobs.length > 0 && blobs[0].url) {
      console.log("[Settings] Found blob:", blobs[0].url);
      const res = await fetch(blobs[0].url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        console.log("[Settings] Loaded:", JSON.stringify(data));
        return data;
      }
    }
    console.log("[Settings] No settings blob found");
  } catch (err) {
    console.error("[Settings] getSettings error:", err);
  }
  return {};
}

async function saveSettings(settings: AppSettings): Promise<string> {
  console.log("[Settings] Saving:", JSON.stringify(settings));
  const blob = await put(SETTINGS_KEY, JSON.stringify(settings), {
    access: "public",
    addRandomSuffix: false,
  });
  console.log("[Settings] Saved to:", blob.url);
  return blob.url;
}

// GET - anyone logged in can read settings
export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch (err) {
    console.error("[Settings] GET error:", err);
    return NextResponse.json({});
  }
}

// POST - admin only
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.isAdmin) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }

    const body = await req.json();
    console.log("[Settings] POST body:", JSON.stringify(body));

    const current = await getSettings();
    console.log("[Settings] Current settings:", JSON.stringify(current));

    const updated: AppSettings = {
      ...current,
      ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
      ...(body.youtubeUrl !== undefined && { youtubeUrl: body.youtubeUrl }),
      ...(body.themeFileUrl !== undefined && { themeFileUrl: body.themeFileUrl }),
      ...(body.themeFileName !== undefined && { themeFileName: body.themeFileName }),
      ...(body.themeVersion !== undefined && { themeVersion: body.themeVersion }),
      ...(body.brandPrimary !== undefined && { brandPrimary: body.brandPrimary }),
      ...(body.brandAccent !== undefined && { brandAccent: body.brandAccent }),
      ...(body.typography !== undefined && { typography: body.typography }),
      ...(body.toneOfVoice !== undefined && { toneOfVoice: body.toneOfVoice }),
      ...(body.themeChangelog !== undefined && { themeChangelog: body.themeChangelog }),
    };

    console.log("[Settings] Updated settings:", JSON.stringify(updated));
    await saveSettings(updated);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[Settings] Save error:", error);
    return NextResponse.json(
      { error: "Fehler beim Speichern" },
      { status: 500 }
    );
  }
}
