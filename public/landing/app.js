/* ==========================================================================
   BROSPIFY WAITLIST — Interaktion & Animation
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------
     KONFIG: Warteliste-Endpoint
     Leer = Demo-Modus (E-Mail wird nur lokal gespeichert).
     Zum Anschließen: URL eintragen, die POST {email, source} als JSON nimmt
     (z. B. Formspree, Zapier-Hook oder eine eigene /api/waitlist-Route).
  ------------------------------------------------------------------ */
  var WAITLIST_ENDPOINT = "";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(pointer: fine)").matches;

  /* =========================================================
     1) Reveal beim Scrollen
  ========================================================= */
  var revealEls = document.querySelectorAll("[data-reveal]");
  revealEls.forEach(function (el) {
    var d = el.getAttribute("data-delay");
    if (d) el.style.setProperty("--rd", d + "ms");
  });
  if ("IntersectionObserver" in window && !reduceMotion) {
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          revealIO.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    revealEls.forEach(function (el) { revealIO.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* =========================================================
     2) Parallax-Engine: gelerpt + Rotation, schreibt die
        translate/rotate-PROPERTIES (komponiert sauber mit
        CSS-Transform-Animationen wie blobFloat/Reveals).
        data-px = Y-Faktor · data-pxr = Rotations-Faktor
  ========================================================= */
  var pxEls = Array.prototype.slice.call(document.querySelectorAll("[data-px]")).map(function (el) {
    return {
      el: el,
      f: parseFloat(el.getAttribute("data-px")) || 0,
      fr: parseFloat(el.getAttribute("data-pxr")) || 0,
      y: 0, r: 0, base: 0, h: 1
    };
  });
  if (pxEls.length && !reduceMotion && finePointer) {
    var pxVh = window.innerHeight;
    var pxRaf = null;
    /* Basis EINMAL ohne eigenen Versatz messen — kein Transform-Feedback */
    var pxMeasure = function () {
      pxVh = window.innerHeight;
      pxEls.forEach(function (p) {
        var rect = p.el.getBoundingClientRect();
        p.base = rect.top + window.scrollY - p.y;
        p.h = rect.height;
      });
      pxKick();
    };
    var pxLoop = function () {
      var sy = window.scrollY;
      var moving = false;
      pxEls.forEach(function (p) {
        var mid = p.base + p.h / 2 - sy - pxVh / 2;
        if (mid < -pxVh * 1.7 || mid > pxVh * 1.7) return;
        var ty = -mid * p.f;
        var tr = mid * p.fr * 0.03;
        var ny = p.y + (ty - p.y) * 0.09;
        var nr = p.r + (tr - p.r) * 0.09;
        if (Math.abs(ny - p.y) > 0.05 || Math.abs(nr - p.r) > 0.02) moving = true;
        p.y = ny; p.r = nr;
        p.el.style.translate = "0 " + p.y.toFixed(1) + "px";
        if (p.fr) p.el.style.rotate = p.r.toFixed(2) + "deg";
      });
      /* nur weiterlaufen, solange sich real etwas bewegt — parkt im Leerlauf */
      pxRaf = moving ? requestAnimationFrame(pxLoop) : null;
    };
    var pxKick = function () { if (!pxRaf) pxRaf = requestAnimationFrame(pxLoop); };
    pxMeasure();
    window.addEventListener("resize", pxMeasure);
    window.addEventListener("load", pxMeasure);
    window.addEventListener("scroll", pxKick, { passive: true });
  }

  /* =========================================================
     3) Nav-Zustand + Scroll-Progress
  ========================================================= */
  var navWrap = document.getElementById("navWrap");
  var scrollBar = document.getElementById("scrollBar");
  var navDocH = 0, navRaf = null;
  var navMeasure = function () { navDocH = document.documentElement.scrollHeight - window.innerHeight; };
  var navPaint = function () {
    navRaf = null;
    var y = window.scrollY || document.documentElement.scrollTop;
    if (navWrap) navWrap.classList.toggle("scrolled", y > 40);
    if (scrollBar) scrollBar.style.transform = "scaleX(" + (navDocH > 0 ? Math.min(y / navDocH, 1) : 0) + ")";
  };
  var onScrollNav = function () { if (!navRaf) navRaf = requestAnimationFrame(navPaint); };
  navMeasure();
  window.addEventListener("resize", navMeasure);
  window.addEventListener("load", navMeasure);
  window.addEventListener("scroll", onScrollNav, { passive: true });
  navPaint();

  /* =========================================================
     4) Count-up (deutsches Tausender-Format)
  ========================================================= */
  var fmt = function (n) { return n.toLocaleString("de-DE"); };
  var counters = document.querySelectorAll("[data-count]");
  var runCount = function (el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    var prefix = el.getAttribute("data-prefix") || "";
    var suffix = el.getAttribute("data-suffix") || "";
    if (reduceMotion) { el.textContent = prefix + fmt(target) + suffix; return; }
    var dur = 1400;
    var t0 = null;
    var step = function (t) {
      if (!t0) t0 = t;
      var p = Math.min((t - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 4);
      el.textContent = prefix + fmt(Math.round(target * eased)) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if ("IntersectionObserver" in window) {
    var countIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { runCount(e.target); countIO.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { countIO.observe(el); });
  } else {
    counters.forEach(runCount);
  }

  /* =========================================================
     5) Stil-Marquee — 24 echte Stile aus dem Editor
  ========================================================= */
  var STYLES = [
    ["Modern", "Clean, kantig, viel Weißraum", "#f1f5f9", "#0f172a"],
    ["Elegant", "Serifen, warm, luxuriös", "#f7f3ec", "#9a7b4f"],
    ["Bold", "Große Typo, starker Kontrast", "#1a1a1a", "#facc15"],
    ["Verspielt", "Rund, bunt, freundlich", "#fff1f2", "#fb7185"],
    ["Minimal", "Reduziert, viel Luft", "#fafafa", "#18181b"],
    ["Noir", "Dunkel & edel", "#16131c", "#d4af37"],
    ["Sunset", "Warm & einladend", "#fff7ed", "#f97316"],
    ["Ocean", "Frisch & klar", "#eff6ff", "#0284c7"],
    ["Nature", "Natürlich & ruhig", "#f0fdf4", "#16a34a"],
    ["Candy", "Süß & verspielt", "#fdf2f8", "#ec4899"],
    ["Tech", "Modern & digital", "#eef2ff", "#6366f1"],
    ["Royal", "Luxuriös & tief", "#f5f3ff", "#7c3aed"],
    ["Luxe", "High-Fashion, editorial", "#f5f1ea", "#1c1917"],
    ["Street", "Streetwear, laut, Hype", "#18181b", "#ef4444"],
    ["Care", "Sauber & seriös", "#f0f9ff", "#0ea5e9"],
    ["Cozy", "Warm, wohnlich, Interior", "#faf4ec", "#c2703d"],
    ["Sport", "Performance & Energie", "#f8fafc", "#dc2626"],
    ["Fresh", "Frisch & leicht, Food", "#f7fee7", "#65a30d"],
    ["Family", "Sanft & pastellig", "#fff1f5", "#f472b6"],
    ["Carbon", "Dunkel, technisch", "#1c1f24", "#38bdf8"],
    ["Retro", "Vintage-Charme", "#fdf6e3", "#d97706"],
    ["Spa", "Beauty & Selfcare", "#faf5ff", "#c084fc"],
    ["Outdoor", "Rau, erdig, Abenteuer", "#efebe4", "#8a5a33"],
    ["Deal", "Maximale Conversion", "#fef2f2", "#dc2626"]
  ];
  var buildMarquee = function (trackId, styles) {
    var track = document.getElementById(trackId);
    if (!track) return;
    var html = styles.map(function (s) {
      return '<div class="style-card" style="--c1:' + s[2] + ';--c2:' + s[3] + '">' +
        '<span class="sc-swatch"></span>' +
        '<span class="sc-info"><span class="sc-name">' + s[0] + '</span><span class="sc-hint">' + s[1] + "</span></span>" +
        "</div>";
    }).join("");
    track.innerHTML = html + html; /* verdoppelt für nahtlosen Loop */
    var wrap = track.parentElement;
    var speed = parseFloat(wrap.getAttribute("data-speed")) || 40;
    track.style.setProperty("--dur", speed + "s");
  };
  buildMarquee("marqueeA", STYLES.slice(0, 12));
  buildMarquee("marqueeB", STYLES.slice(12));

  /* =========================================================
     6) GENESIS-THEATER — der Shop baut sich selbst
  ========================================================= */
  var genesis = document.getElementById("genesis");
  if (genesis) {
    var gCanvas = document.getElementById("gCanvas");
    var gTyping = document.getElementById("gTyping");
    var gAnnounce = document.getElementById("gAnnounce");
    var edPh = document.getElementById("edPh");
    var edSpin = document.getElementById("edSpin");
    var edBro = document.getElementById("edBro");
    var edBubble = document.getElementById("edBubble");
    var edCmd = document.getElementById("edRing");
    var say = function (text) {
      if (!edBubble) return;
      if (text) { edBubble.textContent = text; edBubble.classList.add("show"); }
      else edBubble.classList.remove("show");
    };
    var edPlan = document.getElementById("edPlan");
    var edPlanTitle = document.getElementById("edPlanTitle");
    var edPlanBar = document.getElementById("edPlanBar");
    var edPlanDone = document.getElementById("edPlanDone");
    var edPlanStyle = document.getElementById("edPlanStyle");
    var edCredits = document.getElementById("edCredits");
    var edSyncIc = document.getElementById("edSyncIc");
    var gSections = Array.prototype.slice.call(gCanvas.querySelectorAll(".gs"));
    var planSteps = Array.prototype.slice.call(document.querySelectorAll("#edPlanSteps > span"));
    var ins = {
      name: document.getElementById("edStyleName"),
      hint: document.getElementById("edStyleHint"),
      dotA: document.getElementById("edDotA"),
      dotB: document.getElementById("edDotB"),
      cw1: document.getElementById("edCw1"), ch1: document.getElementById("edCh1"),
      cw2: document.getElementById("edCw2"), ch2: document.getElementById("edCh2"),
      cw3: document.getElementById("edCw3"), ch3: document.getElementById("edCh3"),
      cw4: document.getElementById("edCw4"), ch4: document.getElementById("edCh4"),
      radFill: document.getElementById("edRadFill"),
      radVal: document.getElementById("edRadVal"),
      fontH: document.getElementById("edFontH")
    };

    /* Aufbau-Leiste: Section-Zeilen wie im echten Editor */
    var GRIP = '<circle cx="9" cy="6" r="0.9"/><circle cx="15" cy="6" r="0.9"/><circle cx="9" cy="12" r="0.9"/><circle cx="15" cy="12" r="0.9"/><circle cx="9" cy="18" r="0.9"/><circle cx="15" cy="18" r="0.9"/>';
    var TARGET = '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>';
    var CAT = {
      conv: '<path d="M2 3h2.5l2.6 12.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L21 7H6"/><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/>',
      social: '<path d="m12 3 2.8 5.6 6.2.9-4.5 4.4 1 6.1L12 17l-5.5 3 1-6.1L3 9.5l6.2-.9Z"/>',
      content: '<path d="M4 6h16M4 12h10M4 18h14"/>',
      media: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-4.5-4.5L7 21"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8.5v.5"/>'
    };
    var RAIL = [
      ["conv", "Ankündigung", "laufband"],
      ["conv", "Produkt & Kaufbox", ""],
      ["content", "Icon-Benefits", "band"],
      ["social", "Kunden-Chats", "whatsapp"],
      ["social", "Spotlight", "karte"],
      ["info", "FAQ", "offen"],
      ["info", "Footer", ""]
    ];
    var edRail = document.getElementById("edRail");
    var railRows = [];
    if (edRail) {
      RAIL.forEach(function (r) {
        var row = document.createElement("div");
        row.className = "ed-row";
        row.innerHTML =
          '<svg class="ic-grip" viewBox="0 0 24 24">' + GRIP + "</svg>" +
          '<svg class="ic-cat" viewBox="0 0 24 24">' + CAT[r[0]] + "</svg>" +
          '<span class="ed-row-name">' + r[1] + "</span>" +
          (r[2] ? "<small>" + r[2] + "</small>" : "") +
          '<svg class="ic-target" viewBox="0 0 24 24">' + TARGET + "</svg>";
        edRail.appendChild(row);
        row.classList.add("on");
        railRows.push(row);
      });
    }

    /* Szenen: gleiches Produkt, die AI stylt um — wie im echten Editor */
    var SCENES = [
      { name: "Candy", hint: "Süß & verspielt", layout: "l-candy", prompt: "Mach ihn bunter — meine Zielgruppe ist jung", announce: "Gratis Sticker zu jeder Bestellung 🍓", eyebrow: "🍓 Der Sommer-Hit", h1: "Mix dir den Tag<br>bunt!", cta: "Jetzt in Pink sichern", img: "/landing/product-smoothie-pink.jpg", font: "Quicksand", radius: 22, serif: false, ga: "#ec4899", gbg: "#fdf2f8", gcard: "#ffffff", gtxt: "#500724" },
      { name: "Tech", hint: "Modern & digital", layout: "l-tech", prompt: "Cleaner und moderner — mehr Tech-Feeling", announce: "Blitzversand in 24 h · 2 Jahre Garantie", eyebrow: "22.000 U/min · USB-C", h1: "Der smarte Mixer<br>für unterwegs.", cta: "Zum Produkt", img: "/landing/product-mixer-green.jpg", font: "Inter", radius: 10, serif: false, ga: "#6366f1", gbg: "#eef2ff", gcard: "#ffffff", gtxt: "#111827" },
      { name: "Noir", hint: "Dunkel & edel", layout: "l-noir", prompt: "Edler und dunkler — Premium-Positionierung", announce: "Limitierte Auflage · Express-Lieferung gratis", eyebrow: "Limitierte Edition", h1: "Präzision.<br>In jedem Mix.", cta: "Jetzt entdecken", img: "/landing/product-mixer-main.jpg", font: "Playfair Display", radius: 8, serif: true, ga: "#d4af37", gbg: "#16131c", gcard: "#221c2e", gtxt: "#f2edda" },
      { name: "Sunset", hint: "Warm & einladend", layout: "l-sunset", prompt: "Wärmer und einladender — Sommer-Vibes", announce: "Sommer-Sale: -30 % auf alles ☀️", eyebrow: "☀️ Sommer-Sale", h1: "Sommer<br>im Glas.", cta: "Jetzt 30 % sichern", img: "/landing/product-lifestyle-pour.jpg", font: "Montserrat", radius: 18, serif: false, ga: "#f97316", gbg: "#fff7ed", gcard: "#ffffff", gtxt: "#431407" },
      { name: "Ocean", hint: "Frisch & klar", layout: "l-ocean", prompt: "Frisch und klar — betone den Trust", announce: "Über 25.000 zufriedene Kunden 🌊", eyebrow: "★★★★★ 25.000+ Kunden", h1: "Frisch. Klar.<br>Jeden Tag.", cta: "Jetzt bestellen", img: "/landing/product-mixer-main.jpg", font: "Work Sans", radius: 14, serif: false, ga: "#0284c7", gbg: "#eff6ff", gcard: "#ffffff", gtxt: "#082f49" },
      { name: "Fresh", hint: "Frisch & leicht, Food", layout: "l-fresh", prompt: "Zurück zu frisch und leicht — Food-Vibes", announce: "Gratis-Versand ab 30 € · 30 Tage Rückgabe", eyebrow: "★★★★★ Über 25.000 Kunden", h1: "Frische Smoothies.<br>Überall.", cta: "Jetzt entdecken", img: "/landing/product-smoothie-berries.jpg", font: "Poppins", radius: 16, serif: false, ga: "#65a30d", gbg: "#f7fee7", gcard: "#ffffff", gtxt: "#1a2e05" }
    ];
    var gHeroImg = document.getElementById("gHeroImg");
    var gEyebrow = gCanvas.querySelector(".gs-eyebrow");
    var gH1 = gCanvas.querySelector(".gs-h1");
    var gCta = gCanvas.querySelector(".gs-btnrow .gs-btn");
    var curLayout = "";

    var tIdx = 0;
    var creditsVal = 1480;
    var timeouts = [];
    var playing = false;
    var visible = false;

    var later = function (fn, ms) { timeouts.push(setTimeout(fn, ms)); };
    var clearAll = function () { timeouts.forEach(clearTimeout); timeouts = []; };

    var planState = function (activeIdx) {
      planSteps.forEach(function (s, i) {
        s.classList.toggle("done", i < activeIdx);
        s.classList.toggle("act", i === activeIdx);
      });
    };
    var planAllDone = function () {
      planSteps.forEach(function (s) { s.classList.remove("act"); s.classList.add("done"); });
    };
    var setBar = function (pct) { if (edPlanBar) edPlanBar.style.width = pct + "%"; };

    var applyScene = function (sc) {
      gCanvas.style.setProperty("--ga", sc.ga);
      gCanvas.style.setProperty("--gbg", sc.gbg);
      gCanvas.style.setProperty("--gcard", sc.gcard);
      gCanvas.style.setProperty("--gtxt", sc.gtxt);
      gCanvas.style.setProperty("--grad-r", sc.radius + "px");
      gCanvas.style.setProperty("--gfont", sc.serif ? "var(--serif)" : "var(--font)");
      /* Layout-Variante: die AI baut die Seite sichtbar um */
      if (curLayout) gCanvas.classList.remove(curLayout);
      curLayout = sc.layout || "";
      if (curLayout) gCanvas.classList.add(curLayout);
      /* Neue Texte — die AI schreibt die Copy um */
      if (gEyebrow) gEyebrow.textContent = sc.eyebrow;
      if (gH1) gH1.innerHTML = sc.h1;
      if (gCta) gCta.textContent = sc.cta;
      /* Neues Hero-Foto mit weichem Wechsel (eigener Timer: läuft IMMER zu Ende,
         damit das Bild nie unsichtbar hängen bleibt) */
      if (gHeroImg && sc.img && gHeroImg.getAttribute("src") !== sc.img) {
        gHeroImg.style.opacity = 0;
        setTimeout(function () {
          gHeroImg.setAttribute("src", sc.img);
          gHeroImg.style.opacity = 1;
        }, 300);
      }
      gAnnounce.textContent = sc.announce;
      if (edPlanStyle) edPlanStyle.textContent = sc.name;
      if (ins.name) {
        ins.name.textContent = sc.name;
        ins.hint.textContent = sc.hint;
        ins.dotA.style.background = sc.gbg;
        ins.dotB.style.background = sc.ga;
        ins.cw1.style.background = sc.ga; ins.ch1.textContent = sc.ga;
        ins.cw2.style.background = sc.gbg; ins.ch2.textContent = sc.gbg;
        ins.cw3.style.background = sc.gtxt; ins.ch3.textContent = sc.gtxt;
        ins.cw4.style.background = sc.ga; ins.ch4.textContent = sc.ga;
        ins.radFill.style.width = Math.round((sc.radius / 40) * 100) + "%";
        ins.radVal.innerHTML = sc.radius + "&nbsp;px";
        ins.fontH.textContent = sc.font;
      }
    };

    var resetScene = function () {
      /* Der Shop bleibt IMMER sichtbar — nur Effekte zurücksetzen */
      gSections.forEach(function (s) { s.classList.remove("flash"); });
      railRows.forEach(function (r) { r.classList.remove("flash"); });
      planSteps.forEach(function (s) { s.classList.remove("act", "done"); });
      edPlan.classList.remove("show");
      edPlanDone.classList.remove("show");
      edPlanTitle.textContent = "Die AI setzt deinen Plan um …";
      setBar(0);
      gCanvas.classList.remove("building");
      gTyping.textContent = "";
      edPh.textContent = "AI fragen — sie baut es sofort um …";
      edPh.classList.remove("hide");
      edSpin.hidden = true;
      edBro.textContent = "🙂";
      edBro.classList.remove("work");
      if (edCmd) edCmd.classList.remove("glow");
      say(null);
    };

    var typePrompt = function (text, doneCb) {
      var i = 0;
      var tick = function () {
        gTyping.textContent = text.slice(0, i);
        edPh.classList.toggle("hide", i > 0);
        i++;
        if (i <= text.length) later(tick, 24 + Math.random() * 32);
        else doneCb();
      };
      tick();
    };

    var playScene = function () {
      if (!visible) { playing = false; return; }
      playing = true;
      var sc = SCENES[tIdx % SCENES.length];
      resetScene();

      later(function () {
        typePrompt(sc.prompt, function () {
          /* "Absenden": Eingabe leert sich, AI analysiert */
          later(function () {
            gTyping.textContent = "";
            edPh.textContent = "Die AI analysiert dein Theme …";
            edPh.classList.remove("hide");
            edSpin.hidden = false;
            edBro.textContent = "🤔";
            edBro.classList.add("work");
            if (edCmd) edCmd.classList.add("glow");
            say("Moment, ich schau mir dein Theme an …");
            later(function () {
              edSpin.hidden = true;
              edPh.textContent = "Die AI setzt deinen Plan um …";
              edBro.textContent = "🛠️";
              say("Ich baue dir den " + sc.name + "-Look 🎨");
              edPlan.classList.add("show");
              planState(0);
              setBar(8);
              later(function () {
                applyScene(sc);
                creditsVal = creditsVal <= 1060 ? 1480 : creditsVal - 15;
                if (edCredits) edCredits.textContent = creditsVal.toLocaleString("de-DE");
                planState(1);
                setBar(22);
                gCanvas.classList.add("building");
                gSections.forEach(function (s, i) {
                  later(function () {
                    s.classList.add("flash");
                    if (railRows[i]) railRows[i].classList.add("flash");
                    if (i === 3) { planState(2); setBar(46); }
                    if (i === 4) { planState(3); setBar(66); }
                    if (i === 5) { planState(4); setBar(84); }
                    if (i === gSections.length - 1) {
                      gCanvas.classList.remove("building");
                      planAllDone();
                      setBar(100);
                      edPlanTitle.textContent = "Umgesetzt!";
                      edPlanDone.classList.add("show");
                      edPh.textContent = "AI fragen — sie baut es sofort um …";
                      edBro.textContent = "🙂";
                      edBro.classList.remove("work");
                      if (edCmd) edCmd.classList.remove("glow");
                      say("Fertig! Schau ihn dir an ✨");
                      later(function () { say(null); }, 2600);
                      if (edSyncIc) {
                        edSyncIc.classList.add("spin");
                        later(function () { edSyncIc.classList.remove("spin"); }, 1400);
                      }
                    }
                  }, 340 * i + 240);
                });
                later(function () {
                  tIdx++;
                  playScene();
                }, 340 * gSections.length + 4400);
              }, 550);
            }, 950);
          }, 420);
        });
      }, 350);
    };

    if (reduceMotion) {
      /* Ohne Animation: fertigen Editor-Zustand zeigen */
      applyScene(SCENES[0]);
      gSections.forEach(function (s) { s.classList.add("on"); });
      railRows.forEach(function (r) { r.classList.add("on"); });
      edPlan.classList.add("show");
      planAllDone();
      setBar(100);
      edPlanTitle.textContent = "Umgesetzt!";
      edPlanDone.classList.add("show");
      gTyping.textContent = SCENES[0].prompt;
      edPh.classList.add("hide");
      say("Sag mir, wie dein Shop aussehen soll ✨");
    } else if ("IntersectionObserver" in window) {
      var genIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          visible = e.isIntersecting;
          if (visible && !playing) playScene();
          if (!visible) { clearAll(); playing = false; }
        });
      }, { threshold: 0.25 });
      genIO.observe(genesis);
    } else {
      visible = true;
      playScene();
    }
    /* Debug/Tuning: Szene direkt anwenden, z. B. __edApply(2) für Noir */
    window.__edApply = function (i) { applyScene(SCENES[i % SCENES.length]); };
  }

  /* =========================================================
     7) Co-Pilot-Demo (Loop, wenn sichtbar)
  ========================================================= */
  var cpDemo = document.querySelector(".copilot-demo");
  if (cpDemo && !reduceMotion && "IntersectionObserver" in window) {
    var cpTimer = null;
    var cpIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          cpDemo.classList.add("play");
          if (!cpTimer) {
            cpTimer = setInterval(function () {
              cpDemo.classList.remove("play");
              void cpDemo.offsetWidth; /* Reflow für Neustart */
              cpDemo.classList.add("play");
            }, 7000);
          }
        } else if (cpTimer) {
          clearInterval(cpTimer);
          cpTimer = null;
        }
      });
    }, { threshold: 0.4 });
    cpIO.observe(cpDemo);
  } else if (cpDemo) {
    cpDemo.classList.add("play");
  }

  /* =========================================================
     8) Inline-Edit-Demo (Text tippt sich um)
  ========================================================= */
  var editText = document.getElementById("editDemoText");
  if (editText && !reduceMotion) {
    var WORDS = ["Dein Bestseller", "Nur heute -20 %", "Neu eingetroffen", "Dein Bestseller"];
    var wIdx = 0;
    var typeWord = function () {
      var next = WORDS[wIdx % WORDS.length];
      var cur = editText.textContent;
      var del = function () {
        if (cur.length > 0) {
          cur = cur.slice(0, -1);
          editText.textContent = cur;
          setTimeout(del, 34);
        } else {
          var i = 0;
          var add = function () {
            editText.textContent = next.slice(0, i);
            i++;
            if (i <= next.length) setTimeout(add, 55);
            else { wIdx++; setTimeout(typeWord, 2600); }
          };
          add();
        }
      };
      setTimeout(del, 2200);
    };
    typeWord();
  }

  /* =========================================================
     9) Warteliste-Formulare
  ========================================================= */
  var confettiBurst = null; /* wird unten definiert */
  document.querySelectorAll("[data-waitlist]").forEach(function (form) {
    var input = form.querySelector("input[type=email]");
    var errEl = form.querySelector(".wl-error");
    var okEl = form.querySelector(".wl-success");
    var field = form.querySelector(".wl-field");

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var email = (input.value || "").trim();
      var valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
      if (!valid) {
        errEl.hidden = false;
        form.classList.remove("shake");
        void form.offsetWidth;
        form.classList.add("shake");
        input.focus();
        return;
      }
      errEl.hidden = true;

      var finish = function () {
        field.style.display = "none";
        okEl.hidden = false;
        try {
          var list = JSON.parse(localStorage.getItem("brospify-waitlist") || "[]");
          if (list.indexOf(email) === -1) list.push(email);
          localStorage.setItem("brospify-waitlist", JSON.stringify(list));
        } catch (e) { /* still ok */ }
        if (confettiBurst && !reduceMotion) {
          var r = okEl.getBoundingClientRect();
          confettiBurst(r.left + r.width / 2, r.top + r.height / 2);
        }
      };

      if (WAITLIST_ENDPOINT) {
        var btn = form.querySelector("button[type=submit]");
        var label = btn.querySelector(".btn-label");
        var orig = label ? label.textContent : "";
        if (label) label.textContent = "Einen Moment …";
        btn.disabled = true;
        fetch(WAITLIST_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email, source: "waitlist-landing" })
        }).then(function () { finish(); }).catch(function () {
          if (label) label.textContent = orig;
          btn.disabled = false;
          errEl.textContent = "Ups — das hat nicht geklappt. Versuch es gleich nochmal.";
          errEl.hidden = false;
        });
      } else {
        finish();
      }
    });
  });

  /* =========================================================
     10) Konfetti
  ========================================================= */
  var canvas = document.getElementById("confetti");
  if (canvas && !reduceMotion) {
    var ctx = canvas.getContext("2d");
    var parts = [];
    var raf = null;
    var COLORS = ["#7c3aed", "#ec4899", "#fb923c", "#84cc16", "#38bdf8", "#facc15"];
    var resize = function () {
      canvas.width = window.innerWidth * (window.devicePixelRatio || 1);
      canvas.height = window.innerHeight * (window.devicePixelRatio || 1);
      ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    };
    window.addEventListener("resize", resize);
    resize();
    var loop = function () {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      parts = parts.filter(function (p) { return p.life > 0; });
      parts.forEach(function (p) {
        p.vy += 0.16;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 1;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(p.life / 60, 0);
        ctx.fillStyle = p.color;
        if (p.shape === 0) ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
        else { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      });
      if (parts.length) raf = requestAnimationFrame(loop);
      else { raf = null; ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); }
    };
    confettiBurst = function (x, y) {
      for (var i = 0; i < 90; i++) {
        var a = Math.random() * Math.PI * 2;
        var v = 3 + Math.random() * 7;
        parts.push({
          x: x, y: y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - 4,
          vr: (Math.random() - 0.5) * 0.3,
          rot: Math.random() * Math.PI,
          s: 5 + Math.random() * 7,
          life: 90 + Math.random() * 50,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          shape: Math.random() > 0.5 ? 0 : 1
        });
      }
      if (!raf) raf = requestAnimationFrame(loop);
    };
  }

  /* =========================================================
     11) Magnetische Buttons (nur Desktop)
  ========================================================= */
  if (finePointer && !reduceMotion) {
    document.querySelectorAll("[data-magnetic]").forEach(function (btn) {
      var r = null;
      btn.addEventListener("mouseenter", function () { r = btn.getBoundingClientRect(); });
      btn.addEventListener("mousemove", function (e) {
        if (!r) r = btn.getBoundingClientRect();
        var dx = (e.clientX - r.left - r.width / 2) / r.width;
        var dy = (e.clientY - r.top - r.height / 2) / r.height;
        btn.style.transform = "translate(" + dx * 7 + "px," + (dy * 6 - 2) + "px)";
      });
      btn.addEventListener("mouseleave", function () {
        btn.style.transform = ""; r = null;
      });
    });
  }

  /* =========================================================
     12) Sanftes 3D-Tilt auf Karten (nur Desktop)
  ========================================================= */
  if (finePointer && !reduceMotion) {
    document.querySelectorAll("[data-tilt]").forEach(function (card) {
      var r = null;
      card.addEventListener("mouseenter", function () { r = card.getBoundingClientRect(); });
      card.addEventListener("mousemove", function (e) {
        if (!r) r = card.getBoundingClientRect();
        var rx = ((e.clientY - r.top) / r.height - 0.5) * -3.2;
        var ry = ((e.clientX - r.left) / r.width - 0.5) * 3.2;
        card.style.transform = "perspective(900px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg) translateY(-4px)";
      });
      card.addEventListener("mouseleave", function () {
        card.style.transform = ""; r = null;
      });
    });
  }

  /* =========================================================
     12b) Bento-Karten: maus-gesteuerter Tiefen-Parallax.
          Jede Karte hat eine eigene Tiefe → sie verschieben
          sich unterschiedlich stark zum Cursor (begrenzt, sauber).
          Schreibt translate → komponiert mit dem Hover-Tilt (transform).
  ========================================================= */
  if (finePointer && !reduceMotion) {
    var bento = document.querySelector(".bento");
    if (bento) {
      var DEPTHS = [1, 0.45, 0.8, 0.4, 0.95, 1, 0.5, 0.85];
      var MAX_SHIFT = 22;
      var bCells = Array.prototype.slice.call(bento.querySelectorAll(".bento-cell")).map(function (c, i) {
        return { el: c, d: DEPTHS[i % DEPTHS.length], x: 0, y: 0 };
      });
      var bmx = 0, bmy = 0, bInside = false, bRaf = null;
      var bLoop = function () {
        var moving = false;
        bCells.forEach(function (p) {
          var tx = bmx * MAX_SHIFT * p.d;
          var ty = bmy * MAX_SHIFT * p.d;
          p.x += (tx - p.x) * 0.08;
          p.y += (ty - p.y) * 0.08;
          if (Math.abs(tx - p.x) > 0.1 || Math.abs(ty - p.y) > 0.1) moving = true;
          p.el.style.translate = p.x.toFixed(2) + "px " + p.y.toFixed(2) + "px";
        });
        if (bInside || moving) { bRaf = requestAnimationFrame(bLoop); }
        else { bRaf = null; }
      };
      bento.addEventListener("mousemove", function (e) {
        var r = bento.getBoundingClientRect();
        bmx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        bmy = ((e.clientY - r.top) / r.height - 0.5) * 2;
      });
      bento.addEventListener("mouseenter", function () {
        bInside = true;
        if (!bRaf) bRaf = requestAnimationFrame(bLoop);
      });
      bento.addEventListener("mouseleave", function () {
        bInside = false; bmx = 0; bmy = 0;
        if (!bRaf) bRaf = requestAnimationFrame(bLoop);
      });
    }
  }

  /* =========================================================
     13) Galaxie-Himmel: Sternschichten bauen + eigener,
         weich gelerpter Parallax mit Maus-Drift (nur Hintergrund)
  ========================================================= */
  var initGalaxy = function (galSection) {
    var galSky = galSection ? galSection.querySelector(".stats-sky") : null;
    if (!galSky) return;
    var skyW = Math.max(galSky.clientWidth, 900);
    var skyH = Math.max(galSky.clientHeight, 700);
    /* Ferne/mittlere Sterne als EIN Element mit vielen Box-Shadows (billig zu rendern) */
    var mkCloud = function (layerSel, count, dim) {
      var layer = galSky.querySelector(layerSel);
      if (!layer) return;
      var dot = document.createElement("span");
      dot.className = "gal-dots";
      var shadows = [];
      for (var i = 0; i < count; i++) {
        var x = Math.round(Math.random() * skyW);
        var y = Math.round(Math.random() * skyH);
        var spread = dim ? (Math.random() < 0.8 ? -0.4 : 0.2) : (Math.random() < 0.6 ? 0 : 0.6);
        var tone = Math.random();
        var col = tone < 0.72 ? "rgba(255,255,255," + (dim ? 0.5 : 0.8) + ")"
          : tone < 0.86 ? "rgba(191,219,254," + (dim ? 0.55 : 0.85) + ")"
          : "rgba(255,224,189," + (dim ? 0.5 : 0.8) + ")";
        shadows.push(x + "px " + y + "px 0 " + spread.toFixed(1) + "px " + col);
      }
      dot.style.boxShadow = shadows.join(",");
      layer.appendChild(dot);
    };
    mkCloud(".gal-far", 120, true);
    mkCloud(".gal-mid", 65, false);
    /* Nahe Ebene: einzelne funkelnde Sterne + ✦-Glitzer */
    var galNear = galSky.querySelector(".gal-near");
    if (galNear) {
      var nearFrag = document.createDocumentFragment();
      for (var n = 0; n < 16; n++) {
        var st = document.createElement("b");
        var sz = 2.2 + Math.random() * 1.6;
        st.style.width = sz.toFixed(1) + "px";
        st.style.height = sz.toFixed(1) + "px";
        st.style.left = (Math.random() * 100).toFixed(2) + "%";
        st.style.top = (Math.random() * 100).toFixed(2) + "%";
        var tone2 = Math.random();
        if (tone2 > 0.85) { st.style.setProperty("--sc", "#ffe0bd"); st.style.setProperty("--sg", "rgba(255,224,189,0.6)"); }
        else if (tone2 > 0.65) { st.style.setProperty("--sc", "#cfe2ff"); st.style.setProperty("--sg", "rgba(147,197,253,0.65)"); }
        st.style.setProperty("--tw", (2.4 + Math.random() * 3.6).toFixed(2) + "s");
        st.style.setProperty("--td", (-Math.random() * 5).toFixed(2) + "s");
        nearFrag.appendChild(st);
      }
      for (var q = 0; q < 4; q++) {
        var sp = document.createElement("i");
        sp.textContent = "✦";
        sp.style.left = (8 + Math.random() * 84).toFixed(2) + "%";
        sp.style.top = (8 + Math.random() * 84).toFixed(2) + "%";
        sp.style.setProperty("--ss", (9 + Math.random() * 6).toFixed(0) + "px");
        sp.style.setProperty("--tw", (5 + Math.random() * 4).toFixed(2) + "s");
        sp.style.setProperty("--td", (-Math.random() * 6).toFixed(2) + "s");
        nearFrag.appendChild(sp);
      }
      galNear.appendChild(nearFrag);
    }

    /* .in-view umschalten (steuert per CSS die Keyframe-Pause) — pointer-unabhängig,
       damit Handys die Sterne funkeln sehen, offscreen aber alles ruht. */
    if (!reduceMotion && "IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { galSection.classList.toggle("in-view", e.isIntersecting); });
      }, { rootMargin: "160px 0px" }).observe(galSection);
    }

    /* Eigener Parallax: gelerpt + Maus-Drift — nur Desktop, gecachte Messung, parkt im Leerlauf */
    if (!reduceMotion && finePointer) {
      var galEls = Array.prototype.slice.call(galSky.querySelectorAll("[data-gal]")).map(function (el) {
        return { el: el, f: parseFloat(el.getAttribute("data-gal")) || 0, x: 0, y: 0 };
      });
      var galActive = false, galRaf = null, gmx = 0, gmy = 0;
      var galTop = 0, galH = 0, galVh = window.innerHeight;
      var galMeasure = function () {
        galVh = window.innerHeight;
        var r = galSection.getBoundingClientRect();
        galTop = r.top + window.scrollY;
        galH = r.height;
        galKick();
      };
      var galLoop = function () {
        var mid = galTop + galH / 2 - window.scrollY - galVh / 2;
        var moving = false;
        galEls.forEach(function (p) {
          var ty = -mid * p.f + gmy * 150 * p.f;
          var tx = gmx * 220 * p.f;
          var nx = p.x + (tx - p.x) * 0.06;
          var ny = p.y + (ty - p.y) * 0.06;
          if (Math.abs(nx - p.x) > 0.04 || Math.abs(ny - p.y) > 0.04) moving = true;
          p.x = nx; p.y = ny;
          p.el.style.transform = "translate3d(" + p.x.toFixed(2) + "px," + p.y.toFixed(2) + "px,0)";
        });
        galRaf = (galActive && moving) ? requestAnimationFrame(galLoop) : null;
      };
      var galKick = function () { if (galActive && !galRaf) galRaf = requestAnimationFrame(galLoop); };
      galMeasure();
      window.addEventListener("resize", galMeasure);
      window.addEventListener("load", galMeasure);
      window.addEventListener("scroll", galKick, { passive: true });
      galSection.addEventListener("mousemove", function (e) {
        var r = galSection.getBoundingClientRect();
        gmx = (e.clientX - r.left) / r.width - 0.5;
        gmy = (e.clientY - r.top) / r.height - 0.5;
        galKick();
      });
      galSection.addEventListener("mouseleave", function () { gmx = 0; gmy = 0; galKick(); });
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (e) { galActive = e.isIntersecting; galKick(); });
        }, { rootMargin: "160px 0px" }).observe(galSection);
      } else {
        galActive = true;
        galKick();
      }
    }
  };
  initGalaxy(document.getElementById("stats"));
  initGalaxy(document.getElementById("how"));

  /* (Section 14 entfernt: Hero-Maus-Drift schrieb ungenutzte --mx/--my-Variablen.) */

  /* =========================================================
     15) Sticky-Stack (3 Schritte): jede Karte schrumpft & dimmt,
         während die nächste sich vollständig über sie schiebt.
  ========================================================= */
  var stStack = document.getElementById("stepsStack");
  if (stStack && !reduceMotion && finePointer) {
    var stCards = Array.prototype.slice.call(stStack.querySelectorAll(".stack-card"));
    var stRaf = null;
    var stUpdate = function () {
      var vh = window.innerHeight;
      /* erst ALLE Positionen lesen … */
      var tops = stCards.map(function (c) { return c.getBoundingClientRect().top; });
      /* … dann schreiben (kein Read-nach-Write-Reflow pro Karte) */
      for (var i = 0; i < stCards.length - 1; i++) {
        var gap = tops[i + 1] - tops[i];
        var p = Math.min(Math.max(1 - gap / (vh * 0.55), 0), 1);
        stCards[i].style.transform = "scale(" + (1 - p * 0.08).toFixed(3) + ")";
        stCards[i].style.filter = "brightness(" + (1 - p * 0.4).toFixed(3) + ")";
      }
      var last = stCards[stCards.length - 1];
      if (last) { last.style.transform = ""; last.style.filter = ""; }
      stRaf = null;
    };
    var stOnScroll = function () { if (!stRaf) stRaf = requestAnimationFrame(stUpdate); };
    window.addEventListener("scroll", stOnScroll, { passive: true });
    window.addEventListener("resize", stOnScroll);
    stUpdate();
  }

  /* Shopify: Konfetti nach erfolgreichem Warteliste-Submit (Seiten-Reload) */
  if (document.querySelector("[data-wl-celebrate]") && typeof confettiBurst === "function") {
    setTimeout(function () {
      var el = document.querySelector("[data-wl-celebrate]");
      var r = el.getBoundingClientRect();
      confettiBurst(r.left + r.width / 2, r.top + r.height / 2);
      try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {}
    }, 500);
  }
})();
