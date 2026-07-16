import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  signEmailLoginToken,
  safeNextPath,
  rateLimit,
  editorAuthSecret,
  generateEmailLoginCode,
  generateCodeId,
  hashEmailLoginCode,
  validateUsername,
  validatePassword,
  hashPassword,
  EMAIL_CODE_TTL_MS,
} from "@/lib/editor-auth";
import { deliverEditorLoginEmail } from "@/lib/email";
import { findKundeByUsername } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// ─── Editor-Login per E-Mail — Schritt 1: Code anfordern ───────────────
// POST { email, next? } → verschickt einen 6-stelligen Bestätigungscode
// (plus Login-Link als Fallback-Button). Der Code-Hash landet in der
// verschlüsselten iron-Session DIESES Browsers — eingeben kann ihn also
// nur, wer die Anfrage gestellt hat. Antwortet IMMER mit ok:true bei
// gültiger E-Mail (kein Konto-Enumeration-Leck: ob die Adresse ein Konto
// hat, wird hier nicht verraten — beim Einlösen entsteht ohnehin
// automatisch ein Gratis-Konto).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function originFrom(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: string; next?: string; username?: string; password?: string;
    };
    const email = (body.email || "").trim().toLowerCase();
    const next = safeNextPath(body.next);

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: "email_invalid" }, { status: 400 });
    }
    if (!editorAuthSecret()) {
      return NextResponse.json({ ok: false, error: "server" }, { status: 503 });
    }

    // Rate-Limit ZUERST — VOR jedem Sheet-Read/scrypt. Sonst könnte ein
    // Angreifer mit rohen Requests unbegrenzt Usernamen enumerieren
    // (username_taken) bzw. teure scrypt-/Sheets-Arbeit erzwingen, bevor
    // das Limit greift. Format-Validierung (billig) läuft zwar davor, der
    // teure Teil (Sheets/Hash) erst danach.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    // Billige Format-Checks der Registrierungsdaten (kein Sheet/kein Hash).
    let username: string | undefined;
    if (body.username !== undefined || body.password !== undefined) {
      const u = validateUsername(body.username || "");
      if (!u) return NextResponse.json({ ok: false, error: "username_invalid" }, { status: 400 });
      if (!validatePassword(body.password)) {
        return NextResponse.json({ ok: false, error: "password_weak" }, { status: 400 });
      }
      username = u;
    }
    if (!rateLimit(`email-req:${email}`, 3, 10 * 60 * 1000) || !rateLimit(`email-ip:${ip}`, 10, 10 * 60 * 1000)) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    // Erst NACH dem Rate-Limit: teurer Sheet-Read (Username-Verfügbarkeit)
    // + scrypt-Hash. Finaler Uniqueness-Check nochmal beim Einlösen.
    let passwordHash: string | undefined;
    if (username) {
      const taken = await findKundeByUsername(username);
      if (taken) return NextResponse.json({ ok: false, error: "username_taken" }, { status: 409 });
      passwordHash = await hashPassword(body.password as string);
    }

    const code = generateEmailLoginCode();
    const codeHash = hashEmailLoginCode(email, code);
    const token = signEmailLoginToken(email, next);
    if (!codeHash || !token) return NextResponse.json({ ok: false, error: "server" }, { status: 503 });

    const loginUrl = `${originFrom(req)}/api/editor-auth/email/callback?token=${encodeURIComponent(token)}`;
    // Zustellung: lokaler Resend-Key ODER Weiterleitung an den Hub-Proxy
    // (die Editor-Website hat keinen eigenen Resend-Key).
    const sent = await deliverEditorLoginEmail({ to: email, code, loginUrl });

    // WICHTIG: Den neuen Code ERST NACH erfolgreichem Versand in die
    // Session schreiben. Sonst würde ein fehlgeschlagener Resend einen
    // bereits zugestellten (alten) Code entwerten, obwohl der Nutzer ihn
    // noch im Postfach hat.
    const commit = async () => {
      const session = await getSession();
      session.editorEmailLogin = {
        email,
        codeHash,
        expiresAt: Date.now() + EMAIL_CODE_TTL_MS,
        codeId: generateCodeId(),
        username,
        passwordHash,
      };
      await session.save();
    };

    // Lokal/ohne Resend-Key: Code+Link im Dev-Modus zurückgeben, damit der
    // Flow testbar bleibt (niemals in Produktion).
    if (!sent.sent) {
      if (process.env.NODE_ENV !== "production") {
        await commit();
        console.warn("[editor-auth/email] Versand übersprungen — Dev-Code:", code, "Link:", loginUrl);
        return NextResponse.json({ ok: true, devCode: code, devUrl: loginUrl });
      }
      return NextResponse.json({ ok: false, error: "send_failed" }, { status: 502 });
    }

    await commit();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[editor-auth/email] request error:", err);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
