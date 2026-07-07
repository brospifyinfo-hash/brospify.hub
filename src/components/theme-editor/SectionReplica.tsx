"use client";

// ─── Replica-Renderer der Bibliotheks-Sections ──────────────────────
// Getreue Nachbildungen (Struktur/Settings-treu, nicht pixelgenau) für die
// Live-Vorschau UND die Bibliotheks-Thumbnails. Liest dieselben Preset-
// Settings wie die Compile-Engine (theme-library) → Vorschau = Download.
// Farben/Schriften kommen über die --pv-* CSS-Variablen des Vorschau-Canvas;
// preset-eigene Farben (bg_color …) werden direkt gerendert.

import type { CSSProperties, ReactNode } from "react";
import type { SectionInstance } from "@/lib/theme-doc";
import type { ColorPalette } from "@/lib/theme-placeholders";
import { resolveTexts, resolvePresetSettings, getSectionDef, getPresetDef, sectionSupportsDesign } from "@/lib/theme-library";
import { getIconAny } from "@/lib/theme-icon-resolver";
import { DIVIDER_PATHS, DIVIDER_TOP_PATHS } from "@/lib/theme-frame";

/** SVG-Line-Icon aus der Icon-Bibliothek inkl. Lucide-Katalog
 *  (identische Pfade wie im beim Export generierten Liquid-Snippet). */
