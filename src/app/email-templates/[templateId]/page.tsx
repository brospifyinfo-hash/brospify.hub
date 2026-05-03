// ─── Legacy /email-templates/[templateId] redirect ───────────────
// The per-template editor has been merged into the single-page
// Email Studio at /email-templates. We forward the templateId as
// the ?reason= query parameter so deep links and bookmarks keep
// landing on the right email.

import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ templateId: string }>;
}

export default async function LegacyTemplateRedirect({ params }: PageProps) {
  const { templateId } = await params;
  const safe = encodeURIComponent(templateId);
  redirect(`/email-templates?reason=${safe}`);
}
