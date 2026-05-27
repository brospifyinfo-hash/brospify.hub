import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getLoadTestCreds } from "@/lib/loadtest-creds";
import { listDevStoreProducts } from "@/lib/shopify-graphql";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  return session.isLoggedIn && session.isAdmin;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  const creds = await getLoadTestCreds();
  if (!creds) {
    return NextResponse.json(
      { error: "Dev-Store-Credentials fehlen. Erst unter /admin/loadtest die Konfiguration speichern." },
      { status: 400 },
    );
  }
  try {
    const products = await listDevStoreProducts(creds.domain, creds.token);
    return NextResponse.json({ products });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
