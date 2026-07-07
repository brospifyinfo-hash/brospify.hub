// ─── Design-Layer: Divider-Formen (client-safe, SINGLE SOURCE) ─────────────
// Diese Pfade nutzen Vorschau (SectionReplica) UND der beim Export generierte
// Liquid-Frame (theme-liquid-gen.ts) → Vorschau = Download, garantiert.
//
// Design-Entscheidung 2026-07: KEINE Farbverlaufs-Fades mehr — mehrfarbige
// Hintergründe mit DIREKTEN Kanten bzw. Formen-Übergängen (Welle, Zacken …).
// Legacy-Dokumente mit sec_fade werden weiterhin gerendert (Kompat), aber
// nichts Neues erzeugt Fades.

// Unterkante der Section: pagebg-farbige Form ragt von unten hinein.
// Bewusst FLACHE, ruhige Formen (Amplitude ≤ ±16 um die Mittellinie) —
// tiefe/zackige Kurven wirkten billig (User-Feedback 2026-07).
export const DIVIDER_PATHS: Record<string, string> = {
  wave: "M0,38 C240,54 480,22 720,32 C960,42 1200,26 1440,36 L1440,64 L0,64 Z",
  waves: "M0,36 C120,46 240,26 360,34 C480,42 600,24 720,32 C840,40 960,24 1080,32 C1200,40 1320,28 1440,34 L1440,64 L0,64 Z",
  zigzag: "M0,42 L180,30 L360,42 L540,30 L720,42 L900,30 L1080,42 L1260,30 L1440,42 L1440,64 L0,64 Z",
  slant: "M0,64 L1440,28 L1440,64 Z",
  curve: "M0,64 C480,24 960,24 1440,64 Z",
  peaks: "M0,46 L360,26 L720,44 L1080,22 L1440,40 L1440,64 L0,64 Z",
};

// Oberkante der Section (vertikal gespiegelt, pagebg ragt von oben hinein).
export const DIVIDER_TOP_PATHS: Record<string, string> = {
  wave: "M0,26 C240,10 480,42 720,32 C960,22 1200,38 1440,28 L1440,0 L0,0 Z",
  waves: "M0,28 C120,18 240,38 360,30 C480,22 600,40 720,32 C840,24 960,40 1080,32 C1200,24 1320,36 1440,30 L1440,0 L0,0 Z",
  zigzag: "M0,22 L180,34 L360,22 L540,34 L720,22 L900,34 L1080,22 L1260,34 L1440,22 L1440,0 L0,0 Z",
  slant: "M0,0 L1440,36 L1440,0 Z",
  curve: "M0,0 C480,40 960,40 1440,0 Z",
  peaks: "M0,18 L360,38 L720,20 L1080,42 L1440,24 L1440,0 L0,0 Z",
};

/** Divider-Formen (ohne "none") — Reihenfolge = Anzeige-Reihenfolge. */
export const DIVIDER_SHAPES = ["wave", "waves", "zigzag", "slant", "curve", "peaks"] as const;

export const DIVIDER_LABELS: Record<string, string> = {
  none: "Keiner", wave: "Welle", waves: "Wellen", zigzag: "Zacken",
  slant: "Schräge", curve: "Bogen", peaks: "Berge",
};
