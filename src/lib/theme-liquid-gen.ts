// ─── Export-Zeit-Generatoren (Server): Frame-Snippet, Icon-Snippet, Schema ──
// Wird beim Compile aufgerufen und schreibt/aktualisiert Dateien im Theme-Zip.
// Der Frame trägt seit dem Mono-Update nur noch EINE neutrale Fläche; der
// Schema-Patch räumt die alten Verlaufs-/Formen-Settings aus der Basis.

import { getIcon, THEME_ICONS } from "@/lib/theme-icons";
import { getIconAny, isKnownIconId } from "@/lib/theme-icon-resolver";

/** Liquid-Quelltext des Design-Frames — beim Export ins Zip geschrieben.
 *  MONO (2026-07-28): eine EINZIGE neutrale Fläche, direkte Kante. Keine
 *  Farbverläufe, keine Fades, keine Formen-Übergänge — auch dann nicht, wenn
 *  ein Alt-Dokument noch sec_bg2/sec_fade/sec_divider mitbringt. */
export function buildFrameSnippet(): string {
  return `{%- comment -%}
  Brospify Design-Layer (generiert beim Export — nicht von Hand editieren).
  Nutzung: {% render 'bspx-section-frame', section: section %} in Zeile 1.
  Eine neutrale Fläche pro Section, direkte Kante — clean, ohne Verlauf.
{%- endcomment -%}
{%- assign fs = section.settings -%}
{%- if fs.sec_bg != blank -%}
<style>
  #shopify-section-{{ section.id }} {
    position: relative;
    background: {{ fs.sec_bg }};
  }
</style>
{%- endif -%}`;
}

/** Liquid-Quelltext des Icon-Snippets: 50 Basis-Icons + alle im Dokument
 *  tatsächlich benutzten Katalog-Icons (Liquid-Dateien haben Größen-Limits —
 *  deshalb NIE der komplette 1700er-Katalog). */
export function buildIconSnippet(usedIds: Iterable<string>): string {
  const ids = new Set<string>(THEME_ICONS.map((i) => i.id));
  for (const id of usedIds) if (isKnownIconId(id)) ids.add(id);
  const sorted = Array.from(ids).sort();
  const whens = sorted
    .map((id) => {
      const paths = getIconAny(id).paths.map((d) => `<path d="${d}"/>`).join("");
      return `  {%- when '${id}' -%}${paths}`;
    })
    .join("\n");
  const fallback = getIcon("check").paths.map((d) => `<path d="${d}"/>`).join("");
  return `{%- comment -%}
  Brospify Icon-Bibliothek (generiert beim Export aus der Icon-Bibliothek des
  Hubs — nicht von Hand editieren). Nutzung: {% render 'bspx-icon', icon: 'truck', size: 20 %}
{%- endcomment -%}
{%- assign bspx_icon_size = size | default: 20 -%}
<svg width="{{ bspx_icon_size }}" height="{{ bspx_icon_size }}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
{%- case icon -%}
${whens}
  {%- else -%}${fallback}
{%- endcase -%}
</svg>`;
}

/** Alle im Dokument referenzierten Icon-IDs einsammeln (Kaufbox-Vorteile +
 *  icon_1..icon_4 aller Section-Instanzen). */
export function collectDocIconIds(doc: {
  sections?: { settings?: Record<string, unknown> }[];
  home?: { settings?: Record<string, unknown> }[];
  buybox?: { benefitIcons?: string[]; gallery?: { features?: { icon?: string }[] } };
}): string[] {
  const out = new Set<string>();
  for (const id of doc.buybox?.benefitIcons || []) if (typeof id === "string") out.add(id);
  for (const f of doc.buybox?.gallery?.features || []) if (typeof f?.icon === "string" && f.icon) out.add(f.icon);
  for (const list of [doc.sections || [], doc.home || []]) {
    for (const inst of list) {
      for (let i = 1; i <= 4; i++) {
        const v = inst.settings?.[`icon_${i}`];
        if (typeof v === "string" && v) out.add(v);
      }
    }
  }
  return Array.from(out);
}

// ─── Schema-Patch: Design-Layer der Basis aktuell halten ──────────────────
// Läuft beim Compile über alle Section-Schemas, die den Design-Layer tragen
// (erkennbar am sec_bg-Setting) — auch alte Admin-Upload-Basen. Seit dem
// Mono-Update gibt es nur noch die Fläche: Übergangs-Formen (sec_divider,
// sec_divider_top) werden aus den Schemas ENTFERNT, damit kein Shop-Betreiber
// sie im Shopify-Editor versehentlich wieder einschaltet.

const SCHEMA_RE = /(\{%-?\s*schema\s*-?%\})([\s\S]*?)(\{%-?\s*endschema\s*-?%\})/;
const DROPPED_DESIGN_SETTINGS = new Set(["sec_divider", "sec_divider_top", "sec_fade", "sec_bg2"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ensureDesignSchema(zip: any): number {
  let patched = 0;
  for (const entry of zip.getEntries()) {
    const name = String(entry.entryName).replace(/\\/g, "/");
    if (!name.startsWith("sections/") || !name.endsWith(".liquid")) continue;
    const raw = entry.getData().toString("utf8");
    if (!raw.includes("sec_bg")) continue; // kein Design-Layer
    const m = raw.match(SCHEMA_RE);
    if (!m) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let schema: any;
    try {
      schema = JSON.parse(m[2]);
    } catch {
      continue; // kaputtes Schema nicht anfassen (wie theme-sanitize)
    }
    const settings: Record<string, unknown>[] = Array.isArray(schema.settings) ? schema.settings : [];
    if (!settings.some((s) => s.id === "sec_bg")) continue;
    const kept = settings.filter((s) => !DROPPED_DESIGN_SETTINGS.has(String(s.id)));
    if (kept.length === settings.length) continue;
    schema.settings = kept;
    const replaced = raw.replace(SCHEMA_RE, () => `${m[1]}\n${JSON.stringify(schema, null, 2)}\n${m[3]}`);
    zip.updateFile(entry.entryName, Buffer.from(replaced, "utf8"));
    patched++;
  }
  return patched;
}

/** Datei im Zip setzen (update wenn vorhanden, sonst anlegen). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setZipFile(zip: any, name: string, content: string): void {
  const entry = zip.getEntry(name);
  const buf = Buffer.from(content, "utf8");
  if (entry) zip.updateFile(entry, buf);
  else zip.addFile(name, buf);
}
