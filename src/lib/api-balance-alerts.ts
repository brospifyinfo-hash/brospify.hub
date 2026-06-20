// ─── API-Guthaben-Alert (geteilte Logik) ─────────────────────────
// Prüft alle Provider und mailt an brospify.info@gmail.com, wenn etwas
// niedrig/leer ist. Zwei Quellen:
//   1. API-Balances (Apify/DeepSeek/Tavily) — echtes Guthaben per API.
//   2. Lokales Verbrauchs-Ledger (Anthropic/Fal/Replicate/Resend) — der
//      nach jeder Nutzung berechnete Stand (provider-usage.ts).
// Entprellt über die Settings-Tabelle: neue Mail nur, wenn sich die Menge
// der knappen Provider ändert ODER 24h seit der letzten Mail vergangen sind.
// Wird täglich vom expire-overdue-Cron aufgerufen + manuell über den Endpoint.

import { getAdminSetting, setAdminSetting } from "./sheets";
import { checkAllBalances } from "./api-balances";
import { sendAdminApiBalanceAlert } from "./email";
import {
  getProviderLedger,
  ledgerEntryStatus,
  PROVIDER_BILLING,
  PROVIDER_LABELS,
  type LedgerProvider,
} from "./provider-usage";

const STATE_KEY = "apiBalanceAlertState";
const REALERT_AFTER_MS = 24 * 60 * 60 * 1000;
const LEDGER_PROVIDERS: LedgerProvider[] = ["anthropic", "fal", "replicate", "resend"];

export interface AlertResult {
  lows: number;
  emailed: boolean;
  emailError?: string;
  skipped?: string;
}

interface Low {
  provider: string;
  label: string;
  status: "low" | "empty";
  detail: string;
  url?: string;
}

export async function alertLowBalances(): Promise<AlertResult> {
  const providers = await checkAllBalances();
  const byProvider = new Map(providers.map((p) => [p.provider, p]));
  const lows: Low[] = [];

  // (1) Provider mit echter Balance-API.
  for (const p of providers) {
    if (LEDGER_PROVIDERS.includes(p.provider as LedgerProvider)) continue;
    if (p.configured && (p.status === "low" || p.status === "empty")) {
      lows.push({
        provider: p.provider,
        label: p.label,
        status: p.status,
        detail:
          p.balanceEur !== undefined
            ? `${p.balanceEur.toFixed(2)} € übrig`
            : p.raw || p.error || "—",
        url: p.billingUrl,
      });
    }
  }

  // (2) Lokales Ledger. Ein echtes API-"empty" (z.B. Anthropic 402)
  //     überschreibt den geschätzten Ledger-Stand.
  const ledger = await getProviderLedger();
  for (const key of LEDGER_PROVIDERS) {
    const api = byProvider.get(key);
    if (!api?.configured) continue; // Key nicht gesetzt → kein Alert
    const e = ledger[key];
    let status: "ok" | "low" | "empty" = "ok";
    let detail = "";
    if (e) {
      const s = ledgerEntryStatus(e);
      status = s.status;
      detail = s.detail;
    }
    if (api.status === "empty") {
      status = "empty";
      detail = api.error || detail || "Quota erschöpft";
    }
    if (status === "low" || status === "empty") {
      lows.push({ provider: key, label: PROVIDER_LABELS[key], status, detail, url: PROVIDER_BILLING[key] });
    }
  }

  const currentKeys = lows.map((l) => l.provider).sort().join(",");

  let prev: { providers?: string; at?: number } = {};
  try {
    const raw = await getAdminSetting(STATE_KEY);
    if (raw) prev = JSON.parse(raw);
  } catch {
    /* kein vorheriger Stand */
  }

  if (lows.length === 0) {
    if (prev.providers) {
      try {
        await setAdminSetting(STATE_KEY, "");
      } catch {
        /* ignore */
      }
    }
    return { lows: 0, emailed: false };
  }

  const now = Date.now();
  const shouldEmail =
    prev.providers !== currentKeys || !prev.at || now - prev.at >= REALERT_AFTER_MS;
  if (!shouldEmail) {
    return { lows: lows.length, emailed: false, skipped: "bereits gewarnt (<24h, gleiche Provider)" };
  }

  let emailed = false;
  let emailError: string | undefined;
  try {
    const r = await sendAdminApiBalanceAlert({
      lows: lows.map(({ label, status, detail, url }) => ({ label, status, detail, url })),
    });
    emailed = r.sent;
    if (!r.sent) emailError = r.error;
  } catch (e) {
    emailError = e instanceof Error ? e.message : "send failed";
  }
  if (emailed) {
    try {
      await setAdminSetting(STATE_KEY, JSON.stringify({ providers: currentKeys, at: now }));
    } catch {
      /* ignore */
    }
  }
  return { lows: lows.length, emailed, emailError };
}
