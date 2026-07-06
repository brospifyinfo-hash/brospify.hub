"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PRODUCT_SECTIONS, BUYBOX_DEFAULT_ORDER } from "@/lib/theme-sections";
import { getIcon, DEFAULT_BENEFIT_ICONS } from "@/lib/theme-icons";
import type { SectionInstance, BlockConfig, GalleryConfig } from "@/lib/theme-doc";
import { resolveBlockSettings, getBuyboxLib, getGalleryPreset } from "@/lib/theme-library";
import SectionReplica, { REPLICA_CSS } from "@/components/theme-editor/SectionReplica";

// Rendert ein Bibliotheks-Icon als SVG (currentColor).
function BIcon({ id }: { id: string }) {
  const ic = getIcon(id);
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {ic.paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

// Statischer Beispiel-Inhalt für die zusätzlichen Produktseiten-Sektionen.
const PV_REVIEWS = [
  { q: "Beste Entscheidung seit langem — ich nutze es täglich!", a: "Sarah M.", l: "München" },
  { q: "Top Qualität, blitzschnelle Lieferung. Klare Empfehlung!", a: "Tom K.", l: "Berlin" },
  { q: "Hat meine Erwartungen wirklich übertroffen.", a: "Laura B.", l: "Hamburg" },
];
const PV_FAQ = [
  { q: "Wie schnell wird geliefert?", a: "Versand innerhalb von 24 Stunden, Lieferung in 1–3 Werktagen." },
  { q: "Kann ich zurückgeben?", a: "Ja — 30 Tage Geld-zurück-Garantie, ohne Wenn und Aber." },
  { q: "Ist die Bezahlung sicher?", a: "Absolut. SSL-verschlüsselt, mit PayPal, Klarna & Kreditkarte." },
];
const PV_BRAND = "Wir entwickeln Produkte, die halten, was sie versprechen — fair produziert, sorgfältig getestet und von tausenden Kunden geliebt.";

// ─────────────────────────────────────────────────────────────────
// Live-Vorschau: GETREUE Nachbildung der Produktseiten-Oberseite (main-product
// bis VOR der Beschreibung) — Reihenfolge, Inhalte & Icons wie im echten
// Brospify-Theme: Angebots-Hinweis → Titel → Bewertung → Vorteile (Emoji-Kreise)
// → Lager → Preis → Bundle → Kaufen → Zahlarten → Gratis-Geschenk → Countdown-
// Timeline. Rein clientseitig (lädt immer), voll über CSS-Variablen gethemt,
// responsive für PC & Handy.
// ─────────────────────────────────────────────────────────────────

export interface PreviewBundle { qty: number; name: string; image: string; price: string; compareTotal: string; perUnit: string; save: string; badge: string; popular: boolean }
export interface PreviewData {
  title: string;
  images: string[];
  badge: string;
  offerEndText: string;
  ratingValue: string;
  ratingText: string;
  benefits: { emoji: string; text: string }[];
  stock: string;
  price: string;
  comparePrice: string;
  discount: string;
  bundleHeading: string;
  bundles: PreviewBundle[];
  cta: string;
  payHeading: string;
  giftTitle: string;
  giftSubtitle: string;
  giftItems: { image: string; price: string }[];
  countdownPrefix: string;
  countdown: string;
  countdownSuffix: string;
  timeline: { icon: string; label: string; date: string }[];
}

export interface ThemeColors { button: string; buttonText: string; background: string; text: string; accent: string }

const FONT_FAMILY: Record<string, string> = {
  work_sans_n4: "'Work Sans'", poppins_n4: "'Poppins'", montserrat_n4: "'Montserrat'",
  inter_n4: "'Inter'", roboto_n4: "'Roboto'", lato_n4: "'Lato'", nunito_n4: "'Nunito'",
  raleway_n4: "'Raleway'", dmsans_n4: "'DM Sans'", assistant_n4: "'Assistant'",
  oswald_n4: "'Oswald'", bebas_neue_n4: "'Bebas Neue'", playfair_n4: "'Playfair Display'",
  merriweather_n4: "'Merriweather'", acme_n4: "'Acme'",
};
const GOOGLE_ALL =
  "https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;600;800&family=Poppins:wght@400;600;800&family=Montserrat:wght@400;600;800&family=Inter:wght@400;600;800&family=Roboto:wght@400;500;700&family=Lato:wght@400;700;900&family=Nunito:wght@400;600;800&family=Raleway:wght@400;600;800&family=DM+Sans:wght@400;600;700&family=Assistant:wght@400;600;800&family=Oswald:wght@400;600;700&family=Bebas+Neue&family=Playfair+Display:wght@400;600;800&family=Merriweather:wght@400;700;900&family=Acme&display=swap";
function ensureFonts() {
  if (typeof document === "undefined" || document.getElementById("tpv-allfonts")) return;
  const link = document.createElement("link");
  link.id = "tpv-allfonts"; link.rel = "stylesheet"; link.href = GOOGLE_ALL;
  document.head.appendChild(link);
}

const ICON: Record<string, string> = {
  bag: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z M3 6h18 M16 10a4 4 0 0 1-8 0",
  truck: "M1 3h15v13H1z M16 8h4l3 3v5h-7 M5.5 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M18.5 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  package: "M12 2 3 7v10l9 5 9-5V7Z M3 7l9 5 9-5 M12 12v10",
};
const Ic = ({ d, s = 16 }: { d: string; s?: number }) => (
  <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {d.split(" M").map((seg, i) => <path key={i} d={(i ? "M" : "") + seg} />)}
  </svg>
);

// Zahlarten-Logos wie im Theme (echte Markenfarben, in weißen Kästchen).
const PAY_ORDER = ["visa", "mc", "klarna", "paypal", "apple", "gpay"];
function PayMark({ name }: { name: string }) {
  switch (name) {
    case "visa": return <b style={{ color: "#1a1f71", fontStyle: "italic", fontWeight: 800, fontSize: 12.5, letterSpacing: "-.4px" }}>VISA</b>;
    case "mc": return <span style={{ display: "inline-flex", alignItems: "center" }}><span style={{ width: 15, height: 15, borderRadius: "50%", background: "#eb001b" }} /><span style={{ width: 15, height: 15, borderRadius: "50%", background: "#f79e1b", marginLeft: -6, mixBlendMode: "multiply" }} /></span>;
    case "klarna": return <b style={{ background: "#ffb3c7", color: "#0a0a0a", fontWeight: 800, fontSize: 10, padding: "2px 5px", borderRadius: 4 }}>Klarna.</b>;
    case "paypal": return <b style={{ fontStyle: "italic", fontWeight: 800, fontSize: 11.5 }}><span style={{ color: "#003087" }}>Pay</span><span style={{ color: "#0070e0" }}>Pal</span></b>;
    case "apple": return <b style={{ display: "inline-flex", alignItems: "center", gap: 2, fontWeight: 600, fontSize: 11.5, color: "#000" }}><svg viewBox="0 0 24 24" width="11" height="13" fill="#000"><path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.9-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.88 2.65 3.22 2.6 1.29-.05 1.78-.83 3.34-.83 1.56 0 2 .83 3.37.81 1.39-.03 2.27-1.27 3.12-2.53.98-1.45 1.39-2.85 1.41-2.92-.03-.01-2.71-1.04-2.74-4.13zM14.53 4.6c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.14 1.14.09 2.3-.58 3.01-1.43z" /></svg>Pay</b>;
    case "gpay": return <b style={{ fontWeight: 700, fontSize: 11.5 }}><span style={{ color: "#4285F4" }}>G</span>&nbsp;<span style={{ color: "#3c4043" }}>Pay</span></b>;
    default: return null;
  }
}

export default function ThemePreview({
  data, colors, headingFont, bodyFont, radius, loading, label, viewMode = "desktop",
  hiddenSections = [], sectionHeadings = {}, buyboxOrder = [], hiddenBlocks = [],
  shadow = 1, border = 1, iconStyle = "dark", benefitIcons = [],
  docSections, selectedUid, onSelectSection, onInsertAt,
  buyboxCfg = {}, gallery, page = "product", previewBlock, spacing = 15, zoom = 1,
}: {
  data: PreviewData | null; colors: ThemeColors; headingFont: string; bodyFont: string;
  radius: number; loading: boolean; label: string; viewMode?: "desktop" | "mobile";
  /** Zoom-Faktor auf die Einpass-Skalierung (0.5–2); >1 scrollt horizontal. */
  zoom?: number;
  hiddenSections?: string[]; sectionHeadings?: Record<string, string>;
  buyboxOrder?: string[]; hiddenBlocks?: string[];
  shadow?: number; border?: number; iconStyle?: string; benefitIcons?: string[]; spacing?: number;
  /** Editor-Modus: dokumentgesteuerte Sections (statt PRODUCT_SECTIONS). */
  docSections?: SectionInstance[];
  selectedUid?: string | null;
  onSelectSection?: (uid: string | null) => void;
  onInsertAt?: (index: number) => void;
  /** Kaufbox v2: Style-Art + Texte je Baustein-Typ, Galerie-Preset. */
  buyboxCfg?: Record<string, BlockConfig>;
  gallery?: GalleryConfig;
  /** "home" = Startseite: nur Sections, keine Galerie/Kaufbox. */
  page?: "product" | "home";
  /** Wenn gesetzt: rendert NUR diesen Kaufbox-Baustein (Baustein-Galerie). */
  previewBlock?: string;
}) {
  const hidden = new Set(hiddenSections);
  const hiddenBlk = new Set(hiddenBlocks);
  const order = buyboxOrder.length ? buyboxOrder : BUYBOX_DEFAULT_ORDER;
  const [imgIdx, setImgIdx] = useState(0);
  const [bundleIdx, setBundleIdx] = useState(1);
  const [giftOpen, setGiftOpen] = useState(true);
  const [variantIdx, setVariantIdx] = useState(0);
  const [faqOpen, setFaqOpen] = useState(false);
  useEffect(() => { ensureFonts(); }, []);
  useEffect(() => {
    setImgIdx(0);
    const pop = data?.bundles?.findIndex((b) => b.popular) ?? -1;
    setBundleIdx(pop >= 0 ? pop : 1);
  }, [data]);

  // Feste „Gerätebreite" (Desktop 1080px / Handy 390px) und passgenaue Skalierung
  // in die Vorschau-Spalte — so hängt das Layout NICHT an der Viewport-Breite,
  // sondern zeigt echt, wie es auf PC bzw. Handy aussieht. Der Zoom-Regler
  // multipliziert die Einpass-Skalierung; bei Überbreite scrollt pm-outer.
  const outerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 1, height: 0 });
  const targetW = viewMode === "mobile" ? 390 : 1080;
  const zoomClamped = Math.max(0.5, Math.min(2, typeof zoom === "number" && Number.isFinite(zoom) ? zoom : 1));
  useLayoutEffect(() => {
    const outer = outerRef.current, canvas = canvasRef.current;
    if (!outer || !canvas) return;
    const compute = () => {
      const cw = outer.clientWidth;
      const scale = Math.min(1, cw / targetW) * zoomClamped;
      setBox({ scale, height: canvas.offsetHeight * scale });
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(outer);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [targetW, zoomClamped, data, giftOpen, bundleIdx, imgIdx, colors, radius, headingFont, bodyFont, hiddenSections.join("|"), JSON.stringify(sectionHeadings), buyboxOrder.join("|"), hiddenBlocks.join("|"), JSON.stringify(docSections), selectedUid, JSON.stringify(buyboxCfg), gallery?.presetId, gallery?.badge, page, spacing]);

  const rootStyle = {
    "--pv-bg": colors.background, "--pv-text": colors.text, "--pv-btn": colors.button,
    "--pv-btnText": colors.buttonText, "--pv-accent": colors.accent,
    "--pv-h": `${FONT_FAMILY[headingFont] || "'Work Sans'"}, sans-serif`,
    "--pv-b": `${FONT_FAMILY[bodyFont] || "'Work Sans'"}, sans-serif`,
    "--pv-r": `${Math.max(0, radius)}px`,
    "--pv-shadow": ["none", "0 4px 14px -8px rgba(0,0,0,.16)", "0 12px 30px -10px rgba(0,0,0,.26)"][Math.max(0, Math.min(2, shadow))],
    "--pv-bd": `${Math.max(1, Math.min(3, border))}px`,
    "--pv-gap": `${Math.max(4, Math.min(40, typeof spacing === "number" ? spacing : 15))}px`,
  } as Record<string, string> as CSSProperties;

  const img = data?.images?.[imgIdx] || data?.images?.[0] || "";

  // ── Kaufbox v2: aufgelöste Block-Preset-Settings + Nutzer-Texte ──
  // Identische Auflösung wie die Compile-Engine (theme-library) →
  // Vorschau = Download. Ohne Konfiguration bleibt der bisherige Look.
  const bs = (type: string): Record<string, string | number | boolean> =>
    resolveBlockSettings(type, buyboxCfg[type], colors, { iconStyle });
  const bt = (type: string, field: string, fallback: string): string => {
    const v = buyboxCfg[type]?.texts?.[field];
    if (typeof v === "string" && v.trim()) return v.trim();
    const def = getBuyboxLib(type)?.fields.find((f) => f.id === field)?.def;
    return fallback || def || "";
  };
  const num = (v: unknown, fb: number) => (typeof v === "number" && Number.isFinite(v) ? v : fb);
  const str = (v: unknown, fb: string) => (typeof v === "string" && v ? v : fb);

  // Galerie-Preset (pg_*): Layout/Format/Pfeile/Zähler + Badge.
  const gset = getGalleryPreset(gallery?.presetId).settings;
  const galLeft = str(gset.pg_layout, "bottom") === "left";
  const galRatio = { square: "1 / 1", portrait: "3 / 4", landscape: "16 / 10" }[str(gset.pg_ratio, "square")] || "1 / 1";
  const galArrows = gallery ? gset.pg_arrows === true : false;
  const galCounter = gallery ? gset.pg_counter === true : false;
  const galBadge = (gallery?.badge || "").trim() || data?.badge || "";
  const imgCount = data?.images?.length || 0;
  const stepImg = (d: number) => setImgIdx((i) => (imgCount ? (i + d + imgCount) % imgCount : 0));

  // Klickbarer Baustein-Wrapper (Editor-Modus): wählt "blk:<typ>" aus.
  const blkWrap = (type: string, node: ReactNode) => {
    if (!node) return null;
    if (!onSelectSection || !docSections) return <Fragment key={type}>{node}</Fragment>;
    const on = selectedUid === `blk:${type}`;
    return (
      <div
        key={type}
        className={`pm-blk ${on ? "pm-blk-on" : ""}`}
        onClick={(e) => { e.stopPropagation(); onSelectSection(`blk:${type}`); }}
      >
        {node}
      </div>
    );
  };

  // Rendert einen einzelnen Kaufbox-Baustein — konfigurationsgesteuert:
  // Reihenfolge/Sichtbarkeit + Style-Art (Preset) + Texte je Baustein.
  // Die Preset-Settings kommen aus derselben Auflösung wie der Download.
  function renderBlock(type: string) {
    if (!data) return null;
    const s = bs(type);
    switch (type) {
      case "sale_banner": {
        const txt = bt("sale_banner", "text", "");
        const emoji = bt("sale_banner", "emoji", "");
        return (
          <div
            className="pm-sale"
            style={{
              background: str(s.bg, colors.accent),
              color: str(s.t_color, "#ffffff"),
              borderRadius: num(s.radius, 12),
              border: num(s.b_width, 0) > 0 ? `${num(s.b_width, 0)}px solid ${str(s.b_color, colors.accent)}` : "none",
            }}
          >
            {emoji} {txt} {emoji}
          </div>
        );
      }
      case "urgency_text": {
        const user = buyboxCfg[type]?.texts?.text_prefix?.trim();
        const dateTail = (data.offerEndText.match(/\S+\s\S+$/) || [""])[0];
        const txt = user ? `${user} ${dateTail}`.trim() : data.offerEndText;
        return txt ? (
          <div
            className="pm-offer"
            style={{
              fontSize: num(s.font_size, 11.5),
              fontWeight: s.is_bold === false ? 500 : 700,
              fontStyle: s.is_italic === true ? "italic" : undefined,
              display: str(s.alignment, "left") === "left" ? "inline-block" : "block",
              textAlign: str(s.alignment, "left") as CSSProperties["textAlign"],
            }}
          >
            🔥 {txt}
          </div>
        ) : null;
      }
      case "custom_title":
        return (
          <h1
            className="pm-title"
            style={{
              fontSize: num(s.font_size_desktop, 27),
              fontWeight: Number(str(s.font_weight, "800")),
              textAlign: str(s.alignment, "left") as CSSProperties["textAlign"],
            }}
          >
            {data.title}
          </h1>
        );
      case "custom_rating": {
        const layout = str(s.layout_style, "stars_first");
        const starColor = str(s.star_color, colors.accent);
        const glow = str(s.star_style, "filled") === "glow";
        const stars = (
          <span className="pm-stars" style={{ color: starColor, textShadow: glow ? `0 0 8px ${starColor}` : undefined }}>
            ★★★★★
          </span>
        );
        const inner =
          layout === "number_first" ? (
            <><strong>{data.ratingValue}</strong>{stars}<span>· {bt(type, "rating_text", data.ratingText)}</span></>
          ) : (
            <>{stars}<strong>{data.ratingValue}</strong><span>· {bt(type, "rating_text", data.ratingText)}</span></>
          );
        return (
          <div
            className="pm-rating"
            style={{
              justifyContent: str(s.alignment, "flex-start") as CSSProperties["justifyContent"],
              ...(layout === "compact_pill"
                ? { background: `color-mix(in srgb, ${starColor} 12%, transparent)`, borderRadius: 100, padding: "5px 12px", width: "fit-content" }
                : {}),
            }}
          >
            {inner}
          </div>
        );
      }
      case "benefits_list": {
        const styleMap: Record<string, string> = {
          dark_circle: "pm-bl-dark", accent_circle: "pm-bl-accent",
          soft_circle: "pm-bl-soft", outlined: "pm-bl-outline", emoji: "pm-bl-emoji",
        };
        const cls = styleMap[str(s.icon_style, "")] || "";
        return (
          <div className={`pm-benefits ${cls}`} style={{ gap: num(s.item_gap, 10) }}>
            {data.benefits.slice(0, 4).map((b, i) => (
              <div key={i} className="pm-benefit" style={{ fontSize: num(s.font_size, 13.5) }}>
                <span className="pm-bic"><BIcon id={benefitIcons[i] || DEFAULT_BENEFIT_ICONS[i] || "check"} /></span>
                {bt(type, `text_${i + 1}`, b.text)}
              </div>
            ))}
          </div>
        );
      }
      case "stock_indicator":
        return (
          <div
            className="pm-stock"
            style={{
              justifyContent: str(s.alignment, "flex-start") as CSSProperties["justifyContent"],
              fontWeight: Number(str(s.font_weight, "700")),
              fontSize: num(s.font_size, 12.5),
            }}
          >
            <span className="pm-dot" />
            {bt(type, "text", data.stock)}
          </div>
        );
      case "variant_picker":
        return (
          <div className="pm-variants">
            <span className="pm-var-label">Variante wählen</span>
            <div className="pm-var-row">
              {["Standard", "Premium", "Deluxe"].map((v, i) => (
                <button key={v} className={`pm-var ${i === variantIdx ? "on" : ""}`} onClick={() => setVariantIdx(i)}>{v}</button>
              ))}
            </div>
          </div>
        );
      case "custom_divider":
        return <div className="pm-divider" />;
      case "text": {
        const style = str(s.text_style, "body");
        return (
          <p
            className="pm-freetext"
            style={style === "uppercase" ? { textTransform: "uppercase", letterSpacing: ".06em", fontSize: 11.5, fontWeight: 700, opacity: 0.8 } : style === "subtitle" ? { fontSize: 14.5, opacity: 0.85 } : undefined}
          >
            {bt(type, "text", "")}
          </p>
        );
      }
      case "custom_accordion":
        return (
          <div className="pm-acc">
            <button className="pm-acc-head" onClick={() => setFaqOpen((o) => !o)}>
              <span className="pm-acc-lead">
                {str(s.icon, "none") !== "none" && <span className="pm-acc-dot">i</span>}
                {bt(type, "heading", "")}
              </span>
              <span className="pm-faq-plus">{faqOpen ? "−" : "+"}</span>
            </button>
            {faqOpen && <div className="pm-acc-body">{bt(type, "content", "")}</div>}
          </div>
        );
      case "custom_price": {
        const showBadge = s.show_badge !== false;
        const showCompare = s.show_compare !== false;
        return (
          <>
            <div className="pm-divider" />
            <div
              className="pm-price"
              style={{ justifyContent: str(s.alignment, "left") === "center" ? "center" : str(s.alignment, "left") === "right" ? "flex-end" : "flex-start" }}
            >
              <strong style={{ fontSize: num(s.price_size_desk, 31), fontWeight: Number(str(s.price_weight, "800")) }}>{data.price}</strong>
              {showCompare && <s>{data.comparePrice}</s>}
              {showBadge && <span className="pm-save">{data.discount}</span>}
            </div>
          </>
        );
      }
      case "bundle_selector": {
        const cardStyle = str(s.card_style, "modern");
        const showImage = s.show_image !== false && cardStyle !== "classic";
        const showSave = s.show_savings !== false;
        const showPer = s.show_per_unit !== false;
        const showQty = s.show_qty_chip !== false;
        const cardRadius = typeof s.card_radius === "number" ? Math.min(28, s.card_radius as number) : undefined;
        return (
          <>
            <div className="pm-bundle-head">{bt(type, "heading", data.bundleHeading)}</div>
            <div className="pm-bundles">
              {data.bundles.map((b, i) => (
                <button
                  key={i}
                  className={`pm-bundle pm-bundle--${cardStyle} ${i === bundleIdx ? "on" : ""}`}
                  style={cardRadius !== undefined ? { borderRadius: cardRadius } : undefined}
                  onClick={() => setBundleIdx(i)}
                >
                  {b.badge && <span className="pm-bundle-badge">{b.badge}</span>}
                  <span className="pm-radio" />
                  {showImage && (b.image ? <img className="pm-bundle-img" src={b.image} alt="" /> : <span className="pm-bundle-img" />)}
                  <span className="pm-bundle-main">
                    <span className="pm-bundle-name">{showQty && <span className="pm-qty">×{b.qty}</span>} {b.name}</span>
                    {showPer && b.perUnit && <span className="pm-bundle-per">{b.perUnit}</span>}
                    {showSave && <span className="pm-bundle-save">{b.save}</span>}
                  </span>
                  <span className="pm-bundle-right">
                    <span className="pm-bundle-price">{b.price}</span>
                    <s className="pm-bundle-comp">{b.compareTotal}</s>
                  </span>
                </button>
              ))}
            </div>
          </>
        );
      }
      case "buy_buttons": {
        const size = str(s.cart_size, "lg");
        const pad = { sm: 10, md: 12, lg: 15, xl: 19 }[size] ?? 15;
        const fs = { sm: 13, md: 14, lg: 15.5, xl: 18 }[size] ?? 15.5;
        const icon = str(s.cart_icon, "cart");
        const combo = str(s.layout, "layout1") === "layout2";
        const iconSvg =
          icon === "none" ? null : icon === "plus" ? (
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6h15l-1.5 9h-12z" /><path d="M6 6 5 3H2" /><circle cx="9" cy="20" r="1.6" /><circle cx="18" cy="20" r="1.6" /></svg>
          );
        const radiusStyle = str(s.btn_shape, "") === "pill" ? { borderRadius: 999 } : str(s.btn_shape, "") === "sharp" ? { borderRadius: 0 } : {};
        const subtext = bt(type, "subtext", "");
        return (
          <>
            <button className="pm-cta" style={{ padding: pad, fontSize: fs, background: str(s.primary_bg, colors.button), color: str(s.primary_fg, colors.buttonText), ...radiusStyle }}>
              {iconSvg}
              {bt(type, "add_to_cart_text", data.cta)}
            </button>
            {combo && (
              <div className="pm-combo">
                <span className="pm-combo-btn" style={{ background: "#ffc439", color: "#003087" }}><b style={{ fontStyle: "italic" }}>Pay<span style={{ color: "#0070e0" }}>Pal</span></b></span>
                <span className="pm-combo-btn" style={{ background: "#ffb3c7", color: "#0a0a0a" }}><b>Klarna.</b></span>
              </div>
            )}
            {subtext && (
              <div className="pm-cta-sub">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 11h14v9H5z" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                {subtext}
              </div>
            )}
          </>
        );
      }
      case "payment_icons": {
        const w = num(s.icon_width, 44);
        return (
          <>
            <div className="pm-pay-head">{bt(type, "heading", data.payHeading)}</div>
            <div className="pm-pay" style={{ justifyContent: str(s.alignment, "center") as CSSProperties["justifyContent"], gap: num(s.icon_gap, 7) }}>
              {PAY_ORDER.map((p) => (
                <span key={p} className="pm-pay-box" style={{ minWidth: w, height: Math.round(w * 0.64) }}><PayMark name={p} /></span>
              ))}
            </div>
          </>
        );
      }
      case "free_gift": {
        // Angebots-/Geschenk-Box (Text). Optik identisch zur Shop-Runtime
        // (.bspx-gift) — das eigentliche Gratis-Produkt legt der Kunde in
        // Shopify fest.
        const ac = str(s.accent_color, colors.accent);
        return (
          <div className="pm-gift2" style={{ borderColor: `color-mix(in srgb,${ac} 35%,transparent)` }}>
            <span className="pm-gift2-ic" style={{ background: ac }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h16v8H4z" /><path d="M3 8h18v4H3z" /><path d="M12 8v12" /><path d="M12 8C10 8 8 6.5 9 5.2s3 2.8 3 2.8" /><path d="M12 8c2 0 4-1.5 3-2.8s-3 2.8-3 2.8" /></svg>
            </span>
            <span className="pm-gift2-txt">
              <strong>{bt(type, "title", data.giftTitle)}</strong>
              <em>{bt(type, "subtitle", data.giftSubtitle)}</em>
            </span>
          </div>
        );
      }
      case "delivery_timeline": {
        const outlined = str(s.circle_style, "filled") === "outlined";
        const size = Math.round((num(s.circle_size, 56) / 56) * 35);
        const circleStyle: CSSProperties = outlined
          ? { background: "transparent", border: `2px solid ${str(s.circle_border, colors.accent)}`, color: str(s.icon_color, colors.accent), width: size, height: size }
          : { background: str(s.circle_bg, colors.accent), color: str(s.icon_color, "#fff"), width: size, height: size };
        return (
          <>
            <div className="pm-countdown">
              {data.countdownPrefix} <strong style={{ color: str(s.countdown_color, colors.accent) }}>{data.countdown}</strong> {data.countdownSuffix}
            </div>
            <div className="pm-timeline">
              {data.timeline.map((st, i) => (
                <div key={i} className="pm-step">
                  <span className="pm-step-ic" style={circleStyle}><Ic d={ICON[st.icon] || ICON.bag} s={17} /></span>
                  <span className="pm-step-label">{bt(type, `label_${i + 1}`, st.label)}</span>
                  <span className="pm-step-date">{st.date}</span>
                </div>
              ))}
            </div>
          </>
        );
      }

      // ── Neue Kaufbox-Bausteine ──
      case "description":
        return (
          <div className="pm-desc">
            <p>Hochwertige Materialien, durchdachtes Design und eine Verarbeitung, die überzeugt — entwickelt für deinen Alltag. Alle Details, Maße und Pflegehinweise findest du hier.</p>
            <span className="pm-desc-more">Mehr anzeigen</span>
          </div>
        );
      case "feature_box": {
        const cols = Math.max(1, Math.min(3, num(s.columns, 3)));
        const cardStyle = str(s.card_style, "elevated");
        const items = [1, 2, 3].slice(0, cols === 2 ? 2 : 3).map((n) => ({
          title: bt(type, `title_${n}`, ""),
          text: bt(type, `text_${n}`, ""),
        }));
        return (
          <div className={`pm-fbx pm-fbx--${cardStyle}`} style={{ gridTemplateColumns: `repeat(${cols},1fr)`, ...(typeof s.card_radius === "number" ? {} : {}) }}>
            {items.map((it, i) => (
              <div key={i} className="pm-fbx-card" style={cardStyle === "outlined" ? { borderColor: str(s.card_border, colors.accent) } : undefined}>
                <span className="pm-fbx-ic" style={{ background: `color-mix(in srgb, ${str(s.accent_color, colors.accent)} 14%, transparent)`, color: str(s.accent_color, colors.accent) }}>✦</span>
                <strong>{it.title}</strong>
                <em>{it.text}</em>
              </div>
            ))}
          </div>
        );
      }
      case "icon-with-text": {
        const vertical = str(s.layout, "horizontal") === "vertical";
        const iconMap: Record<string, string> = { truck: "truck", return: "rotate", lock: "lock", heart: "heart", leaf: "leaf", star: "star" };
        const items = [1, 2, 3].map((n) => ({
          heading: bt(type, `heading_${n}`, ""),
          icon: iconMap[str(s[`icon_${n}`], "")] || "check",
        }));
        return (
          <div className={`pm-iwt ${vertical ? "pm-iwt-v" : ""}`}>
            {items.map((it, i) => (
              <span key={i} className="pm-iwt-item">
                <span className="pm-iwt-ic"><BIcon id={it.icon} /></span>
                {it.heading}
              </span>
            ))}
          </div>
        );
      }
      case "collapsible_tab":
        return (
          <div className="pm-acc">
            <button className="pm-acc-head">
              <span className="pm-acc-lead"><span className="pm-acc-dot">i</span>{bt(type, "heading", "")}</span>
              <span className="pm-faq-plus">+</span>
            </button>
          </div>
        );
      case "complementary": {
        const items = (data.images.length ? data.images : [""]).slice(0, 2);
        return (
          <div className="pm-comp">
            <div className="pm-comp-head">{bt(type, "block_heading", "")}</div>
            <div className="pm-comp-row">
              {items.map((u, i) => (
                <div key={i} className="pm-comp-card">
                  <span className="pm-comp-img">{u ? <img src={u} alt="" /> : <span />}</span>
                  <span className="pm-comp-main">
                    <span className="pm-comp-title">{data.title}</span>
                    <span className="pm-comp-price">{data.price}</span>
                  </span>
                  <span className="pm-comp-add">+</span>
                </div>
              ))}
            </div>
          </div>
        );
      }
      case "quantity_selector":
        return (
          <div className="pm-qtysel">
            <span className="pm-var-label">Menge</span>
            <span className="pm-qty-box"><button>−</button><b>1</b><button>+</button></span>
          </div>
        );
      case "share":
        return (
          <span className="pm-share">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v13" /></svg>
            {bt(type, "share_label", "")}
          </span>
        );

      // ── NEU: Runtime-Bausteine (Preview identisch zur Shop-Runtime) ──
      case "trust_badges": {
        const style = str(s.style, "cards");
        const ic = ["truck", "rotate", "lock", "star"];
        const items = [1, 2, 3, 4].map((n) => bt(type, `label_${n}`, "")).filter(Boolean);
        return (
          <div className={`pm-tb pm-tb--${style}`}>
            {items.map((label, i) => (
              <div key={i} className="pm-tb-item">
                <span className="pm-tb-ic" style={{ color: str(s.accent, colors.accent) }}><BIcon id={ic[i] || "check"} /></span>
                <span className="pm-tb-lbl">{label}</span>
              </div>
            ))}
          </div>
        );
      }
      case "stock_bar": {
        const level = Math.max(6, Math.min(60, num(s.level, 20)));
        const col = str(s.color, "#e0332f");
        return (
          <div className="pm-sbar">
            <div className="pm-sbar-top">
              <span>🔥 {bt(type, "text", "")}</span>
              <strong style={{ color: col }}>{bt(type, "left", "8")}</strong>
            </div>
            <div className="pm-sbar-track"><span className="pm-sbar-fill" style={{ width: `${level}%`, background: col }} /></div>
          </div>
        );
      }
      case "guarantee": {
        const style = str(s.style, "box");
        const ac = str(s.accent, colors.accent);
        return (
          <div className={`pm-guar pm-guar--${style}`} style={style === "accent" ? { background: `color-mix(in srgb,${ac} 10%,var(--pv-bg))`, borderColor: `color-mix(in srgb,${ac} 30%,transparent)` } : undefined}>
            <span className="pm-guar-ic" style={{ color: ac }}>
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V6z" /><path d="M9 12l2 2 4-4" /></svg>
            </span>
            <span className="pm-guar-txt">
              <strong>{bt(type, "title", "")}</strong>
              <em>{bt(type, "subtitle", "")}</em>
            </span>
          </div>
        );
      }
      case "highlights": {
        const style = str(s.style, "accent");
        const ac = str(s.accent, colors.accent);
        const items = [1, 2, 3, 4, 5].map((n) => bt(type, `item_${n}`, "")).filter(Boolean);
        return (
          <div className={`pm-hl pm-hl--${style}`}>
            {items.map((it, i) => (
              <div key={i} className="pm-hl-item">
                <span className="pm-hl-check" style={{ color: style === "circle" ? "#fff" : ac, background: style === "circle" ? ac : "transparent" }}>
                  {style === "arrow" ? "›" : <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                </span>
                {it}
              </div>
            ))}
          </div>
        );
      }
      case "social_proof": {
        const style = str(s.style, "viewers");
        const ac = str(s.accent, colors.accent);
        const icon = style === "sold" ? "🛒" : style === "trending" ? "🔥" : "👀";
        return (
          <div className="pm-sp">
            <span className="pm-sp-ic" style={{ background: `color-mix(in srgb,${ac} 14%,transparent)` }}>{icon}</span>
            <span className="pm-sp-txt"><strong>{bt(type, "count", "17")}</strong> {style === "sold" ? "heute verkauft" : bt(type, "text", "sehen sich das gerade an")}</span>
            <span className="pm-sp-dot" />
          </div>
        );
      }
      case "countdown_timer": {
        const col = str(s.color, "#e0332f");
        const cells: [string, string][] = [["05", "Std"], ["23", "Min"], ["14", "Sek"]];
        return (
          <div className="pm-cdt">
            <span className="pm-cdt-label">⏰ {bt(type, "text", "Angebot endet in")}</span>
            <div className="pm-cdt-boxes">
              {cells.map(([d, l], i) => (
                <span key={i} className="pm-cdt-cell" style={{ background: col }}><b>{d}</b><em>{l}</em></span>
              ))}
            </div>
          </div>
        );
      }
      case "press_bar": {
        const style = str(s.style, "plain");
        const labels = [1, 2, 3, 4].map((n) => bt(type, `label_${n}`, "")).filter(Boolean);
        return (
          <div className={`pm-press pm-press--${style}`}>
            <span className="pm-press-h">{bt(type, "heading", "Bekannt aus")}</span>
            <div className="pm-press-row">
              {labels.map((l, i) => <span key={i} className="pm-press-item">{l}</span>)}
            </div>
          </div>
        );
      }
      case "spec_list": {
        const style = str(s.style, "lines");
        const rows = [1, 2, 3]
          .map((n) => ({ l: bt(type, `label_${n}`, ""), v: bt(type, `value_${n}`, "") }))
          .filter((r) => r.l || r.v);
        return (
          <div className={`pm-spec pm-spec--${style}`}>
            {rows.map((r, i) => (
              <div key={i} className="pm-spec-row"><span className="pm-spec-l">{r.l}</span><span className="pm-spec-v">{r.v}</span></div>
            ))}
          </div>
        );
      }
      default:
        return null;
    }
  }

  return (
    <div className="pm-root" style={rootStyle}>
      <style>{CSS}</style>
      {previewBlock && data ? (
        // Einzelbaustein-Modus (Baustein-Galerie): rendert genau EINEN Baustein
        // — pixelgleich zur echten Kaufbox, ohne Canvas/Galerie/Sektionen.
        <div className={`pm-single pm-ic-${iconStyle}`} style={{ background: "var(--pv-bg)", color: "var(--pv-text)", fontFamily: "var(--pv-b)", padding: "18px 22px", borderRadius: 12 }}>
          <div className="pm-info">{renderBlock(previewBlock)}</div>
        </div>
      ) : (
      <div ref={outerRef} className="pm-outer">
      <div className="pm-frame" style={{ width: Math.round(targetW * box.scale) || undefined, height: box.height || undefined }}>
      <div ref={canvasRef} className={`pm-canvas pm-${viewMode} pm-ic-${iconStyle}`} style={{ width: targetW, transform: `scale(${box.scale})` }}>
      <div className="pm-bar">
        <div className="pm-dots"><span /><span /><span /></div>
        <span className="pm-tab">{label}</span>
        <div className="pm-url">{loading && <span className="pm-spin" />}dein-shop.de</div>
      </div>

      {!data ? (
        <div className="pm-empty">{loading ? "Lädt…" : "—"}</div>
      ) : (
        <div className="pm-stage">
          {page !== "home" && (
          <div className="pm-grid">
            {/* Galerie — Layout/Format/Pfeile/Zähler aus dem Galerie-Preset */}
            <div className={`pm-gallery ${galLeft ? "pm-gal-left" : ""}`}>
              {galLeft && data.images.length > 1 && (
                <div className="pm-thumbs pm-thumbs-rail">
                  {data.images.slice(0, 5).map((u, i) => (
                    <button key={i} className={`pm-thumb ${i === imgIdx ? "on" : ""}`} onClick={() => setImgIdx(i)}>
                      <img src={u} alt="" />
                    </button>
                  ))}
                </div>
              )}
              <div className="pm-gal-main">
                <div className="pm-main" style={{ aspectRatio: galRatio }}>
                  {galBadge && <span className="pm-badge">{galBadge}</span>}
                  {img ? <img src={img} alt="" /> : <div className="pm-noimg">Produktbild</div>}
                  {galArrows && imgCount > 1 && (
                    <>
                      <button className="pm-arrow pm-arrow-l" onClick={() => stepImg(-1)} aria-label="zurück">‹</button>
                      <button className="pm-arrow pm-arrow-r" onClick={() => stepImg(1)} aria-label="weiter">›</button>
                    </>
                  )}
                  {galCounter && imgCount > 0 && <span className="pm-counter">{imgIdx + 1} / {imgCount}</span>}
                </div>
                {!galLeft && data.images.length > 1 && (
                  <div className="pm-thumbs">
                    {data.images.slice(0, 5).map((u, i) => (
                      <button key={i} className={`pm-thumb ${i === imgIdx ? "on" : ""}`} onClick={() => setImgIdx(i)}>
                        <img src={u} alt="" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Infospalte — konfigurationsgesteuert (Reihenfolge + Sichtbarkeit) */}
            <div
              className={`pm-info ${onSelectSection ? "pm-selectable" : ""} ${selectedUid === "__buybox" ? "pm-selected" : ""}`}
              onClick={onSelectSection ? (e) => { e.stopPropagation(); onSelectSection("__buybox"); } : undefined}
            >
              {order.filter((t) => !hiddenBlk.has(t)).map((t) => blkWrap(t, renderBlock(t)))}
            </div>
          </div>
          )}

          {/* ── Editor-Modus: dokumentgesteuerte Sections + Einfüge-Punkte ── */}
          {docSections
            ? (
              <>
                {onInsertAt && <InsertBar onClick={() => onInsertAt(0)} />}
                {docSections.map((inst, i) => (
                  <Fragment key={inst.uid}>
                    <div
                      data-section-uid={inst.uid}
                      className={`pm-docsec ${onSelectSection ? "pm-selectable" : ""} ${selectedUid === inst.uid ? "pm-selected" : ""}`}
                      onClick={onSelectSection ? (e) => { e.stopPropagation(); onSelectSection(inst.uid); } : undefined}
                    >
                      <SectionReplica
                        instance={inst}
                        ctx={{ images: data.images, title: data.title, price: data.price, palette: colors }}
                      />
                    </div>
                    {onInsertAt && <InsertBar onClick={() => onInsertAt(i + 1)} />}
                  </Fragment>
                ))}
              </>
            )
            : /* Legacy-Modus: feste Produktseiten-Sektionen (alter Builder) */
          PRODUCT_SECTIONS.map((sec) => {
            if (hidden.has(sec.type)) return null;
            const h = sectionHeadings[sec.type] || sec.defaultHeading;
            if (sec.type === "reviews2") {
              return (
                <div key={sec.type} className="pm-sec">
                  <h2 className="pm-sec-h">{h}</h2>
                  <div className="pm-rev-sum"><span className="pm-stars">★★★★★</span> <strong>4.9</strong> <span>· 361 Bewertungen</span></div>
                  <div className="pm-rev-grid">
                    {PV_REVIEWS.map((r, i) => (
                      <div key={i} className="pm-rev-card">
                        <span className="pm-stars">★★★★★</span>
                        <p className="pm-rev-q">„{r.q}"</p>
                        <span className="pm-rev-a">{r.a} · {r.l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            if (sec.type === "bro-info-tabs") {
              return (
                <div key={sec.type} className="pm-sec">
                  <h2 className="pm-sec-h">{h}</h2>
                  <div className="pm-faq">
                    {PV_FAQ.map((f, i) => (
                      <div key={i} className="pm-faq-item">
                        <div className="pm-faq-q"><span>{f.q}</span><span className="pm-faq-plus">+</span></div>
                        <div className="pm-faq-a">{f.a}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            if (sec.type === "brospify-hero") {
              return (
                <div key={sec.type} className="pm-sec pm-brand">
                  <div className="pm-brand-media">{data.images[1] ? <img src={data.images[1]} alt="" /> : <div className="pm-noimg">Bild</div>}</div>
                  <div className="pm-brand-txt">
                    <h2 className="pm-sec-h" style={{ textAlign: "left", marginBottom: 10 }}>{h}</h2>
                    <p className="pm-brand-p">{PV_BRAND}</p>
                    <button className="pm-cta" style={{ maxWidth: 220 }}>Mehr erfahren</button>
                  </div>
                </div>
              );
            }
            if (sec.type === "vids") {
              return (
                <div key={sec.type} className="pm-sec">
                  <h2 className="pm-sec-h">{h}</h2>
                  <div className="pm-vids">
                    {(data.images.length ? data.images : [""]).slice(0, 3).map((u, i) => (
                      <div key={i} className="pm-vid">{u ? <img src={u} alt="" /> : <span />}<span className="pm-play">▶</span></div>
                    ))}
                  </div>
                </div>
              );
            }
            if (sec.type === "featured-collection") {
              return (
                <div key={sec.type} className="pm-sec">
                  <h2 className="pm-sec-h">{h}</h2>
                  <div className="pm-feat">
                    {(data.images.length ? data.images : [""]).slice(0, 4).map((u, i) => (
                      <div key={i} className="pm-feat-card">
                        <div className="pm-feat-img">{u ? <img src={u} alt="" /> : <span />}</div>
                        <span className="pm-feat-title">{data.title}</span>
                        <span className="pm-feat-price">{data.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
      </div>
      </div>
      </div>
      )}
    </div>
  );
}

// Einfüge-Punkt zwischen Sections (nur im Editor-Modus sichtbar).
function InsertBar({ onClick }: { onClick: () => void }) {
  return (
    <div className="pm-insert" role="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <span className="pm-insert-line" />
      <span className="pm-insert-btn">+ Section</span>
      <span className="pm-insert-line" />
    </div>
  );
}

const CSS = `
.pm-root{width:100%}
.pm-outer{position:relative;overflow-x:auto;overflow-y:hidden;width:100%;-webkit-overflow-scrolling:touch}
.pm-frame{position:relative;margin:0 auto;overflow:hidden;border-radius:12px}
.pm-canvas{position:absolute;top:0;left:0;transform-origin:top left;border:1px solid rgba(0,0,0,.08);border-radius:12px;overflow:hidden;background:#fbfbfc;box-shadow:0 16px 46px -24px rgba(0,0,0,.55)}
.pm-canvas,.pm-canvas *,.pm-canvas *::before,.pm-canvas *::after{box-sizing:border-box}
.pm-bar{display:flex;align-items:center;gap:12px;padding:7px 12px;background:#f2f2f4;border-bottom:1px solid rgba(0,0,0,.06)}
.pm-dots{display:flex;gap:5px}.pm-dots span{width:8px;height:8px;border-radius:50%;background:#d4d4d8}
.pm-tab{font-size:11px;font-weight:600;color:#1d1d1f;border-bottom:2px solid #1d1d1f;padding:2px 2px 4px}
.pm-url{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:10.5px;color:#9a9aa0;background:#fff;border:1px solid rgba(0,0,0,.05);border-radius:20px;padding:3px 12px}
.pm-spin{width:10px;height:10px;border-radius:50%;border:2px solid #e0e0e3;border-top-color:#86868b;animation:pm-rot .7s linear infinite}
@keyframes pm-rot{to{transform:rotate(360deg)}}
.pm-empty{height:360px;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:13px;background:#fafafa}

.pm-stage{background:var(--pv-bg);color:var(--pv-text);font-family:var(--pv-b);padding:24px}
.pm-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.08fr);gap:26px;align-items:start}

.pm-gallery{position:sticky;top:0}
.pm-main{position:relative;aspect-ratio:1;border-radius:var(--pv-r);overflow:hidden;background:color-mix(in srgb,var(--pv-text) 6%,var(--pv-bg))}
.pm-main img{width:100%;height:100%;object-fit:cover;display:block}
.pm-noimg{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:13px;opacity:.4}
.pm-badge{position:absolute;top:12px;left:12px;z-index:2;background:var(--pv-accent);color:#fff;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:5px 11px;border-radius:min(var(--pv-r),30px)}
.pm-thumbs{display:flex;gap:8px;margin-top:10px}
.pm-thumb{width:56px;height:56px;flex:0 0 auto;border-radius:min(var(--pv-r),12px);overflow:hidden;border:2px solid transparent;background:color-mix(in srgb,var(--pv-text) 6%,var(--pv-bg));cursor:pointer;padding:0}
.pm-thumb.on{border-color:var(--pv-accent)}
.pm-thumb img{width:100%;height:100%;object-fit:cover;display:block}

.pm-info{min-width:0;display:flex;flex-direction:column;gap:var(--pv-gap,15px)}
/* Einheitlicher AUSSEN-Abstand über flex-gap; interne Baustein-Abstände
   bleiben erhalten (nur der jeweils letzte Rand wird genullt) → Vorschau=Shop. */
.pm-info>*{margin-bottom:0!important}
.pm-blk>*:last-child{margin-bottom:0}
.pm-info>*>*:last-child{margin-bottom:0}
.pm-offer{display:inline-block;background:color-mix(in srgb,#d9534f 12%,var(--pv-bg));color:#d9534f;font-size:11.5px;font-weight:700;padding:5px 11px;border-radius:min(var(--pv-r),20px);margin-bottom:12px}
.pm-title{font-family:var(--pv-h);font-weight:800;font-size:27px;line-height:1.12;letter-spacing:-.02em;margin:0 0 10px}
.pm-rating{display:flex;align-items:center;gap:7px;font-size:12.5px;margin-bottom:16px;opacity:.9}
.pm-rating strong{font-weight:700}
.pm-stars{color:var(--pv-accent);letter-spacing:1px;font-size:14px}

.pm-benefits{display:flex;flex-direction:column;gap:10px;margin-bottom:16px}
.pm-benefit{display:flex;align-items:center;gap:11px;font-size:13.5px;font-weight:600}
.pm-bic{width:30px;height:30px;flex:0 0 auto;border-radius:50%;background:color-mix(in srgb,var(--pv-text) 88%,#000);display:inline-flex;align-items:center;justify-content:center;font-size:15px;line-height:1}

.pm-stock{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;margin-bottom:16px}
.pm-dot{width:9px;height:9px;border-radius:50%;background:#00c853;box-shadow:0 0 0 3px color-mix(in srgb,#00c853 25%,transparent)}
.pm-divider{height:1px;background:color-mix(in srgb,var(--pv-text) 12%,transparent);margin:0 0 16px}
.pm-variants{margin-bottom:14px}
.pm-var-label{display:block;font-size:12px;font-weight:700;margin-bottom:7px}
.pm-var-row{display:flex;gap:8px;flex-wrap:wrap}
.pm-var{font-size:12.5px;font-weight:600;padding:8px 14px;border-radius:min(var(--pv-r),40px);border:var(--pv-bd) solid color-mix(in srgb,var(--pv-text) 16%,transparent);background:color-mix(in srgb,var(--pv-text) 3%,var(--pv-bg));color:inherit;cursor:pointer;font-family:inherit}
.pm-var.on{border-color:var(--pv-accent);background:color-mix(in srgb,var(--pv-accent) 10%,var(--pv-bg));color:var(--pv-accent)}
.pm-freetext{font-size:13px;line-height:1.6;opacity:.72;margin:0 0 16px}
.pm-acc{border:var(--pv-bd) solid color-mix(in srgb,var(--pv-text) 12%,transparent);border-radius:min(var(--pv-r),14px);background:color-mix(in srgb,var(--pv-text) 2%,var(--pv-bg));margin-bottom:16px;overflow:hidden;box-shadow:var(--pv-shadow)}
.pm-acc-head{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;background:transparent;border:0;cursor:pointer;padding:13px 15px;font-family:inherit;color:inherit;font-size:13.5px;font-weight:700}
.pm-acc-body{padding:0 15px 14px;font-size:12.5px;line-height:1.55;opacity:.72}

.pm-price{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:18px}
.pm-price strong{font-family:var(--pv-h);font-size:31px;font-weight:800}
.pm-price s{opacity:.4;font-size:17px}
.pm-save{background:color-mix(in srgb,var(--pv-accent) 16%,transparent);color:var(--pv-accent);font-size:12px;font-weight:800;padding:3px 9px;border-radius:min(var(--pv-r),20px)}

.pm-bundle-head{font-family:var(--pv-h);font-weight:700;font-size:14px;margin-bottom:10px}
.pm-bundles{display:flex;flex-direction:column;gap:10px;margin-bottom:18px}
.pm-bundle{position:relative;display:flex;align-items:center;gap:12px;width:100%;text-align:left;cursor:pointer;background:color-mix(in srgb,var(--pv-text) 3%,var(--pv-bg));border:2px solid color-mix(in srgb,var(--pv-text) 12%,transparent);border-radius:min(var(--pv-r),16px);padding:13px 15px;font-family:inherit;color:inherit}
.pm-bundle.on{border-color:var(--pv-accent);background:color-mix(in srgb,var(--pv-accent) 7%,var(--pv-bg))}
.pm-bundle-badge{position:absolute;top:-9px;right:14px;background:var(--pv-accent);color:#fff;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;padding:2px 8px;border-radius:20px}
.pm-radio{width:19px;height:19px;flex:0 0 auto;border-radius:50%;border:2px solid color-mix(in srgb,var(--pv-text) 30%,transparent)}
.pm-bundle.on .pm-radio{border-color:var(--pv-accent);box-shadow:inset 0 0 0 3px var(--pv-bg),inset 0 0 0 9px var(--pv-accent)}
.pm-bundle-img{width:44px;height:44px;flex:0 0 auto;border-radius:min(var(--pv-r),10px);object-fit:cover;background:color-mix(in srgb,var(--pv-text) 7%,var(--pv-bg))}
.pm-bundle-main{display:flex;flex-direction:column;min-width:0;gap:1px}
.pm-bundle-name{font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pm-qty{background:color-mix(in srgb,var(--pv-text) 88%,#000);color:var(--pv-bg);font-size:10px;font-weight:800;padding:1px 5px;border-radius:5px;margin-right:3px}
.pm-bundle-per{font-size:11px;opacity:.55}
.pm-bundle-save{font-size:11px;font-weight:800;color:#16a34a}
.pm-bundle-right{margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;flex:0 0 auto}
.pm-bundle-price{font-size:15.5px;font-weight:800}
.pm-bundle-comp{font-size:11px;opacity:.4}

.pm-cta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;background:var(--pv-btn);color:var(--pv-btnText);border:0;font-family:var(--pv-b);font-weight:800;font-size:15.5px;padding:15px;border-radius:var(--pv-r);cursor:pointer;letter-spacing:.01em}
.pm-pay-head{text-align:center;font-size:11px;opacity:.55;margin:14px 0 8px;font-weight:600}
.pm-pay{display:flex;flex-wrap:wrap;gap:7px;justify-content:center;margin-bottom:18px}
.pm-pay-box{display:inline-flex;align-items:center;justify-content:center;min-width:44px;height:28px;padding:0 8px;background:#fff;border:1px solid rgba(0,0,0,.1);border-radius:5px;box-shadow:0 1px 2px rgba(0,0,0,.05)}

.pm-gift{border:1px solid color-mix(in srgb,var(--pv-text) 12%,transparent);border-radius:min(var(--pv-r),16px);background:color-mix(in srgb,var(--pv-text) 2%,var(--pv-bg));margin-bottom:18px;overflow:hidden}
.pm-gift-head{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:transparent;border:0;cursor:pointer;padding:13px 15px;font-family:inherit;color:inherit}
.pm-gift-txt{min-width:0}
.pm-gift-txt strong{display:block;font-size:13.5px;font-weight:700}
.pm-gift-txt em{display:block;font-size:11.5px;opacity:.6;font-style:normal;line-height:1.35}
.pm-gift-chev{margin-left:auto;flex:0 0 auto;transition:transform .2s;opacity:.6}
.pm-gift-chev.open{transform:rotate(180deg)}
.pm-gift-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;padding:0 15px 15px}
.pm-gift-card{position:relative;aspect-ratio:1;border-radius:min(var(--pv-r),12px);overflow:hidden;background:color-mix(in srgb,var(--pv-text) 7%,var(--pv-bg));border:1px solid color-mix(in srgb,var(--pv-text) 10%,transparent)}
.pm-gift-card img{width:100%;height:100%;object-fit:cover;display:block}
.pm-gift-ph{display:block;width:100%;height:100%}
.pm-gift-price{position:absolute;top:6px;right:6px;z-index:1;background:color-mix(in srgb,var(--pv-text) 88%,#000);color:var(--pv-bg);font-size:10px;font-weight:800;padding:2px 6px;border-radius:20px}
.pm-gift-check{position:absolute;bottom:6px;left:6px;width:16px;height:16px;border-radius:4px;background:#fff;border:1.5px solid rgba(0,0,0,.25)}

.pm-countdown{text-align:center;font-size:12.5px;font-weight:600;margin-bottom:10px}
.pm-countdown strong{color:var(--pv-accent)}
.pm-timeline{display:flex;justify-content:space-between;position:relative;padding:0 4px}
.pm-timeline:before{content:"";position:absolute;top:17px;left:16%;right:16%;height:2px;background:color-mix(in srgb,var(--pv-text) 14%,transparent)}
.pm-step{display:flex;flex-direction:column;align-items:center;gap:5px;position:relative;z-index:1;flex:1}
.pm-step-ic{width:35px;height:35px;border-radius:50%;background:var(--pv-accent);color:#fff;display:inline-flex;align-items:center;justify-content:center}
.pm-step-label{font-size:11.5px;font-weight:700}
.pm-step-date{font-size:10.5px;opacity:.55}

/* ── Zusätzliche Produktseiten-Sektionen (unter der Kaufbox) ── */
.pm-sec{margin-top:34px;padding-top:32px;border-top:1px solid color-mix(in srgb,var(--pv-text) 9%,transparent)}
.pm-sec-h{font-family:var(--pv-h);font-weight:800;font-size:22px;letter-spacing:-.02em;text-align:center;margin:0 0 18px}
.pm-rev-sum{display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;margin:-8px 0 18px;opacity:.85}
.pm-rev-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.pm-rev-card{background:color-mix(in srgb,var(--pv-text) 3%,var(--pv-bg));border:1px solid color-mix(in srgb,var(--pv-text) 10%,transparent);border-radius:min(var(--pv-r),16px);padding:16px}
.pm-rev-q{font-size:13px;line-height:1.5;margin:8px 0 10px;font-weight:500}
.pm-rev-a{font-size:11.5px;font-weight:700;opacity:.6}
.pm-faq{display:flex;flex-direction:column;gap:10px;max-width:640px;margin:0 auto}
.pm-faq-item{background:color-mix(in srgb,var(--pv-text) 3%,var(--pv-bg));border:1px solid color-mix(in srgb,var(--pv-text) 10%,transparent);border-radius:min(var(--pv-r),14px);padding:14px 16px}
.pm-faq-q{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13.5px;font-weight:700}
.pm-faq-plus{color:var(--pv-accent);font-size:18px;font-weight:400;flex:0 0 auto}
.pm-faq-a{font-size:12.5px;line-height:1.55;opacity:.7;margin-top:8px}
.pm-brand{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:center}
.pm-brand-media{aspect-ratio:4/3;border-radius:var(--pv-r);overflow:hidden;background:color-mix(in srgb,var(--pv-text) 7%,var(--pv-bg))}
.pm-brand-media img{width:100%;height:100%;object-fit:cover;display:block}
.pm-brand-p{font-size:14px;line-height:1.6;opacity:.78;margin:0 0 16px}
.pm-vids{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.pm-vid{position:relative;aspect-ratio:9/13;border-radius:min(var(--pv-r),16px);overflow:hidden;background:color-mix(in srgb,var(--pv-text) 8%,var(--pv-bg))}
.pm-vid img{width:100%;height:100%;object-fit:cover;display:block}
.pm-play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.9);color:#111;display:flex;align-items:center;justify-content:center;font-size:15px;padding-left:3px}
.pm-feat{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.pm-feat-card{display:flex;flex-direction:column;gap:6px}
.pm-feat-img{aspect-ratio:1;border-radius:min(var(--pv-r),14px);overflow:hidden;background:color-mix(in srgb,var(--pv-text) 7%,var(--pv-bg))}
.pm-feat-img img{width:100%;height:100%;object-fit:cover;display:block}
.pm-feat-title{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pm-feat-price{font-size:12.5px;font-weight:800}

.pm-mobile .pm-stage{padding:16px}
.pm-mobile .pm-grid{grid-template-columns:1fr;gap:16px}
.pm-mobile .pm-gallery{position:static}
.pm-mobile .pm-main{max-width:100%}
.pm-mobile .pm-title{font-size:24px}
.pm-mobile .pm-price strong{font-size:28px}
.pm-mobile .pm-bundle{padding:12px 13px;gap:10px}
.pm-mobile .pm-bundle-img{width:40px;height:40px}
.pm-mobile .pm-pay{gap:6px}
.pm-mobile .pm-rev-grid{grid-template-columns:1fr}
.pm-mobile .pm-vids{grid-template-columns:repeat(3,1fr)}
.pm-mobile .pm-feat{grid-template-columns:1fr 1fr}
.pm-mobile .pm-brand{grid-template-columns:1fr;gap:14px}
.pm-mobile .pm-sec-h{font-size:19px}

/* ── Design-Ausprägung (Schatten, Randstärke, Icon-Stil je Stil/Kunde) ── */
.pm-main,.pm-bundle,.pm-rev-card,.pm-faq-item,.pm-gift,.pm-vid,.pm-feat-img{box-shadow:var(--pv-shadow)}
.pm-rev-card,.pm-faq-item,.pm-gift,.pm-bundle{border-width:var(--pv-bd)}
.pm-ic-dark .pm-bic{background:color-mix(in srgb,var(--pv-text) 88%,#000);color:#fff}
.pm-ic-accent .pm-bic{background:var(--pv-accent);color:#fff}
.pm-ic-outline .pm-bic{background:transparent;border:2px solid var(--pv-accent);color:var(--pv-accent)}
.pm-ic-outline .pm-step-ic{background:transparent;border:2px solid var(--pv-accent);color:var(--pv-accent)}

/* ── Galerie-Varianten (Preset: Thumbnails links/unten, Pfeile, Zähler) ── */
.pm-gal-left{display:flex;gap:10px;align-items:flex-start}
.pm-gal-main{flex:1;min-width:0}
.pm-thumbs-rail{display:flex;flex-direction:column;gap:8px;margin-top:0}
.pm-arrow{position:absolute;top:50%;transform:translateY(-50%);z-index:2;width:34px;height:34px;border-radius:50%;border:0;background:rgba(255,255,255,.92);color:#111;font-size:20px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.18)}
.pm-arrow-l{left:10px}.pm-arrow-r{right:10px}
.pm-counter{position:absolute;bottom:10px;right:10px;z-index:2;background:rgba(0,0,0,.55);color:#fff;font-size:10.5px;font-weight:700;border-radius:20px;padding:3px 9px}
.pm-mobile .pm-gal-left{flex-direction:column}
.pm-mobile .pm-thumbs-rail{flex-direction:row;margin-top:10px}

/* ── Kaufbox v2: Baustein-Auswahl + neue Bausteine ── */
.pm-blk{border-radius:8px;outline:2px solid transparent;outline-offset:3px;transition:outline-color .15s;cursor:pointer}
.pm-blk:hover{outline-color:color-mix(in srgb,#95BF47 45%,transparent)}
.pm-blk-on{outline-color:#95BF47!important}
.pm-bl-dark .pm-bic{background:color-mix(in srgb,var(--pv-text) 88%,#000)!important;border:0!important;color:#fff!important}
.pm-bl-accent .pm-bic{background:var(--pv-accent)!important;border:0!important;color:#fff!important}
.pm-bl-soft .pm-bic{background:color-mix(in srgb,var(--pv-accent) 14%,transparent)!important;border:0!important;color:var(--pv-accent)!important}
.pm-bl-outline .pm-bic{background:transparent!important;border:2px solid var(--pv-accent)!important;color:var(--pv-accent)!important}
.pm-sale{text-align:center;font-weight:800;font-size:13px;letter-spacing:.03em;padding:10px 14px;margin-bottom:14px}
.pm-combo{display:flex;gap:8px;margin-top:8px}
.pm-combo-btn{flex:1;display:flex;align-items:center;justify-content:center;height:38px;border-radius:min(var(--pv-r),12px);font-size:13px}
.pm-bundle--soft{border-width:1px;background:color-mix(in srgb,var(--pv-text) 2%,var(--pv-bg))}
.pm-bundle--outlined{background:transparent}
.pm-bundle--classic{background:transparent;border-width:1px;padding:11px 13px}
.pm-desc{font-size:13px;line-height:1.6;opacity:.75;margin-bottom:16px}
.pm-desc p{margin:0 0 6px}
.pm-desc-more{font-size:12px;font-weight:700;text-decoration:underline;text-underline-offset:3px;opacity:.9;cursor:pointer}
.pm-fbx{display:grid;gap:10px;margin-bottom:16px}
.pm-fbx-card{display:flex;flex-direction:column;gap:4px;padding:14px;border-radius:min(var(--pv-r),16px);border:var(--pv-bd) solid color-mix(in srgb,var(--pv-text) 10%,transparent);background:color-mix(in srgb,var(--pv-text) 3%,var(--pv-bg))}
.pm-fbx--elevated .pm-fbx-card{box-shadow:0 8px 22px -12px rgba(0,0,0,.28);border-color:transparent}
.pm-fbx--glass .pm-fbx-card{background:color-mix(in srgb,var(--pv-bg) 55%,transparent);backdrop-filter:blur(6px)}
.pm-fbx--flat .pm-fbx-card{border-color:transparent;background:color-mix(in srgb,var(--pv-text) 5%,var(--pv-bg))}
.pm-fbx--outlined .pm-fbx-card{background:transparent;border-width:2px}
.pm-fbx-ic{width:26px;height:26px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;font-size:13px}
.pm-fbx-card strong{font-size:12.5px;font-weight:800}
.pm-fbx-card em{font-style:normal;font-size:11px;opacity:.65;line-height:1.4}
.pm-iwt{display:flex;gap:8px;margin-bottom:16px}
.pm-iwt-v{flex-direction:column}
.pm-iwt-item{flex:1;display:flex;align-items:center;gap:8px;font-size:11.5px;font-weight:700;background:color-mix(in srgb,var(--pv-text) 3%,var(--pv-bg));border:1px solid color-mix(in srgb,var(--pv-text) 9%,transparent);border-radius:min(var(--pv-r),12px);padding:9px 11px}
.pm-iwt-ic{width:26px;height:26px;flex:0 0 auto;border-radius:50%;background:color-mix(in srgb,var(--pv-accent) 13%,transparent);color:var(--pv-accent);display:inline-flex;align-items:center;justify-content:center}
.pm-acc-lead{display:flex;align-items:center;gap:9px;min-width:0}
.pm-acc-dot{width:22px;height:22px;flex:0 0 auto;border-radius:50%;background:color-mix(in srgb,var(--pv-accent) 14%,transparent);color:var(--pv-accent);font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;font-style:normal}
.pm-comp{border:1px solid color-mix(in srgb,var(--pv-text) 10%,transparent);border-radius:min(var(--pv-r),14px);padding:12px 13px;margin-bottom:16px;background:color-mix(in srgb,var(--pv-text) 2%,var(--pv-bg))}
.pm-comp-head{font-size:12.5px;font-weight:800;margin-bottom:9px}
.pm-comp-row{display:flex;flex-direction:column;gap:8px}
.pm-comp-card{display:flex;align-items:center;gap:10px}
.pm-comp-img{width:42px;height:42px;flex:0 0 auto;border-radius:min(var(--pv-r),10px);overflow:hidden;background:color-mix(in srgb,var(--pv-text) 7%,var(--pv-bg))}
.pm-comp-img img{width:100%;height:100%;object-fit:cover;display:block}
.pm-comp-main{display:flex;flex-direction:column;min-width:0;flex:1}
.pm-comp-title{font-size:11.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pm-comp-price{font-size:11.5px;font-weight:800}
.pm-comp-add{width:26px;height:26px;flex:0 0 auto;border-radius:8px;border:1.5px solid color-mix(in srgb,var(--pv-text) 20%,transparent);display:inline-flex;align-items:center;justify-content:center;font-weight:700}
.pm-qtysel{margin-bottom:14px}
.pm-qty-box{display:inline-flex;align-items:center;gap:14px;border:var(--pv-bd) solid color-mix(in srgb,var(--pv-text) 16%,transparent);border-radius:min(var(--pv-r),12px);padding:7px 13px}
.pm-qty-box button{background:none;border:0;color:inherit;font-size:15px;font-weight:700;cursor:pointer;padding:0}
.pm-qty-box b{font-size:13px}
.pm-share{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;opacity:.75;margin-bottom:14px;cursor:pointer}

/* ── NEU: Runtime-Bausteine (Optik identisch zur Shop-Runtime .bspx-) ── */
.pm-tb{display:flex;gap:8px;margin-bottom:16px}
.pm-tb--cards .pm-tb-item{flex:1;flex-direction:column;text-align:center;border:var(--pv-bd) solid color-mix(in srgb,var(--pv-text) 12%,transparent);border-radius:min(var(--pv-r),12px);padding:10px 6px;gap:6px;background:color-mix(in srgb,var(--pv-text) 2%,var(--pv-bg))}
.pm-tb--strip{background:color-mix(in srgb,var(--pv-text) 4%,var(--pv-bg));border-radius:min(var(--pv-r),12px);padding:12px 10px;justify-content:space-around}
.pm-tb-item{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:700;min-width:0}
.pm-tb--cards .pm-tb-lbl,.pm-tb--strip .pm-tb-lbl{white-space:normal}
.pm-tb-ic{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}
.pm-tb-lbl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.pm-sbar{margin-bottom:16px}
.pm-sbar-top{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;font-weight:700;margin-bottom:6px}
.pm-sbar-track{height:8px;border-radius:20px;background:color-mix(in srgb,var(--pv-text) 12%,transparent);overflow:hidden}
.pm-sbar-fill{display:block;height:100%;border-radius:20px}

.pm-guar{display:flex;align-items:center;gap:13px;margin-bottom:16px;border-radius:min(var(--pv-r),16px)}
.pm-guar--box{border:var(--pv-bd) solid color-mix(in srgb,var(--pv-text) 14%,transparent);padding:14px 16px;background:color-mix(in srgb,var(--pv-text) 2%,var(--pv-bg))}
.pm-guar--accent{padding:14px 16px;border:1px solid}
.pm-guar-ic{flex:0 0 auto;display:inline-flex}
.pm-guar-txt{min-width:0}
.pm-guar-txt strong{display:block;font-family:var(--pv-h);font-size:14px;font-weight:800}
.pm-guar-txt em{display:block;font-style:normal;font-size:12px;opacity:.7;line-height:1.45;margin-top:2px}

.pm-hl{display:flex;flex-direction:column;gap:9px;margin-bottom:16px}
.pm-hl-item{display:flex;align-items:flex-start;gap:10px;font-size:13.5px;font-weight:600;line-height:1.4}
.pm-hl-check{flex:0 0 auto;width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;margin-top:1px}
.pm-hl--arrow .pm-hl-check{background:transparent!important;font-size:18px}

.pm-sp{display:flex;align-items:center;gap:10px;margin-bottom:16px;font-size:12.5px;font-weight:600;border:var(--pv-bd) solid color-mix(in srgb,var(--pv-text) 10%,transparent);border-radius:min(var(--pv-r),14px);padding:9px 13px;background:color-mix(in srgb,var(--pv-text) 2%,var(--pv-bg))}
.pm-sp-ic{flex:0 0 auto;width:30px;height:30px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:15px}
.pm-sp-txt{flex:1;min-width:0}
.pm-sp-txt strong{font-weight:800}
.pm-sp-dot{flex:0 0 auto;width:9px;height:9px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 3px color-mix(in srgb,#22c55e 25%,transparent);animation:pm-pulse 1.6s ease-in-out infinite}
@keyframes pm-pulse{50%{box-shadow:0 0 0 6px color-mix(in srgb,#22c55e 10%,transparent)}}

.pm-cdt{display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:16px;text-align:center}
.pm-cdt-label{font-size:12.5px;font-weight:700}
.pm-cdt-boxes{display:flex;gap:8px}
.pm-cdt-cell{position:relative;min-width:46px;padding:9px 6px 15px;border-radius:min(var(--pv-r),12px);color:#fff;font-family:var(--pv-h);font-weight:800;font-size:20px;line-height:1}
.pm-cdt-cell b{font-weight:800}
.pm-cdt-cell em{position:absolute;left:0;right:0;bottom:4px;font-style:normal;font-weight:600;font-size:8.5px;opacity:.85;text-transform:uppercase;letter-spacing:.06em}

.pm-press{display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:16px;text-align:center}
.pm-press--strip{background:color-mix(in srgb,var(--pv-text) 4%,var(--pv-bg));border-radius:min(var(--pv-r),12px);padding:13px 10px}
.pm-press-h{font-size:10.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;opacity:.55}
.pm-press-row{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:12px 20px}
.pm-press-item{font-family:var(--pv-h);font-weight:800;font-size:15px;letter-spacing:.04em;opacity:.72;text-transform:uppercase}
.pm-press--accent .pm-press-item{color:var(--pv-accent);opacity:1}

.pm-spec{display:flex;flex-direction:column;margin-bottom:16px;font-size:13px}
.pm-spec--card{border:var(--pv-bd) solid color-mix(in srgb,var(--pv-text) 12%,transparent);border-radius:min(var(--pv-r),14px);padding:4px 14px;background:color-mix(in srgb,var(--pv-text) 2%,var(--pv-bg))}
.pm-spec-row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid color-mix(in srgb,var(--pv-text) 10%,transparent)}
.pm-spec--compact .pm-spec-row{padding:5px 0;border-bottom:none}
.pm-spec-row:last-child{border-bottom:none}
.pm-spec-l{font-weight:500;opacity:.6}
.pm-spec-v{font-weight:700;text-align:right}
.pm-gift2{display:flex;align-items:center;gap:13px;margin-bottom:16px;border:var(--pv-bd) solid;border-radius:min(var(--pv-r),16px);padding:13px 15px;background:color-mix(in srgb,var(--pv-text) 2%,var(--pv-bg))}
.pm-gift2-ic{flex:0 0 auto;width:38px;height:38px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center}
.pm-gift2-txt{min-width:0}
.pm-gift2-txt strong{display:block;font-family:var(--pv-h);font-size:14px;font-weight:800}
.pm-gift2-txt em{display:block;font-style:normal;font-size:12px;opacity:.7;line-height:1.45;margin-top:2px}
.pm-cta-sub{display:flex;align-items:center;justify-content:center;gap:6px;font-size:11.5px;font-weight:600;opacity:.6;margin-top:9px}
.pm-mobile .pm-tb--cards{flex-wrap:wrap}.pm-mobile .pm-tb--cards .pm-tb-item{flex:1 1 40%}

/* ── Editor-Modus: Auswahl-Rahmen + Einfüge-Punkte ── */
.pm-selectable{cursor:pointer;border-radius:10px;outline:2px solid transparent;outline-offset:4px;transition:outline-color .15s}
.pm-selectable:hover{outline-color:color-mix(in srgb,#95BF47 55%,transparent)}
.pm-selected{outline-color:#95BF47!important}
.pm-docsec{position:relative}
.pm-insert{display:flex;align-items:center;gap:10px;padding:7px 0;cursor:pointer;opacity:.28;transition:opacity .15s}
.pm-insert:hover{opacity:1}
.pm-insert-line{flex:1;height:2px;border-radius:2px;background:#95BF47}
.pm-insert-btn{font-size:11.5px;font-weight:800;color:#fff;background:#95BF47;border-radius:100px;padding:4px 13px;letter-spacing:.02em;box-shadow:0 4px 12px -4px rgba(149,191,71,.6)}
${REPLICA_CSS}
`;
