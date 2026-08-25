// ─── Studio-Dashboard (geschützt) ────────────────────────────────
// Der Zugriffsschutz sitzt hier serverseitig: ohne gültige Session
// wird umgeleitet, bevor überhaupt HTML entsteht. Die API-Routen
// prüfen zusätzlich jede einzelne Anfrage — eine umgeleitete Seite
// allein wäre keine Absicherung.

import { redirect } from "next/navigation";
import { isStudioAdmin } from "@/lib/auth";
import { Dashboard } from "@/components/admin/Dashboard";
import { STUDIO } from "@/lib/studio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Studio-Dashboard", robots: { index: false, follow: false } };

export default async function StudioAdminPage() {
  if (!(await isStudioAdmin())) redirect("/admin/login");
  return <Dashboard studioName={STUDIO.name} />;
}
