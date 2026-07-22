import { google } from "googleapis";
import type { ScoutVideo } from "./video-scout";
import type { SurveyAnswers, SurveyResponseRecord, SurveyResponseMeta } from "./survey";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function getAuth() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!privateKey || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    throw new Error("Google Sheets credentials not configured");
  }
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: SCOPES,
  });
}

function getSheets() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

const SHEET_ID = () => {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error("GOOGLE_SHEET_ID not set");
  return id;
};

// Helper: ensure a sheet/tab exists, create with header row if not
async function ensureSheet(title: string, headers: string[]): Promise<void> {
  const sheets = getSheets();
  try {
    // Check if sheet exists
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID() });
    const exists = meta.data.sheets?.some((s) => s.properties?.title === title);
    if (exists) return;

    // Create the sheet
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID(),
      requestBody: {
        requests: [{ addSheet: { properties: { title } } }],
      },
    });

    // Add header row
    if (headers.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID(),
        range: `${title}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [headers] },
      });
    }
    console.log(`[Sheets] Created tab "${title}" with headers.`);
  } catch (err) {
    console.error(`[Sheets] ensureSheet("${title}") error:`, err);
  }
}

// ─── KUNDEN (Tab 1) ────────────────────────────────────────────
// Columns: A=Shopify_Token, B=Lizensschlüssel, C=Status, D=Shop Domain,
//          E=Kunden-Email, F=Bestellnummer, G=charge, H=suplied, I=SKU, J=Profil_JSON

export interface CheckoutSettings {
  paypal?: boolean;
  klarna?: boolean;
  visa?: boolean;
  guarantee?: boolean;
  secureCheckout?: boolean;
  cartTimer?: boolean;
  stickyAtc?: boolean;
  crossSell?: boolean;
  freeShippingBar?: boolean;
  freeShippingThreshold?: number;
  accentColor?: string;
  bgColor?: string;
  font?: string;
}

export interface OnboardingChecklist {
  setup_complete?: boolean;
  product_imported?: boolean;
  dropshipping_app?: boolean;
  aliexpress_link?: boolean;
  legal_texts_generated?: boolean;
  theme_pushed?: boolean;
}

// ─── Credits — purchasable balance ────────────────────────────
// Old shape: { month: "2026-05", used: 30 }   (monthly meter — deprecated)
// New shape: { balance, totalPurchased, totalUsed, fulfilledOrders[] }
//   - balance         current spendable credits (the source of truth)
//   - totalPurchased  lifetime credits the user ever bought
//   - totalUsed       lifetime credits ever consumed
//   - fulfilledOrders Shopify order IDs already credited → idempotency
export interface CreditTransaction {
  /** ISO timestamp */
  ts: string;
  type: "starter" | "deduct" | "topup" | "voucher" | "admin-grant" | "admin-revoke" | "subscription" | "recurring" | "survey";
  /** Positive for credits added, negative for deductions. */
  delta: number;
  /** Resulting balance after this transaction. */
  balanceAfter: number;
  /** Human-readable reason — tool name, order id, code, admin note. */
  reason: string;
  /** Optional reference (Shopify order id, voucher code, admin user). */
  ref?: string;
}

export interface CreditsRecord {
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  fulfilledOrders?: string[];
  // Per-account redemption ledger for admin-issued voucher codes.
  // Key = code (uppercased), value = how many times this account
  // has redeemed it. Lets us enforce per-account redemption limits.
  redeemedCodes?: Record<string, number>;
  // True once the one-time welcome grant has been applied. Stops
  // the grant helper from re-crediting the user on every profile
  // load.
  starterGranted?: boolean;
  // Append-only transaction log for transparency + admin auditing.
  // Capped at MAX_LOG_ENTRIES; oldest get rolled off.
  log?: CreditTransaction[];
  lastUpdated?: string;
  // ISO-Timestamp wann zuletzt die "Credits niedrig"-Admin-Mail
  // ausgeloest wurde. Wird beim naechsten Aufladen (addCredits /
  // setBalance) wieder geleert, damit das nicht permanent supprimiert.
  lowCreditsAlertedAt?: string;
  // Legacy fields kept so an in-flight migration of an existing
  // profile doesn't lose context. Safe to drop after a few weeks.
  month?: string;
  used?: number;
}

const MAX_LOG_ENTRIES = 80;

function appendLog(
  existing: CreditTransaction[] | undefined,
  entry: CreditTransaction,
): CreditTransaction[] {
  const next = [...(existing || []), entry];
  if (next.length > MAX_LOG_ENTRIES) {
    return next.slice(next.length - MAX_LOG_ENTRIES);
  }
  return next;
}

export type UserRole = "admin" | "user";
// TierKey lives in tiers-shared.ts as the single source of truth.
export type { TierKey } from "./tiers-shared";
import type { TierKey } from "./tiers-shared";
import type { SavedScoutVideo } from "./video-scout";

export interface KundeProfile {
  shopify_credentials?: { clientId?: string; clientSecret?: string };
  brand_kit?: { logoUrl?: string; primaryColor?: string; accentColor?: string; toneOfVoice?: string };
  legal_data?: { firmenname?: string; inhaber?: string; strasse?: string; plz?: string; stadt?: string; land?: string; email?: string; telefon?: string; ustId?: string; handelsregister?: string };
  ai_usage?: { month: string; count: number };
  credits?: CreditsRecord;
  checkout_settings?: CheckoutSettings;
  hasCompletedOnboarding?: boolean;
  /** True, sobald die interaktive Einführungs-Tour einmal abgeschlossen/
   *  übersprungen wurde. Getrennt von hasCompletedOnboarding, damit auch
   *  BESTANDSKUNDEN (die vor dem Tour-Feature onboardet waren) die Tour
   *  einmalig automatisch sehen. Bleibt unangetastet beim manuellen Replay. */
  hasSeenTour?: boolean;
  /** Selbst registriertes Gratis-Konto der Standalone-Editor-Website
   *  (Login via Google/Shopify/E-Mail auf /start bzw. /editor). Bekommt
   *  beim Anlegen EDITOR_STARTER_CREDITS statt der 1500 Hub-Starter und
   *  ist vom 28-Tage-Recurring ausgenommen (noRecurringGrant). */
  editorFree?: boolean;
  /** Hartes Opt-out aus der fortlaufenden 28-Tage-Gutschrift (z. B.
   *  Editor-Gratis-Konten) — geprüft ganz oben in ensureRecurringGrant. */
  noRecurringGrant?: boolean;
  linkedGoogleEmail?: string;
  /** Editor-Konto: selbst gewählter Login-Username (kleingeschrieben,
   *  eindeutig). Erlaubt Login mit Username statt E-Mail. */
  username?: string;
  /** Editor-Konto: scrypt-Hash des Login-Passworts (NIE Klartext). Nur
   *  gesetzt, wenn der Nutzer bei der Registrierung ein Passwort vergeben
   *  hat (der Login mit Google/Shopify/Code funktioniert weiterhin ohne). */
  passwordHash?: string;
  /** ISO-Zeitstempel, wann das Passwort zuletzt gesetzt wurde. */
  passwordSetAt?: string;
  /** Vom Kunden im Onboarding gewählter Anzeigename (im Profil sichtbar).
   *  Fällt im UI auf den Google-Namen bzw. den Lizenzschlüssel zurück. */
  displayName?: string;
  /** Bevorzugte Oberflächen-Sprache. "de" (Default) oder "en". Wird im
   *  Onboarding gesetzt und vom Sprach-Umschalter aktualisiert. */
  language?: "de" | "en";
  onboarding_checklist?: OnboardingChecklist;
  /** Per-user check-off state for the admin-curated StartTasks list
   *  (home page). Key = StartTask.id, value = true once the user
   *  ticks the task. Stored here (not in a separate sheet) so we
   *  don't add roundtrips for what's effectively a small flag map. */
  onboarding_tasks_done?: Record<string, boolean>;
  // ── Admin-only fields ─────────────────────────────────────────
  /** Free-text note set by admin in the customers panel. */
  adminNote?: string;
  /** True for high-value customers — UI shows a star, may be sortable. */
  vip?: boolean;
  /** True if admin has blocked the account — sign-in/credit gates can check this. */
  blocked?: boolean;
  /** ISO timestamp when blocked, for the audit trail. */
  blockedAt?: string;
  // ── Role & subscription ────────────────────────────────────────
  // Hat-Jonas master licence stays as a separate hardcoded admin entry
  // outside this field; everyone else reads admin status from `role`.
  role?: UserRole;
  /** Active subscription tier. Falls back to "free" when undefined. */
  tier?: TierKey;
  /** ISO timestamp the current tier started — used for MRR & churn math. */
  tierSince?: string;
  /** Set when the user (or admin) cancels the tier. Empty when active. */
  tierCanceledAt?: string;
  /** Vom Kunden bei der Kündigung gewählter Grund (aus der Liste). */
  tierCancelReason?: string;
  /** SKU-Spaltenwert vor einem Admin-„Plan entfernen" (Audit-Spur). */
  skuBeforeRemove?: string;
  /** Storefront-Site-Token (SITE-…) fürs Theme-Lizenz-Gate. Steht im
   *  öffentlichen Shop-HTML statt des echten Lizenzschlüssels — der
   *  Schlüssel ist zugleich das Hub-Login und darf dort nie auftauchen.
   *  Wird beim ersten Theme-Export erzeugt und wiederverwendet. */
  licenseSiteToken?: string;
  /** ISO timestamp of the last successful subscription credit refill.
   *  Updated by applySubscriptionRefill() on every paid renewal. Used
   *  by the settings UI to display "Letzte Aufladung: X Tage her". */
  lastSubscriptionRefillAt?: string;
  /** Shopify subscription_contract id. Set during the first order-paid
   *  webhook if available, or by subscription_contracts/create event.
   *  Lets the cancel-endpoint call the Shopify Admin API to cancel the
   *  contract there too — not just mark it canceled locally. */
  subscriptionContractId?: string;
  /** Shopify customer id (numeric). Backfill from order webhook. */
  shopifyCustomerId?: string;
  /** First-seen timestamp. Backfilled to oldest credits.log entry on read if missing. */
  signupAt?: string;
  /** Theme IDs the user has unlocked via one-time purchase. Access requires
   *  an active subscription — if `tierCanceledAt` is set or no tier, these
   *  are read but the push gate still rejects. */
  themesPurchased?: string[];
  /** ISO date/datetime. When set, /api/license/validate rejects after this
   *  point and the daily expire-cron flips `status` to "abgelaufen". For
   *  Shopify-native subscriptions this is a rolling window: each renewal
   *  order pushes it forward, so a stopped subscription auto-expires.
   *  Absent = no time-based expiry (still gated by `status` + `blocked`). */
  subscriptionEndsAt?: string;
  /** Per-User Voting-Tracking: produktId -> "up" | "down". Verhindert
   *  Doppelvotes pro Account und erlaubt Toggle-Verhalten. */
  votedProducts?: Record<string, "up" | "down">;
  /** Zufalls-Generator ("Produkt-Drop"): IDs aller Produkte die dieser
   *  Account jemals gezogen hat. Append-only — garantiert, dass kein
   *  Produkt zweimal gezogen werden kann. */
  drawnProducts?: string[];
  /** Live-Sync der dynamischen Buy Box: Produkt-ID → Sync-Code (bspx_…).
   *  Derselbe Code wird bei jedem Build desselben Produkts wiederverwendet,
   *  damit bereits installierte Themes Design-Updates ohne Neu-Upload sehen. */
  buyboxCodes?: Record<string, string>;
  /** ISO-Timestamp wann wir den Admin zuletzt benachrichtigt haben, dass
   *  dieser Account ziehen wollte aber schon ALLE Produkte hatte. Dient
   *  als Debounce gegen Mail-Spam; wird beim nächsten erfolgreichen Zug
   *  (also sobald wieder neue Produkte da sind) wieder geleert. */
  drawnAllNotifiedAt?: string;
  /** Video Scout: alle vom Account gefundenen/gespeicherten Videos
   *  (neueste zuerst, dedupliziert per url). Dient als Historie UND als
   *  Garantie, dass kein Video zweimal gezogen werden kann. */
  scoutVideos?: SavedScoutVideo[];
  /** Legacy (v1, einzelne Umfrage) — durch surveysCompleted abgelöst. */
  surveyAnsweredV1?: boolean;
  surveyAnsweredAt?: string;
  /** IDs aller abgeschlossenen Umfragen (gestaffeltes System). */
  surveysCompleted?: string[];
  /** Wie oft eine Umfrage als „durchgeklickt" erkannt wurde (pro surveyId).
   *  1× = Warnung, 2× = Umfrage beendet ohne Credits. */
  surveyRushCounts?: Record<string, number>;
  /** Anker für das Credit-Modell + Umfrage-Freischaltung: ISO-Zeitpunkt des
   *  ersten Logins (Starter-Grant). Ab hier zählen die 28-Tage-Zyklen und
   *  die zeitversetzten Umfragen. */
  creditsStartedAt?: string;
  /** Wie viele 28-Tage-Gutschriften bereits vergeben wurden (idempotent). */
  recurringPeriodsGranted?: number;
  lastRecurringGrantAt?: string;
  /** Eigene (selbst angelegte) Produkte für den Theme-Editor — unabhängig
   *  vom Produkt-Katalog. Alle Felder außer id optional; Cap klein halten
   *  (Profil-JSON teilt sich EINE 50k-Zelle). */
  customProducts?: CustomProduct[];
}

/** Ein vom Nutzer selbst angelegtes Produkt (Theme-Editor). Bewusst alles
 *  optional außer der id (Präfix "cust_" — kollidiert nie mit Katalog-IDs). */
export interface CustomProduct {
  id: string;
  titel?: string;
  bildUrl?: string;
  images?: string[];
  preis?: string;
  beschreibung?: string;
  /** KI-Texte, on-demand beim ersten Export generiert (wie ProduktExtra.themeCopy). */
  themeCopy?: Record<string, string>;
  createdAt?: string;
}

// ─── CREDIT SYSTEM ────────────────────────────────────────────
// CREDIT_COSTS lives in `./credit-costs` (client-safe). We re-export
// it under the legacy name `CREDIT_LIMITS` so old call sites keep
// working without pulling googleapis into client bundles.
export { CREDIT_COSTS as CREDIT_LIMITS } from "./credit-costs";
import { STARTER_CREDITS, RECURRING_CREDITS, RECURRING_PERIOD_DAYS } from "./credit-costs";

export function normalizeCredits(raw: CreditsRecord | undefined): CreditsRecord {
  if (!raw) {
    return {
      balance: 0,
      totalPurchased: 0,
      totalUsed: 0,
      fulfilledOrders: [],
      redeemedCodes: {},
      starterGranted: false,
      log: [],
    };
  }
  // Already the new shape — just guarantee fields exist.
  if (typeof raw.balance === "number") {
    return {
      balance: Math.max(0, Math.round(raw.balance)),
      totalPurchased: Math.max(0, Math.round(raw.totalPurchased ?? 0)),
      totalUsed: Math.max(0, Math.round(raw.totalUsed ?? 0)),
      fulfilledOrders: Array.isArray(raw.fulfilledOrders) ? raw.fulfilledOrders : [],
      redeemedCodes:
        raw.redeemedCodes && typeof raw.redeemedCodes === "object"
          ? raw.redeemedCodes
          : {},
      starterGranted: raw.starterGranted === true,
      log: Array.isArray(raw.log) ? raw.log : [],
      lastUpdated: raw.lastUpdated,
    };
  }
  // Legacy { month, used } — preserve lifetime usage for transparency
  // but reset balance; the starter grant will fill the new ledger
  // back up on the next load.
  return {
    balance: 0,
    totalPurchased: 0,
    totalUsed: Math.max(0, Math.round(raw.used ?? 0)),
    fulfilledOrders: [],
    redeemedCodes: {},
    starterGranted: false,
    log: [],
  };
}

export function getCreditsState(profile: KundeProfile): {
  balance: number;
  totalPurchased: number;
  totalUsed: number;
} {
  const c = normalizeCredits(profile.credits);
  return {
    balance: c.balance,
    totalPurchased: c.totalPurchased,
    totalUsed: c.totalUsed,
  };
}

// CRITICAL: Every credit mutation MUST preserve the existing flags
// (starterGranted, redeemedCodes, fulfilledOrders, log). Earlier
// versions of these helpers dropped `starterGranted` on every save,
// which made `ensureStarterGrant` re-grant 500 credits on every
// subsequent profile load. The current shape passes `credits` as
// the base and only overrides what changes.

// Schwellwert ab dem wir den Admin per E-Mail benachrichtigen.
// Wird nur EINMAL pro Cross-Down getriggert (lowCreditsAlertedAt).
const LOW_CREDITS_THRESHOLD = 200;

export async function deductCredits(
  rowIndex: number,
  profile: KundeProfile,
  amount: number,
  reason: string = "tool",
): Promise<{ success: boolean; remaining: number }> {
  const safeAmount = Math.max(0, Math.round(amount));
  const credits = normalizeCredits(profile.credits);
  if (safeAmount === 0) {
    return { success: true, remaining: credits.balance };
  }
  if (credits.balance < safeAmount) {
    return { success: false, remaining: credits.balance };
  }
  const oldBalance = credits.balance;
  const newBalance = credits.balance - safeAmount;
  // Trigger Admin-Mail wenn der Kunde JETZT unter den Schwellwert
  // faellt (Crossover) und vorher noch nicht alertet wurde. Verhindert
  // Spam wenn der Kunde knapp unter dem Threshold mehrfach kleine
  // Aktionen macht.
  const crossedDown = oldBalance >= LOW_CREDITS_THRESHOLD && newBalance < LOW_CREDITS_THRESHOLD;
  const next: CreditsRecord = {
    ...credits,
    balance: newBalance,
    totalUsed: credits.totalUsed + safeAmount,
    log: appendLog(credits.log, {
      ts: new Date().toISOString(),
      type: "deduct",
      delta: -safeAmount,
      balanceAfter: newBalance,
      reason,
    }),
    lastUpdated: new Date().toISOString(),
    // Stempel setzen so wir nicht beim naechsten Aufladen wieder
    // direkt alerten. Wird beim addCredits/setBalance zurueckgesetzt
    // wenn balance wieder ueber dem Threshold ist.
    ...(crossedDown ? { lowCreditsAlertedAt: new Date().toISOString() } : {}),
  };
  await updateKundeProfile(rowIndex, { ...profile, credits: next });

  // Admin-Email NACH dem Sheet-Write. Vorher war das fire-and-forget
  // (void), aber Vercel killt das Promise nach der Response → kam nie
  // an. Jetzt awaited — ~600ms extra Latenz bei Cross-Down (passiert
  // selten weil's nur EINMAL pro Threshold-Unterschreitung feuert).
  if (crossedDown && !credits.lowCreditsAlertedAt) {
    try {
      const { sendAdminLowCreditsAlert } = await import("./email");
      const all = await getAllKunden();
      const kunde = all.find((k) => k.rowIndex === rowIndex);
      if (kunde) {
        const r = await sendAdminLowCreditsAlert({
          customerName: kunde.profile?.legal_data?.firmenname ||
            kunde.profile?.legal_data?.inhaber ||
            kunde.kundenEmail ||
            kunde.lizenzschluessel,
          customerEmail: kunde.kundenEmail,
          customerKey: kunde.lizenzschluessel,
          balance: newBalance,
          threshold: LOW_CREDITS_THRESHOLD,
        });
        if (r.sent) {
          console.log("[deductCredits] low-credits alert sent:", r.id);
        } else {
          console.warn("[deductCredits] low-credits alert NOT sent:", r.error);
        }
      }
    } catch (e) {
      console.warn("[deductCredits] low-credits alert failed:", e);
    }
  }
  return { success: true, remaining: next.balance };
}

// Webhook-driven top-up. Idempotent: if `orderId` was already
// credited we silently skip the increment.
export async function addCredits(
  rowIndex: number,
  profile: KundeProfile,
  amount: number,
  orderId?: string,
  reason: string = "topup",
): Promise<{ success: boolean; balance: number; alreadyFulfilled: boolean }> {
  const safeAmount = Math.max(0, Math.round(amount));
  const credits = normalizeCredits(profile.credits);
  const fulfilled = credits.fulfilledOrders || [];
  if (orderId && fulfilled.includes(orderId)) {
    return { success: true, balance: credits.balance, alreadyFulfilled: true };
  }
  const newBalance = credits.balance + safeAmount;
  const next: CreditsRecord = {
    ...credits,
    balance: newBalance,
    totalPurchased: credits.totalPurchased + safeAmount,
    fulfilledOrders: orderId ? [...fulfilled, orderId] : fulfilled,
    log: appendLog(credits.log, {
      ts: new Date().toISOString(),
      type: "topup",
      delta: safeAmount,
      balanceAfter: newBalance,
      reason,
      ref: orderId,
    }),
    lastUpdated: new Date().toISOString(),
    // Wenn neue Balance den Threshold wieder ueberschreitet, Alert-Flag
    // loeschen damit beim naechsten Cross-Down erneut benachrichtigt wird.
    ...(newBalance >= LOW_CREDITS_THRESHOLD ? { lowCreditsAlertedAt: undefined } : {}),
  };
  await updateKundeProfile(rowIndex, { ...profile, credits: next });
  return { success: true, balance: next.balance, alreadyFulfilled: false };
}

// Subscription-driven monthly refill. Called from the Shopify
// orders/paid webhook for every recurring tier payment. Idempotent:
// the orderId is added to fulfilledOrders so a replay never double-
// credits. Bumps balance + totalPurchased, writes a "subscription"
// log entry, and stamps lastSubscriptionRefillAt on the profile so
// the settings UI can display "Letzte Aufladung: vor X Tagen".
//
// Unlike addCredits this DOES NOT default the type to "topup" — the
// audit log differentiates "user paid for a renewal" (subscription)
// from "user bought an extra pack" (topup), so admin reporting can
// separate recurring revenue from credit-pack revenue.
export async function applySubscriptionRefill(
  rowIndex: number,
  profile: KundeProfile,
  amount: number,
  orderId: string,
  tierLabel: string,
): Promise<{ success: boolean; balance: number; alreadyFulfilled: boolean }> {
  const safeAmount = Math.max(0, Math.round(amount));
  if (safeAmount === 0) {
    return { success: true, balance: normalizeCredits(profile.credits).balance, alreadyFulfilled: false };
  }
  const credits = normalizeCredits(profile.credits);
  const fulfilled = credits.fulfilledOrders || [];
  if (orderId && fulfilled.includes(orderId)) {
    return { success: true, balance: credits.balance, alreadyFulfilled: true };
  }
  const newBalance = credits.balance + safeAmount;
  const next: CreditsRecord = {
    ...credits,
    balance: newBalance,
    totalPurchased: credits.totalPurchased + safeAmount,
    fulfilledOrders: orderId ? [...fulfilled, orderId] : fulfilled,
    log: appendLog(credits.log, {
      ts: new Date().toISOString(),
      type: "subscription",
      delta: safeAmount,
      balanceAfter: newBalance,
      reason: `${tierLabel}-Abo Monats-Credits`,
      ref: orderId,
    }),
    lastUpdated: new Date().toISOString(),
    ...(newBalance >= LOW_CREDITS_THRESHOLD ? { lowCreditsAlertedAt: undefined } : {}),
  };
  await updateKundeProfile(rowIndex, {
    ...profile,
    credits: next,
    lastSubscriptionRefillAt: new Date().toISOString(),
  });
  return { success: true, balance: next.balance, alreadyFulfilled: false };
}

// Set the balance to an EXACT value, ignoring whatever it was before.
// Writes a single audit-log entry of type "admin-grant" (positive
// delta) or "admin-revoke" (negative delta) so the change is traceable
// in the activity feed. Used by /api/admin/customer-action set-credits.
export async function setCreditsBalance(
  rowIndex: number,
  profile: KundeProfile,
  newBalance: number,
  ref?: string,
): Promise<{ success: boolean; balance: number; delta: number }> {
  const target = Math.max(0, Math.round(newBalance));
  const credits = normalizeCredits(profile.credits);
  const delta = target - credits.balance;
  const isGrant = delta >= 0;
  const next: CreditsRecord = {
    ...credits,
    balance: target,
    log: appendLog(credits.log, {
      ts: new Date().toISOString(),
      type: isGrant ? "admin-grant" : "admin-revoke",
      delta,
      balanceAfter: target,
      reason: `Admin set balance → ${target}`,
      ref,
    }),
    lastUpdated: new Date().toISOString(),
    ...(target >= LOW_CREDITS_THRESHOLD ? { lowCreditsAlertedAt: undefined } : {}),
  };
  await updateKundeProfile(rowIndex, { ...profile, credits: next });
  return { success: true, balance: target, delta };
}

// One-time welcome grant. Idempotent: if `starterGranted` is already
// set on the credits record we no-op and return the existing profile.
// Otherwise we add STARTER_CREDITS to the balance, bump
// totalPurchased so the analytics line up, and persist the flag.
//
// Returns `granted: true` only when this call actually wrote a grant —
// callers (login route, hourly backfill cron) use that to decide
// whether to log a SystemLogs audit entry. Bestehende, höhere Balances
// werden NIE überschrieben — wir addieren immer auf den vorhandenen
// `balance`, weshalb ein zahlender Kunde der schon 5.000 Credits hat
// nach dem Grant 5.500 hat, nicht 500.
export async function ensureStarterGrant(
  rowIndex: number,
  profile: KundeProfile,
): Promise<KundeProfile & { __granted?: boolean }> {
  const credits = normalizeCredits(profile.credits);
  if (credits.starterGranted) {
    return { ...profile, credits };
  }
  const nowIso = new Date().toISOString();
  const newBalance = credits.balance + STARTER_CREDITS;
  const next: CreditsRecord = {
    ...credits,
    balance: newBalance,
    totalPurchased: credits.totalPurchased + STARTER_CREDITS,
    starterGranted: true,
    log: appendLog(credits.log, {
      ts: nowIso,
      type: "starter",
      delta: STARTER_CREDITS,
      balanceAfter: newBalance,
      reason: "Willkommens-Bonus",
    }),
    lastUpdated: nowIso,
  };
  // Anker für das 28-Tage-Modell + Umfrage-Staffel setzen (nur falls leer).
  const updated: KundeProfile = {
    ...profile,
    credits: next,
    creditsStartedAt: profile.creditsStartedAt || nowIso,
    recurringPeriodsGranted: profile.recurringPeriodsGranted ?? 0,
  };
  await updateKundeProfile(rowIndex, updated);
  return { ...updated, __granted: true };
}

// Fortlaufende 28-Tage-Gutschrift (RECURRING_CREDITS je Periode). Idempotent
// über `recurringPeriodsGranted`: pro vergangener Periode seit dem Anker wird
// genau einmal gutgeschrieben. Wird beim Profil-Lesen aufgerufen (wie der
// Starter-Grant) — wer länger nicht da war, bekommt alle fälligen Perioden
// auf einmal nachgezahlt. Setzt den Anker nach, falls er fehlt (Bestands-
// kunden vor Einführung des Modells), OHNE rückwirkend zu zahlen.
export async function ensureRecurringGrant(
  rowIndex: number,
  profile: KundeProfile,
): Promise<KundeProfile> {
  // Editor-Gratis-Konten (und andere Opt-outs) bekommen KEINE fortlaufende
  // Gutschrift — sie starten mit einem festen Gratis-Kontingent.
  if (profile.noRecurringGrant) return profile;

  const nowIso = new Date().toISOString();

  // Anker nachsetzen, falls Bestandskunde ohne creditsStartedAt — ab JETZT
  // läuft der Zyklus (keine rückwirkende Gutschrift).
  if (!profile.creditsStartedAt) {
    const seeded: KundeProfile = {
      ...profile,
      creditsStartedAt: nowIso,
      recurringPeriodsGranted: profile.recurringPeriodsGranted ?? 0,
    };
    await updateKundeProfile(rowIndex, seeded);
    return seeded;
  }

  const anchor = Date.parse(profile.creditsStartedAt);
  if (!Number.isFinite(anchor)) return profile;
  const periodMs = RECURRING_PERIOD_DAYS * 86400000;
  const elapsedPeriods = Math.floor((Date.now() - anchor) / periodMs);
  const alreadyGranted = profile.recurringPeriodsGranted ?? 0;
  if (elapsedPeriods <= alreadyGranted) return profile;

  const periodsDue = elapsedPeriods - alreadyGranted;
  const amount = periodsDue * RECURRING_CREDITS;
  const credits = normalizeCredits(profile.credits);
  const newBalance = credits.balance + amount;
  const next: CreditsRecord = {
    ...credits,
    balance: newBalance,
    totalPurchased: credits.totalPurchased + amount,
    log: appendLog(credits.log, {
      ts: nowIso,
      type: "recurring",
      delta: amount,
      balanceAfter: newBalance,
      reason:
        periodsDue === 1
          ? `28-Tage-Gutschrift (+${RECURRING_CREDITS})`
          : `${periodsDue}× 28-Tage-Gutschrift (+${amount})`,
    }),
    lastUpdated: nowIso,
    ...(newBalance >= LOW_CREDITS_THRESHOLD ? { lowCreditsAlertedAt: undefined } : {}),
  };
  const updated: KundeProfile = {
    ...profile,
    credits: next,
    recurringPeriodsGranted: elapsedPeriods,
    lastRecurringGrantAt: nowIso,
  };
  await updateKundeProfile(rowIndex, updated);
  return updated;
}

// Berechnet die nächste fällige Gutschrift + Zyklus-Fortschritt für die
// Live-Anzeige in den Einstellungen. Rein lesend, kein Sheet-Write.
export function getCreditCycle(profile: KundeProfile): {
  startedAt: string | null;
  periodDays: number;
  recurringAmount: number;
  nextGrantAt: string | null;
  daysUntilNext: number | null;
  cycleProgressPct: number;
  periodsGranted: number;
  lastGrantAt: string | null;
} {
  const periodDays = RECURRING_PERIOD_DAYS;
  // Editor-Gratis-Konten (noRecurringGrant) haben zwar einen
  // creditsStartedAt-Anker, bekommen aber NIE die 28-Tage-Gutschrift
  // (ensureRecurringGrant bricht früh ab). Darum keinen „+1000 in X
  // Tagen"-Countdown ausweisen — sonst verspricht der Hub eine
  // Gutschrift, die nie kommt.
  if (!profile.creditsStartedAt || profile.noRecurringGrant) {
    return {
      startedAt: null,
      periodDays,
      recurringAmount: profile.noRecurringGrant ? 0 : RECURRING_CREDITS,
      nextGrantAt: null,
      daysUntilNext: null,
      cycleProgressPct: 0,
      periodsGranted: profile.recurringPeriodsGranted ?? 0,
      lastGrantAt: profile.lastRecurringGrantAt ?? null,
    };
  }
  const anchor = Date.parse(profile.creditsStartedAt);
  const periodMs = periodDays * 86400000;
  const elapsedPeriods = Math.floor((Date.now() - anchor) / periodMs);
  const nextIdx = elapsedPeriods + 1;
  const nextGrantMs = anchor + nextIdx * periodMs;
  const cycleStartMs = anchor + elapsedPeriods * periodMs;
  const intoCycle = Date.now() - cycleStartMs;
  const cycleProgressPct = Math.max(0, Math.min(100, Math.round((intoCycle / periodMs) * 100)));
  const daysUntilNext = Math.max(0, Math.ceil((nextGrantMs - Date.now()) / 86400000));
  return {
    startedAt: profile.creditsStartedAt,
    periodDays,
    recurringAmount: RECURRING_CREDITS,
    nextGrantAt: new Date(nextGrantMs).toISOString(),
    daysUntilNext,
    cycleProgressPct,
    periodsGranted: profile.recurringPeriodsGranted ?? elapsedPeriods,
    lastGrantAt: profile.lastRecurringGrantAt ?? null,
  };
}

// Walk every customer row and grant 500 starter credits to anyone who
// hasn't received them yet. Designed to run from the hourly Vercel
// cron — keeps everyone in sync regardless of whether they ever
// finished a login.
//
// Non-destructive: bestehende Balances bleiben, der Grant ist additiv.
// Wir geben uns einen kleinen Delay zwischen Schreibvorgängen damit
// die Sheets-API bei großen Migrationen nicht ratelimit-t. Throw von
// einem einzelnen Profil bricht die Schleife nicht ab — wir loggen
// und machen weiter.
export async function backfillStarterGrants(): Promise<{
  scanned: number;
  granted: number;
  skipped: number;
  errors: number;
  grantedKeys: string[];
}> {
  const kunden = await getAllKunden();
  let granted = 0;
  let skipped = 0;
  let errors = 0;
  const grantedKeys: string[] = [];

  for (const k of kunden) {
    if (!k.lizenzschluessel) {
      skipped++;
      continue;
    }
    const credits = normalizeCredits(k.profile.credits);
    if (credits.starterGranted) {
      skipped++;
      continue;
    }
    try {
      await ensureStarterGrant(k.rowIndex, k.profile);
      granted++;
      grantedKeys.push(k.lizenzschluessel);
      // Tiny throttle to stay under Sheets per-minute write quota when
      // backfilling lots of profiles in one go.
      if (granted % 5 === 0) {
        await new Promise((r) => setTimeout(r, 600));
      }
    } catch (err) {
      console.error(`[backfillStarterGrants] ${k.lizenzschluessel}:`, err);
      errors++;
    }
  }

  return { scanned: kunden.length, granted, skipped, errors, grantedKeys };
}

// Voucher redemption — bumps balance and records the redemption count
// for this account so we can enforce per-account caps on the next try.
export async function redeemCode(
  rowIndex: number,
  profile: KundeProfile,
  code: string,
  amount: number,
): Promise<{ success: boolean; balance: number }> {
  const upper = code.trim().toUpperCase();
  const safeAmount = Math.max(0, Math.round(amount));
  const credits = normalizeCredits(profile.credits);
  const ledger = { ...(credits.redeemedCodes || {}) };
  ledger[upper] = (ledger[upper] || 0) + 1;
  const newBalance = credits.balance + safeAmount;
  const next: CreditsRecord = {
    ...credits,
    balance: newBalance,
    totalPurchased: credits.totalPurchased + safeAmount,
    redeemedCodes: ledger,
    log: appendLog(credits.log, {
      ts: new Date().toISOString(),
      type: "voucher",
      delta: safeAmount,
      balanceAfter: newBalance,
      reason: `Voucher ${upper}`,
      ref: upper,
    }),
    lastUpdated: new Date().toISOString(),
    ...(newBalance >= LOW_CREDITS_THRESHOLD ? { lowCreditsAlertedAt: undefined } : {}),
  };
  await updateKundeProfile(rowIndex, { ...profile, credits: next });
  return { success: true, balance: next.balance };
}

// Admin manual adjustment — can be positive (grant) or negative (revoke).
// Always logged with the admin's identifier so it's auditable.
export async function adminAdjustCredits(
  rowIndex: number,
  profile: KundeProfile,
  delta: number,
  adminRef: string,
  note: string = "",
): Promise<{ success: boolean; balance: number }> {
  const credits = normalizeCredits(profile.credits);
  const safeDelta = Math.round(delta);
  // Don't let the balance go below 0
  const newBalance = Math.max(0, credits.balance + safeDelta);
  const realDelta = newBalance - credits.balance;

  const next: CreditsRecord = {
    ...credits,
    balance: newBalance,
    // Track the adjustment in the right cumulative bucket
    totalPurchased: realDelta > 0 ? credits.totalPurchased + realDelta : credits.totalPurchased,
    totalUsed: realDelta < 0 ? credits.totalUsed + Math.abs(realDelta) : credits.totalUsed,
    log: appendLog(credits.log, {
      ts: new Date().toISOString(),
      type: realDelta >= 0 ? "admin-grant" : "admin-revoke",
      delta: realDelta,
      balanceAfter: newBalance,
      reason: note || (realDelta >= 0 ? "Admin Gutschrift" : "Admin Abzug"),
      ref: adminRef,
    }),
    lastUpdated: new Date().toISOString(),
    ...(newBalance >= LOW_CREDITS_THRESHOLD ? { lowCreditsAlertedAt: undefined } : {}),
  };
  await updateKundeProfile(rowIndex, { ...profile, credits: next });
  return { success: true, balance: next.balance };
}

export interface Kunde {
  rowIndex: number;
  shopifyToken: string;
  lizenzschluessel: string;
  status: string;
  shopDomain: string;
  kundenEmail: string;
  bestellnummer: string;
  charge: string;
  suplied: string;
  sku: string;
  profile: KundeProfile;
}

function parseProfile(raw: string): KundeProfile {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function rowToKunde(row: string[], index: number): Kunde {
  return {
    rowIndex: index + 2,
    shopifyToken: row[0] || "",
    lizenzschluessel: row[1] || "",
    status: row[2] || "",
    shopDomain: row[3] || "",
    kundenEmail: row[4] || "",
    bestellnummer: row[5] || "",
    charge: row[6] || "",
    suplied: row[7] || "",
    sku: row[8] || "",
    profile: parseProfile(row[9] || ""),
  };
}

export async function getAllKunden(): Promise<Kunde[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: "Kunden!A2:J",
  });
  const rows = res.data.values || [];
  return rows.map((row, i) => rowToKunde(row, i));
}

export async function getKundeProfile(rowIndex: number): Promise<KundeProfile> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: `Kunden!J${rowIndex}`,
  });
  const raw = res.data.values?.[0]?.[0] || "";
  return parseProfile(raw);
}

export async function updateKundeProfile(rowIndex: number, profile: KundeProfile): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `Kunden!J${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [[JSON.stringify(profile)]] },
  });
}

