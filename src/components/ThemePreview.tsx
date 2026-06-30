"use client";

import { useEffect, useState, type CSSProperties } from "react";

// ─────────────────────────────────────────────────────────────────
// Live-Vorschau: GETREUE Nachbildung der Produktseiten-Oberseite (main-product:
// Galerie + Infospalte bis VOR der Beschreibung). Kein Liquid/iframe — rein
// clientseitig, damit es immer zuverlässig lädt. Farben/Schriften/Ecken wirken
// SOFORT über CSS-Variablen. Blockreihenfolge wie im echten Theme: Dringlichkeit
// → Titel → Bewertung → Vorteile → Lager → Preis → Bundles → Kaufen → Zahlarten
// → Gratis-Geschenk → Liefer-Timeline.
// ─────────────────────────────────────────────────────────────────

export interface PreviewBundle {
  label: string;
  badge: string;
  popular: boolean;
  price: string;
  perUnit: string;
  save: string;
}
export interface PreviewData {
  title: string;
  images: string[];
  badge: string;
  urgencyPrefix: string;
  urgencyTime: string;
  urgencySuffix: string;
  ratingValue: string;
  ratingText: string;
  usps: string[];
  stock: string;
  price: string;
  comparePrice: string;
  bundleHeading: string;
  bundles: PreviewBundle[];
  cta: string;
  giftTitle: string;
  giftSubtitle: string;
  timeline: { label: string; date: string }[];
  reviewQuote: string;
}

export interface ThemeColors {
  button: string;
  buttonText: string;
  background: string;
  text: string;
  accent: string;
}

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
  link.id = "tpv-allfonts";
  link.rel = "stylesheet";
  link.href = GOOGLE_ALL;
  document.head.appendChild(link);
}

const Check = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);
const Stars = () => <span className="pm-stars">★★★★★</span>;

