// ─── /api/admin/launch-check ─────────────────────────────────────
// Aggregiert die automatisch prüfbaren Launch-Blocker zu einem Go/No-Go-
// Signal: kritische Env-Vars, API-Guthaben, Produkt-/Theme-Katalog,
// Credit-Modell. Manuelle Schritte (Test-Bestellung, Recht, etc.) kommen
// als statische Checkliste im UI dazu.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { checkAllBalances } from "@/lib/api-balances";
import { getAllProdukte, getAllThemes } from "@/lib/sheets";
import { STARTER_CREDITS, RECURRING_CREDITS, RECURRING_PERIOD_DAYS } from "@/lib/credit-costs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type CheckStatus = "ok" | "warn" | "fail";
type Severity = "blocker" | "warn";

interface CheckItem {
  label: string;
  status: CheckStatus;
  severity: Severity;
  detail?: string;
  fixUrl?: string;
}
interface CheckGroup {
  title: string;
  items: CheckItem[];
}

const has = (k: string) => !!(process.env[k] && String(process.env[k]).trim());

// Launch-kritische Env-Vars. blocker = ohne das geht der Kernbetrieb nicht.
const ENV_BLOCKERS: { key: string; label: string }[] = [
  { key: "GOOGLE_SERVICE_ACCOUNT_EMAIL", label: "Google Sheets — Service Account" },
  { key: "GOOGLE_PRIVATE_KEY", label: "Google Sheets — Private Key" },
  { key: "GOOGLE_SHEET_ID", label: "Google Sheets — Sheet ID" },
  { key: "SESSION_SECRET", label: "Login-Sessions (SESSION_SECRET)" },
  { key: "BLOB_READ_WRITE_TOKEN", label: "Vercel Blob (Uploads/Themes/Thumbnails)" },
  { key: "SHOPIFY_WEBHOOK_SECRET", label: "Shopify Webhook Secret (Bestellung→Lizenz)" },
  { key: "RESEND_API_KEY", label: "Resend API Key (Lizenz-Mail)" },
  { key: "RESEND_FROM_EMAIL", label: "Resend Absender (Kunde)" },
  { key: "LICENSE_API_KEY", label: "License READ Key (Validierung/Tools)" },
  { key: "NEXT_PUBLIC_SITE_URL", label: "Domain (NEXT_PUBLIC_SITE_URL — Lizenz-Mail-Link)" },
];

// Tool-spezifisch: fehlt der Key, fällt NUR dieses Tool aus (kein No-Go).
const ENV_TOOLS: { key: string; label: string }[] = [
  { key: "APIFY_API_TOKEN", label: "Apify (Video Scout)" },
  { key: "ANTHROPIC_API_KEY", label: "Anthropic (Video Scout / Discovery)" },
  { key: "FAL_KEY", label: "Fal (AI Studio, Background Remover)" },
  { key: "REPLICATE_API_TOKEN", label: "Replicate (Image Upscaler)" },
  { key: "DEEPSEEK_API_KEY", label: "DeepSeek (E-Mail-Gen, Support-Bot)" },
  { key: "RESEND_ADMIN_FROM_EMAIL", label: "Resend Absender (Admin-Alerts)" },
  { key: "CRON_SECRET", label: "Cron-Secret (Guthaben-Alerts, Lizenz-Ablauf)" },
  { key: "NEXT_PUBLIC_SHOPIFY_CUSTOMER_PORTAL_URL", label: "Shopify-Kundenportal (Kündigung)" },
  // Nur nötig, wenn die Ausstellung über Shopify Flow / Automation läuft.
  // Beim orders/paid-Webhook (SHOPIFY_WEBHOOK_SECRET) NICHT erforderlich.
  { key: "LICENSE_WRITE_KEY", label: "License WRITE Key (nur für Shopify-Flow-Ausstellung)" },
];

