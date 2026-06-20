// ─── SEO config (single source) ─────────────────────────────────
// Canonical site URL for metadata / robots / sitemap. Override with
// NEXT_PUBLIC_SITE_URL in Vercel to your exact production domain
// (achte auf www vs. apex — der Canonical muss exakt passen).

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.brospifyhub.com"
).replace(/\/+$/, "");

export const SITE_NAME = "Brospify Hub";

export const SITE_DESCRIPTION =
  "Brospify Hub ist das All-in-One Dropshipping-Dashboard von Brospify: " +
  "tägliche Winning-Product-Drops, KI-Produktfotos (AI Studio), Background " +
  "Remover, Video Scout, Image Upscaler und Coaching — alles an einem Ort. " +
  "Jetzt die Brospify Membership sichern.";

export const SITE_KEYWORDS = [
  "Brospify",
  "Brospify Hub",
  "Brospify Login",
  "Brospify Dropshipping",
  "Brospify Membership",
  "Dropshipping Dashboard",
  "Winning Products finden",
  "Dropshipping Produkte",
  "KI Produktbilder",
  "AI Produktfotos",
  "Background Remover",
  "Produkt Recherche Tool",
  "E-Commerce Tools",
];
