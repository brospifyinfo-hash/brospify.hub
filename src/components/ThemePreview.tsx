"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { recolorByRole, type ColorPalette } from "@/lib/theme-placeholders";

// ─────────────────────────────────────────────────────────────────
// Live-Vorschau des Produkt-Themes — rendert die ECHTEN aktiven Sections aus
// index.json / product.json (gleiche Reihenfolge, gleiche Settings, Texte
// bereits eingesetzt). Die 5-Farben-Palette + Schrift werden live angewandt,
// und zwar mit EXAKT derselben Rollen-Logik (recolorByRole) wie der echte
// Download → was man sieht, kommt auch raus. Kein 1:1-Liquid-Render (das
// braucht Shopify), aber strukturgetreu pro Section.
// ─────────────────────────────────────────────────────────────────

export type ThemeColors = ColorPalette;

export interface PreviewSection {
  id: string;
  type: string;
  settings: Record<string, unknown>;
  blocks?: Record<string, { type: string; settings: Record<string, unknown> }>;
  block_order?: string[];
}

export interface PreviewData {
  title: string;
  price: string;
  comparePrice: string;
  images: string[];
  copy: Record<string, string>;
  home: PreviewSection[];
  product: PreviewSection[];
}

const FONT_FAMILY: Record<string, string> = {
  work_sans_n4: "'Work Sans', sans-serif",
  acme_n4: "'Acme', sans-serif",
  assistant_n4: "'Assistant', sans-serif",
  montserrat_n4: "'Montserrat', sans-serif",
  poppins_n4: "'Poppins', sans-serif",
  roboto_n4: "'Roboto', sans-serif",
};
const GOOGLE_FONTS =
  "https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;600;800&family=Acme&family=Assistant:wght@400;600;800&family=Montserrat:wght@400;600;800&family=Poppins:wght@400;600;800&family=Roboto:wght@400;500;700&display=swap";

function ensureFonts() {
  if (typeof document === "undefined" || document.getElementById("tpv-fonts")) return;
  const link = document.createElement("link");
  link.id = "tpv-fonts";
  link.rel = "stylesheet";
  link.href = GOOGLE_FONTS;
  document.head.appendChild(link);
}

