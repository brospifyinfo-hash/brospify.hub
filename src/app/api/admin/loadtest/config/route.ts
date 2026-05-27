import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAdminSetting, setAdminSetting } from "@/lib/sheets";
import { assertDevStoreDomain, verifyDevStore } from "@/lib/shopify-graphql";
import {
  LOADTEST_KEY_DOMAIN,
  LOADTEST_KEY_TOKEN,
  LOADTEST_KEY_CLIENT_ID,
  LOADTEST_KEY_CLIENT_SECRET,
} from "@/lib/loadtest-creds";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  return session.isLoggedIn && session.isAdmin;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  const domain = await getAdminSetting(LOADTEST_KEY_DOMAIN);
  const token = await getAdminSetting(LOADTEST_KEY_TOKEN);
  const clientId = await getAdminSetting(LOADTEST_KEY_CLIENT_ID);
  const clientSecret = await getAdminSetting(LOADTEST_KEY_CLIENT_SECRET);
  return NextResponse.json({
    domain: domain || "",
    // Never echo full secrets. Only signal presence + last 4.
    tokenSet: !!token,
    tokenSuffix: token ? token.slice(-4) : "",
    clientIdSet: !!clientId,
    clientIdSuffix: clientId ? clientId.slice(-4) : "",
    clientSecretSet: !!clientSecret,
  });
}

// POST accepts any subset of:
//   { domain, clientId, clientSecret }   — OAuth setup, no per-shop token yet
//   { domain, token }                    — manual `shpat_` paste (legacy)
//
// Token paste path runs the Shop.plan.partnerDevelopment guard so a
// stray production credential can't slip in. OAuth path runs the same
// guard inside the /oauth/callback route after the token is minted.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const rawDomain = String(body.domain || "").trim();
    const token = String(body.token || "").trim();
    const clientId = String(body.clientId || "").trim();
    const clientSecret = String(body.clientSecret || "").trim();

    // Domain is required for any save path.
    const clean = assertDevStoreDomain(rawDomain);
    await setAdminSetting(LOADTEST_KEY_DOMAIN, clean);

    if (clientId) await setAdminSetting(LOADTEST_KEY_CLIENT_ID, clientId);
    if (clientSecret) await setAdminSetting(LOADTEST_KEY_CLIENT_SECRET, clientSecret);

    // Manual token path → verify against Shopify and reject prod.
    if (token) {
      const verdict = await verifyDevStore(clean, token);
      if (!verdict.ok) {
        return NextResponse.json(
          {
            error: verdict.error || "Shop-Verifikation fehlgeschlagen.",
            shopName: verdict.shopName,
            planName: verdict.planName,
            isDevStore: verdict.isDevStore,
          },
          { status: 403 },
        );
      }
      await setAdminSetting(LOADTEST_KEY_TOKEN, token);
      return NextResponse.json({
        ok: true,
        domain: clean,
        tokenSuffix: token.slice(-4),
        shopName: verdict.shopName,
        planName: verdict.planName,
      });
    }

    // OAuth setup path → caller will follow up with a redirect to
    // /api/admin/loadtest/oauth/start
    return NextResponse.json({
      ok: true,
      domain: clean,
      needsOauth: !!clientId && !!clientSecret,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Speichern fehlgeschlagen" },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  await setAdminSetting(LOADTEST_KEY_DOMAIN, "");
  await setAdminSetting(LOADTEST_KEY_TOKEN, "");
  await setAdminSetting(LOADTEST_KEY_CLIENT_ID, "");
  await setAdminSetting(LOADTEST_KEY_CLIENT_SECRET, "");
  return NextResponse.json({ ok: true });
}
