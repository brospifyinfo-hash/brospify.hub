/* Brospify Sektions-Runtime (Storefront).
 *
 * Lädt die Sektionen des Shops LIVE vom Brospify-Hub und fügt sie ein.
 * Der Sektions-CODE liegt dadurch NIE im Kunden-Theme — nur diese Runtime
 * + ein (unratbarer) Code. Ohne AKTIVE Lizenz liefert der Hub kein HTML
 * → der Shop zeigt eine „außer Betrieb"-Seite (der Footer bleibt sichtbar,
 * er liegt außerhalb von #MainContent).
 *
 * Host-Element (aus sections/bspx-host.liquid):
 *   <div id="bspx-sections" data-bspx-code="..." data-bspx-hub="..."
 *        data-bspx-template="product|index"></div>
 */
(function () {
  "use strict";
  var FETCH_TIMEOUT = 8000;
  var host = document.getElementById("bspx-sections");
  if (!host || host.__bspx) return;
  host.__bspx = true;

  var code = (host.getAttribute("data-bspx-code") || "").replace(/^\s+|\s+$/g, "");
  var hub = (host.getAttribute("data-bspx-hub") || "").replace(/\/+$/, "");
  var template = host.getAttribute("data-bspx-template") || "index";
  var mount = document.getElementById("MainContent") || host.parentNode || document.body;
  var CACHE_KEY = "bspxSections:" + code + ":" + template;

  // Welche Hub-Basis hat wirklich geantwortet (www↔Apex) — die nutzen wir
  // auch fürs Nachladen der Kaufbox-Runtime.
  var usedHub = hub;
  // Eigene, bereits abo-gegatete Query (?code=…&shop=…&v=…) übernehmen.
  var selfQuery = (function () {
    var els = document.querySelectorAll('script[src*="bspx-sections.js"]');
    for (var i = 0; i < els.length; i++) {
      var src = els[i].getAttribute("src") || "";
      var qi = src.indexOf("?");
      if (qi >= 0) return src.slice(qi);
    }
    return "?code=" + encodeURIComponent(code) + "&shop=" + encodeURIComponent(location.hostname);
  })();

  // KAUFBOX-RETTUNG: Ältere Themes laden die Kaufbox-Runtime noch als
  // Theme-Asset (assets/bspx-runtime.js). Die liegt seit dem Code-Schutz
  // NICHT mehr im ZIP — in solchen Shops bliebe die Kaufbox für immer leer.
  // Da diese Datei hier abo-gegatet vom Hub kommt (also immer aktuell ist),
  // holen wir die Runtime im Zweifel selbst nach.
  // force = true: auch dann laden, wenn schon irgendeine Runtime im Theme
  // steckt. Genau das ist der Bestands-Shop mit ALTER Runtime, die nur den
  // Notfall-Fallback zeigt — die neue Version uebernimmt dann.
  function ensureBuyboxRuntime(container, force) {
    var host = container.querySelector(".bspx-host");
    if (!host) return;
    if (document.querySelector("script[data-bspx-runtime]")) return;
    var mount = host.querySelector(".bspx-mount");
    if (mount && mount.children.length) return; // Kaufbox steht schon
    if (!force && window.__bspxLoaded) return;  // Runtime laedt evtl. gerade
    var s = document.createElement("script");
    s.setAttribute("data-bspx-runtime", "1");
    s.src = usedHub + "/api/storefront/asset/bspx-runtime.js" + selfQuery;
    s.onload = function () {
      try { document.dispatchEvent(new Event("shopify:section:load")); } catch (e) { /* alte Browser */ }
    };
    document.head.appendChild(s);
  }

  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  // Echte Asset-Basis des Themes (CDN). Der Server rendert Asset-
  // Referenzen als __BSPX_ASSET__/name; hier werden sie auf die echten
  // Theme-Dateien umgeschrieben (CSS/JS/Bilder liegen im Theme).
  // BEVORZUGT: data-bspx-assets am Host (per Liquid asset_url berechnet) —
  // diese Runtime wird abo-gegated vom HUB geladen, ihre eigene Script-URL
  // zeigt also NICHT mehr auf die Theme-CDN. Fallback für alte Themes
  // (Runtime als Theme-Asset): Verzeichnis der eigenen Script-URL, dabei
  // Hub-URLs (/api/storefront/asset/…) überspringen.
  var assetBase = (function () {
    var attr = host.getAttribute("data-bspx-assets") || "";
    var m0 = attr.match(/^(.*\/)[^/]*$/);
    if (m0) return m0[1];
    var els = document.querySelectorAll('script[src*="bspx-sections"]');
    for (var i = 0; i < els.length; i++) {
      var src = els[i].getAttribute("src") || "";
      if (src.indexOf("/api/storefront/asset/") >= 0) continue;
      var m = src.match(/^(.*\/)[^/]*$/);
      if (m) return m[1];
    }
    return "";
  })();
  function rewriteAssets(container) {
    if (!assetBase) return;
    var nodes = container.querySelectorAll('[src*="__BSPX_ASSET__/"],[href*="__BSPX_ASSET__/"]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      ["src", "href"].forEach(function (attr) {
        var v = el.getAttribute(attr);
        if (v && v.indexOf("__BSPX_ASSET__/") >= 0) {
          el.setAttribute(attr, v.replace(/.*__BSPX_ASSET__\//, assetBase));
        }
      });
    }
  }
  function rewriteCssAssets(css) {
    return assetBase ? css.split("__BSPX_ASSET__/").join(assetBase) : css;
  }

  // Injiziertes HTML kann <script>-Tags enthalten (Dawn-Custom-Elements
  // etc.). innerHTML führt die NICHT aus — deshalb neu erzeugen. Bereits
  // geladene Dateien (gleicher Dateiname) NICHT doppelt ausführen —
  // Custom-Element-Doppelregistrierung würde werfen.
  function runScripts(container) {
    var loaded = {};
    var existing = document.querySelectorAll("script[src]");
    for (var e = 0; e < existing.length; e++) {
      var n = (existing[e].getAttribute("src") || "").split("?")[0].split("/").pop();
      if (n) loaded[n] = true;
    }
    var scripts = container.querySelectorAll("script");
    for (var i = 0; i < scripts.length; i++) {
      var old = scripts[i];
      var srcName = (old.getAttribute("src") || "").split("?")[0].split("/").pop();
      if (srcName && loaded[srcName]) { old.parentNode.removeChild(old); continue; }
      if (srcName) loaded[srcName] = true;
      var s = document.createElement("script");
      for (var a = 0; a < old.attributes.length; a++) {
        s.setAttribute(old.attributes[a].name, old.attributes[a].value);
      }
      s.textContent = old.textContent;
      old.parentNode.replaceChild(s, old);
    }
  }

  function injectCss(css, fontHref) {
    if (fontHref && !document.getElementById("bspx-sec-font")) {
      var l = document.createElement("link");
      l.id = "bspx-sec-font";
      l.rel = "stylesheet";
      l.href = fontHref;
      document.head.appendChild(l);
    }
    if (css && !document.getElementById("bspx-sec-style")) {
      var st = document.createElement("style");
      st.id = "bspx-sec-style";
      st.innerHTML = rewriteCssAssets(css);
      document.head.appendChild(st);
    }
  }

  function renderSections(data) {
    var html = template === "product" ? data.product : data.index;
    if (typeof html !== "string") return false;
    injectCss(data.css, data.fontHref);
    onReady(function () {
      var slot = document.getElementById("bspx-sections-slot");
      if (!slot) {
        slot = document.createElement("div");
        slot.id = "bspx-sections-slot";
        mount.appendChild(slot);
      }
      slot.innerHTML = html;
      rewriteAssets(slot);
      runScripts(slot);

      // Kaufbox: das server-gerenderte HTML enthält den Kaufbox-Host mit
      // einem PLATZHALTER-Produkt. Das ECHTE Shopify-Produkt kommt aus dem
      // Theme-Liquid (#bspx-real-product) — hier reinkopieren, damit die
      // Kaufbox-Runtime (bspx-runtime.js) mit den echten Varianten/Preisen
      // den Kaufen-Button korrekt füllt.
      var real = document.getElementById("bspx-real-product");
      if (real) {
        var hostProductScript = slot.querySelector(".bspx-host script[data-bspx-product]");
        if (hostProductScript) hostProductScript.textContent = real.textContent;
      }

      var sk = document.getElementById("bspx-sections-skeleton");
      if (sk) sk.style.display = "none";

      // Fehlt die Kaufbox-Runtime im installierten Theme, hier nachladen …
      ensureBuyboxRuntime(slot);
      // … und nachfassen, falls die Kaufbox nach ein paar Sekunden immer
      // noch leer ist (alte Runtime im Theme, die aufgibt).
      setTimeout(function () { ensureBuyboxRuntime(slot, true); }, 2500);

      // Kaufbox-Runtime anstoßen (sie bootet auf dieses Event neu gesetzte
      // Hosts) — sonst füllt sie erst nach ihrem 1,5s-Fallback.
      try { document.dispatchEvent(new Event("shopify:section:load")); } catch (e) { /* alte Browser */ }
    });
    return true;
  }

  function showOffline(message) {
    onReady(function () {
      if (document.getElementById("bspx-sec-offline")) return;
      // Das GLOBALE Gate (license-check.liquid) zeigt dieselbe Karte auf
      // jeder Seite — wenn es schon gesperrt hat, keine zweite Karte bauen.
      if (document.getElementById("bspx-lic-offline")) return;
      // Header/Announcement/Countdown ebenfalls verbergen — ohne Key soll
      // die KOMPLETTE Website weg sein, nur der Footer (Impressum) bleibt.
      var headerGroups = document.querySelectorAll(".shopify-section-group-header-group");
      for (var h = 0; h < headerGroups.length; h++) headerGroups[h].style.display = "none";
      // Alle bereits vorhandenen Inhalte in #MainContent verbergen (der
      // Footer liegt außerhalb und bleibt sichtbar → Impressum garantiert).
      var kids = mount.children;
      for (var i = 0; i < kids.length; i++) {
        if (kids[i].id !== "bspx-sec-offline") kids[i].style.display = "none";
      }
      var box = document.createElement("div");
      box.id = "bspx-sec-offline";
      box.setAttribute(
        "style",
        "min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"
      );
      box.innerHTML =
        '<div style="max-width:560px;background:#fff;border:1px solid #e8e8e4;border-radius:20px;padding:48px 40px;box-shadow:0 20px 60px rgba(0,0,0,.06)">' +
        '<div style="font-size:40px;margin-bottom:16px">⏸️</div>' +
        '<h1 style="font-size:26px;line-height:1.25;margin:0 0 12px;color:#111;font-weight:700">Der Shop ist aktuell leider außer Betrieb.</h1>' +
        '<p style="font-size:15px;line-height:1.6;color:#555;margin:0">Bitte schau zu einem späteren Zeitpunkt noch einmal vorbei.</p></div>' +
        '<a href="https://brospify.ai" target="_blank" rel="noopener" style="margin-top:32px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#888;text-decoration:none;border:1px solid #e2e2de;border-radius:999px;padding:9px 16px;background:#fff">powered by <b style="color:#111">brospify.ai</b></a>';
      mount.appendChild(box);
    });
  }

  function useData(data) {
    if (!data) return false;
    if (data.locked === true) {
      showOffline(data.message);
      return true; // „locked" ist ein GÜLTIGES Ergebnis (nicht in den Cache-Fallback)
    }
    if (renderSections(data)) {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: data, ts: Date.now() })); } catch (e) { /* voll */ }
      return true;
    }
    return false;
  }

  function fromCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return false;
      var c = JSON.parse(raw);
      return c && c.data ? renderSections(c.data) : false;
    } catch (e) { return false; }
  }

  // OHNE Code (Theme-Einstellungen, Feld „🔑 Brospify Sync-Code") werden
  // grundsätzlich KEINE Sektionen geladen — auch nicht aus dem Cache.
  if (!code || !hub) { showOffline(); return; }

  // www↔Apex probieren (Redirects tragen keine CORS-Header).
  var candidates = [hub];
  var swapped = /:\/\/www\./.test(hub) ? hub.replace("://www.", "://") : hub.replace("://", "://www.");
  if (swapped !== hub) candidates.push(swapped);

  function fetchFrom(i) {
    if (i >= candidates.length) { if (!fromCache()) showOffline(); return; }
    var base = candidates[i];
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, FETCH_TIMEOUT);
    fetch(base + "/api/storefront/render/" + encodeURIComponent(code), { signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        clearTimeout(timer);
        if (!r.ok) { if (!fromCache()) showOffline(); return null; }
        usedHub = base;
        return r.json();
      })
      .then(function (data) { if (data && !useData(data)) { if (!fromCache()) showOffline(); } })
      .catch(function () { clearTimeout(timer); fetchFrom(i + 1); });
  }
  fetchFrom(0);
})();
