"use client";

// ─── CodeBlockPreview ────────────────────────────────────────────
// Renders a Shopify custom-liquid / HTML / CSS snippet inside a
// sandboxed iframe so admins and customers see a live visual preview
// — no manual screenshot needed. Liquid control tags ({% … %}) are
// stripped (they produce no visible output anyway); {{ output }} tags
// are left intact. Updates are debounced so typing into the customiser
// doesn't reload the iframe on every keystroke.

import { useState, useEffect, useRef } from "react";

// Strip Liquid control-flow tags. They never render to anything
// visible server-side, so removing them keeps the preview clean while
// leaving every bit of HTML/CSS and {{ output }} untouched.
function stripLiquidControlTags(code: string): string {
  return code.replace(/\{%-?[\s\S]*?-?%\}/g, "");
}

function buildSrcDoc(code: string): string {
  const cleaned = stripLiquidControlTags(code || "");
  const looksFullDoc = /<!doctype/i.test(cleaned) || /<html[\s>]/i.test(cleaned);
  if (looksFullDoc) return cleaned;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  html,body{margin:0;padding:0;}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#ffffff;color:#111;line-height:1.5;}
  *{box-sizing:border-box;}
  img{max-width:100%;height:auto;}
</style></head><body>${cleaned}</body></html>`;
}

export function CodeBlockPreview({
  code,
  interactive = false,
  debounceMs = 250,
  className = "",
  title = "Code-Vorschau",
}: {
  code: string;
  /** When false (default) the iframe ignores pointer events — good for
   *  clickable grid cards. Set true inside modals where the user should
   *  be able to scroll/interact with the rendered block. */
  interactive?: boolean;
  debounceMs?: number;
  className?: string;
  title?: string;
}) {
  const [doc, setDoc] = useState(() => buildSrcDoc(code));
  const firstRender = useRef(true);

  useEffect(() => {
    // Render the very first value immediately; debounce everything after
    // so live-customising stays smooth.
    if (firstRender.current) {
      firstRender.current = false;
      setDoc(buildSrcDoc(code));
      return;
    }
    const t = setTimeout(() => setDoc(buildSrcDoc(code)), debounceMs);
    return () => clearTimeout(t);
  }, [code, debounceMs]);

  return (
    <iframe
      srcDoc={doc}
      // allow-scripts so JS-driven snippets (timers, sliders) preview;
      // no allow-same-origin → the frame can't reach the parent app.
      sandbox="allow-scripts allow-popups"
      loading="lazy"
      title={title}
      className={className}
      style={{
        border: 0,
        background: "#ffffff",
        pointerEvents: interactive ? "auto" : "none",
      }}
    />
  );
}
