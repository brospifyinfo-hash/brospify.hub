import "server-only";
import AdmZip from "adm-zip";
import type { ThemeDocument } from "@/lib/theme-doc";
import type { ThemeCopy } from "@/lib/theme-placeholders";
import { compileDocumentZip, type DynamicBuyboxOpts } from "@/lib/theme-compile";
import { setZipFile } from "@/lib/theme-liquid-gen";
import { ensureLicenseSchema } from "@/lib/theme-license";
import { injectSettingsData } from "@/lib/theme-inject";
import { getThemeStyle } from "@/lib/theme-styles";

// ─── Thin-Theme (server-gerenderte Sektionen) ──────────────────────
// Baut ein Theme, das den Sektions-CODE NICHT enthält. Statt der echten
// Sektionen steckt nur ein Host-Baustein + eine Runtime im ZIP: die
// Sektionen kommen LIVE vom Hub (/api/storefront/render/<code>) und nur
// bei aktiver Lizenz. Header/Footer/Dawn-Infrastruktur bleiben normal im
// Theme (SEO fürs Impressum + funktionierende Navigation). Die Kaufbox
// bleibt auf ihrem bestehenden Live-Weg (echtes Produkt, Kaufen geht).

function findEntry(zip: AdmZip, wanted: string): AdmZip.IZipEntry | null {
  const direct = zip.getEntry(wanted);
  if (direct) return direct;
  const norm = wanted.replace(/\\/g, "/");
  return zip.getEntries().find((e) => e.entryName.replace(/\\/g, "/").replace(/^\.?\//, "") === norm) || null;
}

/** Der einzige „Sektions"-Baustein im Thin-Theme: rendert den Mount-Punkt
 *  + lädt die Runtimes. Enthält KEINE Design-Logik. */
function buildHostSection(syncCode: string, hubUrl: string): string {
  return `<div
  id="bspx-sections"
  data-bspx-code="${syncCode}"
  data-bspx-hub="${hubUrl}"
  data-bspx-template="{{ template.name }}"
></div>
<div id="bspx-sections-skeleton" style="min-height:60vh"></div>
{%- if template.name == 'product' -%}
<script id="bspx-real-product" type="application/json">{{ product | json }}</script>
{%- endif -%}
<script src="{{ 'bspx-sections.js' | asset_url }}" defer></script>
<script src="{{ 'bspx-runtime.js' | asset_url }}" defer></script>
{% schema %}
{
  "name": "Brospify Host",
  "settings": [],
  "presets": [{ "name": "Brospify Host" }]
}
{% endschema %}
`;
}

const HOST_TEMPLATE = () =>
  JSON.stringify(
    {
      sections: { bspx: { type: "bspx-host", settings: {} } },
      order: ["bspx"],
    },
    null,
    2,
  );

/**
 * Baut das Thin-Theme.
 * @param sectionsRuntimeJs Inhalt von public/bspx-sections.js
 */
export function compileThinDocumentZip(
  baseZip: Buffer,
  doc: ThemeDocument,
  themeCopy: ThemeCopy,
  cacheKey: string,
  dyn: DynamicBuyboxOpts,
  licenseKey: string,
  sectionsRuntimeJs: string,
): Buffer {
  // 1) Voll kompilieren (korrekte Templates inkl. Kaufbox-Host + gebackene
  //    bspx-runtime.js). Daraus leiten wir ab, welche Section-Typen der
  //    „Inhalt" sind (die fliegen als Liquid raus).
  const fullBuf = compileDocumentZip(baseZip, doc, themeCopy, cacheKey, dyn, licenseKey);
  const zip = new AdmZip(fullBuf);
  const hubUrl = dyn.hubUrl.replace(/\/+$/, "");
  const syncCode = dyn.syncCode;

  // 3) Templates auf den Host reduzieren (nur noch bspx-host).
  setZipFile(zip, "templates/product.json", HOST_TEMPLATE());
  setZipFile(zip, "templates/index.json", HOST_TEMPLATE());

  // 4) Host-Baustein + Sektions-Runtime einbauen.
  setZipFile(zip, "sections/bspx-host.liquid", buildHostSection(syncCode, hubUrl));
  setZipFile(zip, "assets/bspx-sections.js", sectionsRuntimeJs);

  // 5) ALLE nicht mehr referenzierten Sektions-Dateien entfernen — das ist
  //    der geschützte Code. „Referenziert" = von einem verbleibenden Template
  //    (nach dem Host-Umbau), einer Section-Group (Header/Footer) oder direkt
  //    im Layout ({% section 'x' %}) genutzt. bspx-host bleibt immer.
  const keepTypes = new Set<string>(["bspx-host"]);
  for (const e of zip.getEntries()) {
    const name = e.entryName.replace(/\\/g, "/");
    // Templates (inkl. Section-Groups header-group.json/footer-group.json).
    if (/^(templates\/.*\.json|sections\/.*-group\.json)$/.test(name)) {
      try {
        const data = JSON.parse(e.getData().toString("utf8"));
        for (const s of Object.values(data.sections || {}) as Array<{ type?: string }>) {
          if (s?.type) keepTypes.add(String(s.type));
        }
      } catch { /* ignore */ }
    }
    // Layout-direkte {% section 'x' %} / {% sections 'x' %}.
    if (/^layout\/.*\.liquid$/.test(name)) {
      const src = e.getData().toString("utf8");
      const re = /\{%-?\s*sections?\s+['"]([^'"]+)['"]/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) keepTypes.add(m[1]);
    }
  }

  let removed = 0;
  for (const e of zip.getEntries()) {
    const name = e.entryName.replace(/\\/g, "/");
    const m = name.match(/^sections\/([^/]+)\.liquid$/);
    if (!m) continue;
    if (keepTypes.has(m[1])) continue;
    zip.deleteFile(e.entryName);
    removed += 1;
  }

  // 6) Lizenz-Feld (API-Key) oben in die Theme-Einstellungen + vorbefüllen.
  ensureLicenseSchema(zip);
  const settingsEntry = findEntry(zip, "config/settings_data.json");
  if (settingsEntry) {
    try {
      const settingsData = JSON.parse(settingsEntry.getData().toString("utf8"));
      const style = getThemeStyle(doc.global.styleId);
      injectSettingsData(
        settingsData,
        doc.global.colors,
        doc.global.bodyFont,
        doc.global.headingFont,
        { ...style.settingOverrides },
        licenseKey,
      );
      zip.updateFile(settingsEntry.entryName, Buffer.from(JSON.stringify(settingsData, null, 2), "utf8"));
    } catch { /* ignore */ }
  }

  if (removed === 0) {
    console.warn("[theme-thin] Achtung: keine Content-Sektion entfernt — Basis unerwartet?");
  }
  return zip.toBuffer();
}
