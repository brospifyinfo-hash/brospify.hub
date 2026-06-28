"use client";

import { useEffect, useState, type CSSProperties } from "react";

// ─────────────────────────────────────────────────────────────────
// Live-Vorschau des Produkt-Themes (Home + Produktseite).
//
// Rein clientseitiger, naturgetreuer Mock der wichtigsten Schablonen-Sections.
// Farben (5er-Palette) + Schrift kommen als CSS-Variablen → jede Änderung im
// Builder ist SOFORT sichtbar (kein Reload). Nutzt die echten Produktbilder
// und die Theme-Texte (echte KI-Texte falls vorhanden, sonst Fallbacks).
// Es ist bewusst kein 1:1-Shopify-Render (Liquid braucht Shopify), sondern
// eine treue, schöne Annäherung fürs Farb-/Schrift-/Bild-Gefühl.
// ─────────────────────────────────────────────────────────────────

export interface ThemeColors {
  button: string;
  buttonText: string;
  background: string;
  text: string;
  accent: string;
}

export interface PreviewData {
  title: string;
  price: string;
  comparePrice: string;
  images: string[];
  copy: Record<string, string>;
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
  if (typeof document === "undefined") return;
  if (document.getElementById("tpv-fonts")) return;
  const link = document.createElement("link");
  link.id = "tpv-fonts";
  link.rel = "stylesheet";
  link.href = GOOGLE_FONTS;
  document.head.appendChild(link);
}

