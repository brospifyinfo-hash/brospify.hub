import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://midgard-tattoo.de";

export default function sitemap(): MetadataRoute.Sitemap {
  // Eine Seite, ein Eintrag: alle Abschnitte liegen als Anker auf der
  // Startseite, das Dashboard ist bewusst nicht dabei.
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
