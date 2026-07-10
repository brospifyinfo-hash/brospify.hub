// ─── Theme-Editor-Config + Beispiel-Design (server-only) ────────────
// Der Admin bereitet EIN Design (Sync-Code aus dem Editor, z. B. für den
// „Tragbaren USB Mixer") vor und hinterlegt den Code im Admin-Bereich.
// Kunden bekommen dieses Design im Start-Fenster als „Beispiel-Produkt":
// die Generierung wird nur INSZENIERT (kein AI-Call, keine Credits) —
// das Ziel-Dokument ist immer exakt das Admin-Design.
// Zusätzlich: globale Editor-Ansicht (Black/White-Mode).
// Storage: Google-Sheets-KV (Tab "Settings"), Key theme_editor_config_v1.

import "server-only";
import { getAdminSetting, setAdminSetting, getThemeDesign, getAllProdukte, type Produkt } from "@/lib/sheets";
import { customToProdukt, isCustomProductId, listCustomProductsOfOwner } from "@/lib/custom-products";
import { isValidDocument } from "@/lib/theme-compile";
import type { ThemeDocument } from "@/lib/theme-doc";

const CONFIG_KEY = "theme_editor_config_v1";

export type EditorAppearance = "black" | "white";

export interface ThemeEditorConfig {
  /** Sync-/Design-Code des vorbereiteten Beispiel-Designs ("" = keine Demo). */
  demoDesignCode: string;
  /** Editor-Ansicht für ALLE Nutzer. */
  appearance: EditorAppearance;
  /** Produkt-Übersicht „Wähle dein Produkt" (Schritt 1) anzeigen? Standard
   *  AUS: „Von 0 starten" geht dann DIREKT in den leeren Editor (mit einem
   *  automatisch angelegten leeren eigenen Produkt) statt übers Grid. Der
   *  Admin kann die Übersicht hier jederzeit wieder aktivieren — der
   *  Picker-Code bleibt vollständig erhalten. */
  showProductPicker: boolean;
}

const DEFAULTS: ThemeEditorConfig = { demoDesignCode: "", appearance: "black", showProductPicker: false };

// Config wird bei JEDEM Editor-Open gelesen (public Route) — kurzer
// In-Memory-Cache schützt die projektweit geteilte Sheets-Read-Quota
// (Muster: credit-config-server.ts). Save aktualisiert den Cache sofort.
const CFG_TTL_MS = 30_000;
let cfgCache: { cfg: ThemeEditorConfig; at: number } | null = null;

export function normalizeAppearance(v: unknown): EditorAppearance {
  return v === "white" ? "white" : "black";
}

export async function getThemeEditorConfig(): Promise<ThemeEditorConfig> {
  if (cfgCache && Date.now() - cfgCache.at < CFG_TTL_MS) return { ...cfgCache.cfg };
  try {
    const raw = await getAdminSetting(CONFIG_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<ThemeEditorConfig>) : {};
    const cfg: ThemeEditorConfig = {
      demoDesignCode: typeof parsed.demoDesignCode === "string" ? parsed.demoDesignCode.trim() : "",
      appearance: normalizeAppearance(parsed.appearance),
      // Nur explizites true aktiviert die Übersicht — ältere Configs ohne
      // das Feld bleiben beim neuen Standard AUS.
      showProductPicker: parsed.showProductPicker === true,
    };
    cfgCache = { cfg, at: Date.now() };
    return { ...cfg };
  } catch {
    // Fehler NICHT cachen — nächster Aufruf versucht es erneut.
    return { ...DEFAULTS };
  }
}

export async function saveThemeEditorConfig(cfg: ThemeEditorConfig): Promise<void> {
  await setAdminSetting(CONFIG_KEY, JSON.stringify(cfg));
  cfgCache = { cfg: { ...cfg }, at: Date.now() };
}

export interface DemoDesign {
  document: ThemeDocument;
  name: string;
  produkt: Produkt;
}

/** Lädt das Beispiel-Design + löst dessen Produkt ÜBER DEN DESIGN-BESITZER
 *  auf (nicht über die Session) — Kunden dürfen die Demo sehen, ohne das
 *  Produkt zu besitzen. Fehler kommen als { error } zurück (nie throw),
 *  damit Admin-Validierung und Demo-Route dieselben Meldungen zeigen. */
export async function loadDemoDesign(code: string): Promise<DemoDesign | { error: string }> {
  const trimmed = code.trim();
  if (!trimmed) return { error: "Kein Design-Code hinterlegt." };
  const design = await getThemeDesign(trimmed);
  if (!design) return { error: "Design-Code nicht gefunden — Design im Editor speichern und Code hier eintragen." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(design.docJson);
  } catch {
    return { error: "Das gespeicherte Design ist beschädigt." };
  }
  if (!isValidDocument(parsed)) return { error: "Das gespeicherte Design ist beschädigt." };
  const document = parsed as ThemeDocument;

  const productId = document.productId || design.productId;
  let produkt: Produkt | null = null;
  if (isCustomProductId(productId)) {
    const list = await listCustomProductsOfOwner(design.user);
    const cp = list.find((p) => p.id === productId);
    if (cp) produkt = customToProdukt(cp);
  } else {
    produkt = (await getAllProdukte()).find((p) => p.id === productId) || null;
  }
  if (!produkt) return { error: "Das Produkt des Beispiel-Designs existiert nicht mehr." };

  return { document, name: design.name, produkt };
}
