import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Alle Bilder liegen in public/ — es gibt bewusst keine externen
  // Bildquellen, also braucht `images.remotePatterns` keinen Eintrag.
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
