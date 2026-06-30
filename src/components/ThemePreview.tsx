"use client";

// ─────────────────────────────────────────────────────────────────
// Live-Vorschau: rendert die ECHTE Produktseite (1:1 aus dem Editor-Basis-
// Theme, serverseitig als Liquid-HTML) in einem iframe. Zeigt exakt, was der
// Download liefert — mit den gewählten Farben/Schriften/Ecken/Stil.
// ─────────────────────────────────────────────────────────────────

export default function ThemePreview({
  html,
  loading,
  label,
}: {
  html: string;
  loading: boolean;
  label: string;
}) {
  return (
    <div className="tpvf-root">
      <style>{CSS}</style>
      <div className="tpvf-bar">
        <div className="tpvf-dots"><span /><span /><span /></div>
        <span className="tpvf-tab">{label}</span>
        <div className="tpvf-url">
          {loading && <span className="tpvf-spin" />}
          dein-shop.de
        </div>
      </div>
      <div className="tpvf-stage">
        {html ? (
          <iframe
            className="tpvf-iframe"
            sandbox="allow-scripts allow-same-origin"
            srcDoc={html}
            title={label}
          />
        ) : (
          <div className="tpvf-empty">{loading ? "Vorschau wird gerendert…" : "—"}</div>
        )}
      </div>
    </div>
  );
}

const CSS = `
.tpvf-root{border:1px solid rgba(255,255,255,.07);border-radius:12px;overflow:hidden;background:#fbfbfc;box-shadow:0 14px 40px -22px rgba(0,0,0,.5)}
.tpvf-bar{display:flex;align-items:center;gap:12px;padding:7px 12px;background:#f2f2f4;border-bottom:1px solid rgba(0,0,0,.06)}
.tpvf-dots{display:flex;gap:5px}.tpvf-dots span{width:8px;height:8px;border-radius:50%;background:#d4d4d8}
.tpvf-tab{font-size:11px;font-weight:600;color:#1d1d1f;border-bottom:2px solid #1d1d1f;padding:2px 2px 4px}
.tpvf-url{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:10.5px;color:#9a9aa0;background:#fff;border:1px solid rgba(0,0,0,.05);border-radius:20px;padding:3px 12px;max-width:46%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.tpvf-spin{width:10px;height:10px;border-radius:50%;border:2px solid #e0e0e3;border-top-color:#86868b;animation:tpvf-rot .7s linear infinite;flex:0 0 auto}
@keyframes tpvf-rot{to{transform:rotate(360deg)}}
.tpvf-stage{background:#fff;position:relative}
.tpvf-iframe{width:100%;height:640px;border:0;display:block;background:#fff}
.tpvf-empty{height:360px;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:13px;background:#fafafa}
@media(max-width:1023px){.tpvf-iframe{height:480px}}
`;
