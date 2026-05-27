import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAdminSetting, setAdminSetting } from "@/lib/sheets";
import { assertDevStoreDomain } from "@/lib/shopify-graphql";
import { LOADTEST_KEY_DOMAIN as KEY_DOMAIN, LOADTEST_KEY_TOKEN as KEY_TOKEN } from "@/lib/loadtest-creds";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  return session.isLoggedIn && session.isAdmin;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  const domain = await getAdminSetting(KEY_DOMAIN);
  const token = await getAdminSetting(KEY_TOKEN);
  return NextResponse.json({
    domain: domain || "",
    // Never echo the full token — only confirm presence and last 4
    // so the admin can verify which credential is wired.
    tokenSet: !!token,
    tokenSuffix: token ? token.slice(-4) : "",
  });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const rawDomain = String(body.domain || "");
    const token = String(body.token || "").trim();
    const clean = assertDevStoreDomain(rawDomain);
    if (!token) {
      return NextResponse.json({ error: "Token fehlt." }, { status: 400 });
    }
    if (!token.startsWith("shpat_") && !token.startsWith("shpca_") && !token.startsWith("shppa_")) {
      return NextResponse.json(
        {
          error: "Token sieht nicht nach einem Shopify Admin Access Token aus (erwartet shpat_/shpca_/shppa_ prefix).",
        },
        { status: 400 },
      );
    }
    await setAdminSetting(KEY_DOMAIN, clean);
    await setAdminSetting(KEY_TOKEN, token);
    return NextResponse.json({ ok: true, domain: clean, tokenSuffix: token.slice(-4) });
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
  await setAdminSetting(KEY_DOMAIN, "");
  await setAdminSetting(KEY_TOKEN, "");
  return NextResponse.json({ ok: true });
}
