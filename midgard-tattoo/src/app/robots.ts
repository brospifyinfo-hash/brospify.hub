import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://midgard-tattoo.de";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Das Dashboard und die API haben in der Suche nichts verloren.
        // Die Seiten tragen zusätzlich `robots: noindex` — die robots.txt
        // allein wäre kein Schutz, sondern nur eine Bitte.
        disallow: ["/admin", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
