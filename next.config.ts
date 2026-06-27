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
  },
  // Das dynamische, vom Admin hochladbare Favicon kommt über /api/favicon.
  // Browser fragen zusätzlich automatisch /favicon.ico an → dorthin umleiten.
  // (Die früher statische src/app/favicon.ico wurde entfernt, weil sie das
  // dynamische Favicon überschrieben hat.)
  async rewrites() {
    return [
      { source: "/favicon.ico", destination: "/api/favicon" },
    ];
  },
};

export default nextConfig;