const PRODUCT_MIN = 30;

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  const groups: CheckGroup[] = [];

  // ── 1) Kritische Env-Vars ──
  groups.push({
    title: "Zugang & Geld-Flow (Env)",
    items: ENV_BLOCKERS.map((e) => ({
      label: e.label,
      status: (has(e.key) ? "ok" : "fail") as CheckStatus,
      severity: "blocker" as Severity,
      detail: has(e.key) ? "gesetzt" : "FEHLT in Vercel",
    })),
  });

  // ── 2) Tool-Keys ──
  groups.push({
    title: "Tool-Schlüssel (Env)",
    items: ENV_TOOLS.map((e) => ({
      label: e.label,
      status: (has(e.key) ? "ok" : "warn") as CheckStatus,
      severity: "warn" as Severity,
      detail: has(e.key) ? "gesetzt" : "fehlt — Tool fällt aus",
    })),
  });

  // ── 3) API-Guthaben ──
  try {
    const balances = await checkAllBalances();
    groups.push({
      title: "API-Guthaben (vor dem Drop aufladen!)",
      items: balances.map((b) => {
        let status: CheckStatus = "ok";
        if (b.status === "empty") status = "fail";
        else if (b.status === "low" || b.status === "unknown") status = "warn";
        else if (b.status === "not-configured") status = "warn";
        const detail =
          b.status === "not-configured"
            ? "nicht konfiguriert"
            : b.balanceEur != null
              ? `${b.balanceEur} € Rest`
              : b.raw || b.status;
        return { label: b.label, status, severity: "warn" as Severity, detail, fixUrl: b.billingUrl };
      }),
    });
  } catch (e) {
    groups.push({
      title: "API-Guthaben",
      items: [{ label: "Guthaben-Abfrage", status: "warn", severity: "warn", detail: e instanceof Error ? e.message : "Fehler" }],
    });
  }

  // ── 4) Katalog & Inhalte ──
  const catalog: CheckItem[] = [];
  try {
    const products = (await getAllProdukte()).filter((p) => p.id);
    catalog.push({
      label: `Produkte im Katalog (für Produkt-Drop)`,
      status: products.length === 0 ? "fail" : products.length < PRODUCT_MIN ? "warn" : "ok",
      severity: products.length === 0 ? "blocker" : "warn",
      detail: `${products.length} Produkte${products.length < PRODUCT_MIN ? ` — empfohlen ≥ ${PRODUCT_MIN}, sonst leeren Kunden den Drop` : ""}`,
    });
  } catch (e) {
    catalog.push({ label: "Produkt-Katalog", status: "warn", severity: "warn", detail: e instanceof Error ? e.message : "nicht lesbar" });
  }
  try {
    const themes = await getAllThemes();
    catalog.push({
      label: "Themes zum Download",
      status: themes.length === 0 ? "warn" : "ok",
      severity: "warn",
      detail: `${themes.length} Theme(s)${themes.length === 0 ? " — Kunden brauchen ein Theme" : ""}`,
    });
  } catch (e) {
    catalog.push({ label: "Themes", status: "warn", severity: "warn", detail: e instanceof Error ? e.message : "nicht lesbar" });
  }
  groups.push({ title: "Katalog & Inhalte", items: catalog });

  // ── 5) Credit-Modell ──
  groups.push({
    title: "Credit-Modell",
    items: [
      {
        label: "Willkommens-Credits",
        status: STARTER_CREDITS === 1500 ? "ok" : "warn",
        severity: "warn",
        detail: `${STARTER_CREDITS} Credits beim ersten Login`,
      },
      {
        label: "Fortlaufende Gutschrift",
        status: "ok",
        severity: "warn",
        detail: `+${RECURRING_CREDITS} alle ${RECURRING_PERIOD_DAYS} Tage`,
      },
    ],
  });

  // ── Verdikt ──
  const allItems = groups.flatMap((g) => g.items);
  const blockerFails = allItems.filter((i) => i.severity === "blocker" && i.status === "fail").length;
  const warns = allItems.filter((i) => i.status === "warn" || (i.severity === "warn" && i.status === "fail")).length;
  const verdict: "go" | "caution" | "nogo" = blockerFails > 0 ? "nogo" : warns > 0 ? "caution" : "go";

  return NextResponse.json(
    { verdict, blockerFails, warns, groups, generatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
