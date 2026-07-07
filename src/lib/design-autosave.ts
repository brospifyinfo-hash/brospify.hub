import "server-only";

// ─── Automatische Design-Vorlagen ───────────────────────────────────
// Jeder Theme-Download sichert den Editor-Stand automatisch:
//  (1) rollend unter dem Live-Sync-Code („Aktueller Shop-Stand") — immer
//      genau der Stand, der gerade im Shop hängt; „Live aktualisieren"
//      hält diese Vorlage synchron.
//  (2) als datierter Schnappschuss mit EIGENEM Code — ältere Stände bleiben
//      abrufbar (History) und der Code ist sofort im Shop nutzbar. Nur die
//      ältesten AUTO-Schnappschüsse werden aufgeräumt (Cap); manuell
//      benannte Designs werden NIE angefasst.
// Fehler hier sind NIE fatal — Download/Update laufen immer weiter.

import { listThemeDesigns, saveThemeDesign, saveBuyboxPlan, deleteThemeDesign } from "@/lib/sheets";
import { generateSyncCode } from "@/lib/buybox-plan";
import type { ThemeDocument } from "@/lib/theme-doc";

export const AUTO_LIVE_NAME = "Aktueller Shop-Stand";
export const AUTO_SNAP_PREFIX = "Download ";
const AUTO_SNAP_KEEP = 8;

function stamp(): string {
  try {
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
      timeZone: "Europe/Berlin",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 16).replace("T", " ");
  }
}

/** Rollende Vorlage unter dem Live-Code aktuell halten (Upsert per Code). */
export async function upsertLiveDesign(code: string, user: string, productId: string, doc: ThemeDocument): Promise<void> {
  try {
    await saveThemeDesign(code, user, productId, AUTO_LIVE_NAME, JSON.stringify(doc));
  } catch (e) {
    console.warn("[design-autosave] Live-Vorlage fehlgeschlagen (nicht fatal):", e);
  }
}

/** Datierten Schnappschuss anlegen (eigener Code, sofort im Shop nutzbar)
 *  und alte Auto-Schnappschüsse über dem Limit entfernen. */
export async function snapshotDesign(user: string, productId: string, doc: ThemeDocument, planJson: string): Promise<void> {
  try {
    const snapCode = generateSyncCode();
    await saveThemeDesign(snapCode, user, productId, `${AUTO_SNAP_PREFIX}${stamp()}`, JSON.stringify(doc));
    await saveBuyboxPlan(snapCode, user, productId, planJson);
    // Aufräumen: nur Auto-Schnappschüsse, neueste zuerst (Liste ist sortiert).
    const all = await listThemeDesigns(user, productId);
    const autos = all.filter((d) => d.name.startsWith(AUTO_SNAP_PREFIX));
    for (const old of autos.slice(AUTO_SNAP_KEEP)) {
      await deleteThemeDesign(old.code, user);
    }
  } catch (e) {
    console.warn("[design-autosave] Schnappschuss fehlgeschlagen (nicht fatal):", e);
  }
}
