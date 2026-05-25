"use client";

// ─── Globaler App-Footer ─────────────────────────────────────────
// Dezent, auf JEDER Seite sichtbar via app/layout.tsx. Enthaelt die
// Brospify-rechtlichen Pflicht-Links (Impressum, Datenschutz, AGB,
// Widerruf). Bewusst klein gehalten damit er Content nicht erschlaegt.
//
// usePathname → wir blenden Footer auf bestimmten Routen aus
// (z.B. Onboarding-Wizard wo der Content full-bleed bis unten geht).

import Link from "next/link";
import { usePathname } from "next/navigation";

const APP_VERSION = "1.0";

const HIDDEN_ON: ReadonlyArray<string> = [
  "/onboarding", // Full-bleed Wizard ohne Footer-Ablenkung
];

interface FooterLink {
  href: string;
  label: string;
}

const LEGAL_LINKS: FooterLink[] = [
  { href: "https://brospify.com/policies/legal-notice", label: "Impressum" },
  { href: "https://brospify.com/policies/privacy-policy", label: "Datenschutz" },
  { href: "https://brospify.com/policies/terms-of-service", label: "AGB" },
  { href: "https://brospify.com/policies/refund-policy", label: "Widerruf" },
];

export default function AppFooter() {
  const pathname = usePathname();

  if (HIDDEN_ON.some((p) => pathname?.startsWith(p))) return null;

  return (
    <footer
      className="mt-auto border-t border-white/[0.04] bg-zinc-950/40 backdrop-blur-sm"
      // pb-bottom-tab-bar Spacing: bottom nav (mobile) ist 56px hoch,
      // damit der Footer nicht unter der Bar versteckt wird.
      style={{ paddingBottom: "calc(var(--safe-bottom, 0px) + 64px)" }}
    >
      <div className="max-w-7xl mx-auto px-4 py-5 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[11px]">
          {/* Brand + Version */}
          <div className="flex items-center gap-2 text-zinc-600">
            <span className="font-semibold text-zinc-500">Brospify Hub</span>
            <span className="text-zinc-700">·</span>
            <span className="font-mono">v{APP_VERSION}</span>
          </div>

          {/* Legal links */}
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-zinc-500">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-300 transition"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
