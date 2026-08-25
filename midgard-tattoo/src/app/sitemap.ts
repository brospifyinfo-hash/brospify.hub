import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://midgard-tattoo.de";

export default function sitemap(): MetadataRoute.Sitemap {
  // Alle öffentlichen Seiten. Das Dashboard unter /admin gehört bewusst
  // nicht dazu.
  const now = new Date();
  const pages: { path: string; priority: number; changeFrequency: "weekly" | "monthly" }[] = [
    { path: "", priority: 1, changeFrequency: "weekly" },
    // Die Terminseite ändert sich am häufigsten und ist das Ziel, auf das
    // alles hinausläuft — deshalb gleich hinter der Startseite.
    { path: "/termin", priority: 0.9, changeFrequency: "weekly" },
    { path: "/arbeiten", priority: 0.8, changeFrequency: "monthly" },
    { path: "/studio", priority: 0.7, changeFrequency: "monthly" },
    { path: "/fragen", priority: 0.6, changeFrequency: "monthly" },
  ];
  return pages.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
