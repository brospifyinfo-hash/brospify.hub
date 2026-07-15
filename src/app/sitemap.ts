import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  // Öffentlich crawlbar sind die Einstiegsseiten: der Hub-Login (/), die
  // Standalone-Editor-Landing (/start, Rewrite auf die statische Landing)
  // und der Editor selbst (/editor, eigene Marketing-Metadata). Der Rest
  // des Hubs liegt hinter dem Login.
  const now = new Date();
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/start`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/editor`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
