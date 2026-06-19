// ─── API-Guthaben-Alert (geteilte Logik) ─────────────────────────
// Prüft alle Provider-Guthaben und mailt an brospify.info@gmail.com,
// wenn etwas niedrig/leer ist. Entprellt über die Settings-Tabelle:
// neue Mail nur, wenn sich die Menge der knappen Provider ändert ODER
// 24h seit der letzten Mail vergangen sind. Wird vom täglichen Cron
// (an expire-overdue angehängt) UND vom manuellen Endpoint genutzt.

import { getAdminSetting, setAdminSetting } from "./sheets";
import { checkAllBalances } from "./api-balances";
import { sendAdminApiBalanceAlert } from "./email";

const STATE_KEY = "apiBalanceAlertState";
const REALERT_AFTER_MS = 24 * 60 * 60 * 1000;

export interface AlertResult {
  lows: number;
  emailed: boolean;
  emailError?: string;
  skipped?: string;
}

export async function alertLowBalances(): Promise<AlertResult> {
  const providers = await checkAllBalances();
  const lowProviders = providers.filter(
    (p) => p.configured && (p.status === "low" || p.status === "empty"),
  );
  const lows = lowProviders.map((p) => ({
    label: p.label,
    status: p.status as "low" | "empty",
    detail:
      p.balanceEur !== undefined
        ? `${p.balanceEur.toFixed(2)} € übrig${p.balanceUsd !== undefined ? ` (${p.balanceUsd.toFixed(2)} $)` : ""}`
        : p.raw || p.error || "—",
  }));
  const currentKeys = lowProviders
    .map((p) => p.provider)
    .sort()
    .join(",");

  let prev: { providers?: string; at?: number } = {};
  try {
    const raw = await getAdminSetting(STATE_KEY);
    if (raw) prev = JSON.parse(raw);
  } catch {
    /* kein vorheriger Stand */
  }

  // Nichts knapp → Stand zurücksetzen (nächste Knappheit alarmiert frisch).
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
    const r = await sendAdminApiBalanceAlert({ lows });
    emailed = r.sent;
    if (!r.sent) emailError = r.error;
  } catch (e) {
    emailError = e instanceof Error ? e.message : "send failed";
  }
  // Stand nur fortschreiben, wenn die Mail wirklich raus ist.
  if (emailed) {
    try {
      await setAdminSetting(STATE_KEY, JSON.stringify({ providers: currentKeys, at: now }));
    } catch {
      /* ignore */
    }
  }
  return { lows: lows.length, emailed, emailError };
}
