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
    // bspx-runtime.js wird zusätzlich als Theme-Asset in Kunden-ZIPs gebacken.
    "/api/theme-export": ["./master-theme.zip", "./public/bspx-runtime.js"],
    "/api/theme-export/preview": ["./master-theme.zip"],
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
    return [
      { source: "/themes/editor", destination: "/editor", permanent: false },
    ];
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
