// ─── Storefront-CSS der dynamischen Buy Box ─────────────────────────
// Wird von GET /api/buybox/[code] zusammen mit dem Plan ausgeliefert und
// von der Runtime als <style> injiziert. Gescoped unter .bspx-root; alle
// Farben/Radien kommen aus CSS-Variablen, die die Runtime aus plan.vars
// setzt. Optik spiegelt die Editor-Vorschau (pm-*-Replica) → Vorschau = Shop.

export const BUYBOX_CSS = `
.bspx-root{--bx-bg:#fff;--bx-text:#1a1a1a;--bx-btn:#111;--bx-btnText:#fff;--bx-accent:#2f6bff;--bx-r:8px;--bx-bd:1px;--bx-shadow:none;--bx-h:inherit;--bx-b:inherit;
  color:var(--bx-text);font-family:var(--bx-b);line-height:1.45}
.bspx-root,.bspx-root *{box-sizing:border-box}
.bspx-root img{max-width:100%}
.bspx-root button{font-family:inherit}

.bspx-sale{display:flex;align-items:center;justify-content:center;gap:8px;font-weight:800;font-size:14px;padding:10px 14px;margin:0 0 14px}
.bspx-offer{display:inline-block;background:rgba(217,83,79,.12);color:#d9534f;font-size:12.5px;font-weight:700;padding:5px 11px;border-radius:min(var(--bx-r),20px);margin:0 0 12px}
.bspx-title{font-family:var(--bx-h);font-weight:800;line-height:1.12;letter-spacing:-.02em;margin:0 0 10px}
.bspx-rating{display:flex;align-items:center;gap:7px;font-size:13px;margin:0 0 14px}
.bspx-rating.pill{background:rgba(0,0,0,.05);border-radius:100px;padding:6px 13px;width:max-content}
.bspx-stars{color:var(--bx-accent);letter-spacing:1.5px;font-size:15px}
.bspx-rating strong{font-weight:700}

.bspx-benefits{display:flex;flex-direction:column;gap:10px;margin:0 0 16px}
.bspx-benefit{display:flex;align-items:center;gap:11px;font-size:14px;font-weight:600}
.bspx-bic{width:30px;height:30px;flex:0 0 auto;border-radius:50%;display:inline-flex;align-items:center;justify-content:center}
.bspx-ic-dark .bspx-bic{background:#161616;color:#fff}
.bspx-ic-accent .bspx-bic{background:var(--bx-accent);color:#fff}
.bspx-ic-outline .bspx-bic{background:transparent;border:2px solid var(--bx-accent);color:var(--bx-accent)}

.bspx-stock{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;margin:0 0 14px}
.bspx-dot{width:9px;height:9px;border-radius:50%;background:#00c853;box-shadow:0 0 0 3px rgba(0,200,83,.25);animation:bspx-pulse 1.6s ease-in-out infinite}
@keyframes bspx-pulse{50%{box-shadow:0 0 0 6px rgba(0,200,83,.12)}}
.bspx-divider{height:1px;background:rgba(0,0,0,.1);margin:0 0 16px}

.bspx-variants{margin:0 0 14px}
.bspx-var-label{display:block;font-size:12.5px;font-weight:700;margin-bottom:7px}
.bspx-var-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.bspx-var{font-size:13px;font-weight:600;padding:9px 15px;border-radius:min(var(--bx-r),40px);border:var(--bx-bd) solid rgba(0,0,0,.18);background:rgba(0,0,0,.02);color:inherit;cursor:pointer}
.bspx-var.on{border-color:var(--bx-accent);background:color-mix(in srgb,var(--bx-accent) 10%,transparent);color:var(--bx-accent)}
.bspx-var[disabled]{opacity:.35;text-decoration:line-through;cursor:not-allowed}

.bspx-qty{display:flex;align-items:center;gap:0;border:var(--bx-bd) solid rgba(0,0,0,.18);border-radius:min(var(--bx-r),12px);width:max-content;margin:0 0 14px;overflow:hidden}
.bspx-qty button{width:38px;height:38px;border:0;background:transparent;font-size:17px;cursor:pointer;color:inherit}
.bspx-qty span{min-width:34px;text-align:center;font-weight:700;font-size:14px}

.bspx-price{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0 0 18px}
.bspx-price strong{font-family:var(--bx-h);font-weight:800}
.bspx-price s{opacity:.4;font-size:.55em}
.bspx-save{background:color-mix(in srgb,var(--bx-accent) 16%,transparent);color:var(--bx-accent);font-size:12.5px;font-weight:800;padding:3px 9px;border-radius:min(var(--bx-r),20px)}

.bspx-bundle-head{font-family:var(--bx-h);font-weight:700;font-size:14.5px;margin:0 0 10px}
.bspx-bundles{display:flex;flex-direction:column;gap:10px;margin:0 0 18px}
.bspx-bundle{position:relative;display:flex;align-items:center;gap:12px;width:100%;text-align:left;cursor:pointer;background:rgba(0,0,0,.02);border:2px solid rgba(0,0,0,.12);border-radius:min(var(--bx-r),16px);padding:13px 15px;color:inherit;box-shadow:var(--bx-shadow)}
.bspx-bundle.on{border-color:var(--bx-accent);background:color-mix(in srgb,var(--bx-accent) 7%,transparent)}
.bspx-bundle.style-outlined{background:transparent}
.bspx-bundle.style-classic{border-width:1px;box-shadow:none}
.bspx-bundle.style-soft{border-width:1px}
.bspx-bundle-badge{position:absolute;top:-9px;right:14px;background:var(--bx-accent);color:#fff;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;padding:2px 8px;border-radius:20px}
.bspx-radio{width:19px;height:19px;flex:0 0 auto;border-radius:50%;border:2px solid rgba(0,0,0,.3)}
.bspx-bundle.on .bspx-radio{border-color:var(--bx-accent);box-shadow:inset 0 0 0 3px var(--bx-bg),inset 0 0 0 9px var(--bx-accent)}
.bspx-bundle-img{width:44px;height:44px;flex:0 0 auto;border-radius:min(var(--bx-r),10px);object-fit:cover;background:rgba(0,0,0,.06)}
.bspx-bundle-main{display:flex;flex-direction:column;min-width:0;gap:1px}
.bspx-bundle-name{font-size:13.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bspx-chip{background:#161616;color:#fff;font-size:10px;font-weight:800;padding:1px 5px;border-radius:5px;margin-right:3px}
.bspx-bundle-per{font-size:11.5px;opacity:.55}
.bspx-bundle-save{font-size:11.5px;font-weight:800;color:#16a34a}
.bspx-bundle-right{margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;flex:0 0 auto}
.bspx-bundle-price{font-size:16px;font-weight:800}
.bspx-bundle-comp{font-size:11.5px;opacity:.4}

.bspx-cta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;background:var(--bx-btn);color:var(--bx-btnText);border:0;font-weight:800;padding:16px;border-radius:var(--bx-r);cursor:pointer;letter-spacing:.01em;transition:transform .12s,filter .12s}
.bspx-cta:hover{filter:brightness(1.08)}
.bspx-cta:active{transform:scale(.985)}
.bspx-cta.size-sm{padding:11px;font-size:13.5px}.bspx-cta.size-md{padding:13px;font-size:14.5px}
.bspx-cta.size-lg{padding:16px;font-size:15.5px}.bspx-cta.size-xl{padding:19px;font-size:17px}
.bspx-cta[disabled]{opacity:.55;cursor:not-allowed}
.bspx-combo{display:grid;grid-template-columns:1fr 1fr;gap:2px;margin-top:8px;border-radius:var(--bx-r);overflow:hidden}
.bspx-combo>span{display:flex;align-items:center;justify-content:center;height:44px;font-weight:800;font-size:13px}
.bspx-combo .brand-paypal{background:#ffc439;color:#003087;font-style:italic}
.bspx-combo .brand-klarna{background:#ffb3c7;color:#0a0a0a}
.bspx-combo .brand-applepay,.bspx-combo .brand-googlepay{background:#000;color:#fff}
.bspx-combo .brand-shoppay{background:#5a31f4;color:#fff}
.bspx-combo .brand-amazonpay{background:#ff9900;color:#111}
.bspx-combo .brand-sofort{background:#ef809f;color:#fff}

.bspx-pay-head{text-align:center;font-size:11.5px;opacity:.55;margin:14px 0 8px;font-weight:600}
.bspx-pay{display:flex;flex-wrap:wrap;gap:7px;justify-content:center;margin:0 0 18px}
.bspx-pay.align-left{justify-content:flex-start}.bspx-pay.align-right{justify-content:flex-end}
.bspx-pay-box{display:inline-flex;align-items:center;justify-content:center;min-width:46px;height:29px;padding:0 8px;background:#fff;border:1px solid rgba(0,0,0,.1);border-radius:5px;box-shadow:0 1px 2px rgba(0,0,0,.05);font-weight:800;font-size:11px}

.bspx-count{text-align:center;font-size:13px;font-weight:600;margin:0 0 10px}
.bspx-count strong{color:var(--bx-accent)}
.bspx-timeline{display:flex;justify-content:space-between;position:relative;padding:0 4px;margin:0 0 16px}
.bspx-timeline:before{content:"";position:absolute;top:17px;left:16%;right:16%;height:2px;background:rgba(0,0,0,.12)}
.bspx-step{display:flex;flex-direction:column;align-items:center;gap:5px;position:relative;z-index:1;flex:1}
.bspx-step-ic{width:36px;height:36px;border-radius:50%;background:var(--bx-accent);color:#fff;display:inline-flex;align-items:center;justify-content:center}
.bspx-tl-outlined .bspx-step-ic{background:transparent;border:2px solid var(--bx-accent);color:var(--bx-accent)}
.bspx-step-label{font-size:12px;font-weight:700}
.bspx-step-date{font-size:11px;opacity:.55}

.bspx-freetext{font-size:13.5px;line-height:1.6;opacity:.75;margin:0 0 16px}
.bspx-freetext.style-subtitle{font-size:15px;opacity:.85}
.bspx-freetext.style-uppercase{text-transform:uppercase;letter-spacing:.08em;font-size:12px;font-weight:700}
.bspx-acc{border:var(--bx-bd) solid rgba(0,0,0,.12);border-radius:min(var(--bx-r),14px);background:rgba(0,0,0,.015);margin:0 0 12px;overflow:hidden;box-shadow:var(--bx-shadow)}
.bspx-acc-head{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;background:transparent;border:0;cursor:pointer;padding:14px 16px;color:inherit;font-size:14px;font-weight:700;text-align:left}
.bspx-acc-plus{color:var(--bx-accent);font-size:19px;font-weight:400;flex:0 0 auto}
.bspx-acc-body{padding:0 16px 14px;font-size:13px;line-height:1.6;opacity:.75}
.bspx-acc-body p{margin:0 0 8px}

.bspx-desc{font-size:13.5px;line-height:1.65;opacity:.8;margin:0 0 16px}
.bspx-desc p{margin:0 0 10px}

.bspx-features{display:grid;gap:12px;margin:0 0 16px}
.bspx-feature{display:flex;flex-direction:column;gap:5px;border-radius:min(var(--bx-r),16px);padding:16px}
.bspx-feature.style-elevated{background:#fff;box-shadow:0 8px 22px -12px rgba(0,0,0,.25)}
.bspx-feature.style-flat{background:rgba(0,0,0,.035)}
.bspx-feature.style-outlined{border:var(--bx-bd) solid rgba(0,0,0,.14)}
.bspx-feature.style-glass{background:rgba(255,255,255,.55);backdrop-filter:blur(8px);border:1px solid rgba(0,0,0,.08)}
.bspx-feature.style-soft{background:color-mix(in srgb,var(--bx-accent) 7%,transparent)}
.bspx-feature strong{font-family:var(--bx-h);font-size:14px;font-weight:800}
.bspx-feature p{font-size:12.5px;line-height:1.5;opacity:.72;margin:0}

.bspx-iconrow{display:flex;gap:14px;justify-content:space-between;margin:0 0 16px}
.bspx-iconrow.vertical{flex-direction:column;gap:10px}
.bspx-iconitem{display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;text-align:center;font-size:12px;font-weight:600}
.bspx-iconrow.vertical .bspx-iconitem{flex-direction:row;text-align:left}
.bspx-iconitem .bspx-bic{width:34px;height:34px}

.bspx-share{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;border:var(--bx-bd) solid rgba(0,0,0,.16);border-radius:100px;background:transparent;color:inherit;padding:8px 15px;cursor:pointer;margin:0 0 14px}

/* ── Skeleton (im Liquid-Block, wird bei Render entfernt) ── */
.bspx-skeleton{display:flex;flex-direction:column;gap:13px;padding:4px 0}
.bspx-sk{border-radius:10px;background:linear-gradient(100deg,rgba(0,0,0,.06) 40%,rgba(0,0,0,.11) 50%,rgba(0,0,0,.06) 60%);background-size:200% 100%;animation:bspx-shimmer 1.3s ease-in-out infinite}
@keyframes bspx-shimmer{to{background-position:-200% 0}}
`;
