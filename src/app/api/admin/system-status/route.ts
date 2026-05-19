// ─── /api/admin/system-status ───────────────────────────────────
// One-shot health overview for the admin System tab. Returns:
//   • sheetTabs[]         { name, exists, rowCount }   for the tabs we use
//   • blob                { count, sampleSize }        — raw count of blobs
//                                                          in the project's
//                                                          Vercel Blob store
//   • envChecks[]         { key, configured }          — required + optional
//                                                          env vars, no values
//   • timestamps          { latestKundeIso, latestTxIso, latestNewsIso }
//   • libraryStorageEstimateMb (rough KB sum / 1024)

import { NextResponse } from "next/server";
import { list } from "@vercel/blob";
import { google } from "googleapis";
import { getSession } from "@/lib/session";
import { getAllKunden, getAllNewsPosts } from "@/lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SHEET_TABS_TO_CHECK = [
  "Kunden",
  "Produkte",
  "Chats",
  "Nachrichten",
  "NewsSlider",
  "NewsPosts",
  "Tickets",
  "Settings",
  "CreditCodes",
  "Library",
];

const ENV_VARS_TO_CHECK = [
  { key: "GOOGLE_SERVICE_ACCOUNT_EMAIL", required: true, label: "Google Sheets Service Account" },
  { key: "GOOGLE_PRIVATE_KEY", required: true, label: "Google Sheets Private Key" },
  { key: "GOOGLE_SHEET_ID", required: true, label: "Sheet ID" },
  { key: "BLOB_READ_WRITE_TOKEN", required: true, label: "Vercel Blob Token" },
  { key: "SESSION_SECRET", required: true, label: "Session Secret" },
  { key: "FAL_KEY", required: false, label: "Fal.ai (BG Remover, AI Studio)" },
  { key: "REPLICATE_API_TOKEN", required: false, label: "Replicate (Upscaler)" },
  { key: "DEEPSEEK_API_KEY", required: false, label: "DeepSeek (AI Chat / Email Gen)" },
  { key: "NEXT_PUBLIC_APP_URL", required: false, label: "Public App URL" },
  { key: "LICENSE_API_KEY", required: false, label: "License READ Key (Theme)" },
  { key: "LICENSE_WRITE_KEY", required: true, label: "License WRITE Key (Make.com)" },
  { key: "SHOPIFY_WEBHOOK_SECRET", required: false, label: "Shopify Webhook Secret" },
  { key: "RESEND_API_KEY", required: false, label: "Resend API Key (Mail)" },
  { key: "RESEND_FROM_EMAIL", required: false, label: "Resend From-Address" },
  { key: "CRON_SECRET", required: false, label: "Cron Secret (Vercel Cron)" },
];

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  // ── Sheet status ──
  const sheetTabs: { name: string; exists: boolean; rowCount: number; error?: string }[] = [];
  try {
    const sheetsClient = google.sheets({
      version: "v4",
      auth: new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      }),
    });
    const meta = await sheetsClient.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID || "",
    });
    const existingNames = new Set(meta.data.sheets?.map((s) => s.properties?.title) ?? []);
    for (const tab of SHEET_TABS_TO_CHECK) {
      if (!existingNames.has(tab)) {
        sheetTabs.push({ name: tab, exists: false, rowCount: 0 });
        continue;
      }
      try {
        const res = await sheetsClient.spreadsheets.values.get({
          spreadsheetId: process.env.GOOGLE_SHEET_ID || "",
          range: `${tab}!A2:A`,
        });
        sheetTabs.push({
          name: tab,
          exists: true,
          rowCount: (res.data.values?.length ?? 0),
        });
      } catch (err) {
        sheetTabs.push({
          name: tab,
          exists: true,
          rowCount: 0,
          error: err instanceof Error ? err.message.slice(0, 100) : "unknown",
        });
      }
    }
  } catch (err) {
    sheetTabs.push({
      name: "(Sheet-API)",
      exists: false,
      rowCount: 0,
      error: err instanceof Error ? err.message.slice(0, 100) : "unknown",
    });
  }

  // ── Blob status ──
  let blobCount = 0;
  let blobBytesEstimate = 0;
  try {
    let cursor: string | undefined;
    let safety = 5; // page-cap to avoid hammering the API
    do {
      const res = await list({ limit: 1000, cursor });
      for (const b of res.blobs) {
        blobCount++;
        blobBytesEstimate += b.size || 0;
      }
      cursor = res.cursor;
      safety--;
    } while (cursor && safety > 0);
  } catch (err) {
    console.error("[system-status] blob list error:", err);
  }

  // ── Env vars ──
  const envChecks = ENV_VARS_TO_CHECK.map((v) => ({
    key: v.key,
    label: v.label,
    required: v.required,
    configured: !!(process.env[v.key] && String(process.env[v.key]).length > 0),
  }));

  // ── Activity timestamps ──
  let latestKundeIso = "";
  let latestTxIso = "";
  let latestNewsIso = "";
  try {
    const kunden = await getAllKunden();
    for (const k of kunden) {
      const c = k.profile.credits;
      if (c?.lastUpdated && c.lastUpdated > latestKundeIso) latestKundeIso = c.lastUpdated;
      const log = Array.isArray(c?.log) ? c.log : [];
      for (const tx of log) {
        if (tx.ts > latestTxIso) latestTxIso = tx.ts;
      }
    }
  } catch { /* ignore */ }
  try {
    const posts = await getAllNewsPosts();
    for (const p of posts) {
      if (p.createdAt > latestNewsIso) latestNewsIso = p.createdAt;
    }
  } catch { /* ignore */ }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    sheetTabs,
    blob: {
      count: blobCount,
      bytesEstimate: blobBytesEstimate,
      mbEstimate: +(blobBytesEstimate / (1024 * 1024)).toFixed(2),
    },
    envChecks,
    timestamps: { latestKundeIso, latestTxIso, latestNewsIso },
  });
}
