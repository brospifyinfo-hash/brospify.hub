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
          <iframe className="tpvf-iframe" title="Theme-Vorschau" sandbox="" srcDoc={html} />
        ) : (
          <div className="tpvf-empty">{loading ? "…" : "—"}</div>
        )}
      </div>
    </div>
  );
}

const CSS = `
.tpvf-root{border:1px solid rgba(255,255,255,.12);border-radius:14px;overflow:hidden;background:#0d0d10}
.tpvf-bar{display:flex;align-items:center;gap:10px;padding:8px 12px;background:#16161b;border-bottom:1px solid rgba(255,255,255,.08)}
.tpvf-dots{display:flex;gap:5px}.tpvf-dots span{width:9px;height:9px;border-radius:50%;background:#3a3a42}
.tpvf-tabs{display:flex;gap:4px;background:#0d0d10;border-radius:8px;padding:3px}
.tpvf-tabs button{border:0;background:transparent;color:#9aa0aa;font-size:11px;font-weight:600;padding:5px 12px;border-radius:6px;cursor:pointer;font-family:inherit}
.tpvf-tabs button.on{background:#95BF47;color:#0a1604}
.tpvf-url{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:10px;color:#6b7280;background:#0d0d10;border-radius:20px;padding:4px 11px;max-width:46%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.tpvf-spin{width:10px;height:10px;border-radius:50%;border:2px solid #3a3a42;border-top-color:#95BF47;animation:tpvf-rot .7s linear infinite;flex:0 0 auto}
@keyframes tpvf-rot{to{transform:rotate(360deg)}}
.tpvf-stage{background:#fff;position:relative}
.tpvf-iframe{width:100%;height:640px;border:0;display:block;background:#fff}
.tpvf-empty{height:300px;display:flex;align-items:center;justify-content:center;color:#9aa0aa;font-size:13px;background:#0d0d10}
@media(max-width:1023px){.tpvf-iframe{height:440px}}
`;
