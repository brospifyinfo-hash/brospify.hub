"use client";

// ─── Studio ──────────────────────────────────────────────────────
// Vertrauensabschnitt: das Schaufenster als Beweis, dass es den Laden
// wirklich gibt, daneben Adresse, Anfahrt und die harten Fakten.
// Für ein lokales Studio ist das der Abschnitt, der die Anfahrt
// entscheidet — deshalb Adresse, Telefon und Karte in Daumennähe.

import Image from "next/image";
import { GALLERY, STUDIO } from "@/lib/studio";
import { Parallax, Reveal } from "./motion";

const STUDIO_PHOTO = GALLERY.find((p) => p.slug === "studio-altdorf")!;

const FACTS = [
  { label: "Hygiene", value: "Einwegnadeln, sterile Arbeitsflächen, geprüfte Farben" },
  { label: "Beratung", value: "Vorgespräch kostenlos, auch telefonisch" },
  { label: "Entwurf", value: "Individuell gezeichnet, keine Vorlagen von der Wand" },
  { label: "Anfahrt", value: "Direkt an der Nürnberger Straße, Parken vor der Tür" },
];

export function StudioSection() {
  return (
    <section id="studio" className="relative scroll-mt-24 overflow-hidden hair-top">
      <div className="shell grid items-center gap-12 py-24 md:py-32 lg:grid-cols-2 lg:gap-20">
        <Reveal>
          <p className="eyebrow mb-4">Das Studio</p>
          {/* Geschütztes Leerzeichen vor der Hausnummer: in der sehr
              großen Versalschrift würde die „7" sonst allein in die
              nächste Zeile rutschen. */}
          <h2 className="display display-l max-w-[14ch]">
            {STUDIO.street.replace(/\s(\d+\w*)$/, "\u00A0$1")}
          </h2>
          <p className="mt-6 max-w-[46ch] text-[1rem] leading-relaxed" style={{ color: "var(--bone-soft)" }}>
            Ein Platz, ein Artist, ein Termin nach dem anderen. Kein Durchlauf,
            keine Hektik — wer hier auf der Liege liegt, hat den Raum für sich.
            {" "}{STUDIO.doorNote}
          </p>

          <dl className="mt-10 grid gap-px" style={{ background: "var(--ink-hair)" }}>
            {FACTS.map((fact) => (
              <div
                key={fact.label}
                className="grid gap-1 py-4 sm:grid-cols-[140px_1fr] sm:gap-6"
                style={{ background: "var(--ink)" }}
              >
                <dt className="eyebrow">{fact.label}</dt>
                <dd className="text-sm" style={{ color: "var(--bone-soft)" }}>{fact.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-10 flex flex-wrap gap-3">
            <a href={STUDIO.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
              Route öffnen
            </a>
            <a href={STUDIO.phoneHref} className="btn btn-ghost">{STUDIO.phone}</a>
          </div>
        </Reveal>

        <Reveal delay={0.12}>
          <Parallax distance={60}>
            <div className="relative overflow-hidden" style={{ border: "1px solid var(--ink-hair)" }}>
              <Image
                src={STUDIO_PHOTO.src}
                alt={STUDIO_PHOTO.alt}
                width={STUDIO_PHOTO.width}
                height={STUDIO_PHOTO.height}
                placeholder="blur"
                blurDataURL={STUDIO_PHOTO.blur}
                sizes="(max-width: 1023px) 92vw, 46vw"
                className="w-full"
                loading="lazy"
              />
            </div>
          </Parallax>
        </Reveal>
      </div>
    </section>
  );
}
