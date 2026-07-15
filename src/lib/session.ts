import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  isLoggedIn: boolean;
  isAdmin: boolean;
  lizenzschluessel?: string;
  sku?: string;
  shopDomain?: string;
  shopifyToken?: string;
  customerClientId?: string;
  customerClientSecret?: string;
  oauthNonce?: string;
  /** Offener E-Mail-Login-Code des Editor-Logins (OTP). Liegt in der
   *  verschlüsselten Session (bindet den Code an GENAU diesen Browser);
   *  gespeichert wird nur der HMAC-Hash, nie der Code selbst. Der
   *  Fehlversuch-Zähler liegt bewusst NICHT hier, sondern serverseitig
   *  (editor-auth.ts, keyed per codeId) — sonst ließe er sich durch
   *  erneutes Abspielen eines attempts:0-Cookies umgehen. */
  editorEmailLogin?: {
    email: string;
    codeHash: string;
    expiresAt: number;
    codeId: string;
  };
  hasShopifyConnection?: boolean;
  onboardingDone?: boolean;
  setupStep1Done?: boolean;
  setupStep1Skipped?: boolean;
  setupStep2Done?: boolean;
  googleName?: string;
  googleEmail?: string;
  googleImage?: string;
  /** „Angemeldet bleiben". true = persistentes Cookie (30 Tage), das den
   *  Browser-Neustart überlebt. false/undefined = Session-Cookie, das beim
   *  Schließen des Browsers gelöscht wird. Wird in den Login-Routen gesetzt
   *  und bei JEDEM getSession() erneut angewandt, damit spätere save()-Aufrufe
   *  die Lebensdauer nicht versehentlich zurücksetzen. */
  rememberMe?: boolean;
  // ── Impersonation ─────────────────────────────────────────────
  // When an admin impersonates a customer we save the original admin
  // session here so /api/admin/impersonate/exit can restore it
  // without a fresh login. `originalSession` is a JSON-serialised
  // SessionData snapshot (sans this field, to avoid recursion).
  impersonatedBy?: string;
  originalSession?: string;
}

// 30 Tage (in Sekunden) für „angemeldet bleiben".
export const REMEMBER_TTL = 60 * 60 * 24 * 30;

const sessionOptions = {
  password: process.env.SESSION_SECRET || "fallback-password-that-is-at-least-32-characters-long",
  cookieName: "brospify-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
  },
};

// Wendet die „angemeldet bleiben"-Wahl auf die Cookie-Lebensdauer an.
//   remember = true  → ttl 30 Tage + cookie maxAge 30 Tage (persistent)
//   remember = false → ttl 0 (keine Seal-Expiry) + maxAge undefined
//                      → Session-Cookie, weg beim Browser-Schließen
// `updateConfig` (iron-session v8) sorgt dafür, dass das nächste save()
// diese Optionen verwendet.
export function applySessionLifetime(
  session: IronSession<SessionData>,
  remember: boolean
): void {
  session.updateConfig({
    ...sessionOptions,
    ttl: remember ? REMEMBER_TTL : 0,
    cookieOptions: {
      ...sessionOptions.cookieOptions,
      maxAge: remember ? REMEMBER_TTL : undefined,
    },
  });
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  // Die zuvor getroffene „angemeldet bleiben"-Wahl bei jedem Lesen erneut
  // anwenden, damit ein späteres save() (z. B. in anderen Routen) die
  // Cookie-Lebensdauer nicht auf den Default zurücksetzt.
  applySessionLifetime(session, session.rememberMe ?? false);
  return session;
}