const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><rect width='400' height='400' fill='%23e9e9ee'/><text x='50%' y='50%' font-family='sans-serif' font-size='20' fill='%23999' text-anchor='middle' dominant-baseline='middle'>Produktbild</text></svg>`,
  );

function Stars({ n = 5 }: { n?: number }) {
  return (
    <span className="tpv-stars" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ opacity: i < n ? 1 : 0.25 }}>
          ★
        </span>
      ))}
    </span>
  );
}

const Wave = ({ flip = false }: { flip?: boolean }) => (
  <svg className="tpv-wave" viewBox="0 0 1200 60" preserveAspectRatio="none" style={flip ? { transform: "rotate(180deg)" } : undefined}>
    <path d="M0,30 C300,70 900,-10 1200,30 L1200,60 L0,60 Z" fill="var(--pv-accent)" />
  </svg>
);

export default function ThemePreview({
  data,
  colors,
  font,
}: {
  data: PreviewData;
  colors: ThemeColors;
  font: string;
}) {
  const [page, setPage] = useState<"home" | "product">("home");
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    ensureFonts();
  }, []);

  const img = (i: number) => data.images[i] || data.images[0] || PLACEHOLDER;
  const cp = (key: string, fb = "") => {
    const v = data.copy?.[key];
    return v && !/^\[\[[A-Z0-9_]+\]\]$/.test(v) ? v : fb;
  };
  const html = (key: string, fb = "") => ({ __html: cp(key, fb) });

  const rootStyle = {
    ["--pv-button" as string]: colors.button,
    ["--pv-btext" as string]: colors.buttonText,
    ["--pv-bg" as string]: colors.background,
    ["--pv-text" as string]: colors.text,
    ["--pv-accent" as string]: colors.accent,
    ["--pv-font" as string]: FONT_FAMILY[font] || "sans-serif",
  } as CSSProperties;

  return (
    <div className="tpv-root" style={rootStyle}>
      <style>{CSS}</style>

      {/* Browser-Rahmen + Umschalter */}
      <div className="tpv-bar">
        <div className="tpv-dots"><span /><span /><span /></div>
        <div className="tpv-tabs">
          <button className={page === "home" ? "on" : ""} onClick={() => setPage("home")}>Startseite</button>
          <button className={page === "product" ? "on" : ""} onClick={() => setPage("product")}>Produktseite</button>
        </div>
        <div className="tpv-url">deinshop.de{page === "product" ? "/products" : ""}</div>
      </div>

      <div className="tpv-viewport">
        {/* Storefront-Header */}
        <header className="tpv-head">
          <span className="tpv-brand">{cp("BRAND_TITLE", "Dein Shop").split(" ").slice(0, 2).join(" ")}</span>
          <span className="tpv-cart">🛒</span>
        </header>

        {page === "home" ? (
          <>
            {/* Hero */}
            <section className="tpv-hero" style={{ backgroundImage: `url(${img(0)})` }}>
              <div className="tpv-hero-ov" />
              <div className="tpv-hero-in">
                <h1 className="tpv-h1" dangerouslySetInnerHTML={html("SLIDE_1_HEADING", data.title)} />
                <p className="tpv-sub">{cp("SLIDE_1_SUBHEADING", "Spürbar besser im Alltag — überzeug dich selbst.")}</p>
                <div className="tpv-boxes">
                  <div className="tpv-box">
                    <span>{cp("SLIDE_1_BOX1_LABEL", "Einzelpack")}</span>
                    <strong>{cp("SLIDE_1_BOX1_PRICE", data.price || "29,99€")}</strong>
                  </div>
                  <div className="tpv-box tpv-box-hot">
                    <span className="tpv-badge">{cp("SLIDE_1_BOX2_BADGE", "Beliebt")}</span>
                    <span>{cp("SLIDE_1_BOX2_LABEL", "Vorteilspack")}</span>
                    <strong>{cp("SLIDE_1_BOX2_PRICE", "49,99€")}</strong>
                  </div>
                </div>
                <button className="tpv-btn">{cp("SLIDE_1_BTN_TEXT", "JETZT ENTDECKEN")}</button>
              </div>
            </section>
            <Wave />

            {/* Benefits */}
            <section className="tpv-benefits">
              {[1, 2].map((i) => (
                <div key={i} className="tpv-benefit">
                  <div className="tpv-bicon">✓</div>
                  <div>
                    <div className="tpv-bt">{cp(`BENEFIT_${i}_TITLE`, i === 1 ? "Bequem auf Rechnung" : "Schneller DHL-Versand")}</div>
                    <div className="tpv-bd" dangerouslySetInnerHTML={html(`BENEFIT_${i}_TEXT`, "Sicher & schnell bei dir Zuhause.")} />
                  </div>
                </div>
              ))}
            </section>

            {/* Explanation */}
            <section className="tpv-explain">
              <span className="tpv-eyebrow">{cp("EXPLAIN_SUBTITLE", "Warum wir?")}</span>
              <h2 className="tpv-h2">{cp("EXPLAIN_TITLE", "So funktioniert's")}</h2>
              <p className="tpv-rich" dangerouslySetInnerHTML={html("EXPLAIN_TEXT", "Hochwertig, durchdacht und gemacht, um dein Problem wirklich zu lösen.")} />
            </section>

            {/* Brand + Bilder-Collage */}
            <section className="tpv-brand-sec">
              <div className="tpv-brand-txt">
                <span className="tpv-eyebrow">{cp("BRAND_SUBTITLE", "Unsere Marke")}</span>
                <h2 className="tpv-h2">{cp("BRAND_TITLE", "Qualität, die man spürt")}</h2>
                <p className="tpv-rich" dangerouslySetInnerHTML={html("BRAND_DESCRIPTION", "Wir entwickeln Produkte, die deinen Alltag wirklich verbessern.")} />
                <button className="tpv-btn tpv-btn-sm">{cp("BRAND_BUTTON_LABEL", "MEHR ENTDECKEN")}</button>
              </div>
              <div className="tpv-collage">
                <img src={img(1)} alt="" />
                <img src={img(2)} alt="" />
                <img src={img(0)} alt="" />
              </div>
            </section>

            {/* Reviews */}
            <section className="tpv-reviews">
              <div className="tpv-rev-head">
                <span className="tpv-hl">{cp("REVIEWS_HIGHLIGHT", "10.000+")}</span>
                <h2 className="tpv-h2">{cp("REVIEWS_HEADING", "KUNDEN LIEBEN ES")}</h2>
              </div>
              <div className="tpv-rev-cards">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="tpv-rev-card">
                    <Stars n={5} />
                    <p>{cp(`REVIEW2_${i}_QUOTE`, "Absolut überzeugt — klare Empfehlung!")}</p>
                    <span className="tpv-rev-author">— {cp(`REVIEW2_${i}_AUTHOR`, "Sarah M.")}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <>
            {/* Produkt: Galerie + Buy-Box */}
            <section className="tpv-pdp">
              <div className="tpv-gallery">
                <img className="tpv-gmain" src={img(activeImg)} alt="" />
                <div className="tpv-thumbs">
                  {(data.images.length ? data.images : [PLACEHOLDER]).slice(0, 5).map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt=""
                      className={i === activeImg ? "on" : ""}
                      onClick={() => setActiveImg(i)}
                    />
                  ))}
                </div>
              </div>

              <div className="tpv-buy">
                <span className="tpv-pbadge">{cp("PRODUCT_BADGE_TEXT", "BESTSELLER")}</span>
                <h1 className="tpv-ptitle">{data.title || cp("SLIDE_1_HEADING", "Dein Produkt")}</h1>
                <div className="tpv-rating"><Stars n={5} /> <span>{cp("PRODUCT_RATING_TEXT", "361 Bewertungen")}</span></div>
                <div className="tpv-price">
                  <strong>{data.price || "29,99€"}</strong>
                  {data.comparePrice && <s>{data.comparePrice}</s>}
                </div>
                <ul className="tpv-usps">
                  {[1, 2, 3, 4].map((i) => (
                    <li key={i}><span className="tpv-check">✓</span>{cp(`PRODUCT_USP_${i}`, ["Kostenloser Versand", "30 Tage Rückgabe", "Sichere Bezahlung", "Premium-Qualität"][i - 1])}</li>
                  ))}
                </ul>
                <div className="tpv-stock"><span className="tpv-dot" />{cp("PRODUCT_STOCK_TEXT", "Auf Lager")}</div>
                <div className="tpv-bundle-h">{cp("BUNDLE_HEADING", "Spare im Vorteilspack")}</div>
                <div className="tpv-bundle">
                  {[
                    { q: "1x", on: false },
                    { q: "2x", on: true, badge: cp("BUNDLE_OPT2_BADGE", "Am beliebtesten") },
                    { q: "3x", on: false },
                  ].map((b, i) => (
                    <div key={i} className={`tpv-bopt ${b.on ? "on" : ""}`}>
                      {b.badge && <span className="tpv-bopt-badge">{b.badge}</span>}
                      <strong>{b.q}</strong>
                    </div>
                  ))}
                </div>
                <button className="tpv-btn tpv-btn-cart">🛒 In den Warenkorb</button>
                <div className="tpv-pay">
                  {["VISA", "MC", "PayPal", "Klarna"].map((p) => (
                    <span key={p}>{p}</span>
                  ))}
                </div>
              </div>
            </section>

            {/* Accordion */}
            <section className="tpv-acc">
              <div className="tpv-acc-row">
                <span>{cp("ACCORDION_1_HEADING", "Produktinformationen")}</span>
                <span>＋</span>
              </div>
              <div className="tpv-acc-row">
                <span>{cp("ACCORDION_2_HEADING", "Versand & Lieferung")}</span>
                <span>＋</span>
              </div>
            </section>

            {/* Reviews (kompakt) */}
            <section className="tpv-reviews">
              <div className="tpv-rev-head">
                <span className="tpv-hl">{cp("P_REVIEWS_HIGHLIGHT", "10.000+")}</span>
                <h2 className="tpv-h2">{cp("P_REVIEWS_HEADING", "KUNDEN LIEBEN ES")}</h2>
              </div>
              <div className="tpv-rev-cards">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="tpv-rev-card">
                    <Stars n={5} />
                    <p>{cp(`P_REVIEW2_${i}_QUOTE`, "Top Qualität, schnelle Lieferung!")}</p>
                    <span className="tpv-rev-author">— {cp(`P_REVIEW2_${i}_AUTHOR`, "Tom K.")}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
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
.tpv-tabs button.on{background:var(--pv-accent);color:#fff}
.tpv-url{margin-left:auto;font-size:10px;color:#6b7280;background:#0d0d10;border-radius:20px;padding:3px 10px;max-width:40%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.tpv-viewport{height:540px;overflow-y:auto;background:var(--pv-bg);color:var(--pv-text)}
.tpv-viewport::-webkit-scrollbar{width:8px}.tpv-viewport::-webkit-scrollbar-thumb{background:rgba(0,0,0,.2);border-radius:4px}
.tpv-head{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid rgba(0,0,0,.07)}
.tpv-brand{font-weight:800;font-size:16px;letter-spacing:-.02em}
.tpv-cart{font-size:16px}
.tpv-hero{position:relative;min-height:300px;display:flex;align-items:center;background-size:cover;background-position:center}
.tpv-hero-ov{position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.62),rgba(0,0,0,.15))}
.tpv-hero-in{position:relative;padding:28px 24px;color:#fff;max-width:78%}
.tpv-h1{font-size:30px;line-height:1.1;font-weight:800;margin:0 0 8px;white-space:pre-line}
.tpv-sub{font-size:13px;opacity:.92;margin:0 0 14px;max-width:330px}
.tpv-boxes{display:flex;gap:10px;margin-bottom:16px}
.tpv-box{position:relative;background:rgba(20,20,20,.55);border:1px solid rgba(255,255,255,.4);border-radius:10px;padding:10px 14px;text-align:center;min-width:90px}
.tpv-box span{display:block;font-size:11px;opacity:.85}.tpv-box strong{display:block;font-size:16px;margin-top:2px}
.tpv-box-hot{border-color:var(--pv-accent)}
.tpv-badge{position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:var(--pv-accent);color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap}
.tpv-btn{background:var(--pv-button);color:var(--pv-btext);border:0;border-radius:30px;padding:12px 26px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;letter-spacing:.02em}
.tpv-btn-sm{padding:9px 20px;font-size:12px}
.tpv-wave{display:block;width:100%;height:46px;margin-top:-1px}
.tpv-benefits{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:22px 24px}
.tpv-benefit{display:flex;gap:10px;align-items:flex-start}
.tpv-bicon{width:34px;height:34px;border-radius:50%;background:var(--pv-accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;flex:0 0 auto}
.tpv-bt{font-weight:700;font-size:13px}.tpv-bd{font-size:11.5px;opacity:.7;margin-top:1px}
.tpv-explain{text-align:center;padding:30px 24px 24px}
.tpv-eyebrow{display:inline-block;color:var(--pv-accent);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;border-bottom:2px solid var(--pv-accent);padding-bottom:2px}
.tpv-h2{font-size:23px;font-weight:800;margin:4px 0 10px;letter-spacing:-.02em}
.tpv-rich{font-size:13px;line-height:1.6;opacity:.82;max-width:520px;margin:0 auto}
.tpv-brand-sec{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:center;padding:24px}
.tpv-brand-txt{text-align:left}.tpv-brand-txt .tpv-rich{margin:0 0 14px}
.tpv-collage{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:8px;height:230px}
.tpv-collage img{width:100%;height:100%;object-fit:cover;border-radius:10px}
.tpv-collage img:first-child{grid-row:1/3}
.tpv-reviews{padding:26px 24px;background:rgba(0,0,0,.03)}
.tpv-rev-head{text-align:center;margin-bottom:16px}
.tpv-hl{display:block;color:var(--pv-accent);font-size:26px;font-weight:800;line-height:1}
.tpv-rev-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.tpv-rev-card{background:#fff;border:1px solid rgba(0,0,0,.07);border-radius:12px;padding:14px;box-shadow:0 4px 14px rgba(0,0,0,.04)}
.tpv-rev-card p{font-size:12px;line-height:1.5;margin:8px 0 6px;color:#222}
.tpv-rev-author{font-size:11px;font-weight:700;color:#555}
.tpv-stars{color:var(--pv-accent);font-size:13px;letter-spacing:1px}
.tpv-pdp{display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:24px}
.tpv-gallery .tpv-gmain{width:100%;aspect-ratio:1;object-fit:cover;border-radius:14px;border:1px solid rgba(0,0,0,.06)}
.tpv-thumbs{display:flex;gap:8px;margin-top:8px}
.tpv-thumbs img{width:54px;height:54px;object-fit:cover;border-radius:8px;border:2px solid transparent;cursor:pointer;opacity:.7}
.tpv-thumbs img.on{border-color:var(--pv-accent);opacity:1}
.tpv-buy{display:flex;flex-direction:column}
.tpv-padge,.tpv-pbadge{align-self:flex-start;background:var(--pv-accent);color:#fff;font-size:9px;font-weight:700;padding:3px 9px;border-radius:6px;letter-spacing:.06em;margin-bottom:8px}
.tpv-ptitle{font-size:24px;font-weight:800;margin:0 0 6px;line-height:1.15}
.tpv-rating{display:flex;align-items:center;gap:6px;font-size:11px;opacity:.7;margin-bottom:8px}
.tpv-price{display:flex;align-items:baseline;gap:8px;margin-bottom:12px}
.tpv-price strong{font-size:26px;font-weight:800}.tpv-price s{opacity:.5;font-size:15px}
.tpv-usps{list-style:none;margin:0 0 12px;padding:0;display:grid;gap:6px}
.tpv-usps li{display:flex;align-items:center;gap:8px;font-size:12.5px}
.tpv-check{width:18px;height:18px;border-radius:50%;background:var(--pv-accent);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex:0 0 auto}
.tpv-stock{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;margin-bottom:14px}
.tpv-dot{width:9px;height:9px;border-radius:50%;background:#21c463;box-shadow:0 0 0 3px rgba(33,196,99,.2)}
.tpv-bundle-h{font-size:13px;font-weight:700;margin-bottom:8px}
.tpv-bundle{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}
.tpv-bopt{position:relative;border:2px solid rgba(0,0,0,.12);border-radius:10px;padding:14px 0;text-align:center;font-size:14px}
.tpv-bopt.on{border-color:var(--pv-accent);background:color-mix(in srgb,var(--pv-accent) 8%,transparent)}
.tpv-bopt-badge{position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:var(--pv-accent);color:#fff;font-size:8.5px;font-weight:700;padding:2px 7px;border-radius:20px;white-space:nowrap}
.tpv-btn-cart{width:100%;border-radius:12px;padding:14px;font-size:14px}
.tpv-pay{display:flex;gap:6px;justify-content:center;margin-top:10px}
.tpv-pay span{font-size:9px;font-weight:700;color:#555;background:#fff;border:1px solid rgba(0,0,0,.1);border-radius:4px;padding:3px 6px}
.tpv-acc{padding:0 24px 8px}
.tpv-acc-row{display:flex;align-items:center;justify-content:space-between;padding:14px 4px;border-bottom:1px solid rgba(0,0,0,.09);font-size:13px;font-weight:600}
@media(max-width:640px){
  .tpv-benefits,.tpv-brand-sec,.tpv-pdp,.tpv-rev-cards{grid-template-columns:1fr}
  .tpv-hero-in{max-width:100%}.tpv-h1{font-size:24px}.tpv-collage{height:180px}
}
`;
