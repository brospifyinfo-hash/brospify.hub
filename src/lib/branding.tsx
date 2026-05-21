"use client";

import { useState, useEffect } from "react";

interface BrandingData {
  logoUrl: string;
  brandName: string;
  brandAccent: string;
  loading: boolean;
}

interface CachedBranding {
  logoUrl: string;
  brandName: string;
  brandAccent: string;
}

let cached: CachedBranding | null = null;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((fn) => fn());
}

async function fetchBranding(): Promise<CachedBranding> {
  try {
    const res = await fetch("/api/branding", { cache: "no-store" });
    if (!res.ok) return { logoUrl: "", brandName: "", brandAccent: "" };
    const data = await res.json();
    return {
      logoUrl: typeof data.logoUrl === "string" ? data.logoUrl : "",
      brandName: typeof data.brandName === "string" ? data.brandName : "",
      brandAccent: typeof data.brandAccent === "string" ? data.brandAccent : "",
    };
  } catch {
    return { logoUrl: "", brandName: "", brandAccent: "" };
  }
}

// Listen for cross-tab updates from admin save
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    const ch = new BroadcastChannel("brospify-branding");
    ch.onmessage = (e) => {
      if (e.data && e.data.type === "refresh") {
        cached = null;
        fetchBranding().then((data) => {
          cached = data;
          notifySubscribers();
        });
      }
    };
  } catch { /* BroadcastChannel not available */ }
}

export function useBranding(): BrandingData {
  const [data, setData] = useState<CachedBranding>(
    cached || { logoUrl: "", brandName: "", brandAccent: "" }
  );
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    let mounted = true;

    const sub = () => {
      if (mounted && cached) setData(cached);
    };
    subscribers.add(sub);

    if (cached) {
      setData(cached);
      setLoading(false);
    } else {
      fetchBranding().then((d) => {
        cached = d;
        if (mounted) {
          setData(d);
          setLoading(false);
        }
      });
    }

    return () => {
      mounted = false;
      subscribers.delete(sub);
    };
  }, []);

  return { ...data, loading };
}

// Call this from the admin page after a successful settings save to push
// the new logo/brand to every tab + the current page without a hard reload.
export function refreshBranding() {
  cached = null;
  fetchBranding().then((data) => {
    cached = data;
    notifySubscribers();
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        const ch = new BroadcastChannel("brospify-branding");
        ch.postMessage({ type: "refresh" });
        ch.close();
      } catch { /* ignore */ }
    }
  });
}

// The Brospify wordmark logo. Renders the admin-uploaded logo when one
// is set, otherwise the bundled default (public/brospify-logo.png).
// Always an image — no text wordmark, no placeholder icon.
export function BrandLogo({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const { logoUrl } = useBranding();

  const heightMap = {
    sm: "h-5",
    md: "h-7",
    lg: "h-10",
    xl: "h-16 sm:h-20",
  };

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={logoUrl || "/brospify-logo.png"}
      alt="Logo"
      className={`${heightMap[size]} w-auto object-contain ${className}`}
    />
  );
}
