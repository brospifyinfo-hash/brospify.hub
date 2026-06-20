// ─── Lokaler Verbrauchs-Zähler für Provider ohne Balance-API ──────
// Anthropic, Fal, Replicate und Resend geben kein Guthaben per API her.
// Damit der Admin trotzdem eine ZAHL sieht, die nach jeder Nutzung neu
// berechnet wird, führen wir hier ein lokales Ledger:
//   - Seed = die vom Admin gemeldeten aktuellen Stände (unten).
//   - Nach jeder Nutzung wird der geschätzte/echte Verbrauch abgezogen.
//   - Der Admin kann den Stand jederzeit korrigieren (Reconcile), wenn er
//     im echten Dashboard nachgeschaut oder aufgeladen hat.
// Anthropic wird EXAKT aus den Token-Verbräuchen jeder Antwort berechnet;
// Fal/Replicate über realistische Pauschalen pro Operation (justierbar).
//
// Persistenz: Settings-Tab, Key `providerLedger` (JSON).

import { getAdminSetting, setAdminSetting } from "./sheets";

const LEDGER_KEY = "providerLedger";

export type LedgerProvider = "anthropic" | "fal" | "replicate" | "resend";

export interface UsdEntry {
  kind: "usd";
  balance: number;
  updatedAt: string;
}
export interface CountEntry {
  kind: "count";
  monthUsed: number;
  monthLimit: number;
  dayUsed: number;
  dayLimit: number;
  monthKey: string;
  dayKey: string;
  updatedAt: string;
}
export type LedgerEntry = UsdEntry | CountEntry;
export type ProviderLedger = Partial<Record<LedgerProvider, LedgerEntry>>;

// ─── Pauschalen / Preise (zentral justierbar) ─────────────────────
// Anthropic-Preise $/1M Token (Quelle: Claude-API-Referenz, Stand 2026-06).
const ANTHROPIC_PRICES: Record<string, { in: number; out: number }> = {
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
};
// Pauschale Kosten pro erfolgreicher Operation (Schätzwerte, $).
export const FAL_BG_REMOVE_USD = 0.005;
export const FAL_AI_STUDIO_USD = 0.05;
export const REPLICATE_UPSCALE_USD = 0.01; // ~1¢ pro 4× Real-ESRGAN (siehe .env.example)

function monthKey(d = new Date()): string {
  return d.toISOString().slice(0, 7); // "2026-06"
}
function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10); // "2026-06-19"
}

// Seed-Werte = aktuelle Stände laut Admin (Stand 2026-06-19).
function seedLedger(): ProviderLedger {
  const now = new Date().toISOString();
  return {
    anthropic: { kind: "usd", balance: 0.74, updatedAt: now },
    fal: { kind: "usd", balance: 8.33, updatedAt: now },
    replicate: { kind: "usd", balance: 4.89, updatedAt: now },
    resend: {
      kind: "count",
      monthUsed: 14,
      monthLimit: 3000,
      dayUsed: 1,
      dayLimit: 100,
      monthKey: monthKey(),
      dayKey: dayKey(),
      updatedAt: now,
    },
  };
}

// Monats-/Tages-Reset für die Resend-Zähler anwenden (read & write).
function applyResets(ledger: ProviderLedger): ProviderLedger {
  const e = ledger.resend;
  if (e && e.kind === "count") {
    const mk = monthKey();
    const dk = dayKey();
    if (e.monthKey !== mk) {
      e.monthKey = mk;
      e.monthUsed = 0;
    }
    if (e.dayKey !== dk) {
      e.dayKey = dk;
      e.dayUsed = 0;
    }
  }
  return ledger;
}

export async function getProviderLedger(): Promise<ProviderLedger> {
  try {
    const raw = await getAdminSetting(LEDGER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ProviderLedger;
      if (parsed && typeof parsed === "object") return applyResets(parsed);
    }
  } catch {
    /* fällt unten auf Seed zurück */
  }
  const seed = seedLedger();
  try {
    await setAdminSetting(LEDGER_KEY, JSON.stringify(seed));
  } catch {
    /* ignore */
  }
  return seed;
}

async function mutate(fn: (l: ProviderLedger) => void): Promise<void> {
  const ledger = await getProviderLedger();
  fn(ledger);
  try {
    await setAdminSetting(LEDGER_KEY, JSON.stringify(ledger));
  } catch {
    /* ignore — nächste Buchung versucht es erneut */
  }
}

/** USD-Verbrauch abziehen (Anthropic/Fal/Replicate). Nie fatal. */
export async function recordUsd(
  provider: "anthropic" | "fal" | "replicate",
  usd: number,
): Promise<void> {
  if (!Number.isFinite(usd) || usd <= 0) return;
  try {
    await mutate((l) => {
      const e = l[provider];
      if (e && e.kind === "usd") {
        e.balance = Math.max(0, +(e.balance - usd).toFixed(4));
        e.updatedAt = new Date().toISOString();
      }
    });
  } catch {
    /* ignore */
  }
}

