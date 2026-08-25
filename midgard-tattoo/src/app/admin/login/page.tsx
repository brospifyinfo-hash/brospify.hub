// ─── Anmeldung zum Studio-Dashboard ──────────────────────────────
// Server-Komponente: wer schon angemeldet ist, landet direkt im
// Dashboard, statt sich ein zweites Mal anzumelden.

import { redirect } from "next/navigation";
import { isStudioAdmin, isStudioAdminConfigured } from "@/lib/auth";
import { LoginForm } from "@/components/admin/LoginForm";
import { STUDIO } from "@/lib/studio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Studio-Login", robots: { index: false, follow: false } };

export default async function StudioLoginPage() {
  if (await isStudioAdmin()) redirect("/admin");
  return <LoginForm configured={isStudioAdminConfigured()} studioName={STUDIO.name} />;
}
