// ─── Terminvereinbarung ──────────────────────────────────────────
// Auf dieser Seite geht es ausschließlich um den Termin: wie der Ablauf
// aussieht und welche Zeiten frei sind. Keine Preise, keine Galerie,
// keine allgemeinen Fragen — die stehen auf ihren eigenen Seiten.

import type { Metadata } from "next";
import { BookingWidget } from "@/components/BookingWidget";
import { PageHead } from "@/components/PageHead";
import { Process } from "@/components/Sections";
import { readData } from "@/lib/store";
import { STUDIO } from "@/lib/studio";
import { todayKey } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Termin buchen",
  description: `Freie Beratungstermine bei ${STUDIO.name} in ${STUDIO.city} online ansehen und unverbindlich anfragen.`,
  alternates: { canonical: "/termin" },
};

async function countOpenSlots(): Promise<number> {
  try {
    const { slots } = await readData();
    const today = todayKey();
    return slots.filter((s) => s.status === "open" && s.date >= today).length;
  } catch {
    return 0;
  }
}

export default async function TerminPage() {
  const offen = await countOpenSlots();

  return (
    <>
      <PageHead
        eyebrow="Termin"
        title="Termin buchen"
        lead="Im Kalender stehen ausschließlich Termine, die freigegeben wurden. Jeder davon ist ein kostenloser Beratungstermin — gestochen wird an dem Tag noch nicht."
        meta={offen > 0 ? `${offen} ${offen === 1 ? "freier Termin" : "freie Termine"}` : undefined}
      />
      <Process />
      <BookingWidget />
    </>
  );
}