// "Löscht" eine Kunden-/Lizenz-Zeile, indem die Zellen A:J geleert
// werden (gleiche Strategie wie deleteProdukt — kein Row-Shift). Die
// leere Zeile matched danach keinen Lizenzschlüssel/keine Order mehr.
export async function deleteKunde(rowIndex: number): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `Kunden!A${rowIndex}:J${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [["", "", "", "", "", "", "", "", "", ""]] },
  });
}

// Toleranter Lizenzschlüssel-Vergleich: NFKC + trim + lowercase —
// exakt wie /api/license/validate. So scheitert das Hub-Login NICHT an
// Groß-/Kleinschreibung, Leerzeichen oder Unicode-Varianten, wenn der
// Kunde den Schlüssel aus der Mail abtippt. Generierte Keys sind alle
// Großbuchstaben+Ziffern, daher gibt es keine case-only-Kollisionen.
function normLicenseKey(s: string): string {
  return (s || "").normalize("NFKC").trim().toLowerCase();
}

export async function findKundeByKey(key: string): Promise<Kunde | null> {
  const wanted = normLicenseKey(key);
  if (!wanted) return null;
  const kunden = await getAllKunden();
  return kunden.find((k) => normLicenseKey(k.lizenzschluessel) === wanted) || null;
}

// Match a customer by email — webhook flow uses this to figure out
// which row to top up after a Shopify checkout completes. Lower-cased
// to absorb capitalisation differences between Shopify's record and
// the value we stored in the sheet.
export async function findKundeByEmail(email: string): Promise<Kunde | null> {
  if (!email) return null;
  const target = email.trim().toLowerCase();
  const kunden = await getAllKunden();
  return (
    kunden.find((k) => (k.kundenEmail || "").trim().toLowerCase() === target) ||
    null
  );
}

// Match by Shopify shop domain (Spalte D) — der Shopify-Login der
// Standalone-Editor-Website erkennt daran wiederkehrende Shops.
// Lower-cased; Domains sind eindeutig pro Shop (*.myshopify.com).
export async function findKundeByShopDomain(domain: string): Promise<Kunde | null> {
  const target = (domain || "").trim().toLowerCase();
  if (!target) return null;
  const kunden = await getAllKunden();
  return (
    kunden.find((k) => (k.shopDomain || "").trim().toLowerCase() === target) ||
    null
  );
}

// Match by Shopify order number — used by /api/license/issue for
// idempotency. If Shopify Flow retries (or fires twice), we must
// not create a second licence for the same order.
export async function findKundeByOrder(orderNumber: string): Promise<Kunde | null> {
  if (!orderNumber) return null;
  const target = orderNumber.trim();
  if (!target) return null;
  const kunden = await getAllKunden();
  return kunden.find((k) => (k.bestellnummer || "").trim() === target) || null;
}

// Generate a fresh licence key. Format: `XXX-XXXXXX` (9 chars + 1
// separator). The alphabet excludes the ambiguous characters
// I, O, 0, 1 so customers don't mis-type when reading from an email.
//
// Collision resistance: 32^9 ≈ 35 billion combos. With even 100k
// customers the per-issue collision chance is ~3e-6; the issue
// endpoint re-rolls up to 3 times if a clash ever happens.
const KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 chars
export function generateLicenseKey(): string {
  // Node's crypto.randomBytes for unbiased sampling — the alphabet
  // length divides 256 cleanly into 8 buckets of 32, so 256 % 32 === 0:
  // no modulo bias. (Math.random would be biased AND predictable.)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require("crypto") as typeof import("crypto");
  const bytes = crypto.randomBytes(9);
  let prefix = "";
  for (let i = 0; i < 3; i += 1) prefix += KEY_ALPHABET[bytes[i] % 32];
  let body = "";
  for (let i = 3; i < 9; i += 1) body += KEY_ALPHABET[bytes[i] % 32];
  return `${prefix}-${body}`;
}

/** Storefront-Site-Token (SITE-XXXXXXXXXXXXXXXXXXXX). Öffentlicher
 *  Stellvertreter des Lizenzschlüssels fürs Theme-Gate: /api/license/
 *  validate akzeptiert ihn, das Hub-Login NICHT. 20 Zeichen aus dem
 *  32er-Alphabet (~100 Bit) — nicht ratbar. */
export function generateSiteToken(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require("crypto") as typeof import("crypto");
  const bytes = crypto.randomBytes(20);
  let body = "";
  for (let i = 0; i < 20; i += 1) body += KEY_ALPHABET[bytes[i] % 32];
  return `SITE-${body}`;
}

export async function updateKundeField(
  rowIndex: number,
  column: string,
  value: string
): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `Kunden!${column}${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [[value]] },
  });
}

