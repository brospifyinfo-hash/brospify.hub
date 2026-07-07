// Icon-Auflösung über die GESAMTE Bibliothek: 50 handgepflegte THEME_ICONS
// (haben Vorrang, inkl. Emoji für den Legacy-Fallback) + ~1700 Lucide-Icons
// aus theme-icon-catalog.ts. Die AI darf freie englische Keywords liefern
// ("dog", "washing-machine") — resolveIconId() löst sie DETERMINISTISCH auf
// (läuft identisch in plan- und apply-Route → Kosten-/Validierungs-Parität).

import { THEME_ICONS, getIcon, type ThemeIcon } from "@/lib/theme-icons";
import { ICON_CATALOG, type CatalogIconTuple } from "@/lib/theme-icon-catalog";

const LEGACY_IDS = new Set(THEME_ICONS.map((i) => i.id));

const CATALOG_BY_ID = new Map<string, CatalogIconTuple>(
  ICON_CATALOG.map((t) => [t[0], t]),
);

/** Kleine Deutsch→Englisch-Brücke für manuelle Suche + AI-Ausrutscher. */
const DE_EN: Record<string, string> = {
  hund: "dog", katze: "cat", tier: "paw", haustier: "paw", pfote: "paw",
  herz: "heart", versand: "truck", lieferung: "truck", paket: "package",
  garantie: "shield", schutz: "shield", sicher: "lock", schloss: "lock",
  stern: "star", blitz: "zap", strom: "plug", wasser: "droplet",
  feuer: "flame", sonne: "sun", mond: "moon", schlaf: "bed",
  werkzeug: "wrench", kueche: "utensils", küche: "utensils", kochen: "chef-hat",
  kaffee: "coffee", pflanze: "sprout", blatt: "leaf", umwelt: "recycle",
  geschenk: "gift", zeit: "clock", uhr: "watch", geld: "coins",
  auto: "car", fahrrad: "bike", musik: "music", kamera: "camera",
  telefon: "smartphone", haus: "home", buch: "book", spiel: "gamepad-2",
  sport: "dumbbell", fitness: "dumbbell", gesundheit: "heart-pulse",
  medizin: "pill", zahn: "tooth", baby: "baby",
  reinigung: "sparkles", sauber: "sparkles", winter: "snowflake",
  berg: "mountain", reise: "plane", strand: "umbrella",
};

function norm(q: string): string {
  return q.trim().toLowerCase().replace(/[_\s]+/g, "-").replace(/[^a-z0-9äöüß-]/g, "");
}

/**
 * Löst eine Icon-Angabe (bekannte ID oder freies Keyword) auf eine gültige
 * Icon-ID auf. Gibt null zurück, wenn nichts Passendes gefunden wird.
 * Deterministisch: gleiche Eingabe → gleiches Ergebnis.
 */
export function resolveIconId(input: string): string | null {
  if (!input || typeof input !== "string") return null;
  const q = norm(input);
  if (!q) return null;
  if (LEGACY_IDS.has(q) || CATALOG_BY_ID.has(q)) return q;
  // Deutsch → Englisch übersetzen (ganzes Wort)
  const de = DE_EN[q.replace(/-/g, "")];
  if (de && (LEGACY_IDS.has(de) || CATALOG_BY_ID.has(de))) return de;
  const needle = de || q;
  // 1) ID beginnt mit dem Begriff (dog → dog-bowl wäre 2. Wahl hinter dog)
  // 2) Suchbegriffe enthalten das ganze Wort
  // 3) ID enthält den Begriff als Teilstring
  let prefix: string | null = null;
  let tagHit: string | null = null;
  let sub: string | null = null;
  for (const [id, search] of ICON_CATALOG) {
    if (prefix === null && (id === needle || id.startsWith(needle + "-"))) prefix = id;
    if (tagHit === null && (" " + search + " ").includes(" " + needle + " ")) tagHit = id;
    if (sub === null && id.includes(needle)) sub = id;
    if (prefix) break; // Katalog ist alphabetisch sortiert → erster Präfix-Treffer ist stabil
  }
  return prefix || tagHit || sub;
}

/** Icon-Daten für beliebige (Legacy- oder Katalog-)IDs. Unbekannte IDs →
 *  "check" — derselbe Fallback wie der else-Zweig des beim Export
 *  generierten bspx-icon.liquid (Vorschau = Shop, auch im Fehlerfall). */
export function getIconAny(id: string): ThemeIcon {
  if (LEGACY_IDS.has(id)) return getIcon(id);
  const cat = CATALOG_BY_ID.get(id);
  if (cat) return { id: cat[0], label: cat[0], emoji: "✨", paths: cat[2] };
  return getIcon("check");
}

/** True, wenn die ID direkt bekannt ist (ohne Keyword-Auflösung). */
export function isKnownIconId(id: string): boolean {
  return LEGACY_IDS.has(id) || CATALOG_BY_ID.has(id);
}

/** Suche fürs Inspector-Grid: liefert bis zu `limit` Treffer (Legacy zuerst). */
export function searchIcons(query: string, limit = 48): ThemeIcon[] {
  const q = norm(query);
  const out: ThemeIcon[] = [];
  if (!q) return THEME_ICONS.slice(0, limit);
  const needle = DE_EN[q.replace(/-/g, "")] || q;
  for (const icon of THEME_ICONS) {
    if (icon.id.includes(needle) || icon.label.toLowerCase().includes(q)) out.push(icon);
    if (out.length >= limit) return out;
  }
  for (const [id, search, paths] of ICON_CATALOG) {
    if (id.includes(needle) || (" " + search + " ").includes(" " + needle + " ")) {
      out.push({ id, label: id, emoji: "✨", paths });
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** Anzahl verfügbarer Icons (für UI-Texte/Wissen). */
export const ICON_TOTAL = THEME_ICONS.length + ICON_CATALOG.length;
