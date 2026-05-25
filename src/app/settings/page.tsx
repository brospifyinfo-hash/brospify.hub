"use client";

// ─── /settings (Legacy → /account/*) ─────────────────────────────
// Die alte Sammelseite wurde in 3 eigenstaendige Seiten gesplittet.
// Diese Mini-Page leitet automatisch auf die passende neue Route um,
// inkl. Hash-Erkennung damit alte Bookmarks weiter funktionieren:
//
//   /settings              → /account/settings
//   /settings#account      → /account/settings
//   /settings#shopify      → /account/shopify
//   /settings#plan         → /account/subscription
//
// Bewusst client-side weil Server-Components keinen Hash sehen.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const HASH_MAP: Record<string, string> = {
  account: "/account/settings",
  shopify: "/account/shopify",
  plan: "/account/subscription",
  // Legacy Hashes, die es mal gab:
  brand: "/account/settings",
  legal: "/account/settings",
};

export default function SettingsLegacyRedirect() {
  const router = useRouter();
  useEffect(() => {
    const hash = (window.location.hash || "").replace("#", "").trim().toLowerCase();
    const target = HASH_MAP[hash] || "/account/settings";
    router.replace(target);
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
