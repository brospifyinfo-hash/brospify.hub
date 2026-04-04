import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { put } from "@vercel/blob";

// Settings stored as JSON in Vercel Blob
const SETTINGS_KEY = "brospifyhub-settings.json";

interface AppSettings {
  logoUrl?: string;
  youtubeUrl?: string;
  themeFileUrl?: string;
  themeFileName?: string;
  themeVersion?: string;
}

async function getSettings(): Promise<AppSettings> {
  try {
    const res = await fetch(
      `${process.env.BLOB_STORE_URL || ""}/${SETTINGS_KEY}`,
      { cache: "no-store" }
    );
    if (res.ok) return await res.json();
  } catch {
    // ignore - return defaults
  }
  return {};
}

async function saveSettings(settings: AppSettings): Promise<void> {
  await put(SETTINGS_KEY, JSON.stringify(settings), {
    access: "public",
    addRandomSuffix: false,
  });
}

// GET - anyone logged in can read settings
export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch {
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
    const current = await getSettings();

    const updated: AppSettings = {
      ...current,
      ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
      ...(body.youtubeUrl !== undefined && { youtubeUrl: body.youtubeUrl }),
      ...(body.themeFileUrl !== undefined && { themeFileUrl: body.themeFileUrl }),
      ...(body.themeFileName !== undefined && { themeFileName: body.themeFileName }),
      ...(body.themeVersion !== undefined && { themeVersion: body.themeVersion }),
    };

    await saveSettings(updated);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Settings save error:", error);
    return NextResponse.json(
      { error: "Fehler beim Speichern" },
      { status: 500 }
    );
  }
}
