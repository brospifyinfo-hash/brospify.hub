"use client";

// ─────────────────────────────────────────────────────────────────
// Live-Vorschau-Shell: zeigt das serverseitig gerenderte ECHTE Theme-HTML
// (vom /api/theme-export/preview) in einem sandboxed iframe. Home/Produkt-
// Umschalter + Lade-Indikator. Das eigentliche Layout/CSS kommt 1:1 aus dem
// Theme — hier wird nichts nachgebaut.
// ─────────────────────────────────────────────────────────────────

export default function ThemePreview({
  html,
  page,
  onPageChange,
  loading,
  labels,
}: {
  html: string;
  page: "home" | "product";
  onPageChange: (p: "home" | "product") => void;
  loading: boolean;
  labels: { home: string; product: string };
}) {
  return (
    <div className="tpvf-root">
      <style>{CSS}</style>
      <div className="tpvf-bar">
        <div className="tpvf-dots"><span /><span /><span /></div>
        <div className="tpvf-tabs">
          <button className={page === "home" ? "on" : ""} onClick={() => onPageChange("home")}>{labels.home}</button>
          <button className={page === "product" ? "on" : ""} onClick={() => onPageChange("product")}>{labels.product}</button>
        </div>
        <div className="tpvf-url">
          {loading && <span className="tpvf-spin" aria-hidden />}
          deinshop.de{page === "product" ? "/products/…" : ""}
        </div>
      </div>
      <div className="tpvf-stage">
        {html ? (
          <iframe className="tpvf-iframe" title="Theme-Vorschau" sandbox="allow-scripts allow-same-origin" srcDoc={html} />
        ) : (
          <div className="tpvf-empty">{loading ? "…" : "—"}</div>
        )}
      </div>
    </div>
  );
}

const CSS = `
.tpvf-root{border:1px solid rgba(255,255,255,.07);border-radius:12px;overflow:hidden;background:#fbfbfc;box-shadow:0 14px 40px -22px rgba(0,0,0,.5)}
.tpvf-bar{display:flex;align-items:center;gap:12px;padding:7px 12px;background:#f2f2f4;border-bottom:1px solid rgba(0,0,0,.06)}
.tpvf-dots{display:flex;gap:5px}.tpvf-dots span{width:8px;height:8px;border-radius:50%;background:#d4d4d8}
.tpvf-tabs{display:flex;gap:2px}
.tpvf-tabs button{border:0;background:transparent;color:#86868b;font-size:11px;font-weight:600;padding:4px 6px;cursor:pointer;font-family:inherit;border-bottom:2px solid transparent;transition:color .15s}
.tpvf-tabs button:hover{color:#3a3a3c}
.tpvf-tabs button.on{color:#1d1d1f;border-bottom-color:#1d1d1f}
.tpvf-url{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:10.5px;color:#9a9aa0;background:#fff;border:1px solid rgba(0,0,0,.05);border-radius:20px;padding:3px 12px;max-width:46%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.tpvf-spin{width:10px;height:10px;border-radius:50%;border:2px solid #e0e0e3;border-top-color:#86868b;animation:tpvf-rot .7s linear infinite;flex:0 0 auto}
@keyframes tpvf-rot{to{transform:rotate(360deg)}}
.tpvf-stage{background:#fff;position:relative}
.tpvf-iframe{width:100%;height:560px;border:0;display:block;background:#fff}
.tpvf-empty{height:300px;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:13px;background:#fafafa}
@media(max-width:1023px){.tpvf-iframe{height:420px}}
`;
