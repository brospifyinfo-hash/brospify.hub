// ─── Rahmen aller öffentlichen Seiten ────────────────────────────
// Die Route-Gruppe „(site)" taucht in keiner Adresse auf; sie sorgt nur
// dafür, dass Kopf- und Fußzeile genau hier liegen — und NICHT unter
// /admin, das seine eigene Oberfläche mitbringt.

import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/Sections";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {/* Die Kopfzeile liegt fest über dem Inhalt. Jede Seite setzt ihren
          eigenen oberen Abstand — die Startseite läuft absichtlich unter
          die Leiste, die Unterseiten beginnen darunter. */}
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
