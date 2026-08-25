"use client";

// ─── Kopf einer Unterseite ───────────────────────────────────────
// Einheitlicher Auftakt für alle Seiten außer der Startseite: Rubrik,
// Titel, ein Satz Einordnung. Hält die Seiten als Familie zusammen,
// ohne dass jede ihren eigenen Kopf erfindet.

import { Reveal } from "./motion";

export function PageHead({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <header className="hair-top">
      <div className="shell pb-2 pt-24 md:pb-4 md:pt-28">
        <Reveal>
          <p className="eyebrow mb-4">{eyebrow}</p>
          <h1 className="display display-l max-w-[16ch]">{title}</h1>
          {lead && (
            <p
              className="mt-6 max-w-[56ch] text-[1rem] leading-relaxed"
              style={{ color: "var(--bone-soft)" }}
            >
              {lead}
            </p>
          )}
        </Reveal>
      </div>
    </header>
  );
}
