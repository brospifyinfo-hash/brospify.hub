import { google } from "googleapis";

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
  type: "starter" | "deduct" | "topup" | "voucher" | "admin-grant" | "admin-revoke";
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
export type TierKey = "starter" | "pro" | "business";

export interface KundeProfile {
  shopify_credentials?: { clientId?: string; clientSecret?: string };
  brand_kit?: { logoUrl?: string; primaryColor?: string; accentColor?: string; toneOfVoice?: string };
  legal_data?: { firmenname?: string; inhaber?: string; strasse?: string; plz?: string; stadt?: string; land?: string; email?: string; telefon?: string; ustId?: string; handelsregister?: string };
  ai_usage?: { month: string; count: number };
  credits?: CreditsRecord;
  checkout_settings?: CheckoutSettings;
  hasCompletedOnboarding?: boolean;
  linkedGoogleEmail?: string;
  onboarding_checklist?: OnboardingChecklist;
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
  /** Shopify customer id (numeric, as string). Stored on first order so
   *  later subscription_contracts/update webhooks can match the licence
   *  even when their payload only carries customer_id, not the email. */
  shopifyCustomerId?: string;
  /** Shopify subscription contract id. Links the licence to the recurring
   *  contract so cancellations can be matched precisely. */
  subscriptionContractId?: string;
}

// ─── CREDIT SYSTEM ────────────────────────────────────────────
// CREDIT_COSTS lives in `./credit-costs` (client-safe). We re-export
// it under the legacy name `CREDIT_LIMITS` so old call sites keep
// working without pulling googleapis into client bundles.
export { CREDIT_COSTS as CREDIT_LIMITS } from "./credit-costs";
import { STARTER_CREDITS } from "./credit-costs";

function normalizeCredits(raw: CreditsRecord | undefined): CreditsRecord {
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
  const newBalance = credits.balance - safeAmount;
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
  };
  await updateKundeProfile(rowIndex, { ...profile, credits: next });
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
  };
  await updateKundeProfile(rowIndex, { ...profile, credits: next });
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
  const newBalance = credits.balance + STARTER_CREDITS;
  const next: CreditsRecord = {
    ...credits,
    balance: newBalance,
    totalPurchased: credits.totalPurchased + STARTER_CREDITS,
    starterGranted: true,
    log: appendLog(credits.log, {
      ts: new Date().toISOString(),
      type: "starter",
      delta: STARTER_CREDITS,
      balanceAfter: newBalance,
      reason: "Willkommens-Bonus",
    }),
    lastUpdated: new Date().toISOString(),
  };
  const updated: KundeProfile = { ...profile, credits: next };
  await updateKundeProfile(rowIndex, updated);
  return { ...updated, __granted: true };
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

export async function findKundeByKey(key: string): Promise<Kunde | null> {
  const kunden = await getAllKunden();
  return kunden.find((k) => k.lizenzschluessel === key) || null;
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

  // CREATE — append a fresh row with the full column layout.
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
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID(),
    range: "Kunden!A:J",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
  // `updatedRange` looks like "Kunden!A42:J42" — pull the trailing row number.
  const rangeStr = res.data.updates?.updatedRange || "";
  const m = rangeStr.match(/!A(\d+):/);
  const rowIndex = m ? Number(m[1]) : -1;
  return { action: "created", rowIndex };
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
  /** Beispielshop, der das Produkt bereits per Dropshipping verkauft. */
  dropshippingExample?: ProduktDropshippingExample;
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

function rowToProdukt(row: string[], index: number): Produkt {
  return {
    rowIndex: index + 2,
    id: row[0] || "",
    sku: row[1] || "",
    monat: "", // Legacy-Feld, nicht mehr im Sheet
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
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID(),
    range: "Produkte!A2:H",
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

export async function addProdukt(produkt: Omit<Produkt, "rowIndex">): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID(),
    range: "Produkte!A:H",
    valueInputOption: "RAW",
    requestBody: { values: [produktToRow(produkt)] },
  });
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
//   E=ImageUrl, F=YoutubeUrl, G=PreviewImageUrl, H=Active, I=CreatedAt
// Text cards: image is the cover, body opens in a detail modal.
// Video cards: previewImage is the cover, click opens youtube embed.

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
  };
}

export async function getAllNewsPosts(): Promise<NewsPost[]> {
  const sheets = getSheets();
  try {
    await ensureSheet("NewsPosts", [
      "ID", "Type", "Title", "Body", "ImageUrl", "YoutubeUrl",
      "PreviewImageUrl", "Active", "CreatedAt",
    ]);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: "NewsPosts!A2:I",
    });
    const rows = res.data.values || [];
    return rows.map((row, i) => rowToNewsPost(row, i)).filter((p) => p.id);
  } catch {
    return [];
  }
}

export async function addNewsPost(post: Omit<NewsPost, "rowIndex">): Promise<void> {
  const sheets = getSheets();
  await ensureSheet("NewsPosts", [
    "ID", "Type", "Title", "Body", "ImageUrl", "YoutubeUrl",
    "PreviewImageUrl", "Active", "CreatedAt",
  ]);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID(),
    range: "NewsPosts!A:I",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        post.id, post.type, post.title, post.body, post.imageUrl,
        post.youtubeUrl, post.previewImageUrl, String(post.active), post.createdAt,
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
    range: `NewsPosts!A${rowIndex}:I${rowIndex}`,
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
  };
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `NewsPosts!A${rowIndex}:I${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        merged.id, merged.type, merged.title, merged.body, merged.imageUrl,
        merged.youtubeUrl, merged.previewImageUrl, String(merged.active), merged.createdAt,
      ]],
    },
  });
}

export async function deleteNewsPost(rowIndex: number): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `NewsPosts!A${rowIndex}:I${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [["", "", "", "", "", "", "", "", ""]] },
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
// Gold-only knowledge feed. Admin (or AI) drops in tips the customer
// reads on /coaching. The WhatsApp contact number lives in the
// Settings sheet under key `coaching_whatsapp`.
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
// actually changes and clears any prior cancellation marker.
export async function setUserTier(
  rowIndex: number,
  profile: KundeProfile,
  tier: TierKey,
): Promise<KundeProfile> {
  const isChange = (profile.tier || "") !== tier;
  const next: KundeProfile = {
    ...profile,
    tier,
    tierSince: isChange ? new Date().toISOString() : profile.tierSince,
    tierCanceledAt: "",
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
