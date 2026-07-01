// ─── Editierbare Produktseiten-Sektionen (geteilt: Builder, Vorschau, Export) ──
// Die Kaufbox (main-product) ist immer sichtbar. Diese Sektionen darunter kann
// der Kunde ein-/ausblenden und ihre Überschrift setzen. `type` = echter
// Section-Typ im Theme (für hiddenTypes beim Download), `token` = der
// themeCopy-Platzhalter der Überschrift (damit die Überschrift auch im
// heruntergeladenen Theme landet → Vorschau == Theme).

export interface ProductSectionDef {
  type: string;
  label: string;
  defaultHeading: string;
  token: string;
}

export const PRODUCT_SECTIONS: ProductSectionDef[] = [
  { type: "bro-info-tabs", label: "Produktdetails", defaultHeading: "Mehr über das Produkt", token: "INFO_TABS_HEADING" },
  { type: "brospify-hero", label: "Marken-Story", defaultHeading: "Warum uns tausende vertrauen", token: "BRAND_TITLE" },
  { type: "vids", label: "Video-Bewertungen", defaultHeading: "Echte Erfahrungen unserer Kunden", token: "VIDS_TITLE" },
  { type: "reviews2", label: "Bewertungen", defaultHeading: "Das sagen unsere Kunden", token: "REVIEWS2_HEADLINE" },
  { type: "featured-collection", label: "Weitere Produkte", defaultHeading: "Das könnte dir auch gefallen", token: "FEATURED_COLLECTION_TITLE" },
];

export function sectionHeadingsToThemeCopy(headings: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headings) return out;
  for (const def of PRODUCT_SECTIONS) {
    const v = headings[def.type];
    if (typeof v === "string" && v.trim()) out[def.token] = v.trim();
  }
  return out;
}
