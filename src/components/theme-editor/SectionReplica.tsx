"use client";

// ─── Replica-Renderer der Bibliotheks-Sections ──────────────────────
// Getreue Nachbildungen (Struktur/Settings-treu, nicht pixelgenau) für die
// Live-Vorschau UND die Bibliotheks-Thumbnails. Liest dieselben Preset-
// Settings wie die Compile-Engine (theme-library) → Vorschau = Download.
// Farben/Schriften kommen über die --pv-* CSS-Variablen des Vorschau-Canvas;
// preset-eigene Farben (bg_color …) werden direkt gerendert.

import type { CSSProperties } from "react";
import type { SectionInstance } from "@/lib/theme-doc";
import type { ColorPalette } from "@/lib/theme-placeholders";
import { resolveTexts, resolvePresetSettings, getSectionDef, getPresetDef } from "@/lib/theme-library";

export interface ReplicaCtx {
  images: string[];
  title: string;
  price: string;
  palette: ColorPalette;
}

const STARS = "★★★★★";

const REVIEWS = [
  { q: "Beste Entscheidung seit langem — ich nutze es täglich!", a: "Sarah M.", l: "München" },
  { q: "Top Qualität, blitzschnelle Lieferung. Klare Empfehlung!", a: "Tom K.", l: "Berlin" },
  { q: "Hat meine Erwartungen wirklich übertroffen.", a: "Laura B.", l: "Hamburg" },
  { q: "Super Preis-Leistung, sehr zufrieden. Gerne wieder!", a: "Nico W.", l: "Köln" },
  { q: "Schnell geliefert, top verpackt — fünf Sterne.", a: "Julia S.", l: "Frankfurt" },
];
const RATING_CATS = ["Qualität", "Haltbarkeit", "Design", "Preis-Leistung"];
const FEATURE_ICONS = ["✦", "◆", "●", "▲"];
const PILLS = ["Bestseller", "Neuheiten", "Angebote", "Alle Produkte"];
const SOCIALS = ["TikTok", "Instagram", "YouTube", "WhatsApp"];

function num(v: unknown, fb: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fb;
}
function str(v: unknown, fb: string): string {
  return typeof v === "string" && v ? v : fb;
}

