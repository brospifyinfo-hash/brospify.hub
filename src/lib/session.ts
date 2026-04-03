import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  isLoggedIn: boolean;
  isAdmin: boolean;
  lizenzschluessel?: string;
  sku?: string;
  shopDomain?: string;
  shopifyToken?: string;
  setupStep1Done?: boolean;
  setupStep1Skipped?: boolean;
  setupStep2Done?: boolean;
}

const sessionOptions = {
  password: process.env.SESSION_SECRET || "fallback-password-that-is-at-least-32-characters-long",
  cookieName: "brospify-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
