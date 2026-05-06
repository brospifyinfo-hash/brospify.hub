// ─── /api/admin/api-balances ────────────────────────────────────
// Reaches out to each upstream AI provider in parallel and asks
// for the current account balance, then returns a normalised
// per-provider report. Only providers with reachable public balance
// endpoints are queried; the rest are reported as "no public API"
// so the admin still sees that the key is configured.
//
// Status thresholds (colored badges in the UI):
//   ok      ≥ €5
//   low     €1 ≤ x < €5
//   empty   < €1
//   unknown couldn't determine balance (token missing, API down)

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type BalanceStatus = "ok" | "low" | "empty" | "unknown" | "not-configured";

interface ProviderBalance {
  provider: "deepseek" | "fal" | "replicate";
  label: string;
  configured: boolean;
  status: BalanceStatus;
  balanceUsd?: number;
  balanceEur?: number;
  raw?: string;
  error?: string;
  endpoint?: string;
}

const USD_TO_EUR = 0.93;
const eur = (usd: number) => +(usd * USD_TO_EUR).toFixed(2);

function statusFromEur(eurBalance: number): BalanceStatus {
  if (eurBalance < 1) return "empty";
  if (eurBalance < 5) return "low";
  return "ok";
}

// ─── DeepSeek ───────────────────────────────────────────────────
// Public endpoint: GET https://api.deepseek.com/user/balance
// Returns { balance_infos: [{ currency: "USD", total_balance, granted_balance, topped_up_balance }] }
async function checkDeepSeek(): Promise<ProviderBalance> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    return {
      provider: "deepseek",
      label: "DeepSeek (E-Mail / Blog / Chat)",
      configured: false,
      status: "not-configured",
    };
  }
  try {
    const res = await fetch("https://api.deepseek.com/user/balance", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        provider: "deepseek",
        label: "DeepSeek (E-Mail / Blog / Chat)",
        configured: true,
        status: "unknown",
        error: `${res.status}: ${text.slice(0, 100)}`,
        endpoint: "/user/balance",
      };
    }
    const data = await res.json();
    const usdInfo = (data.balance_infos || []).find((b: { currency?: string }) => b.currency === "USD")
      ?? data.balance_infos?.[0];
    const balanceUsd = parseFloat(usdInfo?.total_balance ?? "0");
    const balanceEur = eur(balanceUsd);
    return {
      provider: "deepseek",
      label: "DeepSeek (E-Mail / Blog / Chat)",
      configured: true,
      status: statusFromEur(balanceEur),
      balanceUsd: +balanceUsd.toFixed(2),
      balanceEur,
      endpoint: "/user/balance",
    };
  } catch (err) {
    return {
      provider: "deepseek",
      label: "DeepSeek (E-Mail / Blog / Chat)",
      configured: true,
      status: "unknown",
      error: err instanceof Error ? err.message.slice(0, 100) : "Netzwerkfehler",
    };
  }
}

// ─── Fal.ai ─────────────────────────────────────────────────────
// No public balance endpoint. We report "configured" only.
// Could be extended to ping a tiny model and detect 402 errors.
async function checkFal(): Promise<ProviderBalance> {
  const key = process.env.FAL_KEY;
  if (!key) {
    return {
      provider: "fal",
      label: "Fal.ai (BG / AI Studio)",
      configured: false,
      status: "not-configured",
    };
  }
  return {
    provider: "fal",
    label: "Fal.ai (BG / AI Studio)",
    configured: true,
    status: "ok",
    raw: "Fal hat keinen öffentlichen Balance-Endpoint. Status = Token konfiguriert.",
  };
}

// ─── Replicate ──────────────────────────────────────────────────
// GET https://api.replicate.com/v1/account works but doesn't return
// a balance. We just verify the token is valid.
async function checkReplicate(): Promise<ProviderBalance> {
  const key = process.env.REPLICATE_API_TOKEN;
  if (!key) {
    return {
      provider: "replicate",
      label: "Replicate (Upscaler)",
      configured: false,
      status: "not-configured",
    };
  }
  try {
    const res = await fetch("https://api.replicate.com/v1/account", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        provider: "replicate",
        label: "Replicate (Upscaler)",
        configured: true,
        status: "unknown",
        error: `${res.status}`,
      };
    }
    const data = await res.json();
    return {
      provider: "replicate",
      label: "Replicate (Upscaler)",
      configured: true,
      status: "ok",
      raw: `Account ${data.username || "ok"} — Replicate hat keinen öffentlichen Balance-Endpoint, aber Token ist gültig.`,
    };
  } catch (err) {
    return {
      provider: "replicate",
      label: "Replicate (Upscaler)",
      configured: true,
      status: "unknown",
      error: err instanceof Error ? err.message.slice(0, 100) : "Netzwerkfehler",
    };
  }
}

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  const [deepseek, fal, replicate] = await Promise.all([
    checkDeepSeek(),
    checkFal(),
    checkReplicate(),
  ]);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    providers: [deepseek, fal, replicate],
  });
}
