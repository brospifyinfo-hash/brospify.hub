import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { put, list } from "@vercel/blob";
import { TIER_KEYS, type TierKey } from "@/lib/tiers-shared";

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
  /** YouTube link or uploaded video URL — full URL, no embed transform. */
  previewVideoUrl?: string;
  changelog?: string;
  /** One-time purchase price in EUR, when access is locked behind a tier. */
  priceEur?: number;
  /** Visible to customers when true. Inactive themes are hidden everywhere. */
  active?: boolean;
  /** Which tiers grant access without a one-time purchase. Empty array = nobody
   *  gets it through the subscription, only via one-time purchase. */
  tierAccess?: TierKey[];
  createdAt: string;
}

interface AppSettings {
  logoUrl?: string;
  brandName?: string;
  youtubeUrl?: string;
  /** Bild für den „Abo abschließen"-Bereich der Login-Seite. */
  aboImageUrl?: string;
  /** Favicon (Browser-Tab-Icon), wird über /api/favicon ausgeliefert. */
  faviconUrl?: string;
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
// Also backfill new fields (active, tierAccess, priceEur) onto every theme so
// downstream code can rely on them.
function withMigratedThemes(s: AppSettings): AppSettings {
  const ensureFields = (t: ThemeEntry): ThemeEntry => ({
    ...t,
    active: t.active === undefined ? true : t.active,
    tierAccess: Array.isArray(t.tierAccess)
      ? t.tierAccess.filter((k): k is TierKey =>
          (TIER_KEYS as readonly string[]).includes(k))
      : [...TIER_KEYS],
    priceEur: typeof t.priceEur === "number" && t.priceEur >= 0 ? t.priceEur : 0,
  });

  if (Array.isArray(s.themes) && s.themes.length > 0) {
    return { ...s, themes: s.themes.map(ensureFields) };
  }
  if (!s.themeFileUrl) return { ...s, themes: [] };
  const legacy: ThemeEntry = ensureFields({
    id: "legacy",
    name: s.themeFileName || "Brospify Theme",
    fileUrl: s.themeFileUrl,
    fileName: s.themeFileName,
    version: s.themeVersion,
    changelog: s.themeChangelog,
    createdAt: new Date(0).toISOString(),
  });
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
    // @vercel/blob v2 wirft sonst beim Überschreiben des festen Keys einen
    // Fehler ("blob already exists") → JEDES Settings-Speichern (Favicon,
    // Logo, Abo-Bild …) würde fehlschlagen.
    allowOverwrite: true,
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
    // We accept themes without a fileUrl during admin editing — the
    // admin can save a draft entry before they upload the ZIP. The
    // push endpoint guards against missing fileUrl at execution time.
    const fileUrl = typeof t.fileUrl === "string" ? t.fileUrl : "";
    const tierAccessRaw = Array.isArray(t.tierAccess) ? t.tierAccess : [];
    const tierAccess = tierAccessRaw.filter((k): k is TierKey =>
      typeof k === "string" && (TIER_KEYS as readonly string[]).includes(k));
    const priceRaw = typeof t.priceEur === "number" ? t.priceEur : Number(t.priceEur);
    const priceEur = Number.isFinite(priceRaw) && priceRaw >= 0 ? Math.round(priceRaw * 100) / 100 : 0;
    out.push({
      id: typeof t.id === "string" && t.id ? t.id : `theme_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: typeof t.name === "string" && t.name ? t.name : "Theme",
      fileUrl,
      fileName: typeof t.fileName === "string" ? t.fileName : undefined,
      version: typeof t.version === "string" ? t.version : undefined,
      description: typeof t.description === "string" ? t.description : undefined,
      previewImageUrl: typeof t.previewImageUrl === "string" ? t.previewImageUrl : undefined,
      previewVideoUrl: typeof t.previewVideoUrl === "string" ? t.previewVideoUrl : undefined,
      changelog: typeof t.changelog === "string" ? t.changelog : undefined,
      priceEur,
      active: t.active === undefined ? true : !!t.active,
      tierAccess,
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
      ...(body.aboImageUrl !== undefined && { aboImageUrl: body.aboImageUrl }),
      ...(body.faviconUrl !== undefined && { faviconUrl: body.faviconUrl }),
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
