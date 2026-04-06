import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllKunden, getKundeProfile, updateKundeProfile, type CheckoutSettings } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const kunden = await getAllKunden();
    const kunde = kunden.find((k) => k.lizenzschluessel === session.lizenzschluessel);
    if (!kunde) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const settings: CheckoutSettings = kunde.profile.checkout_settings || {};
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[Checkout Settings GET]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const kunden = await getAllKunden();
    const kunde = kunden.find((k) => k.lizenzschluessel === session.lizenzschluessel);
    if (!kunde) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const body = await req.json();
    const settings: CheckoutSettings = {
      paypal: body.paypal ?? true,
      klarna: body.klarna ?? true,
      visa: body.visa ?? true,
      guarantee: body.guarantee ?? true,
      secureCheckout: body.secureCheckout ?? true,
      cartTimer: body.cartTimer ?? false,
      stickyAtc: body.stickyAtc ?? true,
      crossSell: body.crossSell ?? false,
      accentColor: body.accentColor || "#95BF47",
      bgColor: body.bgColor || "#ffffff",
      font: body.font || "Inter",
    };

    const profile = kunde.profile;
    profile.checkout_settings = settings;
    await updateKundeProfile(kunde.rowIndex, profile);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Checkout Settings POST]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
