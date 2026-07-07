// ─── Design-Layer: Divider-Formen (client-safe, SINGLE SOURCE) ─────────────
// Diese Pfade nutzen Vorschau (SectionReplica) UND der beim Export generierte
// Liquid-Frame (theme-liquid-gen.ts) → Vorschau = Download, garantiert.
//
// Design-Entscheidung 2026-07: KEINE Farbverlaufs-Fades mehr — mehrfarbige
// Hintergründe mit DIREKTEN Kanten bzw. Formen-Übergängen (Welle, Zacken …).
// Legacy-Dokumente mit sec_fade werden weiterhin gerendert (Kompat), aber
// nichts Neues erzeugt Fades.

// Unterkante der Section: pagebg-farbige Form ragt von unten hinein.
export const DIVIDER_PATHS: Record<string, string> = {
  wave: "M0,32 C240,64 480,0 720,24 C960,48 1200,8 1440,36 L1440,64 L0,64 Z",
  waves: "M0,40 C120,64 240,16 360,32 C480,48 600,8 720,28 C840,48 960,16 1080,32 C1200,48 1320,24 1440,40 L1440,64 L0,64 Z",
  zigzag: "M0,48 L80,26 L160,48 L240,26 L320,48 L400,26 L480,48 L560,26 L640,48 L720,26 L800,48 L880,26 L960,48 L1040,26 L1120,48 L1200,26 L1280,48 L1360,26 L1440,48 L1440,64 L0,64 Z",
  slant: "M0,64 L1440,12 L1440,64 Z",
  curve: "M0,64 C480,8 960,8 1440,64 Z",
  peaks: "M0,44 L360,16 L720,48 L1080,12 L1440,40 L1440,64 L0,64 Z",
};

// Oberkante der Section (vertikal gespiegelt, pagebg ragt von oben hinein).
export const DIVIDER_TOP_PATHS: Record<string, string> = {
  wave: "M0,32 C240,0 480,64 720,40 C960,16 1200,56 1440,28 L1440,0 L0,0 Z",
  waves: "M0,24 C120,0 240,48 360,32 C480,16 600,56 720,36 C840,16 960,48 1080,32 C1200,16 1320,40 1440,24 L1440,0 L0,0 Z",
  zigzag: "M0,16 L80,38 L160,16 L240,38 L320,16 L400,38 L480,16 L560,38 L640,16 L720,38 L800,16 L880,38 L960,16 L1040,38 L1120,16 L1200,38 L1280,16 L1360,38 L1440,16 L1440,0 L0,0 Z",
  slant: "M0,0 L1440,52 L1440,0 Z",
  curve: "M0,0 C480,56 960,56 1440,0 Z",
  peaks: "M0,20 L360,48 L720,16 L1080,52 L1440,24 L1440,0 L0,0 Z",
};

/** Divider-Formen (ohne "none") — Reihenfolge = Anzeige-Reihenfolge. */
export const DIVIDER_SHAPES = ["wave", "waves", "zigzag", "slant", "curve", "peaks"] as const;

export const DIVIDER_LABELS: Record<string, string> = {
  none: "Keiner", wave: "Welle", waves: "Wellen", zigzag: "Zacken",
  slant: "Schräge", curve: "Bogen", peaks: "Berge",
};
