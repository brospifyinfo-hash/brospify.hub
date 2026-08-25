// ─── Studio-Login (Admin-Bereich der Tattoo-Website) ─────────────
// Bewusst getrennt vom Hub-Login: eigener Cookie-Name, eigenes Secret,
// eigene Session-Form. Der Inhaber des Studios ist NICHT Hub-Kunde und
// soll umgekehrt über diesen Login keinerlei Hub-Rechte bekommen.
//
// Konfiguration (siehe .env.example):
//   TATTOO_ADMIN_PASSWORD  Pflicht — ohne gesetztes Passwort ist der
//                          Admin-Bereich komplett gesperrt (kein
//                          Default-Passwort, kein offener Zugang).
//   TATTOO_SESSION_SECRET  Optional, ≥32 Zeichen; fällt auf
//                          SESSION_SECRET zurück.

import { getIronSession, type IronSession } from "iron-session";
import { cookies, headers } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";

export interface StudioSession {
  isStudioAdmin?: boolean;
  loggedInAt?: number;
}

const TTL = 60 * 60 * 12; // 12 h — ein Arbeitstag, danach neu anmelden.

function sessionOptions() {
  const password =
    process.env.TATTOO_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    "tattoo-studio-fallback-secret-at-least-32-chars";
  return {
    password,
    cookieName: "tattoo-studio-session",
    ttl: TTL,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      maxAge: TTL,
    },
  };
}

export async function getStudioSession(): Promise<IronSession<StudioSession>> {
  const cookieStore = await cookies();
  return getIronSession<StudioSession>(cookieStore, sessionOptions());
}

/** true, wenn der Aufrufer als Studio-Inhaber angemeldet ist. */
export async function isStudioAdmin(): Promise<boolean> {
  const session = await getStudioSession();
  return session.isStudioAdmin === true;
}

/** Ist überhaupt ein Passwort hinterlegt? Ohne → Admin-Bereich zu. */
export function isStudioAdminConfigured(): boolean {
  return Boolean(process.env.TATTOO_ADMIN_PASSWORD);
}

/** Passwortvergleich in konstanter Zeit (kein Rückschluss über die
 *  Antwortzeit auf die Länge/Übereinstimmung des Passworts). */
export function checkStudioPassword(candidate: string): boolean {
  const expected = process.env.TATTOO_ADMIN_PASSWORD;
  if (!expected) return false;
  // sha256 bringt beide Seiten auf dieselbe Länge — timingSafeEqual
  // wirft sonst bei ungleich langen Buffern.
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

// ─── Brute-Force-Bremse ──────────────────────────────────────────
// In-Memory pro Server-Instanz. Kein Ersatz für ein WAF, aber es macht
// Passwort-Raten über HTTP praktisch aussichtslos: nach 8 Fehlversuchen
// ist die IP 15 Minuten gesperrt.
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; firstAt: number }>();

export async function clientKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export function isRateLimited(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function noteFailedAttempt(key: string): void {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: Date.now() });
    return;
  }
  entry.count += 1;
}

export function clearAttempts(key: string): void {
  attempts.delete(key);
}