/** Eine gesendete Resend-Mail zählen (Monats- + Tageszähler). */
export async function recordResendSend(n = 1): Promise<void> {
  try {
    await mutate((l) => {
      const e = l.resend;
      if (e && e.kind === "count") {
        const mk = monthKey();
        const dk = dayKey();
        if (e.monthKey !== mk) {
          e.monthKey = mk;
          e.monthUsed = 0;
        }
        if (e.dayKey !== dk) {
          e.dayKey = dk;
          e.dayUsed = 0;
        }
        e.monthUsed += n;
        e.dayUsed += n;
        e.updatedAt = new Date().toISOString();
      }
    });
  } catch {
    /* ignore */
  }
}

/** Exakte Anthropic-Kosten aus den Token-Verbräuchen einer Antwort. */
export function anthropicCostUsd(
  model: string,
  usage:
    | {
        input_tokens?: number | null;
        output_tokens?: number | null;
        cache_read_input_tokens?: number | null;
        cache_creation_input_tokens?: number | null;
      }
    | null
    | undefined,
): number {
  if (!usage) return 0;
  const p = ANTHROPIC_PRICES[model] ?? ANTHROPIC_PRICES["claude-sonnet-4-6"];
  const inTok =
    (usage.input_tokens || 0) +
    (usage.cache_read_input_tokens || 0) +
    (usage.cache_creation_input_tokens || 0);
  const outTok = usage.output_tokens || 0;
  return (inTok / 1_000_000) * p.in + (outTok / 1_000_000) * p.out;
}

export const PROVIDER_LABELS: Record<LedgerProvider, string> = {
  anthropic: "Anthropic (Claude)",
  fal: "Fal.ai (BG / AI Studio)",
  replicate: "Replicate (Upscaler)",
  resend: "Resend (E-Mails)",
};
export const PROVIDER_BILLING: Record<LedgerProvider, string> = {
  anthropic: "https://console.anthropic.com/settings/billing",
  fal: "https://fal.ai/dashboard/billing",
  replicate: "https://replicate.com/account/billing",
  resend: "https://resend.com/settings/billing",
};

/** Status + menschenlesbarer Rest aus einem Ledger-Eintrag. */
export function ledgerEntryStatus(e: LedgerEntry): {
  status: "ok" | "low" | "empty";
  detail: string;
} {
  if (e.kind === "usd") {
    const status = e.balance < 0.5 ? "empty" : e.balance < 2 ? "low" : "ok";
    return { status, detail: `${e.balance.toFixed(2)} $ geschätzt übrig` };
  }
  const monthLeft = Math.max(0, e.monthLimit - e.monthUsed);
  const dayLeft = Math.max(0, e.dayLimit - e.dayUsed);
  const monthRatio = e.monthLimit > 0 ? monthLeft / e.monthLimit : 1;
  const dayRatio = e.dayLimit > 0 ? dayLeft / e.dayLimit : 1;
  const status =
    monthLeft <= 0 || dayLeft <= 0
      ? "empty"
      : monthRatio < 0.1 || dayRatio < 0.1
        ? "low"
        : "ok";
  return {
    status,
    detail: `${e.monthUsed}/${e.monthLimit} Monat · ${e.dayUsed}/${e.dayLimit} Tag`,
  };
}

/** Admin-Reconcile: Stand exakt setzen (nach Aufladen / Dashboard-Abgleich). */
export async function setLedgerEntry(
  provider: LedgerProvider,
  patch: {
    balance?: number;
    monthUsed?: number;
    monthLimit?: number;
    dayUsed?: number;
    dayLimit?: number;
  },
): Promise<ProviderLedger> {
  const ledger = await getProviderLedger();
  const now = new Date().toISOString();
  const e = ledger[provider];
  if (provider === "resend") {
    const base: CountEntry =
      e && e.kind === "count"
        ? e
        : { kind: "count", monthUsed: 0, monthLimit: 3000, dayUsed: 0, dayLimit: 100, monthKey: monthKey(), dayKey: dayKey(), updatedAt: now };
    ledger.resend = {
      ...base,
      monthUsed: patch.monthUsed ?? base.monthUsed,
      monthLimit: patch.monthLimit ?? base.monthLimit,
      dayUsed: patch.dayUsed ?? base.dayUsed,
      dayLimit: patch.dayLimit ?? base.dayLimit,
      updatedAt: now,
    };
  } else {
    const balance = Math.max(0, Number(patch.balance) || 0);
    ledger[provider] = { kind: "usd", balance, updatedAt: now };
  }
  await setAdminSetting(LEDGER_KEY, JSON.stringify(ledger));
  return ledger;
}
