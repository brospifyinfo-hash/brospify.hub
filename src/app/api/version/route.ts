// ─── /api/version ────────────────────────────────────────────
// Diagnose-Endpoint. Liefert die zur Build-Zeit eingefrorene
// Versionskennung zurueck. So sehen wir SOFORT (per curl oder im
// Browser) ob der von uns gepushte Code wirklich auf Vercel laeuft.
//
// Vercel cached statische Routen unter Umstaenden aggressiv — mit
// `dynamic = "force-dynamic"` wird der Endpoint pro Request neu
// gerendert.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Bumpen wenn was Wichtiges geaendert wurde — so kann der User per
// curl pruefen welche Version live ist.
const APP_VERSION = "v2026-05-24-postverify-v2";

export async function GET() {
  return NextResponse.json({
    version: APP_VERSION,
    buildTime: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local",
    deployedAt: process.env.VERCEL_GIT_COMMIT_AUTHOR_DATE || "unknown",
    vercelEnv: process.env.VERCEL_ENV || "unknown",
    serverTime: new Date().toISOString(),
  });
}
