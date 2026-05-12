"use client";

// ─── /tiers ──────────────────────────────────────────────────────
// User-facing subscription overview. Shows every visible plan from
// the live admin config, highlights the user's current plan,
// surfaces cancellation status, and lets them switch / cancel.
//
// Tier ordering matches TIER_KEYS (starter → pro → business) — no
// "free" since the hub is paid-only.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Check,
  Crown,
  Sparkles,
  Loader2,
  ArrowRight,
  Lock,
  X,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import {
  TIER_KEYS,
  type TierDefinition,
  type TierKey,
  FEATURE_LABELS,
  LIMIT_LABELS,
} from "@/lib/tiers-shared";

interface MeTierResponse {
  tier: TierDefinition | null;
  isAdmin: boolean;
}

interface UserContextInfo {
  tierKey: TierKey | null;
  tierSince: string;
  tierCanceledAt: string;
  isAdmin: boolean;
}

const TIER_VISUALS: Record<TierKey, { gradient: string; accent: string; chip: string }> = {
  starter: {
    gradient: "linear-gradient(180deg, rgba(6,182,212,0.10) 0%, rgba(6,182,212,0.02) 100%)",
    accent: "#06B6D4",
    chip: "bg-cyan-500/15 border-cyan-500/30 text-cyan-200",
  },
  pro: {
    gradient: "linear-gradient(180deg, rgba(168,85,247,0.14) 0%, rgba(168,85,247,0.03) 100%)",
    accent: "#A855F7",
    chip: "bg-purple-500/15 border-purple-500/30 text-purple-200",
  },
  business: {
    gradient: "linear-gradient(180deg, rgba(245,158,11,0.14) 0%, rgba(245,158,11,0.03) 100%)",
    accent: "#F59E0B",
    chip: "bg-amber-500/15 border-amber-500/30 text-amber-200",
  },
};

function formatLimit(n: number): string {
  if (n === -1) return "∞";
  return n.toLocaleString("de-DE");
}

