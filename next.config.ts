import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // Das gebündelte Master-Theme (Schablone) muss in die Serverless-Function
  // der Theme-Export-Route getraced werden, damit sie es zur Laufzeit per fs
  // lesen kann. Pfad relativ zum Projekt-Root.
  outputFileTracingIncludes: {
    "/api/theme-export": ["./master-theme.zip"],
    "/api/theme-export/preview": ["./master-theme.zip"],
    // Die Runtimes werden NICHT mehr in Kunden-ZIPs gebacken, sondern vom
    // abo-gegateten Asset-Endpoint per fs gelesen — dorthin tracen.
    "/api/storefront/asset/[file]": ["./public/bspx-sections.js", "./public/bspx-runtime.js"],
  },
  // Das dynamische, vom Admin hochladbare Favicon kommt über /api/favicon.
  // Browser fragen zusätzlich automatisch /favicon.ico an → dorthin umleiten.
  // (Die früher statische src/app/favicon.ico wurde entfernt, weil sie das
  // dynamische Favicon überschrieben hat.)
  // Der Theme-Editor ist von /themes/editor auf die eigenständige Route
  // /editor umgezogen (Standalone-Editor-Website). Alte Links/Lesezeichen
  // leiten weiter; ?start=…-Deeplinks bleiben erhalten (Query wird von
  // Next automatisch durchgereicht). 307 (permanent:false), damit Browser
  // nichts für immer cachen, solange die Struktur noch in Bewegung ist.
  async redirects() {
    const redirects = [
      { source: "/themes/editor", destination: "/editor", permanent: false },
    ];
    // Editor-Deployment (eigenes Vercel-Projekt mit EDITOR_SITE=1): Die
    // Domain-Wurzel gehört der Landing (/start) — der Hub-Login unter /
    // existiert auf der Editor-Website nicht. Build-Zeit-Schalter, damit
    // der Hub (ohne diese Variable) sein "/" als Login behält.
    if (process.env.EDITOR_SITE === "1") {
      redirects.unshift({ source: "/", destination: "/start", permanent: false });
    }
    return redirects;
  },
  async rewrites() {
    return [
      { source: "/favicon.ico", destination: "/api/favicon" },
      // Standalone-Landing („Eingangstür") für den Theme-Editor: statische,
      // vom Hub-Chrome/Tailwind isolierte Seite unter public/landing/. Der
      // saubere Pfad /start liefert sie aus; /start/login (echte App-Route)
      // bleibt davon unberührt (source matcht nur exakt /start).
      { source: "/start", destination: "/landing/index.html" },
    ];
  },
};

export default nextConfig;
