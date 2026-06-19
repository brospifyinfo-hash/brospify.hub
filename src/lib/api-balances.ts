// ─── API-Provider-Guthaben (shared) ─────────────────────────────
// Fragt jeden Upstream-Provider parallel nach dem aktuellen Konto-Stand
// und liefert einen normalisierten Report. Wird von /api/admin/api-balances
// (Admin-Ansicht) UND vom Alert-Cron (/api/cron/check-api-balances) genutzt.
//
// Status-Schwellen (farbige Badges + Mail-Alerts):
//   ok      genug Guthaben
//   low     wird knapp → frühzeitig aufladen
//   empty   praktisch leer → Tool fällt aus
//   unknown nicht ermittelbar (Token fehlt / API down)

export type BalanceStatus = "ok" | "low" | "empty" | "unknown" | "not-configured";

export type ProviderKey =
  | "apify"
  | "deepseek"
  | "fal"
  | "replicate"
  | "anthropic"
  | "tavily"
  | "resend";

export interface ProviderBalance {
  provider: ProviderKey;
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

// ─── Apify (Video Scout) ─────────────────────────────────────────
// GET /v2/users/me/limits → limits.maxMonthlyUsageUsd + current.monthlyUsageUsd.
// Auf dem FREE-Plan sind das 5 $/Monat. Wir melden das verbleibende
// Monats-Budget; Schwelle relativ (warnt früh, skaliert mit dem Plan).
async function checkApify(): Promise<ProviderBalance> {
  const key = process.env.APIFY_API_TOKEN;
  const label = "Apify (Video Scout)";
  if (!key) {
    return { provider: "apify", label, configured: false, status: "not-configured" };
  }
  try {
    const res = await fetch(
      `https://api.apify.com/v2/users/me/limits?token=${encodeURIComponent(key)}`,
      { cache: "no-store" },
    );
    if (res.status === 401 || res.status === 403) {
      return { provider: "apify", label, configured: true, status: "unknown", error: `Unauthorized (${res.status}) — Token prüfen.` };
    }
    if (!res.ok) {
      const t = await res.text();
      return { provider: "apify", label, configured: true, status: "unknown", error: `${res.status}: ${t.slice(0, 100)}` };
    }
    const data = await res.json();
    const d = data?.data ?? {};
    const maxUsd = Number(d?.limits?.maxMonthlyUsageUsd);
    const usedUsd = Number(d?.current?.monthlyUsageUsd);
    if (Number.isFinite(maxUsd) && maxUsd > 0 && Number.isFinite(usedUsd)) {
      const remainingUsd = Math.max(0, maxUsd - usedUsd);
      const ratio = remainingUsd / maxUsd;
      const status: BalanceStatus = ratio < 0.1 ? "empty" : ratio < 0.3 ? "low" : "ok";
      const cycleEnd = d?.monthlyUsageCycle?.endAt
        ? new Date(d.monthlyUsageCycle.endAt).toLocaleDateString("de-DE")
        : "";
      return {
        provider: "apify",
        label,
        configured: true,
        status,
        balanceUsd: +remainingUsd.toFixed(2),
        balanceEur: eur(remainingUsd),
        raw: `${remainingUsd.toFixed(2)} $ von ${maxUsd.toFixed(2)} $ Monats-Budget übrig${cycleEnd ? ` · Reset ${cycleEnd}` : ""}`,
        endpoint: "/users/me/limits",
      };
    }
    return { provider: "apify", label, configured: true, status: "ok", raw: "Token gültig — Budget/Usage nicht lesbar." };
  } catch (err) {
    return { provider: "apify", label, configured: true, status: "unknown", error: err instanceof Error ? err.message.slice(0, 100) : "Netzwerkfehler" };
  }
}

// ─── DeepSeek ───────────────────────────────────────────────────
// GET https://api.deepseek.com/user/balance → { balance_infos: [{ currency, total_balance }] }
async function checkDeepSeek(): Promise<ProviderBalance> {
  const key = process.env.DEEPSEEK_API_KEY;
  const label = "DeepSeek (E-Mail / Blog / Chat)";
  if (!key) return { provider: "deepseek", label, configured: false, status: "not-configured" };
  try {
    const res = await fetch("https://api.deepseek.com/user/balance", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      return { provider: "deepseek", label, configured: true, status: "unknown", error: `${res.status}: ${text.slice(0, 100)}`, endpoint: "/user/balance" };
    }
    const data = await res.json();
    const usdInfo = (data.balance_infos || []).find((b: { currency?: string }) => b.currency === "USD") ?? data.balance_infos?.[0];
    const balanceUsd = parseFloat(usdInfo?.total_balance ?? "0");
    const balanceEur = eur(balanceUsd);
    return { provider: "deepseek", label, configured: true, status: statusFromEur(balanceEur), balanceUsd: +balanceUsd.toFixed(2), balanceEur, endpoint: "/user/balance" };
  } catch (err) {
    return { provider: "deepseek", label, configured: true, status: "unknown", error: err instanceof Error ? err.message.slice(0, 100) : "Netzwerkfehler" };
  }
}

// ─── Fal.ai ─────────────────────────────────────────────────────
async function checkFal(): Promise<ProviderBalance> {
  const key = process.env.FAL_KEY;
  const label = "Fal.ai (BG / AI Studio)";
  if (!key) return { provider: "fal", label, configured: false, status: "not-configured" };
  return { provider: "fal", label, configured: true, status: "ok", raw: "Fal hat keinen öffentlichen Balance-Endpoint. Status = Token konfiguriert." };
}

// ─── Replicate ──────────────────────────────────────────────────
async function checkReplicate(): Promise<ProviderBalance> {
  const key = process.env.REPLICATE_API_TOKEN;
  const label = "Replicate (Upscaler)";
  if (!key) return { provider: "replicate", label, configured: false, status: "not-configured" };
  try {
    const res = await fetch("https://api.replicate.com/v1/account", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return { provider: "replicate", label, configured: true, status: "unknown", error: `${res.status}` };
    const data = await res.json();
    return { provider: "replicate", label, configured: true, status: "ok", raw: `Account ${data.username || "ok"} — kein öffentlicher Balance-Endpoint, aber Token gültig.` };
  } catch (err) {
    return { provider: "replicate", label, configured: true, status: "unknown", error: err instanceof Error ? err.message.slice(0, 100) : "Netzwerkfehler" };
  }
}

// ─── Anthropic (Claude) ─────────────────────────────────────────
// Kein Balance-Endpoint — 1-Token-Testcall: 402/429 = leer/Limit.
async function checkAnthropic(): Promise<ProviderBalance> {
  const key = process.env.ANTHROPIC_API_KEY;
  const label = "Anthropic (Charts + Video Scout)";
  if (!key) return { provider: "anthropic", label, configured: false, status: "not-configured" };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 1, messages: [{ role: "user", content: "1" }] }),
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) return { provider: "anthropic", label, configured: true, status: "unknown", error: `Unauthorized (${res.status}) — Token prüfen.` };
    if (res.status === 402 || res.status === 429) return { provider: "anthropic", label, configured: true, status: "empty", error: `Quota erschöpft oder Rate-Limit (${res.status}).` };
    if (!res.ok) {
      const txt = await res.text();
      return { provider: "anthropic", label, configured: true, status: "unknown", error: `${res.status}: ${txt.slice(0, 100)}` };
    }
    return { provider: "anthropic", label, configured: true, status: "ok", raw: "Kein Balance-Endpoint, aber Token gültig und Antworten kommen (kein 402)." };
  } catch (err) {
    return { provider: "anthropic", label, configured: true, status: "unknown", error: err instanceof Error ? err.message.slice(0, 100) : "Netzwerkfehler" };
  }
}

