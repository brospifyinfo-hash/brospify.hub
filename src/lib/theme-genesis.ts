// ─── Genesis: inszenierter Shop-Aufbau im Theme-Editor ──────────────
// Client-safe. Baut aus einem ZIEL-ThemeDocument eine Schritt-Timeline
// („RevealSteps"): jeder Schritt ist ein vollständiges, gültiges Dokument,
// das die Live-Preview sofort rendern kann — der Shop „wächst" sichtbar
// von 0 (leere Kaufbox) über Farbwelt → Kaufbox-Bausteine → Sections →
// Startseite bis exakt zum Ziel-Dokument. Der letzte Schritt IST das Ziel,
// dadurch ist das Ergebnis garantiert identisch (Demo-Replay = Admin-Design,
// AI-Lauf = AI-Ergebnis). Angewendet werden die Schritte im
// GenerationTheater via aiBoundary/aiApply → EIN Undo-Schritt.

import { emptyDocument, type ThemeDocument } from "@/lib/theme-doc";

export interface RevealStep {
  /** Vollständiges Dokument dieses Schritts (immutabel aus dem Ziel gebaut). */
  doc: ThemeDocument;
  /** Große Phasen-Überschrift im Theater-Panel. */
  title: string;
  /** Kleine Detail-Zeile (z. B. Section-Name). */
  detail?: string;
  /** Scroll-/Puls-Ziel in der Preview: [data-section-uid="…"]. */
  focusUid?: string;
  /** Scroll-/Puls-Ziel in der Preview: [data-blk-type="…"]. */
  focusBlk?: string;
  /** Verweildauer NACH dem Anwenden (ms) — variiert für organisches Gefühl. */
  ms: number;
}

/** Beschriftungen der Timeline-Phasen (aus i18n gereicht — genesis bleibt rein). */
export interface RevealLabels {
  style: string;
  styleDetail: string;
  buybox: string;
  section: string;
  home: string;
  homeDetail: string;
  finish: string;
}

/** Kern-Bausteine, mit denen ein „leerer" Shop startet — bewusst minimal,
 *  damit der Aufbau sichtbar bei 0 beginnt. `description` ist im Editor
 *  ohnehin nie entfernbar. */
export const GENESIS_MIN_BUYBOX = ["custom_title", "custom_price", "buy_buttons", "description"];

/** Komplett leeres Start-Dokument für ein Produkt: keine Sections, minimale
 *  Kaufbox, neutrale Farben — Platzhalter-/Produktbilder liefert die Preview. */
export function blankDocument(productId: string): ThemeDocument {
  const d = emptyDocument();
  return {
    ...d,
    productId,
    buybox: { ...d.buybox, order: [...GENESIS_MIN_BUYBOX] },
  };
}

/**
 * Ziel-Dokument → animierbare Schritt-Folge.
 * `sectionLabel`/`blockLabel` liefern sprachrichtige Namen (getSectionDef/
 * getBuyboxMeta leben im Aufrufer, damit genesis keine Library-Imports zieht).
 */
export function buildRevealTimeline(
  target: ThemeDocument,
  tr: RevealLabels,
  sectionLabel: (type: string) => string,
  blockLabel: (type: string) => string,
): RevealStep[] {
  const steps: RevealStep[] = [];
  const start = blankDocument(target.productId);

  // 1) Farbwelt & Typografie — der leere Shop färbt sich sichtbar um.
  const styled: ThemeDocument = {
    ...start,
    global: target.global,
    buybox: { ...start.buybox, gallery: target.buybox.gallery, spacing: target.buybox.spacing },
  };
  steps.push({ doc: styled, title: tr.style, detail: tr.styleDetail, ms: 1150 });

  // 2) Kaufbox-Bausteine in kleinen Gruppen — wirkt wie gezieltes Zusammensetzen.
  const order = target.buybox.order;
  const chunk = order.length > 14 ? 4 : 3;
  for (let i = 0; i < order.length; i += chunk) {
    const upto = order.slice(0, Math.min(order.length, i + chunk));
    steps.push({
      doc: { ...styled, buybox: { ...target.buybox, order: upto } },
      title: tr.buybox,
      detail: order.slice(i, i + chunk).map(blockLabel).join(" · "),
      focusBlk: upto[upto.length - 1],
      ms: 760,
    });
  }

  // 3) Sections einzeln — Herzstück der Inszenierung.
  const withBuybox: ThemeDocument = { ...styled, buybox: target.buybox };
  for (let i = 0; i < target.sections.length; i++) {
    const inst = target.sections[i];
    steps.push({
      doc: { ...withBuybox, sections: target.sections.slice(0, i + 1) },
      title: tr.section,
      detail: sectionLabel(inst.type),
      focusUid: inst.uid,
      // leicht variierende Dauer (deterministisch) — kein Metronom-Gefühl
      ms: 620 + (i % 3) * 150,
    });
  }

  // 4) Startseite in EINEM Schritt (sie ist auf der Produktseiten-Preview
  //    nicht sichtbar — mehr Schritte wären totes Warten).
  if (target.home?.length) {
    steps.push({
      doc: { ...withBuybox, sections: target.sections, home: target.home },
      title: tr.home,
      detail: tr.homeDetail.replace("{n}", String(target.home.length)),
      ms: 900,
    });
  }

  // 5) Finale = exakt das Ziel-Dokument (Settings/hidden/Reihenfolge 1:1).
  steps.push({ doc: target, title: tr.finish, ms: 500 });
  return steps;
}
