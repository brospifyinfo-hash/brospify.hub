import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { CreditsProvider } from "@/lib/credits";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, SITE_KEYWORDS } from "@/lib/seo";

const outfit = Outfit({ subsets: ["latin"] });

const OG_TITLE = "Brospify Hub – Dropshipping Dashboard & KI-Tools";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: OG_TITLE,
    template: "%s · Brospify Hub",
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: "Brospify" }],
  creator: "Brospify",
  publisher: "Brospify",
  category: "business",
  alternates: { canonical: "/" },
  // Dynamisch über /favicon.ico (Rewrite → /api/favicon). Bewusst NICHT
  // direkt /api/favicon, weil robots.txt /api/ sperrt — Google könnte das
  // Favicon dann nicht crawlen. /favicon.ico ist erlaubt und liefert das
  // Bild direkt (200) aus.
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: OG_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      { url: "/brospify-logo.png", width: 512, height: 512, alt: "Brospify Hub" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/brospify-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  // Google Search Console: setze NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION in
  // Vercel auf den Verifizierungs-Code, um die Domain zu bestätigen.
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),
};

// Structured data so Google reliably associates the query „brospify"
// with this hub (Organization + WebSite).
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Brospify",
      alternateName: ["Brospify Hub", "BrospifyHub"],
      url: SITE_URL,
      logo: `${SITE_URL}/brospify-logo.png`,
      sameAs: ["https://brospify.com"],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "de-DE",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

// Disable iOS auto-zoom on focus by anchoring initialScale=1 and
// keeping minimum/maximum equal — combined with 16px form-field
// fonts in globals.css this stops the "zoom-in-on-tap" behaviour.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#030303",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        {/* Email Studio: load all selectable Google fonts up-front so
            the dropdown preview and live email iframe render correctly. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:wght@400;500;600;700&family=Bricolage+Grotesque:wght@400;500;600;700&family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&family=EB+Garamond:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Lato:wght@400;700&family=Lora:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=Merriweather:wght@400;700&family=Montserrat:wght@400;500;600;700&family=Nunito:wght@400;600;700&family=Open+Sans:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Raleway:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&family=Work+Sans:wght@400;500;600;700&display=swap"
        />
        {/* SEO: structured data (Organization + WebSite) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body className={`${outfit.className} bg-zinc-950 text-white antialiased`}>
        {/* Light-Mode Switch: erkennt ?theme=light (für Embed im Shopify-Theme)
            und setzt die `theme-light` Klasse vor First Paint. Verhindert
            Flash-of-Dark-Mode in der iframe-Integration. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=new URLSearchParams(window.location.search);var t=p.get('theme');if(t==='light'){try{sessionStorage.setItem('hub-theme','light');}catch(e){}}if(t==='light'||(function(){try{return sessionStorage.getItem('hub-theme')==='light';}catch(e){return false;}})()){document.documentElement.classList.add('theme-light');document.body.classList.add('theme-light');document.body.classList.remove('bg-zinc-950','text-white');document.body.classList.add('bg-white','text-zinc-900');}}catch(e){}})();`,
          }}
        />
        <I18nProvider>
          <CreditsProvider>{children}</CreditsProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