// ─── Tavily ─────────────────────────────────────────────────────
// GET https://api.tavily.com/usage → monatliche Quota (requests_left).
async function checkTavily(): Promise<ProviderBalance> {
  const key = process.env.TAVILY_API_KEY;
  const label = "Tavily (Web-Suche)";
  if (!key) return { provider: "tavily", label, configured: false, status: "not-configured" };
  try {
    const res = await fetch("https://api.tavily.com/usage", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const test = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: "ping", max_results: 1 }),
        cache: "no-store",
      });
      if (test.status === 401 || test.status === 403) return { provider: "tavily", label, configured: true, status: "unknown", error: "Unauthorized — Token prüfen." };
      if (test.status === 402 || test.status === 429) return { provider: "tavily", label, configured: true, status: "empty", error: "Quota erschöpft." };
      return { provider: "tavily", label, configured: true, status: "ok", raw: "/usage nicht erreichbar, aber /search funktioniert." };
    }
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const data: any = await res.json();
    const left = Number(data?.requests_left ?? data?.remaining ?? 0);
    const total = Number(data?.requests_limit ?? data?.limit ?? 0);
    /* eslint-enable @typescript-eslint/no-explicit-any */
    const status: BalanceStatus = left <= 0 ? "empty" : left < 100 ? "low" : "ok";
    return {
      provider: "tavily",
      label,
      configured: true,
      status,
      raw: total
        ? `${left.toLocaleString("de-DE")} von ${total.toLocaleString("de-DE")} Requests übrig.`
        : `${left.toLocaleString("de-DE")} Requests übrig.`,
      endpoint: "/usage",
    };
  } catch (err) {
    return { provider: "tavily", label, configured: true, status: "unknown", error: err instanceof Error ? err.message.slice(0, 100) : "Netzwerkfehler" };
  }
}

// ─── Resend (E-Mail) ────────────────────────────────────────────
async function checkResend(): Promise<ProviderBalance> {
  const key = process.env.RESEND_API_KEY;
  const label = "Resend (E-Mails)";
  if (!key) return { provider: "resend", label, configured: false, status: "not-configured" };
  try {
    const res = await fetch("https://api.resend.com/api-keys", {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) return { provider: "resend", label, configured: true, status: "unknown", error: "Unauthorized — Token prüfen." };
    return { provider: "resend", label, configured: true, status: "ok", raw: "Kein öffentlicher Balance-Endpoint, aber Token gültig." };
  } catch (err) {
    return { provider: "resend", label, configured: true, status: "unknown", error: err instanceof Error ? err.message.slice(0, 100) : "Netzwerkfehler" };
  }
}

/** Alle Provider parallel prüfen. Reihenfolge: erst die mit echtem,
 *  messbarem Guthaben (Apify/DeepSeek/Tavily), dann der Rest. */
export async function checkAllBalances(): Promise<ProviderBalance[]> {
  const [apify, deepseek, tavily, anthropic, fal, replicate, resend] = await Promise.all([
    checkApify(),
    checkDeepSeek(),
    checkTavily(),
    checkAnthropic(),
    checkFal(),
    checkReplicate(),
    checkResend(),
  ]);
  return [apify, deepseek, tavily, anthropic, fal, replicate, resend];
}
