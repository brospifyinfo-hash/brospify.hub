import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey, getKundeProfile, updateKundeProfile } from "@/lib/sheets";
import { list } from "@vercel/blob";
import { requireFeature } from "@/lib/tier-guard";

export const dynamic = "force-dynamic";

interface ThemeEntry {
  id: string;
  name: string;
  fileUrl: string;
  fileName?: string;
  version?: string;
}

// Pull theme info from settings blob; supports both new themes[] gallery
// and the legacy single-theme fields.
async function resolveTheme(themeId?: string): Promise<{ url: string; name: string } | null> {
  try {
    const { blobs } = await list({ prefix: "brospifyhub-settings.json", limit: 1 });
    if (blobs.length === 0 || !blobs[0].url) return null;
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();

    const themes: ThemeEntry[] = Array.isArray(data.themes) ? data.themes : [];

    // Explicit themeId requested → must match
    if (themeId) {
      const t = themes.find((x) => x.id === themeId);
      if (t && t.fileUrl) {
        return { url: t.fileUrl, name: t.name || "Brospify Theme" };
      }
      // Fallback: legacy "legacy" id maps to single-theme fields
      if (themeId === "legacy" && data.themeFileUrl) {
        return { url: data.themeFileUrl, name: data.themeFileName || "Brospify Premium Theme" };
      }
      return null;
    }

    // No id → first theme in gallery, or legacy single theme
    if (themes.length > 0 && themes[0].fileUrl) {
      return { url: themes[0].fileUrl, name: themes[0].name || "Brospify Theme" };
    }
    if (data.themeFileUrl) {
      return { url: data.themeFileUrl, name: data.themeFileName || "Brospify Premium Theme" };
    }
    return null;
  } catch (err) {
    console.error("[ThemePush] Failed to read settings:", err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const guard = await requireFeature(session, "themesGallery");
    if (!guard.ok) return guard.response;
    if (!session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde || !kunde.shopifyToken || !kunde.shopDomain) {
      return NextResponse.json(
        { error: "Shop ist nicht verbunden. Bitte zuerst in den Einstellungen verbinden." },
        { status: 400 }
      );
    }

    const accessToken = kunde.shopifyToken;
    const domain = kunde.shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");

    let themeId: string | undefined;
    try {
      const body = await req.json();
      if (body && typeof body.themeId === "string") themeId = body.themeId;
    } catch { /* no body, that's fine — fall back to first/legacy */ }

    const theme = await resolveTheme(themeId);
    if (!theme) {
      return NextResponse.json(
        { error: "Kein Theme hinterlegt. Der Admin muss zuerst ein Theme hochladen." },
        { status: 400 }
      );
    }

    console.log("[ThemePush] Customer:", session.lizenzschluessel, "Shop:", domain, "Theme:", theme.name);

    const shopifyRes = await fetch(
      `https://${domain}/admin/api/2024-01/themes.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          theme: {
            name: theme.name,
            src: theme.url,
          },
        }),
      }
    );

    const responseText = await shopifyRes.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!shopifyRes.ok) {
      if (shopifyRes.status === 401 || shopifyRes.status === 403) {
        return NextResponse.json(
          {
            error: "Shopify-Zugang ungültig oder fehlende Berechtigung (write_themes). Bitte verbinde deinen Shop neu.",
          },
          { status: 400 }
        );
      }

      const errorMsg =
        responseData?.errors ||
        responseData?.error ||
        responseText.substring(0, 300);
      return NextResponse.json(
        { error: `Shopify-Fehler (${shopifyRes.status}): ${JSON.stringify(errorMsg)}` },
        { status: 500 }
      );
    }

    const installedTheme = responseData?.theme;

    try {
      const profile = await getKundeProfile(kunde.rowIndex);
      await updateKundeProfile(kunde.rowIndex, {
        ...profile,
        onboarding_checklist: { ...profile.onboarding_checklist, theme_pushed: true },
      });
    } catch (e) { console.error("[ThemePush] Checklist update failed:", e); }

    return NextResponse.json({
      success: true,
      theme: {
        id: installedTheme?.id,
        name: installedTheme?.name,
        role: installedTheme?.role,
        previewable: installedTheme?.previewable,
      },
    });
  } catch (error) {
    console.error("[ThemePush] Error:", error);
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten. Bitte versuche es erneut." },
      { status: 500 }
    );
  }
}