export async function updateKundeFields(
  rowIndex: number,
  updates: { column: string; value: string }[]
): Promise<void> {
  const sheets = getSheets();
  const data = updates.map((u) => ({
    range: `Kunden!${u.column}${rowIndex}`,
    values: [[u.value]],
  }));
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID(),
    requestBody: {
      valueInputOption: "RAW",
      data,
    },
  });
}

// ─── Make.com → Hub upsert ────────────────────────────────────
// Idempotent insert-or-update keyed by `lizenzschluessel`. Used by
// /api/license/sync to mirror what Make.com previously wrote
// directly into the sheet. Profile is *merged*, not replaced —
// credits, role, tier and other Hub-managed fields are never
// clobbered by an upstream Make payload that doesn't know about them.
//
// `subscriptionEndsAt` and other profile-level inputs flow through
// the merged profile, not their own columns, so Make doesn't need
// to reason about Sheet column letters.
export interface KundeUpsertInput {
  lizenzschluessel: string;
  status?: string;
  shopDomain?: string;
  kundenEmail?: string;
  bestellnummer?: string;
  charge?: string;
  suplied?: string;
  sku?: string;
  shopifyToken?: string;
  /** ISO timestamp or YYYY-MM-DD. Stored in profile.subscriptionEndsAt. */
  subscriptionEndsAt?: string;
  /** Optional profile patch — shallow-merged on top of existing profile. */
  profilePatch?: Partial<KundeProfile>;
}

export async function upsertKundeByKey(
  input: KundeUpsertInput,
): Promise<{ action: "created" | "updated"; rowIndex: number }> {
  const key = (input.lizenzschluessel || "").trim();
  if (!key) throw new Error("upsertKundeByKey: lizenzschluessel is required");

  const sheets = getSheets();
  const existing = await findKundeByKey(key);

  // Merge profile patch on top of existing (or empty) profile.
  // `subscriptionEndsAt` is a first-class top-level input, so it
  // gets folded into the profile here rather than asking Make to
  // know about the `profilePatch` shape.
  const mergedProfile: KundeProfile = {
    ...(existing?.profile || {}),
    ...(input.profilePatch || {}),
  };
  if (input.subscriptionEndsAt !== undefined) {
    mergedProfile.subscriptionEndsAt = input.subscriptionEndsAt;
  }

  if (existing) {
    // UPDATE — only overwrite columns Make actually sent. `undefined`
    // means "don't touch", so a renewal call that only carries
    // status + subscriptionEndsAt won't blank out email/SKU.
    const updates: { column: string; value: string }[] = [];
    const colMap: Array<[keyof KundeUpsertInput, string]> = [
      ["shopifyToken", "A"],
      ["status", "C"],
      ["shopDomain", "D"],
      ["kundenEmail", "E"],
      ["bestellnummer", "F"],
      ["charge", "G"],
      ["suplied", "H"],
      ["sku", "I"],
    ];
    for (const [field, col] of colMap) {
      const v = input[field];
      if (typeof v === "string") updates.push({ column: col, value: v });
    }
    if (updates.length > 0) {
      await updateKundeFields(existing.rowIndex, updates);
    }
    await updateKundeProfile(existing.rowIndex, mergedProfile);
    return { action: "updated", rowIndex: existing.rowIndex };
  }

  // CREATE — neue Zeile mit dem vollen Spaltenlayout.
  const row = [
    input.shopifyToken ?? "",
    key,
    input.status ?? "aktiv",
    input.shopDomain ?? "",
    input.kundenEmail ?? "",
    input.bestellnummer ?? "",
    input.charge ?? "",
    input.suplied ?? "",
    input.sku ?? "",
    JSON.stringify(mergedProfile),
  ];

  // WICHTIG: NICHT `values.append` benutzen — das hat in der Produktion
  // still ge-no-opt (Erfolg gemeldet, aber keine Zeile geschrieben; seine
  // „Tabellen-Erkennung" versagt bei vielen geleerten/gelöschten Zeilen,
  // siehe `deleteKunde`, das Zellen nur leert statt Zeilen zu entfernen).
  // Stattdessen: Zielzeile selbst über Spalte B (Lizenzschlüssel)
  // bestimmen und per `update` deterministisch an genau diese Zeile
  // schreiben. Danach gegenlesen — schlägt das fehl, werfen wir, damit
  // der Aufrufer es als echten Fehler behandelt (kein stiller Verlust).
  const colB =
    (
      await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID(),
        range: "Kunden!B2:B",
      })
    ).data.values || [];
  let targetRow = colB.length + 2; // hinter dem letzten Eintrag
  for (let i = 0; i < colB.length; i += 1) {
    const cell = (colB[i]?.[0] ?? "").toString().trim();
    if (!cell) {
      targetRow = i + 2; // erste freie (Schlüssel-leere) Zeile wiederverwenden
      break;
    }
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `Kunden!A${targetRow}:J${targetRow}`,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });

  // Gegenlesen: der Schlüssel MUSS jetzt in der Zielzeile stehen.
  const check =
    (
      await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID(),
        range: `Kunden!B${targetRow}`,
      })
    ).data.values?.[0]?.[0] ?? "";
  if (String(check).trim() !== key) {
    throw new Error(
      `Sheet-Schreibvorgang nicht bestätigt: erwartete "${key}" in Kunden!B${targetRow}, gelesen "${String(check).trim()}". Tab-Name "Kunden" + Editor-Rechte des Service-Accounts (GOOGLE_SERVICE_ACCOUNT_EMAIL) prüfen.`,
    );
  }
  return { action: "created", rowIndex: targetRow };
}

// Daily-cron helper. Walks all Kunden, finds rows whose
// `profile.subscriptionEndsAt` is in the past AND whose `status`
// column hasn't already been flipped, and sets status to "abgelaufen".
// Returns the count of rows updated. Resilient: a single failing row
// does not abort the rest.
export async function expireOverdueSubscriptions(
  now: Date = new Date(),
): Promise<{ checked: number; expired: number; errors: number }> {
  const kunden = await getAllKunden();
  const cutoff = now.getTime();
  let expired = 0;
  let errors = 0;

  for (const k of kunden) {
    const endsAt = k.profile?.subscriptionEndsAt;
    if (!endsAt) continue;
    const t = Date.parse(endsAt);
    if (!Number.isFinite(t) || t > cutoff) continue;
    const currentStatus = (k.status || "").trim().toLowerCase();
    if (currentStatus === "abgelaufen" || currentStatus === "expired") continue;
    try {
      await updateKundeField(k.rowIndex, "C", "abgelaufen");
      expired += 1;
    } catch (err) {
      console.error("[expireOverdueSubscriptions] row", k.rowIndex, err);
      errors += 1;
    }
  }
  return { checked: kunden.length, expired, errors };
}

