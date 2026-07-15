import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { sendEditorLoginEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Mail-Proxy für die Standalone-Editor-Website ──────────────────────
// Läuft im HUB-Deployment, wo der Resend-Key liegt (als „sensitive"-Env
// ist er nur dort verfügbar). Die Editor-Website (eigenes Vercel-Projekt
// OHNE Resend-Key) ruft diesen Endpoint auf, um Login-Code-Mails zu
// verschicken. Auth per Shared-Secret (EDITOR_MAIL_SECRET, in beiden
// Projekten identisch), timing-sicher verglichen. Reiner Mailer — kein
// Konten-/Session-/Sheets-Bezug, keine Enumeration (antwortet nur ok/nok).

function secretOk(provided: string, expected: string): boolean {
  if (!expected || provided.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const expected = (process.env.EDITOR_MAIL_SECRET || "").trim();
  if (!expected) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });

  const provided = (req.headers.get("x-editor-mail-secret") || "").trim();
  if (!secretOk(provided, expected)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { to?: string; code?: string; loginUrl?: string };
  const to = (body.to || "").trim();
  const code = (body.code || "").trim();
  const loginUrl = (body.loginUrl || "").trim();
  if (!to || !code || !loginUrl) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const sent = await sendEditorLoginEmail({ to, code, loginUrl });
  return NextResponse.json({ ok: sent.sent, error: sent.error, id: sent.id });
}
