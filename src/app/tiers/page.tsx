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

// Bronze / Silber / Gold visual identity — matched to the tier names
// the admin uses ("Bronze", "Silber", "Gold").
const TIER_VISUALS: Record<TierKey, { gradient: string; accent: string; chip: string; ring: string; metal: string }> = {
  // Bronze
  starter: {
    gradient:
      "linear-gradient(165deg, rgba(180,83,9,0.18) 0%, rgba(120,53,15,0.05) 60%, rgba(0,0,0,0) 100%)",
    accent: "#D97706",
    chip: "bg-amber-700/20 border-amber-700/40 text-amber-200",
    ring: "rgba(217,119,6,0.55)",
    metal: "linear-gradient(135deg, #c2410c 0%, #b45309 40%, #92400e 100%)",
  },
  // Silber
  pro: {
    gradient:
      "linear-gradient(165deg, rgba(226,232,240,0.16) 0%, rgba(148,163,184,0.08) 60%, rgba(0,0,0,0) 100%)",
    accent: "#CBD5E1",
    chip: "bg-slate-300/20 border-slate-300/40 text-slate-100",
    ring: "rgba(203,213,225,0.65)",
    metal: "linear-gradient(135deg, #e2e8f0 0%, #94a3b8 50%, #64748b 100%)",
  },
  // Gold
  business: {
    gradient:
      "linear-gradient(165deg, rgba(250,204,21,0.20) 0%, rgba(202,138,4,0.08) 60%, rgba(0,0,0,0) 100%)",
    accent: "#FACC15",
    chip: "bg-yellow-400/20 border-yellow-400/40 text-yellow-100",
    ring: "rgba(250,204,21,0.75)",
    metal: "linear-gradient(135deg, #fde047 0%, #facc15 35%, #ca8a04 100%)",
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

  function handleSwitch(target: TierKey, ctaUrl?: string) {
    // If the admin set a custom CTA URL (e.g. Shopify checkout permalink),
    // route there. External URLs open in a new tab; internal stay in-app.
    setSwitching(target);
    setMessage(null);
    try {
      const trimmed = (ctaUrl || "").trim();
      if (trimmed) {
        if (/^https?:\/\//i.test(trimmed)) {
          window.open(trimmed, "_blank", "noopener,noreferrer");
        } else {
          router.push(trimmed);
        }
      } else {
        router.push(`/credits?plan=${target}`);
      }
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
  const currentTierVisuals = currentTier ? TIER_VISUALS[currentTier.key as TierKey] : null;
  const canceledOn = context.tierCanceledAt ? new Date(context.tierCanceledAt).toLocaleDateString("de-DE") : "";

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      {/* Atmospheric glows */}
      <div className="fixed top-32 right-8 w-80 h-80 bg-yellow-500/[0.07] rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed top-72 left-8 w-72 h-72 bg-amber-700/[0.06] rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-32 right-20 w-56 h-56 bg-slate-300/[0.04] rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-5">
        {/* Hero header */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center pt-2 pb-1"
        >
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] font-bold text-amber-300/90 mb-2">
            <Crown className="w-3 h-3" />
            Brospify Hub · Abo-Modelle
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Wähle deinen Plan
          </h1>
          <p className="text-[12px] sm:text-sm text-zinc-400 mt-2 leading-snug max-w-xl mx-auto">
            Drei Stufen — <span className="text-amber-700/90 font-semibold">Bronze</span>,{" "}
            <span className="text-slate-300 font-semibold">Silber</span>,{" "}
            <span className="text-yellow-400 font-semibold">Gold</span>. Jederzeit upgraden, downgraden oder kündigen.
          </p>
        </motion.div>

        {/* Current-status banner — much more prominent when actively subscribed */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl overflow-hidden border border-white/[0.08]"
          style={{
            background: context.isAdmin
              ? "linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(0,0,0,0) 100%)"
              : currentTier
                ? `linear-gradient(135deg, ${currentTierVisuals?.accent ?? "#95BF47"}25 0%, rgba(0,0,0,0) 100%)`
                : "linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(0,0,0,0) 100%)",
            boxShadow: currentTier && !context.tierCanceledAt
              ? `inset 0 0 0 1px ${currentTierVisuals?.ring ?? "rgba(149,191,71,0.3)"}`
              : undefined,
          }}
        >
          <div className="p-4 flex items-start gap-3 flex-wrap">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-white/[0.10]"
              style={{
                background: currentTier && !context.tierCanceledAt
                  ? currentTierVisuals?.metal
                  : "rgba(255,255,255,0.04)",
                boxShadow: currentTier && !context.tierCanceledAt
                  ? `0 4px 16px -4px ${currentTierVisuals?.accent}80`
                  : undefined,
              }}
            >
              {context.isAdmin ? (
                <Crown className="w-6 h-6 text-amber-300" />
              ) : currentTier ? (
                <Crown className="w-6 h-6 text-white" />
              ) : (
                <Lock className="w-5 h-5 text-zinc-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-zinc-400">
                  {context.isAdmin
                    ? "Admin-Konto"
                    : currentTier && !context.tierCanceledAt
                      ? "Aktives Abo"
                      : currentTier && context.tierCanceledAt
                        ? "Abo gekündigt"
                        : "Kein aktives Abo"}
                </span>
                {context.tierCanceledAt && (
                  <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/25">
                    seit {canceledOn}
                  </span>
                )}
                {currentTier && !context.tierCanceledAt && !context.isAdmin && (
                  <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    aktiv
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold mt-0.5">
                {context.isAdmin
                  ? "alle Tiers freigeschaltet"
                  : currentTier
                    ? `${currentTier.label}${currentTier.priceMonthlyEur > 0 ? ` · ${currentTier.priceMonthlyEur} €/Monat` : ""}`
                    : "Du hast aktuell keinen Plan"}
              </h2>
              {!context.isAdmin && currentTier && context.tierSince && !context.tierCanceledAt && (
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Aktiv seit {new Date(context.tierSince).toLocaleDateString("de-DE")} ·
                  Du nutzt alle Funktionen ohne Einschränkung.
                </p>
              )}
              {!context.isAdmin && currentTier && context.tierCanceledAt && (
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Zugang bleibt bis zum Ende der Laufzeit aktiv — danach werden alle Premium-Features gesperrt.
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
                className={`relative rounded-2xl border overflow-hidden flex flex-col ${
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
                {/* Plan-Bild (Hero) */}
                <div
                  className="relative aspect-video w-full overflow-hidden border-b border-white/[0.06]"
                  style={{
                    background: tier.imageUrl ? "#0a0a0a" : visuals.metal,
                  }}
                >
                  {tier.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={tier.imageUrl}
                      alt={tier.label}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                      <Crown className="w-12 h-12 text-white/70 drop-shadow-lg" />
                      <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/80">
                        {tier.label}
                      </span>
                    </div>
                  )}
                  {/* Metallic sheen overlay */}
                  <div
                    className="absolute inset-0 pointer-events-none mix-blend-overlay"
                    style={{
                      background:
                        "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%)",
                    }}
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: "linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.65) 100%)",
                    }}
                  />
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] uppercase tracking-[0.16em] font-bold px-2 py-0.5 rounded border backdrop-blur ${visuals.chip}`}
                    >
                      <Crown className="w-2.5 h-2.5 inline mr-1" />
                      {tier.label}
                    </span>
                    {tier.highlighted && !isCurrent && (
                      <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/40 backdrop-blur text-amber-100 border border-amber-400/50">
                        ★ Empfohlen
                      </span>
                    )}
                    {isCurrent && (
                      <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/40 backdrop-blur text-emerald-100 border border-emerald-400/50 inline-flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" />
                        Aktiv
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 flex flex-col gap-3 flex-1">

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
                      onClick={() => handleSwitch(tk, tier.ctaUrl)}
                      disabled={switching === tk}
                      className="w-full px-4 py-3 rounded-xl text-[13px] font-bold inline-flex items-center justify-center gap-2 transition active:scale-[0.98]"
                      style={{
                        background: isUpgrade ? visuals.metal : "rgba(255,255,255,0.05)",
                        color: isUpgrade
                          ? tk === "starter"
                            ? "#fff7ed"
                            : tk === "pro"
                              ? "#0f172a"
                              : "#422006"
                          : "#e4e4e7",
                        border: isUpgrade ? "none" : "1px solid rgba(255,255,255,0.10)",
                        boxShadow: isUpgrade
                          ? `0 12px 28px -10px ${visuals.accent}A0, inset 0 1px 0 rgba(255,255,255,0.25)`
                          : undefined,
                        textShadow: isUpgrade && tk === "starter" ? "0 1px 0 rgba(0,0,0,0.25)" : undefined,
                      }}
                    >
                      {switching === tk ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          {tier.ctaLabel || (isUpgrade ? "Jetzt buchen" : isDowngrade ? "Downgrade" : "Wechseln")}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  )}
                </div>
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
