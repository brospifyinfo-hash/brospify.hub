// ─── Export-Zeit-Generatoren (Server): Frame-Snippet, Icon-Snippet, Schema ──
// Wird beim Compile aufgerufen und schreibt/aktualisiert Dateien im Theme-Zip.
// Die Divider-Pfade kommen aus theme-frame.ts (gleiche Quelle wie die
// Vorschau); der Schema-Patch rüstet auch alte Admin-Upload-Basen nach.

import { getIcon, THEME_ICONS } from "@/lib/theme-icons";
import { getIconAny, isKnownIconId } from "@/lib/theme-icon-resolver";
import { DIVIDER_PATHS, DIVIDER_TOP_PATHS, DIVIDER_SHAPES, DIVIDER_LABELS } from "@/lib/theme-frame";

function liquidCase(sourceVar: string, targetVar: string, paths: Record<string, string>): string {
  const whens = DIVIDER_SHAPES.map(
    (k) => `  {%- when '${k}' -%}{%- assign ${targetVar} = '${paths[k]}' -%}`,
  ).join("\n");
  return `{%- assign ${targetVar} = '' -%}\n{%- case ${sourceVar} -%}\n${whens}\n{%- endcase -%}`;
}

/** Liquid-Quelltext des Design-Frames — beim Export ins Zip geschrieben. */
export function buildFrameSnippet(): string {
  return `{%- comment -%}
  Brospify Design-Layer (generiert beim Export — nicht von Hand editieren).
  Nutzung: {% render 'bspx-section-frame', section: section %} in Zeile 1.
  Mehrfarbige Hintergründe mit direkten Kanten; Übergänge als SVG-Formen
  (Welle/Zacken/…) oben und/oder unten. Fades nur noch für Alt-Designs.
{%- endcomment -%}
{%- assign fs = section.settings -%}
{%- assign bspx_pagebg = fs.sec_pagebg -%}
{%- if bspx_pagebg == blank -%}{%- assign bspx_pagebg = '#ffffff' -%}{%- endif -%}
{%- if fs.sec_bg != blank -%}
<style>
  #shopify-section-{{ section.id }} {
    position: relative;
    {% if fs.sec_bg2 != blank %}background: linear-gradient(170deg, {{ fs.sec_bg }} 0%, {{ fs.sec_bg2 }} 100%);{% else %}background: {{ fs.sec_bg }};{% endif %}
  }
</style>
${liquidCase("fs.sec_divider_top", "bspx_dtop", DIVIDER_TOP_PATHS)}
{%- if bspx_dtop != blank -%}
<svg viewBox="0 0 1440 64" preserveAspectRatio="none" aria-hidden="true" style="position:absolute;left:0;right:0;top:-1px;width:100%;height:32px;display:block;z-index:2;pointer-events:none"><path d="{{ bspx_dtop }}" fill="{{ bspx_pagebg }}"/></svg>
{%- elsif fs.sec_fade == 'top' or fs.sec_fade == 'both' -%}
<span aria-hidden="true" style="position:absolute;left:0;right:0;top:0;height:72px;z-index:2;pointer-events:none;background:linear-gradient(180deg, {{ bspx_pagebg }} 0%, rgba(255,255,255,0) 100%)"></span>
{%- endif -%}
${liquidCase("fs.sec_divider", "bspx_dbot", DIVIDER_PATHS)}
{%- if bspx_dbot != blank -%}
<svg viewBox="0 0 1440 64" preserveAspectRatio="none" aria-hidden="true" style="position:absolute;left:0;right:0;bottom:-1px;width:100%;height:32px;display:block;z-index:2;pointer-events:none"><path d="{{ bspx_dbot }}" fill="{{ bspx_pagebg }}"/></svg>
{%- elsif fs.sec_fade == 'bottom' or fs.sec_fade == 'both' -%}
<span aria-hidden="true" style="position:absolute;left:0;right:0;bottom:0;height:72px;z-index:2;pointer-events:none;background:linear-gradient(0deg, {{ bspx_pagebg }} 0%, rgba(255,255,255,0) 100%)"></span>
{%- endif -%}
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

// ─── Schema-Patch: neue Divider-Optionen + sec_divider_top nachrüsten ──────
// Läuft beim Compile über alle Section-Schemas, die den Design-Layer tragen
// (erkennbar am sec_bg-Setting). Repariert damit auch alte Admin-Upload-
// Basen. MUSS vor sanitizeTemplateData laufen, sonst löscht der Select-Check
// die neuen Werte (waves/zigzag/peaks) wieder aus den Templates.

const SCHEMA_RE = /(\{%-?\s*schema\s*-?%\})([\s\S]*?)(\{%-?\s*endschema\s*-?%\})/;

const DIVIDER_OPTIONS = ["none", ...DIVIDER_SHAPES].map((v) => ({
  value: v,
  label: DIVIDER_LABELS[v] || v,
}));

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
    let changed = false;
    // 1) sec_divider: Options-Liste auf die aktuellen Formen bringen
    const div = settings.find((s) => s.id === "sec_divider");
    if (div && JSON.stringify(div.options) !== JSON.stringify(DIVIDER_OPTIONS)) {
      div.options = DIVIDER_OPTIONS;
      changed = true;
    }
    // 2) sec_divider_top ergänzen (falls noch nicht vorhanden)
    if (!settings.some((s) => s.id === "sec_divider_top")) {
      const idx = settings.findIndex((s) => s.id === "sec_divider");
      const setting = {
        type: "select",
        id: "sec_divider_top",
        label: "Übergang oben",
        options: DIVIDER_OPTIONS,
        default: "none",
      };
      if (idx >= 0) settings.splice(idx + 1, 0, setting);
      else settings.push(setting);
      changed = true;
    }
    if (!changed) continue;
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
