// ─── Brospify Lizenz-Gate (Theme-Export) ───────────────────────────
// Ein globaler Lizenzschlüssel in den Theme-Einstellungen (ganz oben)
// steuert die KOMPLETTE Website:
//   - Key aktiv   → Shop rendert normal.
//   - Key fehlt/inaktiv → Live-Storefront zeigt nur die Außer-Betrieb-
//     Seite + brospify.ai-Watermark. Der Footer (Impressum!) bleibt
//     IMMER sichtbar. Im Shopify-Theme-Editor (request.design_mode)
//     bleibt ALLES bearbeitbar — der Händler sieht dort nur einen
//     Hinweis-Banner, seine Lizenz zu aktivieren.
//
// Alle drei Bausteine werden bei JEDEM Export frisch in das Basis-Zip
// geschrieben (auch bei Admin-Upload-Basen) — so kann keine veraltete
// Basis ein Theme ohne Gate ausliefern:
//   1. snippets/license-check.liquid  (das Gate selbst)
//   2. config/settings_schema.json    (Lizenz-Gruppe an Position 1)
//   3. layout/theme.liquid            ({% render 'license-check' %} sichern)
//
// Zusätzlich entfernt stripThemeComments() beim Export alle Liquid-
// Kommentarblöcke aus sections/snippets/layout — Kunden bekommen den
// Code ohne unsere Entwickler-Dokumentation. (Der Liquid-Code selbst
// ist bei Shopify-Themes prinzipbedingt einsehbar; die eigentliche
// Absicherung ist das Lizenz-Gate.)

import AdmZip from "adm-zip";

const DEFAULT_HUB_URL = "https://brospifyhub.com";
// Muss zum Vercel-Env LICENSE_API_KEY passen (Soft-Gate, bewusst im
// Storefront-HTML sichtbar — kein echtes Secret).
const DEFAULT_API_KEY = "zHBhrTi53S6YizQcxoIX4-RrmB7DJ-rMj6f7LqUTF2Q";

export function licenseGateConfig(): { hubUrl: string; apiKey: string } {
  return {
    hubUrl: (process.env.BSPX_LICENSE_HUB_URL || DEFAULT_HUB_URL).replace(/\/+$/, ""),
    apiKey: (process.env.LICENSE_API_KEY || "").trim() || DEFAULT_API_KEY,
  };
}

// Settings-Gruppe „Lizenz" — wird an Position 1 (direkt nach theme_info)
// eingesetzt, damit sie im Shopify-Customizer links GANZ OBEN steht.
export const LICENSE_SETTINGS_GROUP = {
  name: "🔑 Brospify Sync-Code",
  settings: [
    {
      type: "paragraph",
      content:
        "Dieser Sync-Code lädt deinen kompletten Shop (alle Sektionen) live von Brospify. Ohne gültigen Code oder bei inaktivem Abo wird NICHTS angezeigt (Footer & Impressum bleiben sichtbar). Einen anderen Code einfügen = anderes Design im Shop.",
    },
    {
      type: "text",
      id: "license_key",
      label: "Sync-Code",
      placeholder: "bspx_xxxxxxxxxxxxxxxxxxxxxx",
      info: "Wird beim Theme-Download automatisch eingetragen. Du findest deine Codes im Brospify-Editor unter „Projekte“.",
    },
  ],
} as const;

/** Zip-Eintrag tolerant finden (Pfad-Trenner-agnostisch, lokale Kopie
 *  um Import-Zyklen mit theme-inject zu vermeiden). */
