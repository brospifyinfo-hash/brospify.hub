"use client";

import { useEffect, useState, type CSSProperties } from "react";

// ─────────────────────────────────────────────────────────────────
// Live-Vorschau: GETREUE Nachbildung der Produktseiten-Oberseite (main-product
// bis VOR der Beschreibung) — Reihenfolge, Inhalte & Icons wie im echten
// Brospify-Theme: Angebots-Hinweis → Titel → Bewertung → Vorteile (Emoji-Kreise)
// → Lager → Preis → Bundle → Kaufen → Zahlarten → Gratis-Geschenk → Countdown-
// Timeline. Rein clientseitig (lädt immer), voll über CSS-Variablen gethemt,
// responsive für PC & Handy.
// ─────────────────────────────────────────────────────────────────

export interface PreviewBundle { label: string; price: string; perUnit: string; badge: string; save: string; popular: boolean }
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

export default function ThemePreview({
  data, colors, headingFont, bodyFont, radius, loading, label,
}: {
  data: PreviewData | null; colors: ThemeColors; headingFont: string; bodyFont: string;
  radius: number; loading: boolean; label: string;
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
    "--pv-bg": colors.background, "--pv-text": colors.text, "--pv-btn": colors.button,
    "--pv-btnText": colors.buttonText, "--pv-accent": colors.accent,
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
            {/* Galerie */}
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

            {/* Infospalte (bis VOR der Beschreibung) */}
            <div className="pm-info">
              {data.offerEndText && <div className="pm-offer">🔥 {data.offerEndText}</div>}

              <h1 className="pm-title">{data.title}</h1>

              <div className="pm-rating">
                <span className="pm-stars">★★★★★</span>
                <strong>{data.ratingValue}</strong>
                <span>· {data.ratingText}</span>
              </div>

              <div className="pm-benefits">
                {data.benefits.slice(0, 4).map((b, i) => (
                  <div key={i} className="pm-benefit">
                    <span className="pm-bic">{b.emoji}</span>{b.text}
                  </div>
                ))}
              </div>

              <div className="pm-stock"><span className="pm-dot" />{data.stock}</div>

              <div className="pm-divider" />

              <div className="pm-price">
                <strong>{data.price}</strong>
                <s>{data.comparePrice}</s>
                <span className="pm-save">{data.discount}</span>
              </div>

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

              <button className="pm-cta">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                {data.cta}
              </button>

              <div className="pm-pay-head">{data.payHeading}</div>
              <div className="pm-pay">
                {["VISA", "Mastercard", "PayPal", "Klarna", "Apple Pay", "G Pay"].map((p) => <span key={p}>{p}</span>)}
              </div>

              <div className="pm-gift">
                <span className="pm-gift-ic">🎁</span>
                <span><strong>{data.giftTitle}</strong><em>{data.giftSubtitle}</em></span>
              </div>

              <div className="pm-countdown">
                {data.countdownPrefix} <strong>{data.countdown}</strong> {data.countdownSuffix}
              </div>
              <div className="pm-timeline">
                {data.timeline.map((s, i) => (
                  <div key={i} className="pm-step">
                    <span className="pm-step-ic"><Ic d={ICON[s.icon] || ICON.bag} s={17} /></span>
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

.pm-stage{background:var(--pv-bg);color:var(--pv-text);font-family:var(--pv-b);padding:20px;max-height:72vh;overflow-y:auto}
.pm-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.08fr);gap:24px;align-items:start}

.pm-gallery{position:sticky;top:0}
.pm-main{position:relative;aspect-ratio:1;border-radius:var(--pv-r);overflow:hidden;background:color-mix(in srgb,var(--pv-text) 6%,var(--pv-bg))}
.pm-main img{width:100%;height:100%;object-fit:cover;display:block}
.pm-noimg{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:13px;opacity:.4}
.pm-badge{position:absolute;top:12px;left:12px;z-index:2;background:var(--pv-accent);color:#fff;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:5px 11px;border-radius:min(var(--pv-r),30px)}
.pm-thumbs{display:flex;gap:8px;margin-top:10px}
.pm-thumb{width:56px;height:56px;flex:0 0 auto;border-radius:min(var(--pv-r),12px);overflow:hidden;border:2px solid transparent;background:color-mix(in srgb,var(--pv-text) 6%,var(--pv-bg));cursor:pointer;padding:0}
.pm-thumb.on{border-color:var(--pv-accent)}
.pm-thumb img{width:100%;height:100%;object-fit:cover;display:block}

.pm-info{min-width:0}
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
.pm-bundle-main{display:flex;flex-direction:column;min-width:0}
.pm-bundle-label{font-size:14.5px;font-weight:700}
.pm-bundle-per{font-size:11px;opacity:.6}
.pm-bundle-right{margin-left:auto;display:flex;flex-direction:column;align-items:flex-end}
.pm-bundle-price{font-size:15.5px;font-weight:800}
.pm-bundle-save{font-size:10.5px;font-weight:800;color:var(--pv-accent)}

.pm-cta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;background:var(--pv-btn);color:var(--pv-btnText);border:0;font-family:var(--pv-b);font-weight:800;font-size:15.5px;padding:15px;border-radius:var(--pv-r);cursor:pointer;letter-spacing:.01em}
.pm-pay-head{text-align:center;font-size:11px;opacity:.55;margin:14px 0 8px;font-weight:600}
.pm-pay{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:18px}
.pm-pay span{font-size:9px;font-weight:700;opacity:.55;border:1px solid color-mix(in srgb,var(--pv-text) 18%,transparent);border-radius:5px;padding:3px 7px}

.pm-gift{display:flex;align-items:center;gap:11px;border:1px dashed color-mix(in srgb,var(--pv-accent) 50%,transparent);background:color-mix(in srgb,var(--pv-accent) 6%,var(--pv-bg));border-radius:min(var(--pv-r),16px);padding:12px 14px;margin-bottom:18px}
.pm-gift-ic{width:36px;height:36px;flex:0 0 auto;border-radius:50%;background:color-mix(in srgb,var(--pv-accent) 16%,var(--pv-bg));display:inline-flex;align-items:center;justify-content:center;font-size:18px}
.pm-gift strong{display:block;font-size:13px;font-weight:700}
.pm-gift em{display:block;font-size:11.5px;opacity:.65;font-style:normal;line-height:1.35}

.pm-countdown{text-align:center;font-size:12.5px;font-weight:600;margin-bottom:10px}
.pm-countdown strong{color:var(--pv-accent)}
.pm-timeline{display:flex;justify-content:space-between;position:relative;padding:0 4px}
.pm-timeline:before{content:"";position:absolute;top:17px;left:16%;right:16%;height:2px;background:color-mix(in srgb,var(--pv-text) 14%,transparent)}
.pm-step{display:flex;flex-direction:column;align-items:center;gap:5px;position:relative;z-index:1;flex:1}
.pm-step-ic{width:35px;height:35px;border-radius:50%;background:var(--pv-accent);color:#fff;display:inline-flex;align-items:center;justify-content:center}
.pm-step-label{font-size:11.5px;font-weight:700}
.pm-step-date{font-size:10.5px;opacity:.55}

@media(max-width:760px){
  .pm-stage{padding:16px;max-height:none}
  .pm-grid{grid-template-columns:1fr;gap:16px}
  .pm-gallery{position:static}
  .pm-main{max-width:340px;margin:0 auto}
  .pm-title{font-size:23px}
  .pm-price strong{font-size:27px}
}
`;
