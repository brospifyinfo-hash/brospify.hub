import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  createLoadTestSession,
  listLoadTestSessions,
  type LoadTestMode,
} from "@/lib/sheets";
import { getLoadTestCreds } from "@/lib/loadtest-creds";
import { assertDevStoreDomain } from "@/lib/shopify-graphql";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  return session.isLoggedIn && session.isAdmin
    ? session
    : null;
}

const VALID_MODES: LoadTestMode[] = ["subsecond", "secondly", "burst", "mixed"];
// Hard ceiling — a dev store burned for two straight hours is still a
// dev store, but anything longer almost certainly means the admin
// forgot to stop a run. Tweak in code if you need overnight tests.
const MAX_DURATION_MINUTES = 120;

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const sessions = await listLoadTestSessions();
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const creds = await getLoadTestCreds();
  if (!creds) {
    return NextResponse.json(
      { error: "Dev-Store-Credentials fehlen. Erst unter /admin/loadtest die Konfiguration speichern." },
      { status: 400 },
    );
  }

  try {
    const body = await req.json();
    const productId = String(body.productId || "").trim();
    const variantId = String(body.variantId || "").trim();
    const productTitle = String(body.productTitle || "").trim() || "Produkt";
    const unitPrice = String(body.unitPrice || "1.00").trim();
    const durationMinutes = Math.max(1, Math.min(MAX_DURATION_MINUTES, Number.parseFloat(body.durationMinutes) || 0));
    const mode = (VALID_MODES.includes(body.mode) ? body.mode : "mixed") as LoadTestMode;
    if (!productId || !variantId) {
      return NextResponse.json({ error: "productId und variantId sind erforderlich." }, { status: 400 });
    }
    if (!variantId.startsWith("gid://shopify/ProductVariant/")) {
      return NextResponse.json({ error: "variantId muss eine Shopify GID sein (gid://shopify/ProductVariant/...)." }, { status: 400 });
    }
    // Re-validate domain — paranoid, but cheap.
    assertDevStoreDomain(creds.domain);

    const id = `lt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = new Date().toISOString();
    const endsAt = new Date(Date.now() + durationMinutes * 60_000).toISOString();
    const tag = `loadtest-${id}`;

    const row = await createLoadTestSession({
      id,
      productId,
      productTitle,
      variantId,
      unitPrice,
      durationMinutes,
      mode,
      devStoreDomain: creds.domain,
      tag,
      startedAt,
      endsAt,
      status: "running",
      createdBy: session.googleEmail || session.lizenzschluessel || "admin",
    });

    return NextResponse.json({ session: row });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Konnte Session nicht anlegen" },
      { status: 400 },
    );
  }
}