const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><rect width='400' height='400' fill='%23ececf1'/><text x='50%' y='50%' font-family='sans-serif' font-size='18' fill='%23aaa' text-anchor='middle' dominant-baseline='middle'>Bild</text></svg>`,
  );

// ─── Settings-Helfer (Texte + Live-Farben) ───────────────────────

function isToken(v: unknown): boolean {
  return typeof v === "string" && /^\[\[[A-Z0-9_]+\]\]$/.test(v);
}
function makeHelpers(s: Record<string, unknown>, P: ColorPalette) {
  const txt = (key: string, fb = "") => {
    const v = s[key];
    return typeof v === "string" && v.trim() && !isToken(v) ? v : fb;
  };
  // Farbe mit Live-Palette (gleiche Logik wie Download), sonst Original/Fallback.
  const col = (key: string, fb: string) => {
    const v = s[key];
    const mapped = recolorByRole(key, typeof v === "string" ? v : "", P);
    if (mapped) return mapped;
    return typeof v === "string" && v ? v : fb;
  };
  const num = (key: string, fb: number) => (typeof s[key] === "number" ? (s[key] as number) : fb);
  return { txt, col, num };
}
function blocksOf(sec: PreviewSection) {
  const order = sec.block_order && sec.block_order.length ? sec.block_order : Object.keys(sec.blocks || {});
  return order.map((id) => sec.blocks?.[id]).filter(Boolean) as { type: string; settings: Record<string, unknown> }[];
}
/** Settings eines Blocks tolerant lesen (auch für Platzhalter-Leerblöcke). */
function bset(b: unknown): Record<string, unknown> {
  return ((b as { settings?: Record<string, unknown> })?.settings as Record<string, unknown>) || {};
}

function Stars({ n = 5, color }: { n?: number; color: string }) {
  return (
    <span style={{ color, fontSize: 13, letterSpacing: 1 }} aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ opacity: i < n ? 1 : 0.28 }}>★</span>
      ))}
    </span>
  );
}

// ─── Section-Renderer ────────────────────────────────────────────

interface Ctx {
  P: ColorPalette;
  title: string;
  price: string;
  comparePrice: string;
  img: (i: number) => string;
  imgCount: number;
}

function renderSection(sec: PreviewSection, ctx: Ctx, key: string) {
  const { P } = ctx;
  const { txt, col, num } = makeHelpers(sec.settings, P);
  const type = sec.type;

  switch (type) {
    // ── Slideshow (Hero) ──
    case "slideshow2":
    case "slideshow": {
      const slide = blocksOf(sec)[0]?.settings || {};
      const h = makeHelpers(slide, P);
      const bg = h.txt("image_mobile") && /^https?:/.test(h.txt("image_mobile")) ? h.txt("image_mobile") : ctx.img(0);
      const ov = h.num("overlay_opacity", 40) / 100;
      return (
        <section key={key} className="tpv-hero" style={{ backgroundImage: `url(${bg})` }}>
          <div className="tpv-abs" style={{ background: `linear-gradient(90deg, rgba(0,0,0,${ov + 0.2}), rgba(0,0,0,${ov * 0.4}))` }} />
          <div className="tpv-hero-in">
            <h1 className="tpv-h1" style={{ color: h.txt("heading_color", "#fff") }}>{h.txt("heading", ctx.title)}</h1>
            <p className="tpv-sub" style={{ color: h.txt("subheading_color", "rgba(255,255,255,.9)") }}>
              {h.txt("subheading", "Spürbar besser im Alltag.")}
            </p>
            {h.txt("box1_price") || h.txt("box2_price") ? (
              <div className="tpv-boxes">
                <div className="tpv-box" style={{ borderColor: "rgba(255,255,255,.4)" }}>
                  <span>{h.txt("box1_amount", "Einzelpack")}</span>
                  <strong>{h.txt("box1_price", ctx.price || "29,99€")}</strong>
                </div>
                <div className="tpv-box" style={{ borderColor: P.accent }}>
                  {h.txt("box2_badge") && <span className="tpv-badge" style={{ background: P.accent }}>{h.txt("box2_badge")}</span>}
                  <span>{h.txt("box2_amount", "Vorteilspack")}</span>
                  <strong>{h.txt("box2_price", "49,99€")}</strong>
                </div>
              </div>
            ) : null}
            <button className="tpv-btn" style={{ background: col("btn_bg_color", P.button), color: col("btn_text_color", P.buttonText), borderRadius: h.num("btn_radius", 30) }}>
              {h.txt("btn_text", "JETZT ENTDECKEN")}
            </button>
          </div>
        </section>
      );
    }

    // ── Welle ──
    case "wave":
      return (
        <svg key={key} className="tpv-wave" viewBox="0 0 1200 60" preserveAspectRatio="none" style={{ height: Math.min(48, num("wave_height", 60) / 2.2) }}>
          <path d="M0,30 C300,70 900,-10 1200,30 L1200,60 L0,60 Z" fill={col("wave_color", P.accent)} />
        </svg>
      );

    // ── Benefits ──
    case "benefits":
      return (
        <section key={key} className="tpv-benefits">
          {[1, 2].map((i) => (
            <div key={i} className="tpv-benefit">
              <div className="tpv-bicon" style={{ background: P.accent }}>✓</div>
              <div>
                <div className="tpv-bt">{txt(`title_${i}`, i === 1 ? "Bequem auf Rechnung" : "Schneller Versand")}</div>
                <div className="tpv-bd" dangerouslySetInnerHTML={{ __html: txt(`text_${i}`, "Sicher & schnell bei dir Zuhause.") }} />
              </div>
            </div>
          ))}
        </section>
      );

    // ── Animated Explanation ──
    case "animatedtext":
      return (
        <section key={key} className="tpv-center">
          <span className="tpv-eyebrow" style={{ color: P.accent, borderColor: col("underline_color", P.accent) }}>{txt("subtitle", "Warum wir?")}</span>
          <h2 className="tpv-h2">{txt("title", "Erklärung")}</h2>
          <div className="tpv-rich" dangerouslySetInnerHTML={{ __html: txt("text", "Hochwertig, durchdacht und gemacht, um dein Problem zu lösen.") }} />
        </section>
      );

    // ── Featured Collection (dynamisch) ──
    case "featured-collection":
      return (
        <section key={key} className="tpv-center" style={{ paddingBottom: 8 }}>
          {txt("title") && <h2 className="tpv-h2">{txt("title")}</h2>}
          <div className="tpv-grid4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="tpv-pcard">
                <img src={ctx.img(i)} alt="" />
                <div className="tpv-pcard-t">{ctx.title || "Produkt"}</div>
                <div className="tpv-pcard-p" style={{ color: P.text }}>{ctx.price || "29,99€"}</div>
              </div>
            ))}
          </div>
        </section>
      );

    // ── Photo / Bilder-Collage ──
    case "photo":
      return (
        <section key={key} className="tpv-split" style={{ background: txt("bg_color", "transparent") }}>
          <div>
            <span className="tpv-eyebrow" style={{ color: P.accent, borderColor: P.accent }}>{txt("subtitle", "Unsere Marke")}</span>
            <h2 className="tpv-h2">{txt("title", "Hochwertige Produkte")}</h2>
            <div className="tpv-rich" style={{ margin: "0 0 14px" }} dangerouslySetInnerHTML={{ __html: txt("description", "Wir entwickeln Produkte, die deinen Alltag verbessern.") }} />
            <button className="tpv-btn tpv-btn-sm" style={{ background: col("btn_bg_color", "transparent"), color: txt("btn_text_color", P.text), border: `2px solid ${col("btn_border_color", P.text)}` }}>
              {txt("button_label", "MEHR ENTDECKEN")}
            </button>
          </div>
          <div className="tpv-collage">
            <img src={imgOr(txt("image_1"), ctx.img(0))} alt="" />
            <img src={imgOr(txt("image_2"), ctx.img(1))} alt="" />
            <img src={imgOr(txt("image_3"), ctx.img(2))} alt="" />
          </div>
        </section>
      );

    // ── Content (Bild + Text) ──
    case "content":
      return (
        <section key={key} className="tpv-split">
          <div>
            <h2 className="tpv-h2" style={{ color: txt("heading_color", P.text) }}>{txt("heading", "DEINE ÜBERSCHRIFT")}</h2>
            <div className="tpv-rich" style={{ color: txt("text_color") || undefined, margin: "0 0 14px" }} dangerouslySetInnerHTML={{ __html: txt("text", "Erkläre hier dein Produkt oder deine Story.") }} />
            <button className="tpv-btn tpv-btn-sm" style={{ background: col("button_bg", P.button), color: col("button_text_color", P.buttonText) }}>
              {txt("button_text", "JETZT ENTDECKEN")}
            </button>
          </div>
          <img className="tpv-img-r" src={imgOr(txt("main_image"), ctx.img(0))} alt="" />
        </section>
      );

    // ── Map ──
    case "map":
      return (
        <section key={key} className="tpv-map" style={{ background: txt("bg_color", "#1a1a1a"), color: txt("text_color", "#fff") }}>
          <div className="tpv-map-img" style={{ background: "linear-gradient(135deg,#2b2b2b,#444)" }}>
            <span style={{ color: col("pin_color", P.accent), fontSize: 28 }}>📍</span>
          </div>
          <div>
            <span className="tpv-eyebrow" style={{ color: P.accent, borderColor: P.accent }}>{txt("subtitle", "Besuche uns")}</span>
            <h2 className="tpv-h2" style={{ color: "inherit" }}>{txt("title", "Unser Standort")}</h2>
            <div className="tpv-rich" style={{ opacity: 0.85 }} dangerouslySetInnerHTML={{ __html: txt("text", "Wir sind für dich da.") }} />
            <button className="tpv-btn tpv-btn-sm" style={{ background: col("btn_bg_color", P.button), color: col("btn_text_color", P.buttonText), marginTop: 10 }}>
              {txt("btn_label", "Route planen")}
            </button>
          </div>
        </section>
      );

    // ── Reviews (Sterne-Kategorien) ──
    case "reviews": {
      const ratings = blocksOf(sec);
      return (
        <section key={key} className="tpv-reviews" style={{ background: txt("background_color", "rgba(0,0,0,.03)") }}>
          <div className="tpv-center" style={{ padding: "0 0 14px" }}>
            <span className="tpv-hl" style={{ color: P.accent }}>{txt("heading_highlight", "10.000+")}</span>
            <h2 className="tpv-h2" style={{ color: txt("heading_color", P.text) }}>{txt("heading", "KUNDEN LIEBEN UNS")}</h2>
          </div>
          <div className="tpv-ratings">
            {(ratings.length ? ratings : [{}, {}, {}, {}]).slice(0, 4).map((b, i) => {
              const bl = makeHelpers(bset(b), P);
              const val = bl.num("rating", 4.8);
              return (
                <div key={i} className="tpv-rrow">
                  <span>{bl.txt("label", ["Qualität", "Haltbarkeit", "Design", "Preis-Leistung"][i] || "Kategorie")}</span>
                  <span className="tpv-rbar"><span style={{ width: `${(val / 5) * 100}%`, background: col("star_color", P.accent) }} /></span>
                  <Stars n={Math.round(val)} color={col("star_color", P.accent)} />
                </div>
              );
            })}
          </div>
        </section>
      );
    }

    // ── Reviews 2 (Foto/Video-Bewertungen) ──
    case "reviews2": {
      const revs = blocksOf(sec).slice(0, 3);
      return (
        <section key={key} className="tpv-reviews" style={{ background: txt("color_bg", "rgba(0,0,0,.02)") }}>
          <div className="tpv-center" style={{ padding: "0 0 14px" }}>
            <span className="tpv-eyebrow" style={{ color: P.accent, borderColor: P.accent }}>{txt("eyebrow", "Aus der Community")}</span>
            <h2 className="tpv-h2">
              {txt("headline", "Echte Stimmen,")} <em style={{ color: col("color_accent", P.accent), fontStyle: "normal" }}>{txt("headline_em", "echte Ergebnisse.")}</em>
            </h2>
          </div>
          <div className="tpv-grid3">
            {(revs.length ? revs : [{}, {}, {}]).map((b, i) => {
              const bl = makeHelpers(bset(b), P);
              return (
                <div key={i} className="tpv-rev-card" style={{ background: txt("color_card", "#fff") }}>
                  <Stars n={bl.num("stars", 5)} color={col("color_accent", P.accent)} />
                  <p>{bl.txt("quote", "Absolut überzeugt — klare Empfehlung!")}</p>
                  <span className="tpv-rev-author">— {bl.txt("author_name", "Sarah M.")}{bl.txt("location") ? `, ${bl.txt("location")}` : ""}</span>
                </div>
              );
            })}
          </div>
        </section>
      );
    }

    // ── Produkt-Hauptsection (Buy-Box) ──
    case "main-product":
      return <MainProduct key={key} sec={sec} ctx={ctx} />;

    // ── Info-Tabs ──
    case "bro-info-tabs": {
      const tabs = blocksOf(sec);
      return (
        <section key={key} className="tpv-tabs-sec">
          <h2 className="tpv-h2" style={{ textAlign: "center" }}>{txt("heading", "Mehr über das Produkt")}</h2>
          <div className="tpv-tabbar">
            {(tabs.length ? tabs : [{}, {}, {}]).slice(0, 4).map((b, i) => (
              <span key={i} className={i === 0 ? "on" : ""} style={i === 0 ? { color: P.accent, borderColor: P.accent } : undefined}>
                {makeHelpers(bset(b), P).txt("label", ["Beschreibung", "Versand", "Rückgabe", "Pflege"][i] || "Tab")}
              </span>
            ))}
          </div>
          <div className="tpv-rich" style={{ textAlign: "center", padding: "10px 0" }} dangerouslySetInnerHTML={{ __html: makeHelpers(tabs[0]?.settings || {}, P).txt("body", "Hochwertiges Produkt mit Detail-Fokus.") }} />
        </section>
      );
    }

    // ── Parallax Vollbild ──
    case "scrollingbild": {
      const ov = num("overlay_opacity", 60) / 100;
      return (
        <section key={key} className="tpv-parallax" style={{ backgroundImage: `url(${imgOr(txt("image"), ctx.img(0))})` }}>
          <div className="tpv-abs" style={{ background: `rgba(0,0,0,${ov * 0.7})` }} />
          <div className="tpv-parallax-in" style={{ color: txt("text_color", "#fff") }}>
            <h2 className="tpv-h1" style={{ fontSize: 26 }}>{txt("headline_line_1", "Produkte, die wirklich verkaufen.")}</h2>
            <div className="tpv-rich" style={{ color: "inherit", opacity: 0.9 }} dangerouslySetInnerHTML={{ __html: txt("lede", "Startklar für deinen Shop.") }} />
            <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "center" }}>
              <button className="tpv-btn tpv-btn-sm" style={{ background: col("btn_primary_bg", P.button), color: col("btn_primary_text", P.buttonText) }}>{txt("cta_primary_label", "Jetzt kaufen")}</button>
              <button className="tpv-btn tpv-btn-sm" style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.6)" }}>{txt("cta_secondary_label", "Mehr erfahren")}</button>
            </div>
          </div>
        </section>
      );
    }

    // ── Social Icons ──
    case "socialicons":
      return (
        <section key={key} className="tpv-center" style={{ padding: "22px 16px" }}>
          <h2 className="tpv-h2" style={{ fontSize: 18, color: txt("heading_color", P.text) }}>{txt("heading", "Folge uns gerne ❤️")}</h2>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 8, fontSize: 22 }}>
            {["📷", "🎵", "▶️", "💬"].map((e, i) => <span key={i}>{e}</span>)}
          </div>
        </section>
      );

    // ── Video-Referenzen ──
    case "vids": {
      const vs = blocksOf(sec).slice(0, 3);
      return (
        <section key={key} className="tpv-reviews" style={{ background: txt("bg_color", "transparent") }}>
          <div className="tpv-center" style={{ padding: "0 0 12px" }}>
            <h2 className="tpv-h2">{txt("title", "Das sagen unsere Kunden")}</h2>
            {txt("subtitle") && <p className="tpv-rich">{txt("subtitle")}</p>}
          </div>
          <div className="tpv-grid3">
            {(vs.length ? vs : [{}, {}, {}]).map((b, i) => {
              const bl = makeHelpers(bset(b), P);
              return (
                <div key={i} className="tpv-vid">
                  <div className="tpv-vid-thumb" style={{ backgroundImage: `url(${ctx.img(i)})` }}><span>▶</span></div>
                  <div className="tpv-vid-meta"><strong>{bl.txt("name", "Kunde")}</strong><span>{bl.txt("message", "Beschreibung")}</span></div>
                </div>
              );
            })}
          </div>
        </section>
      );
    }

    // ── Kollektions-Badges ──
    case "kollektionen": {
      const cols = blocksOf(sec).filter((b) => makeHelpers(b.settings, P).txt("custom_text"));
      if (!cols.length) return null;
      return (
        <section key={key} className="tpv-center" style={{ padding: "16px" }}>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {cols.map((b, i) => (
              <span key={i} style={{ border: `1px solid ${P.accent}`, color: P.text, borderRadius: 20, padding: "5px 14px", fontSize: 12 }}>
                {makeHelpers(b.settings, P).txt("custom_text")}
              </span>
            ))}
          </div>
        </section>
      );
    }

    // Header wird global gerendert; Leer-/Unbekannt-Typen → nichts.
    default:
      return null;
  }
}

function imgOr(a: string | undefined, b: string) {
  return a && /^https?:/.test(a) ? a : b;
}

// ── Produkt-Buy-Box (eigene Komponente wegen Thumbnail-State) ──
function MainProduct({ sec, ctx }: { sec: PreviewSection; ctx: Ctx }) {
  const { P } = ctx;
  const [active, setActive] = useState(0);
  const blocks = blocksOf(sec);
  const get = (t: string) => blocks.find((b) => b.type === t)?.settings || {};
  const usp = makeHelpers(get("benefits_list"), P);
  const stock = makeHelpers(get("stock_indicator"), P);
  const bundle = makeHelpers(get("bundle_selector"), P);
  const buy = makeHelpers(get("buy_buttons"), P);
  const rating = makeHelpers(get("custom_rating"), P);
  const sset = makeHelpers(sec.settings, P);

  return (
    <section className="tpv-pdp">
      <div>
        <img className="tpv-gmain" src={ctx.img(active)} alt="" />
        <div className="tpv-thumbs">
          {Array.from({ length: Math.max(1, Math.min(5, ctx.imgCount)) }).map((_, i) => (
            <img key={i} src={ctx.img(i)} alt="" className={i === active ? "on" : ""} style={i === active ? { borderColor: P.accent } : undefined} onClick={() => setActive(i)} />
          ))}
        </div>
      </div>
      <div className="tpv-buy">
        <span className="tpv-pbadge" style={{ background: P.accent }}>{sset.txt("pg_badge_text", "BESTSELLER")}</span>
        <h1 className="tpv-ptitle">{ctx.title || "Dein Produkt"}</h1>
        <div className="tpv-rating"><Stars n={5} color={P.accent} /> <span>{rating.txt("rating_text", "361 Bewertungen")}</span></div>
        <div className="tpv-price"><strong>{ctx.price || "29,99€"}</strong>{ctx.comparePrice && <s>{ctx.comparePrice}</s>}</div>
        <ul className="tpv-usps">
          {[1, 2, 3, 4].map((i) => usp.txt(`text_${i}`) && (
            <li key={i}><span className="tpv-check" style={{ background: P.accent }}>✓</span>{usp.txt(`text_${i}`)}</li>
          ))}
        </ul>
        <div className="tpv-stock"><span className="tpv-dot" />{stock.txt("text", "Auf Lager")}</div>
        {bundle.txt("heading") && <div className="tpv-bundle-h">{bundle.txt("heading")}</div>}
        <div className="tpv-bundle">
          {[{ q: bundle.txt("opt1_prefix", "1x") }, { q: bundle.txt("opt2_prefix", "2x"), on: true, badge: bundle.txt("opt2_badge", "Am beliebtesten") }, { q: bundle.txt("opt3_prefix", "3x") }].map((b, i) => (
            <div key={i} className="tpv-bopt" style={b.on ? { borderColor: P.accent, background: `${P.accent}14` } : undefined}>
              {b.badge && <span className="tpv-bopt-badge" style={{ background: P.accent }}>{b.badge}</span>}
              <strong>{b.q}</strong>
            </div>
          ))}
        </div>
        <button className="tpv-btn tpv-btn-cart" style={{ background: P.button, color: P.buttonText }}>🛒 {buy.txt("add_to_cart_text", "In den Warenkorb")}</button>
        <div className="tpv-pay">{["VISA", "MC", "PayPal", "Klarna"].map((p) => <span key={p}>{p}</span>)}</div>
      </div>
    </section>
  );
}

// ─── Hauptkomponente ─────────────────────────────────────────────

export default function ThemePreview({ data, colors, font }: { data: PreviewData; colors: ThemeColors; font: string }) {
  const [page, setPage] = useState<"home" | "product">("home");
  useEffect(() => { ensureFonts(); }, []);

  const ctx: Ctx = {
    P: colors,
    title: data.title,
    price: data.price,
    comparePrice: data.comparePrice,
    img: (i: number) => data.images[i] || data.images[0] || PLACEHOLDER,
    imgCount: data.images.length,
  };

  const sections = page === "home" ? data.home : data.product;
  const rootStyle = {
    ["--pv-font" as string]: FONT_FAMILY[font] || "sans-serif",
  } as CSSProperties;

  return (
    <div className="tpv-root" style={rootStyle}>
      <style>{CSS}</style>
      <div className="tpv-bar">
        <div className="tpv-dots"><span /><span /><span /></div>
        <div className="tpv-tabs">
          <button className={page === "home" ? "on" : ""} style={page === "home" ? { background: colors.accent } : undefined} onClick={() => setPage("home")}>Startseite</button>
          <button className={page === "product" ? "on" : ""} style={page === "product" ? { background: colors.accent } : undefined} onClick={() => setPage("product")}>Produktseite</button>
        </div>
        <div className="tpv-url">deinshop.de{page === "product" ? "/products" : ""}</div>
      </div>

      <div className="tpv-viewport" style={{ background: colors.background, color: colors.text }}>
        <header className="tpv-head">
          <span className="tpv-brand">{(data.copy?.BRAND_TITLE || data.title || "Dein Shop").split(" ").slice(0, 2).join(" ")}</span>
          <span style={{ display: "flex", gap: 12, fontSize: 15 }}><span>🔍</span><span>🛒</span></span>
        </header>
        {sections.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", opacity: 0.6, fontSize: 13 }}>Keine Sections gefunden.</div>
        ) : (
          sections.map((s, i) => renderSection(s, ctx, `${s.id}-${i}`))
        )}
      </div>
    </div>
  );
}

const CSS = `
.tpv-root{border:1px solid rgba(255,255,255,.12);border-radius:14px;overflow:hidden;background:#0d0d10;font-family:var(--pv-font)}
.tpv-bar{display:flex;align-items:center;gap:10px;padding:8px 12px;background:#16161b;border-bottom:1px solid rgba(255,255,255,.08)}
.tpv-dots{display:flex;gap:5px}.tpv-dots span{width:9px;height:9px;border-radius:50%;background:#3a3a42}
.tpv-tabs{display:flex;gap:4px;background:#0d0d10;border-radius:8px;padding:3px}
.tpv-tabs button{border:0;background:transparent;color:#9aa0aa;font-size:11px;font-weight:600;padding:4px 10px;border-radius:6px;cursor:pointer;font-family:inherit}
.tpv-tabs button.on{color:#fff}
.tpv-url{margin-left:auto;font-size:10px;color:#6b7280;background:#0d0d10;border-radius:20px;padding:3px 10px;max-width:38%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.tpv-viewport{height:600px;overflow-y:auto}
.tpv-viewport::-webkit-scrollbar{width:8px}.tpv-viewport::-webkit-scrollbar-thumb{background:rgba(0,0,0,.18);border-radius:4px}
.tpv-head{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid rgba(0,0,0,.07);position:sticky;top:0;background:inherit;z-index:2}
.tpv-brand{font-weight:800;font-size:16px;letter-spacing:-.02em}
.tpv-abs{position:absolute;inset:0}
.tpv-hero{position:relative;min-height:300px;display:flex;align-items:center;background-size:cover;background-position:center}
.tpv-hero-in{position:relative;padding:26px 22px;color:#fff;max-width:80%}
.tpv-h1{font-size:30px;line-height:1.1;font-weight:800;margin:0 0 8px;white-space:pre-line}
.tpv-sub{font-size:13px;margin:0 0 14px;max-width:340px}
.tpv-boxes{display:flex;gap:10px;margin-bottom:16px}
.tpv-box{position:relative;background:rgba(20,20,20,.5);border:1px solid;border-radius:10px;padding:10px 14px;text-align:center;min-width:88px;color:#fff}
.tpv-box span{display:block;font-size:11px;opacity:.85}.tpv-box strong{display:block;font-size:16px;margin-top:2px}
.tpv-badge{position:absolute;top:-9px;left:50%;transform:translateX(-50%);color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap}
.tpv-btn{border:0;border-radius:30px;padding:12px 26px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;letter-spacing:.02em}
.tpv-btn-sm{padding:9px 18px;font-size:12px;border-radius:8px}
.tpv-wave{display:block;width:100%}
.tpv-benefits{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:22px 22px}
.tpv-benefit{display:flex;gap:10px;align-items:flex-start}
.tpv-bicon{width:34px;height:34px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;flex:0 0 auto}
.tpv-bt{font-weight:700;font-size:13px}.tpv-bd{font-size:11.5px;opacity:.7;margin-top:1px}
.tpv-center{text-align:center;padding:28px 22px}
.tpv-eyebrow{display:inline-block;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;border-bottom:2px solid;padding-bottom:2px}
.tpv-h2{font-size:22px;font-weight:800;margin:4px 0 10px;letter-spacing:-.02em}
.tpv-rich{font-size:13px;line-height:1.6;opacity:.85;max-width:540px;margin:0 auto}
.tpv-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:6px}
.tpv-pcard{text-align:left}.tpv-pcard img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px}
.tpv-pcard-t{font-size:11px;font-weight:600;margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tpv-pcard-p{font-size:12px;font-weight:800}
.tpv-split{display:grid;grid-template-columns:1fr 1fr;gap:22px;align-items:center;padding:24px 22px}
.tpv-collage{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:8px;height:220px}
.tpv-collage img{width:100%;height:100%;object-fit:cover;border-radius:10px}
.tpv-collage img:first-child{grid-row:1/3}
.tpv-img-r{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px}
.tpv-map{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:center;padding:24px 22px}
.tpv-map-img{height:170px;border-radius:12px;display:flex;align-items:center;justify-content:center}
.tpv-reviews{padding:26px 22px}
.tpv-hl{display:block;font-size:26px;font-weight:800;line-height:1}
.tpv-ratings{max-width:520px;margin:0 auto;display:grid;gap:9px}
.tpv-rrow{display:grid;grid-template-columns:120px 1fr auto;align-items:center;gap:10px;font-size:12px}
.tpv-rbar{height:7px;background:rgba(0,0,0,.1);border-radius:6px;overflow:hidden}.tpv-rbar span{display:block;height:100%}
.tpv-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.tpv-rev-card{border:1px solid rgba(0,0,0,.07);border-radius:12px;padding:14px;box-shadow:0 4px 14px rgba(0,0,0,.04)}
.tpv-rev-card p{font-size:12px;line-height:1.5;margin:8px 0 6px;color:#222}
.tpv-rev-author{font-size:11px;font-weight:700;color:#555}
.tpv-pdp{display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:24px 22px}
.tpv-gmain{width:100%;aspect-ratio:1;object-fit:cover;border-radius:14px;border:1px solid rgba(0,0,0,.06)}
.tpv-thumbs{display:flex;gap:8px;margin-top:8px}
.tpv-thumbs img{width:52px;height:52px;object-fit:cover;border-radius:8px;border:2px solid transparent;cursor:pointer;opacity:.7}
.tpv-thumbs img.on{opacity:1}
.tpv-buy{display:flex;flex-direction:column}
.tpv-pbadge{align-self:flex-start;color:#fff;font-size:9px;font-weight:700;padding:3px 9px;border-radius:6px;letter-spacing:.06em;margin-bottom:8px}
.tpv-ptitle{font-size:23px;font-weight:800;margin:0 0 6px;line-height:1.15}
.tpv-rating{display:flex;align-items:center;gap:6px;font-size:11px;opacity:.7;margin-bottom:8px}
.tpv-price{display:flex;align-items:baseline;gap:8px;margin-bottom:12px}
.tpv-price strong{font-size:26px;font-weight:800}.tpv-price s{opacity:.5;font-size:15px}
.tpv-usps{list-style:none;margin:0 0 12px;padding:0;display:grid;gap:6px}
.tpv-usps li{display:flex;align-items:center;gap:8px;font-size:12.5px}
.tpv-check{width:18px;height:18px;border-radius:50%;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex:0 0 auto}
.tpv-stock{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;margin-bottom:14px}
.tpv-dot{width:9px;height:9px;border-radius:50%;background:#21c463;box-shadow:0 0 0 3px rgba(33,196,99,.2)}
.tpv-bundle-h{font-size:13px;font-weight:700;margin-bottom:8px}
.tpv-bundle{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}
.tpv-bopt{position:relative;border:2px solid rgba(0,0,0,.12);border-radius:10px;padding:14px 0;text-align:center;font-size:14px}
.tpv-bopt-badge{position:absolute;top:-9px;left:50%;transform:translateX(-50%);color:#fff;font-size:8.5px;font-weight:700;padding:2px 7px;border-radius:20px;white-space:nowrap}
.tpv-btn-cart{width:100%;border-radius:12px;padding:14px;font-size:14px}
.tpv-pay{display:flex;gap:6px;justify-content:center;margin-top:10px}
.tpv-pay span{font-size:9px;font-weight:700;color:#555;background:#fff;border:1px solid rgba(0,0,0,.1);border-radius:4px;padding:3px 6px}
.tpv-tabs-sec{padding:24px 22px}
.tpv-tabbar{display:flex;gap:16px;justify-content:center;border-bottom:1px solid rgba(0,0,0,.08);margin:10px 0}
.tpv-tabbar span{font-size:12px;font-weight:600;opacity:.6;padding:8px 2px;border-bottom:2px solid transparent}
.tpv-tabbar span.on{opacity:1}
.tpv-parallax{position:relative;min-height:240px;display:flex;align-items:center;justify-content:center;text-align:center;background-size:cover;background-position:center}
.tpv-parallax-in{position:relative;padding:24px;max-width:80%}
.tpv-vid{border-radius:12px;overflow:hidden;border:1px solid rgba(0,0,0,.07);background:#fff}
.tpv-vid-thumb{aspect-ratio:9/14;background-size:cover;background-position:center;display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px}
.tpv-vid-thumb span{background:rgba(0,0,0,.4);width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.tpv-vid-meta{padding:8px 10px;display:flex;flex-direction:column}
.tpv-vid-meta strong{font-size:12px;color:#222}.tpv-vid-meta span{font-size:11px;color:#777}
@media(max-width:680px){
  .tpv-benefits,.tpv-split,.tpv-map,.tpv-pdp,.tpv-grid3,.tpv-grid4{grid-template-columns:1fr}
  .tpv-grid4{grid-template-columns:1fr 1fr}.tpv-hero-in,.tpv-parallax-in{max-width:100%}
  .tpv-h1{font-size:23px}.tpv-collage{height:170px}.tpv-rrow{grid-template-columns:90px 1fr auto}
  .tpv-viewport{height:400px}
}
`;