// ─── PRODUKTE (Tab 2) ──────────────────────────────────────────
// Echtes Sheet-Layout (Make.com-Style):
//   A=CJ_ID, B=SKU, C=Titel, D=Bild_URL, E=Beschreibung,
//   F=Preis, G=AliExpress_Link, H=Extra_JSON
//
// HINTERGRUND: Frueher hatten wir intern eine 9-Spalten-Form mit
// einer Monat-Spalte zwischen SKU und Titel. Das Sheet selbst war
// aber schon immer im Make-Style ohne Monat-Spalte, sodass das
// Schreiben mit produkt.monat in C reinging und dann das echte
// Titel in D rutschte → komplettes Versatz-Chaos und neue Produkte
// wurden mit titel = ID gespeichert (Make-Automation hat das
// auto-gefuellt). Schema ist jetzt direkt 8-spaltig.
//
// `monat` bleibt im Produkt-Typ als optionaler Legacy-String (wird
// nirgendwo gelesen/geschrieben, nur dass alter aufrufender Code
// kompilierbar bleibt).

export interface ProduktStats {
  trendScore: number;
  viralScore: number;
  impulseBuyFactor: number;
  problemSolverIndex: number;
  marketSaturation: number;
}

export interface ProduktFinances {
  buyPrice: number;
  recommendedSellPrice: number;
  profitMargin: number;
}

// ─── New rich-extras shape ──────────────────────────────────────
// Lebt komplett in der `Extra_JSON`-Spalte (Spalte I) — keine
// Sheet-Schema-Änderung. Alte Einträge ohne diese Felder bleiben
// gültig; die UI fällt dann sauber zurück.

export interface ProduktAds {
  /** Bis zu ein paar URLs pro Plattform. Leere Array == nichts gefunden. */
  tiktok?: string[];
  instagram?: string[];
  facebook?: string[];
  youtube?: string[];
}

export interface ProduktDropshippingExample {
  url: string;
  /** Optionaler Shop/Seitentitel, nur für die UI-Beschriftung. */
  title?: string;
}

export interface ProduktLinks {
  /** Exakter AliExpress-Produktlink (oder Such-Fallback). */
  aliExpressProduct?: string;
  /** Kategorie-Sucheinstieg auf AliExpress (immer ein /wholesale-Link). */
  aliExpressCategory?: string;
  /** Legacy: einzelner Beispielshop. Wird beim Lesen in dropshippingExamples
   *  gemerged, beim Schreiben nicht mehr gesetzt. */
  dropshippingExample?: ProduktDropshippingExample;
  /** Mehrere Beispiel-Shops die das Produkt bereits per Dropshipping
   *  verkaufen — gezielt selektierte echte Stores, keine Reviewer-Sites. */
  dropshippingExamples?: ProduktDropshippingExample[];
}

export interface ProduktLinkStatus {
  aliExpressProductOk?: boolean;
  aliExpressCategoryOk?: boolean;
  dropshippingExampleOk?: boolean;
  /** ISO-Timestamp des letzten Cron-Checks. */
  lastCheckedAt?: string;
}

// ─── Deep Analytics (Premium Charts) ────────────────────────────
// Zusatz-Felder die die KI-Discovery liefert und die in der erweiterten
// Charts-Detailansicht angezeigt werden. Alle optional — alte Produkte
// ohne diese Felder fallen sauber zurück.

export interface ProduktDeepStats {
  /** 0-100, höher = mehr Konkurrenz im Markt. */
  competition?: number;
  /** 0-100, 0 = evergreen, 100 = stark saisonal. */
  seasonality?: number;
  /** Monatsnummern (1-12) in denen die Nachfrage Peaks hat. */
  peakMonths?: number[];
  /** Wachstumstrend der letzten 90 Tage in Prozent (-100..+500). */
  growth90d?: number;
  /** Wiederkaufrate-Schätzung in % (für Cross-Sell-Potenzial). */
  repeatPurchaseRate?: number;
}

export interface ProduktAudience {
  /** Kurz-Label, z.B. "Gen-Z fitness enthusiasts". */
  primary?: string;
  /** Altersrange wie "18-34". */
  ageRange?: string;
  /** "male" | "female" | "balanced". */
  genderSkew?: "male" | "female" | "balanced";
  /** Bis zu 5 Top-Interessen für Ad-Targeting. */
  interests?: string[];
  /** Pain-Point den das Produkt adressiert. */
  painPoint?: string;
}

export interface ProduktVotes {
  /** Anzahl positiver Stimmen (Pfeil hoch). */
  ups?: number;
  /** Anzahl negativer Stimmen (Pfeil runter). */
  downs?: number;
  /** Admin-Override: wird auf den Score addiert (kann negativ sein,
   *  zum Hochpushen oder Drücken eines Produkts). */
  manualBoost?: number;
}

export interface ProduktAdStrategy {
  /** Geschätzter Mindest-Tagesbudget in EUR. */
  dailyMinEur?: number;
  /** Empfohlenes Tagesbudget für ordentliches Volumen in EUR. */
  dailyRecommendedEur?: number;
  /** Geschätzter CPM in EUR. */
  estimatedCpmEur?: number;
  /** Beste Ad-Format-Empfehlung, z.B. "Hook-Heavy TikTok Video, 15-30s". */
  bestFormat?: string;
  /** Top-3 Ad-Copy-Hooks (Hookline für ersten Frame/Sekunde). */
  adHooks?: string[];
  /** Empfohlene Test-Phase in Tagen vor Skalierung. */
  testDurationDays?: number;
}

export interface ProduktExtra {
  stats?: ProduktStats;
  finances?: ProduktFinances;
  images?: string[];
  /** Tiefere Linkstruktur — Kategorie + Produkt + Dropshipping-Beispiel. */
  links?: ProduktLinks;
  /** Beispiel-Ads gruppiert nach Plattform. */
  ads?: ProduktAds;
  /** Vom Cron gepflegt: welche Links sind aktuell noch erreichbar? */
  linkStatus?: ProduktLinkStatus;
  /** Deep Analytics — Wettbewerb, Saisonalität, Wachstum. */
  deepStats?: ProduktDeepStats;
  /** Zielgruppe & Targeting-Hinweise. */
  audience?: ProduktAudience;
  /** Ad-Strategie-Empfehlung (Budget, Format, Hooks). */
  adStrategy?: ProduktAdStrategy;
  /** User-Voting-Score: ups + downs + manualBoost. */
  votes?: ProduktVotes;
  /** KI-generierte Theme-Landingpage-Texte (Platzhalter-Key → Wert).
   *  Befüllt von der Maker-Checker-Pipeline, genutzt vom Theme-Export. */
  themeCopy?: Record<string, string>;
}

export interface Produkt {
  rowIndex: number;
  id: string;
  sku: string;
  monat: string;
  titel: string;
  bildUrl: string;
  beschreibung: string;
  preis: string;
  aliExpressLink: string;
  extra: ProduktExtra;
}

function parseExtra(raw: string): ProduktExtra {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// Smart row-to-Produkt: erkennt automatisch ob die Zeile im alten
// 9-Spalten-Format (mit Monat zwischen SKU und Titel) ODER im neuen
// 8-Spalten-Make-Format gespeichert wurde. So bleiben alte Produkte
// weiterhin lesbar nachdem wir auf das schlankere Schema umgestiegen
// sind. Heuristik: wenn row[8] wie JSON aussieht ({…}), ist das die
// extra-Spalte des alten 9-Spalten-Schemas. Sonst neues Schema.
function rowToProdukt(row: string[], index: number): Produkt {
  const looksLikeJson = (s: string | undefined): boolean => {
    if (!s) return false;
    const t = s.trim();
    return t.startsWith("{") || t.startsWith("[");
  };
  const isOldFormat = looksLikeJson(row[8]);

  if (isOldFormat) {
    // Altes 9-Spalten-Schema: A=id, B=sku, C=monat, D=titel,
    // E=bildUrl, F=beschreibung, G=preis, H=aliExpressLink, I=extra.
    return {
      rowIndex: index + 2,
      id: row[0] || "",
      sku: row[1] || "",
      monat: row[2] || "",
      titel: row[3] || "",
      bildUrl: row[4] || "",
      beschreibung: row[5] || "",
      preis: row[6] || "",
      aliExpressLink: row[7] || "",
      extra: parseExtra(row[8] || ""),
    };
  }

  // Neues 8-Spalten-Schema (Make-Style): A=CJ_ID, B=SKU, C=Titel,
  // D=Bild_URL, E=Beschreibung, F=Preis, G=AliExpress_Link, H=Extra_JSON.
  return {
    rowIndex: index + 2,
    id: row[0] || "",
    sku: row[1] || "",
    monat: "",
    titel: row[2] || "",
    bildUrl: row[3] || "",
    beschreibung: row[4] || "",
    preis: row[5] || "",
    aliExpressLink: row[6] || "",
    extra: parseExtra(row[7] || ""),
  };
}

export async function getAllProdukte(): Promise<Produkt[]> {
  const sheets = getSheets();
  // Lesen wir bis I, damit die Smart-Detection auf row[8] zugreifen kann.
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: "Produkte!A2:I",
  });
  const rows = res.data.values || [];
  return rows.map((row, i) => rowToProdukt(row, i));
}

export async function getProdukteBysku(sku: string): Promise<Produkt[]> {
  const all = await getAllProdukte();
  return all.filter((p) => p.sku === sku);
}

function produktToRow(produkt: Omit<Produkt, "rowIndex">): string[] {
  return [
    produkt.id,           // A: CJ_ID
    produkt.sku,          // B: SKU
    produkt.titel,        // C: Titel
    produkt.bildUrl,      // D: Bild_URL
    produkt.beschreibung, // E: Beschreibung
    produkt.preis,        // F: Preis
    produkt.aliExpressLink, // G: AliExpress_Link
    JSON.stringify(produkt.extra || {}), // H: Extra_JSON
  ];
}

export async function addProdukt(
  produkt: Omit<Produkt, "rowIndex">,
): Promise<{ rowIndex: number; updatedRange: string }> {
  const sheets = getSheets();

  // Wir verlassen uns NICHT mehr auf das append+updatedRange-Spiel —
  // das war zu unzuverlaessig (Sheets liefert manchmal A42, manchmal
  // A42:H42, manchmal Make.com mischt sich ein). Stattdessen:
  //
  //   1. Lies Spalte A komplett. Die Zaehlung gibt uns die naechste
  //      freie Zeile.
  //   2. update() auf GENAU diese Zeile mit unseren 8 Werten.
  //   3. Wir wissen ZWEIFELSFREI welche Zeile wir gerade geschrieben
  //      haben — kein Regex-Glueck noetig.
  const colA = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: "Produkte!A:A",
  });
  // values.length = Anzahl Zeilen mit Inhalt in Spalte A (inkl. Header).
  // Die naechste leere Zeile ist eine drueber.
  const usedRows = colA.data.values?.length || 0;
  const newRowIndex = usedRows + 1; // +1 weil A1 row 1 ist, naechste = letzte+1

  const range = `Produkte!A${newRowIndex}:H${newRowIndex}`;
  const updateRes = await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range,
    valueInputOption: "RAW",
    requestBody: { values: [produktToRow(produkt)] },
  });

  const updatedRange = updateRes.data.updatedRange || range;
  console.log(
    `[addProdukt] usedRows=${usedRows} -> newRow=${newRowIndex} range="${range}" updatedCells=${updateRes.data.updatedCells}`,
  );
  return { rowIndex: newRowIndex, updatedRange };
}

// Liest eine spezifische Produkt-Zeile aus dem Sheet (per rowIndex).
// Verwendet die gleiche Smart-Detection wie getAllProdukte.
export async function getProduktByRowIndex(rowIndex: number): Promise<Produkt | null> {
  if (!rowIndex || rowIndex < 2) return null;
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: `Produkte!A${rowIndex}:I${rowIndex}`,
  });
  const row = res.data.values?.[0];
  if (!row) return null;
  return rowToProdukt(row, rowIndex - 2);
}

export async function updateProdukt(
  rowIndex: number,
  produkt: Omit<Produkt, "rowIndex">
): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `Produkte!A${rowIndex}:H${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [produktToRow(produkt)] },
  });
}

export async function bulkAddProdukte(
  produkte: Omit<Produkt, "rowIndex">[]
): Promise<void> {
  const sheets = getSheets();
  const values = produkte.map((p) => produktToRow(p));
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID(),
    range: "Produkte!A:H",
    valueInputOption: "RAW",
    requestBody: { values },
  });
}

export async function deleteProdukt(rowIndex: number): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `Produkte!A${rowIndex}:H${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [["", "", "", "", "", "", "", ""]] },
  });
}

// Aktualisiert ausschließlich die `Extra_JSON`-Spalte (H) einer Produktzeile.
// Wird vom Linkcheck-Cron genutzt: der will linkStatus pflegen, ohne
// Titel/Preis/AliExpress-Link aus Versehen zu überschreiben.
export async function updateProduktExtra(
  rowIndex: number,
  extra: ProduktExtra,
): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `Produkte!H${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [[JSON.stringify(extra || {})]] },
  });
}

// ─── CHATS (Tab 3) ────────────────────────────────────────────────
// Columns: A=ID, B=Name, C=Description, D=CreatedAt, E=CreatedBy,
//          F=AllowCustomerMessages, G=Status, H=Category

export interface ChatRoom {
  rowIndex: number;
  id: string;
  name: string;
  description: string;
  createdAt: string;
  createdBy: string;
  allowCustomerMessages: boolean;
  status: string;
  category: string;
}

function rowToChatRoom(row: string[], index: number): ChatRoom {
  return {
    rowIndex: index + 2,
    id: row[0] || "",
    name: row[1] || "",
    description: row[2] || "",
    createdAt: row[3] || "",
    createdBy: row[4] || "",
    allowCustomerMessages: row[5] === "true",
    status: row[6] || "active",
    category: row[7] || "general",
  };
}

export async function getAllChatRooms(): Promise<ChatRoom[]> {
  const sheets = getSheets();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: "Chats!A2:H",
    });
    const rows = res.data.values || [];
    return rows.map((row, i) => rowToChatRoom(row, i)).filter((r) => r.id && r.status === "active");
  } catch (err) {
    console.error("[Sheets] getAllChatRooms error:", err);
    return [];
  }
}

export async function addChatRoom(room: Omit<ChatRoom, "rowIndex">): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID(),
    range: "Chats!A:H",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        room.id, room.name, room.description, room.createdAt,
        room.createdBy, String(room.allowCustomerMessages), room.status,
        room.category || "general",
      ]],
    },
  });
}

export async function updateChatRoom(rowIndex: number, room: Omit<ChatRoom, "rowIndex">): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `Chats!A${rowIndex}:H${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        room.id, room.name, room.description, room.createdAt,
        room.createdBy, String(room.allowCustomerMessages), room.status,
        room.category || "general",
      ]],
    },
  });
}

// ─── NACHRICHTEN (Tab 4) ──────────────────────────────────────────
// Columns: A=ID, B=ChatID, C=SenderType, D=SenderID, E=SenderName,
//          F=Content, G=ImageUrl, H=ImageBgColor, I=Status, J=CreatedAt

export interface ChatMessage {
  rowIndex: number;
  id: string;
  chatId: string;
  senderType: string;
  senderId: string;
  senderName: string;
  content: string;
  imageUrl: string;
  imageBgColor: string;
  messageStatus: string;
  createdAt: string;
}

function rowToChatMessage(row: string[], index: number): ChatMessage {
  return {
    rowIndex: index + 2,
    id: row[0] || "",
    chatId: row[1] || "",
    senderType: row[2] || "",
    senderId: row[3] || "",
    senderName: row[4] || "",
    content: row[5] || "",
    imageUrl: row[6] || "",
    imageBgColor: row[7] || "",
    messageStatus: row[8] || "approved",
    createdAt: row[9] || "",
  };
}

export async function getChatMessages(chatId: string, includeHidden = false): Promise<ChatMessage[]> {
  const sheets = getSheets();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: "Nachrichten!A2:J",
    });
    const rows = res.data.values || [];
    return rows
      .map((row, i) => rowToChatMessage(row, i))
      .filter((m) => m.id && m.chatId === chatId && (includeHidden || m.messageStatus !== "hidden"));
  } catch {
    return [];
  }
}

