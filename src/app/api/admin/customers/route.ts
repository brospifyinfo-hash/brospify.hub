// ─── /api/admin/customers ────────────────────────────────────────
// Admin-only customer overview. Returns every Kunde row with
// normalised credit state, transaction log, and selected profile
// fields so the admin can audit balances and adjust them when
// support cases arrive.
//
// Endpoints:
//   GET                   — list all customers (light view)
//   GET ?key=<licence>    — full detail for one customer
//   POST {key, delta, note} — manual credit adjustment (positive or
//                             negative). Logged with admin identifier.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  adminAdjustCredits,
  findKundeByKey,
  getAllKunden,
  getCreditsState,
  type CreditTransaction,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface CustomerSummary {
  rowIndex: number;
  lizenzschluessel: string;
  status: string;
  shopDomain: string;
  kundenEmail: string;
  bestellnummer: string;
  sku: string;
  hasShopifyToken: boolean;
  hasGoogleLinked: boolean;
  hasLegalData: boolean;
  hasBrandKit: boolean;
  credits: {
    balance: number;
    totalPurchased: number;
    totalUsed: number;
    starterGranted: boolean;
    fulfilledOrdersCount: number;
    redeemedCodesCount: number;
    logCount: number;
    lastTransaction?: CreditTransaction;
  };
}

interface CustomerDetail extends CustomerSummary {
  profile: {
    legal_data?: Record<string, string>;
    brand_kit?: Record<string, string>;
    onboarding_checklist?: Record<string, boolean>;
    linkedGoogleEmail?: string;
    adminNote?: string;
    vip?: boolean;
    blocked?: boolean;
    blockedAt?: string;
  };
  fulfilledOrders: string[];
  redeemedCodes: Record<string, number>;
  log: CreditTransaction[];
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  const key = req.nextUrl.searchParams.get("key");
  if (key) {
    return getDetail(key);
  }

  return getList();
}

async function getList(): Promise<NextResponse> {
  try {
    const kunden = await getAllKunden();
    const summaries: CustomerSummary[] = kunden
      .filter((k) => k.lizenzschluessel)
      .map((k) => {
        const c = k.profile.credits;
        const state = getCreditsState(k.profile);
        const log = Array.isArray(c?.log) ? c.log : [];
        return {
          rowIndex: k.rowIndex,
          lizenzschluessel: k.lizenzschluessel,
          status: k.status,
          shopDomain: k.shopDomain,
          kundenEmail: k.kundenEmail,
          bestellnummer: k.bestellnummer,
          sku: k.sku,
          hasShopifyToken: !!k.shopifyToken,
          hasGoogleLinked: !!k.profile.linkedGoogleEmail,
          hasLegalData: !!(k.profile.legal_data?.firmenname || k.profile.legal_data?.email),
          hasBrandKit: !!(k.profile.brand_kit?.logoUrl || k.profile.brand_kit?.primaryColor),
          credits: {
            balance: state.balance,
            totalPurchased: state.totalPurchased,
            totalUsed: state.totalUsed,
            starterGranted: c?.starterGranted === true,
            fulfilledOrdersCount: Array.isArray(c?.fulfilledOrders) ? c.fulfilledOrders.length : 0,
            redeemedCodesCount: c?.redeemedCodes ? Object.keys(c.redeemedCodes).length : 0,
            logCount: log.length,
            lastTransaction: log.length > 0 ? log[log.length - 1] : undefined,
          },
        };
      });

    // Sort: highest balance first, then oldest creation first
    summaries.sort((a, b) => b.credits.balance - a.credits.balance);
    return NextResponse.json({ customers: summaries, total: summaries.length });
  } catch (err) {
    console.error("[admin/customers] list error:", err);
    return NextResponse.json({ error: "Fehler beim Laden." }, { status: 500 });
  }
}

async function getDetail(key: string): Promise<NextResponse> {
  try {
    const k = await findKundeByKey(key);
    if (!k) {
      return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });
    }
    const c = k.profile.credits;
    const state = getCreditsState(k.profile);
    const log = Array.isArray(c?.log) ? c.log : [];
    const fulfilledOrders = Array.isArray(c?.fulfilledOrders) ? c.fulfilledOrders : [];
    const redeemedCodes = c?.redeemedCodes && typeof c.redeemedCodes === "object" ? c.redeemedCodes : {};

    const detail: CustomerDetail = {
      rowIndex: k.rowIndex,
      lizenzschluessel: k.lizenzschluessel,
      status: k.status,
      shopDomain: k.shopDomain,
      kundenEmail: k.kundenEmail,
      bestellnummer: k.bestellnummer,
      sku: k.sku,
      hasShopifyToken: !!k.shopifyToken,
      hasGoogleLinked: !!k.profile.linkedGoogleEmail,
      hasLegalData: !!(k.profile.legal_data?.firmenname || k.profile.legal_data?.email),
      hasBrandKit: !!(k.profile.brand_kit?.logoUrl || k.profile.brand_kit?.primaryColor),
      credits: {
        balance: state.balance,
        totalPurchased: state.totalPurchased,
        totalUsed: state.totalUsed,
        starterGranted: c?.starterGranted === true,
        fulfilledOrdersCount: fulfilledOrders.length,
        redeemedCodesCount: Object.keys(redeemedCodes).length,
        logCount: log.length,
        lastTransaction: log.length > 0 ? log[log.length - 1] : undefined,
      },
      profile: {
        legal_data: k.profile.legal_data as Record<string, string> | undefined,
        brand_kit: k.profile.brand_kit as Record<string, string> | undefined,
        onboarding_checklist: k.profile.onboarding_checklist as Record<string, boolean> | undefined,
        linkedGoogleEmail: k.profile.linkedGoogleEmail,
        adminNote: k.profile.adminNote,
        vip: k.profile.vip === true,
        blocked: k.profile.blocked === true,
        blockedAt: k.profile.blockedAt,
      },
      fulfilledOrders,
      redeemedCodes,
      // Newest entries first for the UI
      log: [...log].reverse(),
    };
    return NextResponse.json({ customer: detail });
  } catch (err) {
    console.error("[admin/customers] detail error:", err);
    return NextResponse.json({ error: "Fehler beim Laden." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  let body: { key?: string; delta?: number; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const key = String(body.key || "").trim();
  const delta = Math.round(Number(body.delta) || 0);
  const note = String(body.note || "").trim();
  if (!key) {
    return NextResponse.json({ error: "key fehlt." }, { status: 400 });
  }
  if (!Number.isFinite(delta) || delta === 0) {
    return NextResponse.json({ error: "delta muss eine Zahl ≠ 0 sein." }, { status: 400 });
  }

  const kunde = await findKundeByKey(key);
  if (!kunde) {
    return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });
  }

  const adminRef = session.googleEmail || session.googleName || "admin";
  const result = await adminAdjustCredits(
    kunde.rowIndex,
    kunde.profile,
    delta,
    adminRef,
    note,
  );

  return NextResponse.json({ success: true, balance: result.balance });
}
