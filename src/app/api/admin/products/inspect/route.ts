// ─── /api/admin/products/inspect ────────────────────────────
// Liest die Produkte-Tabelle ROH aus Google Sheets — inkl. Header-
// Zeile — und gibt jede Spalte mit ihrer Position zurueck. So sehen
// wir definitiv ob die Sheet-Spalten in der Reihenfolge sind die der
// Code erwartet (A=ID, B=SKU, C=Monat, D=Titel, E=Bild_URL,
// F=Beschreibung, G=Preis, H=AliExpress_Link, I=Extra_JSON).

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { google } from "googleapis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  return session.isLoggedIn && session.isAdmin;
}

const EXPECTED_COLUMNS = [
  "ID",
  "SKU",
  "Monat",
  "Titel",
  "Bild_URL",
  "Beschreibung",
  "Preis",
  "AliExpress_Link",
  "Extra_JSON",
];

export async function GET(_req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!privateKey || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SHEET_ID) {
    return NextResponse.json({ error: "Google Sheets credentials not configured" }, { status: 500 });
  }

  try {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    // Lies die ersten 5 Zeilen + ALLE Spalten (A bis Z um sicher zu gehen).
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Produkte!A1:Z5",
    });
    const rows = res.data.values || [];
    const header = rows[0] || [];
    const dataRows = rows.slice(1);

    // Mappe Header zu Position (A, B, C, ...).
    const columns = header.map((name, i) => ({
      letter: String.fromCharCode(65 + i),
      index: i,
      headerName: name,
      expected: EXPECTED_COLUMNS[i] || "(nicht erwartet)",
      matches: EXPECTED_COLUMNS[i] === name,
    }));

    const mismatchedColumns = columns.filter((c) => !c.matches);
    const sheetIsOk = mismatchedColumns.length === 0 && columns.length >= EXPECTED_COLUMNS.length;

    return NextResponse.json({
      sheetIsOk,
      summary: sheetIsOk
        ? "Sheet-Spalten stimmen mit dem Code überein."
        : `${mismatchedColumns.length} Spalten passen NICHT. Code liest/schreibt nach falschem Schema → erklärt den titel/preis-Swap.`,
      columnsInSheet: columns,
      expectedSchema: EXPECTED_COLUMNS.map((name, i) => ({
        letter: String.fromCharCode(65 + i),
        index: i,
        expectedName: name,
      })),
      sampleRows: dataRows.map((row, i) => ({
        rowNumber: i + 2,
        cells: row.map((value, idx) => ({
          letter: String.fromCharCode(65 + idx),
          headerName: header[idx] || "(no header)",
          value: typeof value === "string" ? value.slice(0, 80) : value,
        })),
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Inspect fehlgeschlagen." },
      { status: 500 },
    );
  }
}
