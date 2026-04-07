import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BrospifyHub - Managed Dropshipping Dashboard",
  description: "Dein persönliches Dropshipping Dashboard mit monatlichen Winning Product Charts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className={`${outfit.className} bg-zinc-950 text-white antialiased`}>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
