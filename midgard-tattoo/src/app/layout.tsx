import type { Metadata, Viewport } from "next";
import { Anton, Inter, Permanent_Marker } from "next/font/google";
import { ARTISTS, OPENING_HOURS, STUDIO } from "@/lib/studio";
import "./globals.css";

// ─── Schriften ───────────────────────────────────────────────────
// Anton ist die engste frei verfügbare Entsprechung zu den fetten
// Versalien auf der Schaufensterscheibe ("ALTDORF"). Permanent Marker
// greift den handgemalten gelben "TATTOO"-Schriftzug daneben auf und
// wird bewusst nur in Kleinstmengen eingesetzt. Inter trägt alles,
// was gelesen statt angeschaut werden muss.
//
// `next/font` lädt die Dateien beim Build herunter und liefert sie von
// der eigenen Domain aus: kein Request an Google zur Laufzeit (spart
// die Datenschutz-Diskussion) und kein Schrift-Flackern beim Laden.
const display = Anton({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const marker = Permanent_Marker({ subsets: ["latin"], weight: "400", variable: "--font-marker", display: "swap" });

// Für absolute URLs in OpenGraph und Structured Data. In Vercel als
// NEXT_PUBLIC_SITE_URL setzen, sobald die Domain steht.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://midgard-tattoo.de";

const TITLE = `${STUDIO.name} — ${STUDIO.tagline}`;
const DESCRIPTION = `Tattoostudio in ${STUDIO.city}: Black & Grey, Realistic, Fineline und Cover-Ups von ${STUDIO.artists}. Freie Termine online ansehen und direkt anfragen.`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s · ${STUDIO.name}` },
  description: DESCRIPTION,
  applicationName: STUDIO.name,
  keywords: [
    "Tattoo Altdorf", "Tattoostudio Altdorf", "Tattoo Nürnberger Land",
    "Black and Grey Tattoo", "Fineline Tattoo", "Cover Up Tattoo",
    "Tattoo Termin buchen", STUDIO.name,
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: SITE_URL,
    siteName: STUDIO.name,
    title: TITLE,
    description: DESCRIPTION,
    images: [{
      url: "/kolibri-lotus.webp",
      width: 1179,
      height: 1549,
      alt: "Black-and-Grey-Tattoo: Kolibri über Lotusblüten",
    }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0b0c",
};

// ─── Structured Data ─────────────────────────────────────────────
// TattooParlor ist ein echter schema.org-Typ. Damit erscheinen Adresse,
// Telefonnummer und Öffnungszeiten direkt im Google-Eintrag — für ein
// lokales Studio der wichtigste einzelne SEO-Hebel.
const DAY_URI: Record<string, string> = {
  Montag: "Monday", Dienstag: "Tuesday", Mittwoch: "Wednesday",
  Donnerstag: "Thursday", Freitag: "Friday", Samstag: "Saturday", Sonntag: "Sunday",
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "TattooParlor",
  "@id": `${SITE_URL}/#studio`,
  name: STUDIO.name,
  description: DESCRIPTION,
  url: SITE_URL,
  image: `${SITE_URL}/studio-altdorf.webp`,
  telephone: STUDIO.phone,
  email: STUDIO.email,
  priceRange: "€€",
  address: {
    "@type": "PostalAddress",
    streetAddress: STUDIO.street,
    postalCode: STUDIO.zip,
    addressLocality: STUDIO.city,
    addressCountry: "DE",
  },
  // Beide Artists als Personen — Google zeigt sie im Eintrag an, und
  // eine einzelne Person wäre schlicht falsch.
  employee: ARTISTS.map((a) => ({
    "@type": "Person",
    name: a.name,
    jobTitle: a.role,
    image: `${SITE_URL}${a.src}`,
  })),
  openingHoursSpecification: OPENING_HOURS.filter((d) => d.hours).map((d) => {
    const [opens, closes] = d.hours!.split("–").map((t) => t.trim());
    return {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${DAY_URI[d.day]}`,
      opens,
      closes,
    };
  }),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `data-scroll-behavior="smooth"` ist ab Next 16 nötig, damit der
    // Router das CSS-Smooth-Scrolling bei Seitenwechseln kurz aussetzt —
    // sonst „kriecht" die neue Seite nach oben statt sofort da zu sein.
    <html lang="de" data-scroll-behavior="smooth">
      <body className={`${display.variable} ${body.variable} ${marker.variable} grain`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {children}
      </body>
    </html>
  );
}
