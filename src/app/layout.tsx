import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { CreditsProvider } from "@/lib/credits";
import AppFooter from "@/components/AppFooter";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BrospifyHub - Managed Dropshipping Dashboard",
  description: "Dein persönliches Dropshipping Dashboard mit monatlichen Winning Product Charts.",
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
      </head>
      <body className={`${outfit.className} bg-zinc-950 text-white antialiased min-h-screen flex flex-col`}>
        <I18nProvider>
          <CreditsProvider>
            <div className="flex-1">{children}</div>
            <AppFooter />
          </CreditsProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
