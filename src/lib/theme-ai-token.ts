import "server-only";
// ─── Plan-Token: bindet apply an den erstellten Plan (Kosten-Integrität) ────
// Die plan-Route signiert (user, mode, imageCount, ops-Hash, Ablauf) per
// HMAC; die apply-Route akzeptiert Modus/Bildanzahl NUR aus diesem Token.
// Damit kann ein manipulierter Client einen Expert-Plan (Opus, teurer)
// nicht zum Standard-Tarif abrechnen oder imageCount kleinrechnen —
// "nie dem Client glauben" gilt jetzt auch für den Modus.

import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import type { AiOp } from "@/lib/theme-ai-ops";
import type { ThemeAiMode } from "@/lib/theme-ai";

const TTL_MS = 30 * 60 * 1000; // Plan muss binnen 30 Min bestätigt werden

function secret(): string {
  return process.env.SESSION_SECRET || "fallback-password-that-is-at-least-32-characters-long";
}

/** Stabiler Hash über die (server-validierten) Ops — die Re-Validierung in
 *  der apply-Route ist deterministisch identisch, daher matcht der Hash. */
export function hashOps(ops: AiOp[]): string {
  return createHash("sha256").update(JSON.stringify(ops)).digest("base64url").slice(0, 32);
}

export function signPlanToken(user: string, mode: ThemeAiMode, imageCount: number, ops: AiOp[]): string {
  const exp = Date.now() + TTL_MS;
  const payload = [user, mode, String(imageCount), hashOps(ops), String(exp)].join("|");
  const mac = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${mode}.${imageCount}.${exp}.${mac}`;
}

export interface PlanTokenData {
  mode: ThemeAiMode;
  imageCount: number;
}

/** Prüft Token gegen Nutzer + (re-validierte) Ops. null = ungültig/abgelaufen. */
export function verifyPlanToken(token: unknown, user: string, ops: AiOp[]): PlanTokenData | null {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [mode, imgRaw, expRaw, mac] = parts;
  if (mode !== "standard" && mode !== "expert") return null;
  const imageCount = Number(imgRaw);
  const exp = Number(expRaw);
  if (!Number.isInteger(imageCount) || imageCount < 0 || imageCount > 3) return null;
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  const payload = [user, mode, String(imageCount), hashOps(ops), String(exp)].join("|");
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { mode, imageCount };
}
