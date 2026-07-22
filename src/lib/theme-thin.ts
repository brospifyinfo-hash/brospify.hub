import "server-only";
import AdmZip from "adm-zip";
import type { ThemeDocument } from "@/lib/theme-doc";
import type { ThemeCopy } from "@/lib/theme-placeholders";
import { compileDocumentZip, type DynamicBuyboxOpts } from "@/lib/theme-compile";
import { setZipFile } from "@/lib/theme-liquid-gen";
import { ensureLicenseSchema, buildOverlayGateSnippet } from "@/lib/theme-license";
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

// Cache-Buster für die abo-gegateten Remote-Assets. Bei Änderungen an
// public/bspx-sections.js / bspx-runtime.js / BUYBOX_CSS hochzählen —
// NEUE Exporte bekommen dann sofort frische Dateien; bereits installierte
// Themes revalidieren über die CDN-s-maxage von selbst.
const BSPX_ASSET_V = "6";

/** Der einzige „Sektions"-Baustein im Thin-Theme: rendert den Mount-Punkt
 *  + lädt CSS/JS ABO-GEGATET vom Hub (/api/storefront/asset/…). Das
 *  Liquid enthält NUR Struktur + Variablen — kein kritisches CSS/JS mehr
 *  im Kunden-Theme. */
function buildHostSection(syncCode: string, hubUrl: string): string {
  // Der Code kommt aus dem Feld „🔑 Brospify Sync-Code" (settings.license_key)
  // — so kann der Händler das Design im Shop wechseln, indem er einen anderen
  // Code einträgt. Ist das Feld leer, greift der beim Download eingebackene
  // Code als Fallback. data-bspx-assets liefert der Runtime die echte
  // Theme-CDN-Basis fürs __BSPX_ASSET__-Rewriting (die Scripts kommen jetzt
  // vom Hub — ihre eigene URL taugt nicht mehr als Basis!).
  const assetUrl = (name: string) =>
    `${hubUrl}/api/storefront/asset/${name}{{ bspx_q }}`;
  return `{%- assign bspx_code = settings.license_key | strip -%}
{%- if bspx_code == blank -%}{%- assign bspx_code = '${syncCode}' -%}{%- endif -%}
{%- capture bspx_q -%}?code={{ bspx_code | url_encode }}&shop={{ shop.permanent_domain }}&v=${BSPX_ASSET_V}{%- endcapture -%}
<div
  id="bspx-sections"
  data-bspx-code="{{ bspx_code | escape }}"
  data-bspx-hub="${hubUrl}"
  data-bspx-template="{{ template.name }}"
  data-bspx-assets="{{ 'base.css' | asset_url }}"
></div>
<div id="bspx-sections-skeleton" style="min-height:60vh"></div>
{%- if template.name == 'product' -%}
<script id="bspx-real-product" type="application/json">{{ product | json }}</script>
{%- endif -%}
<link rel="stylesheet" href="${assetUrl("bspx-core.css")}">
<script src="${assetUrl("bspx-sections.js")}" defer></script>
<script src="${assetUrl("bspx-runtime.js")}" defer></script>
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
 * Baut das Thin-Theme. Kritisches CSS/JS (Sektions-Loader, Kaufbox-
 * Runtime, Kaufbox-CSS, Offline-Plan) liegt NICHT im ZIP — es kommt
 * abo-gegated vom Hub (/api/storefront/asset/…). dyn daher OHNE
 * payloadJson/runtimeJs aufrufen.
 */
export function compileThinDocumentZip(
  baseZip: Buffer,
  doc: ThemeDocument,
  themeCopy: ThemeCopy,
  cacheKey: string,
  dyn: DynamicBuyboxOpts,
  licenseKey: string,
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

  // 4) Host-Baustein einbauen (lädt CSS/JS abo-gegated vom Hub).
  setZipFile(zip, "sections/bspx-host.liquid", buildHostSection(syncCode, hubUrl));

  // 4a) Kritisches JS + Design-Daten dürfen NICHT im Kunden-ZIP liegen —
  //     auch Reste aus Admin-Upload-Basen oder dem Voll-Compile entfernen.
  //     (Die Runtimes kommen remote über /api/storefront/asset/…, der
  //     Kaufbox-Plan live über /api/buybox/<code>.)
  for (const asset of ["assets/bspx-sections.js", "assets/bspx-runtime.js", "assets/bspx-plan.json"]) {
    const entry = findEntry(zip, asset);
    if (entry) zip.deleteFile(entry.entryName);
  }

  // 4b) GLOBALES Gate auf jeder Seite (license-check wird aus theme.liquid
  //     gerendert): Key fehlt/ungültig/Abo aus → die KOMPLETTE Website
  //     (Header, Warenkorb, Kategorien, …) verschwindet bis auf den Footer,
  //     Außer-Betrieb-Karte + brospify.ai erscheinen. Nur im geschützten
  //     Theme — der normale Export behält das inerte Snippet.
  setZipFile(zip, "snippets/license-check.liquid", buildOverlayGateSnippet({ hubUrl }));

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
