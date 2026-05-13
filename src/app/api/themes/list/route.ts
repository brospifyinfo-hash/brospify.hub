// ─── /api/themes/list ────────────────────────────────────────────
// Public theme list for logged-in customers. Returns ALL active
// themes plus a per-theme `access` summary so the frontend can render
// locked overlays and the "Im aktuellen Plan nicht enthalten — Upgrade
// auf [Plan-Name] oder einmalig freischalten für X Euro" CTA without
// having to know the gating rules itself.
//
// Inactive themes (admin-disabled) are excluded entirely.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findKundeByKey } from "@/lib/sheets";
import { list } from "@vercel/blob";
import { getCurrentTier } from "@/lib/tier-guard";
import { isActiveSubFromKunde, type TierKey } from "@/lib/tiers-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RawTheme {
  id: string;
  name: string;
  fileUrl: string;
  fileName?: string;
  version?: string;
  description?: string;
  previewImageUrl?: string;
  previewVideoUrl?: string;
  changelog?: string;
  priceEur?: number;
  active?: boolean;
  tierAccess?: TierKey[];
  createdAt: string;
}

interface ClientTheme {
  id: string;
  name: string;
  fileName?: string;
  version?: string;
  description?: string;
  previewImageUrl?: string;
  previewVideoUrl?: string;
  changelog?: string;
  priceEur: number;
  tierAccess: TierKey[];
  // Access decision — already evaluated server-side so the client
  // only renders. `reason` explains the lock state for the UI text.
  hasAccess: boolean;
  reason: "tier" | "purchased" | "locked-no-sub" | "locked-tier" | "locked-canceled";
}

const SETTINGS_KEY = "brospifyhub-settings.json";

async function loadThemes(): Promise<RawTheme[]> {
  try {
    const { blobs } = await list({ prefix: SETTINGS_KEY, limit: 1 });
    if (blobs.length === 0 || !blobs[0].url) return [];
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.themes)) return [];
    return data.themes.filter((t: RawTheme) => t && t.id && (t.active !== false));
  } catch (err) {
    console.error("[themes/list] settings read error:", err);
    return [];
  }
}

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const themes = await loadThemes();
  const tier = await getCurrentTier(session);
  const tierKey = tier?.key ?? null;

  let purchased: string[] = [];
  let active = false;
  if (session.isAdmin) {
    active = true;
  } else if (session.lizenzschluessel) {
    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (kunde) {
      purchased = Array.isArray(kunde.profile.themesPurchased)
        ? kunde.profile.themesPurchased
        : [];
      active = isActiveSubFromKunde(kunde);
    }
  }

  const out: ClientTheme[] = themes.map((t) => {
    const tierAccess = Array.isArray(t.tierAccess) ? t.tierAccess : [];
    const inTier = !!tierKey && tierAccess.includes(tierKey);
    const isPurchased = purchased.includes(t.id);

    let hasAccess = false;
    let reason: ClientTheme["reason"] = "locked-no-sub";

    if (session.isAdmin) {
      hasAccess = true;
      reason = "tier";
    } else if (!active) {
      hasAccess = false;
      reason = tierKey ? "locked-canceled" : "locked-no-sub";
    } else if (inTier) {
      hasAccess = true;
      reason = "tier";
    } else if (isPurchased) {
      hasAccess = true;
      reason = "purchased";
    } else {
      hasAccess = false;
      reason = "locked-tier";
    }

    return {
      id: t.id,
      name: t.name,
      fileName: t.fileName,
      version: t.version,
      description: t.description,
      previewImageUrl: t.previewImageUrl,
      previewVideoUrl: t.previewVideoUrl,
      changelog: t.changelog,
      priceEur: typeof t.priceEur === "number" ? t.priceEur : 0,
      tierAccess,
      hasAccess,
      reason,
    };
  });

  return NextResponse.json({
    themes: out,
    tier: tierKey,
    activeSubscription: active,
    purchased,
  });
}
