import type { ReactNode } from "react";
import type { Metadata } from "next";

// ─── /editor — eigenes Layout der Standalone-Editor-Website ────────────
// Der Editor ist fest HELL (White Mode wie die Landing /start). Das Root-
// Layout liefert einen dunklen <body>; dieses synchrone Inline-Script
// dreht die Klassen VOR dem ersten Paint um — kein Dark-Flash. Der
// useEffect im Editor selbst bleibt als zweite Schicht (Idempotent) und
// räumt beim Unmount auf.

export const metadata: Metadata = {
  // absolute: das Root-Layout hängt sonst per Template „· Brospify Hub" an —
  // die Editor-Website ist aber eine eigene Marke ohne Hub-Bezug.
  title: { absolute: "Brospify Editor — Dein Shopify-Shop, gebaut in Sekunden" },
  description:
    "Der Brospify Theme-Editor: Produkt zeigen, AI baut den kompletten Shop — Design, Texte, Kaufbox. Erste Vorschau kostenlos.",
};

export default function EditorLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var h=document.documentElement,b=document.body;h.classList.add('theme-light','theme-editor-light');b.classList.add('theme-light');b.classList.remove('bg-zinc-950','text-white');b.classList.add('bg-white','text-zinc-900');}catch(e){}})();`,
        }}
      />
      {children}
    </>
  );
}