export async function getAllPendingMessages(): Promise<ChatMessage[]> {
  const sheets = getSheets();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: "Nachrichten!A2:J",
    });
    const rows = res.data.values || [];
    return rows
      .map((row, i) => rowToChatMessage(row, i))
      .filter((m) => m.id && m.messageStatus === "pending");
  } catch {
    return [];
  }
}

export async function addChatMessage(msg: Omit<ChatMessage, "rowIndex">): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID(),
    range: "Nachrichten!A:J",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        msg.id, msg.chatId, msg.senderType, msg.senderId, msg.senderName,
        msg.content, msg.imageUrl, msg.imageBgColor, msg.messageStatus, msg.createdAt,
      ]],
    },
  });
}

export async function updateMessageStatus(rowIndex: number, status: string): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `Nachrichten!I${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [[status]] },
  });
}

// ─── NEWS SLIDER (Tab 5) ──────────────────────────────────────────
// Columns: A=ID, B=Title, C=Subtitle, D=ImageUrl, E=LinkUrl, F=Active, G=CreatedAt

export interface NewsSlide {
  rowIndex: number;
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  linkUrl: string;
  active: boolean;
  createdAt: string;
}

function rowToNewsSlide(row: string[], index: number): NewsSlide {
  return {
    rowIndex: index + 2,
    id: row[0] || "",
    title: row[1] || "",
    subtitle: row[2] || "",
    imageUrl: row[3] || "",
    linkUrl: row[4] || "",
    active: row[5] !== "false",
    createdAt: row[6] || "",
  };
}

export async function getAllNewsSlides(): Promise<NewsSlide[]> {
  const sheets = getSheets();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: "NewsSlider!A2:G",
    });
    const rows = res.data.values || [];
    return rows.map((row, i) => rowToNewsSlide(row, i)).filter((s) => s.id);
  } catch {
    return [];
  }
}

export async function addNewsSlide(slide: Omit<NewsSlide, "rowIndex">): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID(),
    range: "NewsSlider!A:G",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        slide.id, slide.title, slide.subtitle, slide.imageUrl,
        slide.linkUrl, String(slide.active), slide.createdAt,
      ]],
    },
  });
}

export async function deleteNewsSlide(rowIndex: number): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `NewsSlider!A${rowIndex}:G${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [["", "", "", "", "", "", ""]] },
  });
}

// ─── NEWS POSTS (Tab "NewsPosts") ─────────────────────────────────
// Admin-curated news cards rendered on the home page.
//   A=ID, B=Type ("text" or "video"), C=Title, D=Body (markdown/plain),
//   E=ImageUrl, F=YoutubeUrl, G=PreviewImageUrl, H=Active, I=CreatedAt,
//   J=TitleEn, K=BodyEn
// Text cards: image is the cover, body opens in a detail modal.
// Video cards: previewImage is the cover, click opens youtube embed.
// Zweisprachig: TitleEn/BodyEn sind optional. Fehlen sie, fällt die
// englische Ansicht auf die deutschen Felder zurück.

const NEWS_HEADERS = [
  "ID", "Type", "Title", "Body", "ImageUrl", "YoutubeUrl",
  "PreviewImageUrl", "Active", "CreatedAt", "TitleEn", "BodyEn",
];

export interface NewsPost {
  rowIndex: number;
  id: string;
  type: "text" | "video";
  title: string;
  body: string;
  imageUrl: string;
  youtubeUrl: string;
  previewImageUrl: string;
  active: boolean;
  createdAt: string;
  titleEn: string;
  bodyEn: string;
}

function rowToNewsPost(row: string[], index: number): NewsPost {
  return {
    rowIndex: index + 2,
    id: row[0] || "",
    type: (row[1] as NewsPost["type"]) || "text",
    title: row[2] || "",
    body: row[3] || "",
    imageUrl: row[4] || "",
    youtubeUrl: row[5] || "",
    previewImageUrl: row[6] || "",
    active: row[7] !== "false",
    createdAt: row[8] || "",
    titleEn: row[9] || "",
    bodyEn: row[10] || "",
  };
}

export async function getAllNewsPosts(): Promise<NewsPost[]> {
  const sheets = getSheets();
  try {
    await ensureSheet("NewsPosts", NEWS_HEADERS);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: "NewsPosts!A2:K",
    });
    const rows = res.data.values || [];
    return rows.map((row, i) => rowToNewsPost(row, i)).filter((p) => p.id);
  } catch {
    return [];
  }
}

export async function addNewsPost(post: Omit<NewsPost, "rowIndex">): Promise<void> {
  const sheets = getSheets();
  await ensureSheet("NewsPosts", NEWS_HEADERS);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID(),
    range: "NewsPosts!A:K",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        post.id, post.type, post.title, post.body, post.imageUrl,
        post.youtubeUrl, post.previewImageUrl, String(post.active), post.createdAt,
        post.titleEn, post.bodyEn,
      ]],
    },
  });
}

export async function updateNewsPost(
  rowIndex: number,
  patch: Partial<Omit<NewsPost, "rowIndex" | "id" | "createdAt">>,
): Promise<void> {
  const sheets = getSheets();
  // Read the existing row to merge non-provided fields.
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: `NewsPosts!A${rowIndex}:K${rowIndex}`,
  });
  const row = res.data.values?.[0] || [];
  const merged: NewsPost = {
    rowIndex,
    id: row[0] || "",
    type: (patch.type ?? (row[1] as NewsPost["type"])) || "text",
    title: patch.title ?? row[2] ?? "",
    body: patch.body ?? row[3] ?? "",
    imageUrl: patch.imageUrl ?? row[4] ?? "",
    youtubeUrl: patch.youtubeUrl ?? row[5] ?? "",
    previewImageUrl: patch.previewImageUrl ?? row[6] ?? "",
    active: patch.active ?? row[7] !== "false",
    createdAt: row[8] || "",
    titleEn: patch.titleEn ?? row[9] ?? "",
    bodyEn: patch.bodyEn ?? row[10] ?? "",
  };
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `NewsPosts!A${rowIndex}:K${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        merged.id, merged.type, merged.title, merged.body, merged.imageUrl,
        merged.youtubeUrl, merged.previewImageUrl, String(merged.active), merged.createdAt,
        merged.titleEn, merged.bodyEn,
      ]],
    },
  });
}

export async function deleteNewsPost(rowIndex: number): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `NewsPosts!A${rowIndex}:K${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [["", "", "", "", "", "", "", "", "", "", ""]] },
  });
}

// ─── TRANSLATIONS (Tab "Translations") ────────────────────────────
// KV-Cache für KI-Übersetzungen (lib/translate.ts). Jede Quell-Phrase
// wird einmal per Claude übersetzt und hier dauerhaft gespeichert →
// danach kostenlos. Schlüssel = sha1(Quelltext) (kurz). Pro Sprache
// eine Zeile.
//   A=Key (Hash), B=Lang, C=Source (gekürzt, nur Debug), D=Value, E=UpdatedAt

const TRANSLATIONS_HEADERS = ["Key", "Lang", "Source", "Value", "UpdatedAt"];

// Liefert eine Map hash→Übersetzung für die gewünschte Sprache.
export async function getTranslationCache(lang: string): Promise<Map<string, string>> {
  const sheets = getSheets();
  const map = new Map<string, string>();
  try {
    await ensureSheet("Translations", TRANSLATIONS_HEADERS);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: "Translations!A2:E",
    });
    for (const row of res.data.values || []) {
      const key = row[0];
      const rowLang = row[1];
      const value = row[3];
      if (key && rowLang === lang && typeof value === "string") map.set(key, value);
    }
  } catch (err) {
    console.error("[Translations] read failed:", err);
  }
  return map;
}

// Hängt neue Übersetzungen an (append, ein Aufruf für alle Einträge).
export async function addTranslationEntries(
  lang: string,
  entries: { key: string; source: string; value: string }[],
): Promise<void> {
  if (entries.length === 0) return;
  const sheets = getSheets();
  await ensureSheet("Translations", TRANSLATIONS_HEADERS);
  const now = new Date().toISOString();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID(),
    range: "Translations!A:E",
    valueInputOption: "RAW",
    requestBody: {
      values: entries.map((e) => [e.key, lang, e.source.slice(0, 200), e.value, now]),
    },
  });
}

// ─── THEMES (Tab "Themes") ────────────────────────────────────────
// Admin lädt Shopify-Themes als ZIP hoch (via /api/upload → Vercel Blob,
// Ordner themes/). Die Metadaten liegen hier; Kunden laden per Klick die
// Blob-URL. Es werden immer nur die 10 neuesten Versionen behalten (der
// Prune passiert beim Anlegen in /api/admin/themes).
//   A=ID, B=Name, C=Version, D=Url, E=FileName, F=SizeBytes, G=CreatedAt

const THEMES_HEADERS = ["ID", "Name", "Version", "Url", "FileName", "SizeBytes", "CreatedAt"];

export interface Theme {
  rowIndex: number;
  id: string;
  name: string;
  version: string;
  url: string;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
}

function rowToTheme(row: string[], i: number): Theme {
  return {
    rowIndex: i + 2,
    id: row[0] || "",
    name: row[1] || "",
    version: row[2] || "",
    url: row[3] || "",
    fileName: row[4] || "",
    sizeBytes: Number.parseInt(row[5] || "0", 10) || 0,
    createdAt: row[6] || "",
  };
}

export async function getAllThemes(): Promise<Theme[]> {
  const sheets = getSheets();
  try {
    await ensureSheet("Themes", THEMES_HEADERS);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: "Themes!A2:G",
    });
    const rows = res.data.values || [];
    return rows.map((row, i) => rowToTheme(row, i)).filter((t) => t.id && t.url);
  } catch {
    return [];
  }
}

export async function addTheme(theme: Omit<Theme, "rowIndex">): Promise<void> {
  const sheets = getSheets();
  await ensureSheet("Themes", THEMES_HEADERS);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID(),
    range: "Themes!A:G",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        theme.id, theme.name, theme.version, theme.url,
        theme.fileName, String(theme.sizeBytes), theme.createdAt,
      ]],
    },
  });
}

export async function deleteTheme(rowIndex: number): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `Themes!A${rowIndex}:G${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [["", "", "", "", "", "", ""]] },
  });
}

// ─── SCOUT CACHE (Tab "ScoutCache") ──────────────────────────────
// Globaler, PRODUKT-basierter Video-Cache für den Video Scout. Findet EIN
// Kunde per Apify Videos zu einem Produkt, landen sie hier — der NÄCHSTE
// Kunde mit demselben Produkt wird daraus bedient, ohne dass ein neuer
// (teurer) Apify-Run nötig ist. Pro Produkt EINE Zeile; die Videos liegen
// als JSON in einer Zelle. Die Thumbnails sind bereits auf Vercel Blob
// re-hostet (stabile, kurze URLs) — der Cache bleibt also auch nach Tagen
// gültig und die Zelle klein. Cap pro Produkt hält die Zelle unter dem
// 50k-Zeichen-Limit.
//   A=ProductId, B=VideosJson, C=Count, D=UpdatedAt
const SCOUT_CACHE_HEADERS = ["ProductId", "VideosJson", "Count", "UpdatedAt"];
const SCOUT_CACHE_MAX = 60;

/** Gemeinsamer Video-Pool zu einem Produkt (leer, wenn nichts gecacht). */
export async function getScoutCache(productId: string): Promise<ScoutVideo[]> {
  if (!productId) return [];
  const sheets = getSheets();
  try {
    await ensureSheet("ScoutCache", SCOUT_CACHE_HEADERS);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: "ScoutCache!A2:B",
    });
    const rows = res.data.values || [];
    const hit = rows.find((r) => (r[0] || "") === productId);
    if (!hit || !hit[1]) return [];
    const parsed = JSON.parse(hit[1]);
    return Array.isArray(parsed) ? (parsed as ScoutVideo[]) : [];
  } catch {
    return [];
  }
}

/** Neue Videos in den gemeinsamen Produkt-Cache mergen (dedupe per URL,
 *  neueste/stärkste zuerst, gedeckelt). Upsert: bestehende Produktzeile
 *  wird per `values.update` überschrieben, neue Produkte angehängt. */
export async function addToScoutCache(productId: string, videos: ScoutVideo[]): Promise<void> {
  if (!productId || videos.length === 0) return;
  const sheets = getSheets();
  await ensureSheet("ScoutCache", SCOUT_CACHE_HEADERS);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: "ScoutCache!A2:B",
  });
  const rows = res.data.values || [];
  const idx = rows.findIndex((r) => (r[0] || "") === productId);

  let existing: ScoutVideo[] = [];
  if (idx >= 0 && rows[idx][1]) {
    try {
      const p = JSON.parse(rows[idx][1]);
      if (Array.isArray(p)) existing = p as ScoutVideo[];
    } catch {
      /* defekte Zelle ignorieren, frisch befüllen */
    }
  }

  const seen = new Set<string>();
  const merged: ScoutVideo[] = [];
  for (const v of [...videos, ...existing]) {
    if (!v?.url || seen.has(v.url)) continue;
    seen.add(v.url);
    merged.push(v);
    if (merged.length >= SCOUT_CACHE_MAX) break;
  }

  const rowValues = [productId, JSON.stringify(merged), String(merged.length), new Date().toISOString()];
  if (idx >= 0) {
    const rowNumber = idx + 2; // +2: Header + 0-basiert
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID(),
      range: `ScoutCache!A${rowNumber}:D${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [rowValues] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID(),
      range: "ScoutCache!A:D",
      valueInputOption: "RAW",
      requestBody: { values: [rowValues] },
    });
  }
}

// ─── BUYBOX SYNC (Tab "BuyboxConfigs") ───────────────────────────
// Live-Sync der dynamischen Buy Box: Der Theme-Export schreibt nur noch
// EINEN brospify_buybox-Block ins ZIP; das Design (Bausteine, Presets,
// Farben, Texte) liegt hier als fertig aufgelöster Render-Plan (JSON in
// einer Zelle) und wird vom Kunden-Shop über den Code abgerufen
// (GET /api/buybox/[code], öffentlich). Pro Code EINE Zeile, Upsert.
//   A=Code, B=User, C=ProductId, D=PlanJson, E=UpdatedAt, F=Active
const BUYBOX_HEADERS = ["Code", "User", "ProductId", "PlanJson", "UpdatedAt", "Active"];

/** Render-Plan + Besitzer zu einem Sync-Code — null wenn unbekannt/inaktiv.
 *  `user` (Spalte B) braucht der öffentliche Buybox-Endpoint fürs Abo-Gate. */
/** WIRFT bei Infrastruktur-Fehlern (Quota/Netz/Auth) statt sie zu
 *  schlucken — für Storefront-Gates, die „Sheets-Ausfall" von „Code
 *  existiert nicht" unterscheiden MÜSSEN: ein Ausfall darf nie als
 *  cachebares 404-Verdikt enden (fail-open-Invariante). */
export async function getBuyboxPlanByCodeStrict(code: string): Promise<{ planJson: string; user: string } | null> {
  if (!code) return null;
  const sheets = getSheets();
  await ensureSheet("BuyboxConfigs", BUYBOX_HEADERS);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: "BuyboxConfigs!A2:F",
  });
  const rows = res.data.values || [];
  const hit = rows.find((r) => (r[0] || "") === code);
  if (!hit || !hit[3]) return null;
  if (String(hit[5] ?? "1") === "0") return null; // deaktiviert
  return { planJson: String(hit[3]), user: String(hit[1] || "") };
}

export async function getBuyboxPlanByCode(code: string): Promise<{ planJson: string; user: string } | null> {
  try {
    return await getBuyboxPlanByCodeStrict(code);
  } catch {
    return null;
  }
}

/** Render-Plan unter einem Code speichern (Upsert: bestehende Code-Zeile
 *  wird per values.update überschrieben — Design-Updates erreichen so alle
 *  Shops mit diesem Code, ohne neues Theme-ZIP). */
