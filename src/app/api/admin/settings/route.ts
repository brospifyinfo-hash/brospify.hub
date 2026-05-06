import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { put, list } from "@vercel/blob";

export const dynamic = "force-dynamic";

const SETTINGS_KEY = "brospifyhub-settings.json";

export interface ThemeEntry {
  id: string;
  name: string;
  fileUrl: string;
  fileName?: string;
  version?: string;
  description?: string;
  previewImageUrl?: string;
  changelog?: string;
  createdAt: string;
}

interface AppSettings {
  logoUrl?: string;
  brandName?: string;
  youtubeUrl?: string;
  // Legacy single-theme fields — kept for backward compat
  themeFileUrl?: string;
  themeFileName?: string;
  themeVersion?: string;
  themeChangelog?: string;
  // New: gallery of themes
  themes?: ThemeEntry[];
  brandPrimary?: string;
  brandAccent?: string;
  typography?: string;
  toneOfVoice?: string;
}

// Auto-migrate: if there are no themes[] but a legacy themeFileUrl exists,
// surface it as the first entry so the UI shows everything in one place.
function withMigratedThemes(s: AppSettings): AppSettings {
  if (Array.isArray(s.themes) && s.themes.length > 0) return s;
  if (!s.themeFileUrl) return { ...s, themes: [] };
  const legacy: ThemeEntry = {
    id: "legacy",
    name: s.themeFileName || "Brospify Theme",
    fileUrl: s.themeFileUrl,
    fileName: s.themeFileName,
    version: s.themeVersion,
    changelog: s.themeChangelog,
    createdAt: new Date(0).toISOString(),
  };
  return { ...s, themes: [legacy] };
}

async function getSettings(): Promise<AppSettings> {
  try {
    const { blobs } = await list({ prefix: SETTINGS_KEY, limit: 1 });
    if (blobs.length > 0 && blobs[0].url) {
      const res = await fetch(blobs[0].url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        return withMigratedThemes(data);
      }
    }
  } catch (err) {
    console.error("[Settings] getSettings error:", err);
  }
  return { themes: [] };
}

async function saveSettings(settings: AppSettings): Promise<string> {
  const blob = await put(SETTINGS_KEY, JSON.stringify(settings), {
    access: "public",
    addRandomSuffix: false,
  });
  return blob.url;
}

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

function sanitizeThemes(input: unknown): ThemeEntry[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: ThemeEntry[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const t = raw as Record<string, unknown>;
    const fileUrl = typeof t.fileUrl === "string" ? t.fileUrl : "";
    if (!fileUrl) continue;
    out.push({
      id: typeof t.id === "string" && t.id ? t.id : `theme_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: typeof t.name === "string" && t.name ? t.name : "Theme",
      fileUrl,
      fileName: typeof t.fileName === "string" ? t.fileName : undefined,
      version: typeof t.version === "string" ? t.version : undefined,
      description: typeof t.description === "string" ? t.description : undefined,
      previewImageUrl: typeof t.previewImageUrl === "string" ? t.previewImageUrl : undefined,
      changelog: typeof t.changelog === "string" ? t.changelog : undefined,
      createdAt: typeof t.createdAt === "string" ? t.createdAt : new Date().toISOString(),
    });
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.isAdmin) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }

    const body = await req.json();
    const current = await getSettings();
    const cleanThemes = sanitizeThemes(body.themes);

    const updated: AppSettings = {
      ...current,
      ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
      ...(body.brandName !== undefined && { brandName: body.brandName }),
      ...(body.youtubeUrl !== undefined && { youtubeUrl: body.youtubeUrl }),
      ...(body.themeFileUrl !== undefined && { themeFileUrl: body.themeFileUrl }),
      ...(body.themeFileName !== undefined && { themeFileName: body.themeFileName }),
      ...(body.themeVersion !== undefined && { themeVersion: body.themeVersion }),
      ...(body.themeChangelog !== undefined && { themeChangelog: body.themeChangelog }),
      ...(cleanThemes !== undefined && { themes: cleanThemes }),
      ...(body.brandPrimary !== undefined && { brandPrimary: body.brandPrimary }),
      ...(body.brandAccent !== undefined && { brandAccent: body.brandAccent }),
      ...(body.typography !== undefined && { typography: body.typography }),
      ...(body.toneOfVoice !== undefined && { toneOfVoice: body.toneOfVoice }),
    };

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
