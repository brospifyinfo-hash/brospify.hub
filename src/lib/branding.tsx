"use client";

import { useState, useEffect } from "react";

interface BrandingData {
  logoUrl: string;
  brandName: string;
  loading: boolean;
}

let cachedLogoUrl: string | null = null;

export function useBranding(): BrandingData {
  const [logoUrl, setLogoUrl] = useState(cachedLogoUrl || "");
  const [loading, setLoading] = useState(!cachedLogoUrl);

  useEffect(() => {
    if (cachedLogoUrl !== null) {
      setLogoUrl(cachedLogoUrl);
      setLoading(false);
      return;
    }

    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: { logoUrl?: string }) => {
        const url = data.logoUrl || "";
        cachedLogoUrl = url;
        setLogoUrl(url);
      })
      .catch(() => {
        cachedLogoUrl = "";
      })
      .finally(() => setLoading(false));
  }, []);

  return { logoUrl, brandName: "Hub", loading };
}

export function BrandLogo({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const { logoUrl } = useBranding();

  const sizeMap = {
    sm: "w-6 h-6",
    md: "w-8 h-8 md:w-9 md:h-9",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
  };

  const iconSize = sizeMap[size];

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt="Logo"
        className={`${iconSize} object-contain rounded-xl ${className}`}
      />
    );
  }

  // Neutral placeholder when no logo is uploaded
  return (
    <div
      className={`${iconSize} rounded-xl bg-[#95BF47]/15 border border-[#95BF47]/25 flex items-center justify-center ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-1/2 h-1/2 text-[#95BF47]"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    </div>
  );
}
