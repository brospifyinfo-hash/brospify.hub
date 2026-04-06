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

export interface KundeProfile {
  shopify_credentials?: { clientId?: string; clientSecret?: string };
  brand_kit?: { logoUrl?: string; primaryColor?: string; accentColor?: string; toneOfVoice?: string };
  legal_data?: { firmenname?: string; inhaber?: string; strasse?: string; plz?: string; stadt?: string; land?: string; email?: string; telefon?: string; ustId?: string; handelsregister?: string };
  ai_usage?: { month: string; count: number };
  checkout_settings?: CheckoutSettings;
  hasCompletedOnboarding?: boolean;
  linkedGoogleEmail?: string;
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
