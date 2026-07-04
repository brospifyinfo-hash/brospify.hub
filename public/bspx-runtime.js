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
      ";--bx-h:" + plan.fonts.heading + ";--bx-b:" + plan.fonts.body;

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
        return n;
      },
      custom_title: function (b) {
        var n = el("h1", "bspx-title", product.title || "");
        n.style.fontSize = (b.s.font_size_desktop || 28) + "px";
        n.style.fontWeight = String(b.s.font_weight || 800);
        if (b.s.alignment) n.style.textAlign = b.s.alignment;
        return n;
      },
      custom_rating: function (b) {
        var pill = b.s.__preset === "pill" || b.s.layout_style === "compact_pill";
        var n = el("div", "bspx-rating" + (pill ? " pill" : ""));
        n.appendChild(el("span", "bspx-stars", "★★★★★"));
        n.appendChild(el("strong", "", b.s.average_value || "4.9"));
        n.appendChild(el("span", "", "· " + (b.t.rating_text || "")));
        return n;
      },
      benefits_list: function () {
        var n = el("div", "bspx-benefits");
        (plan.benefits || []).forEach(function (bf) {
          var row = el("div", "bspx-benefit");
          var ic = el("span", "bspx-bic");
          ic.appendChild(svg(bf.paths, 15));
          row.appendChild(ic);
          row.appendChild(el("span", "", bf.text));
          n.appendChild(row);
        });
        return n;
      },
      stock_indicator: function (b) {
        var n = el("div", "bspx-stock");
        n.appendChild(el("span", "bspx-dot"));
        n.appendChild(el("span", "", b.t.text || ""));
        if (b.s.alignment === "center") n.style.justifyContent = "center";
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
        var s = el("s");
        var badge = el("span", "bspx-save");
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
          });
          if (i === current) { state.bundleQty = o.qty; state.bundleDisc = o.disc; }
        });
        wrap.appendChild(list);
        return wrap;
      },
      buy_buttons: function (b) {
        var wrap = el("div");
        var btn = el("button", "bspx-cta size-" + (b.s.cart_size || "lg"));
        btn.type = "button";
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
        return wrap;
      },
      payment_icons: function (b) {
        var wrap = el("div");
        if (b.t.heading) wrap.appendChild(el("div", "bspx-pay-head", b.t.heading));
        var alignCls = b.s.alignment === "flex-start" ? " align-left" : b.s.alignment === "flex-end" ? " align-right" : "";
        var row = el("div", "bspx-pay" + alignCls);
        ["visa", "mc", "klarna", "paypal", "apple", "google"].forEach(function (p) { row.appendChild(payMark(p)); });
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
        var tl = el("div", "bspx-timeline");
        [
          { ic: TL_ICONS.bag, label: b.t.label_1 || "Bestellt", date: dateIn(0) },
          { ic: TL_ICONS.truck, label: b.t.label_2 || "Versendet", date: dateIn(ship) },
          { ic: TL_ICONS.pkg, label: b.t.label_3 || "Zugestellt", date: dateIn(ship + del) },
        ].forEach(function (s) {
          var step = el("div", "bspx-step");
          var ic = el("span", "bspx-step-ic");
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
          if (title) card.appendChild(el("strong", "", title));
          if (text) card.appendChild(el("p", "", text));
          n.appendChild(card);
        });
        return n.children.length ? n : null;
      },
      "icon-with-text": function (b) {
        var n = el("div", "bspx-iconrow" + (b.s.layout === "vertical" ? " vertical" : ""));
        var icons = [TL_ICONS.truck, ["M12 21a9 9 0 1 0-9-9", "M3 12l3-3", "M3 12l3 3"], ["M5 11h14v9H5z", "M8 11V8a4 4 0 0 1 8 0v3"]];
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
