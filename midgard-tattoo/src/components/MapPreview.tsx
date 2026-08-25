"use client";

// ─── Kartenvorschau ──────────────────────────────────────────────
// Google Maps lädt beim Einbetten Skripte, Schriften und Bilder von
// Google-Servern und setzt Cookies. Das darf in Deutschland nicht
// ungefragt passieren. Deshalb steht hier zuerst eine eigene, statische
// Vorschau — erst ein Klick holt die echte Karte.
//
// Bis dahin verlässt kein einziger Request die eigene Domain. Wer gar
// nicht klicken will, kommt über „In Google Maps öffnen" trotzdem ans
// Ziel; dieser Link ist ein normaler Verweis und lädt hier nichts nach.

import { useState } from "react";
import { STUDIO } from "@/lib/studio";

const QUERY = encodeURIComponent(
  `${STUDIO.name}, ${STUDIO.street}, ${STUDIO.zip} ${STUDIO.city}`,
);

export function MapPreview() {
  const [geladen, setGeladen] = useState(false);

  return (
    <figure className="overflow-hidden" style={{ border: "1px solid var(--ink-hair)" }}>
      <div className="relative aspect-[16/10] w-full">
        {geladen ? (
          <iframe
            // Der Einbettungs-Modus ohne API-Schlüssel. `loading="lazy"`
            // schadet hier nicht — geladen wird ohnehin erst auf Klick.
            src={`https://maps.google.com/maps?q=${QUERY}&hl=de&z=16&output=embed`}
            title={`Karte: ${STUDIO.name}, ${STUDIO.street}, ${STUDIO.zip} ${STUDIO.city}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0 h-full w-full"
            style={{ border: 0 }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setGeladen(true)}
            className="group absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center"
            style={{ background: "var(--ink-card)" }}
          >
            {/* Eigene, sehr schlichte Stadtplan-Andeutung: ein paar
                Straßen und ein Punkt. Kein Kartenmaterial, keine
                fremden Daten — nur ein Hinweis darauf, was hier kommt. */}
            <svg
              aria-hidden
              viewBox="0 0 400 250"
              className="absolute inset-0 h-full w-full opacity-[0.35]"
              preserveAspectRatio="xMidYMid slice"
            >
              <g stroke="var(--ink-hair-strong)" strokeWidth="1.5" fill="none">
                <path d="M-20 70 L420 40" />
                <path d="M-20 170 L420 150" />
                <path d="M90 -20 L120 270" />
                <path d="M250 -20 L230 270" />
                <path d="M340 -20 L360 270" />
              </g>
              <g stroke="var(--ink-hair)" strokeWidth="1" fill="none">
                <path d="M-20 115 L420 100" />
                <path d="M170 -20 L180 270" />
              </g>
            </svg>

            <span
              aria-hidden
              className="relative flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110"
              style={{ background: "var(--signal)", color: "#131200" }}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
              </svg>
            </span>

            <span className="relative">
              <span className="display block text-lg">Karte laden</span>
              <span className="mt-2 block max-w-[38ch] text-xs leading-relaxed" style={{ color: "var(--bone-dim)" }}>
                Beim Laden stellt dein Browser eine Verbindung zu Google her.
                Dabei werden deine IP-Adresse und Gerätedaten übertragen.
              </span>
            </span>
          </button>
        )}
      </div>

      <figcaption className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <span style={{ color: "var(--bone-soft)" }}>
          {STUDIO.street} · {STUDIO.zip} {STUDIO.city}
        </span>
        <a
          href={STUDIO.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4"
          style={{ color: "var(--signal)" }}
        >
          In Google Maps öffnen
        </a>
      </figcaption>
    </figure>
  );
}