/** Rendert die Replica einer Bibliotheks-Section. Unbekannter Typ → null. */
export default function SectionReplica({ instance, ctx }: { instance: SectionInstance; ctx: ReplicaCtx }) {
  const def = getSectionDef(instance.type);
  if (!def) return null;
  const preset = getPresetDef(def, instance.presetId);
  const t = resolveTexts(instance);
  const s = resolvePresetSettings(instance, ctx.palette);
  const img = (i: number) => ctx.images[i % Math.max(ctx.images.length, 1)] || "";
  const presetId = preset?.id || "";

  switch (instance.type) {
    case "bro-cta-banner": {
      const alignSel = str(s.align, "center");
      const style: CSSProperties = {
        minHeight: Math.round(num(s.min_height_desktop, 360) * 0.72),
        borderRadius: num(s.radius, 18),
        textAlign: alignSel as CSSProperties["textAlign"],
        alignItems: alignSel === "left" ? "flex-start" : alignSel === "right" ? "flex-end" : "center",
      };
      return (
        <div className="te-cta" style={style}>
          {img(0) && <img className="te-cta-bg" src={img(0)} alt="" />}
          <span className="te-cta-overlay" style={{ opacity: num(s.overlay_opacity, 45) / 100 }} />
          <div className="te-cta-inner" style={{ maxWidth: num(s.max_width, 720) * 0.8 }}>
            <span className="te-eyebrow" style={{ color: "#fff" }}>{t.eyebrow}</span>
            <h2 className="te-cta-h" style={{ fontSize: Math.round(num(s.h_size_desktop, 44) * 0.8) }}>{t.heading}</h2>
            <p className="te-cta-sub">{t.subheading}</p>
            <span className="te-cta-btn" style={{ background: str(s.btn_primary_bg, ctx.palette.button), color: str(s.btn_primary_text, ctx.palette.buttonText) }}>{t.cta} →</span>
          </div>
        </div>
      );
    }

    case "countdown": {
      const bg = str(s.bg_color, "#0f0f12");
      const fg = str(s.heading_color, "#ffffff");
      const ac = str(s.accent_color, ctx.palette.accent);
      return (
        <div className="te-count" style={{ background: bg, color: fg }}>
          <div>
            <strong className="te-count-h">{t.heading}</strong>
            <span className="te-count-sub">{t.subheading}</span>
          </div>
          <div className="te-count-timer">
            {["02", "14", "36", "52"].map((d, i) => (
              <span key={i} className="te-count-cell" style={{ borderColor: ac, color: fg }}>
                {d}
                <em>{["Tage", "Std", "Min", "Sek"][i]}</em>
              </span>
            ))}
          </div>
        </div>
      );
    }

    case "featured-collection": {
      const cols = presetId === "slider" ? 4 : num(s.columns_desktop, 4);
      const count = presetId === "editorial" ? 2 : 4;
      const ratio = str(s.image_ratio, "square") === "portrait" ? "3/4" : "1/1";
      const arch = str(s.image_shape, "default") === "arch";
      return (
        <div className="te-sec">
          <h2 className="te-h">{t.title}</h2>
          <div className="te-featgrid" style={{ gridTemplateColumns: `repeat(${Math.min(cols, count)},1fr)` }}>
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="te-featcard">
                <div className="te-featimg" style={{ aspectRatio: ratio, borderRadius: arch ? "50% 50% var(--pv-r) var(--pv-r) / 32% 32% var(--pv-r) var(--pv-r)" : "min(var(--pv-r),14px)" }}>
                  {img(i) ? <img src={img(i)} alt="" /> : <span />}
                </div>
                <span className="te-feattitle">{ctx.title}</span>
                <span className="te-featprice">{ctx.price}</span>
              </div>
            ))}
          </div>
          {presetId === "slider" && <div className="te-sliderdots"><span className="on" /><span /><span /></div>}
        </div>
      );
    }

    case "kollektionen": {
      const align = str(s.alignment, "center");
      const fs = num(s.font_size_desktop, 14);
      return (
        <div className="te-sec">
          <div className="te-pills" style={{ justifyContent: align === "flex-start" ? "flex-start" : align === "flex-end" ? "flex-end" : "center" }}>
            {PILLS.map((p) => (
              <span key={p} className="te-pill" style={{ fontSize: fs, padding: `${num(s.padding_y_desktop, 10)}px ${num(s.padding_x_desktop, 24)}px` }}>{p}</span>
            ))}
          </div>
        </div>
      );
    }

    case "reviews2": {
      const bg = str(s.color_bg, ctx.palette.background);
      const card = str(s.color_card, "#ffffff");
      const text = str(s.color_text, ctx.palette.text);
      const ac = str(s.color_accent, ctx.palette.accent);
      return (
        <div className="te-fullpad" style={{ background: bg, color: text }}>
          <span className="te-eyebrow" style={{ color: ac }}>{t.eyebrow}</span>
          <h2 className="te-h" style={{ marginBottom: 4 }}>{t.headline} <em style={{ color: ac, fontStyle: "normal" }}>{t.headlineEm}</em></h2>
          <p className="te-sub">{t.subline}</p>
          <div className="te-revgrid">
            {REVIEWS.slice(0, 3).map((r, i) => (
              <div key={i} className="te-revcard" style={{ background: card }}>
                <span className="te-stars" style={{ color: ac }}>{STARS}</span>
                <p>„{r.q}"</p>
                <span className="te-revwho">{r.a} · {r.l}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "reviews": {
      const hs = num(s.heading_size, 40) * 0.72;
      return (
        <div className="te-sec" style={{ maxWidth: num(s.max_width, 900), margin: "0 auto" }}>
          <h2 className="te-h" style={{ fontSize: hs }}>{t.heading}</h2>
          <p className="te-sub">{t.subheading}</p>
          <div className="te-ratingrows">
            {RATING_CATS.map((c, i) => (
              <div key={c} className="te-ratingrow">
                <span className="te-ratinglabel">{c}</span>
                <span className="te-stars" style={{ fontSize: num(s.star_size, 20) * 0.85 }}>{STARS}</span>
                <strong>{["4.9", "4.8", "4.9", "4.7"][i]}</strong>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "trustpilot": {
      const speed = num(s.scroll_speed, 30);
      const pad = num(s.card_padding, 12);
      const fs = num(s.text_size, 14);
      return (
        <div className="te-sec te-clip">
          <div className="te-marquee" style={{ animationDuration: `${Math.max(8, 60 - speed * 0.5)}s` }}>
            {[...REVIEWS, ...REVIEWS].map((r, i) => (
              <div key={i} className="te-tpcard" style={{ padding: pad }}>
                <span className="te-tpstars">{STARS}</span>
                <p style={{ fontSize: fs * 0.95 }}>{r.q}</p>
                <span className="te-revwho">{r.a}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "vids": {
      const bg = str(s.bg_color, ctx.palette.background);
      const dark = bg.startsWith("#1") || bg.startsWith("#0");
      return (
        <div className="te-fullpad" style={{ background: bg, color: dark ? "#f5f5f7" : undefined }}>
          <h2 className="te-h">{t.title}</h2>
          <p className="te-sub">{t.subtitle}</p>
          <div className="te-vids">
            {[0, 1, 2].map((i) => (
              <div key={i} className="te-vid">
                {img(i) ? <img src={img(i)} alt="" /> : <span />}
                <span className="te-play">▶</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "socialicons": {
      const size = num(s.icon_size, 40) * 0.8;
      return (
        <div className="te-sec" style={{ textAlign: "center" }}>
          <h2 className="te-h" style={{ fontSize: 20 }}>{t.heading}</h2>
          <div className="te-socials">
            {SOCIALS.map((n) => (
              <span key={n} className="te-social" style={{ width: size, height: size }} title={n}>{n[0]}</span>
            ))}
          </div>
        </div>
      );
    }

    case "bro-feature-grid": {
      const cols = num(s.columns_desktop, 3);
      const cardPad = num(s.card_padding, 24) * 0.8;
      const alignLeft = str(s.card_align, "center") === "left";
      const preset2 = getPresetDef(def, instance.presetId);
      const feats = (preset2?.blocks || []).filter((b) => b.type === "feature");
      return (
        <div className="te-sec" style={{ textAlign: str(s.heading_align, "center") as CSSProperties["textAlign"] }}>
          <span className="te-eyebrow">{t.eyebrow}</span>
          <h2 className="te-h" style={{ textAlign: "inherit" }}>{t.heading}</h2>
          <p className="te-sub" style={{ textAlign: "inherit" }}>{t.subheading}</p>
          <div className="te-fgrid" style={{ gridTemplateColumns: `repeat(${cols},1fr)` }}>
            {(feats.length ? feats : [0, 1, 2].map(() => null)).map((f, i) => (
              <div key={i} className="te-fcard" style={{ padding: cardPad, textAlign: alignLeft ? "left" : "center", borderRadius: num(s.card_radius, 14) }}>
                <span className="te-ficon" style={{ width: num(s.icon_size, 28), height: num(s.icon_size, 28) }}>{FEATURE_ICONS[i % 4]}</span>
                <strong style={{ fontSize: num(s.title_size, 17) * 0.9 }}>{f ? String(f.settings.title) : "Vorteil"}</strong>
                <p style={{ fontSize: num(s.text_size, 14) * 0.92 }}>{f ? String(f.settings.text) : "Beschreibung"}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "image-with-text": {
      const width = str(s.desktop_image_width, "medium");
      const textFirst = str(s.layout, "image_first") === "text_first";
      const overlap = str(s.content_layout, "no-overlap") === "overlap";
      const centered = str(s.desktop_content_alignment, "left") === "center";
      const imgFlex = width === "large" ? 1.6 : width === "small" ? 0.8 : 1;
      return (
        <div className={`te-iwt ${overlap ? "overlap" : ""}`} style={{ flexDirection: textFirst ? "row-reverse" : "row" }}>
          <div className="te-iwt-img" style={{ flex: imgFlex }}>
            {img(1) ? <img src={img(1)} alt="" /> : <span className="te-noimg" />}
          </div>
          <div className="te-iwt-txt" style={{ textAlign: centered ? "center" : "left" }}>
            <h2 className="te-h" style={{ textAlign: "inherit" }}>{t.heading}</h2>
            <p>{t.text}</p>
            {t.cta && <span className="te-btn">{t.cta}</span>}
          </div>
        </div>
      );
    }

    case "multicolumn": {
      const cols = num(s.columns_desktop, 3);
      const cards = str(s.background_style, "none") === "primary";
      const preset2 = getPresetDef(def, instance.presetId);
      const colBlocks = (preset2?.blocks || []).filter((b) => b.type === "column");
      return (
        <div className="te-sec">
          <h2 className="te-h">{t.title}</h2>
          <div className="te-fgrid" style={{ gridTemplateColumns: `repeat(${cols},1fr)` }}>
            {colBlocks.slice(0, cols === 4 ? 4 : 3).map((c, i) => (
              <div key={i} className={cards ? "te-fcard" : "te-col"} style={{ textAlign: str(s.column_alignment, "center") as CSSProperties["textAlign"] }}>
                <strong>{String(c.settings.title)}</strong>
                <p>{String(c.settings.text).replace(/<[^>]+>/g, "")}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "rich-text": {
      const align = str(s.content_alignment, "center");
      return (
        <div className="te-sec" style={{ textAlign: align as CSSProperties["textAlign"], maxWidth: s.full_width ? "none" : 720, margin: "0 auto" }}>
          <h2 className="te-h" style={{ textAlign: "inherit", fontSize: 30 }}>{t.heading}</h2>
          <p className="te-richtext">{t.text}</p>
        </div>
      );
    }

    case "scrollingbild": {
      const viewport = str(s.size_mode, "ratio") === "viewport";
      const aspect = viewport ? "16/8" : str(s.aspect_desktop, "16 / 9").replace(/\s/g, "");
      return (
        <div className="te-scroll" style={{ aspectRatio: aspect, borderRadius: num(s.corner_radius, 0), margin: `0 ${num(s.side_margin, 0) * 0.7}px` }}>
          {img(2) ? <img src={img(2)} alt="" /> : <span className="te-noimg" />}
          <span className="te-scroll-ov" style={{ opacity: num(s.overlay_opacity, 60) / 100 }} />
          <div className="te-scroll-txt">
            <span className="te-eyebrow" style={{ color: "#fff" }}>{t.eyebrow}</span>
            <strong>{t.line1}</strong>
            <strong style={{ color: ctx.palette.accent }}>{t.line2}</strong>
          </div>
        </div>
      );
    }

    case "collage": {
      const right = str(s.desktop_layout, "left") === "right";
      const carded = str(s.card_styles, "none") !== "none";
      return (
        <div className="te-sec">
          <h2 className="te-h">{t.heading}</h2>
          <div className="te-collage" style={{ flexDirection: right ? "row-reverse" : "row" }}>
            <div className={`te-colbig ${carded ? "card" : ""}`}>{img(0) ? <img src={img(0)} alt="" /> : <span className="te-noimg" />}</div>
            <div className="te-colsmall">
              <div className={carded ? "card" : ""}>{img(1) ? <img src={img(1)} alt="" /> : <span className="te-noimg" />}</div>
              <div className={carded ? "card" : ""}>{img(2) ? <img src={img(2)} alt="" /> : <span className="te-noimg" />}</div>
            </div>
          </div>
        </div>
      );
    }

    case "video": {
      const full = !!s.full_width;
      return (
        <div className="te-sec" style={{ maxWidth: full ? "none" : 860, margin: "0 auto" }}>
          <h2 className="te-h">{t.heading}</h2>
          <div className="te-video" style={{ borderRadius: full ? 0 : "min(var(--pv-r),18px)" }}>
            {img(0) ? <img src={img(0)} alt="" /> : <span className="te-noimg" />}
            <span className="te-play te-play-lg">▶</span>
          </div>
        </div>
      );
    }

    case "animatedtext": {
      const icon = str(s.icon_choice, "star") === "heart" ? "♥" : "★";
      const row = `${icon} ${t.text} `;
      return (
        <div className="te-sec te-clip" style={{ textAlign: "center" }}>
          <span className="te-eyebrow">{t.subtitle}</span>
          <h2 className="te-h" style={{ marginBottom: 10 }}>{t.title}</h2>
          <div className="te-marqueetxt">
            <span style={{ color: ctx.palette.accent }}>{row.repeat(4)}</span>
          </div>
        </div>
      );
    }

    case "qanda": {
      const rows = [
        { q: t.q1, a: t.a1 },
        { q: t.q2, a: t.a2 },
        { q: t.q3, a: t.a3 },
        { q: t.q4, a: t.a4 },
      ];
      const firstOpen = s.auto_close !== false;
      return (
        <div className="te-sec" style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <h2 className="te-h">{t.title}</h2>
          <p className="te-sub">{t.subtitle}</p>
          <div className="te-faq">
            {rows.map((r, i) => (
              <div key={i} className="te-faqitem">
                <div className="te-faqq"><span>{r.q}</span><span className="te-faqplus" style={{ color: ctx.palette.accent }}>{firstOpen && i === 0 ? "−" : "+"}</span></div>
                {firstOpen && i === 0 && <div className="te-faqa">{r.a}</div>}
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "collapsible-content": {
      const sectionStyle = str(s.layout, "row") === "section";
      const preset2 = getPresetDef(def, instance.presetId);
      const rows = (preset2?.blocks || []).filter((b) => b.type === "collapsible_row").slice(0, 4);
      return (
        <div className="te-sec" style={{ maxWidth: 680, margin: "0 auto" }}>
          <h2 className="te-h" style={{ textAlign: str(s.heading_alignment, "center") as CSSProperties["textAlign"] }}>{t.heading}</h2>
          <div className={`te-faq ${sectionStyle ? "te-faqjoined" : ""}`}>
            {rows.map((r, i) => (
              <div key={i} className="te-faqitem">
                <div className="te-faqq"><span>{String(r.settings.heading)}</span><span className="te-faqplus">+</span></div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "bro-info-tabs": {
      const alignSel = str(s.heading_align, "center");
      return (
        <div className="te-sec" style={{ maxWidth: num(s.max_width, 900), margin: "0 auto" }}>
          <h2 className="te-h" style={{ textAlign: alignSel as CSSProperties["textAlign"] }}>{t.heading}</h2>
          <div className="te-tabs" style={{ justifyContent: str(s.tab_align, "center") === "center" ? "center" : "flex-start" }}>
            {["Beschreibung", "Versand", "Garantie"].map((tab, i) => (
              <span key={tab} className={`te-tab ${i === 0 ? "on" : ""}`} style={i === 0 ? { borderColor: ctx.palette.accent, color: ctx.palette.accent } : undefined}>{tab}</span>
            ))}
          </div>
          <div className="te-tabpanel" style={{ padding: num(s.panel_padding, 28) * 0.8, borderRadius: num(s.container_radius, 14) }}>
            Hochwertige Materialien, durchdachtes Design und eine Verarbeitung, die überzeugt — entwickelt für deinen Alltag.
          </div>
        </div>
      );
    }

    case "slideshow2": {
      const full = s.full_width !== false;
      const radius = num(s.corner_radius, 30);
      const h = Math.round(num(s.height_desktop, 700) * 0.5);
      return (
        <div className="te-hero" style={{ height: h, borderRadius: full ? 0 : radius, margin: full ? "0 -24px" : "10px 0" }}>
          {img(0) ? <img src={img(0)} alt="" /> : <span className="te-noimg" />}
          <span className="te-hero-ov" />
          <div className="te-hero-txt">
            <strong>{t.heading}</strong>
            <span>{t.subheading}</span>
            <em className="te-hero-btn" style={{ background: ctx.palette.button, color: ctx.palette.buttonText }}>{t.cta}</em>
          </div>
          <div className="te-hero-dots"><span style={{ background: ctx.palette.accent }} /><span /><span /></div>
        </div>
      );
    }

    case "benefits": {
      const pad = Math.round(num(s.padding_vertical, 20) * 0.8);
      return (
        <div className="te-benefits2" style={{ paddingTop: pad, paddingBottom: pad }}>
          {[{ ti: t.title1, tx: t.text1 }, { ti: t.title2, tx: t.text2 }].map((b, i) => (
            <div key={i} className="te-benefit2">
              <span className="te-ficon">{i === 0 ? "✦" : "◆"}</span>
              <span><strong>{b.ti}</strong><p>{b.tx}</p></span>
            </div>
          ))}
        </div>
      );
    }

    case "photo": {
      const bg = str(s.bg_color, ctx.palette.background);
      return (
        <div className="te-fullpad" style={{ background: bg }}>
          <div className="te-photo">
            <div className="te-photo-imgs">
              {[0, 1, 2].map((i) => (
                <div key={i} className={`te-photo-img p${i}`}>{img(i) ? <img src={img(i)} alt="" /> : <span className="te-noimg" />}</div>
              ))}
            </div>
            <div className="te-photo-txt">
              <span className="te-eyebrow">{t.subtitle}</span>
              <h2 className="te-h" style={{ textAlign: "left" }}>{t.title}</h2>
              <p>{t.description}</p>
              <span className="te-btn" style={{ background: str(s.btn_bg_color, ctx.palette.button), color: str(s.btn_text_color, ctx.palette.buttonText) }}>{t.cta}</span>
            </div>
          </div>
        </div>
      );
    }

    case "map": {
      const mapLeft = str(s.layout, "map_right") === "map_left";
      const dark = str(s.map_filter, "grayscale") === "dark";
      return (
        <div className="te-map" style={{ flexDirection: mapLeft ? "row-reverse" : "row" }}>
          <div className="te-map-txt">
            <span className="te-eyebrow">{t.subtitle}</span>
            <h2 className="te-h" style={{ textAlign: "left" }}>{t.title}</h2>
            <p>{t.text}</p>
            <span className="te-map-addr">📍 {t.address}</span>
            <span className="te-btn" style={{ background: str(s.btn_bg_color, ctx.palette.button), color: str(s.btn_text_color, ctx.palette.buttonText) }}>{t.cta}</span>
          </div>
          <div className={`te-map-canvas ${dark ? "dark" : ""}`}>
            <span className="te-map-pin" style={{ background: str(s.pin_color, ctx.palette.accent) }} />
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}

// Eigene Styles der Replicas (werden vom Vorschau-Canvas einmal injiziert).
export const REPLICA_CSS = `
.te-sec{padding:26px 0}
.te-fullpad{padding:30px 24px;border-radius:min(var(--pv-r),18px)}
.te-clip{overflow:hidden}
.te-h{font-family:var(--pv-h);font-weight:800;font-size:24px;letter-spacing:-.02em;text-align:center;margin:0 0 10px}
.te-sub{font-size:13px;opacity:.65;text-align:center;margin:0 0 18px}
.te-eyebrow{display:block;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--pv-accent);margin-bottom:6px;text-align:inherit}
.te-noimg{display:block;width:100%;height:100%;background:color-mix(in srgb,var(--pv-text) 8%,var(--pv-bg))}
.te-btn{display:inline-block;background:var(--pv-btn);color:var(--pv-btnText);font-weight:700;font-size:13px;padding:10px 22px;border-radius:var(--pv-r);margin-top:12px}
.te-stars{color:var(--pv-accent);letter-spacing:1.5px}

.te-cta{position:relative;display:flex;justify-content:center;overflow:hidden;margin:26px 0;padding:34px 28px}
.te-cta-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.te-cta-overlay{position:absolute;inset:0;background:#000}
.te-cta-inner{position:relative;z-index:1;display:flex;flex-direction:column;align-items:inherit;justify-content:center;color:#fff}
.te-cta-h{font-family:var(--pv-h);font-weight:800;letter-spacing:-.02em;margin:0 0 10px;line-height:1.08;color:#fff}
.te-cta-sub{font-size:13.5px;opacity:.85;margin:0 0 18px;max-width:460px;line-height:1.55}
.te-cta-btn{display:inline-block;font-weight:800;font-size:13.5px;padding:12px 26px;border-radius:100px;width:fit-content}

.te-count{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;padding:18px 24px;border-radius:min(var(--pv-r),16px);margin:26px 0}
.te-count-h{display:block;font-family:var(--pv-h);font-size:17px;font-weight:800}
.te-count-sub{font-size:12px;opacity:.75}
.te-count-timer{display:flex;gap:8px}
.te-count-cell{display:flex;flex-direction:column;align-items:center;font-weight:800;font-size:16px;border:2px solid;border-radius:10px;padding:6px 10px;min-width:46px}
.te-count-cell em{font-style:normal;font-size:9px;font-weight:600;opacity:.7;text-transform:uppercase;letter-spacing:.06em}

.te-featgrid{display:grid;gap:14px}
.te-featcard{display:flex;flex-direction:column;gap:5px}
.te-featimg{overflow:hidden;background:color-mix(in srgb,var(--pv-text) 7%,var(--pv-bg));box-shadow:var(--pv-shadow)}
.te-featimg img{width:100%;height:100%;object-fit:cover;display:block}
.te-feattitle{font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.te-featprice{font-size:13px;font-weight:800}
.te-sliderdots{display:flex;gap:6px;justify-content:center;margin-top:14px}
.te-sliderdots span{width:7px;height:7px;border-radius:50%;background:color-mix(in srgb,var(--pv-text) 22%,transparent)}
.te-sliderdots span.on{background:var(--pv-accent)}

.te-pills{display:flex;gap:10px;flex-wrap:wrap}
.te-pill{border:1.5px solid color-mix(in srgb,var(--pv-text) 18%,transparent);border-radius:100px;font-weight:600}

.te-revgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}
.te-revcard{border:1px solid color-mix(in srgb,var(--pv-text) 10%,transparent);border-radius:min(var(--pv-r),16px);padding:14px;box-shadow:var(--pv-shadow)}
.te-revcard p{font-size:12.5px;line-height:1.5;margin:7px 0 9px;font-weight:500}
.te-revwho{font-size:11px;font-weight:700;opacity:.6}

.te-ratingrows{display:flex;flex-direction:column;gap:10px;max-width:520px;margin:0 auto}
.te-ratingrow{display:flex;align-items:center;gap:14px;justify-content:space-between;border-bottom:1px solid color-mix(in srgb,var(--pv-text) 8%,transparent);padding-bottom:9px}
.te-ratinglabel{font-size:13px;font-weight:700;flex:1}

.te-marquee{display:flex;gap:12px;width:max-content;animation:te-scroll linear infinite}
@keyframes te-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.te-tpcard{width:220px;flex:0 0 auto;background:color-mix(in srgb,var(--pv-text) 3%,var(--pv-bg));border:1px solid color-mix(in srgb,var(--pv-text) 10%,transparent);border-radius:12px;box-shadow:var(--pv-shadow)}
.te-tpstars{color:#00b67a;letter-spacing:1px;font-size:13px}
.te-tpcard p{line-height:1.45;margin:6px 0;font-weight:500}

.te-vids{display:grid;grid-template-columns:repeat(3,1fr);gap:13px}
.te-vid{position:relative;aspect-ratio:9/13;border-radius:min(var(--pv-r),16px);overflow:hidden;background:color-mix(in srgb,var(--pv-text) 8%,var(--pv-bg));box-shadow:var(--pv-shadow)}
.te-vid img{width:100%;height:100%;object-fit:cover;display:block}
.te-play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.92);color:#111;display:flex;align-items:center;justify-content:center;font-size:14px;padding-left:3px}
.te-play-lg{width:56px;height:56px;font-size:19px}

.te-socials{display:flex;gap:14px;justify-content:center;margin-top:14px}
.te-social{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:color-mix(in srgb,var(--pv-text) 88%,#000);color:var(--pv-bg);font-weight:800;font-size:14px}

.te-fgrid{display:grid;gap:13px;margin-top:18px;text-align:left}
.te-fcard{border:var(--pv-bd) solid color-mix(in srgb,var(--pv-text) 10%,transparent);border-radius:16px;background:color-mix(in srgb,var(--pv-text) 3%,var(--pv-bg));box-shadow:var(--pv-shadow);display:flex;flex-direction:column;gap:7px;align-items:inherit}
.te-fcard strong{font-family:var(--pv-h);font-weight:800}
.te-fcard p{font-size:13px;line-height:1.5;opacity:.7;margin:0}
.te-ficon{display:inline-flex;align-items:center;justify-content:center;border-radius:12px;background:color-mix(in srgb,var(--pv-accent) 14%,transparent);color:var(--pv-accent);font-size:15px;align-self:inherit}
.te-fcard[style*="text-align: center"] .te-ficon{align-self:center}
.te-col{display:flex;flex-direction:column;gap:7px}
.te-col p{font-size:13px;line-height:1.5;opacity:.7;margin:0}

.te-iwt{display:flex;gap:26px;align-items:center;padding:26px 0}
.te-iwt-img{min-width:0;border-radius:var(--pv-r);overflow:hidden;aspect-ratio:4/3;background:color-mix(in srgb,var(--pv-text) 7%,var(--pv-bg));box-shadow:var(--pv-shadow)}
.te-iwt-img img{width:100%;height:100%;object-fit:cover;display:block}
.te-iwt-txt{flex:1;min-width:0}
.te-iwt-txt .te-h{text-align:left;margin-bottom:8px}
.te-iwt-txt p{font-size:13.5px;line-height:1.6;opacity:.75;margin:0}
.te-iwt.overlap .te-iwt-txt{background:var(--pv-bg);border:1px solid color-mix(in srgb,var(--pv-text) 9%,transparent);border-radius:min(var(--pv-r),18px);padding:24px;margin-left:-70px;position:relative;z-index:1;box-shadow:var(--pv-shadow)}
.te-iwt.overlap[style*="row-reverse"] .te-iwt-txt{margin-left:0;margin-right:-70px}

.te-richtext{font-size:14.5px;line-height:1.65;opacity:.75;margin:0}

.te-scroll{position:relative;overflow:hidden;margin-top:26px;margin-bottom:26px}
.te-scroll img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.te-scroll-ov{position:absolute;inset:0;background:linear-gradient(to top,#000 0%,transparent 65%)}
.te-scroll-txt{position:absolute;left:34px;bottom:26px;display:flex;flex-direction:column;color:#fff}
.te-scroll-txt strong{font-family:var(--pv-h);font-weight:800;font-size:34px;line-height:1.05;letter-spacing:-.02em}

.te-collage{display:flex;gap:13px}
.te-colbig{flex:1.5;aspect-ratio:1;border-radius:min(var(--pv-r),16px);overflow:hidden;background:color-mix(in srgb,var(--pv-text) 7%,var(--pv-bg))}
.te-colbig img,.te-colsmall img{width:100%;height:100%;object-fit:cover;display:block}
.te-colsmall{flex:1;display:flex;flex-direction:column;gap:13px}
.te-colsmall>div{flex:1;border-radius:min(var(--pv-r),16px);overflow:hidden;background:color-mix(in srgb,var(--pv-text) 7%,var(--pv-bg))}
.te-collage .card{border:1px solid color-mix(in srgb,var(--pv-text) 12%,transparent);box-shadow:var(--pv-shadow)}

.te-video{position:relative;aspect-ratio:16/9;overflow:hidden;background:color-mix(in srgb,var(--pv-text) 8%,var(--pv-bg));box-shadow:var(--pv-shadow)}
.te-video img{width:100%;height:100%;object-fit:cover;display:block;opacity:.85}

.te-marqueetxt{white-space:nowrap;font-family:var(--pv-h);font-weight:800;font-size:22px;letter-spacing:.01em;overflow:hidden;mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
.te-marqueetxt span{display:inline-block;animation:te-scroll 18s linear infinite;width:max-content}

.te-faq{display:flex;flex-direction:column;gap:10px;text-align:left;margin-top:14px}
.te-faqjoined{gap:0}
.te-faqjoined .te-faqitem{border-radius:0;border-bottom-width:0}
.te-faqjoined .te-faqitem:first-child{border-radius:min(var(--pv-r),14px) min(var(--pv-r),14px) 0 0}
.te-faqjoined .te-faqitem:last-child{border-radius:0 0 min(var(--pv-r),14px) min(var(--pv-r),14px);border-bottom-width:var(--pv-bd)}
.te-faqitem{background:color-mix(in srgb,var(--pv-text) 3%,var(--pv-bg));border:var(--pv-bd) solid color-mix(in srgb,var(--pv-text) 10%,transparent);border-radius:min(var(--pv-r),14px);padding:13px 15px;box-shadow:var(--pv-shadow)}
.te-faqq{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13.5px;font-weight:700}
.te-faqplus{font-size:18px;font-weight:400;flex:0 0 auto}
.te-faqa{font-size:12.5px;line-height:1.55;opacity:.7;margin-top:8px}

.te-tabs{display:flex;gap:6px;margin-bottom:0}
.te-tab{font-size:12.5px;font-weight:700;padding:9px 16px;border-bottom:2px solid transparent;opacity:.6}
.te-tab.on{opacity:1;border-bottom:2px solid}
.te-tabpanel{background:color-mix(in srgb,var(--pv-text) 3%,var(--pv-bg));border:1px solid color-mix(in srgb,var(--pv-text) 9%,transparent);font-size:13px;line-height:1.6;opacity:.85;box-shadow:var(--pv-shadow)}

.te-hero{position:relative;overflow:hidden;background:color-mix(in srgb,var(--pv-text) 10%,var(--pv-bg))}
.te-hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.te-hero-ov{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.62),rgba(0,0,0,.12) 60%)}
.te-hero-txt{position:absolute;left:0;right:0;bottom:44px;display:flex;flex-direction:column;align-items:center;text-align:center;color:#fff;gap:8px;padding:0 30px}
.te-hero-txt strong{font-family:var(--pv-h);font-weight:800;font-size:34px;line-height:1.08;letter-spacing:-.02em;white-space:pre-line}
.te-hero-txt span{font-size:14px;opacity:.85;max-width:460px}
.te-hero-btn{display:inline-block;font-style:normal;font-weight:800;font-size:13px;padding:12px 28px;border-radius:100px;margin-top:6px}
.te-hero-dots{position:absolute;bottom:14px;left:0;right:0;display:flex;gap:6px;justify-content:center}
.te-hero-dots span{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.45)}

.te-benefits2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.te-benefit2{display:flex;gap:12px;align-items:flex-start;border:var(--pv-bd) solid color-mix(in srgb,var(--pv-text) 10%,transparent);border-radius:min(var(--pv-r),16px);padding:16px;background:color-mix(in srgb,var(--pv-text) 3%,var(--pv-bg));box-shadow:var(--pv-shadow)}
.te-benefit2 strong{display:block;font-family:var(--pv-h);font-size:14.5px;font-weight:800;margin-bottom:3px}
.te-benefit2 p{font-size:12.5px;opacity:.7;margin:0;line-height:1.5}

.te-photo{display:flex;gap:26px;align-items:center}
.te-photo-imgs{flex:1.2;display:grid;grid-template-columns:1.4fr 1fr;grid-template-rows:1fr 1fr;gap:10px;min-width:0}
.te-photo-img{border-radius:min(var(--pv-r),16px);overflow:hidden;background:color-mix(in srgb,var(--pv-text) 7%,var(--pv-bg))}
.te-photo-img.p0{grid-row:1/3;aspect-ratio:auto}
.te-photo-img img{width:100%;height:100%;object-fit:cover;display:block}
.te-photo-txt{flex:1;min-width:0}
.te-photo-txt p{font-size:13.5px;line-height:1.6;opacity:.75;margin:0 0 6px}

.te-map{display:flex;gap:26px;align-items:center;padding:26px 0}
.te-map-txt{flex:1;min-width:0}
.te-map-txt p{font-size:13.5px;line-height:1.6;opacity:.75;margin:0 0 8px}
.te-map-addr{display:block;font-size:12.5px;font-weight:700;margin:0 0 6px}
.te-map-canvas{position:relative;flex:1.1;aspect-ratio:4/3;border-radius:min(var(--pv-r),16px);overflow:hidden;background:repeating-linear-gradient(0deg,#e8eaed 0 34px,#dde0e4 34px 35px),repeating-linear-gradient(90deg,#e8eaed 0 34px,#dde0e4 34px 35px);box-shadow:var(--pv-shadow)}
.te-map-canvas.dark{filter:invert(.9) hue-rotate(180deg)}
.te-map-pin{position:absolute;top:46%;left:48%;width:18px;height:18px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 10px rgba(0,0,0,.3)}

/* Handy-Layout der Replicas */
.pm-mobile .te-revgrid{grid-template-columns:1fr}
.pm-mobile .te-fgrid{grid-template-columns:1fr 1fr!important}
.pm-mobile .te-featgrid{grid-template-columns:1fr 1fr!important}
.pm-mobile .te-iwt{flex-direction:column!important}
.pm-mobile .te-iwt.overlap .te-iwt-txt{margin:-40px 16px 0}
.pm-mobile .te-collage{flex-direction:column}
.pm-mobile .te-count{justify-content:center;text-align:center}
.pm-mobile .te-scroll-txt strong{font-size:24px}
.pm-mobile .te-cta-h{font-size:26px!important}
.pm-mobile .te-benefits2{grid-template-columns:1fr}
.pm-mobile .te-photo{flex-direction:column}
.pm-mobile .te-map{flex-direction:column!important}
.pm-mobile .te-hero-txt strong{font-size:24px}
`;
