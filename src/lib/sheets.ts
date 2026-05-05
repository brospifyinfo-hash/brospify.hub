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

// One-time welcome grant. Idempotent: if `starterGranted` is already
// set on the credits record we no-op and return the existing profile.
// Otherwise we add STARTER_CREDITS to the balance, bump
// totalPurchased so the analytics line up, and persist the flag.
export async function ensureStarterGrant(
  rowIndex: number,
  profile: KundeProfile,
): Promise<KundeProfile> {
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
  return updated;
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

// ─── PRODUKTE (Tab 2) ──────────────────────────────────────────
// Columns: A=ID, B=SKU, C=Monat, D=Titel, E=Bild_URL,
//          F=Beschreibung, G=Preis, H=AliExpress_Link, I=Extra_JSON

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

export interface ProduktExtra {
  stats?: ProduktStats;
  finances?: ProduktFinances;
  images?: string[];
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
    monat: row[2] || "",
    titel: row[3] || "",
    bildUrl: row[4] || "",
    beschreibung: row[5] || "",
    preis: row[6] || "",
    aliExpressLink: row[7] || "",
    extra: parseExtra(row[8] || ""),
  };
}

export async function getAllProdukte(): Promise<Produkt[]> {
  const sheets = getSheets();
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
    produkt.id,
    produkt.sku,
    produkt.monat,
    produkt.titel,
    produkt.bildUrl,
    produkt.beschreibung,
    produkt.preis,
    produkt.aliExpressLink,
    JSON.stringify(produkt.extra || {}),
  ];
}

export async function addProdukt(produkt: Omit<Produkt, "rowIndex">): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID(),
    range: "Produkte!A:I",
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
    range: `Produkte!A${rowIndex}:I${rowIndex}`,
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
    range: "Produkte!A:I",
    valueInputOption: "RAW",
    requestBody: { values },
  });
}

export async function deleteProdukt(rowIndex: number): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `Produkte!A${rowIndex}:I${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [["", "", "", "", "", "", "", "", ""]] },
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
