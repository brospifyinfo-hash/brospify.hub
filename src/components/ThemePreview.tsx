"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { PRODUCT_SECTIONS, BUYBOX_DEFAULT_ORDER } from "@/lib/theme-sections";
import { getIcon, DEFAULT_BENEFIT_ICONS } from "@/lib/theme-icons";
import type { SectionInstance } from "@/lib/theme-doc";
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
}: {
  data: PreviewData | null; colors: ThemeColors; headingFont: string; bodyFont: string;
  radius: number; loading: boolean; label: string; viewMode?: "desktop" | "mobile";
  hiddenSections?: string[]; sectionHeadings?: Record<string, string>;
  buyboxOrder?: string[]; hiddenBlocks?: string[];
  shadow?: number; border?: number; iconStyle?: string; benefitIcons?: string[];
  /** Editor-Modus: dokumentgesteuerte Sections (statt PRODUCT_SECTIONS). */
  docSections?: SectionInstance[];
  selectedUid?: string | null;
  onSelectSection?: (uid: string | null) => void;
  onInsertAt?: (index: number) => void;
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
  // sondern zeigt echt, wie es auf PC bzw. Handy aussieht.
  const outerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 1, height: 0 });
  const targetW = viewMode === "mobile" ? 390 : 1080;
  useLayoutEffect(() => {
    const outer = outerRef.current, canvas = canvasRef.current;
    if (!outer || !canvas) return;
    const compute = () => {
      const cw = outer.clientWidth;
      const scale = Math.min(1, cw / targetW);
      setBox({ scale, height: canvas.offsetHeight * scale });
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(outer);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [targetW, data, giftOpen, bundleIdx, imgIdx, colors, radius, headingFont, bodyFont, hiddenSections.join("|"), JSON.stringify(sectionHeadings), buyboxOrder.join("|"), hiddenBlocks.join("|"), JSON.stringify(docSections), selectedUid]);

  const rootStyle = {
    "--pv-bg": colors.background, "--pv-text": colors.text, "--pv-btn": colors.button,
    "--pv-btnText": colors.buttonText, "--pv-accent": colors.accent,
    "--pv-h": `${FONT_FAMILY[headingFont] || "'Work Sans'"}, sans-serif`,
    "--pv-b": `${FONT_FAMILY[bodyFont] || "'Work Sans'"}, sans-serif`,
    "--pv-r": `${Math.max(0, radius)}px`,
    "--pv-shadow": ["none", "0 4px 14px -8px rgba(0,0,0,.16)", "0 12px 30px -10px rgba(0,0,0,.26)"][Math.max(0, Math.min(2, shadow))],
    "--pv-bd": `${Math.max(1, Math.min(3, border))}px`,
  } as Record<string, string> as CSSProperties;

  const img = data?.images?.[imgIdx] || data?.images?.[0] || "";

  // Rendert einen einzelnen Kaufbox-Baustein (konfigurationsgesteuert:
  // Reihenfolge + Sichtbarkeit steuert der Kunde im Section-Manager).
  function renderBlock(type: string) {
    if (!data) return null;
    switch (type) {
      case "urgency_text":
        return data.offerEndText ? <div className="pm-offer">🔥 {data.offerEndText}</div> : null;
      case "custom_title":
        return <h1 className="pm-title">{data.title}</h1>;
      case "custom_rating":
        return (
          <div className="pm-rating">
            <span className="pm-stars">★★★★★</span>
            <strong>{data.ratingValue}</strong>
            <span>· {data.ratingText}</span>
          </div>
        );
      case "benefits_list":
        return (
          <div className="pm-benefits">
            {data.benefits.slice(0, 4).map((b, i) => (
              <div key={i} className="pm-benefit"><span className="pm-bic"><BIcon id={benefitIcons[i] || DEFAULT_BENEFIT_ICONS[i] || "check"} /></span>{b.text}</div>
            ))}
          </div>
        );
      case "stock_indicator":
        return <div className="pm-stock"><span className="pm-dot" />{data.stock}</div>;
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
      case "text":
        return <p className="pm-freetext">Handgefertigt, sorgfältig geprüft und mit Liebe zum Detail — für ein Ergebnis, das du täglich spürst.</p>;
      case "custom_accordion":
        return (
          <div className="pm-acc">
            <button className="pm-acc-head" onClick={() => setFaqOpen((o) => !o)}>
              <span>Versand &amp; Rückgabe</span>
              <span className="pm-faq-plus">{faqOpen ? "−" : "+"}</span>
            </button>
            {faqOpen && <div className="pm-acc-body">Versand in 1–3 Werktagen mit Sendungsverfolgung. 30 Tage Geld-zurück-Garantie — unkompliziert und ohne Risiko.</div>}
          </div>
        );
      case "custom_price":
        return (
          <>
            <div className="pm-divider" />
            <div className="pm-price"><strong>{data.price}</strong><s>{data.comparePrice}</s><span className="pm-save">{data.discount}</span></div>
          </>
        );
      case "bundle_selector":
        return (
          <>
            <div className="pm-bundle-head">{data.bundleHeading}</div>
            <div className="pm-bundles">
              {data.bundles.map((b, i) => (
                <button key={i} className={`pm-bundle ${i === bundleIdx ? "on" : ""}`} onClick={() => setBundleIdx(i)}>
                  {b.badge && <span className="pm-bundle-badge">{b.badge}</span>}
                  <span className="pm-radio" />
                  {b.image ? <img className="pm-bundle-img" src={b.image} alt="" /> : <span className="pm-bundle-img" />}
                  <span className="pm-bundle-main">
                    <span className="pm-bundle-name"><span className="pm-qty">×{b.qty}</span> {b.name}</span>
                    {b.perUnit && <span className="pm-bundle-per">{b.perUnit}</span>}
                    <span className="pm-bundle-save">{b.save}</span>
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
      case "buy_buttons":
        return (
          <button className="pm-cta">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            {data.cta}
          </button>
        );
      case "payment_icons":
        return (
          <>
            <div className="pm-pay-head">{data.payHeading}</div>
            <div className="pm-pay">{PAY_ORDER.map((p) => <span key={p} className="pm-pay-box"><PayMark name={p} /></span>)}</div>
          </>
        );
      case "free_gift":
        return (
          <div className="pm-gift">
            <button className="pm-gift-head" onClick={() => setGiftOpen((o) => !o)}>
              <span className="pm-gift-txt"><strong>{data.giftTitle}</strong><em>{data.giftSubtitle}</em></span>
              <svg className={`pm-gift-chev ${giftOpen ? "open" : ""}`} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {giftOpen && (
              <div className="pm-gift-grid">
                {data.giftItems.map((g, i) => (
                  <div key={i} className="pm-gift-card">
                    <span className="pm-gift-price">{g.price}</span>
                    {g.image ? <img src={g.image} alt="" /> : <span className="pm-gift-ph" />}
                    <span className="pm-gift-check" />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case "delivery_timeline":
        return (
          <>
            <div className="pm-countdown">{data.countdownPrefix} <strong>{data.countdown}</strong> {data.countdownSuffix}</div>
            <div className="pm-timeline">
              {data.timeline.map((s, i) => (
                <div key={i} className="pm-step">
                  <span className="pm-step-ic"><Ic d={ICON[s.icon] || ICON.bag} s={17} /></span>
                  <span className="pm-step-label">{s.label}</span>
                  <span className="pm-step-date">{s.date}</span>
                </div>
              ))}
            </div>
          </>
        );
      default:
        return null;
    }
  }

  return (
    <div className="pm-root" style={rootStyle}>
      <style>{CSS}</style>
      <div ref={outerRef} className="pm-outer" style={{ height: box.height || undefined }}>
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

            {/* Infospalte — konfigurationsgesteuert (Reihenfolge + Sichtbarkeit) */}
            <div
              className={`pm-info ${onSelectSection ? "pm-selectable" : ""} ${selectedUid === "__buybox" ? "pm-selected" : ""}`}
              onClick={onSelectSection ? (e) => { e.stopPropagation(); onSelectSection("__buybox"); } : undefined}
            >
              {order.filter((t) => !hiddenBlk.has(t)).map((t) => (
                <Fragment key={t}>{renderBlock(t)}</Fragment>
              ))}
            </div>
          </div>

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
.pm-outer{position:relative;overflow:hidden;width:100%}
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
