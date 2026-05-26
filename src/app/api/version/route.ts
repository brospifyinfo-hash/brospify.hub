// ─── /api/version ────────────────────────────────────────────
// Live Version-Indicator fuer das Mobile-Menue.
//
// version    = Semantische Version, manuell gepflegt bei groesseren
//              Releases. Wird im Menue als "Brospify Hub v1.2" gezeigt.
// buildTime  = Erste 7 Chars vom Vercel-Git-Commit-SHA. Updates
//              automatisch bei JEDEM Deploy ohne manuelles Bumpen,
//              damit der User sofort sieht ob ein Update durch ist.
// deployedAt = ISO-Timestamp des letzten Commits.
//
// `force-dynamic` weil Vercel sonst die JSON-Response cachen wuerde
// und wir nie eine neue Version sehen ohne Cache-Bust.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const APP_VERSION = "v1.2";

export async function GET() {
  return NextResponse.json({
    version: APP_VERSION,
    buildTime: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local",
    deployedAt: process.env.VERCEL_GIT_COMMIT_AUTHOR_DATE || "unknown",
    vercelEnv: process.env.VERCEL_ENV || "unknown",
    serverTime: new Date().toISOString(),
  });
}
