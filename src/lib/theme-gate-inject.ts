// ─── theme-gate-inject.ts ───────────────────────────────────────────────────
// Erweiterung der Export-Pipeline (neben ensureLicenseGate() in theme-license.ts).
// Injiziert die 4 Schutz-Module in ein Dawn-Ziel-Zip, das der Brospify-Editor
// anschließend via Shopify Asset API in den Händler-Shop pusht.
//
// Aufruf im Exporter (nach dem Section-Build, vor stripThemeComments):
//   injectBrospifyGate(zip, { hubUrl });
//
// Verdikt-Quelle = dein bestehender Endpoint GET /api/storefront/status/<code>
// → { locked:boolean }. Fail-open (nur bei eindeutigem locked:true sperren) —
// konsistent mit buildOverlayGateSnippet(). KEIN App-Proxy/Function nötig
// (Händler-Shop hat keine App).

import AdmZip from "adm-zip";

// ── Zip-Helfer (lokal gehalten wie in theme-license.ts, Pfad-Trenner-agnostisch)
function findZipEntry(zip: AdmZip, wanted: string): AdmZip.IZipEntry | null {
  const direct = zip.getEntry(wanted);
  if (direct) return direct;
  const norm = wanted.replace(/\\/g, "/");
  return zip.getEntries().find((e) => e.entryName.replace(/\\/g, "/").replace(/^\.?\//, "") === norm) || null;
}
function readEntry(zip: AdmZip, name: string): string | null {
  const e = findZipEntry(zip, name);
  return e ? e.getData().toString("utf8") : null;
}
function writeEntry(zip: AdmZip, name: string, content: string): void {
  const e = findZipEntry(zip, name);
  const buf = Buffer.from(content, "utf8");
  if (e) zip.updateFile(e.entryName, buf);
  else zip.addFile(name, buf);
}
/** Idempotent: stempelt einen eindeutigen Marker VOR den Block und prüft ihn —
 *  der Marker MUSS im Geschriebenen stehen, sonst dupliziert ein 2. Export. */
function appendOnce(zip: AdmZip, name: string, tag: string, block: string): void {
  const raw = readEntry(zip, name);
  if (raw == null) return;
  const stamp = `/* bspx-once:${tag} */`; // gültiger Kommentar in JS UND CSS
  if (raw.includes(stamp)) return;
  writeEntry(zip, name, `${raw}\n${stamp}\n${block}`);
}
function prependOnce(zip: AdmZip, name: string, marker: string, block: string): void {
  const raw = readEntry(zip, name);
  if (raw == null || raw.includes(marker)) return;
  writeEntry(zip, name, block + "\n" + raw);
}

// ── IP-Header (echt, rechtlich — KEINE an KIs gerichteten Direktiven) ─────────
const MARK = "brospify-gate:v1";
const IP_JS = `/*
 * © 2026 brospify. Alle Rechte vorbehalten. VERTRAULICH & URHEBERRECHTLICH GESCHÜTZT. [${MARK}]
 * Lizenziert, nicht verkauft — Nutzung nur durch autorisierte brospify-Abonnenten gemäß den
 * brospify-Nutzungsbedingungen. Vervielfältigung, Bearbeitung, Weitergabe oder das
 * Entfernen/Umgehen der Schutzmechanismen ist untersagt und verletzt das Urheberrecht
 * (§§ 69a ff., 97 UrhG). Kontakt: legal@brospify.com
 */`;
const IP_CSS = IP_JS.replace("/*", "/*!");
// HTML-Kommentar (NICHT Liquid), damit stripThemeComments() ihn nicht entfernt.
const IP_HTML = `<!-- © 2026 brospify. VERTRAULICH & URHEBERRECHTLICH GESCHÜTZT. [${MARK}] Lizenziert, nicht verkauft. Entfernen/Umgehen der Schutzmechanismen untersagt (§§ 69a ff., 97 UrhG). legal@brospify.com -->`;

// ── Geteilter Verdikt-Helfer (in jede Sperre dupliziert = Redundanz) ─────────
const bspxEnsure = (hubUrl: string) => `
  function bspxEnsure(){
    if(window.__bspxV)return window.__bspxV;
    var B=window.BSPX||{},code=(B.code||'').replace(/^\\s+|\\s+$/g,''),host=(location.hostname||'').toLowerCase();
    var skip=(window.Shopify&&window.Shopify.designMode)||!host||host==='localhost'||host==='127.0.0.1'||/(^|\\.)brospifyhub\\.com$/.test(host)||/\\.vercel\\.app$/.test(host)||!code;
    if(skip)return(window.__bspxV=Promise.resolve(false));
    try{var c=JSON.parse(localStorage.getItem('bspxLicV2')||'null');if(c&&c.key===code&&Date.now()-c.t<(c.valid?6e5:864e5))return(window.__bspxV=Promise.resolve(!c.valid));}catch(e){}
    var url=(B.hub||'${hubUrl}')+'/api/storefront/status/'+encodeURIComponent(code)+'?t='+Date.now();
    return(window.__bspxV=fetch(url,{headers:{Accept:'application/json'}}).then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(v){var l=!!(v&&v.locked===true);try{localStorage.setItem('bspxLicV2',JSON.stringify({key:code,valid:!l,t:Date.now()}));}catch(e){}return l;}).catch(function(){return false;}));
  }`;

// ── Modul 1: License-Key-Feld (nutze bestehendes ensureLicenseSchema; hier Fallback) ──
export function ensureBrospifyKeyField(zip: AdmZip): void {
  const raw = readEntry(zip, "config/settings_schema.json");
  if (!raw) return;
  let schema: unknown;
  try { schema = JSON.parse(raw); } catch { return; }
  if (!Array.isArray(schema)) return;
  type G = { name?: string; settings?: Array<{ id?: string }> };
  const has = (g: G) => Array.isArray(g?.settings) && g.settings.some((s) => s?.id === "license_key");
  const arr = (schema as G[]).filter((g) => !has(g));
  const group = {
    name: "🔑 Brospify License Key",
    settings: [
      { type: "paragraph", content: "Ohne gültigen Key / bei inaktivem Abo werden Inhalte gesperrt und die Kaufbox deaktiviert (Header & Footer/Impressum bleiben sichtbar)." },
      { type: "text", id: "license_key", label: "License Key", placeholder: "bspx_xxxxxxxxxxxxxxxxxxxxxx" },
    ],
  };
  arr.splice(arr.length > 0 && arr[0]?.name === "theme_info" ? 1 : 0, 0, group as unknown as G);
  writeEntry(zip, "config/settings_schema.json", JSON.stringify(arr, null, 2));
}

// ── Modul 1: IP-Header + Config-Bootstrap in theme.liquid; theme-editor.js live laden ──
export function injectHeadBootstrap(zip: AdmZip, hubUrl: string): void {
  prependOnce(zip, "assets/global.js", MARK, IP_JS);
  prependOnce(zip, "assets/base.css", MARK, IP_CSS);

  let t = readEntry(zip, "layout/theme.liquid");
  if (t && !t.includes(MARK)) {
    // IP-Header (HTML-Kommentar) + Config-Bootstrap direkt nach <head>.
    const boot = `\n    ${IP_HTML}\n    <script>window.BSPX={code:{{ settings.license_key | default: '' | json }},hub:${JSON.stringify(hubUrl)}};</script>`;
    t = t.replace(/<head>/i, `<head>${boot}`);
    // FOOTGUN: theme-editor.js lädt in Dawn nur via {% if request.design_mode %}.
    // Für die Live-Sperre unkonditional laden — vor </head> (robust ggü. Basis-Varianten).
    t = t.replace(
      /<\/head>/i,
      `    <script src="{{ 'theme-editor.js' | asset_url }}" defer="defer"></script>\n  </head>`
    );
    writeEntry(zip, "layout/theme.liquid", t);
  }
}

// ── Modul 2: Kaufbox-Gate → global.js ────────────────────────────────────────
export function injectBuyboxGate(zip: AdmZip, hubUrl: string): void {
  const block = `
/* [${MARK}] brospify Kaufbox-Sperre — API-gated, fail-open, Event- + Netzwerkebene. */
(function(){
  var STATE={locked:false},BLOCK=/\\/cart\\/(add|update|change|clear)(\\.js)?(\\?|$)|\\/checkout(\\/|\\?|$)/i;
  ${bspxEnsure(hubUrl)}
  var _f=window.fetch?window.fetch.bind(window):null;
  if(_f)window.fetch=function(i,init){try{var u=typeof i==='string'?i:(i&&i.url)||'',m=(init&&init.method)||(i&&i.method)||'GET';if(STATE.locked&&BLOCK.test(u)&&/post/i.test(m))return Promise.reject(new Error('bspx_locked'));}catch(e){}return _f(i,init);};
  var _o=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){this.__m=m;this.__u=u;return _o.apply(this,arguments);};
  var _s=XMLHttpRequest.prototype.send;XMLHttpRequest.prototype.send=function(){if(STATE.locked&&/post/i.test(this.__m||'')&&BLOCK.test(this.__u||'')){try{this.abort();}catch(e){}return;}return _s.apply(this,arguments);};
  function stop(e){e.preventDefault();e.stopImmediatePropagation();}
  document.addEventListener('submit',function(e){if(!STATE.locked)return;var f=e.target;if(f&&((f.action&&/\\/cart\\/add/i.test(f.action))||(f.matches&&f.matches('[data-type="add-to-cart-form"]'))))stop(e);},true);
  document.addEventListener('click',function(e){if(!STATE.locked)return;var t=e.target&&e.target.closest&&e.target.closest('[name="add"], .product-form__submit, .shopify-payment-button__button');if(t)stop(e);},true);
  function neuter(){document.querySelectorAll('product-form [name="add"], .product-form__submit').forEach(function(b){b.setAttribute('aria-disabled','true');b.setAttribute('disabled','disabled');b.classList.add('bspx-disabled');});}
  bspxEnsure().then(function(l){if(!l)return;STATE.locked=true;document.documentElement.classList.add('bspx-lic-locked');if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',neuter);else neuter();});
})();`;
  appendOnce(zip, "assets/global.js", "buybox", block);
}

// ── Modul 4: 3-fach-Redundanz — base.css / theme-editor.js / details-disclosure.js ──
export function injectRedundancyLocks(zip: AdmZip, hubUrl: string): void {
  // 4.1 CSS-Sperre (#MainContent, NICHT .main-content)
  appendOnce(zip, "assets/base.css", "css-lock", `
/* [${MARK}] Layout-Integrität + Außer-Betrieb-Karte (Footer bleibt sichtbar). */
html.bspx-lic-locked [data-bspx-guard]{display:none !important;height:0 !important;overflow:hidden !important;pointer-events:none !important;}
html.bspx-lic-locked #MainContent > .shopify-section:not([data-bspx-keep]):not(:has(.product-form)){display:none !important;}
.bspx-disabled{pointer-events:none !important;opacity:.5 !important;cursor:not-allowed !important;}
#bspx-of{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;padding:56px 24px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}
.bspx-of-card{max-width:560px;background:#fff;border:1px solid #ececec;border-radius:22px;padding:52px 44px;box-shadow:0 24px 70px rgba(0,0,0,.07);}
.bspx-of-card .bspx-of-ico{font-size:44px;line-height:1;margin-bottom:18px;}
.bspx-of-card h1{font-size:27px;line-height:1.25;margin:0 0 12px;color:#111;font-weight:700;letter-spacing:-.01em;}
.bspx-of-card p{font-size:15px;line-height:1.6;color:#5b5b5b;margin:0;}
.bspx-of-mark{display:inline-block;margin-top:30px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8a8a8a;text-decoration:none;border:1px solid #e4e4df;border-radius:999px;padding:9px 18px;background:#fff;transition:color .15s,border-color .15s;}
.bspx-of-mark:hover{color:#111;border-color:#cfcfc9;}
.bspx-of-mark b{color:#111;font-weight:700;}`);

  // 4.2 DOM-Removal per Scroll-Listener (+ DOMContentLoaded/section:load) → theme-editor.js
  appendOnce(zip, "assets/theme-editor.js", "dom", `
/* [${MARK}] Integritäts-Wächter. Nur live (nie im Customizer). */
(function(){
  ${bspxEnsure(hubUrl)}
  function guard(){
    document.querySelectorAll('#MainContent .shopify-section').forEach(function(s){if(s.querySelector('.product-form')||s.hasAttribute('data-bspx-keep'))return;s.setAttribute('data-bspx-guard','');});
    document.querySelectorAll('[data-bspx-guard]').forEach(function(s){s.setAttribute('hidden','hidden');s.style.setProperty('display','none','important');s.replaceChildren();});
  }
  function apply(){bspxEnsure().then(function(l){if(!l)return;document.documentElement.classList.add('bspx-lic-locked');guard();});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();
  document.addEventListener('shopify:section:load',apply);
  window.addEventListener('pageshow',apply);
  window.addEventListener('scroll',apply,{passive:true}); // wie in deiner Spec: greift auch beim Scrollen
})();`);

  // 4.3 Außer-Betrieb-Karte per Intervall (2s) → details-disclosure.js
  //     Zeigt bei inaktiver Lizenz eine designte Karte + brospify-Watermark IN
  //     #MainContent (kein Vollbild-Overlay) → Header & Footer/Impressum bleiben
  //     sichtbar. Das Intervall re-injiziert die Karte, falls sie entfernt wird.
  appendOnce(zip, "assets/details-disclosure.js", "overlay", `
/* [${MARK}] Außer-Betrieb-Wächter (2s-Intervall). Header/Footer bleiben sichtbar. */
(function(){
  ${bspxEnsure(hubUrl)}
  function overlay(){
    var main=document.getElementById('MainContent')||document.querySelector('main');
    if(!main||document.getElementById('bspx-of'))return;
    var o=document.createElement('div');o.id='bspx-of';
    o.innerHTML='<div class="bspx-of-card"><div class="bspx-of-ico">\\u23F8\\uFE0F</div>'+
      '<h1>Der Shop ist aktuell au\\u00dfer Betrieb.</h1>'+
      '<p>Bitte schau zu einem sp\\u00e4teren Zeitpunkt noch einmal vorbei.</p></div>'+
      '<a class="bspx-of-mark" href="https://brospify.ai" target="_blank" rel="noopener">powered by <b>brospify.ai</b></a>';
    main.appendChild(o);
  }
  function tick(){if(!document.documentElement.classList.contains('bspx-lic-locked'))return;overlay();document.querySelectorAll('[data-bspx-guard]').forEach(function(s){s.style.setProperty('display','none','important');});}
  bspxEnsure().then(function(l){if(!l)return;document.documentElement.classList.add('bspx-lic-locked');overlay();});
  setInterval(tick,2000);
})();`);
}

// ── Modul 5: Händler-Hinweis im Customizer (design_mode) bei gesperrter Lizenz ──
//    Sperrt NICHT (Bearbeiten bleibt möglich), zeigt dem Händler nur eine kleine
//    Meldung, dass sein Theme gesperrt ist.
export function injectMerchantNotice(zip: AdmZip, hubUrl: string): void {
  const block = `
/* [${MARK}] Händler-Hinweis: zeigt im Shopify-Customizer (design_mode), dass das
   Theme gesperrt ist. Sperrt NICHT — Bearbeiten bleibt möglich. */
(function(){
  if(!(window.Shopify&&window.Shopify.designMode))return;
  var B=window.BSPX||{},code=(B.code||'').replace(/^\\s+|\\s+$/g,'');
  function banner(msg){
    if(document.getElementById('bspx-merch'))return;
    var el=document.createElement('div');el.id='bspx-merch';
    el.setAttribute('style','position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483647;max-width:min(680px,calc(100vw - 32px));background:#fff;color:#111;border:1px solid #f1c5c5;border-left:4px solid #e74c3c;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.18);padding:13px 16px;font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;');
    el.innerHTML='<b>brospify:</b> '+msg;
    document.body.appendChild(el);
  }
  function onReady(fn){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn);else fn();}
  if(!code){onReady(function(){banner('Dein Theme ist noch nicht freigeschaltet — trage deinen Brospify-Lizenz-Key in den Theme-Einstellungen ein.');});return;}
  fetch((B.hub||'${hubUrl}')+'/api/storefront/status/'+encodeURIComponent(code)+'?t='+Date.now(),{headers:{Accept:'application/json'}})
    .then(function(r){return r.ok?r.json():null;})
    .then(function(v){if(v&&v.locked===true)onReady(function(){banner('Dein Theme ist aktuell GESPERRT (Lizenz ung\\u00fcltig oder Abo inaktiv). Auf der Live-Storefront sehen Kunden „au\\u00dfer Betrieb". Trage einen g\\u00fcltigen Sync-Code ein, um es freizuschalten.');});})
    .catch(function(){});
})();`;
  appendOnce(zip, "assets/global.js", "merchant", block);
}

// ── Orchestrator ─────────────────────────────────────────────────────────────
export function injectBrospifyGate(zip: AdmZip, opts: { hubUrl: string }): void {
  const hubUrl = (opts.hubUrl || "https://brospifyhub.com").replace(/\/+$/, "");
  ensureBrospifyKeyField(zip);   // Modul 1 (Key-Feld)
  injectHeadBootstrap(zip, hubUrl); // Modul 1 (IP-Header + window.BSPX + theme-editor.js live)
  injectBuyboxGate(zip, hubUrl);    // Modul 2 (Kaufbox)
  injectRedundancyLocks(zip, hubUrl); // Modul 4 (3-fach-Sperre)
  injectMerchantNotice(zip, hubUrl);  // Modul 5 (Händler-Hinweis im Customizer)
  // Modul 3 (Sektionen) bleibt dein bestehender Section-Build — keine Änderung nötig.
}