function findZipEntry(zip: AdmZip, wanted: string): AdmZip.IZipEntry | null {
  const direct = zip.getEntry(wanted);
  if (direct) return direct;
  const norm = wanted.replace(/\\/g, "/");
  return (
    zip.getEntries().find((e) => e.entryName.replace(/\\/g, "/").replace(/^\.?\//, "") === norm) || null
  );
}

function setFile(zip: AdmZip, name: string, content: string): void {
  const entry = findZipEntry(zip, name);
  const buf = Buffer.from(content, "utf8");
  if (entry) zip.updateFile(entry.entryName, buf);
  else zip.addFile(name, buf);
}

/** snippets/license-check.liquid.
 *
 *  STOPGAP (19.07.2026): Das Overlay-Gate (Sektionen per Skript ausblenden)
 *  wird durch das server-gerenderte Sektions-Modell ersetzt (Sektionen
 *  kommen wie die Kaufbox nur mit gültigem API-Key vom Hub; ohne Key gibt
 *  es kein Section-HTML — der Code liegt dann gar nicht mehr im Theme).
 *  Bis das steht, ist das alte Overlay-Gate INERT geschaltet: es lief auch
 *  in der Editor-Vorschau mit und leerte dort die Produktseite
 *  („kein Produkt vorhanden"). Ein leeres Snippet kann nichts kaputt machen. */
export function buildLicenseSnippet(_opts?: { hubUrl?: string; apiKey?: string }): string {
  // WICHTIG: KEIN reiner {% comment %}-Block — stripThemeComments() würde
  // ihn entfernen, die Datei wäre leer, und Shopify meldet dann
  // „Could not find asset snippets/license-check.liquid" auf JEDER Seite.
  // Ein HTML-Kommentar bleibt erhalten und rendert unsichtbar.
  return `<!-- Brospify: Lizenzprüfung läuft serverseitig (Sektionen werden nur mit gültigem Key ausgeliefert). -->\n`;
}

/** Globales Overlay-Gate — läuft auf JEDER Seite (aus theme.liquid head):
 *  Key fehlt/ungültig/Abo inaktiv → ALLES außer Footer verschwindet,
 *  Außer-Betrieb-Karte + brospify.ai-Watermark erscheinen. Wird NUR ins
 *  GESCHÜTZTE Theme (theme-thin) gebaut — im normalen Export und im
 *  Master-Zip bleibt das inerte Snippet (sonst sperrt es die Editor-
 *  Vorschau, das war der „kein Produkt vorhanden"-Bug). */
export function buildOverlayGateSnippet(opts?: { hubUrl?: string }): string {
  const cfg = licenseGateConfig();
  const hubUrl = (opts?.hubUrl || cfg.hubUrl).replace(/\/+$/, "");

  return `{%- comment -%}
  Brospify Gate — settings.license_key (Sync-Code) steuert die komplette Website.
  Editor (request.design_mode): nie sperren, nur Hinweis-Banner.
  Live: Code fehlt / Abo inaktiv → Außer-Betrieb-Seite, Footer bleibt sichtbar.
{%- endcomment -%}
{%- if request.design_mode -%}
<script>
(function () {
  var code = ({{ settings.license_key | json }} || "").trim();
  function notice(text) {
    try { if (sessionStorage.getItem("bspxLicNoticeAway") === "1") return; } catch (e) {}
    if (document.getElementById("bspx-lic-notice")) return;
    var el = document.createElement("div");
    el.id = "bspx-lic-notice";
    el.setAttribute("style", "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483647;max-width:min(640px,calc(100vw - 32px));background:#fff;color:#111;border:1px solid #f1c5c5;border-left:4px solid #e74c3c;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.18);padding:14px 44px 14px 16px;font:13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;");
    el.innerHTML = '<b>Brospify:</b> ' + text +
      ' <a href="${hubUrl}" target="_blank" rel="noopener" style="color:#e74c3c;font-weight:600;">Zum Brospify Hub</a>' +
      '<button type="button" aria-label="Hinweis schließen" style="position:absolute;top:8px;right:8px;border:0;background:transparent;font-size:16px;line-height:1;cursor:pointer;color:#999;">\\u00d7</button>';
    el.querySelector("button").addEventListener("click", function () {
      try { sessionStorage.setItem("bspxLicNoticeAway", "1"); } catch (e) {}
      el.parentNode && el.parentNode.removeChild(el);
    });
    document.body.appendChild(el);
  }
  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }
  if (!code) {
    onReady(function () { notice("Es ist noch kein Sync-Code hinterlegt. Lade dein Theme im Brospify-Editor herunter — der Code ist dann automatisch gesetzt. (Hier im Editor bleibt alles bearbeitbar; dein Live-Shop zeigt ohne Code die Außer-Betrieb-Seite.)"); });
    return;
  }
  fetch("${hubUrl}/api/storefront/status/" + encodeURIComponent(code) + "?t=" + Date.now())
    .then(function (r) { if (!r.ok) throw new Error("http"); return r.json(); })
    .then(function (d) {
      if (d && d.locked === true) {
        onReady(function () { notice("Dein Shop ist aktuell gesperrt (" + (d.message || "Abo nicht aktiv") + "). Verlängere dein Abo im Hub — sonst zeigt dein Live-Shop nur die Außer-Betrieb-Seite. Hier im Editor bleibt alles bearbeitbar."); });
      }
    }).catch(function () { /* Hub nicht erreichbar → kein Banner */ });
})();
</script>
{%- else -%}
<style>
  html.bspx-lic-locked #MainContent > :not(#bspx-lic-offline){display:none !important}
  html.bspx-lic-locked .shopify-section-group-header-group{display:none !important}
  html.bspx-lic-locked cart-drawer,html.bspx-lic-locked cart-notification{display:none !important}
  html.bspx-lic-locked body{background:#f6f6f4 !important}
  #bspx-lic-offline{display:none}
  html.bspx-lic-locked #bspx-lic-offline{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:70vh;padding:48px 24px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
  .bspx-lic-card{max-width:560px;background:#fff;border:1px solid #e8e8e4;border-radius:20px;padding:48px 40px;box-shadow:0 20px 60px rgba(0,0,0,.06)}
  .bspx-lic-card .bspx-lic-ico{font-size:40px;margin-bottom:16px}
  .bspx-lic-card h1{font-size:26px;line-height:1.25;margin:0 0 12px;color:#111;font-weight:700}
  .bspx-lic-card p{font-size:15px;line-height:1.6;color:#555;margin:0}
  .bspx-lic-mark{margin-top:32px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#888;text-decoration:none;border:1px solid #e2e2de;border-radius:999px;padding:9px 16px;background:#fff}
  .bspx-lic-mark b{color:#111;font-weight:700}
</style>
{%- assign bspx_key = settings.license_key | strip -%}
{%- if bspx_key == blank -%}
  {%- comment -%} KEIN Key → server-seitig sofort hart sperren (kein JS nötig, kein Aufblitzen). {%- endcomment -%}
  <script>document.documentElement.classList.add("bspx-lic-locked");</script>
{%- endif -%}
<script>
(function () {
  var d = document.documentElement;
  // STANDARD = GESPERRT: Inhalt wird erst freigeschaltet, wenn der Key
  // nachweislich gültig ist. So kann OHNE gültigen Key nie Inhalt
  // durchrutschen (auch nicht kurz beim Laden).
  d.classList.add("bspx-lic-locked");

  // Ausnahme: Hub-Vorschau/Localhost nie sperren (leerer Hostname bei
  // srcdoc/blob-iframes, brospifyhub.com, *.vercel.app).
  var h = (location.hostname || "").toLowerCase();
  if (!h || h === "localhost" || h === "127.0.0.1" || /(^|\\.)brospifyhub\\.com$/.test(h) || /\\.vercel\\.app$/.test(h)) {
    d.classList.remove("bspx-lic-locked");
    return;
  }

  var code = ({{ settings.license_key | json }} || "").replace(/^\\s+|\\s+$/g, "");
  var CACHE_KEY = "bspxLicV2";
  var VALID_TTL = 10 * 60 * 1000;
  var INVALID_TTL = 24 * 60 * 60 * 1000;

  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }
  function showCard() {
    onReady(function () {
      if (document.getElementById("bspx-lic-offline")) return;
      var main = document.getElementById("MainContent") || document.body;
      var box = document.createElement("div");
      box.id = "bspx-lic-offline";
      box.innerHTML = '<div class="bspx-lic-card"><div class="bspx-lic-ico">\\u23F8\\uFE0F</div>' +
        '<h1>Der Shop ist aktuell leider au\\u00dfer Betrieb.</h1>' +
        '<p>Bitte schau zu einem sp\\u00e4teren Zeitpunkt noch einmal vorbei.</p></div>' +
        '<a class="bspx-lic-mark" href="https://brospify.ai" target="_blank" rel="noopener">powered by <b>brospify.ai</b></a>';
      main.appendChild(box);
    });
  }
  function lock() { d.classList.add("bspx-lic-locked"); showCard(); }
  function unlock() {
    d.classList.remove("bspx-lic-locked");
    var box = document.getElementById("bspx-lic-offline");
    if (box && box.parentNode) box.parentNode.removeChild(box);
  }
  function readCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (!c || typeof c.t !== "number" || c.key !== code) return null;
      if (Date.now() - c.t > (c.valid ? VALID_TTL : INVALID_TTL)) return null;
      return c;
    } catch (e) { return null; }
  }
  function writeCache(valid) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ key: code, valid: valid, t: Date.now() })); } catch (e) {}
  }

  // Kein Code → gesperrt bleiben (Karte zeigen), niemals entsperren.
  if (!code) { lock(); return; }

  // Cache: gültig → sofort entsperren (kein Aufblitzen); ungültig → gesperrt.
  var cached = readCache();
  if (cached) { if (cached.valid) unlock(); else lock(); return; }

  fetch("${hubUrl}/api/storefront/status/" + encodeURIComponent(code) + "?t=" + Date.now())
    .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
    .then(function (d2) {
      if (d2 && d2.locked === true) { writeCache(false); lock(); }
      else { writeCache(true); unlock(); }
    })
    .catch(function () {
      // Hub nicht erreichbar → fail-open (Shop nie wegen Störung sperren).
      unlock();
    });
})();
</script>
{%- endif -%}
`;
}

/** Lizenz-Gruppe in config/settings_schema.json an Position 1 sichern
 *  (vorhandene license_key-Gruppen — egal wo — werden ersetzt). */
export function ensureLicenseSchema(zip: AdmZip): void {
  const entry = findZipEntry(zip, "config/settings_schema.json");
  if (!entry) return;
  let schema: unknown;
  try {
    schema = JSON.parse(entry.getData().toString("utf8"));
  } catch {
    return;
  }
  if (!Array.isArray(schema)) return;
  type Group = { name?: string; settings?: Array<{ id?: string }> };
  const hasLicenseKey = (g: Group) =>
    Array.isArray(g?.settings) && g.settings.some((s) => s?.id === "license_key");
  const filtered = (schema as Group[]).filter((g) => !hasLicenseKey(g));
  const insertAt = filtered.length > 0 && filtered[0]?.name === "theme_info" ? 1 : 0;
  filtered.splice(insertAt, 0, LICENSE_SETTINGS_GROUP as unknown as Group);
  zip.updateFile(entry.entryName, Buffer.from(JSON.stringify(filtered, null, 2), "utf8"));
}

/** Sicherstellen, dass die Layouts das Gate rendern (Admin-Upload-Basen
 *  könnten den Render-Aufruf verloren haben). Auch layout/password.liquid
 *  gaten — sonst zeigt ein gesperrter Shop mit Passwortschutz weiter die
 *  voll gebrandete Passwort-Seite. templates/gift_card.liquid ({% layout
 *  none %}) bleibt BEWUSST offen: bereits gekaufte Geschenkkarten müssen
 *  für Endkunden abrufbar bleiben. */
export function ensureLicenseRender(zip: AdmZip): void {
  for (const layoutPath of ["layout/theme.liquid", "layout/password.liquid"]) {
    const entry = findZipEntry(zip, layoutPath);
    if (!entry) continue;
    const raw = entry.getData().toString("utf8");
    // Auskommentierte render-Aufrufe zählen NICHT — sonst würde ein
    // {% comment %}…license-check…{% endcomment %} den Check täuschen
    // und das Gate fehlt am Ende komplett.
    COMMENT_RE.lastIndex = 0;
    const visible = raw.replace(COMMENT_RE, "");
    if (visible.includes("license-check")) continue;
    const idx = raw.search(/<\/head>/i);
    if (idx === -1) continue;
    const patched = `${raw.slice(0, idx)}{% render 'license-check' %}\n  ${raw.slice(idx)}`;
    zip.updateFile(entry.entryName, Buffer.from(patched, "utf8"));
  }
}

/** Alle drei Gate-Bausteine in ein Basis-Zip schreiben (bei jedem Export). */
export function ensureLicenseGate(zip: AdmZip): void {
  setFile(zip, "snippets/license-check.liquid", buildLicenseSnippet());
  ensureLicenseSchema(zip);
  ensureLicenseRender(zip);
}

// ─── Kommentar-Stripping (Code-Schutz light) ───────────────────────
// Entfernt {% comment %}…{% endcomment %}-Blöcke aus allen Liquid-
// Dateien des Exports. Dateien mit {% raw %} werden übersprungen —
// dort könnten Kommentar-Marker Textinhalt sein.

const COMMENT_RE = /\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g;
const LIQUID_DIRS = /^(sections|snippets|layout|templates)\//;

export function stripThemeComments(zip: AdmZip): number {
  let stripped = 0;
  for (const entry of zip.getEntries()) {
    const name = entry.entryName.replace(/\\/g, "/").replace(/^\.?\//, "");
    if (!LIQUID_DIRS.test(name) || !name.endsWith(".liquid")) continue;
    const raw = entry.getData().toString("utf8");
    if (/\{%-?\s*raw\s*-?%\}/.test(raw)) continue;
    if (!COMMENT_RE.test(raw)) continue;
    COMMENT_RE.lastIndex = 0;
    let next = raw
      .replace(COMMENT_RE, "")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\s*\n/, "");
    // NIEMALS eine leere Datei hinterlassen: Shopify behandelt ein leeres
    // Snippet/Section-File wie „nicht vorhanden" und wirft bei jedem
    // {% render %} einen Liquid-Fehler auf der Storefront.
    if (!next.trim()) next = `<!-- Brospify -->\n`;
    zip.updateFile(entry.entryName, Buffer.from(next, "utf8"));
    stripped += 1;
  }
  return stripped;
}
