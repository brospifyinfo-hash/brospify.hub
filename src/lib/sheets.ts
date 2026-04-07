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
  legal_texts_generated?: boolean;
  theme_pushed?: boolean;
}

export interface KundeProfile {
  shopify_credentials?: { clientId?: string; clientSecret?: string };
  brand_kit?: { logoUrl?: string; primaryColor?: string; accentColor?: string; toneOfVoice?: string };
  legal_data?: { firmenname?: string; inhaber?: string; strasse?: string; plz?: string; stadt?: string; land?: string; email?: string; telefon?: string; ustId?: string; handelsregister?: string };
  ai_usage?: { month: string; count: number };
  checkout_settings?: CheckoutSettings;
  hasCompletedOnboarding?: boolean;
  linkedGoogleEmail?: string;
  onboarding_checklist?: OnboardingChecklist;
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
//          F=AllowCustomerMessages, G=Status

export interface ChatRoom {
  rowIndex: number;
  id: string;
  name: string;
  description: string;
  createdAt: string;
  createdBy: string;
  allowCustomerMessages: boolean;
  status: string;
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
  };
}

export async function getAllChatRooms(): Promise<ChatRoom[]> {
  const sheets = getSheets();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range: "Chats!A2:G",
    });
    const rows = res.data.values || [];
    return rows.map((row, i) => rowToChatRoom(row, i)).filter((r) => r.id && r.status === "active");
  } catch {
    return [];
  }
}

export async function addChatRoom(room: Omit<ChatRoom, "rowIndex">): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID(),
    range: "Chats!A:G",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        room.id, room.name, room.description, room.createdAt,
        room.createdBy, String(room.allowCustomerMessages), room.status,
      ]],
    },
  });
}

export async function updateChatRoom(rowIndex: number, room: Omit<ChatRoom, "rowIndex">): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID(),
    range: `Chats!A${rowIndex}:G${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        room.id, room.name, room.description, room.createdAt,
        room.createdBy, String(room.allowCustomerMessages), room.status,
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