export async function saveBuyboxPlan(code: string, user: string, productId: string, planJson: string): Promise<void> {
  if (!code || !planJson) return;
  const sheets = getSheets();
  await ensureSheet("BuyboxConfigs", BUYBOX_HEADERS);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: "BuyboxConfigs!A2:A",
  });
  const rows = res.data.values || [];
  const idx = rows.findIndex((r) => (r[0] || "") === code);
  const rowValues = [code, user, productId, planJson, new Date().toISOString(), "1"];
  if (idx >= 0) {
    const rowNumber = idx + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID(),
      range: `BuyboxConfigs!A${rowNumber}:F${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [rowValues] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID(),
      range: "BuyboxConfigs!A:F",
      valueInputOption: "RAW",
      requestBody: { values: [rowValues] },
    });
  }
}

// ─── THEME-DESIGNS (Tab "ThemeDesigns") ──────────────────────────
// Benannte Design-Speicherstände des Theme-Editors. Jedes Design hat einen
// EIGENEN Sync-Code (= Live-Buybox-Code): Der Kunde speichert mehrere
// Designs, sieht deren Codes im Editor und wechselt das Live-Design im
// Shop, indem er einen anderen Code in den Shopify-Block einträgt.
//   A=Code, B=User, C=ProductId, D=Name, E=DocJson, F=UpdatedAt
const DESIGN_HEADERS = ["Code", "User", "ProductId", "Name", "DocJson", "UpdatedAt"];

export interface ThemeDesignMeta {
  code: string;
  productId: string;
  name: string;
  updatedAt: string;
}

export async function listThemeDesigns(user: string, productId?: string): Promise<ThemeDesignMeta[]> {
  const sheets = getSheets();
  try {
    await ensureSheet("ThemeDesigns", DESIGN_HEADERS);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: "ThemeDesigns!A2:F",
    });
    const rows = res.data.values || [];
    return rows
      .filter((r) => (r[0] || "") && (r[1] || "") === user && (!productId || (r[2] || "") === productId))
      .map((r) => ({ code: String(r[0]), productId: String(r[2] || ""), name: String(r[3] || ""), updatedAt: String(r[5] || "") }))
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  } catch {
    return [];
  }
}

/** WIRFT bei Infrastruktur-Fehlern (Quota/Netz/Auth) — siehe
 *  getBuyboxPlanByCodeStrict: die Storefront-Gates (asset/status/render)
 *  brauchen den Unterschied „Ausfall" vs. „Code nicht gefunden", sonst
 *  sperrt ein Sheets-Schluckauf zahlende Shops (24h-Negativ-Cache im
 *  Overlay-Gate, cachebare 404 am CDN). */
export async function getThemeDesignStrict(code: string): Promise<{ user: string; productId: string; name: string; docJson: string } | null> {
  if (!code) return null;
  const sheets = getSheets();
  await ensureSheet("ThemeDesigns", DESIGN_HEADERS);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: "ThemeDesigns!A2:F",
  });
  const rows = res.data.values || [];
  const hit = rows.find((r) => (r[0] || "") === code);
  if (!hit || !hit[4]) return null;
  return { user: String(hit[1] || ""), productId: String(hit[2] || ""), name: String(hit[3] || ""), docJson: String(hit[4]) };
}

export async function getThemeDesign(code: string): Promise<{ user: string; productId: string; name: string; docJson: string } | null> {
  try {
    return await getThemeDesignStrict(code);
  } catch {
    return null;
  }
}

/** Design speichern (Upsert per Code). */
export async function saveThemeDesign(code: string, user: string, productId: string, name: string, docJson: string): Promise<void> {
  if (!code || !docJson) return;
  const sheets = getSheets();
  await ensureSheet("ThemeDesigns", DESIGN_HEADERS);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: "ThemeDesigns!A2:A",
  });
  const rows = res.data.values || [];
  const idx = rows.findIndex((r) => (r[0] || "") === code);
  const rowValues = [code, user, productId, name, docJson, new Date().toISOString()];
  if (idx >= 0) {
    const rowNumber = idx + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID(),
      range: `ThemeDesigns!A${rowNumber}:F${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [rowValues] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID(),
      range: "ThemeDesigns!A:F",
      valueInputOption: "RAW",
      requestBody: { values: [rowValues] },
    });
  }
}

/** Design löschen (Zeile leeren; nur wenn `user` der Besitzer ist).
 *  Der Live-Plan unterm Code bleibt bewusst aktiv — Shops, die den Code
 *  bereits nutzen, verlieren ihr Design nicht. */
export async function deleteThemeDesign(code: string, user: string): Promise<boolean> {
  if (!code) return false;
  const sheets = getSheets();
  await ensureSheet("ThemeDesigns", DESIGN_HEADERS);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: "ThemeDesigns!A2:B",
  });
  const rows = res.data.values || [];
  const idx = rows.findIndex((r) => (r[0] || "") === code && (r[1] || "") === user);
  if (idx < 0) return false;
  const rowNumber = idx + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `ThemeDesigns!A${rowNumber}:F${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [["", "", "", "", "", ""]] },
  });
  return true;
}

export interface ScoutCacheEntry {
  productId: string;
  videos: ScoutVideo[];
  rowNumber: number;
}

/** Alle Cache-Zeilen (für den wöchentlichen Link-Check/Prune). */
export async function listScoutCacheEntries(): Promise<ScoutCacheEntry[]> {
  const sheets = getSheets();
  try {
    await ensureSheet("ScoutCache", SCOUT_CACHE_HEADERS);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: "ScoutCache!A2:B",
    });
    const rows = res.data.values || [];
    const out: ScoutCacheEntry[] = [];
    rows.forEach((r, i) => {
      const productId = r[0] || "";
      if (!productId || !r[1]) return;
      let videos: ScoutVideo[] = [];
      try {
        const p = JSON.parse(r[1]);
        if (Array.isArray(p)) videos = p as ScoutVideo[];
      } catch {
        /* defekte Zelle überspringen */
      }
      out.push({ productId, videos, rowNumber: i + 2 });
    });
    return out;
  } catch {
    return [];
  }
}

/** Cache-Zeile mit der bereinigten Video-Liste überschreiben. Ist die Liste
 *  leer (alle Links tot), wird die Zeile geleert. */
export async function setScoutCacheVideos(
  rowNumber: number,
  productId: string,
  videos: ScoutVideo[],
): Promise<void> {
  const sheets = getSheets();
  const values = videos.length === 0
    ? [["", "", "", ""]]
    : [[productId, JSON.stringify(videos), String(videos.length), new Date().toISOString()]];
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `ScoutCache!A${rowNumber}:D${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values },
  });
}

// ─── SURVEY (Tab "SurveyResponses") ──────────────────────────────
// Gestaffelte User-Umfragen. Eine Zeile je Abgabe; die Antworten liegen als
// JSON in einer Zelle. Definition + Aggregation in lib/survey.
//   A=Id, B=User, C=SurveyId, D=SubmittedAt, E=AnswersJson, F=MetaJson (Timing)
const SURVEY_HEADERS = ["Id", "User", "SurveyId", "SubmittedAt", "AnswersJson", "MetaJson"];

export async function addSurveyResponse(
  user: string,
  surveyId: string,
  answers: SurveyAnswers,
  meta?: SurveyResponseMeta,
): Promise<void> {
  const sheets = getSheets();
  await ensureSheet("SurveyResponses", SURVEY_HEADERS);
  const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID(),
    range: "SurveyResponses!A:F",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        id, user || "", surveyId, new Date().toISOString(),
        JSON.stringify(answers), meta ? JSON.stringify(meta) : "",
      ]],
    },
  });
}

/** Markiert eine Umfrage als abgeschlossen UND schreibt die Belohnungs-
 *  Credits gut — atomar in EINEM Profil-Write. Idempotent: ist die Umfrage
 *  schon abgeschlossen, passiert nichts (kein Doppel-Credit). */
export async function completeSurvey(
  rowIndex: number,
  profile: KundeProfile,
  surveyId: string,
  reward: number,
): Promise<{ balance: number; awarded: number; already: boolean }> {
  const completed = Array.isArray(profile.surveysCompleted) ? profile.surveysCompleted : [];
  const credits = normalizeCredits(profile.credits);
  if (completed.includes(surveyId)) {
    return { balance: credits.balance, awarded: 0, already: true };
  }
  const amount = Math.max(0, Math.round(reward));
  const nowIso = new Date().toISOString();
  const newBalance = credits.balance + amount;
  const next: CreditsRecord = {
    ...credits,
    balance: newBalance,
    totalPurchased: credits.totalPurchased + amount,
    log: appendLog(credits.log, {
      ts: nowIso,
      type: "survey",
      delta: amount,
      balanceAfter: newBalance,
      reason: "Umfrage abgeschlossen",
    }),
    lastUpdated: nowIso,
    ...(newBalance >= LOW_CREDITS_THRESHOLD ? { lowCreditsAlertedAt: undefined } : {}),
  };
  await updateKundeProfile(rowIndex, {
    ...profile,
    credits: next,
    surveysCompleted: [...completed, surveyId],
  });
  return { balance: newBalance, awarded: amount, already: false };
}

export async function listSurveyResponses(): Promise<SurveyResponseRecord[]> {
  const sheets = getSheets();
  try {
    await ensureSheet("SurveyResponses", SURVEY_HEADERS);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: "SurveyResponses!A2:F",
    });
    const rows = res.data.values || [];
    const out: SurveyResponseRecord[] = [];
    for (const r of rows) {
      const id = r[0] || "";
      const answersRaw = r[4];
      if (!id || !answersRaw) continue;
      let answers: SurveyAnswers = {};
      try {
        const p = JSON.parse(answersRaw);
        if (p && typeof p === "object") answers = p as SurveyAnswers;
      } catch {
        continue;
      }
      let meta: SurveyResponseMeta | undefined;
      if (r[5]) {
        try {
          const pm = JSON.parse(r[5]);
          if (pm && typeof pm === "object") meta = pm as SurveyResponseMeta;
        } catch {
          /* ignorieren */
        }
      }
      out.push({ id, user: r[1] || "", surveyId: r[2] || "", submittedAt: r[3] || "", answers, meta });
    }
    // Neueste zuerst.
    return out.reverse();
  } catch {
    return [];
  }
}

// ─── START TASKS (Tab "StartTasks") ───────────────────────────────
// Admin-curated checklist that replaces the old Shopify-app-only
// insights on the home page. Each task is a short title plus optional
// rich text (sanitised HTML — only <a>, <strong>, <em>, <br>) that the
// admin maintains in the home page's Verwalten modal.
//   A=ID, B=Title, C=BodyHtml, D=Sort, E=Active, F=CreatedAt
// Users tick tasks off; completion is stored per-user in
// KundeProfile.onboarding_tasks_done so it never overwrites the
// shared task definitions.

const START_TASKS_HEADERS = ["ID", "Title", "BodyHtml", "Sort", "Active", "CreatedAt"];

export interface StartTask {
  rowIndex: number;
  id: string;
  title: string;
  bodyHtml: string;
  sort: number;
  active: boolean;
  createdAt: string;
}

function rowToStartTask(row: string[], index: number): StartTask {
  return {
    rowIndex: index + 2,
    id: row[0] || "",
    title: row[1] || "",
    bodyHtml: row[2] || "",
    sort: Number(row[3] || 0) || 0,
    active: row[4] !== "false",
    createdAt: row[5] || "",
  };
}

export async function getAllStartTasks(): Promise<StartTask[]> {
  const sheets = getSheets();
  try {
    await ensureSheet("StartTasks", START_TASKS_HEADERS);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: "StartTasks!A2:F",
    });
    const rows = res.data.values || [];
    const list = rows.map((row, i) => rowToStartTask(row, i)).filter((t) => t.id);
    list.sort((a, b) => a.sort - b.sort || (a.createdAt || "").localeCompare(b.createdAt || ""));
    return list;
  } catch {
    return [];
  }
}

export async function addStartTask(task: Omit<StartTask, "rowIndex">): Promise<void> {
  const sheets = getSheets();
  await ensureSheet("StartTasks", START_TASKS_HEADERS);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID(),
    range: "StartTasks!A:F",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        task.id, task.title, task.bodyHtml, String(task.sort),
        String(task.active), task.createdAt,
      ]],
    },
  });
}

export async function updateStartTask(
  rowIndex: number,
  patch: Partial<Omit<StartTask, "rowIndex" | "id" | "createdAt">>,
): Promise<void> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: `StartTasks!A${rowIndex}:F${rowIndex}`,
  });
  const row = res.data.values?.[0] || [];
  const merged: StartTask = {
    rowIndex,
    id: row[0] || "",
    title: patch.title ?? row[1] ?? "",
    bodyHtml: patch.bodyHtml ?? row[2] ?? "",
    sort: patch.sort ?? Number(row[3] || 0) ?? 0,
    active: patch.active ?? row[4] !== "false",
    createdAt: row[5] || "",
  };
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `StartTasks!A${rowIndex}:F${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        merged.id, merged.title, merged.bodyHtml, String(merged.sort),
        String(merged.active), merged.createdAt,
      ]],
    },
  });
}

export async function deleteStartTask(rowIndex: number): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `StartTasks!A${rowIndex}:F${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [["", "", "", "", "", ""]] },
  });
}

// ─── CODE BLOCKS (Tab "CodeBlocks") ──────────────────────────────
// Admin-managed Shopify custom-liquid snippets the customer can copy
// and customise. Each block ships with a preview image plus a list of
// "options" — texts/colors the AI detected in the code that the user
// is allowed to tweak. The user-side customiser does literal string
// replacement of `original` → their value.
//
// Columns: A=ID, B=Title, C=Description, D=Code, E=PreviewImageUrl,
//          F=Options_JSON, G=Active, H=CreatedAt

export interface CodeBlockOption {
  /** Stable key for React + replacement bookkeeping. */
  id: string;
  /** Human label shown in the customiser, e.g. "Button-Farbe". */
  label: string;
  type: "text" | "color";
  /** The exact substring in `code` this option replaces. */
  original: string;
}

export interface CodeBlock {
  rowIndex: number;
  id: string;
  title: string;
  description: string;
  code: string;
  previewImageUrl: string;
  options: CodeBlockOption[];
  active: boolean;
  createdAt: string;
}

const CODE_BLOCKS_HEADERS = [
  "ID", "Title", "Description", "Code", "PreviewImageUrl",
  "Options_JSON", "Active", "CreatedAt",
];

function parseCodeBlockOptions(raw: string): CodeBlockOption[] {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw);
    if (!Array.isArray(j)) return [];
    return j
      .filter((o) => o && typeof o === "object")
      .map((o, i): CodeBlockOption => ({
        id: typeof o.id === "string" && o.id ? o.id : `opt_${i}`,
        label: typeof o.label === "string" ? o.label : `Option ${i + 1}`,
        type: o.type === "color" ? "color" : "text",
        original: typeof o.original === "string" ? o.original : "",
      }))
      .filter((o) => o.original);
  } catch {
    return [];
  }
}

function rowToCodeBlock(row: string[], index: number): CodeBlock {
  return {
    rowIndex: index + 2,
    id: row[0] || "",
    title: row[1] || "",
    description: row[2] || "",
    code: row[3] || "",
    previewImageUrl: row[4] || "",
    options: parseCodeBlockOptions(row[5] || ""),
    active: row[6] !== "false",
    createdAt: row[7] || "",
  };
}

function codeBlockToRow(b: Omit<CodeBlock, "rowIndex">): string[] {
  return [
    b.id, b.title, b.description, b.code, b.previewImageUrl,
    JSON.stringify(b.options || []), String(b.active), b.createdAt,
  ];
}

export async function getAllCodeBlocks(): Promise<CodeBlock[]> {
  const sheets = getSheets();
  try {
    await ensureSheet("CodeBlocks", CODE_BLOCKS_HEADERS);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: "CodeBlocks!A2:H",
    });
    const rows = res.data.values || [];
    return rows.map((row, i) => rowToCodeBlock(row, i)).filter((b) => b.id);
  } catch (err) {
    console.error("[Sheets] getAllCodeBlocks error:", err);
    return [];
  }
}

export async function addCodeBlock(block: Omit<CodeBlock, "rowIndex">): Promise<void> {
  const sheets = getSheets();
  await ensureSheet("CodeBlocks", CODE_BLOCKS_HEADERS);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID(),
    range: "CodeBlocks!A:H",
    valueInputOption: "RAW",
    requestBody: { values: [codeBlockToRow(block)] },
  });
}

