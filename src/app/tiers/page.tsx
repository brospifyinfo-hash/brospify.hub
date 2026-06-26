"use client";

// ─── /tiers ──────────────────────────────────────────────────────
// Single-plan membership page. We used to ship Bronze/Silber/Gold;
// the Hub is now one membership, so this page is just a status block
// + one plan card with a CTA. Admins always see everything unlocked.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Check,
  Crown,
  Loader2,
  ArrowRight,
  Lock,
  X,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { useI18n } from "@/lib/i18n";
import {
  type TierDefinition,
  FEATURE_LABELS,
  LIMIT_LABELS,
} from "@/lib/tiers-shared";

interface MeTierResponse {
  tier: TierDefinition | null;
  isAdmin: boolean;
}

interface UserContextInfo {
  hasTier: boolean;
  tierSince: string;
  tierCanceledAt: string;
  isAdmin: boolean;
}

function formatLimit(n: number): string {
  if (n === -1) return "∞";
  return n.toLocaleString("de-DE");
}

export default function TiersPage() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const dateLocale = lang === "en" ? "en-GB" : "de-DE";
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<TierDefinition | null>(null);
  const [context, setContext] = useState<UserContextInfo>({
    hasTier: false,
    tierSince: "",
    tierCanceledAt: "",
    isAdmin: false,
  });
  const [switching, setSwitching] = useState(false);
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
        const single: TierDefinition | null = list[0] ?? null;
        setPlan(single);
        setContext({
          hasTier: !!meTier?.tier,
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

  function handleBook(ctaUrl?: string) {
    setSwitching(true);
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
        router.push(`/credits?plan=pro`);
      }
    } catch {
      setMessage({ type: "error", text: t.tiers.errSwitch });
    } finally {
      setSwitching(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#95BF47]" />
      </div>
    );
  }

  const canceledOn = context.tierCanceledAt ? new Date(context.tierCanceledAt).toLocaleDateString(dateLocale) : "";
  const enabledFeatures = plan
    ? Object.entries(plan.features)
        .filter(([, on]) => on)
        .map(([k]) => k as keyof typeof FEATURE_LABELS)
    : [];

  // Gold-ish single metal palette — premium feel without competing tiers.
  const accent = "#FACC15";
  const ring = "rgba(250,204,21,0.75)";
  const metal = "linear-gradient(135deg, #fde047 0%, #facc15 35%, #ca8a04 100%)";

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      {/* Atmospheric glows */}
      <div className="fixed top-32 right-8 w-80 h-80 bg-yellow-500/[0.07] rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed top-72 left-8 w-72 h-72 bg-amber-700/[0.06] rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-3xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-5">
        {/* Hero header */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center pt-2 pb-1"
        >
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] font-bold text-amber-300/90 mb-2">
            <Crown className="w-3 h-3" />
            Brospify Hub · Membership
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {t.tiers.title}
          </h1>
          <p className="text-[12px] sm:text-sm text-zinc-400 mt-2 leading-snug max-w-xl mx-auto">
            {t.tiers.subtitle}
          </p>
        </motion.div>

        {/* Status banner */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl overflow-hidden border border-white/[0.08]"
          style={{
            background: context.isAdmin
              ? "linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(0,0,0,0) 100%)"
              : context.hasTier
                ? `linear-gradient(135deg, ${accent}25 0%, rgba(0,0,0,0) 100%)`
                : "linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(0,0,0,0) 100%)",
            boxShadow: context.hasTier && !context.tierCanceledAt
              ? `inset 0 0 0 1px ${ring}`
              : undefined,
          }}
        >
          <div className="p-4 flex items-start gap-3 flex-wrap">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-white/[0.10]"
              style={{
                background: context.hasTier && !context.tierCanceledAt
                  ? metal
                  : "rgba(255,255,255,0.04)",
                boxShadow: context.hasTier && !context.tierCanceledAt
                  ? `0 4px 16px -4px ${accent}80`
                  : undefined,
              }}
            >
              {context.isAdmin ? (
                <Crown className="w-6 h-6 text-amber-300" />
              ) : context.hasTier ? (
                <Crown className="w-6 h-6" style={{ color: "#422006" }} />
              ) : (
                <Lock className="w-5 h-5 text-zinc-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-zinc-400">
                  {context.isAdmin
                    ? t.tiers.statusAdmin
                    : context.hasTier && !context.tierCanceledAt
                      ? t.tiers.statusActive
                      : context.hasTier && context.tierCanceledAt
                        ? t.tiers.statusCanceled
                        : t.tiers.statusNone}
                </span>
                {context.tierCanceledAt && (
                  <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/25">
                    {t.tiers.since} {canceledOn}
                  </span>
                )}
                {context.hasTier && !context.tierCanceledAt && !context.isAdmin && (
                  <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {t.tiers.activeShort}
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold mt-0.5">
                {context.isAdmin
                  ? t.tiers.adminAllUnlocked
                  : context.hasTier && plan
                    ? `${plan.label}${plan.priceMonthlyEur > 0 ? ` · ${plan.priceMonthlyEur} €${t.tiers.perMonth}` : ""}`
                    : t.tiers.unlockAll}
              </h2>
              {!context.isAdmin && context.hasTier && context.tierSince && !context.tierCanceledAt && (
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {t.tiers.activeSincePrefix} {new Date(context.tierSince).toLocaleDateString(dateLocale)} · {t.tiers.activeSinceNote}
                </p>
              )}
              {!context.isAdmin && context.hasTier && context.tierCanceledAt && (
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {t.tiers.canceledNote}
                </p>
              )}
              {!context.isAdmin && !context.hasTier && (
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {t.tiers.noneNote}
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

        {/* The one plan card */}
        {plan && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-2xl border overflow-hidden flex flex-col border-white/15"
            style={{
              background: "linear-gradient(165deg, rgba(250,204,21,0.18) 0%, rgba(202,138,4,0.06) 60%, rgba(0,0,0,0) 100%)",
              boxShadow: context.hasTier && !context.tierCanceledAt
                ? `0 0 0 2px ${accent}50, 0 20px 40px -20px ${accent}30`
                : `inset 0 0 0 1px ${accent}20`,
            }}
          >
            {/* Hero image / gradient */}
            <div
              className="relative aspect-[2.4] w-full overflow-hidden border-b border-white/[0.06]"
              style={{ background: plan.imageUrl ? "#0a0a0a" : metal }}
            >
              {plan.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={plan.imageUrl}
                  alt={plan.label}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <Crown className="w-16 h-16 text-white/85 drop-shadow-lg" />
                  <span className="text-[12px] uppercase tracking-[0.2em] font-bold text-white/90">
                    {plan.label}
                  </span>
                </div>
              )}
              <div
                className="absolute inset-0 pointer-events-none mix-blend-overlay"
                style={{
                  background:
                    "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%)",
                }}
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: "linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.65) 100%)" }}
              />
              <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-[0.16em] font-bold px-2 py-0.5 rounded border backdrop-blur bg-yellow-400/20 border-yellow-400/40 text-yellow-100">
                  <Crown className="w-2.5 h-2.5 inline mr-1" />
                  {plan.label}
                </span>
                {context.hasTier && !context.tierCanceledAt && (
                  <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/40 backdrop-blur text-emerald-100 border border-emerald-400/50 inline-flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" />
                    Aktiv
                  </span>
                )}
              </div>
            </div>

            <div className="p-5 sm:p-6 flex flex-col gap-4 flex-1">
              {/* Price */}
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold tabular-nums">{plan.priceMonthlyEur}</span>
                  <span className="text-sm text-zinc-500">€{t.tiers.perMonth}</span>
                </div>
                {plan.priceYearlyEur > 0 && plan.priceMonthlyEur > 0 && (
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {lang === "en" ? "or" : "oder"} {plan.priceYearlyEur} €{lang === "en" ? "/year" : "/Jahr"} ({Math.round(((plan.priceMonthlyEur * 12 - plan.priceYearlyEur) / (plan.priceMonthlyEur * 12)) * 100)}% {lang === "en" ? "off" : "Rabatt"})
                  </p>
                )}
                <p className="text-[12px] text-zinc-400 mt-1.5 leading-snug">{plan.tagline}</p>
              </div>

              {/* Bullets */}
              {plan.bullets.length > 0 && (
                <ul className="space-y-2 border-y border-white/[0.05] py-3">
                  {plan.bullets.slice(0, 8).map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12.5px] text-zinc-200 leading-snug">
                      <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: accent }} />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Limits + Features (details) */}
              <div className="space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-500">{t.tiers.monthlyCredits}</span>
                  <span className="text-zinc-200 font-mono">
                    {plan.monthlyCreditAllowance > 0
                      ? plan.monthlyCreditAllowance.toLocaleString("de-DE")
                      : "—"}
                  </span>
                </div>
                <details className="group">
                  <summary className="text-[11px] text-zinc-500 cursor-pointer hover:text-zinc-300 select-none">
                    {t.tiers.showLimits}
                  </summary>
                  <div className="mt-1.5 space-y-1 text-[11px] text-zinc-500">
                    {(Object.keys(plan.limits) as (keyof typeof LIMIT_LABELS)[]).map((k) => (
                      <div key={k} className="flex justify-between gap-2">
                        <span className="truncate">{LIMIT_LABELS[k]}</span>
                        <span className="font-mono text-zinc-300 tabular-nums shrink-0">
                          {formatLimit(plan.limits[k])}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
                <details className="group">
                  <summary className="text-[11px] text-zinc-500 cursor-pointer hover:text-zinc-300 select-none">
                    {t.tiers.showFeatures}
                  </summary>
                  <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                    {enabledFeatures.map((f) => (
                      <div key={f} className="flex items-center gap-1 text-zinc-300">
                        <Check className="w-2.5 h-2.5 shrink-0" style={{ color: accent }} />
                        <span className="truncate">{FEATURE_LABELS[f]}</span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>

              {/* CTA */}
              <div className="mt-2">
                {context.isAdmin ? (
                  <span className="block text-center text-[11px] text-zinc-500 py-2">
                    {t.tiers.adminAllAvailable}
                  </span>
                ) : context.hasTier && !context.tierCanceledAt ? (
                  <button
                    disabled
                    className="w-full px-4 py-3 rounded-xl text-[13px] font-bold border border-[#95BF47]/30 bg-[#95BF47]/15 text-[#95BF47] inline-flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    {t.tiers.yourActiveMembership}
                  </button>
                ) : (
                  <button
                    onClick={() => handleBook(plan.ctaUrl)}
                    disabled={switching}
                    className="w-full px-4 py-3.5 rounded-xl text-[14px] font-bold inline-flex items-center justify-center gap-2 transition active:scale-[0.98]"
                    style={{
                      background: metal,
                      color: "#422006",
                      boxShadow: `0 12px 28px -10px ${accent}A0, inset 0 1px 0 rgba(255,255,255,0.25)`,
                    }}
                  >
                    {switching ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        {plan.ctaLabel || t.tiers.bookMembership}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Footnote */}
        <p className="text-[10.5px] text-zinc-600 text-center max-w-2xl mx-auto leading-relaxed mt-2">
          Die Abwicklung läuft über deinen Shopify-Store. Bei Fragen zur Kündigung wende dich
          an den Support — wir helfen schnell weiter.
        </p>
      </div>
    </div>
  );
}
