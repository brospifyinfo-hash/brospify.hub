import type { Metadata } from "next";
import Link from "next/link";
import { PageHead } from "@/components/PageHead";
import { ReviewList } from "@/components/ReviewList";
import { getPublishedReviews } from "@/lib/gallery";
import { STUDIO } from "@/lib/studio";

export const metadata: Metadata = {
  title: "Bewertungen",
  description: `Was Kundinnen und Kunden über ${STUDIO.name} in ${STUDIO.city} sagen.`,
  alternates: { canonical: "/bewertungen" },
};

export const dynamic = "force-dynamic";

export default async function BewertungenPage() {
  const reviews = await getPublishedReviews();
  const schnitt = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  // Structured Data nur, wenn es echte Bewertungen gibt und KEINE
  // Platzhalter dabei sind. Eine Durchschnittsnote aus erfundenen
  // Stimmen wäre eine Falschangabe gegenüber Google — und fliegt früher
  // oder später auf.
  const nurEcht = reviews.length > 0 && reviews.every((r) => !r.isExample);
  const jsonLd = nurEcht
    ? {
        "@context": "https://schema.org",
        "@type": "TattooParlor",
        name: STUDIO.name,
        address: {
          "@type": "PostalAddress",
          streetAddress: STUDIO.street,
          postalCode: STUDIO.zip,
          addressLocality: STUDIO.city,
          addressCountry: "DE",
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: schnitt.toFixed(1),
          reviewCount: reviews.length,
          bestRating: 5,
          worstRating: 1,
        },
        review: reviews.slice(0, 10).map((r) => ({
          "@type": "Review",
          author: { "@type": "Person", name: r.name },
          datePublished: r.date,
          reviewBody: r.text,
          reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
        })),
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <PageHead
        eyebrow="Bewertungen"
        title="Was Kunden sagen"
        lead={
          nurEcht
            ? `${reviews.length} ${reviews.length === 1 ? "Bewertung" : "Bewertungen"} · Durchschnitt ${schnitt.toFixed(1)} von 5`
            : undefined
        }
      />

      <ReviewList reviews={reviews} />

      <section className="hair-top">
        <div className="shell flex flex-wrap items-center justify-between gap-6 py-14">
          <p className="max-w-[44ch] text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
            Schon mal hier gewesen? Über ein paar Zeilen freut sich jedes Studio —
            am liebsten direkt bei Google, damit andere sie auch finden.
          </p>
          <Link href="/termin" className="btn btn-signal">Termin buchen</Link>
        </div>
      </section>
    </>
  );
}
