// ─── Editor-Login: gemeinsame Auth-Bausteine (server-only) ──────────────
// Wird von den /api/editor-auth/*-Routen genutzt:
//  - Shop-Domain-Normalisierung/-Validierung (Shopify-Login)
//  - Shopify-Query-HMAC (Callback-Signatur)
//  - signierte, zeitlich begrenzte E-Mail-Login-Tokens (Magic Link)
//  - iron-Session aus einem Kunde-Row befüllen (wie der Google-Callback)
//  - Open-Redirect-Schutz für ?next=…

import crypto from "node:crypto";
import type { IronSession } from "iron-session";
import { applySessionLifetime, type SessionData } from "@/lib/session";
import type { Kunde } from "@/lib/sheets";

// ── Secret für Token-Signaturen ─────────────────────────────────────
// Fällt bewusst NICHT auf einen hartkodierten Wert zurück: ohne echtes
// Secret werden in Produktion keine Login-Links ausgestellt (fail closed).
export function editorAuthSecret(): string | null {
  const s =
    (process.env.AUTH_SECRET || "").trim() ||
    (process.env.NEXTAUTH_SECRET || "").trim() ||
    (process.env.SESSION_SECRET || "").trim();
  if (s) return s;
  if (process.env.NODE_ENV !== "production") {
    console.warn("[editor-auth] Kein AUTH_SECRET/SESSION_SECRET gesetzt — Dev-Fallback aktiv.");
    return "dev-only-editor-auth-secret-not-for-production";
  }
  return null;
}

// ── Redirect-Ziel absichern (nur interne absolute Pfade) ────────────
export function safeNextPath(raw: string | null | undefined, fallback = "/editor"): string {
  const v = (raw || "").trim();
  return /^\/(?![/\\])/.test(v) ? v : fallback;
}

