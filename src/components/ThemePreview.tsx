"use client";

import { useEffect, type CSSProperties } from "react";

// ─────────────────────────────────────────────────────────────────
// Live-Vorschau-Mockup: EINE saubere, schöne Produkt-Ansicht, die zeigt, was
// die Einstellungen bewirken — komplett über CSS-Variablen (5 Farben, Heading-/
// Body-Schrift, Ecken-Radius). Kein echtes Theme-HTML, keine Tokens, keine
// Überlappungen, keine Server-Runde: Farb-/Schrift-/Ecken-Änderungen wirken
// SOFORT. (Der echte Download liefert weiterhin das vollständige Shopify-Theme.)
// ─────────────────────────────────────────────────────────────────

export interface PreviewData {
  title: string;
  price: string;
  comparePrice: string;
  image: string;
  images: string[];
  badge: string;
  headline: string;
  subline: string;
  cta: string;
  stock: string;
  ratingText: string;
  usps: string[];
  reviewQuote: string;
  reviewAuthor: string;
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

function Stars() {
  return <span className="tpm-stars">★★★★★</span>;
}

export default function ThemePreview({
  data,
  colors,
  headingFont,
  bodyFont,
  radius,
  loading,
}: {
  data: PreviewData | null;
  colors: ThemeColors;
  headingFont: string;
  bodyFont: string;
  radius: number;
  loading: boolean;
}) {
  useEffect(() => {
    ensureFonts();
  }, []);

  const rootStyle = {
    ["--pv-bg" as string]: colors.background,
    ["--pv-text" as string]: colors.text,
    ["--pv-btn" as string]: colors.button,
    ["--pv-btnText" as string]: colors.buttonText,
    ["--pv-accent" as string]: colors.accent,
    ["--pv-h" as string]: `${FONT_FAMILY[headingFont] || "'Work Sans'"}, sans-serif`,
    ["--pv-b" as string]: `${FONT_FAMILY[bodyFont] || "'Work Sans'"}, sans-serif`,
    ["--pv-r" as string]: `${Math.max(0, radius)}px`,
  } as CSSProperties;

  const img = data?.image || "";

  return (
    <div className="tpm-root" style={rootStyle}>
      <style>{CSS}</style>
      {!data ? (
        <div className="tpm-empty">{loading ? "Lädt…" : "—"}</div>
      ) : (
        <div className="tpm-shop">
          {/* Storefront-Header */}
          <div className="tpm-head">
            <span className="tpm-brand">{(data.title || "Dein Shop").split(" ").slice(0, 2).join(" ")}</span>
            <span className="tpm-icons">♡ ⌕ ⛟</span>
          </div>

          {/* Hero: Text + Bild */}
          <div className="tpm-hero">
            <div className="tpm-col">
              {data.badge && <span className="tpm-badge">{data.badge}</span>}
              <h1 className="tpm-h1">{data.headline}</h1>
              <p className="tpm-sub">{data.subline}</p>
              <div className="tpm-rate"><Stars /> <span>{data.ratingText}</span></div>
              <div className="tpm-price">
                <strong>{data.price}</strong>
                {data.comparePrice && <s>{data.comparePrice}</s>}
              </div>
              <button className="tpm-cta">{data.cta}</button>
              <div className="tpm-pay">{["VISA", "Mastercard", "PayPal", "Klarna"].map((p) => <span key={p}>{p}</span>)}</div>
            </div>
            <div className="tpm-media">
              {img ? <img src={img} alt="" /> : <div className="tpm-noimg">Produktbild</div>}
            </div>
          </div>

          {/* USP-Leiste */}
          <div className="tpm-usps">
            {data.usps.filter(Boolean).slice(0, 4).map((u, i) => (
              <div key={i} className="tpm-usp"><span className="tpm-check">✓</span>{u}</div>
            ))}
          </div>

          {/* Lager + Mini-Review */}
          <div className="tpm-foot">
            <div className="tpm-stock"><span className="tpm-dot" />{data.stock}</div>
            <div className="tpm-review">
              <Stars />
              <span className="tpm-q">„{data.reviewQuote}"</span>
              <span className="tpm-author">— {data.reviewAuthor}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.tpm-root{border:1px solid rgba(255,255,255,.06);border-radius:14px;overflow:hidden;box-shadow:0 18px 50px -24px rgba(0,0,0,.55)}
.tpm-empty{height:360px;display:flex;align-items:center;justify-content:center;color:#9aa0aa;font-size:13px;background:#0e0e11}
.tpm-shop{background:var(--pv-bg);color:var(--pv-text);font-family:var(--pv-b);padding:0 0 22px}
.tpm-head{display:flex;align-items:center;justify-content:space-between;padding:14px 22px;border-bottom:1px solid color-mix(in srgb, var(--pv-text) 10%, transparent)}
.tpm-brand{font-family:var(--pv-h);font-weight:800;font-size:18px;letter-spacing:-.02em}
.tpm-icons{font-size:15px;opacity:.65;letter-spacing:6px}
.tpm-hero{display:grid;grid-template-columns:1.05fr .95fr;gap:26px;padding:26px 22px 8px;align-items:center}
.tpm-col{min-width:0}
.tpm-badge{display:inline-block;background:var(--pv-accent);color:#fff;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:4px 11px;border-radius:min(var(--pv-r),30px);margin-bottom:12px}
.tpm-h1{font-family:var(--pv-h);font-weight:800;font-size:32px;line-height:1.08;letter-spacing:-.02em;margin:0 0 10px;white-space:pre-line}
.tpm-sub{font-size:14px;line-height:1.5;opacity:.72;margin:0 0 14px;max-width:38ch}
.tpm-rate{display:flex;align-items:center;gap:8px;font-size:12px;opacity:.7;margin-bottom:12px}
.tpm-stars{color:var(--pv-accent);letter-spacing:2px;font-size:14px}
.tpm-price{display:flex;align-items:baseline;gap:10px;margin-bottom:16px}
.tpm-price strong{font-family:var(--pv-h);font-size:30px;font-weight:800}
.tpm-price s{opacity:.45;font-size:17px}
.tpm-cta{display:inline-block;background:var(--pv-btn);color:var(--pv-btnText);border:0;font-family:var(--pv-b);font-weight:700;font-size:15px;padding:14px 30px;border-radius:var(--pv-r);cursor:pointer;letter-spacing:.01em}
.tpm-pay{display:flex;flex-wrap:wrap;gap:7px;margin-top:14px}
.tpm-pay span{font-size:9.5px;font-weight:700;opacity:.55;border:1px solid color-mix(in srgb,var(--pv-text) 18%,transparent);border-radius:5px;padding:3px 7px}
.tpm-media{aspect-ratio:1;border-radius:var(--pv-r);overflow:hidden;background:color-mix(in srgb,var(--pv-text) 6%,var(--pv-bg));box-shadow:0 20px 40px -24px rgba(0,0,0,.4)}
.tpm-media img{width:100%;height:100%;object-fit:cover;display:block}
.tpm-noimg{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:13px;opacity:.4}
.tpm-usps{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:18px 22px;margin-top:8px;border-top:1px solid color-mix(in srgb,var(--pv-text) 8%,transparent);border-bottom:1px solid color-mix(in srgb,var(--pv-text) 8%,transparent)}
.tpm-usp{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:500}
.tpm-check{width:20px;height:20px;flex:0 0 auto;border-radius:50%;background:var(--pv-accent);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800}
.tpm-foot{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 22px 0;flex-wrap:wrap}
.tpm-stock{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600}
.tpm-dot{width:9px;height:9px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 3px color-mix(in srgb,#22c55e 25%,transparent)}
.tpm-review{display:flex;align-items:center;gap:9px;font-size:12px;opacity:.85;min-width:0}
.tpm-q{font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:30ch}
.tpm-author{font-weight:700;opacity:.7;white-space:nowrap}
@media(max-width:560px){
  .tpm-hero{grid-template-columns:1fr;gap:16px}
  .tpm-media{max-width:240px}
  .tpm-h1{font-size:26px}
  .tpm-usps{grid-template-columns:1fr 1fr}
  .tpm-review{display:none}
}
`;