export async function updateCodeBlock(
  rowIndex: number,
  patch: Partial<Omit<CodeBlock, "rowIndex" | "id" | "createdAt">>,
): Promise<void> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: `CodeBlocks!A${rowIndex}:H${rowIndex}`,
  });
  const row = res.data.values?.[0] || [];
  const existing = rowToCodeBlock(row, rowIndex - 2);
  const merged: Omit<CodeBlock, "rowIndex"> = {
    id: existing.id,
    title: patch.title ?? existing.title,
    description: patch.description ?? existing.description,
    code: patch.code ?? existing.code,
    previewImageUrl: patch.previewImageUrl ?? existing.previewImageUrl,
    options: patch.options ?? existing.options,
    active: patch.active ?? existing.active,
    createdAt: existing.createdAt,
  };
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `CodeBlocks!A${rowIndex}:H${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [codeBlockToRow(merged)] },
  });
}

export async function deleteCodeBlock(rowIndex: number): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `CodeBlocks!A${rowIndex}:H${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [["", "", "", "", "", "", "", ""]] },
  });
}

// ─── COACHING TIPS (Tab "CoachingTips") ──────────────────────────
// Membership-only knowledge feed. Admin (or AI) drops in tips the
// customer reads on /coaching. The WhatsApp contact number lives in
// the Settings sheet under key `coaching_whatsapp`.
//
// Columns: A=ID, B=Title, C=Body, D=MediaUrl, E=Author, F=Active,
//          G=CreatedAt

export interface CoachingTip {
  rowIndex: number;
  id: string;
  title: string;
  body: string;
  mediaUrl: string;
  /** "admin" or "ai" — shows a small badge on the card. */
  author: string;
  active: boolean;
  createdAt: string;
}

const COACHING_TIPS_HEADERS = [
  "ID", "Title", "Body", "MediaUrl", "Author", "Active", "CreatedAt",
];

function rowToCoachingTip(row: string[], index: number): CoachingTip {
  return {
    rowIndex: index + 2,
    id: row[0] || "",
    title: row[1] || "",
    body: row[2] || "",
    mediaUrl: row[3] || "",
    author: row[4] || "admin",
    active: row[5] !== "false",
    createdAt: row[6] || "",
  };
}

function coachingTipToRow(t: Omit<CoachingTip, "rowIndex">): string[] {
  return [
    t.id, t.title, t.body, t.mediaUrl, t.author,
    String(t.active), t.createdAt,
  ];
}

export async function getAllCoachingTips(): Promise<CoachingTip[]> {
  const sheets = getSheets();
  try {
    await ensureSheet("CoachingTips", COACHING_TIPS_HEADERS);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: "CoachingTips!A2:G",
    });
    const rows = res.data.values || [];
    return rows.map((row, i) => rowToCoachingTip(row, i)).filter((t) => t.id);
  } catch (err) {
    console.error("[Sheets] getAllCoachingTips error:", err);
    return [];
  }
}

export async function addCoachingTip(tip: Omit<CoachingTip, "rowIndex">): Promise<void> {
  const sheets = getSheets();
  await ensureSheet("CoachingTips", COACHING_TIPS_HEADERS);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID(),
    range: "CoachingTips!A:G",
    valueInputOption: "RAW",
    requestBody: { values: [coachingTipToRow(tip)] },
  });
}

export async function updateCoachingTip(
  rowIndex: number,
  patch: Partial<Omit<CoachingTip, "rowIndex" | "id" | "createdAt">>,
): Promise<void> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: `CoachingTips!A${rowIndex}:G${rowIndex}`,
  });
  const row = res.data.values?.[0] || [];
  const existing = rowToCoachingTip(row, rowIndex - 2);
  const merged: Omit<CoachingTip, "rowIndex"> = {
    id: existing.id,
    title: patch.title ?? existing.title,
    body: patch.body ?? existing.body,
    mediaUrl: patch.mediaUrl ?? existing.mediaUrl,
    author: patch.author ?? existing.author,
    active: patch.active ?? existing.active,
    createdAt: existing.createdAt,
  };
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `CoachingTips!A${rowIndex}:G${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [coachingTipToRow(merged)] },
  });
}

export async function deleteCoachingTip(rowIndex: number): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `CoachingTips!A${rowIndex}:G${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [["", "", "", "", "", "", ""]] },
  });
}

// ─── TICKETS (Tab 6) ─────────────────────────────────────────────
// Columns: A=ID, B=CustomerKey, C=CustomerName, D=Subject, E=Status,
//          F=CreatedAt, G=UpdatedAt, H=Messages_JSON

export interface TicketMessage {
  sender: "customer" | "admin" | "ai";
  name: string;
  content: string;
  timestamp: string;
}

export interface Ticket {
  rowIndex: number;
  id: string;
  customerKey: string;
  customerName: string;
  subject: string;
  status: "open" | "resolved" | "closed";
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

function rowToTicket(row: string[], index: number): Ticket {
  let messages: TicketMessage[] = [];
  try { messages = JSON.parse(row[7] || "[]"); } catch { messages = []; }
  return {
    rowIndex: index + 2,
    id: row[0] || "",
    customerKey: row[1] || "",
    customerName: row[2] || "",
    subject: row[3] || "",
    status: (row[4] as Ticket["status"]) || "open",
    createdAt: row[5] || "",
    updatedAt: row[6] || "",
    messages,
  };
}

export async function getAllTickets(): Promise<Ticket[]> {
  const sheets = getSheets();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: "Tickets!A2:H",
    });
    const rows = res.data.values || [];
    return rows.map((row, i) => rowToTicket(row, i)).filter((t) => t.id);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("Unable to parse range") || errMsg.includes("not found")) {
      console.log("[Sheets] Tickets tab not found, creating...");
      await ensureSheet("Tickets", ["Ticket_ID", "Customer_Key", "Customer_Name", "Subject", "Status", "Created_At", "Updated_At", "Messages_JSON"]);
    } else {
      console.error("[Sheets] getAllTickets error:", err);
    }
    return [];
  }
}

export async function getTicketsByCustomer(customerKey: string): Promise<Ticket[]> {
  const all = await getAllTickets();
  return all.filter((t) => t.customerKey === customerKey);
}

export async function getTicketById(ticketId: string): Promise<Ticket | null> {
  const all = await getAllTickets();
  return all.find((t) => t.id === ticketId) || null;
}

export async function addTicket(ticket: Omit<Ticket, "rowIndex">): Promise<void> {
  const sheets = getSheets();
  const row = [
    ticket.id, ticket.customerKey, ticket.customerName, ticket.subject,
    ticket.status, ticket.createdAt, ticket.updatedAt,
    JSON.stringify(ticket.messages),
  ];

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID(),
      range: "Tickets!A:H",
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  } catch (err: unknown) {
    // If the tab doesn't exist, create it and retry
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("Unable to parse range") || errMsg.includes("not found")) {
      console.log("[Sheets] Tickets tab not found, creating it...");
      await ensureSheet("Tickets", ["Ticket_ID", "Customer_Key", "Customer_Name", "Subject", "Status", "Created_At", "Updated_At", "Messages_JSON"]);
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID(),
        range: "Tickets!A:H",
        valueInputOption: "RAW",
        requestBody: { values: [row] },
      });
    } else {
      throw err;
    }
  }
}

export async function updateTicket(
  rowIndex: number,
  updates: { status?: string; messages?: TicketMessage[]; updatedAt?: string }
): Promise<void> {
  const sheets = getSheets();
  const data: { range: string; values: string[][] }[] = [];
  if (updates.status) {
    data.push({ range: `Tickets!E${rowIndex}`, values: [[updates.status]] });
  }
  if (updates.updatedAt) {
    data.push({ range: `Tickets!G${rowIndex}`, values: [[updates.updatedAt]] });
  }
  if (updates.messages) {
    data.push({ range: `Tickets!H${rowIndex}`, values: [[JSON.stringify(updates.messages)]] });
  }
  if (data.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID(),
      requestBody: { valueInputOption: "RAW", data },
    });
  }
}

// ─── ADMIN SETTINGS (Tab 7 - Settings) ──────────────────────────
// Columns: A=Key, B=Value
// Used for: ai_knowledge_base, etc.

export async function getAdminSetting(key: string): Promise<string> {
  const sheets = getSheets();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: "Settings!A2:B",
    });
    const rows = res.data.values || [];
    const row = rows.find((r) => r[0] === key);
    return row?.[1] || "";
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("Unable to parse range") || errMsg.includes("not found")) {
      console.log("[Sheets] Settings tab not found, creating...");
      await ensureSheet("Settings", ["Key", "Value"]);
    } else {
      console.error("[Sheets] getAdminSetting error:", err);
    }
    return "";
  }
}

export async function setAdminSetting(key: string, value: string): Promise<void> {
  const sheets = getSheets();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: "Settings!A2:B",
    });
    const rows = res.data.values || [];
    const idx = rows.findIndex((r) => r[0] === key);
    if (idx >= 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID(),
        range: `Settings!B${idx + 2}`,
        valueInputOption: "RAW",
        requestBody: { values: [[value]] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID(),
        range: "Settings!A:B",
        valueInputOption: "RAW",
        requestBody: { values: [[key, value]] },
      });
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("Unable to parse range") || errMsg.includes("not found")) {
      console.log("[Sheets] Settings tab not found, creating...");
      await ensureSheet("Settings", ["Key", "Value"]);
      // Retry the append after creating the tab
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID(),
        range: "Settings!A:B",
        valueInputOption: "RAW",
        requestBody: { values: [[key, value]] },
      });
    } else {
      console.error("[Sheets] setAdminSetting error:", err);
    }
  }
}

// ─── CREDIT CODES (Tab "CreditCodes") ─────────────────────────────
// Admin-issued voucher codes. Each row defines one code, the credit
// payout per redemption, the per-account redemption limit, and a
// freeform note for internal record-keeping.
//
// Columns: A=Code, B=Credits, C=MaxPerAccount, D=Active,
//          E=CreatedAt, F=Note, G=TotalRedemptions

export interface CreditCode {
  rowIndex: number;
  code: string;
  credits: number;
  maxPerAccount: number;
  active: boolean;
  createdAt: string;
  note: string;
  totalRedemptions: number;
}

const CREDIT_CODES_HEADERS = [
  "Code",
  "Credits",
  "Max_Per_Account",
  "Active",
  "Created_At",
  "Note",
  "Total_Redemptions",
];

function rowToCreditCode(row: string[], index: number): CreditCode {
  return {
    rowIndex: index + 2,
    code: (row[0] || "").trim().toUpperCase(),
    credits: Number.parseInt(row[1] || "0", 10) || 0,
    maxPerAccount: Math.max(1, Number.parseInt(row[2] || "1", 10) || 1),
    active: (row[3] || "").toLowerCase() !== "false",
    createdAt: row[4] || "",
    note: row[5] || "",
    totalRedemptions: Number.parseInt(row[6] || "0", 10) || 0,
  };
}

export async function getAllCreditCodes(): Promise<CreditCode[]> {
  const sheets = getSheets();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: "CreditCodes!A2:G",
    });
    const rows = res.data.values || [];
    return rows.map((row, i) => rowToCreditCode(row, i)).filter((c) => c.code);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unable to parse range") || msg.includes("not found")) {
      console.log("[Sheets] CreditCodes tab not found, creating...");
      await ensureSheet("CreditCodes", CREDIT_CODES_HEADERS);
    } else {
      console.error("[Sheets] getAllCreditCodes error:", err);
    }
    return [];
  }
}

export async function findCreditCode(code: string): Promise<CreditCode | null> {
  const target = code.trim().toUpperCase();
  if (!target) return null;
  const all = await getAllCreditCodes();
  return all.find((c) => c.code === target) || null;
}

export async function addCreditCode(
  input: Omit<CreditCode, "rowIndex" | "totalRedemptions">,
): Promise<void> {
  const sheets = getSheets();
  const row = [
    input.code.trim().toUpperCase(),
    String(Math.max(0, Math.round(input.credits))),
    String(Math.max(1, Math.round(input.maxPerAccount))),
    String(input.active !== false),
    input.createdAt || new Date().toISOString(),
    input.note || "",
    "0",
  ];
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID(),
      range: "CreditCodes!A:G",
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unable to parse range") || msg.includes("not found")) {
      await ensureSheet("CreditCodes", CREDIT_CODES_HEADERS);
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID(),
        range: "CreditCodes!A:G",
        valueInputOption: "RAW",
        requestBody: { values: [row] },
      });
    } else {
      throw err;
    }
  }
}

export async function updateCreditCode(
  rowIndex: number,
  updates: Partial<Pick<CreditCode, "credits" | "maxPerAccount" | "active" | "note" | "totalRedemptions">>,
): Promise<void> {
  const sheets = getSheets();
  const data: { range: string; values: string[][] }[] = [];
  if (typeof updates.credits === "number") {
    data.push({ range: `CreditCodes!B${rowIndex}`, values: [[String(Math.max(0, Math.round(updates.credits)))]] });
  }
  if (typeof updates.maxPerAccount === "number") {
    data.push({ range: `CreditCodes!C${rowIndex}`, values: [[String(Math.max(1, Math.round(updates.maxPerAccount)))]] });
  }
  if (typeof updates.active === "boolean") {
    data.push({ range: `CreditCodes!D${rowIndex}`, values: [[String(updates.active)]] });
  }
  if (typeof updates.note === "string") {
    data.push({ range: `CreditCodes!F${rowIndex}`, values: [[updates.note]] });
  }
  if (typeof updates.totalRedemptions === "number") {
    data.push({ range: `CreditCodes!G${rowIndex}`, values: [[String(Math.max(0, Math.round(updates.totalRedemptions)))]] });
  }
  if (data.length === 0) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID(),
    requestBody: { valueInputOption: "RAW", data },
  });
}

export async function deleteCreditCode(rowIndex: number): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `CreditCodes!A${rowIndex}:G${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [["", "", "", "", "", "", ""]] },
  });
}

// Atomic-ish increment of the lifetime redemption counter on a code.
// Read-then-write — admin-only writes elsewhere mean races are
// effectively impossible for the volumes this thing handles.
export async function bumpCodeRedemptions(rowIndex: number): Promise<void> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: `CreditCodes!G${rowIndex}`,
  });
  const current = Number.parseInt(res.data.values?.[0]?.[0] || "0", 10) || 0;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `CreditCodes!G${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [[String(current + 1)]] },
  });
}

// ─── LIBRARY (Tab "Library") ──────────────────────────────────────
// User-owned media vault. Items are written by every AI tool that
// generates an image or template the user might want to revisit.
//
// Storage strategy (cost-minimised):
//   • Asset blob: WebP @78%   ~  85% smaller than PNG
//   • Thumbnail blob: WebP 320px @70%, ~5–15 KB per item
//   • Template body inline in the sheet (templates are small)
//   • Per-user cap (LIBRARY_MAX_ITEMS) — oldest pruned automatically
//
// Columns: A=ID, B=UserKey, C=Type ("image"|"email"), D=Source,
//          E=Title, F=AssetUrl, G=ThumbnailUrl, H=Body,
//          I=MetaJSON, J=CreatedAt, K=Active
//
// `MetaJSON` carries tool-specific extras (width, height, scale,
// scene name, template id, etc.). Kept as JSON for forward-compat.

export const LIBRARY_MAX_ITEMS = 60;

export type LibraryItemType = "image" | "email";
export type LibrarySource =
  | "upscaler"
  | "bg-remover"
  | "ai-studio"
  | "email-templates"
  | "other";

export interface LibraryItem {
  rowIndex: number;
  id: string;
  userKey: string;
  type: LibraryItemType;
  source: LibrarySource;
  title: string;
  assetUrl: string;
  thumbnailUrl: string;
  body: string;
  meta: Record<string, unknown>;
  createdAt: string;
  active: boolean;
}

const LIBRARY_HEADERS = [
  "ID", "UserKey", "Type", "Source", "Title",
  "AssetUrl", "ThumbnailUrl", "Body", "MetaJSON",
  "CreatedAt", "Active",
];

function rowToLibraryItem(row: string[], index: number): LibraryItem {
  let meta: Record<string, unknown> = {};
  try { meta = JSON.parse(row[8] || "{}"); } catch { meta = {}; }
  return {
    rowIndex: index + 2,
    id: row[0] || "",
    userKey: row[1] || "",
    type: (row[2] as LibraryItemType) || "image",
    source: (row[3] as LibrarySource) || "other",
    title: row[4] || "",
    assetUrl: row[5] || "",
    thumbnailUrl: row[6] || "",
    body: row[7] || "",
    meta,
    createdAt: row[9] || "",
    active: row[10] !== "false",
  };
}

async function ensureLibrarySheet(): Promise<void> {
  await ensureSheet("Library", LIBRARY_HEADERS);
}

