// ─── /api/admin/products/repair ───────────────────────────────
// Reparatur-Endpoint fuer kaputte Produktzeilen.
//
// Beobachtetes Muster im Sheet:
//   titel = "prod_1779550740805"  (Auto-ID — sollte NIE im Titel stehen)
//   preis = "LED-Lichtstreifen mit App-Steuerung – RGB & Musiksync"
//                                 (tatsaechlicher Titel im Preis-Feld)
//
// Wie das passiert ist unklar (vermutlich vor unserer Validierung in
// POST/PUT), aber wir koennen die Reparatur ueber ein Muster sicher
// machen: wenn `titel` exakt der Auto-ID-Form entspricht UND `preis`
// ein nicht-numerischer, laengerer Text ist, tauschen wir die beiden
// und leeren das Preis-Feld (es war ja nie ein Preis).
//
// Auth: admin session ODER CRON_SECRET (damit wir auch via curl repair
// triggern koennen).

import { NextRequest, NextResponse } from "next/server";
import {
  getAllProdukte,
  updateProdukt,
  logSystemEvent,
  type Produkt,
} from "@/lib/sheets";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const AUTO_ID_PATTERN = /^prod_\d+(_[a-z0-9]+)?$/i;

/** Sieht der String wie eine reine Zahl (mit optionalem Komma/Punkt) aus? */
function isNumericString(s: string): boolean {
  if (!s) return false;
  return /^[\d.,]+$/.test(s.trim());
}

/** Sieht der String wie ein echter Produkttitel aus (laenger, hat Leerzeichen oder Sonderzeichen)? */
function looksLikeTitle(s: string): boolean {
  if (!s) return false;
  const trimmed = s.trim();
  if (trimmed.length < 6) return false;
  if (isNumericString(trimmed)) return false;
  // Mindestens ein Leerzeichen oder ein Sonderzeichen — keine reine ID/Hash.
  return /[\s–\-_:.&]/.test(trimmed);
}

interface RepairChange {
  rowIndex: number;
  id: string;
  oldTitel: string;
  oldPreis: string;
  newTitel: string;
  newPreis: string;
  action: "swap-titel-preis" | "clear-id-titel";
}

async function isAuthorised(req: NextRequest): Promise<{ ok: boolean; actor: string }> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization") || "";
    if (auth === `Bearer ${cronSecret}`) return { ok: true, actor: "cron" };
  }
  const session = await getSession();
  if (session.isLoggedIn && session.isAdmin) {
    return { ok: true, actor: session.googleEmail || session.lizenzschluessel || "admin" };
  }
  return { ok: false, actor: "" };
}

async function run(req: NextRequest) {
  const auth = await isAuthorised(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let dryRun = false;
  try {
    const body = await req.json();
    if (body?.dryRun === true) dryRun = true;
  } catch {
    // kein body — defaults verwenden
  }

  const changes: RepairChange[] = [];
  let scanned = 0;
  let errors = 0;

  try {
    const produkte = await getAllProdukte();

    for (const p of produkte) {
      if (!p.id) continue;
      scanned++;

      const titelLooksLikeId = AUTO_ID_PATTERN.test((p.titel || "").trim());
      if (!titelLooksLikeId) continue;

      // titel sieht aus wie eine ID. Pruefen ob preis der echte Titel ist.
      const preisStr = (p.preis || "").trim();

      if (looksLikeTitle(preisStr)) {
        // Klassischer Swap: titel <-> preis tauschen, preis leeren.
        const change: RepairChange = {
          rowIndex: p.rowIndex,
          id: p.id,
          oldTitel: p.titel,
          oldPreis: p.preis,
          newTitel: preisStr,
          newPreis: "",
          action: "swap-titel-preis",
        };
        changes.push(change);

        if (!dryRun) {
          try {
            await applyRepair(p, change);
          } catch (e) {
            console.error("[repair] row", p.rowIndex, e);
            errors++;
          }
        }
        continue;
      }

      // preis ist auch keine Hilfe — wenigstens das ID-im-Titel-Feld leeren,
      // damit der User-UI-Fallback "Produkt-Details werden ergaenzt..."
      // greift (statt der haesslichen ID).
      const change: RepairChange = {
        rowIndex: p.rowIndex,
        id: p.id,
        oldTitel: p.titel,
        oldPreis: p.preis,
        newTitel: "",
        newPreis: p.preis,
        action: "clear-id-titel",
      };
      changes.push(change);

      if (!dryRun) {
        try {
          await applyRepair(p, change);
        } catch (e) {
          console.error("[repair] row", p.rowIndex, e);
          errors++;
        }
      }
    }

    void logSystemEvent({
      level: changes.length > 0 ? "audit" : "info",
      actor: auth.actor,
      action: dryRun ? "products.repair.dryrun" : "products.repair",
      target: "",
      details: { scanned, changed: changes.length, errors },
    });

    return NextResponse.json({
      success: true,
      dryRun,
      scanned,
      changed: changes.length,
      errors,
      changes,
    });
  } catch (err) {
    console.error("[repair] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Repair fehlgeschlagen." },
      { status: 500 },
    );
  }
}

async function applyRepair(p: Produkt, change: RepairChange): Promise<void> {
  await updateProdukt(p.rowIndex, {
    id: p.id,
    sku: p.sku,
    monat: p.monat,
    titel: change.newTitel,
    bildUrl: p.bildUrl,
    beschreibung: p.beschreibung,
    preis: change.newPreis,
    aliExpressLink: p.aliExpressLink,
    extra: p.extra,
  });
}

export async function POST(req: NextRequest) {
  return run(req);
}

export async function GET(req: NextRequest) {
  return run(req);
}