function RIcon({ id, size = 20, color }: { id: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {getIconAny(id).paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

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

// ─── Design-Frame: Hintergrund-Töne + Formen-Übergänge (Design-Layer) ──────
// Liest die sec_*-Settings (Ton, 2-Farb-Verlauf, Divider-Formen oben/unten)
// — 1:1-Pendant zum beim Export generierten bspx-section-frame-Snippet.
// Die Pfade kommen aus theme-frame.ts (gleiche Quelle wie das Liquid).
// Fades (sec_fade) werden nur noch für Alt-Designs gerendert.

function DesignFrame({ s, children }: { s: Record<string, string | number | boolean>; children: ReactNode }) {
  const bg = typeof s.sec_bg === "string" ? s.sec_bg : "";
  if (!bg) return <>{children}</>;
  const bg2 = typeof s.sec_bg2 === "string" ? s.sec_bg2 : "";
  const pagebg = typeof s.sec_pagebg === "string" && s.sec_pagebg ? s.sec_pagebg : "var(--pv-bg)";
  const fade = String(s.sec_fade || "none");
  const divider = String(s.sec_divider || "none");
  const dividerTop = String(s.sec_divider_top || "none");
  const background = bg2 ? `linear-gradient(170deg, ${bg} 0%, ${bg2} 100%)` : bg;
  return (
    <div className="te-frame" style={{ background }}>
      {DIVIDER_TOP_PATHS[dividerTop] ? (
        <svg className="te-frame-divider-top" viewBox="0 0 1440 64" preserveAspectRatio="none" aria-hidden>
          <path d={DIVIDER_TOP_PATHS[dividerTop]} fill={pagebg} />
        </svg>
      ) : (fade === "top" || fade === "both") ? (
        <span className="te-frame-fade" style={{ top: 0, background: `linear-gradient(180deg, ${pagebg} 0%, transparent 100%)` }} />
      ) : null}
      <div className="te-frame-pad">{children}</div>
      {(fade === "bottom" || fade === "both") && divider === "none" && (
        <span className="te-frame-fade" style={{ bottom: 0, background: `linear-gradient(0deg, ${pagebg} 0%, transparent 100%)` }} />
      )}
      {DIVIDER_PATHS[divider] && (
        <svg className="te-frame-divider" viewBox="0 0 1440 64" preserveAspectRatio="none" aria-hidden>
          <path d={DIVIDER_PATHS[divider]} fill={pagebg} />
        </svg>
      )}
    </div>
  );
}

/** Rendert die Replica einer Bibliotheks-Section (inkl. Design-Frame).
 *  Unbekannter Typ → null. */
export default function SectionReplica({ instance, ctx }: { instance: SectionInstance; ctx: ReplicaCtx }) {
  if (!getSectionDef(instance.type)) return null;
  const body = <SectionBody instance={instance} ctx={ctx} />;
  // Frame nur für Typen, deren Liquid den Design-Layer versteht — sonst
  // würde die Vorschau etwas zeigen, das der Download nicht kann.
  if (!sectionSupportsDesign(instance.type)) return body;
  const s = resolvePresetSettings(instance, ctx.palette);
  return <DesignFrame s={s}>{body}</DesignFrame>;
}

function SectionBody({ instance, ctx }: { instance: SectionInstance; ctx: ReplicaCtx }) {
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

    // ─── Conversion-Pack (CRO-Sections) ───
    case "bro-compare": {
      const layout = str(s.layout, "table");
      const dark = s.dark === true;
      const ac = str(s.accent_color, ctx.palette.accent);
      const rows = [1, 2, 3, 4, 5, 6].map((n) => t[`row_${n}`]).filter(Boolean);
      return (
        <div className={`te-cmp te-cmp--${layout} ${dark ? "te-cmp--dark" : ""}`} style={{ borderRadius: num(s.radius, 16) }}>
          <h2 className="te-h" style={dark ? { color: "#fff" } : undefined}>{t.heading}</h2>
          <p className="te-sub" style={dark ? { color: "rgba(255,255,255,.65)" } : undefined}>{t.subheading}</p>
          <div className="te-cmp-table" style={{ borderRadius: num(s.radius, 16) }}>
            <div className="te-cmp-row te-cmp-head">
              <span className="te-cmp-crit" />
              <span className="te-cmp-col te-cmp-us" style={{ background: `color-mix(in srgb,${ac} ${layout === "cards" ? 16 : 12}%,transparent)`, color: ac }}>
                {t.ribbon && <em className="te-cmp-ribbon" style={{ background: ac }}>{t.ribbon}</em>}
                {t.us_label}
              </span>
              <span className="te-cmp-col">{t.them_label}</span>
            </div>
            {rows.map((r, i) => (
              <div key={i} className="te-cmp-row">
                <span className="te-cmp-crit">{r}</span>
                <span className="te-cmp-col te-cmp-us" style={{ background: `color-mix(in srgb,${ac} 8%,transparent)` }}><b style={{ color: "#1d9e55" }}>✓</b></span>
                <span className="te-cmp-col te-cmp-x">✕</span>
              </div>
            ))}
          </div>
          {t.cta_label && <div style={{ textAlign: "center" }}><span className="te-btn" style={{ background: ac, color: "#fff" }}>{t.cta_label}</span></div>}
        </div>
      );
    }

    case "bro-guarantee": {
      const layout = str(s.layout, "center");
      const ac = str(s.accent_color, ctx.palette.accent);
      const onAccent = layout === "accent";
      const bullets = [1, 2, 3].map((n) => t[`bullet_${n}`]).filter(Boolean);
      return (
        <div
          className={`te-guar2 te-guar2--${layout}`}
          style={{ borderRadius: num(s.radius, 20), background: onAccent ? ac : undefined, color: onAccent ? "#fff" : undefined }}
        >
          <div className="te-guar2-main">
            <span className="te-guar2-seal" style={{ background: onAccent ? "#fff" : ac, color: onAccent ? ac : "#fff" }}>
              <b>{t.seal_text}</b>
              <em>✓ Garantie</em>
            </span>
            <h2 className="te-h" style={{ color: "inherit" }}>{t.heading}</h2>
            <p className="te-guar2-txt">{t.text}</p>
            <div className="te-guar2-bullets">
              {bullets.map((b, i) => (
                <span key={i} className="te-guar2-b"><b style={{ color: onAccent ? "#fff" : "#1d9e55" }}>✓</b> {b}</span>
              ))}
            </div>
            {t.cta_label && <span className="te-btn" style={{ background: onAccent ? "#fff" : ac, color: onAccent ? ac : "#fff" }}>{t.cta_label}</span>}
            {t.note && <span className="te-guar2-note">{t.note}</span>}
          </div>
          {layout === "split" && img(0) && <div className="te-guar2-img"><img src={img(0)} alt="" /></div>}
        </div>
      );
    }

    case "bro-steps": {
      const layout = str(s.layout, "row");
      const ac = str(s.accent_color, ctx.palette.accent);
      const steps = [1, 2, 3].map((n) => ({ title: t[`s${n}_title`], text: t[`s${n}_text`] }));
      return (
        <div className="te-sec">
          <h2 className="te-h">{t.heading}</h2>
          <p className="te-sub">{t.subheading}</p>
          <div className={`te-steps te-steps--${layout}`}>
            {steps.map((st, i) => (
              <div key={i} className="te-steps-item" style={layout === "cards" ? { borderRadius: num(s.radius, 16) } : undefined}>
                <span className="te-steps-n" style={{ background: ac }}>{i + 1}</span>
                <div className="te-steps-txt">
                  <strong>{st.title}</strong>
                  <span>{st.text}</span>
                </div>
              </div>
            ))}
          </div>
          {t.cta_label && <div style={{ textAlign: "center" }}><span className="te-btn" style={{ background: ac, color: "#fff" }}>{t.cta_label}</span></div>}
        </div>
      );
    }

    case "bro-stats": {
      const layout = str(s.layout, "band");
      const ac = str(s.accent_color, ctx.palette.accent);
      const stats = [1, 2, 3, 4].map((n) => ({ n: t[`n${n}`], l: t[`l${n}`] })).filter((x) => x.n);
      return (
        <div
          className={`te-stats te-stats--${layout}`}
          style={layout === "band" ? { background: ac, color: "#fff" } : undefined}
        >
          {t.heading && <h2 className="te-h" style={{ color: "inherit" }}>{t.heading}</h2>}
          <div className="te-stats-grid" style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 4)},1fr)` }}>
            {stats.map((x, i) => (
              <div key={i} className="te-stats-cell" style={layout === "cards" ? { border: "1px solid color-mix(in srgb,var(--pv-text) 12%,transparent)", borderRadius: 14, padding: "14px 8px" } : undefined}>
                <b style={layout !== "band" ? { color: ac } : undefined}>{x.n}</b>
                <span>{x.l}</span>
              </div>
            ))}
          </div>
          {t.note && <span className="te-stats-note">{t.note}</span>}
        </div>
      );
    }

    case "bro-problem-solution": {
      const layout = str(s.layout, "stack");
      const ac = str(s.accent_color, ctx.palette.accent);
      const probs = [1, 2, 3].map((n) => t[`p_${n}`]).filter(Boolean);
      const sols = [1, 2, 3].map((n) => t[`s_${n}`]).filter(Boolean);
      const darkProb = layout === "contrast";
      return (
        <div className="te-sec">
          <div className={`te-pas te-pas--${layout}`}>
            <div
              className="te-pas-block te-pas-prob"
              style={{ borderRadius: num(s.radius, 20), ...(darkProb ? { background: "#151515", color: "#fff" } : {}) }}
            >
              <strong className="te-pas-h">{t.p_heading}</strong>
              {probs.map((x, i) => (
                <span key={i} className="te-pas-row"><b style={{ color: "#e0332f" }}>✕</b> {x}</span>
              ))}
            </div>
            {layout === "stack" && <div className="te-pas-bridge">{t.bridge}</div>}
            <div
              className="te-pas-block te-pas-sol"
              style={{ borderRadius: num(s.radius, 20), borderColor: `color-mix(in srgb,${ac} 35%,transparent)`, background: `color-mix(in srgb,${ac} 6%,var(--pv-bg))` }}
            >
              <strong className="te-pas-h" style={{ color: ac }}>{t.s_heading}</strong>
              {sols.map((x, i) => (
                <span key={i} className="te-pas-row"><b style={{ color: "#1d9e55" }}>✓</b> {x}</span>
              ))}
            </div>
          </div>
          {layout !== "stack" && t.bridge && <div className="te-pas-bridge" style={{ marginTop: 12 }}>{t.bridge}</div>}
          {t.cta_label && <div style={{ textAlign: "center", marginTop: 14 }}><span className="te-btn" style={{ background: ac, color: "#fff" }}>{t.cta_label}</span></div>}
        </div>
      );
    }

    case "bro-chat-reviews": {
      const look = str(s.look, "whatsapp");
      const ac = str(s.accent_color, ctx.palette.accent);
      const chats = [1, 2, 3]
        .map((n) => ({ name: t[`c${n}_name`], m1: t[`c${n}_m1`], m2: t[`c${n}_m2`], time: t[`c${n}_time`] }))
        .filter((c) => c.name);
      const chatBg = look === "whatsapp" ? "#e5ddd5" : look === "imessage" ? "#fff" : `color-mix(in srgb,${ac} 5%,var(--pv-bg))`;
      const bubbleBg = look === "whatsapp" ? "#fff" : look === "imessage" ? "#e9e9eb" : `color-mix(in srgb,${ac} 10%,#fff)`;
      return (
        <div className="te-sec">
          <h2 className="te-h">{t.heading}</h2>
          <div className="te-chat-grid">
            {chats.map((c, i) => (
              <div key={i} className="te-chat-card">
                <div className="te-chat-head">
                  <span className="te-chat-av" style={{ background: ac }}>{(c.name || "?").slice(0, 1).toUpperCase()}</span>
                  <span className="te-chat-name">{c.name}</span>
                  <span className="te-chat-dot" />
                </div>
                <div className="te-chat-body" style={{ background: chatBg }}>
                  {[c.m1, c.m2].filter(Boolean).map((m, j) => (
                    <div key={j} className="te-chat-bubble" style={{ background: bubbleBg }}>
                      {m}
                      <em>{c.time} <b style={{ color: look === "whatsapp" ? "#4fc3f7" : "#9a9a9f" }}>✓✓</b></em>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {t.note && <p className="te-chat-note">{t.note}</p>}
        </div>
      );
    }

    // ── Premium-Sections (v3) ────────────────────────────────────────

    case "bro-icon-benefits": {
      const ac = str(s.accent_color, ctx.palette.accent);
      const look = str(s.layout, "band");
      const onDark = !!s.sec_bg && look === "dunkel";
      const items = [1, 2, 3, 4]
        .map((i) => ({ icon: str(s[`icon_${i}`], ["truck", "shield", "rotate", "star"][i - 1]), title: t[`t${i}`], sub: t[`d${i}`] }))
        .filter((x) => x.title);
      return (
        <div className={`te-ib te-ib-${look}`} style={onDark ? { color: "#fff" } : undefined}>
          {t.heading && <h2 className="te-h" style={{ marginBottom: 22 }}>{t.heading}</h2>}
          <div className="te-ib-grid" style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)},1fr)` }}>
            {items.map((it, i) => (
              <div key={i} className="te-ib-item">
                <span
                  className="te-ib-chip"
                  style={look === "karten" ? { background: `color-mix(in srgb, ${ac} 14%, transparent)`, color: ac } : { background: `color-mix(in srgb, ${ac} 12%, transparent)`, color: ac }}
                >
                  <RIcon id={it.icon} size={look === "minimal" ? 18 : 22} />
                </span>
                <strong className="te-ib-title">{it.title}</strong>
                {it.sub && look !== "minimal" && <span className="te-ib-sub">{it.sub}</span>}
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "bro-spotlight": {
      const ac = str(s.accent_color, ctx.palette.accent);
      const look = str(s.layout, "editorial");
      const initials = (t.name || "A K").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
      const inner = (
        <>
          <span className="te-spot-mark" style={{ color: ac }}>„</span>
          <blockquote className="te-spot-quote">{t.quote}</blockquote>
          <div className="te-spot-stars" style={{ color: ac }}>{STARS}</div>
          <div className="te-spot-who">
            <span className="te-spot-avatar" style={{ background: `color-mix(in srgb, ${ac} 18%, transparent)`, color: ac }}>{initials}</span>
            <span>
              <strong>{t.name}</strong>
              <em>{t.role}</em>
            </span>
          </div>
        </>
      );
      if (look === "karte") {
        return (
          <div className="te-sec">
            <div className="te-spot te-spot-card">{inner}</div>
          </div>
        );
      }
      return <div className={`te-spot te-spot-${look}`}>{inner}</div>;
    }

    case "bro-callouts": {
      const ac = str(s.accent_color, ctx.palette.accent);
      const glow = str(s.layout, "hell") === "glow";
      const items = [1, 2, 3, 4].map((i) => ({ icon: str(s[`icon_${i}`], ["check", "bolt", "shield", "sparkle"][i - 1]), text: t[`c${i}`] })).filter((x) => x.text);
      const left = items.slice(0, Math.ceil(items.length / 2));
      const right = items.slice(Math.ceil(items.length / 2));
      const callout = (it: { icon: string; text: string }, k: number, side: "l" | "r") => (
        <div key={k} className={`te-call-item te-call-${side}`}>
          <span className="te-call-chip" style={{ background: `color-mix(in srgb, ${ac} 14%, transparent)`, color: ac }}>
            <RIcon id={it.icon} size={17} />
          </span>
          <span className="te-call-text">{it.text}</span>
          <span className="te-call-line" style={{ background: `color-mix(in srgb, ${ac} 45%, transparent)` }} />
        </div>
      );
      return (
        <div className="te-call">
          {t.heading && <h2 className="te-h" style={{ marginBottom: 26 }}>{t.heading}</h2>}
          <div className="te-call-stage">
            <div className="te-call-col">{left.map((it, i) => callout(it, i, "l"))}</div>
            <div className="te-call-imgwrap">
              {glow && <span className="te-call-glow" style={{ background: `radial-gradient(closest-side, color-mix(in srgb, ${ac} 32%, transparent), transparent)` }} />}
              {img(0) ? <img className="te-call-img" src={img(0)} alt="" /> : <span className="te-call-img te-noimg" />}
            </div>
            <div className="te-call-col">{right.map((it, i) => callout(it, i, "r"))}</div>
          </div>
        </div>
      );
    }

    case "bro-gradient-cta": {
      const g1 = str(s.g1, ctx.palette.accent);
      const g2 = str(s.g2, ctx.palette.button);
      const g3 = str(s.g3, "");
      const chips = [t.chip1, t.chip2, t.chip3].filter(Boolean);
      const grad = g3
        ? `linear-gradient(135deg, ${g1} 0%, ${g2} 55%, ${g3} 100%)`
        : `linear-gradient(135deg, ${g1} 0%, ${g2} 100%)`;
      return (
        <div className="te-gcta" style={{ background: grad, borderRadius: num(s.radius, 24) }}>
          <span className="te-gcta-shine" />
          <div className="te-gcta-inner">
            {t.eyebrow && <span className="te-eyebrow" style={{ color: "rgba(255,255,255,.85)" }}>{t.eyebrow}</span>}
            <h2 className="te-gcta-h">{t.heading}</h2>
            {t.subheading && <p className="te-gcta-sub">{t.subheading}</p>}
            {chips.length > 0 && (
              <div className="te-gcta-chips">
                {chips.map((c, i) => (
                  <span key={i} className="te-gcta-chip"><RIcon id="check" size={13} /> {c}</span>
                ))}
              </div>
            )}
            <span className="te-gcta-btn">{t.cta} →</span>
            {t.note && <span className="te-gcta-note">{t.note}</span>}
          </div>
        </div>
      );
    }

    case "bro-logo-badges": {
      const look = str(s.layout, "marquee");
      const badges = [t.b1, t.b2, t.b3, t.b4, t.b5].filter(Boolean);
      const row = (key: string) => (
        <div key={key} className="te-logos-row">
          {badges.map((b, i) => (
            <span key={i} className="te-logos-item">{b}</span>
          ))}
        </div>
      );
      return (
        <div className="te-logos">
          {t.heading && <span className="te-logos-head">{t.heading}</span>}
          {look === "marquee" ? (
            <div className="te-logos-track"><div className="te-logos-scroll">{row("a")}{row("b")}</div></div>
          ) : (
            row("static")
          )}
        </div>
      );
    }

    case "bro-image-cards": {
      const look = str(s.layout, "drei");
      const cards = [1, 2, 3].map((i) => ({ title: t[`c${i}_t`], sub: t[`c${i}_d`], src: img(i - 1) })).filter((c) => c.title);
      return (
        <div className="te-imgc">
          {t.heading && <h2 className="te-h" style={{ marginBottom: 22 }}>{t.heading}</h2>}
          <div className={`te-imgc-grid te-imgc-${look}`}>
            {cards.map((c, i) => (
              <figure key={i} className="te-imgc-card" style={{ borderRadius: "min(var(--pv-r),20px)", marginTop: look === "versetzt" && i === 1 ? 26 : 0 }}>
                {c.src ? <img src={c.src} alt="" /> : <span className="te-noimg" style={{ position: "absolute", inset: 0 }} />}
                <span className="te-imgc-shade" />
                <figcaption>
                  <strong>{c.title}</strong>
                  {c.sub && <span>{c.sub}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      );
    }

    case "bro-hero-luxe": {
      const look = str(s.look, "glass");
      const h = str(s.height, "full");
      const pos = str(s.card_pos, "left");
      const overlay = num(s.overlay, 28) / 100;
      const serif = s.serif !== false && s.serif !== "false";
      const cardStyle: CSSProperties =
        look === "light"
          ? { background: "rgba(255,255,255,.94)", color: "#14161a" }
          : look === "dark"
            ? { background: "rgba(12,14,18,.72)", color: "#fff", backdropFilter: "blur(10px)" }
            : { background: "rgba(255,255,255,.14)", color: "#fff", backdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.22)" };
      return (
        <div
          className="te-bhlx"
          style={{
            minHeight: h === "full" ? 380 : h === "tall" ? 320 : 250,
            justifyContent: pos === "center" ? "center" : pos === "right" ? "flex-end" : "flex-start",
          }}
        >
          {img(0) ? <img className="te-bhlx-img" src={img(0)} alt="" /> : <span className="te-bhlx-img te-noimg" />}
          <span className="te-bhlx-shade" style={{ background: `linear-gradient(to top, rgba(0,0,0,${overlay}), transparent 55%)` }} />
          <div className="te-bhlx-card" style={cardStyle}>
            {t.trust_label && (
              <div className="te-bhlx-trust">
                <span className="te-tstars">{[0, 1, 2, 3, 4].map((i) => <i key={i}>★</i>)}</span>
                <span>{t.trust_label} {t.trust_score}</span>
              </div>
            )}
            <h2 className="te-bhlx-h" style={serif ? { fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontWeight: 500 } : undefined}>{t.heading}</h2>
            {t.text && <p className="te-bhlx-p">{t.text}</p>}
            {t.cta && <span className="te-bhlx-btn" style={look === "light" ? { background: "#14161a", color: "#fff" } : undefined}>{t.cta}</span>}
          </div>
        </div>
      );
    }

    case "bro-hero-split": {
      const bg = str(s.bg, "#f6cdd6");
      const tc = str(s.text_color, "#1c1417");
      const inits = str(s.initials, "SM,TK,LB").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 3);
      return (
        <div className="te-bhsp" style={{ background: bg, color: tc }}>
          <div className="te-bhsp-col">
            <div className="te-bhsp-social">
              <span className="te-bhsp-avs">
                {inits.map((x, i) => (
                  <span key={i} className="te-bhsp-av" style={{ background: `color-mix(in srgb, ${tc} ${65 - i * 14}%, ${bg})`, borderColor: bg }}>{x}</span>
                ))}
              </span>
              {t.customers && <b>{t.customers}</b>}
              {t.rating && <span className="te-bhsp-rating"><span className="te-tstars">{[0, 1, 2, 3, 4].map((i) => <i key={i}>★</i>)}</span>{t.rating}</span>}
            </div>
            <h2 className="te-bhsp-h">
              {t.heading_pre} {t.heading_mark && <u>{t.heading_mark}</u>} {t.heading_post}
            </h2>
            {t.text && <p className="te-bhsp-p">{t.text}</p>}
            <div className="te-bhsp-btns">
              {t.cta1 && <span className="te-bhsp-btn te-bhsp-btn--fill">{t.cta1}</span>}
              {t.cta2 && <span className="te-bhsp-btn te-bhsp-btn--line" style={{ borderColor: tc, color: tc }}>{t.cta2}</span>}
            </div>
          </div>
          <div className="te-bhsp-imgwrap">
            {img(0) ? <img src={img(0)} alt="" /> : <span className="te-noimg" style={{ position: "absolute", inset: 0 }} />}
          </div>
        </div>
      );
    }

    case "bro-benefit-cards": {
      const cards = [1, 2, 3, 4]
        .map((i) => ({ emoji: t[`emoji_${i}`], title: t[`title_${i}`], text: t[`text_${i}`], bg: str(s[`bg_${i}`], "#f7f4ec") }))
        .filter((c) => c.title);
      const cols = cards.length >= 4 ? 4 : cards.length === 3 ? 3 : 2;
      return (
        <div className="te-bbcs">
          {t.heading && <h2 className="te-h" style={{ marginBottom: 22 }}>{t.heading}</h2>}
          <div className="te-bbcs-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {cards.map((c, i) => (
              <div key={i} className="te-bbcs-card" style={{ background: c.bg }}>
                {c.emoji && <span className="te-bbcs-emoji">{c.emoji}</span>}
                <strong className="te-bbcs-title">{c.title}</strong>
                {c.text && <p className="te-bbcs-text">{c.text}</p>}
              </div>
            ))}
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
/* ── Design-Frame: Section-Töne + Übergänge ── */
.te-frame{position:relative;overflow:hidden}
.te-frame-pad{position:relative;z-index:1;padding:34px 26px}
.te-frame-fade{position:absolute;left:0;right:0;height:72px;pointer-events:none;z-index:2}
.te-frame-divider{position:absolute;left:0;right:0;bottom:-1px;width:100%;height:32px;display:block;z-index:2}
.te-frame-divider-top{position:absolute;left:0;right:0;top:-1px;width:100%;height:32px;display:block;z-index:2}

/* ── Icon-Band ── */
.te-ib{padding:30px 8px}
.te-ib-grid{display:grid;gap:20px 14px}
.te-ib-item{display:flex;flex-direction:column;align-items:center;text-align:center;gap:9px}
.te-ib-chip{display:flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:18px}
.te-ib-karten .te-ib-item{background:var(--pv-bg);border:var(--pv-bd) solid color-mix(in srgb,var(--pv-text) 10%,transparent);border-radius:min(var(--pv-r),18px);padding:20px 14px;box-shadow:var(--pv-shadow)}
.te-ib-minimal .te-ib-item{flex-direction:row;text-align:left;gap:10px}
.te-ib-minimal .te-ib-chip{width:36px;height:36px;border-radius:12px;flex-shrink:0}
.te-ib-title{font-size:13px;font-weight:700;letter-spacing:-.01em}
.te-ib-sub{font-size:11px;opacity:.6;line-height:1.45;max-width:200px}

/* ── Testimonial-Spotlight ── */
.te-spot{position:relative;max-width:640px;margin:0 auto;padding:34px 20px;text-align:center}
.te-spot-card{background:var(--pv-bg);border:var(--pv-bd) solid color-mix(in srgb,var(--pv-text) 9%,transparent);border-radius:min(var(--pv-r),22px);box-shadow:var(--pv-shadow);padding:34px 30px}
.te-spot-mark{display:block;font-family:var(--pv-h);font-size:64px;line-height:.6;font-weight:800;margin-bottom:14px;opacity:.9}
.te-spot-quote{font-family:var(--pv-h);font-size:20px;font-weight:600;line-height:1.42;letter-spacing:-.01em;margin:0 0 14px}
.te-spot-stars{letter-spacing:2.5px;font-size:15px;margin-bottom:16px}
.te-spot-who{display:flex;align-items:center;justify-content:center;gap:11px}
.te-spot-avatar{display:flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:50%;font-size:13px;font-weight:800}
.te-spot-who span strong{display:block;font-size:13px;font-weight:700;text-align:left}
.te-spot-who span em{display:block;font-style:normal;font-size:11px;opacity:.55;text-align:left}

/* ── Produkt-Callouts ── */
.te-call{padding:30px 8px}
.te-call-stage{display:grid;grid-template-columns:1fr minmax(200px,300px) 1fr;align-items:center;gap:18px}
.te-call-imgwrap{position:relative;display:flex;align-items:center;justify-content:center}
.te-call-glow{position:absolute;inset:-14%;border-radius:50%}
.te-call-img{position:relative;width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:min(var(--pv-r),24px);box-shadow:var(--pv-shadow)}
.te-call-col{display:flex;flex-direction:column;gap:22px}
.te-call-item{position:relative;display:flex;align-items:center;gap:10px}
.te-call-l{flex-direction:row-reverse;text-align:right}
.te-call-chip{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:13px;flex-shrink:0}
.te-call-text{font-size:12.5px;font-weight:600;line-height:1.4;max-width:190px}
.te-call-line{height:2px;flex:1;min-width:16px;border-radius:2px;opacity:.65}
.pm-mobile .te-call-stage{grid-template-columns:1fr;gap:14px}
.pm-mobile .te-call-l{flex-direction:row;text-align:left}
.pm-mobile .te-call-line{display:none}

/* ── Gradient-CTA ── */
.te-gcta{position:relative;overflow:hidden;margin:26px 0;padding:44px 30px;color:#fff;text-align:center}
.te-gcta-shine{position:absolute;top:-40%;left:-10%;width:60%;height:120%;background:radial-gradient(closest-side,rgba(255,255,255,.22),transparent);transform:rotate(18deg);pointer-events:none}
.te-gcta-inner{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center}
.te-gcta-h{font-family:var(--pv-h);font-size:30px;font-weight:800;letter-spacing:-.02em;line-height:1.1;margin:0 0 10px;color:#fff}
.te-gcta-sub{font-size:13.5px;opacity:.88;max-width:480px;margin:0 0 16px;line-height:1.55}
.te-gcta-chips{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:18px}
.te-gcta-chip{display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);backdrop-filter:blur(4px);border-radius:100px;padding:6px 12px;font-size:11px;font-weight:700}
.te-gcta-btn{display:inline-block;background:#fff;color:#111;font-weight:800;font-size:14px;padding:13px 30px;border-radius:100px;box-shadow:0 10px 26px -10px rgba(0,0,0,.4)}
.te-gcta-note{margin-top:10px;font-size:11px;opacity:.75}

/* ── Logo-/Badge-Band ── */
.te-logos{padding:22px 0;text-align:center}
.te-logos-head{display:block;font-size:10.5px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;opacity:.5;margin-bottom:14px}
.te-logos-row{display:flex;gap:38px;align-items:center;justify-content:center;flex-shrink:0;padding:0 19px}
.te-logos-item{font-family:var(--pv-h);font-size:17px;font-weight:800;letter-spacing:.04em;opacity:.45;white-space:nowrap}
.te-logos-track{overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent)}
.te-logos-scroll{display:flex;width:max-content;animation:teLogos 22s linear infinite}
@keyframes teLogos{from{transform:translateX(0)}to{transform:translateX(-50%)}}

/* ── Premium Bild-Karten ── */
.te-imgc{padding:30px 8px}
.te-imgc-grid{display:grid;gap:16px}
.te-imgc-drei{grid-template-columns:repeat(3,1fr)}
.te-imgc-versetzt{grid-template-columns:repeat(3,1fr)}
.te-imgc-breit{grid-template-columns:1.6fr 1fr 1fr}
.pm-mobile .te-imgc-grid{grid-template-columns:1fr}
.te-imgc-card{position:relative;margin:0;overflow:hidden;aspect-ratio:4/5;box-shadow:var(--pv-shadow);transition:transform .25s ease}
.te-imgc-card:hover{transform:translateY(-4px)}
.te-imgc-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.te-imgc-shade{position:absolute;inset:0;background:linear-gradient(180deg,transparent 45%,rgba(0,0,0,.62) 100%)}
.te-imgc-card figcaption{position:absolute;left:16px;right:16px;bottom:14px;color:#fff}
.te-imgc-card figcaption strong{display:block;font-family:var(--pv-h);font-size:16px;font-weight:800;letter-spacing:-.01em}
.te-imgc-card figcaption span{display:block;font-size:11.5px;opacity:.85;margin-top:2px}

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
.te-cmp{padding:26px 12px}
.te-cmp--dark{background:#111;padding:26px 16px}
.te-cmp-table{border:1px solid color-mix(in srgb,var(--pv-text) 12%,transparent);overflow:hidden;margin-bottom:16px}
.te-cmp--dark .te-cmp-table{border-color:rgba(255,255,255,.14);color:#fff}
.te-cmp-row{display:flex;align-items:stretch;border-bottom:1px solid color-mix(in srgb,var(--pv-text) 8%,transparent)}
.te-cmp--dark .te-cmp-row{border-color:rgba(255,255,255,.08)}
.te-cmp-row:last-child{border-bottom:none}
.te-cmp-crit{flex:1;min-width:0;padding:10px 12px;font-size:13px;font-weight:600;display:flex;align-items:center}
.te-cmp-col{flex:0 0 92px;display:flex;align-items:center;justify-content:center;font-size:13px;padding:10px 6px;position:relative;flex-direction:column;gap:2px}
.te-cmp-head .te-cmp-col{font-weight:800;font-size:12.5px}
.te-cmp-ribbon{font-style:normal;color:#fff;font-size:8.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:2px 7px;border-radius:99px}
.te-cmp-x{color:#c8c8c8;font-weight:700}
.te-cmp--cards .te-cmp-us{box-shadow:0 6px 18px -8px rgba(0,0,0,.3)}

.te-guar2{display:flex;gap:22px;align-items:center;margin:26px 0;padding:30px 24px;border:1px solid color-mix(in srgb,var(--pv-text) 10%,transparent)}
.te-guar2--accent{border:none}
.te-guar2-main{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px}
.te-guar2--split .te-guar2-main{align-items:flex-start;text-align:left}
.te-guar2--split .te-guar2-main .te-h{text-align:left}
.te-guar2-seal{width:92px;height:92px;border-radius:50%;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 8px 22px -8px rgba(0,0,0,.35);outline:3px dashed color-mix(in srgb,currentColor 0%,transparent)}
.te-guar2-seal b{font-family:var(--pv-h);font-weight:800;font-size:17px;line-height:1.1}
.te-guar2-seal em{font-style:normal;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;opacity:.85}
.te-guar2-txt{font-size:13px;line-height:1.55;opacity:.8;margin:0;max-width:52ch}
.te-guar2-bullets{display:flex;flex-wrap:wrap;gap:8px 18px;justify-content:center;font-size:12.5px;font-weight:600}
.te-guar2--split .te-guar2-bullets{justify-content:flex-start}
.te-guar2-note{font-size:11px;opacity:.6}
.te-guar2-img{flex:0 0 34%;border-radius:min(var(--pv-r),16px);overflow:hidden}
.te-guar2-img img{width:100%;height:100%;object-fit:cover;display:block}

.te-steps{display:flex;flex-direction:column;gap:14px;margin-bottom:6px}
.te-steps--row{flex-direction:row;gap:12px}
.te-steps--row .te-steps-item{flex:1;flex-direction:column;text-align:center;align-items:center}
.te-steps-item{display:flex;gap:12px;align-items:flex-start}
.te-steps--cards .te-steps-item{border:1px solid color-mix(in srgb,var(--pv-text) 12%,transparent);padding:16px 14px;flex:1}
.te-steps--cards{flex-direction:row;gap:12px}
.te-steps-n{flex:0 0 auto;width:34px;height:34px;border-radius:50%;color:#fff;font-weight:800;font-size:15px;display:inline-flex;align-items:center;justify-content:center}
.te-steps-txt{display:flex;flex-direction:column;gap:3px;min-width:0}
.te-steps-txt strong{font-family:var(--pv-h);font-weight:800;font-size:14.5px}
.te-steps-txt span{font-size:12.5px;opacity:.7;line-height:1.45}

.te-stats{margin:26px 0;padding:26px 18px;border-radius:min(var(--pv-r),18px);text-align:center}
.te-stats--light{border:1px solid color-mix(in srgb,var(--pv-text) 10%,transparent)}
.te-stats--cards{padding:26px 0;border:none}
.te-stats-grid{display:grid;gap:14px}
.te-stats-cell{display:flex;flex-direction:column;gap:3px}
.te-stats-cell b{font-family:var(--pv-h);font-weight:800;font-size:26px;letter-spacing:-.02em}
.te-stats-cell span{font-size:11.5px;opacity:.75;font-weight:600}
.te-stats--light .te-stats-cell:not(:first-child){border-left:1px solid color-mix(in srgb,var(--pv-text) 10%,transparent)}
.te-stats-note{display:block;margin-top:12px;font-size:10.5px;opacity:.55}

.te-pas{display:flex;flex-direction:column;gap:12px}
.te-pas--split{flex-direction:row;align-items:stretch}
.te-pas--split .te-pas-block,.te-pas--contrast .te-pas-block{flex:1;min-width:0}
.te-pas--contrast{flex-direction:row}
.te-pas-block{display:flex;flex-direction:column;gap:8px;padding:20px 18px;border:1.5px solid transparent}
.te-pas-prob{background:rgba(224,51,47,.06);border-color:rgba(224,51,47,.22)}
.te-pas-h{font-family:var(--pv-h);font-weight:800;font-size:16.5px}
.te-pas-row{display:flex;gap:8px;font-size:13px;line-height:1.45;align-items:flex-start}
.te-pas-row b{flex:0 0 auto;font-weight:800}
.te-pas-bridge{text-align:center;font-family:var(--pv-h);font-weight:800;font-size:16px;padding:2px 0}

.te-chat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.te-chat-card{border:1px solid color-mix(in srgb,var(--pv-text) 12%,transparent);border-radius:16px;overflow:hidden}
.te-chat-head{display:flex;align-items:center;gap:8px;padding:9px 11px;background:color-mix(in srgb,var(--pv-text) 4%,var(--pv-bg))}
.te-chat-av{width:24px;height:24px;border-radius:50%;color:#fff;font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}
.te-chat-name{font-size:12px;font-weight:700;flex:1;min-width:0}
.te-chat-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;flex:0 0 auto}
.te-chat-body{display:flex;flex-direction:column;gap:7px;padding:11px}
.te-chat-bubble{background:#fff;color:#1a1a1a;border-radius:11px;border-top-left-radius:4px;padding:8px 10px;font-size:12px;line-height:1.4;box-shadow:0 1px 2px rgba(0,0,0,.08);max-width:94%}
.te-chat-bubble em{display:block;font-style:normal;font-size:9px;opacity:.55;text-align:right;margin-top:3px}
.te-chat-note{text-align:center;font-size:10.5px;opacity:.55;margin:10px 0 0}

/* ── Trustpilot-Sterne (Hero Luxe / Hero Split) ── */
.te-tstars{display:inline-flex;gap:2px}
.te-tstars i{width:15px;height:15px;display:inline-flex;align-items:center;justify-content:center;background:#00b67a;color:#fff;font-style:normal;font-size:10px;line-height:1}

/* ── Hero Luxe ── */
.te-bhlx{position:relative;overflow:hidden;display:flex;align-items:flex-end;padding:22px}
.te-bhlx-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.te-bhlx-shade{position:absolute;inset:0;pointer-events:none}
.te-bhlx-card{position:relative;z-index:1;width:100%;max-width:340px;padding:20px 18px 16px;border-radius:18px;box-shadow:0 24px 60px -28px rgba(0,0,0,.5)}
.te-bhlx-trust{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:700;margin-bottom:10px}
.te-bhlx-h{margin:0 0 8px;font-size:24px;line-height:1.12;letter-spacing:-.01em}
.te-bhlx-p{margin:0 0 14px;font-size:11.5px;line-height:1.6;opacity:.88}
.te-bhlx-btn{display:block;width:100%;text-align:center;box-sizing:border-box;background:#fff;color:#14161a;font-weight:700;font-size:12px;padding:12px 16px;border-radius:100px}

/* ── Hero Split ── */
.te-bhsp{display:grid;grid-template-columns:1.05fr .95fr;gap:30px;align-items:center;padding:44px 34px}
.te-bhsp-social{display:flex;align-items:center;gap:9px;margin-bottom:14px;flex-wrap:wrap}
.te-bhsp-avs{display:inline-flex}
.te-bhsp-av{width:28px;height:28px;border-radius:50%;border:2px solid;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#fff}
.te-bhsp-av+.te-bhsp-av{margin-left:-9px}
.te-bhsp-social b{font-size:11.5px;font-weight:800}
.te-bhsp-rating{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700}
.te-bhsp-h{margin:0 0 12px;font-size:32px;line-height:1.08;font-weight:800;letter-spacing:-.02em}
.te-bhsp-h u{text-decoration:none;position:relative;white-space:nowrap}
.te-bhsp-h u::after{content:"";position:absolute;left:0;right:0;bottom:.04em;height:.14em;background:currentColor;border-radius:3px;opacity:.9}
.te-bhsp-p{margin:0 0 18px;font-size:12.5px;line-height:1.65;max-width:380px;opacity:.82}
.te-bhsp-btns{display:flex;gap:10px;flex-wrap:wrap}
.te-bhsp-btn{display:inline-block;font-weight:800;font-size:12px;padding:12px 22px;border-radius:100px}
.te-bhsp-btn--fill{background:#fff;color:#14161a;box-shadow:0 10px 26px -14px rgba(0,0,0,.35)}
.te-bhsp-btn--line{border:2px solid;padding:10px 20px}
.te-bhsp-imgwrap{position:relative;border-radius:18px;overflow:hidden;min-height:220px}
.te-bhsp-imgwrap img{width:100%;height:100%;object-fit:cover;display:block;position:absolute;inset:0}

/* ── Benefit-Karten (Section) ── */
.te-bbcs{padding:6px 2px}
.te-bbcs-grid{display:grid;gap:12px}
.te-bbcs-card{display:flex;flex-direction:column;gap:7px;padding:22px 20px;border-radius:20px;line-height:1.5}
.te-bbcs-emoji{font-size:26px;line-height:1}
.te-bbcs-title{font-size:14px;font-weight:800}
.te-bbcs-text{margin:0;font-size:11.5px;opacity:.72}

.pm-mobile .te-cta-h{font-size:26px!important}
.pm-mobile .te-benefits2{grid-template-columns:1fr}
.pm-mobile .te-photo{flex-direction:column}
.pm-mobile .te-map{flex-direction:column!important}
.pm-mobile .te-hero-txt strong{font-size:24px}
.pm-mobile .te-cmp-col{flex-basis:64px}
.pm-mobile .te-guar2{flex-direction:column}
.pm-mobile .te-steps--row,.pm-mobile .te-steps--cards{flex-direction:column}
.pm-mobile .te-steps--row .te-steps-item{flex-direction:row;text-align:left;align-items:flex-start}
.pm-mobile .te-stats-grid{grid-template-columns:repeat(2,1fr)!important}
.pm-mobile .te-pas--split,.pm-mobile .te-pas--contrast{flex-direction:column}
.pm-mobile .te-chat-grid{grid-template-columns:1fr}
.pm-mobile .te-bhsp{grid-template-columns:1fr;padding:30px 20px}
.pm-mobile .te-bhsp-h{font-size:26px}
.pm-mobile .te-bbcs-grid{grid-template-columns:1fr 1fr!important}
`;