export async function getLibraryItems(userKey: string): Promise<LibraryItem[]> {
  if (!userKey) return [];
  const sheets = getSheets();
  try {
    await ensureLibrarySheet();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: "Library!A2:K",
    });
    const rows = res.data.values || [];
    return rows
      .map((row, i) => rowToLibraryItem(row, i))
      .filter((it) => it.id && it.userKey === userKey && it.active);
  } catch {
    return [];
  }
}

export async function addLibraryItem(
  item: Omit<LibraryItem, "rowIndex">,
): Promise<void> {
  const sheets = getSheets();
  await ensureLibrarySheet();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID(),
    range: "Library!A:K",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        item.id, item.userKey, item.type, item.source, item.title,
        item.assetUrl, item.thumbnailUrl, item.body,
        JSON.stringify(item.meta || {}),
        item.createdAt, String(item.active),
      ]],
    },
  });
}

export async function deleteLibraryItem(rowIndex: number): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `Library!A${rowIndex}:K${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [["", "", "", "", "", "", "", "", "", "", ""]] },
  });
}

// Returns items that should be evicted to keep the user under the cap.
// Returned in chronological order so callers can delete blobs first.
export function pickLibraryItemsToEvict(
  items: LibraryItem[],
  cap = LIBRARY_MAX_ITEMS,
): LibraryItem[] {
  if (items.length <= cap) return [];
  const sorted = [...items].sort(
    (a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""),
  );
  return sorted.slice(0, items.length - cap);
}

// ─── ROLE & SUBSCRIPTION HELPERS ──────────────────────────────────
// Admin promotion / demotion + tier overrides. Both end up writing
// the customer's Profil_JSON cell (column J) with merged fields, so
// they cooperate with every other helper that touches the profile.

export async function setUserRole(
  rowIndex: number,
  profile: KundeProfile,
  role: UserRole,
): Promise<KundeProfile> {
  const next: KundeProfile = { ...profile, role };
  await updateKundeProfile(rowIndex, next);
  return next;
}

// Set or change a user's tier. Records `tierSince` when the tier
// actually changes and clears any prior cancellation marker. Ein
// Admin-Grant REAKTIVIERT: eine bereits abgelaufene Laufzeit würde den
// frisch gesetzten Plan sofort wieder aushebeln (resolvePlan prüft
// subscriptionEndsAt) — darum wird sie hier entfernt.
export async function setUserTier(
  rowIndex: number,
  profile: KundeProfile,
  tier: TierKey,
): Promise<KundeProfile> {
  const isChange = (profile.tier || "") !== tier;
  const endsAt = profile.subscriptionEndsAt ? Date.parse(profile.subscriptionEndsAt) : NaN;
  const isExpired = Number.isFinite(endsAt) && endsAt < Date.now();
  const next: KundeProfile = {
    ...profile,
    tier,
    tierSince: isChange ? new Date().toISOString() : profile.tierSince || new Date().toISOString(),
    tierCanceledAt: "",
    ...(isExpired ? { subscriptionEndsAt: undefined } : {}),
  };
  await updateKundeProfile(rowIndex, next);
  return next;
}

// Soft cancel — keeps `tier` so the user retains current-period
// access; sets `tierCanceledAt` so churn metrics pick it up.
export async function cancelUserTier(
  rowIndex: number,
  profile: KundeProfile,
): Promise<KundeProfile> {
  const next: KundeProfile = {
    ...profile,
    tierCanceledAt: new Date().toISOString(),
  };
  await updateKundeProfile(rowIndex, next);
  return next;
}

// Plan KOMPLETT entfernen („Kein Plan" im Admin). Anders als der Soft-
// Cancel wird der Tier selbst gelöscht; die SKU-Spalte muss der Aufrufer
// zusätzlich leeren (updateKundeField "I"), sonst greift der SKU-Fallback
// von resolvePlan weiter. Die bisherige SKU wird fürs Audit im Profil
// archiviert.
export async function removeUserTier(
  rowIndex: number,
  profile: KundeProfile,
  prevSku?: string,
): Promise<KundeProfile> {
  const next: KundeProfile = {
    ...profile,
    tier: undefined,
    tierSince: undefined,
    tierCanceledAt: new Date().toISOString(),
    ...(prevSku ? { skuBeforeRemove: prevSku } : {}),
  };
  await updateKundeProfile(rowIndex, next);
  return next;
}

// Locate a customer by their Google email — checks both the primary
// `kundenEmail` column and the `linkedGoogleEmail` profile field so
// the admin promotion flow works regardless of where the user stored
// the address. Case-insensitive.
export async function findKundeByGoogleEmail(email: string): Promise<Kunde | null> {
  if (!email) return null;
  const target = email.trim().toLowerCase();
  const all = await getAllKunden();
  return (
    all.find((k) => (k.kundenEmail || "").trim().toLowerCase() === target) ||
    all.find((k) => (k.profile.linkedGoogleEmail || "").trim().toLowerCase() === target) ||
    null
  );
}

// Editor-Konto per selbst gewähltem Username finden (case-insensitive).
// Für den Passwort-Login der Standalone-Editor-Website.
export async function findKundeByUsername(username: string): Promise<Kunde | null> {
  const target = (username || "").trim().toLowerCase();
  if (!target) return null;
  const all = await getAllKunden();
  return all.find((k) => (k.profile.username || "").trim().toLowerCase() === target) || null;
}

// Record `signupAt` if missing. Used the first time we see a profile
// without one — backfills with `now()` rather than guessing from the
// log so all future date math has a real anchor.
export async function ensureSignupAt(
  rowIndex: number,
  profile: KundeProfile,
): Promise<KundeProfile> {
  if (profile.signupAt) return profile;
  const next: KundeProfile = { ...profile, signupAt: new Date().toISOString() };
  await updateKundeProfile(rowIndex, next);
  return next;
}

// ─── SYSTEM LOGS (Tab "SystemLogs") ───────────────────────────────
// Append-only audit feed for admin actions, impersonation, role
// changes, tier overrides, and significant errors. Lives in its own
// sheet tab so it doesn't bloat any single profile JSON.
//
// Columns: A=ID, B=Timestamp, C=Level, D=Actor, E=Action, F=Target,
//          G=Details_JSON

export type SystemLogLevel = "info" | "warn" | "error" | "audit";

export interface SystemLogEntry {
  rowIndex: number;
  id: string;
  ts: string;
  level: SystemLogLevel;
  /** Email or licence-key of whoever triggered the event. */
  actor: string;
  /** Short verb phrase, e.g. "role.promote", "impersonate.start". */
  action: string;
  /** Affected customer key / email / id. Empty for system-wide events. */
  target: string;
  details: Record<string, unknown>;
}

const SYSTEM_LOGS_HEADERS = [
  "ID", "Timestamp", "Level", "Actor", "Action", "Target", "Details_JSON",
];

const SYSTEM_LOGS_MAX_ROWS = 5000;

function rowToSystemLog(row: string[], index: number): SystemLogEntry {
  let details: Record<string, unknown> = {};
  try { details = JSON.parse(row[6] || "{}"); } catch { details = {}; }
  return {
    rowIndex: index + 2,
    id: row[0] || "",
    ts: row[1] || "",
    level: (row[2] as SystemLogLevel) || "info",
    actor: row[3] || "",
    action: row[4] || "",
    target: row[5] || "",
    details,
  };
}

// Append a row. Best-effort — never throws into the calling route so
// a sheet outage can't break a critical action like promote/demote.
export async function logSystemEvent(input: {
  level: SystemLogLevel;
  actor: string;
  action: string;
  target?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    const sheets = getSheets();
    await ensureSheet("SystemLogs", SYSTEM_LOGS_HEADERS);
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID(),
      range: "SystemLogs!A:G",
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          id,
          new Date().toISOString(),
          input.level,
          input.actor || "",
          input.action || "",
          input.target || "",
          JSON.stringify(input.details || {}),
        ]],
      },
    });
  } catch (err) {
    console.error("[SystemLogs] append error:", err);
  }
}

export async function getSystemLogs(
  filters: {
    limit?: number;
    level?: SystemLogLevel;
    sinceDays?: number;
    actorContains?: string;
    actionContains?: string;
  } = {},
): Promise<SystemLogEntry[]> {
  const sheets = getSheets();
  try {
    await ensureSheet("SystemLogs", SYSTEM_LOGS_HEADERS);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: "SystemLogs!A2:G",
    });
    const rows = res.data.values || [];
    const parsed = rows
      .map((row, i) => rowToSystemLog(row, i))
      .filter((e) => e.id);

    const cutoff =
      filters.sinceDays && filters.sinceDays > 0
        ? Date.now() - filters.sinceDays * 24 * 60 * 60 * 1000
        : 0;

    const filtered = parsed.filter((e) => {
      if (filters.level && e.level !== filters.level) return false;
      if (cutoff && Date.parse(e.ts) < cutoff) return false;
      if (filters.actorContains && !e.actor.toLowerCase().includes(filters.actorContains.toLowerCase())) return false;
      if (filters.actionContains && !e.action.toLowerCase().includes(filters.actionContains.toLowerCase())) return false;
      return true;
    });

    // Cap to most recent SYSTEM_LOGS_MAX_ROWS for memory safety —
    // older entries fall off the bottom in a future GC pass.
    const recent = filtered.slice(-SYSTEM_LOGS_MAX_ROWS);
    // Newest first
    recent.reverse();

    const limit = filters.limit && filters.limit > 0 ? filters.limit : 200;
    return recent.slice(0, limit);
  } catch (err) {
    console.error("[SystemLogs] read error:", err);
    return [];
  }
}

// ─── LOAD TEST SESSIONS (Tab "LoadTestSessions") ────────────────
// Admin-only Shopify Development-Store load tester. Each row = one
// run: target product, requested duration, chosen frequency mode,
// and the live counters that the dashboard reads back. Strictly
// scoped to *.myshopify.com dev stores (validated at write time)
// so a stray production credential can never end up here.

export type LoadTestMode = "subsecond" | "secondly" | "burst" | "mixed";
export type LoadTestStatus = "running" | "completed" | "stopped" | "failed";

export interface LoadTestSession {
  rowIndex: number;
  id: string;
  productId: string;
  productTitle: string;
  variantId: string;
  unitPrice: string;
  durationMinutes: number;
  mode: LoadTestMode;
  devStoreDomain: string;
  tag: string;
  startedAt: string;
  endsAt: string;
  stoppedAt: string;
  status: LoadTestStatus;
  ordersAttempted: number;
  ordersSucceeded: number;
  ordersFailed: number;
  rateLimited: number;
  avgLatencyMs: number;
  lastError: string;
  createdBy: string;
}

const LOADTEST_HEADERS = [
  "ID", "ProductID", "ProductTitle", "VariantID", "UnitPrice",
  "DurationMinutes", "Mode", "DevStoreDomain", "Tag",
  "StartedAt", "EndsAt", "StoppedAt", "Status",
  "OrdersAttempted", "OrdersSucceeded", "OrdersFailed",
  "RateLimited", "AvgLatencyMs", "LastError", "CreatedBy",
];

function rowToLoadTestSession(row: string[], index: number): LoadTestSession {
  return {
    rowIndex: index + 2,
    id: row[0] || "",
    productId: row[1] || "",
    productTitle: row[2] || "",
    variantId: row[3] || "",
    unitPrice: row[4] || "",
    durationMinutes: Number.parseFloat(row[5] || "0") || 0,
    mode: (row[6] as LoadTestMode) || "mixed",
    devStoreDomain: row[7] || "",
    tag: row[8] || "",
    startedAt: row[9] || "",
    endsAt: row[10] || "",
    stoppedAt: row[11] || "",
    status: (row[12] as LoadTestStatus) || "running",
    ordersAttempted: Number.parseInt(row[13] || "0", 10) || 0,
    ordersSucceeded: Number.parseInt(row[14] || "0", 10) || 0,
    ordersFailed: Number.parseInt(row[15] || "0", 10) || 0,
    rateLimited: Number.parseInt(row[16] || "0", 10) || 0,
    avgLatencyMs: Number.parseFloat(row[17] || "0") || 0,
    lastError: row[18] || "",
    createdBy: row[19] || "",
  };
}

async function ensureLoadTestSheet(): Promise<void> {
  await ensureSheet("LoadTestSessions", LOADTEST_HEADERS);
}

export async function listLoadTestSessions(): Promise<LoadTestSession[]> {
  const sheets = getSheets();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: "LoadTestSessions!A2:T",
    });
    const rows = res.data.values || [];
    const items = rows
      .map((row, i) => rowToLoadTestSession(row as string[], i))
      .filter((s) => s.id);
    // Newest first by startedAt
    items.sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));
    return items;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unable to parse range") || msg.includes("not found")) {
      await ensureLoadTestSheet();
      return [];
    }
    console.error("[Sheets] listLoadTestSessions error:", err);
    return [];
  }
}

export async function getLoadTestSession(id: string): Promise<LoadTestSession | null> {
  if (!id) return null;
  const all = await listLoadTestSessions();
  return all.find((s) => s.id === id) || null;
}

export async function createLoadTestSession(
  input: Omit<LoadTestSession, "rowIndex" | "ordersAttempted" | "ordersSucceeded" | "ordersFailed" | "rateLimited" | "avgLatencyMs" | "lastError" | "stoppedAt">,
): Promise<LoadTestSession> {
  const sheets = getSheets();
  const row = [
    input.id,
    input.productId,
    input.productTitle,
    input.variantId,
    input.unitPrice,
    String(input.durationMinutes),
    input.mode,
    input.devStoreDomain,
    input.tag,
    input.startedAt,
    input.endsAt,
    "",                 // stoppedAt
    input.status,
    "0",                // attempted
    "0",                // succeeded
    "0",                // failed
    "0",                // rateLimited
    "0",                // avgLatency
    "",                 // lastError
    input.createdBy || "",
  ];
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID(),
      range: "LoadTestSessions!A:T",
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unable to parse range") || msg.includes("not found")) {
      await ensureLoadTestSheet();
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID(),
        range: "LoadTestSessions!A:T",
        valueInputOption: "RAW",
        requestBody: { values: [row] },
      });
    } else {
      throw err;
    }
  }
  const created = await getLoadTestSession(input.id);
  if (!created) {
    throw new Error("LoadTestSession write succeeded but row could not be read back");
  }
  return created;
}

export interface LoadTestMetricsUpdate {
  ordersAttempted?: number;
  ordersSucceeded?: number;
  ordersFailed?: number;
  rateLimited?: number;
  avgLatencyMs?: number;
  lastError?: string;
}

// Patch counters on an existing session row. Writes only the columns
// that were passed in so the dashboard's frequent metric pings stay
// cheap (Sheets has a 60 req/min/user write quota).
export async function updateLoadTestSessionMetrics(
  rowIndex: number,
  patch: LoadTestMetricsUpdate,
): Promise<void> {
  const sheets = getSheets();
  const data: { range: string; values: string[][] }[] = [];
  if (typeof patch.ordersAttempted === "number") {
    data.push({ range: `LoadTestSessions!N${rowIndex}`, values: [[String(patch.ordersAttempted)]] });
  }
  if (typeof patch.ordersSucceeded === "number") {
    data.push({ range: `LoadTestSessions!O${rowIndex}`, values: [[String(patch.ordersSucceeded)]] });
  }
  if (typeof patch.ordersFailed === "number") {
    data.push({ range: `LoadTestSessions!P${rowIndex}`, values: [[String(patch.ordersFailed)]] });
  }
  if (typeof patch.rateLimited === "number") {
    data.push({ range: `LoadTestSessions!Q${rowIndex}`, values: [[String(patch.rateLimited)]] });
  }
  if (typeof patch.avgLatencyMs === "number") {
    data.push({ range: `LoadTestSessions!R${rowIndex}`, values: [[String(Math.round(patch.avgLatencyMs))]] });
  }
  if (typeof patch.lastError === "string") {
    data.push({ range: `LoadTestSessions!S${rowIndex}`, values: [[patch.lastError.slice(0, 500)]] });
  }
  if (data.length === 0) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID(),
    requestBody: { valueInputOption: "RAW", data },
  });
}

export async function markLoadTestSessionDone(
  rowIndex: number,
  status: LoadTestStatus,
): Promise<void> {
  const sheets = getSheets();
  const now = new Date().toISOString();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID(),
    requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: `LoadTestSessions!L${rowIndex}`, values: [[now]] }, // stoppedAt
        { range: `LoadTestSessions!M${rowIndex}`, values: [[status]] },
      ],
    },
  });
}
