import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  return NextResponse.json({
    isLoggedIn: session.isLoggedIn || false,
    isAdmin: session.isAdmin || false,
    sku: session.sku || null,
    shopDomain: session.shopDomain || null,
    setupStep1Done: session.setupStep1Done || false,
    setupStep1Skipped: session.setupStep1Skipped || false,
    setupStep2Done: session.setupStep2Done || false,
    hasShopifyToken: !!session.shopifyToken,
    hasShopifyConnection: session.hasShopifyConnection || false,
    onboardingDone: session.onboardingDone || false,
  });
}