export default function ThemePreview({
  data,
  colors,
  headingFont,
  bodyFont,
  radius,
  loading,
  label,
}: {
  data: PreviewData | null;
  colors: ThemeColors;
  headingFont: string;
  bodyFont: string;
  radius: number;
  loading: boolean;
  label: string;
}) {
  const [imgIdx, setImgIdx] = useState(0);
  const [bundleIdx, setBundleIdx] = useState(1);

  useEffect(() => { ensureFonts(); }, []);
  useEffect(() => {
    setImgIdx(0);
    const pop = data?.bundles?.findIndex((b) => b.popular) ?? -1;
    setBundleIdx(pop >= 0 ? pop : 1);
  }, [data]);

  const rootStyle = {
    "--pv-bg": colors.background,
    "--pv-text": colors.text,
    "--pv-btn": colors.button,
    "--pv-btnText": colors.buttonText,
    "--pv-accent": colors.accent,
    "--pv-h": `${FONT_FAMILY[headingFont] || "'Work Sans'"}, sans-serif`,
    "--pv-b": `${FONT_FAMILY[bodyFont] || "'Work Sans'"}, sans-serif`,
    "--pv-r": `${Math.max(0, radius)}px`,
  } as Record<string, string> as CSSProperties;

  const img = data?.images?.[imgIdx] || data?.images?.[0] || "";

  return (
    <div className="pm-root" style={rootStyle}>
      <style>{CSS}</style>
      <div className="pm-bar">
        <div className="pm-dots"><span /><span /><span /></div>
        <span className="pm-tab">{label}</span>
        <div className="pm-url">{loading && <span className="pm-spin" />}dein-shop.de</div>
      </div>

      {!data ? (
        <div className="pm-empty">{loading ? "Lädt…" : "—"}</div>
      ) : (
        <div className="pm-stage">
          <div className="pm-grid">
            {/* ── Galerie ── */}
            <div className="pm-gallery">
              <div className="pm-main">
                {data.badge && <span className="pm-badge">{data.badge}</span>}
                {img ? <img src={img} alt="" /> : <div className="pm-noimg">Produktbild</div>}
              </div>
              {data.images.length > 1 && (
                <div className="pm-thumbs">
                  {data.images.slice(0, 5).map((u, i) => (
                    <button key={i} className={`pm-thumb ${i === imgIdx ? "on" : ""}`} onClick={() => setImgIdx(i)}>
                      <img src={u} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Infospalte (bis VOR der Beschreibung) ── */}
            <div className="pm-info">
              <div className="pm-urgency">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                {data.urgencyPrefix} <strong>{data.urgencyTime}</strong> {data.urgencySuffix}
              </div>

              <h1 className="pm-title">{data.title}</h1>

              <div className="pm-rating">
                <Stars />
                <strong>{data.ratingValue}</strong>
                <span>· {data.ratingText}</span>
              </div>

              <div className="pm-usps">
                {data.usps.filter(Boolean).slice(0, 4).map((u, i) => (
                  <div key={i} className="pm-usp"><span className="pm-check"><Check /></span>{u}</div>
                ))}
              </div>

              <div className="pm-stock"><span className="pm-dot" />{data.stock}</div>

              <div className="pm-divider" />

              <div className="pm-price">
                <strong>{data.price}</strong>
                <s>{data.comparePrice}</s>
                <span className="pm-save">Spare 38%</span>
              </div>

              {/* Bundle-Auswahl */}
              <div className="pm-bundle-head">{data.bundleHeading}</div>
              <div className="pm-bundles">
                {data.bundles.map((b, i) => (
                  <button key={i} className={`pm-bundle ${i === bundleIdx ? "on" : ""}`} onClick={() => setBundleIdx(i)}>
                    {b.badge && <span className="pm-bundle-badge">{b.badge}</span>}
                    <span className="pm-radio" />
                    <span className="pm-bundle-main">
                      <span className="pm-bundle-label">{b.label}</span>
                      <span className="pm-bundle-per">{b.perUnit}</span>
                    </span>
                    <span className="pm-bundle-right">
                      <span className="pm-bundle-price">{b.price}</span>
                      {b.save && <span className="pm-bundle-save">{b.save}</span>}
                    </span>
                  </button>
                ))}
              </div>

              <button className="pm-cta">{data.cta}</button>

              <div className="pm-pay">
                {["VISA", "Mastercard", "PayPal", "Klarna", "Apple Pay", "G Pay"].map((p) => (
                  <span key={p}>{p}</span>
                ))}
              </div>

              {/* Gratis-Geschenk */}
              <div className="pm-gift">
                <span className="pm-gift-ic">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 12v8H4v-8" /><path d="M2 7h20v5H2z" /><path d="M12 22V7" /><path d="M12 7S10.5 2 8 4s4 3 4 3M12 7s1.5-5 4-3-4 3-4 3" /></svg>
                </span>
                <span>
                  <strong>{data.giftTitle}</strong>
                  <em>{data.giftSubtitle}</em>
                </span>
              </div>

              {/* Liefer-Timeline */}
              <div className="pm-timeline">
                {data.timeline.map((s, i) => (
                  <div key={i} className="pm-step">
                    <span className="pm-step-dot" />
                    <span className="pm-step-label">{s.label}</span>
                    <span className="pm-step-date">{s.date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.pm-root{border:1px solid rgba(255,255,255,.07);border-radius:12px;overflow:hidden;background:#fbfbfc;box-shadow:0 16px 46px -24px rgba(0,0,0,.55)}
.pm-bar{display:flex;align-items:center;gap:12px;padding:7px 12px;background:#f2f2f4;border-bottom:1px solid rgba(0,0,0,.06)}
.pm-dots{display:flex;gap:5px}.pm-dots span{width:8px;height:8px;border-radius:50%;background:#d4d4d8}
.pm-tab{font-size:11px;font-weight:600;color:#1d1d1f;border-bottom:2px solid #1d1d1f;padding:2px 2px 4px}
.pm-url{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:10.5px;color:#9a9aa0;background:#fff;border:1px solid rgba(0,0,0,.05);border-radius:20px;padding:3px 12px}
.pm-spin{width:10px;height:10px;border-radius:50%;border:2px solid #e0e0e3;border-top-color:#86868b;animation:pm-rot .7s linear infinite}
@keyframes pm-rot{to{transform:rotate(360deg)}}
.pm-empty{height:360px;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:13px;background:#fafafa}

.pm-stage{background:var(--pv-bg);color:var(--pv-text);font-family:var(--pv-b);padding:22px}
.pm-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:26px;align-items:start}

.pm-gallery{position:sticky;top:0}
.pm-main{position:relative;aspect-ratio:1;border-radius:var(--pv-r);overflow:hidden;background:color-mix(in srgb,var(--pv-text) 6%,var(--pv-bg))}
.pm-main img{width:100%;height:100%;object-fit:cover;display:block}
.pm-noimg{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:13px;opacity:.4}
.pm-badge{position:absolute;top:12px;left:12px;z-index:2;background:var(--pv-accent);color:#fff;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:5px 11px;border-radius:min(var(--pv-r),30px)}
.pm-thumbs{display:flex;gap:8px;margin-top:10px}
.pm-thumb{width:58px;height:58px;border-radius:min(var(--pv-r),12px);overflow:hidden;border:2px solid transparent;background:color-mix(in srgb,var(--pv-text) 6%,var(--pv-bg));cursor:pointer;padding:0}
.pm-thumb.on{border-color:var(--pv-accent)}
.pm-thumb img{width:100%;height:100%;object-fit:cover;display:block}

.pm-info{min-width:0}
.pm-urgency{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;margin-bottom:12px;opacity:.9}
.pm-urgency strong{color:var(--pv-accent)}
.pm-title{font-family:var(--pv-h);font-weight:800;font-size:27px;line-height:1.1;letter-spacing:-.02em;margin:0 0 10px}
.pm-rating{display:flex;align-items:center;gap:7px;font-size:12.5px;margin-bottom:14px;opacity:.85}
.pm-rating strong{font-weight:700}
.pm-stars{color:var(--pv-accent);letter-spacing:1px;font-size:14px}
.pm-usps{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;margin-bottom:14px}
.pm-usp{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:500}
.pm-check{width:18px;height:18px;flex:0 0 auto;border-radius:50%;background:var(--pv-accent);color:#fff;display:inline-flex;align-items:center;justify-content:center}
.pm-stock{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;margin-bottom:14px}
.pm-dot{width:9px;height:9px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 3px color-mix(in srgb,#22c55e 25%,transparent)}
.pm-divider{height:1px;background:color-mix(in srgb,var(--pv-text) 12%,transparent);margin:0 0 14px}
.pm-price{display:flex;align-items:baseline;gap:10px;margin-bottom:16px}
.pm-price strong{font-family:var(--pv-h);font-size:30px;font-weight:800}
.pm-price s{opacity:.4;font-size:17px}
.pm-save{background:color-mix(in srgb,var(--pv-accent) 16%,transparent);color:var(--pv-accent);font-size:11px;font-weight:800;padding:3px 8px;border-radius:min(var(--pv-r),20px)}

.pm-bundle-head{font-family:var(--pv-h);font-weight:700;font-size:14px;margin-bottom:9px}
.pm-bundles{display:flex;flex-direction:column;gap:9px;margin-bottom:16px}
.pm-bundle{position:relative;display:flex;align-items:center;gap:12px;width:100%;text-align:left;cursor:pointer;background:color-mix(in srgb,var(--pv-text) 3%,var(--pv-bg));border:2px solid color-mix(in srgb,var(--pv-text) 12%,transparent);border-radius:min(var(--pv-r),16px);padding:12px 14px;font-family:inherit;color:inherit}
.pm-bundle.on{border-color:var(--pv-accent);background:color-mix(in srgb,var(--pv-accent) 7%,var(--pv-bg))}
.pm-bundle-badge{position:absolute;top:-9px;right:12px;background:var(--pv-accent);color:#fff;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;padding:2px 8px;border-radius:20px}
.pm-radio{width:18px;height:18px;flex:0 0 auto;border-radius:50%;border:2px solid color-mix(in srgb,var(--pv-text) 30%,transparent)}
.pm-bundle.on .pm-radio{border-color:var(--pv-accent);background:radial-gradient(circle at center,var(--pv-accent) 0 5px,transparent 6px)}
.pm-bundle-main{display:flex;flex-direction:column;min-width:0}
.pm-bundle-label{font-size:14px;font-weight:700}
.pm-bundle-per{font-size:11px;opacity:.6}
.pm-bundle-right{margin-left:auto;display:flex;flex-direction:column;align-items:flex-end}
.pm-bundle-price{font-size:15px;font-weight:800}
.pm-bundle-save{font-size:10.5px;font-weight:800;color:var(--pv-accent)}

.pm-cta{display:block;width:100%;background:var(--pv-btn);color:var(--pv-btnText);border:0;font-family:var(--pv-b);font-weight:800;font-size:15.5px;padding:15px;border-radius:var(--pv-r);cursor:pointer;letter-spacing:.01em}
.pm-pay{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:12px 0 16px}
.pm-pay span{font-size:9px;font-weight:700;opacity:.5;border:1px solid color-mix(in srgb,var(--pv-text) 18%,transparent);border-radius:5px;padding:3px 7px}

.pm-gift{display:flex;align-items:center;gap:11px;border:1px dashed color-mix(in srgb,var(--pv-accent) 50%,transparent);background:color-mix(in srgb,var(--pv-accent) 6%,var(--pv-bg));border-radius:min(var(--pv-r),16px);padding:12px 14px;margin-bottom:16px}
.pm-gift-ic{width:34px;height:34px;flex:0 0 auto;border-radius:50%;background:var(--pv-accent);color:#fff;display:inline-flex;align-items:center;justify-content:center}
.pm-gift strong{display:block;font-size:13px;font-weight:700}
.pm-gift em{display:block;font-size:11.5px;opacity:.65;font-style:normal}

.pm-timeline{display:flex;justify-content:space-between;position:relative;padding-top:6px}
.pm-timeline:before{content:"";position:absolute;top:11px;left:12%;right:12%;height:2px;background:color-mix(in srgb,var(--pv-text) 14%,transparent)}
.pm-step{display:flex;flex-direction:column;align-items:center;gap:4px;position:relative;z-index:1;flex:1}
.pm-step-dot{width:11px;height:11px;border-radius:50%;background:var(--pv-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--pv-accent) 22%,transparent)}
.pm-step-label{font-size:11.5px;font-weight:700}
.pm-step-date{font-size:10.5px;opacity:.55}

@media(max-width:720px){
  .pm-grid{grid-template-columns:1fr;gap:16px}
  .pm-gallery{position:static}
  .pm-title{font-size:23px}
}
`;
