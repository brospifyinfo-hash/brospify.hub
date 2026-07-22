/* Brospify Dynamic Buybox Runtime
 * Läuft im Shopify-Storefront des Kunden. Holt den Design-Plan vom Hub
 * (GET {hub}/api/buybox/{code}), rendert die Produktinfo-Spalte aus Plan +
 * lokalem Produkt-JSON ({{ product | json }}) und verdrahtet den Kauf mit
 * der nativen Shopify-Form (/cart/add) — der Hub ist am Kauf nie beteiligt.
 * Fallback-Kaskade: Netz-Fehler → letzter Plan aus localStorage → native
 * Fallback-Form (Shop bleibt IMMER kaufbar).
 */
(function () {
  "use strict";
  if (window.__bspxLoaded) return;
  window.__bspxLoaded = true;

  var FETCH_TIMEOUT = 7000;

  function money(cents) {
    var cur = (window.Shopify && Shopify.currency && Shopify.currency.active) || "EUR";
    try {
      return new Intl.NumberFormat(document.documentElement.lang || "de-DE", { style: "currency", currency: cur }).format(cents / 100);
    } catch (e) {
      return (cents / 100).toFixed(2) + " €";
    }
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function svg(paths, size) {
    var NS = "http://www.w3.org/2000/svg";
    var s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("width", size || 15);
    s.setAttribute("height", size || 15);
    s.setAttribute("fill", "none");
    s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "1.9");
    s.setAttribute("stroke-linecap", "round");
    s.setAttribute("stroke-linejoin", "round");
    (paths || []).forEach(function (d) {
      var p = document.createElementNS(NS, "path");
      p.setAttribute("d", d);
      s.appendChild(p);
    });
    return s;
  }

  var TL_ICONS = {
    bag: ["M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z", "M3 6h18", "M16 10a4 4 0 0 1-8 0"],
    truck: ["M1 3h15v13H1z", "M16 8h4l3 3v5h-7", "M5.5 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z", "M18.5 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"],
    pkg: ["M12 2 3 7v10l9 5 9-5V7Z", "M3 7l9 5 9-5", "M12 12v10"],
  };

  function dateIn(days) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    if (days === 0) return "Heute";
    if (days === 1) return "Morgen";
    try {
      return new Intl.DateTimeFormat(document.documentElement.lang || "de-DE", { day: "2-digit", month: "long" }).format(d);
    } catch (e) {
      return d.toLocaleDateString();
    }
  }

  function payMark(name) {
    var box = el("span", "bspx-pay-box");
    if (name === "visa") { var v = el("b", "", "VISA"); v.style.cssText = "color:#1a1f71;font-style:italic;font-weight:800;font-size:12px"; box.appendChild(v); }
    else if (name === "mc") {
      var w = el("span"); w.style.cssText = "display:inline-flex;align-items:center";
      var c1 = el("span"); c1.style.cssText = "width:14px;height:14px;border-radius:50%;background:#eb001b";
      var c2 = el("span"); c2.style.cssText = "width:14px;height:14px;border-radius:50%;background:#f79e1b;margin-left:-6px;mix-blend-mode:multiply";
      w.appendChild(c1); w.appendChild(c2); box.appendChild(w);
    } else if (name === "klarna") { var k = el("b", "", "Klarna."); k.style.cssText = "background:#ffb3c7;color:#0a0a0a;font-weight:800;font-size:10px;padding:2px 5px;border-radius:4px"; box.appendChild(k); }
    else if (name === "paypal") { var p = el("b"); p.style.cssText = "font-style:italic;font-weight:800;font-size:11px"; var p1 = el("span", "", "Pay"); p1.style.color = "#003087"; var p2 = el("span", "", "Pal"); p2.style.color = "#0070e0"; p.appendChild(p1); p.appendChild(p2); box.appendChild(p); }
    else if (name === "apple") { var a = el("b", "", " Pay"); a.style.cssText = "font-weight:600;font-size:11px;color:#000"; box.appendChild(a); }
    else if (name === "google") { var g = el("b", "", "G Pay"); g.style.cssText = "font-weight:700;font-size:11px;color:#3c4043"; box.appendChild(g); }
    return box;
  }

  // ── Produkt-Helfer ────────────────────────────────────────────────
  function variantByOptions(product, sel) {
    for (var i = 0; i < product.variants.length; i++) {
      var v = product.variants[i];
      var match = true;
      for (var j = 0; j < sel.length; j++) {
        if (sel[j] != null && (v.options ? v.options[j] : v["option" + (j + 1)]) !== sel[j]) { match = false; break; }
      }
      if (match) return v;
    }
    return null;
  }
  function optionValues(product, idx) {
    var seen = [], out = [];
    product.variants.forEach(function (v) {
      var val = v.options ? v.options[idx] : v["option" + (idx + 1)];
      if (val != null && seen.indexOf(val) < 0) { seen.push(val); out.push(val); }
    });
    return out;
  }
  function hasRealVariants(product) {
    return product.variants && product.variants.length > 1;
  }

  // ── Boot je Host ─────────────────────────────────────────────────
  function initHost(host) {
    if (host.__bspx) return;
    host.__bspx = true;
    var code = host.getAttribute("data-bspx-code") || "";
    var hub = (host.getAttribute("data-bspx-hub") || "").replace(/\/$/, "");
    var assetUrl = host.getAttribute("data-bspx-asset") || "";
    var mount = host.querySelector(".bspx-mount");
    var skeleton = host.querySelector(".bspx-skeleton");
    var fallback = host.querySelector(".bspx-fallback");
    var productTag = host.querySelector("script[data-bspx-product]");
    var product = null;
    try { product = JSON.parse(productTag ? productTag.textContent : "null"); } catch (e) { /* noop */ }

    function showFallback() {
      if (skeleton) skeleton.style.display = "none";
      if (fallback) fallback.hidden = false;
    }
    if (!mount || !product) { showFallback(); return; }

    var cacheKey = "bspx:" + code;

    function useData(data) {
      try {
        render(host, mount, skeleton, fallback, product, data.plan, data.css);
        return true;
      } catch (e) {
        if (window.console) console.warn("[bspx] render failed", e);
        return false;
      }
    }

    function tryCache() {
      if (!code) return false;
      try {
        var raw = localStorage.getItem(cacheKey);
        if (!raw) return false;
        var data = JSON.parse(raw);
        if (!data || !data.plan) return false;
        return useData(data);
      } catch (e) { return false; }
    }

    // Im ZIP eingebackener Plan (assets/bspx-plan.json) — rendert IMMER,
    // auch wenn Hub/Code/Netz komplett ausfallen. Same-Origin, kein CORS.
    function tryAsset(done) {
      if (!assetUrl) { done(false); return; }
      fetch(assetUrl)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { done(!!(d && d.plan && useData(d))); })
        .catch(function () { done(false); });
    }

    function offline() {
      if (tryCache()) return;
      tryAsset(function (ok) { if (!ok) showFallback(); });
    }

    // Kein Code/Hub konfiguriert → direkt eingebackenen Plan nutzen.
    if (!code || !hub) { offline(); return; }

    // WICHTIG: www↔Apex-Redirects tragen keine CORS-Header → der Browser
    // blockt den Fetch, obwohl die API gesund ist. Deshalb BEIDE Varianten
    // probieren (konfigurierte zuerst, dann die getauschte).
    var hubCandidates = [hub];
    var swapped = /:\/\/www\./.test(hub)
      ? hub.replace("://www.", "://")
      : hub.replace("://", "://www.");
    if (swapped !== hub) hubCandidates.push(swapped);

    function fetchPlan(idx) {
      if (idx >= hubCandidates.length) { offline(); return; }
      var base = hubCandidates[idx];
      var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, FETCH_TIMEOUT);
      fetch(base + "/api/buybox/" + encodeURIComponent(code), { signal: ctrl ? ctrl.signal : undefined })
        .then(function (r) {
          clearTimeout(timer);
          if (!r.ok) { offline(); return null; } // 404 = Code unbekannt (definitiv)
          return r.json();
        })
        .then(function (data) {
          if (!data) return;
          if (data.locked === true) {
            // Abo inaktiv — GÜLTIGES Verdikt (kein Netzfehler): NICHT in den
            // Cache-/Asset-Fallback laufen, gecachten Plan verwerfen. Die
            // native Fallback-Form bleibt kaufbar (der Kauf gehört dem Shop,
            // nur das Brospify-Design ist gesperrt).
            try { localStorage.removeItem(cacheKey); } catch (e) { /* egal */ }
            showFallback();
            return;
          }
          try { localStorage.setItem(cacheKey, JSON.stringify({ plan: data.plan, css: data.css, ts: Date.now() })); } catch (e) { /* voll */ }
          if (!useData(data)) offline();
        })
        .catch(function () {
          clearTimeout(timer);
          if (window.console) console.warn("[bspx] Hub nicht erreichbar über " + base + (idx + 1 < hubCandidates.length ? " — probiere Alternative" : ""));
          fetchPlan(idx + 1); // Netz-/CORS-Fehler → andere Domain-Variante
        });
    }
    fetchPlan(0);
  }

  // ── Rendering ────────────────────────────────────────────────────
  function render(host, mount, skeleton, fallback, product, plan, css) {
    if (!plan || !plan.blocks) throw new Error("kein Plan");

    // Styles + Fonts einmalig injizieren.
    if (css && !document.getElementById("bspx-style")) {
      var st = document.createElement("style");
      st.id = "bspx-style";
      st.textContent = css;
      document.head.appendChild(st);
    }
    if (plan.fonts && plan.fonts.url && !document.getElementById("bspx-fonts")) {
      var lk = document.createElement("link");
      lk.id = "bspx-fonts"; lk.rel = "stylesheet"; lk.href = plan.fonts.url;
      document.head.appendChild(lk);
    }

    var root = el("div", "bspx-root bspx-ic-" + (plan.vars.iconStyle || "dark"));
    var v = plan.vars;
    root.style.cssText = "--bx-bg:" + v.bg + ";--bx-text:" + v.text + ";--bx-btn:" + v.btn + ";--bx-btnText:" + v.btnText +
      ";--bx-accent:" + v.accent + ";--bx-r:" + v.radius + "px;--bx-bd:" + v.border + "px;--bx-shadow:" +
      ["none", "0 4px 14px -8px rgba(0,0,0,.16)", "0 12px 30px -10px rgba(0,0,0,.26)"][v.shadow || 0] +
      ";--bx-h:" + plan.fonts.heading + ";--bx-b:" + plan.fonts.body +
      ";--bx-gap:" + (v.gap != null ? v.gap : 15) + "px";

    // Kauf-Zustand
    var state = {
      sel: [],
      variant: null,
      qty: 1,
      bundleQty: null,
      bundleDisc: 0,
      priceEls: [],
      bundleEls: [],
      ctaEl: null,
    };
    // Startvariante: erste verfügbare, sonst erste.
    var first = null;
    for (var i = 0; i < product.variants.length; i++) { if (product.variants[i].available) { first = product.variants[i]; break; } }
    state.variant = first || product.variants[0];
    if (state.variant) {
      state.sel = state.variant.options ? state.variant.options.slice() :
        [state.variant.option1, state.variant.option2, state.variant.option3].filter(function (x) { return x != null; });
    }

    function unit() { return state.variant ? state.variant.price : (product.price || 0); }
    function compareUnit() {
      var c = state.variant && state.variant.compare_at_price;
      return c && c > unit() ? c : Math.round(unit() * 1.6);
    }

    function refreshPrices() {
      state.priceEls.forEach(function (fn) { fn(); });
      state.bundleEls.forEach(function (fn) { fn(); });
      if (state.ctaEl) {
        var ok = state.variant && state.variant.available !== false;
        state.ctaEl.disabled = !ok;
        if (!ok) state.ctaEl.textContent = "Ausverkauft";
      }
    }

    function addToCart() {
      var form = fallback ? fallback.querySelector("form") : null;
      if (!form) form = host.querySelector("form[action*='/cart/add']");
      var qty = state.bundleQty != null ? state.bundleQty : state.qty;
      if (form) {
        var idInput = form.querySelector("[name='id']");
        if (idInput && state.variant) idInput.value = String(state.variant.id);
        var qInput = form.querySelector("[name='quantity']");
        if (!qInput) {
          qInput = document.createElement("input");
          qInput.type = "hidden"; qInput.name = "quantity";
          form.appendChild(qInput);
        }
        qInput.value = String(qty);
        // Native Shopify-Logik: normaler Form-Submit auf /cart/add.
        if (typeof form.requestSubmit === "function") form.requestSubmit();
        else form.submit();
      } else if (state.variant) {
        // Letzte Rettung ohne Form: AJAX + Redirect.
        fetch("/cart/add.js", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: state.variant.id, quantity: qty }),
        }).then(function () { window.location.href = "/cart"; });
      }
    }

    // ── Block-Renderer ──
    var R = {
      sale_banner: function (b) {
        var n = el("div", "bspx-sale");
        n.style.background = b.s.bg || v.accent;
        n.style.color = b.s.t_color || "#fff";
        n.style.borderRadius = (b.s.radius != null ? b.s.radius : 12) + "px";
        if (b.s.b_width) n.style.border = b.s.b_width + "px solid " + (b.s.b_color || v.accent);
        n.appendChild(el("span", "", (b.t.emoji || "") + " " + (b.t.text || "")));
        return n;
      },
      urgency_text: function (b) {
        var txt = b.t.text_prefix || "Angebot endet am";
        if (b.s.auto_date !== false) txt += " " + dateIn(2);
        var n = el("div", "bspx-offer", "🔥 " + txt);
        if (b.s.alignment === "center") n.style.cssText += "display:block;text-align:center";
        if (b.s.font_size) n.style.fontSize = b.s.font_size + "px";
        if (b.s.is_bold === true) n.style.fontWeight = "800";
        else if (b.s.is_bold === false) n.style.fontWeight = "500";
        if (b.s.text_color) n.style.color = String(b.s.text_color);
        return n;
      },
      custom_title: function (b) {
        var n = el("h1", "bspx-title", product.title || "");
        n.style.fontSize = (b.s.font_size_desktop || 28) + "px";
        n.style.fontWeight = String(b.s.font_weight || 800);
        if (b.s.alignment) n.style.textAlign = b.s.alignment;
        if (b.s.text_color) n.style.color = String(b.s.text_color);
        return n;
      },
      custom_rating: function (b) {
        var pill = b.s.__preset === "pill" || b.s.layout_style === "compact_pill";
        var n = el("div", "bspx-rating" + (pill ? " pill" : ""));
        var stars = el("span", "bspx-stars", "★★★★★");
        if (b.s.star_size) stars.style.fontSize = b.s.star_size + "px";
        if (b.s.star_color) stars.style.color = String(b.s.star_color);
        n.appendChild(stars);
        n.appendChild(el("strong", "", b.s.average_value || "4.9"));
        n.appendChild(el("span", "", "· " + (b.t.rating_text || "")));
        if (b.s.text_color) n.style.color = String(b.s.text_color);
        if (b.s.alignment) n.style.justifyContent = String(b.s.alignment);
        return n;
      },
      benefits_list: function (b) {
        // Style-Art des Bausteins (icon_style) schlägt den globalen Icon-Stil;
        // Feineinstellungen (icon_bg/icon_color/text_color/font_size) schlagen
        // beides — exakt wie in der Editor-Vorschau.
        var st = String(b.s.icon_style || "");
        var iconBg = b.s.icon_bg ? String(b.s.icon_bg) : "";
        var iconColor = b.s.icon_color ? String(b.s.icon_color) : "";
        var textColor = b.s.text_color ? String(b.s.text_color) : "";
        var fontSize = Number(b.s.font_size) || 0;
        var gap = Number(b.s.item_gap) || 0;
        var n = el("div", "bspx-benefits");
        if (gap) n.style.gap = gap + "px";
        (plan.benefits || []).forEach(function (bf) {
          var row = el("div", "bspx-benefit");
          if (fontSize) row.style.fontSize = fontSize + "px";
          if (textColor) row.style.color = textColor;
          var ic = el("span", "bspx-bic");
          if (st === "dark_circle") {
            ic.style.background = iconBg || "#161616"; ic.style.color = iconColor || "#fff"; ic.style.border = "0";
          } else if (st === "accent_circle") {
            ic.style.background = iconBg || v.accent; ic.style.color = iconColor || "#fff"; ic.style.border = "0";
          } else if (st === "soft_circle") {
            ic.style.background = "color-mix(in srgb," + (iconBg || v.accent) + " 14%,transparent)";
            ic.style.color = iconColor || v.accent; ic.style.border = "0";
          } else if (st === "outlined") {
            ic.style.background = "transparent";
            ic.style.border = "2px solid " + (iconBg || v.accent);
            ic.style.color = iconColor || v.accent;
          } else {
            if (iconBg) ic.style.background = iconBg;
            if (iconColor) ic.style.color = iconColor;
          }
          ic.appendChild(svg(bf.paths, 15));
          row.appendChild(ic);
          row.appendChild(el("span", "", bf.text));
          n.appendChild(row);
        });
        return n;
      },
      stock_indicator: function (b) {
        var n = el("div", "bspx-stock");
        var dot = el("span", "bspx-dot");
        if (b.s.dot_color) {
          dot.style.background = String(b.s.dot_color);
          dot.style.boxShadow = "0 0 0 3px color-mix(in srgb," + b.s.dot_color + " 25%,transparent)";
        }
        n.appendChild(dot);
        n.appendChild(el("span", "", b.t.text || ""));
        if (b.s.alignment) n.style.justifyContent = String(b.s.alignment);
        if (b.s.text_color) n.style.color = String(b.s.text_color);
        if (b.s.font_size) n.style.fontSize = b.s.font_size + "px";
        if (b.s.font_weight) n.style.fontWeight = String(b.s.font_weight);
        return n;
      },
      variant_picker: function () {
        if (!hasRealVariants(product)) return null;
        var wrap = el("div", "bspx-variants");
        (product.options || []).forEach(function (optName, oi) {
          wrap.appendChild(el("span", "bspx-var-label", typeof optName === "string" ? optName : optName.name || ""));
          var row = el("div", "bspx-var-row");
          optionValues(product, oi).forEach(function (val) {
            var btn = el("button", "bspx-var" + (state.sel[oi] === val ? " on" : ""), val);
            btn.type = "button";
            btn.addEventListener("click", function () {
              state.sel[oi] = val;
              var match = variantByOptions(product, state.sel);
              if (match) state.variant = match;
              row.querySelectorAll(".bspx-var").forEach(function (x) { x.classList.remove("on"); });
              btn.classList.add("on");
              refreshPrices();
            });
            row.appendChild(btn);
          });
          wrap.appendChild(row);
        });
        return wrap;
      },
      quantity_selector: function () {
        var n = el("div", "bspx-qty");
        var minus = el("button", "", "−"); minus.type = "button";
        var num = el("span", "", "1");
        var plus = el("button", "", "+"); plus.type = "button";
        minus.addEventListener("click", function () { state.qty = Math.max(1, state.qty - 1); num.textContent = String(state.qty); });
        plus.addEventListener("click", function () { state.qty = Math.min(99, state.qty + 1); num.textContent = String(state.qty); });
        n.appendChild(minus); n.appendChild(num); n.appendChild(plus);
        return n;
      },
      custom_price: function (b) {
        var n = el("div", "bspx-price");
        var strong = el("strong");
        strong.style.fontSize = (b.s.price_size_desk || 30) + "px";
        if (b.s.price_color) strong.style.color = String(b.s.price_color);
        var s = el("s");
        var badge = el("span", "bspx-save");
        if (b.s.badge_bg) badge.style.background = String(b.s.badge_bg);
        if (b.s.badge_text) badge.style.color = String(b.s.badge_text);
        n.appendChild(strong);
        if (b.s.show_compare !== false) n.appendChild(s);
        if (b.s.show_badge !== false) n.appendChild(badge);
        if (b.s.alignment === "center") n.style.justifyContent = "center";
        state.priceEls.push(function () {
          strong.textContent = money(unit());
          s.textContent = money(compareUnit());
          var pct = Math.round((1 - unit() / compareUnit()) * 100);
          badge.textContent = "-" + pct + "%";
        });
        return n;
      },
      bundle_selector: function (b) {
        var wrap = el("div");
        wrap.appendChild(el("div", "bspx-bundle-head", b.t.heading || ""));
        var list = el("div", "bspx-bundles");
        var styleCls = b.s.card_style ? " style-" + b.s.card_style : "";
        var opts = [
          { qty: Number(b.s.opt1_qty) || 1, disc: 0, badge: b.s.opt1_badge || "" },
          { qty: Number(b.s.opt2_qty) || 2, disc: Number(b.s.opt2_discount) || 15, badge: b.s.opt2_badge || "Am beliebtesten" },
          { qty: Number(b.s.opt3_qty) || 3, disc: Number(b.s.opt3_discount) || 25, badge: b.s.opt3_badge || "" },
        ];
        var current = 1;
        var activeBorder = b.s.active_border ? String(b.s.active_border) : "";
        var savingsColor = b.s.savings_color ? String(b.s.savings_color) : "";
        function applyActiveBorder() {
          if (!activeBorder) return;
          list.querySelectorAll(".bspx-bundle").forEach(function (x) {
            x.style.borderColor = x.classList.contains("on") ? activeBorder : "";
          });
        }
        opts.forEach(function (o, i) {
          var card = el("button", "bspx-bundle" + styleCls + (i === current ? " on" : ""));
          card.type = "button";
          if (b.s.card_radius != null) card.style.borderRadius = b.s.card_radius + "px";
          if (o.badge) card.appendChild(el("span", "bspx-bundle-badge", o.badge));
          card.appendChild(el("span", "bspx-radio"));
          if (b.s.show_image !== false && product.featured_image) {
            var img = document.createElement("img");
            img.className = "bspx-bundle-img";
            img.src = typeof product.featured_image === "string" ? product.featured_image : product.featured_image.src || "";
            img.alt = "";
            card.appendChild(img);
          }
          var main = el("span", "bspx-bundle-main");
          var nameRow = el("span", "bspx-bundle-name");
          var chip = el("span", "bspx-chip", "×" + o.qty);
          nameRow.appendChild(chip);
          nameRow.appendChild(document.createTextNode(" " + o.qty + "x " + (product.title || "")));
          var per = el("span", "bspx-bundle-per");
          var save = el("span", "bspx-bundle-save");
          if (savingsColor) save.style.color = savingsColor;
          main.appendChild(nameRow); main.appendChild(per); main.appendChild(save);
          card.appendChild(main);
          var right = el("span", "bspx-bundle-right");
          var price = el("span", "bspx-bundle-price");
          var comp = el("s", "bspx-bundle-comp");
          right.appendChild(price); right.appendChild(comp);
          card.appendChild(right);
          list.appendChild(card);

          state.bundleEls.push(function () {
            var total = Math.round(unit() * o.qty * (1 - o.disc / 100));
            var compTotal = compareUnit() * o.qty;
            price.textContent = money(total);
            comp.textContent = money(compTotal);
            per.textContent = o.qty > 1 ? "nur " + money(Math.round(total / o.qty)) + " / Stk" : "";
            save.textContent = "Du sparst " + money(Math.max(0, compTotal - total));
          });
          card.addEventListener("click", function () {
            current = i;
            state.bundleQty = o.qty;
            state.bundleDisc = o.disc;
            list.querySelectorAll(".bspx-bundle").forEach(function (x) { x.classList.remove("on"); });
            card.classList.add("on");
            applyActiveBorder();
          });
          if (i === current) { state.bundleQty = o.qty; state.bundleDisc = o.disc; }
        });
        applyActiveBorder();
        wrap.appendChild(list);
        return wrap;
      },
      buy_buttons: function (b) {
        var wrap = el("div");
        var btn = el("button", "bspx-cta size-" + (b.s.cart_size || "lg"));
        btn.type = "button";
        if (b.s.btn_shape === "pill") btn.style.borderRadius = "999px";
        else if (b.s.btn_shape === "sharp") btn.style.borderRadius = "0";
        if (b.s.primary_bg) btn.style.background = b.s.primary_bg;
        if (b.s.primary_fg) btn.style.color = b.s.primary_fg;
        var icon = b.s.cart_icon;
        if (icon !== "none") {
          var ic = svg(icon === "plus" ? ["M12 5v14", "M5 12h14"] : TL_ICONS.bag, 17);
          btn.appendChild(ic);
        }
        btn.appendChild(el("span", "", b.t.add_to_cart_text || "In den Warenkorb"));
        btn.addEventListener("click", addToCart);
        state.ctaEl = btn;
        wrap.appendChild(btn);
        if (b.s.layout === "layout2") {
          var combo = el("div", "bspx-combo");
          var l = el("span", "brand-" + (b.s.combo_left_brand || "paypal"), brandLabel(b.s.combo_left_brand || "paypal"));
          var r = el("span", "brand-" + (b.s.combo_right_brand || "klarna"), brandLabel(b.s.combo_right_brand || "klarna"));
          l.style.cursor = r.style.cursor = "pointer";
          l.addEventListener("click", addToCart);
          r.addEventListener("click", addToCart);
          combo.appendChild(l); combo.appendChild(r);
          wrap.appendChild(combo);
        }
        if (b.t.subtext) {
          var sub = el("div", "bspx-cta-sub");
          sub.appendChild(svg(["M5 11h14v9H5z", "M8 11V8a4 4 0 0 1 8 0v3"], 12));
          sub.appendChild(el("span", "", b.t.subtext));
          wrap.appendChild(sub);
        }
        return wrap;
      },
      payment_icons: function (b) {
        var wrap = el("div");
        if (b.t.heading) wrap.appendChild(el("div", "bspx-pay-head", b.t.heading));
        var alignCls = b.s.alignment === "flex-start" ? " align-left" : b.s.alignment === "flex-end" ? " align-right" : "";
        var row = el("div", "bspx-pay" + alignCls);
        var iconW = Number(b.s.icon_width) || 0;
        ["visa", "mc", "klarna", "paypal", "apple", "google"].forEach(function (p) {
          var mark = payMark(p);
          if (iconW) {
            mark.style.width = iconW + "px";
            mark.style.height = Math.round(iconW * 0.66) + "px";
          }
          row.appendChild(mark);
        });
        wrap.appendChild(row);
        return wrap;
      },
      delivery_timeline: function (b) {
        var wrap = el("div");
        if (b.s.__preset === "umriss" || b.s.circle_style === "outlined") wrap.className = "bspx-tl-outlined";
        var count = el("div", "bspx-count");
        var end = new Date(); end.setHours(23, 59, 0, 0);
        var mins = Math.max(1, Math.round((end.getTime() - Date.now()) / 60000));
        var hrs = Math.floor(mins / 60);
        count.appendChild(document.createTextNode((b.t.text_prefix || "Wenn du innerhalb") + " "));
        var strong = el("strong", "", hrs + " Std. " + (mins % 60) + " Min.");
        count.appendChild(strong);
        count.appendChild(document.createTextNode(" " + (b.t.text_suffix || "bestellst!")));
        wrap.appendChild(count);
        var ship = Number(b.s.ship_days != null ? b.s.ship_days : 1);
        var del = Number(b.s.delivery_days != null ? b.s.delivery_days : 3);
        if (b.s.countdown_color) strong.style.color = String(b.s.countdown_color);
        var tlOutlined = b.s.__preset === "umriss" || b.s.circle_style === "outlined";
        var cSize = Number(b.s.circle_size) || 0;
        var tl = el("div", "bspx-timeline");
        [
          { ic: TL_ICONS.bag, label: b.t.label_1 || "Bestellt", date: dateIn(0) },
          { ic: TL_ICONS.truck, label: b.t.label_2 || "Versendet", date: dateIn(ship) },
          { ic: TL_ICONS.pkg, label: b.t.label_3 || "Zugestellt", date: dateIn(ship + del) },
        ].forEach(function (s) {
          var step = el("div", "bspx-step");
          var ic = el("span", "bspx-step-ic");
          if (cSize) { ic.style.width = cSize + "px"; ic.style.height = cSize + "px"; }
          if (tlOutlined) {
            if (b.s.circle_border) ic.style.borderColor = String(b.s.circle_border);
            if (b.s.icon_color) ic.style.color = String(b.s.icon_color);
          } else {
            if (b.s.circle_bg) ic.style.background = String(b.s.circle_bg);
            if (b.s.icon_color) ic.style.color = String(b.s.icon_color);
          }
          ic.appendChild(svg(s.ic, 17));
          step.appendChild(ic);
          step.appendChild(el("span", "bspx-step-label", s.label));
          step.appendChild(el("span", "bspx-step-date", s.date));
          tl.appendChild(step);
        });
        wrap.appendChild(tl);
        return wrap;
      },
      feature_box: function (b) {
        var n = el("div", "bspx-features");
        n.style.gridTemplateColumns = "repeat(" + (Number(b.s.columns) || 2) + ",1fr)";
        var styleCls = "style-" + (b.s.card_style || "flat");
        [1, 2, 3].forEach(function (i) {
          var title = b.t["title_" + i] || (b.s["title_" + i] != null ? String(b.s["title_" + i]) : "");
          var text = b.t["text_" + i] || (b.s["text_" + i] != null ? String(b.s["text_" + i]) : "");
          if (!title && !text) return;
          var card = el("div", "bspx-feature " + styleCls);
          if (b.s.card_radius != null) card.style.borderRadius = b.s.card_radius + "px";
          if (title) {
            var featTitle = el("strong", "", title);
            if (b.s.accent_color) featTitle.style.color = String(b.s.accent_color);
            card.appendChild(featTitle);
          }
          if (text) card.appendChild(el("p", "", text));
          n.appendChild(card);
        });
        return n.children.length ? n : null;
      },
      "icon-with-text": function (b) {
        var n = el("div", "bspx-iconrow" + (b.s.layout === "vertical" ? " vertical" : ""));
        // Icon-Pfade kommen aufgelöst aus dem Plan (b.icons) — Fallback nur
        // für alte gecachte Pläne ohne icons-Feld.
        var icons = (b.icons && b.icons.length >= 3) ? b.icons : [TL_ICONS.truck, ["M12 21a9 9 0 1 0-9-9", "M3 12l3-3", "M3 12l3 3"], ["M5 11h14v9H5z", "M8 11V8a4 4 0 0 1 8 0v3"]];
        [1, 2, 3].forEach(function (i) {
          var txt = b.t["heading_" + i] || "";
          if (!txt) return;
          var item = el("div", "bspx-iconitem");
          var ic = el("span", "bspx-bic");
          ic.appendChild(svg(icons[i - 1], 16));
          item.appendChild(ic);
          item.appendChild(el("span", "", txt));
          n.appendChild(item);
        });
        return n.children.length ? n : null;
      },
      description: function () {
        if (!product.description) return null;
        var n = el("div", "bspx-desc");
        n.innerHTML = product.description; // eigener Shop-Inhalt
        return n;
      },
      custom_divider: function () { return el("div", "bspx-divider"); },
      text: function (b) {
        var style = b.s.text_style ? " style-" + b.s.text_style : "";
        return el("p", "bspx-freetext" + style, (b.t.text || "").replace(/<[^>]+>/g, ""));
      },
      custom_accordion: function (b) { return accordion(b.t.heading || "", b.t.content || "", b.s.open_default === true); },
      collapsible_tab: function (b) { return accordion(b.t.heading || "", b.t.content || "", false); },
      share: function (b) {
        var btn = el("button", "bspx-share");
        btn.type = "button";
        btn.appendChild(svg(["M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7", "M16 6l-4-4-4 4", "M12 2v13"], 14));
        btn.appendChild(el("span", "", b.t.share_label || "Teilen"));
        btn.addEventListener("click", function () {
          if (navigator.share) navigator.share({ title: product.title, url: window.location.href }).catch(function () {});
          else if (navigator.clipboard) navigator.clipboard.writeText(window.location.href);
        });
        return btn;
      },

      // ── NEU: Runtime-Bausteine (Optik identisch zur Editor-Vorschau) ──
      trust_badges: function (b) {
        var ic = [
          ["M2 5h11v9H2z", "M13 8h4l3 3v3h-3", "M6.5 17.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z", "M17.5 17.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"],
          ["M12 21a9 9 0 1 0-9-9", "M3 12l3-3", "M3 12l3 3"],
          ["M5 11h14v9H5z", "M8 11V8a4 4 0 0 1 8 0v3", "M12 15v2"],
          ["M12 3l2.5 5.5 6 .5-4.5 4 1.4 5.9L12 16.9 6.1 18.9 7.5 13 3 9l6-.5z"],
        ];
        var wrap = el("div", "bspx-tb bspx-tb--" + (b.s.style || "cards"));
        var ac = b.s.accent || v.accent;
        [1, 2, 3, 4].forEach(function (n, i) {
          var label = b.t["label_" + n];
          if (!label) return;
          var item = el("div", "bspx-tb-item");
          var icw = el("span", "bspx-tb-ic");
          icw.style.color = ac;
          icw.appendChild(svg(ic[i], 15));
          item.appendChild(icw);
          item.appendChild(el("span", "bspx-tb-lbl", label));
          wrap.appendChild(item);
        });
        return wrap;
      },
      stock_bar: function (b) {
        var col = b.s.color || "#e0332f";
        var level = Math.max(6, Math.min(60, Number(b.s.level) || 20));
        var wrap = el("div", "bspx-sbar");
        var top = el("div", "bspx-sbar-top");
        top.appendChild(el("span", "", "🔥 " + (b.t.text || "")));
        var left = el("strong", "", b.t.left || "8");
        left.style.color = col;
        top.appendChild(left);
        wrap.appendChild(top);
        var track = el("div", "bspx-sbar-track");
        var fill = el("span", "bspx-sbar-fill");
        fill.style.width = level + "%";
        fill.style.background = col;
        track.appendChild(fill);
        wrap.appendChild(track);
        return wrap;
      },
      guarantee: function (b) {
        var ac = b.s.accent || v.accent;
        var style = b.s.style || "box";
        var wrap = el("div", "bspx-guar bspx-guar--" + style);
        if (style === "accent") {
          wrap.style.background = "color-mix(in srgb," + ac + " 10%,var(--bx-bg))";
          wrap.style.border = "1px solid color-mix(in srgb," + ac + " 30%,transparent)";
        }
        var icw = el("span", "bspx-guar-ic");
        icw.style.color = ac;
        icw.appendChild(svg(["M12 3l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V6z", "M9 12l2 2 4-4"], 26));
        wrap.appendChild(icw);
        var txt = el("span", "bspx-guar-txt");
        txt.appendChild(el("strong", "", b.t.title || ""));
        txt.appendChild(el("em", "", b.t.subtitle || ""));
        wrap.appendChild(txt);
        return wrap;
      },
      highlights: function (b) {
        var ac = b.s.accent || v.accent;
        var style = b.s.style || "accent";
        var wrap = el("div", "bspx-hl bspx-hl--" + style);
        [1, 2, 3, 4, 5].forEach(function (n) {
          var it = b.t["item_" + n];
          if (!it) return;
          var row = el("div", "bspx-hl-item");
          var chk = el("span", "bspx-hl-check");
          if (style === "circle") { chk.style.background = ac; chk.style.color = "#fff"; }
          else { chk.style.color = ac; }
          if (style === "arrow") { chk.textContent = "›"; }
          else { chk.appendChild(svg(["M20 6L9 17l-5-5"], 13)); }
          row.appendChild(chk);
          row.appendChild(document.createTextNode(it));
          wrap.appendChild(row);
        });
        return wrap;
      },
      social_proof: function (b) {
        var ac = b.s.accent || v.accent;
        var style = b.s.style || "viewers";
        var wrap = el("div", "bspx-sp");
        var icw = el("span", "bspx-sp-ic", style === "sold" ? "🛒" : style === "trending" ? "🔥" : "👀");
        icw.style.background = "color-mix(in srgb," + ac + " 14%,transparent)";
        wrap.appendChild(icw);
        var txt = el("span", "bspx-sp-txt");
        txt.appendChild(el("strong", "", b.t.count || "17"));
        txt.appendChild(document.createTextNode(" " + (style === "sold" ? "heute verkauft" : (b.t.text || "sehen sich das gerade an"))));
        wrap.appendChild(txt);
        wrap.appendChild(el("span", "bspx-sp-dot"));
        return wrap;
      },
      countdown_timer: function (b) {
        var col = b.s.color || "#e0332f";
        var hours = Math.max(1, Math.min(72, Number(b.s.hours) || 12));
        var wrap = el("div", "bspx-cdt");
        wrap.appendChild(el("span", "bspx-cdt-label", "⏰ " + (b.t.text || "Angebot endet in")));
        var boxes = el("div", "bspx-cdt-boxes");
        var names = ["Std", "Min", "Sek"];
        var cells = [];
        for (var i = 0; i < 3; i++) {
          var cell = el("span", "bspx-cdt-cell");
          cell.style.background = col;
          var b2 = el("b", "", "00");
          cell.appendChild(b2);
          cell.appendChild(el("em", "", names[i]));
          boxes.appendChild(cell);
          cells.push(b2);
        }
        wrap.appendChild(boxes);
        // Ziel-Zeit stabil pro Browser (sonst neu ab jetzt + Stunden).
        var key = "bspx_cd_" + hours;
        var end;
        try { end = parseInt(localStorage.getItem(key) || "", 10); } catch (e) {}
        var now = Date.now();
        if (!end || end < now) { end = now + hours * 3600000; try { localStorage.setItem(key, String(end)); } catch (e2) {} }
        function pad(n) { return n < 10 ? "0" + n : "" + n; }
        function tick() {
          var d = Math.max(0, Math.floor((end - Date.now()) / 1000));
          cells[0].textContent = pad(Math.floor(d / 3600));
          cells[1].textContent = pad(Math.floor((d % 3600) / 60));
          cells[2].textContent = pad(d % 60);
        }
        tick();
        var iv = setInterval(function () {
          if (!document.body.contains(wrap)) { clearInterval(iv); return; }
          tick();
        }, 1000);
        return wrap;
      },
      press_bar: function (b) {
        var wrap = el("div", "bspx-press bspx-press--" + (b.s.style || "plain"));
        wrap.appendChild(el("span", "bspx-press-h", b.t.heading || "Bekannt aus"));
        var row = el("div", "bspx-press-row");
        [1, 2, 3, 4].forEach(function (n) {
          var l = b.t["label_" + n];
          if (!l) return;
          row.appendChild(el("span", "bspx-press-item", l));
        });
        wrap.appendChild(row);
        return wrap;
      },
      spec_list: function (b) {
        var wrap = el("div", "bspx-spec bspx-spec--" + (b.s.style || "lines"));
        [1, 2, 3].forEach(function (n) {
          var l = b.t["label_" + n], val = b.t["value_" + n];
          if (!l && !val) return;
          var row = el("div", "bspx-spec-row");
          row.appendChild(el("span", "bspx-spec-l", l || ""));
          row.appendChild(el("span", "bspx-spec-v", val || ""));
          wrap.appendChild(row);
        });
        return wrap;
      },
      value_stack: function (b) {
        var ac = b.s.accent || v.accent;
        var wrap = el("div", "bspx-vstack bspx-vstack--" + (b.s.style || "list"));
        if (b.s.style === "accent") wrap.style.background = "color-mix(in srgb," + ac + " 8%,transparent)";
        if (b.t.heading) wrap.appendChild(el("strong", "bspx-vstack-h", b.t.heading));
        [1, 2, 3, 4].forEach(function (n) {
          var it = b.t["item_" + n];
          if (!it) return;
          var val = (b.t["value_" + n] || "").trim();
          var row = el("div", "bspx-vstack-row");
          var left = el("span", "bspx-vstack-item");
          var icw = el("span", "bspx-vstack-ic");
          icw.style.color = ac;
          icw.appendChild(svg(["M20 6L9 17l-5-5"], 13));
          left.appendChild(icw);
          left.appendChild(document.createTextNode(it));
          row.appendChild(left);
          if (/^(gratis|free)$/i.test(val)) {
            var badge = el("span", "bspx-vstack-free", val.toUpperCase());
            badge.style.background = ac;
            row.appendChild(badge);
          } else if (val) {
            row.appendChild(el("s", "bspx-vstack-val", val));
          }
          wrap.appendChild(row);
        });
        var foot = el("div", "bspx-vstack-foot");
        if (b.t.total_label) foot.appendChild(el("s", "bspx-vstack-total", b.t.total_label));
        if (b.t.today_label) {
          var td = el("strong", "bspx-vstack-today", b.t.today_label);
          td.style.color = ac;
          foot.appendChild(td);
        }
        if (b.t.save_text) foot.appendChild(el("span", "bspx-vstack-save", b.t.save_text));
        if (foot.childNodes.length) wrap.appendChild(foot);
        return wrap;
      },
      review_quote: function (b) {
        var ac = b.s.accent || v.accent;
        var wrap = el("div", "bspx-rq bspx-rq--" + (b.s.style || "bubble"));
        var stars = el("div", "bspx-rq-stars", "★★★★★");
        wrap.appendChild(stars);
        wrap.appendChild(el("p", "bspx-rq-text", b.t.text || ""));
        var meta = el("div", "bspx-rq-meta");
        if (b.s.photo) {
          var avImg = el("img", "bspx-rq-av");
          avImg.src = b.s.photo;
          avImg.alt = "";
          avImg.style.objectFit = "cover";
          meta.appendChild(avImg);
        } else if (b.t.initials) {
          var av = el("span", "bspx-rq-av", b.t.initials);
          av.style.background = ac;
          meta.appendChild(av);
        }
        var who = el("span", "bspx-rq-who");
        who.appendChild(el("strong", "", b.t.name || ""));
        if (b.t.verified) who.appendChild(el("em", "bspx-rq-ver", "✓ " + b.t.verified));
        meta.appendChild(who);
        wrap.appendChild(meta);
        return wrap;
      },
      benefit_cards: function (b) {
        var ac = b.s.accent || v.accent;
        var style = b.s.style || "pastel";
        var wrap = el("div", "bspx-bcards bspx-bcards--" + style);
        var bgs = style === "pastel"
          ? [b.s.c1_bg || "#f7f4ec", b.s.c2_bg || "#eaf4ec"]
          : style === "tint"
            ? ["color-mix(in srgb," + ac + " 8%,transparent)", "color-mix(in srgb," + ac + " 14%,transparent)"]
            : ["", ""];
        for (var i = 1; i <= 2; i++) {
          var card = el("div", "bspx-bcards-card");
          if (bgs[i - 1]) card.style.background = bgs[i - 1];
          card.appendChild(el("span", "bspx-bcards-emoji", b.t["e" + i] || ""));
          card.appendChild(el("strong", "bspx-bcards-title", b.t["t" + i] || ""));
          card.appendChild(el("span", "bspx-bcards-text", b.t["d" + i] || ""));
          wrap.appendChild(card);
        }
        return wrap;
      },
      usp_grid: function (b) {
        var style = b.s.style || "lines";
        var wrap = el("div", "bspx-uspg bspx-uspg--" + style);
        for (var i = 1; i <= 6; i++) {
          var t = b.t["t" + i] || "";
          var e = b.t["e" + i] || "";
          var sub = b.t["s" + i] || "";
          if (!t && !e) continue;
          var cell = el("div", "bspx-uspg-cell");
          cell.appendChild(el("span", "bspx-uspg-emoji", e));
          var txt = el("span", "bspx-uspg-txt");
          txt.appendChild(el("strong", "", t));
          if (style !== "compact" && sub) txt.appendChild(el("em", "", sub));
          cell.appendChild(txt);
          wrap.appendChild(cell);
        }
        return wrap;
      },
      avatar_proof: function (b) {
        var ac = b.s.accent || v.accent;
        var style = b.s.style || "pill";
        var wrap = el("div", "bspx-avp bspx-avp--" + style);
        if (style === "tint") wrap.style.background = "color-mix(in srgb," + ac + " 9%,transparent)";
        var avs = el("span", "bspx-avp-avs");
        var inits = (b.t.initials || "SM,TK,LB").split(",");
        var photos = [b.s.av1, b.s.av2, b.s.av3];
        var n = 0;
        // 3 feste Slots: hochgeladenes Foto (falls vorhanden) sonst Initiale.
        for (var j = 0; j < 3; j++) {
          var photo = photos[j];
          var x = (inits[j] || "").replace(/^\s+|\s+$/g, "");
          if (!photo && !x) continue;
          var av;
          if (photo) {
            av = el("img", "bspx-avp-av");
            av.src = photo;
            av.alt = "";
            av.style.objectFit = "cover";
          } else {
            av = el("span", "bspx-avp-av", x);
            av.style.background = "color-mix(in srgb," + ac + " " + (72 - n * 16) + "%,currentColor)";
          }
          avs.appendChild(av);
          n++;
        }
        wrap.appendChild(avs);
        var txt = el("span", "bspx-avp-txt");
        txt.appendChild(el("strong", "", b.t.name || ""));
        txt.appendChild(el("span", "bspx-avp-check", "✓"));
        txt.appendChild(document.createTextNode(" " + (b.t.join || "und") + " "));
        txt.appendChild(el("strong", "", b.t.count || ""));
        txt.appendChild(document.createTextNode(" " + (b.t.text || "")));
        wrap.appendChild(txt);
        return wrap;
      },
      ship_countdown: function (b) {
        var ac = b.s.accent || v.accent;
        var cutoff = Math.max(0, Math.min(23, Number(b.s.cutoff) || 16));
        var etaMin = Math.max(0, Number(b.s.eta_min) || 2);
        var etaMax = Math.max(etaMin, Number(b.s.eta_max) || 4);
        var wrap = el("div", "bspx-shipc bspx-shipc--" + (b.s.style || "inline"));
        if (b.s.style === "box") {
          wrap.style.background = "color-mix(in srgb," + ac + " 8%,transparent)";
          wrap.style.borderColor = "color-mix(in srgb," + ac + " 30%,transparent)";
        }
        var row1 = el("div", "bspx-shipc-line");
        var icw = el("span", "bspx-shipc-ic");
        icw.style.color = ac;
        icw.appendChild(svg(["M1 3h15v13H1z", "M16 8h4l3 3v5h-7", "M5.5 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z", "M18.5 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"], 15));
        row1.appendChild(icw);
        var txt = el("span", "bspx-shipc-txt");
        row1.appendChild(txt);
        wrap.appendChild(row1);
        var eta = el("div", "bspx-shipc-eta");
        wrap.appendChild(eta);
        function businessDate(days) {
          var d = new Date();
          var added = 0;
          while (added < days) {
            d.setDate(d.getDate() + 1);
            var wd = d.getDay();
            if (wd !== 0 && wd !== 6) added++;
          }
          return d;
        }
        function fmt(d) {
          try {
            return d.toLocaleDateString(document.documentElement.lang || "de-DE", { weekday: "short", day: "numeric", month: "long" });
          } catch (e) {
            return d.getDate() + "." + (d.getMonth() + 1) + ".";
          }
        }
        function pad(n) { return n < 10 ? "0" + n : "" + n; }
        function tick() {
          var now = new Date();
          var end = new Date(now);
          end.setHours(cutoff, 0, 0, 0);
          // Am Wochenende gibt es keinen Same-Day-Versand → immer der
          // „nächster Werktag"-Text (sonst würde samstags fälschlich
          // „Versand noch heute" versprochen).
          var wd = now.getDay();
          var late = wd === 0 || wd === 6 || now >= end;
          txt.textContent = "";
          if (late) {
            txt.appendChild(document.createTextNode(b.t.late || ""));
          } else {
            var d = Math.floor((end - now) / 1000);
            var hh = Math.floor(d / 3600), mm = Math.floor((d % 3600) / 60), ss = d % 60;
            var timeStr = (hh > 0 ? hh + " Std " : "") + pad(mm) + " Min " + pad(ss) + " Sek";
            txt.appendChild(document.createTextNode((b.t.before || "") + " "));
            var bn = el("b", "", timeStr);
            bn.style.color = ac;
            txt.appendChild(bn);
            txt.appendChild(document.createTextNode(" " + (b.t.after || "")));
          }
          var extra = late ? 1 : 0;
          eta.textContent = "";
          if (b.t.eta_label) {
            eta.appendChild(document.createTextNode(b.t.eta_label + " "));
            eta.appendChild(el("b", "", fmt(businessDate(etaMin + extra)) + " – " + fmt(businessDate(etaMax + extra))));
          }
        }
        tick();
        var iv = setInterval(function () {
          if (!document.body.contains(wrap)) { clearInterval(iv); return; }
          tick();
        }, 1000);
        return wrap;
      },
      return_promise: function (b) {
        var ac = b.s.accent || v.accent;
        var st = b.s.style || "line";
        var wrap = el("div", "bspx-retp bspx-retp--" + st);
        if (st === "box" || st === "check") wrap.style.borderColor = "color-mix(in srgb," + ac + " 30%,transparent)";
        if (st === "check") wrap.style.background = "color-mix(in srgb," + ac + " 8%,transparent)";
        var icw = el("span", "bspx-retp-ic");
        icw.style.color = ac;
        icw.appendChild(st === "check" ? svg(["M20 6L9 17l-5-5"], 16) : svg(["M9 14L4 9l5-5", "M4 9h10.5a5.5 5.5 0 0 1 0 11H11"], 16));
        wrap.appendChild(icw);
        var txt = el("span", "bspx-retp-txt");
        txt.appendChild(el("strong", "", b.t.title || ""));
        if (b.t.subtitle) txt.appendChild(el("em", "", b.t.subtitle));
        wrap.appendChild(txt);
        return wrap;
      },
      fit_check: function (b) {
        var ac = b.s.accent || v.accent;
        var st = b.s.style || "card";
        var wrap = el("div", "bspx-fit bspx-fit--" + st);
        if (b.t.heading) wrap.appendChild(el("strong", "bspx-fit-h", b.t.heading));
        var cols = el("div", "bspx-fit-cols");
        var yes = el("div", "bspx-fit-block bspx-fit-yes");
        if (b.t.yes_title) yes.appendChild(el("em", "bspx-fit-title", b.t.yes_title));
        [1, 2, 3].forEach(function (n) {
          var t = b.t["yes_" + n];
          if (!t) return;
          var row = el("div", "bspx-fit-row");
          var ic = el("span", "bspx-fit-ic");
          ic.style.color = "#1d9e55";
          ic.appendChild(svg(["M20 6L9 17l-5-5"], 12));
          row.appendChild(ic);
          row.appendChild(el("span", "", t));
          yes.appendChild(row);
        });
        cols.appendChild(yes);
        if (b.t.no_1) {
          var no = el("div", "bspx-fit-block bspx-fit-no");
          if (b.t.no_title) no.appendChild(el("em", "bspx-fit-title", b.t.no_title));
          var nrow = el("div", "bspx-fit-row");
          var nic = el("span", "bspx-fit-ic");
          nic.style.color = "#b0b0b0";
          nic.appendChild(svg(["M18 6L6 18", "M6 6l12 12"], 12));
          nrow.appendChild(nic);
          nrow.appendChild(el("span", "", b.t.no_1));
          no.appendChild(nrow);
          cols.appendChild(no);
        }
        wrap.appendChild(cols);
        if (b.t.closing) {
          var cl = el("div", "bspx-fit-close", b.t.closing);
          cl.style.color = ac;
          wrap.appendChild(cl);
        }
        return wrap;
      },
      mini_compare: function (b) {
        var ac = b.s.accent || v.accent;
        var st = b.s.style || "card";
        var wrap = el("div", "bspx-mcmp bspx-mcmp--" + st);
        if (b.t.title) wrap.appendChild(el("strong", "bspx-mcmp-h", b.t.title));
        var head = el("div", "bspx-mcmp-row bspx-mcmp-head");
        if (st === "card") head.style.background = "color-mix(in srgb," + ac + " 12%,transparent)";
        head.appendChild(el("span", "bspx-mcmp-crit", ""));
        var us = el("span", "bspx-mcmp-col", b.t.us_label || "Wir");
        var them = el("span", "bspx-mcmp-col", b.t.them_label || "Andere");
        if (st === "pills") {
          us.className += " bspx-mcmp-pill";
          us.style.background = ac;
          them.className += " bspx-mcmp-pill bspx-mcmp-pill--dim";
        } else {
          us.style.color = ac;
        }
        head.appendChild(us);
        head.appendChild(them);
        wrap.appendChild(head);
        [1, 2, 3, 4].forEach(function (n) {
          var t = b.t["row_" + n];
          if (!t) return;
          var row = el("div", "bspx-mcmp-row");
          row.appendChild(el("span", "bspx-mcmp-crit", t));
          var y = el("span", "bspx-mcmp-col");
          var yi = el("span", "bspx-mcmp-yes");
          yi.style.color = "#1d9e55";
          yi.appendChild(svg(["M20 6L9 17l-5-5"], 13));
          y.appendChild(yi);
          row.appendChild(y);
          var x = el("span", "bspx-mcmp-col");
          var xi = el("span", "bspx-mcmp-no");
          xi.appendChild(svg(["M18 6L6 18", "M6 6l12 12"], 13));
          x.appendChild(xi);
          row.appendChild(x);
          wrap.appendChild(row);
        });
        return wrap;
      },
      coupon_code: function (b) {
        var ac = b.s.accent || v.accent;
        var st = b.s.style || "coupon";
        var wrap = el("div", "bspx-coup bspx-coup--" + st);
        wrap.style.borderColor = "color-mix(in srgb," + ac + " 45%,transparent)";
        if (st === "strip") wrap.style.background = "color-mix(in srgb," + ac + " 7%,transparent)";
        if (b.t.title) wrap.appendChild(el("strong", "bspx-coup-h", b.t.title));
        var row = el("div", "bspx-coup-row");
        var code = el("span", "bspx-coup-code", b.t.code || "");
        code.style.color = ac;
        code.style.borderColor = "color-mix(in srgb," + ac + " 40%,transparent)";
        row.appendChild(code);
        var btn = el("button", "bspx-coup-btn", b.t.button || "Kopieren");
        btn.type = "button";
        btn.style.background = ac;
        btn.addEventListener("click", function () {
          var val = b.t.code || "";
          function done() {
            btn.textContent = "✓ " + (b.t.copied || "Kopiert!");
            btn.disabled = true;
            setTimeout(function () {
              btn.textContent = b.t.button || "Kopieren";
              btn.disabled = false;
            }, 2500);
          }
          // Erfolg NUR melden, wenn wirklich kopiert wurde — sonst den Code
          // markieren, damit der Käufer ihn selbst kopieren kann.
          function copyFallback() {
            try {
              var ta = document.createElement("textarea");
              ta.value = val;
              ta.setAttribute("readonly", "");
              ta.style.cssText = "position:fixed;left:-9999px;top:0";
              document.body.appendChild(ta);
              ta.select();
              ta.setSelectionRange(0, val.length);
              var ok = document.execCommand("copy");
              document.body.removeChild(ta);
              return ok;
            } catch (e) { return false; }
          }
          function selectCode() {
            try {
              var range = document.createRange();
              range.selectNodeContents(code);
              var sel = window.getSelection();
              sel.removeAllRanges();
              sel.addRange(range);
            } catch (e) { /* Code bleibt sichtbar */ }
          }
          function fail() {
            if (copyFallback()) done();
            else selectCode();
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(val).then(done, fail);
          } else {
            fail();
          }
        });
        row.appendChild(btn);
        wrap.appendChild(row);
        if (b.t.note) wrap.appendChild(el("em", "bspx-coup-note", b.t.note));
        return wrap;
      },
      price_per_day: function (b) {
        var ac = b.s.accent || v.accent;
        var st = b.s.style || "line";
        var days = Math.max(1, Math.round(Number(String(b.t.days || "").replace(/\D/g, "")) || 90));
        var wrap = el("div", "bspx-ppd bspx-ppd--" + st);
        if (st === "badge") {
          wrap.style.background = "color-mix(in srgb," + ac + " 12%,transparent)";
          wrap.style.color = ac;
        }
        function render() {
          var per = money(Math.max(1, Math.ceil(unit() / days)));
          wrap.textContent = "";
          if (st === "math") {
            wrap.appendChild(document.createTextNode(money(unit()) + " ÷ " + days + " Tage = "));
            var bm = el("b", "", per + "/Tag");
            bm.style.color = ac;
            wrap.appendChild(bm);
          } else {
            var tpl = b.t.text || "Nur {betrag} pro Tag";
            var parts = tpl.split("{betrag}");
            wrap.appendChild(document.createTextNode(parts[0] || ""));
            var bb = el("b", "", per);
            if (st !== "badge") bb.style.color = ac;
            wrap.appendChild(bb);
            wrap.appendChild(document.createTextNode(parts.slice(1).join("{betrag}") || ""));
          }
        }
        render();
        state.priceEls.push(render);
        return wrap;
      },
      free_gift: function (b) {
        // Angebots-/Geschenk-Box (Text). Das eigentliche Gratis-Produkt legt
        // der Kunde in Shopify fest; hier zeigen wir den Reiz-Hinweis.
        var ac = b.s.accent_color || v.accent;
        var wrap = el("div", "bspx-gift");
        wrap.style.borderColor = "color-mix(in srgb," + ac + " 35%,transparent)";
        var icw = el("span", "bspx-gift-ic");
        icw.style.background = ac;
        icw.appendChild(svg(["M4 12h16v8H4z", "M3 8h18v4H3z", "M12 8v12", "M12 8C10 8 8 6.5 9 5.2s3 2.8 3 2.8", "M12 8c2 0 4-1.5 3-2.8s-3 2.8-3 2.8"], 20));
        wrap.appendChild(icw);
        var txt = el("span", "bspx-gift-txt");
        txt.appendChild(el("strong", "", b.t.title || "Gratis-Geschenk sichern"));
        txt.appendChild(el("em", "", b.t.subtitle || ""));
        wrap.appendChild(txt);
        return wrap;
      },
      complementary: function (b) {
        // Passende Produkte LIVE aus Shopifys Empfehlungen — echte Produkte
        // aus dem Shop des Kunden, verlinkt. Async: Box zuerst, dann füllen.
        var wrap = el("div", "bspx-comp");
        wrap.appendChild(el("div", "bspx-comp-head", b.t.block_heading || "Passt perfekt dazu"));
        var row = el("div", "bspx-comp-row");
        wrap.appendChild(row);
        var pid = product.id;
        if (pid) {
          fetch("/recommendations/products.json?product_id=" + encodeURIComponent(pid) + "&limit=3&intent=related")
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) {
              var items = d && d.products ? d.products.slice(0, 3) : [];
              if (!items.length) { wrap.style.display = "none"; return; }
              items.forEach(function (p) {
                var a = document.createElement("a");
                a.className = "bspx-comp-card";
                a.href = p.url || "#";
                var im = document.createElement("span");
                im.className = "bspx-comp-img";
                var src = p.featured_image || (p.images && p.images[0]) || "";
                if (src) { var g = document.createElement("img"); g.src = src; g.alt = ""; im.appendChild(g); }
                a.appendChild(im);
                var main = el("span", "bspx-comp-main");
                main.appendChild(el("span", "bspx-comp-title", p.title || ""));
                main.appendChild(el("span", "bspx-comp-price", money(p.price != null ? p.price : 0)));
                a.appendChild(main);
                a.appendChild(el("span", "bspx-comp-add", "+"));
                row.appendChild(a);
              });
            })
            .catch(function () { wrap.style.display = "none"; });
        } else {
          wrap.style.display = "none";
        }
        return wrap;
      },
    };

    function brandLabel(brand) {
      return { paypal: "PayPal", klarna: "Klarna.", applepay: " Pay", googlepay: "G Pay", shoppay: "Shop Pay", amazonpay: "amazon pay", sofort: "Sofort." }[brand] || brand;
    }

    function accordion(heading, contentHtml, open) {
      var box = el("div", "bspx-acc");
      var head = el("button", "bspx-acc-head");
      head.type = "button";
      head.appendChild(el("span", "", heading));
      var plus = el("span", "bspx-acc-plus", open ? "−" : "+");
      head.appendChild(plus);
      var body = el("div", "bspx-acc-body");
      body.innerHTML = contentHtml; // Plan-Inhalt (eigene Texte, serverseitig als <p> verpackt)
      body.style.display = open ? "" : "none";
      head.addEventListener("click", function () {
        var hiddenNow = body.style.display === "none";
        body.style.display = hiddenNow ? "" : "none";
        plus.textContent = hiddenNow ? "−" : "+";
      });
      box.appendChild(head);
      box.appendChild(body);
      return box;
    }

    // Blöcke in Plan-Reihenfolge rendern. SICHERUNG: Hat das Produkt echte
    // Varianten, aber der Plan keinen variant_picker (im Editor ausgeblendet),
    // wird er direkt vor dem Kaufen-Button erzwungen — der Käufer muss immer
    // wählen können, sonst landet still die falsche Variante im Warenkorb.
    var blocks = plan.blocks.slice();
    var hasPicker = blocks.some(function (b) { return b.type === "variant_picker"; });
    if (hasRealVariants(product) && !hasPicker) {
      var ctaIdx = -1;
      blocks.forEach(function (b, i) { if (ctaIdx < 0 && (b.type === "buy_buttons" || b.type === "bundle_selector")) ctaIdx = i; });
      var forced = { type: "variant_picker", s: {}, t: {} };
      if (ctaIdx >= 0) blocks.splice(ctaIdx, 0, forced);
      else blocks.push(forced);
    }
    blocks.forEach(function (b) {
      var fn = R[b.type];
      if (!fn) return;
      var node = fn(b);
      if (node) root.appendChild(node);
    });

    refreshPrices();
    mount.innerHTML = "";
    mount.appendChild(root);
    if (skeleton) skeleton.style.display = "none";
    if (fallback) fallback.hidden = true;
  }

  function boot() {
    document.querySelectorAll(".bspx-host").forEach(initHost);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // WICHTIG für den Shopify-Theme-Editor (Customizer): Dort werden Sections
  // per AJAX neu gerendert — <script>-Tags im neuen HTML laufen dabei NICHT.
  // Diese (einmal geladene) Runtime bleibt aber am Leben und bootet die neu
  // eingesetzten Hosts über Shopifys Editor-Events erneut — sonst bliebe die
  // Buy Box nach jeder Änderung im Customizer als Skeleton hängen.
  ["shopify:section:load", "shopify:section:select", "shopify:block:select"].forEach(function (ev) {
    document.addEventListener(ev, function () { setTimeout(boot, 50); });
  });
  // Fallback außerhalb des Editors: falls der Host nachträglich in den DOM
  // kommt (Page-Builder, verzögertes Rendering), einmal kurz nachbooten.
  setTimeout(boot, 1500);
})();
