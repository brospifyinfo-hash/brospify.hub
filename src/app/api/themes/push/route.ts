import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey, getKundeProfile, updateKundeProfile } from "@/lib/sheets";
import { list } from "@vercel/blob";

export const dynamic = "force-dynamic";

// Read theme URL from global settings (stored in Vercel Blob)
async function getThemeUrl(): Promise<string | null> {
  try {
    const { blobs } = await list({ prefix: "brospifyhub-settings.json", limit: 1 });
    if (blobs.length > 0 && blobs[0].url) {
      const res = await fetch(blobs[0].url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        return data.themeFileUrl || null;
      }
    }
  } catch (err) {
    console.error("[ThemePush] Failed to read settings:", err);
  }
  return null;
}

export async function POST() {
  try {
    // 1. Auth check — must be logged-in customer (not admin)
    const session = await getSession();
    if (!session.isLoggedIn || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    // 2. Get customer data for Shopify token + domain
    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde || !kunde.shopifyToken || !kunde.shopDomain) {
      return NextResponse.json(
        { error: "Shop ist nicht verbunden. Bitte zuerst in den Einstellungen verbinden." },
        { status: 400 }
      );
    }

    const accessToken = kunde.shopifyToken;
    const domain = kunde.shopDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");

    console.log("[ThemePush] Customer:", session.lizenzschluessel);
    console.log("[ThemePush] Shop domain:", domain);
    console.log("[ThemePush] Token length:", accessToken.length);

    // 3. Get theme ZIP URL from admin settings
    const themeZipUrl = await getThemeUrl();
    if (!themeZipUrl) {
      return NextResponse.json(
        { error: "Kein Theme hinterlegt. Der Admin muss zuerst ein Theme hochladen." },
        { status: 400 }
      );
    }

    console.log("[ThemePush] Theme ZIP URL:", themeZipUrl);

    // 4. Push theme to Shopify via Admin REST API
    //    POST /admin/api/2024-01/themes.json
    //    Shopify will download the ZIP from the src URL and install it
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
            name: "Brospify Premium Theme",
            src: themeZipUrl,
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

    console.log("[ThemePush] Shopify status:", shopifyRes.status);
    console.log("[ThemePush] SHOPIFY THEME RESPONSE:", JSON.stringify(responseData));

    if (!shopifyRes.ok) {
      // Shopify token invalid or missing scope
      if (shopifyRes.status === 401 || shopifyRes.status === 403) {
        return NextResponse.json(
          {
            error: "Shopify-Zugang ungültig oder fehlende Berechtigung (write_themes). Bitte verbinde deinen Shop neu.",
          },
          { status: 400 }
        );
      }

      // Other Shopify errors
      const errorMsg =
        responseData?.errors ||
        responseData?.error ||
        responseText.substring(0, 300);
      return NextResponse.json(
        { error: `Shopify-Fehler (${shopifyRes.status}): ${JSON.stringify(errorMsg)}` },
        { status: 500 }
      );
    }

    // 5. Success — Shopify accepted the theme upload
    const theme = responseData?.theme;
    console.log("[ThemePush] Success! Theme ID:", theme?.id, "Role:", theme?.role);

    // Update onboarding checklist
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
        id: theme?.id,
        name: theme?.name,
        role: theme?.role,
        previewable: theme?.previewable,
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
