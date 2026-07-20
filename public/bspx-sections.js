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

  var code = host.getAttribute("data-bspx-code") || "";
  var hub = (host.getAttribute("data-bspx-hub") || "").replace(/\/+$/, "");
  var key = (host.getAttribute("data-bspx-key") || "").replace(/^\s+|\s+$/g, "");
  var template = host.getAttribute("data-bspx-template") || "index";
  var mount = document.getElementById("MainContent") || host.parentNode || document.body;
  var CACHE_KEY = "bspxSections:" + code + ":" + key + ":" + template;

  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  // Injiziertes HTML kann <script>-Tags enthalten (Dawn-Custom-Elements
  // etc.). innerHTML führt die NICHT aus — deshalb neu erzeugen.
  function runScripts(container) {
    var scripts = container.querySelectorAll("script");
    for (var i = 0; i < scripts.length; i++) {
      var old = scripts[i];
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
      st.innerHTML = css;
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

  // OHNE API-Key (Theme-Einstellungen, Gruppe „🔑 Brospify API-Key") werden
  // grundsätzlich KEINE Sektionen geladen — auch nicht aus dem Cache.
  if (!key) { showOffline(); return; }
  if (!code || !hub) { fromCache() || showOffline(); return; }

  // www↔Apex probieren (Redirects tragen keine CORS-Header).
  var candidates = [hub];
  var swapped = /:\/\/www\./.test(hub) ? hub.replace("://www.", "://") : hub.replace("://", "://www.");
  if (swapped !== hub) candidates.push(swapped);

  function fetchFrom(i) {
    if (i >= candidates.length) { if (!fromCache()) showOffline(); return; }
    var base = candidates[i];
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, FETCH_TIMEOUT);
    fetch(base + "/api/storefront/render/" + encodeURIComponent(code) + "?key=" + encodeURIComponent(key), { signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        clearTimeout(timer);
        if (!r.ok) { if (!fromCache()) showOffline(); return null; }
        return r.json();
      })
      .then(function (data) { if (data && !useData(data)) { if (!fromCache()) showOffline(); } })
      .catch(function () { clearTimeout(timer); fetchFrom(i + 1); });
  }
  fetchFrom(0);
})();