export default function TiersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<TierDefinition[]>([]);
  const [context, setContext] = useState<UserContextInfo>({
    tierKey: null,
    tierSince: "",
    tierCanceledAt: "",
    isAdmin: false,
  });
  const [switching, setSwitching] = useState<TierKey | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/auth/session").then((r) => r.json()),
      fetch("/api/tiers").then((r) => r.json()),
      fetch("/api/me/tier").then((r) => r.json() as Promise<MeTierResponse>),
      fetch("/api/profile").then((r) => r.json()).catch(() => ({})),
    ])
      .then(([session, tiersData, meTier, profile]) => {
        if (!alive) return;
        if (!session.isLoggedIn) {
          router.push("/");
          return;
        }
        const list = Array.isArray(tiersData.tiers) ? tiersData.tiers : [];
        // Order by TIER_KEYS just in case admin saved out-of-order.
        const sorted = [...list].sort(
          (a, b) =>
            (TIER_KEYS as readonly string[]).indexOf(a.key) -
            (TIER_KEYS as readonly string[]).indexOf(b.key),
        );
        setTiers(sorted);
        setContext({
          tierKey: meTier?.tier?.key ?? null,
          tierSince: profile?.tier?.tierSince || profile?.tierSince || "",
          tierCanceledAt: profile?.tier?.tierCanceledAt || profile?.tierCanceledAt || "",
          isAdmin: !!meTier?.isAdmin,
        });
        setLoading(false);
      })
      .catch(() => router.push("/"));
    return () => {
      alive = false;
    };
  }, [router]);

  async function handleSwitch(target: TierKey) {
    // Real plan switching goes through Shopify checkout — for now we
    // just redirect to /credits where the user can pick a payment
    // package, since plans are billed via the storefront. Admins can
    // override via the admin panel.
    setSwitching(target);
    setMessage(null);
    try {
      // Future: replace with a real upgrade API. We surface the
      // tier name to the credits page for tracking purposes.
      router.push(`/credits?plan=${target}`);
    } catch {
      setMessage({ type: "error", text: "Wechsel fehlgeschlagen. Bitte erneut versuchen." });
    } finally {
      setSwitching(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#95BF47]" />
      </div>
    );
  }

  const currentTier = tiers.find((t) => t.key === context.tierKey) || null;
  const canceledOn = context.tierCanceledAt ? new Date(context.tierCanceledAt).toLocaleDateString("de-DE") : "";

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      <div className="fixed top-32 right-8 w-64 h-64 bg-purple-500/[0.06] rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed top-64 left-8 w-48 h-48 bg-cyan-500/[0.05] rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            Abo-Modelle
          </h1>
          <p className="text-[12px] text-zinc-500 mt-1 leading-snug max-w-2xl">
            Wähle den Plan, der zu deinem Shop passt. Du kannst jederzeit upgraden, downgraden oder kündigen.
            Aktuelle Pläne werden monatlich abgerechnet.
          </p>
        </motion.div>

        {/* Current-status banner */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl border p-4 ${
            context.isAdmin
              ? "border-amber-500/30 bg-amber-500/[0.06]"
              : currentTier
                ? "border-[#95BF47]/30 bg-[#95BF47]/[0.05]"
                : "border-zinc-500/30 bg-zinc-500/[0.04]"
          }`}
        >
          <div className="flex items-start gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
              {context.isAdmin ? (
                <Crown className="w-5 h-5 text-amber-400" />
              ) : currentTier ? (
                <Sparkles className="w-5 h-5 text-[#95BF47]" />
              ) : (
                <Lock className="w-5 h-5 text-zinc-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-zinc-500">
                  Dein aktueller Plan
                </span>
                {context.tierCanceledAt && (
                  <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/25">
                    gekündigt {canceledOn}
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold mt-0.5">
                {context.isAdmin
                  ? "Admin-Konto · alle Tiers freigeschaltet"
                  : currentTier
                    ? `${currentTier.label}${currentTier.priceMonthlyEur > 0 ? ` · ${currentTier.priceMonthlyEur} €/Monat` : ""}`
                    : "Kein aktives Abo"}
              </h2>
              {!context.isAdmin && currentTier && context.tierSince && !context.tierCanceledAt && (
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Aktiv seit {new Date(context.tierSince).toLocaleDateString("de-DE")}
                </p>
              )}
              {!context.isAdmin && !currentTier && (
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Wähle unten einen Plan — nur mit aktivem Abo bekommst du Zugriff auf alle Tools.
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Status toast */}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border ${
              message.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                : "bg-red-500/10 border-red-500/20 text-red-300"
            }`}
          >
            {message.type === "success" ? <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <X className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
            <p className="text-xs flex-1">{message.text}</p>
          </motion.div>
        )}

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {tiers.map((tier, idx) => {
            const tk = tier.key as TierKey;
            const visuals = TIER_VISUALS[tk];
            const isCurrent = context.tierKey === tier.key;
            const isUpgrade =
              context.tierKey
                ? (TIER_KEYS as readonly string[]).indexOf(tier.key) >
                  (TIER_KEYS as readonly string[]).indexOf(context.tierKey)
                : true;
            const isDowngrade =
              context.tierKey
                ? (TIER_KEYS as readonly string[]).indexOf(tier.key) <
                  (TIER_KEYS as readonly string[]).indexOf(context.tierKey)
                : false;
            const enabledFeatures = Object.entries(tier.features)
              .filter(([, on]) => on)
              .map(([k]) => k as keyof typeof FEATURE_LABELS);

            return (
              <motion.div
                key={tier.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * idx }}
                className={`relative rounded-2xl border p-4 flex flex-col gap-3 ${
                  isCurrent
                    ? "border-white/25 ring-1 ring-white/15"
                    : tier.highlighted
                      ? "border-white/15"
                      : "border-white/[0.08]"
                }`}
                style={{
                  background: visuals.gradient,
                  boxShadow: isCurrent
                    ? `0 0 0 2px ${visuals.accent}50, 0 20px 40px -20px ${visuals.accent}30`
                    : tier.highlighted
                      ? `inset 0 0 0 1px ${visuals.accent}20`
                      : undefined,
                }}
              >
                {/* Top badges */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[9px] uppercase tracking-[0.16em] font-bold px-2 py-0.5 rounded border ${visuals.chip}`}
                  >
                    {tk === "business" && <Crown className="w-2.5 h-2.5 inline mr-1" />}
                    {tier.label}
                  </span>
                  {tier.highlighted && !isCurrent && (
                    <span className="text-[8px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Empfohlen
                    </span>
                  )}
                  {isCurrent && (
                    <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#95BF47]/20 text-[#95BF47] border border-[#95BF47]/30 inline-flex items-center gap-1">
                      <Check className="w-2.5 h-2.5" />
                      Aktuell
                    </span>
                  )}
                </div>

                {/* Price */}
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold tabular-nums">{tier.priceMonthlyEur}</span>
                    <span className="text-xs text-zinc-500">€/Monat</span>
                  </div>
                  {tier.priceYearlyEur > 0 && (
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      oder {tier.priceYearlyEur} €/Jahr ({Math.round(((tier.priceMonthlyEur * 12 - tier.priceYearlyEur) / (tier.priceMonthlyEur * 12)) * 100)}% Rabatt)
                    </p>
                  )}
                  <p className="text-[11px] text-zinc-400 mt-1.5 leading-snug">{tier.tagline}</p>
                </div>

                {/* Bullets */}
                {tier.bullets.length > 0 && (
                  <ul className="space-y-1.5 border-y border-white/[0.05] py-2.5">
                    {tier.bullets.slice(0, 6).map((b, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-zinc-300 leading-snug">
                        <Check className="w-3 h-3 mt-0.5 shrink-0" style={{ color: visuals.accent }} />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Limits + Credits */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10.5px]">
                    <span className="text-zinc-500">Monatliche Credits</span>
                    <span className="text-zinc-200 font-mono">
                      {tier.monthlyCreditAllowance > 0
                        ? tier.monthlyCreditAllowance.toLocaleString("de-DE")
                        : "—"}
                    </span>
                  </div>
                  <details className="group">
                    <summary className="text-[10px] text-zinc-500 cursor-pointer hover:text-zinc-300 select-none">
                      Limits anzeigen
                    </summary>
                    <div className="mt-1.5 space-y-1 text-[10px] text-zinc-500">
                      {(Object.keys(tier.limits) as (keyof typeof LIMIT_LABELS)[]).map((k) => (
                        <div key={k} className="flex justify-between gap-2">
                          <span className="truncate">{LIMIT_LABELS[k]}</span>
                          <span className="font-mono text-zinc-300 tabular-nums shrink-0">
                            {formatLimit(tier.limits[k])}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                  <details className="group">
                    <summary className="text-[10px] text-zinc-500 cursor-pointer hover:text-zinc-300 select-none">
                      Features anzeigen
                    </summary>
                    <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
                      {enabledFeatures.map((f) => (
                        <div key={f} className="flex items-center gap-1 text-zinc-300">
                          <Check className="w-2.5 h-2.5 shrink-0" style={{ color: visuals.accent }} />
                          <span className="truncate">{FEATURE_LABELS[f]}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>

                {/* CTA */}
                <div className="mt-auto pt-1">
                  {context.isAdmin ? (
                    <span className="block text-center text-[10px] text-zinc-500 py-2">
                      Als Admin alle Pläne verfügbar.
                    </span>
                  ) : isCurrent ? (
                    <button
                      disabled
                      className="w-full px-4 py-2.5 rounded-xl text-xs font-bold border border-[#95BF47]/30 bg-[#95BF47]/15 text-[#95BF47] inline-flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Dein aktiver Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSwitch(tk)}
                      disabled={switching === tk}
                      className="w-full px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition"
                      style={{
                        background: isUpgrade ? visuals.accent : "rgba(255,255,255,0.04)",
                        color: isUpgrade ? "#0a1604" : "#e4e4e7",
                        border: isUpgrade ? "none" : "1px solid rgba(255,255,255,0.10)",
                      }}
                    >
                      {switching === tk ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          {tier.ctaLabel || (isUpgrade ? "Upgrade" : isDowngrade ? "Downgrade" : "Wechseln")}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Footnote */}
        <p className="text-[10px] text-zinc-600 text-center max-w-2xl mx-auto leading-relaxed mt-2">
          Plan-Wechsel werden über deinen Shopify-Store abgewickelt. Bei Fragen zum Wechsel oder zur
          Kündigung wende dich an den Support — wir helfen schnell weiter.
        </p>
      </div>
    </div>
  );
}