// ── Shopify: Shop-Domain normalisieren + validieren ─────────────────
// Akzeptiert "mein-shop", "mein-shop.myshopify.com" oder eine volle URL
// und liefert immer die kanonische *.myshopify.com-Domain (lowercase).
export function normalizeShopDomain(raw: string): string | null {
  let v = (raw || "").trim().toLowerCase();
  if (!v) return null;
  v = v.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!v.includes(".")) v = `${v}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(v) ? v : null;
}

// ── Shopify: Query-HMAC des OAuth-Callbacks prüfen ──────────────────
// Spec: alle Params außer hmac/signature alphabetisch sortiert als k=v
// joinen, HMAC-SHA256 (hex) mit dem App-Secret, timing-safe vergleichen.
export function verifyShopifyQueryHmac(searchParams: URLSearchParams, clientSecret: string): boolean {
  const hmac = searchParams.get("hmac") || "";
  if (!hmac) return false;
  const pairs: [string, string][] = [];
  for (const [k, v] of searchParams.entries()) {
    if (k === "hmac" || k === "signature") continue;
    pairs.push([k, v]);
  }
  pairs.sort(([a], [b]) => a.localeCompare(b));
  const message = pairs.map(([k, v]) => `${k}=${v}`).join("&");
  const digest = crypto.createHmac("sha256", clientSecret).update(message).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(hmac, "hex"));
  } catch {
    return false;
  }
}

// ── E-Mail-Login-Code (OTP) ─────────────────────────────────────────
// Der 6-stellige Code wird NICHT serverseitig gespeichert (Serverless!),
// sondern als HMAC-Hash in der verschlüsselten iron-Session des Browsers
// abgelegt, der ihn angefordert hat. Verifiziert wird timing-sicher;
// Brute-Force scheitert an EMAIL_CODE_MAX_ATTEMPTS + kurzer TTL.
export const EMAIL_CODE_TTL_MS = 15 * 60 * 1000;
export const EMAIL_CODE_MAX_ATTEMPTS = 5;

export function generateEmailLoginCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

// Jeder ausgestellte Code bekommt eine zufällige, nicht erratbare ID. Sie
// bindet den Code an einen SERVERSEITIGEN Fehlversuch-Zähler (unten) —
// nicht an den mitgeschickten Cookie. Damit bringt es dem Angreifer
// nichts, einen frischen attempts:0-Cookie erneut abzuspielen: der Zähler
// lebt hier im Speicher und steigt bei jedem Versuch weiter.
export function generateCodeId(): string {
  return crypto.randomBytes(16).toString("hex");
}

// Fehlversuch-Zähler pro Code-ID (best effort, prozesslokal — auf Vercel
// pro Lambda-Instanz; zusammen mit dem Per-IP-Limit auf /verify deckelt
// das den Rate-Durchsatz massiv, ohne externen Store).
const codeAttempts = new Map<string, { count: number; resetAt: number }>();

/** Zählt einen Verify-Versuch für diese Code-ID und liefert die neue
 *  Gesamtzahl belegter Versuche. */
export function bumpCodeAttempt(codeId: string): number {
  const now = Date.now();
  const b = codeAttempts.get(codeId);
  if (!b || now > b.resetAt) {
    codeAttempts.set(codeId, { count: 1, resetAt: now + EMAIL_CODE_TTL_MS });
    return 1;
  }
  b.count += 1;
  return b.count;
}

export function clearCodeAttempts(codeId: string): void {
  codeAttempts.delete(codeId);
}

/** HMAC über E-Mail UND Code — der Hash gilt nur für genau diese Adresse. */
export function hashEmailLoginCode(email: string, code: string): string | null {
  const secret = editorAuthSecret();
  if (!secret) return null;
  return b64url(
    crypto.createHmac("sha256", secret).update(`otp:${email.trim().toLowerCase()}:${code}`).digest(),
  );
}

export function verifyEmailLoginCodeHash(email: string, code: string, expectedHash: string): boolean {
  const actual = hashEmailLoginCode(email, code);
  if (!actual) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expectedHash));
  } catch {
    return false;
  }
}

// ── E-Mail-Login-Token (Magic Link — Fallback-Button in der Mail) ───
// Stateless: base64url(JSON{e-mail, exp, next}) + "." + HMAC. Kurze
// Lebensdauer (15 min). Ohne Server-Store ist ein Link innerhalb der
// TTL mehrfach nutzbar — bewusster Trade-off, loggt nur denselben
// Nutzer erneut ein.
const EMAIL_TOKEN_TTL_MS = 15 * 60 * 1000;

interface EmailTokenPayload {
  e: string;
  x: number;
  n: string;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function signEmailLoginToken(email: string, next: string): string | null {
  const secret = editorAuthSecret();
  if (!secret) return null;
  const payload: EmailTokenPayload = {
    e: email.trim().toLowerCase(),
    x: Date.now() + EMAIL_TOKEN_TTL_MS,
    n: safeNextPath(next),
  };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const mac = b64url(crypto.createHmac("sha256", secret).update(body).digest());
  return `${body}.${mac}`;
}

export function verifyEmailLoginToken(token: string): { email: string; next: string } | null {
  const secret = editorAuthSecret();
  if (!secret) return null;
  const [body, mac] = (token || "").split(".");
  if (!body || !mac) return null;
  const expected = b64url(crypto.createHmac("sha256", secret).update(body).digest());
  try {
    if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as EmailTokenPayload;
    if (!payload.e || !Number.isFinite(payload.x) || Date.now() > payload.x) return null;
    return { email: payload.e, next: safeNextPath(payload.n) };
  } catch {
    return null;
  }
}

// ── Session aus einem Kunde-Row befüllen ────────────────────────────
// Spiegelt exakt die Feld-Belegung des Google-Callbacks (auth/login),
// damit alle API-Routen (Credits, Theme-AI, Export, Uploads) das Konto
// identisch behandeln — egal über welchen Provider es angemeldet ist.
export function applyKundeToSession(
  session: IronSession<SessionData>,
  kunde: Kunde,
  opts?: { googleName?: string; googleEmail?: string; googleImage?: string },
): void {
  session.isLoggedIn = true;
  session.isAdmin = kunde.profile.role === "admin";
  session.lizenzschluessel = kunde.lizenzschluessel;
  session.sku = kunde.sku;
  session.shopDomain = kunde.shopDomain || undefined;
  session.shopifyToken = kunde.shopifyToken || undefined;
  session.setupStep1Done = !!kunde.shopifyToken;
  session.setupStep2Done = false;
  session.googleName = opts?.googleName || kunde.profile.displayName || undefined;
  session.googleEmail = opts?.googleEmail || kunde.kundenEmail || undefined;
  session.googleImage = opts?.googleImage || undefined;
  session.rememberMe = true;
  applySessionLifetime(session, true);
  if (kunde.shopifyToken) {
    session.hasShopifyConnection = true;
    session.onboardingDone = true;
  }
}

// ── Sehr einfacher In-Memory-Rate-Limiter ───────────────────────────
// Best effort (pro Serverless-Instanz): schützt den Mail-Versand vor
// Schleifen/Abuse. Kein Ersatz für echtes Rate-Limiting, aber deutlich
// besser als nichts — und ohne externe Abhängigkeit.
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}
