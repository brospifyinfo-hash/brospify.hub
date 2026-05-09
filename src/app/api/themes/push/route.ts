import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey, getKundeProfile, updateKundeProfile } from "@/lib/sheets";
import { list } from "@vercel/blob";
import { isActiveSub, type TierKey } from "@/lib/tiers-shared";
import { getCurrentTier } from "@/lib/tier-guard";

export const dynamic = "force-dynamic";

interface ThemeEntry {
  id: string;
  name: string;
  fileUrl: string;
  fileName?: string;
  version?: string;
  active?: boolean;
  tierAccess?: TierKey[];
  priceEur?: number;
}

// Pull theme info from settings blob; supports both new themes[] gallery
// and the legacy single-theme fields.
async function resolveTheme(themeId?: string): Promise<ThemeEntry | null> {
  try {
    const { blobs } = await list({ prefix: "brospifyhub-settings.json", limit: 1 });
    if (blobs.length === 0 || !blobs[0].url) return null;
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();

    const themes: ThemeEntry[] = Array.isArray(data.themes) ? data.themes : [];

    if (themeId) {
      const t = themes.find((x) => x.id === themeId);
      if (t && t.fileUrl) return t;
      if (themeId === "legacy" && data.themeFileUrl) {
        return {
          id: "legacy",
          name: data.themeFileName || "Brospify Premium Theme",
          fileUrl: data.themeFileUrl,
          fileName: data.themeFileName,
          tierAccess: ["starter", "pro", "business"],
          active: true,
          priceEur: 0,
        };
      }
      return null;
    }

    if (themes.length > 0 && themes[0].fileUrl) return themes[0];
    if (data.themeFileUrl) {
      return {
        id: "legacy",
        name: data.themeFileName || "Brospify Premium Theme",
        fileUrl: data.themeFileUrl,
        fileName: data.themeFileName,
        tierAccess: ["starter", "pro", "business"],
        active: true,
        priceEur: 0,
      };
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
    if (!session.isLoggedIn || !session.lizenzschluessel) {
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
    if (!theme || theme.active === false) {
      return NextResponse.json(
        { error: "Kein Theme hinterlegt. Der Admin muss zuerst ein Theme hochladen." },
        { status: 400 }
      );
    }

    // ── Per-theme access gate ───────────────────────────────────
    // Admins always pass. Otherwise: must have an active sub AND
    // either a tier that grants access, or a one-time purchase
    // record. The one-time purchase is honoured ONLY while the
    // sub stays active — no purchase grants permanent access.
    if (!session.isAdmin) {
      if (!isActiveSub(kunde.profile)) {
        return NextResponse.json(
          {
            error: "FEATURE_LOCKED",
            message:
              "Theme-Push setzt ein aktives Abo voraus. Bitte wähle einen Plan.",
          },
          { status: 403 },
        );
      }
      const tier = await getCurrentTier(session);
      const tierKey = tier?.key ?? null;
      const tierAccess = Array.isArray(theme.tierAccess) ? theme.tierAccess : [];
      const inTier = !!tierKey && tierAccess.includes(tierKey);
      const purchased = Array.isArray(kunde.profile.themesPurchased)
        ? kunde.profile.themesPurchased
        : [];
      const isPurchased = purchased.includes(theme.id);
      if (!inTier && !isPurchased) {
        return NextResponse.json(
          {
            error: "FEATURE_LOCKED",
            message:
              "Dieses Theme ist in deinem Plan nicht enthalten. Upgrade oder einmalig freischalten.",
            themeId: theme.id,
            priceEur: typeof theme.priceEur === "number" ? theme.priceEur : 0,
            tierAccess,
          },
          { status: 403 },
        );
      }
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
            src: theme.fileUrl,
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
