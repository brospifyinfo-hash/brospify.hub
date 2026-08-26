import type { Metadata } from "next";
import { FaqSection } from "@/components/Sections";
import { PageHead } from "@/components/PageHead";
import { FAQ, STUDIO } from "@/lib/studio";

export const metadata: Metadata = {
  title: "Häufige Fragen",
  description: `Ablauf, Preise, Anzahlung, Pflege und Altersgrenze — die häufigsten Fragen an ${STUDIO.name}.`,
  alternates: { canonical: "/fragen" },
};

// Google zeigt beantwortete Fragen direkt im Suchergebnis an, wenn sie
// als FAQPage ausgezeichnet sind — für ein Studio der günstigste Weg,
// mit den immer gleichen Fragen aufzufallen.
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function FragenPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <PageHead
        eyebrow="Bevor du fragst"
        title="Häufige Fragen"
        lead={`Steht deine Frage nicht dabei? Ruf einfach an — ${STUDIO.phone}.`}
      />
      <FaqSection />
    </>
  );
}
