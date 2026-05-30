"use client";

// ─── /themes ─────────────────────────────────────────────────────
// Theme gallery: customers browse uploaded themes, see preview
// images & video, and 1-click push the chosen theme into their
// Shopify store. Themes the user can't access stay visible but the
// "Pushen" CTA is replaced with "Upgrade auf X" or "Einmalig
// freischalten für Y €".

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette,
  Upload,
  Store,
  ArrowRight,
  Check,
  Loader2,
  Info,
  AlertCircle,
  X,
  ChevronDown,
  Image as ImageIcon,
  Lock,
  ShoppingCart,
  PlayCircle,
  Crown,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { TIER_KEYS, type TierKey } from "@/lib/tiers-shared";

interface SessionInfo {
  isLoggedIn: boolean;
  isAdmin?: boolean;
  hasShopifyConnection: boolean;
}

type LockReason =
  | "tier"
  | "purchased"
  | "locked-no-sub"
  | "locked-tier"
  | "locked-canceled";

interface ClientTheme {
  id: string;
  name: string;
  fileName?: string;
  version?: string;
  description?: string;
  previewImageUrl?: string;
  previewVideoUrl?: string;
  changelog?: string;
  priceEur: number;
  tierAccess: TierKey[];
  hasAccess: boolean;
  reason: LockReason;
}

interface ThemesResponse {
  themes: ClientTheme[];
  tier: TierKey | null;
  activeSubscription: boolean;
  purchased: string[];
}

const TIER_LABEL: Record<TierKey, string> = {
  pro: "Membership",
};

function youtubeEmbed(url: string): string | null {
  // Accept "watch?v=", "youtu.be/", or "/embed/" forms.
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      if (u.pathname.startsWith("/embed/")) return url;
    }
  } catch { /* fall through */ }
  return null;
}

function suggestedTierLabel(tierAccess: TierKey[]): string {
  // Single membership: just return its label if the theme is gated.
  for (const k of TIER_KEYS) if (tierAccess.includes(k)) return TIER_LABEL[k];
  return "Membership";
}

export default function ThemesPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [themes, setThemes] = useState<ClientTheme[]>([]);
  const [tier, setTier] = useState<TierKey | null>(null);
  const [activeSub, setActiveSub] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [pushResult, setPushResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [openChangelogId, setOpenChangelogId] = useState<string | null>(null);
  const [videoOpenId, setVideoOpenId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/session").then((r) => r.json()),
      fetch("/api/themes/list").then((r) => r.json() as Promise<ThemesResponse>).catch(() => ({ themes: [], tier: null, activeSubscription: false, purchased: [] } as ThemesResponse)),
    ])
      .then(([sess, data]: [SessionInfo, ThemesResponse]) => {
        if (!sess.isLoggedIn) {
          router.push("/");
          return;
        }
        setSession(sess);
        setThemes(Array.isArray(data.themes) ? data.themes : []);
        setTier(data.tier ?? null);
        setActiveSub(!!data.activeSubscription);
        setLoading(false);
      })
      .catch(() => router.push("/"));
  }, [router]);

  async function reloadThemes() {
    try {
      const data = await fetch("/api/themes/list", { cache: "no-store" }).then((r) => r.json());
      if (data && Array.isArray(data.themes)) {
        setThemes(data.themes);
        setTier(data.tier ?? null);
        setActiveSub(!!data.activeSubscription);
      }
    } catch { /* ignore */ }
  }

  async function handlePushTheme(theme: ClientTheme) {
    if (!theme.hasAccess) return;
    setPushingId(theme.id);
    setPushResult(null);
    try {
      const res = await fetch("/api/themes/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeId: theme.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPushResult({
          type: "success",
          message: `Theme "${data.theme?.name || theme.name}" wurde installiert. Online Store → Themes prüfen.`,
        });
      } else {
        setPushResult({
          type: "error",
          message: data.message || data.error || "Theme konnte nicht installiert werden.",
        });
      }
    } catch {
      setPushResult({
        type: "error",
        message: "Verbindung fehlgeschlagen. Bitte erneut versuchen.",
      });
    }
    setPushingId(null);
  }

  async function handlePurchase(theme: ClientTheme) {
    if (!confirm(`Theme "${theme.name}" einmalig für ${theme.priceEur} € freischalten? (Gültig solange dein Abo aktiv ist.)`)) return;
    setPurchasingId(theme.id);
    setPushResult(null);
    try {
      const res = await fetch("/api/themes/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeId: theme.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPushResult({
          type: "success",
          message: data.alreadyOwned
            ? `${theme.name} war bereits freigeschaltet.`
            : `${theme.name} freigeschaltet — ${data.creditsCharged ?? 0} Credits abgezogen.`,
        });
        await reloadThemes();
      } else {
        setPushResult({
          type: "error",
          message: data.message || data.error || "Kauf fehlgeschlagen.",
        });
      }
    } catch {
      setPushResult({
        type: "error",
        message: "Verbindung fehlgeschlagen. Bitte erneut versuchen.",
      });
    }
    setPurchasingId(null);
  }

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const accessibleCount = themes.filter((t) => t.hasAccess).length;

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      <div className="fixed top-32 right-8 w-56 h-56 bg-purple-500/[0.06] rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-3 sm:px-5 py-3 sm:py-4 space-y-3">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-base font-bold flex items-center gap-2">
                <Palette className="w-5 h-5 text-purple-400 shrink-0" />
                <span className="truncate">Themes</span>
              </h1>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {tier
                  ? `Aktiver Plan: ${TIER_LABEL[tier]} · ${accessibleCount} von ${themes.length} freigeschaltet`
                  : `Kein aktives Abo · ${themes.length} Themes verfügbar`}
              </p>
            </div>
            {themes.length > 0 && (
              <div className="text-right shrink-0">
                <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">Verfügbar</div>
                <div className="text-sm font-bold text-[#95BF47] tabular-nums">{accessibleCount}/{themes.length}</div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Result toast */}
        <AnimatePresence>
          {pushResult && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border ${
                pushResult.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                  : "bg-red-500/10 border-red-500/20 text-red-300"
              }`}
            >
              {pushResult.type === "success" ? (
                <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              )}
              <p className="text-xs flex-1">{pushResult.message}</p>
              <button onClick={() => setPushResult(null)} className="shrink-0 mt-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* No active sub banner — without an active sub the user sees
            but cannot push. */}
        {!activeSub && !session.isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3"
          >
            <div className="flex items-center gap-2.5">
              <Crown className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-bold mb-0.5">Aktive Membership nötig</h3>
                <p className="text-[10px] text-zinc-400 leading-snug">
                  Theme-Push erfordert eine aktive Membership. Auch einmalig gekaufte Themes sind nur damit nutzbar.
                </p>
              </div>
              <button
                onClick={() => router.push("/tiers")}
                className="btn-accent px-3 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 flex items-center gap-1"
              >
                Membership buchen
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Connect CTA — top, only if not connected */}
        {activeSub && !session.hasShopifyConnection && themes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-[#95BF47]/20 bg-[#95BF47]/[0.04] p-3"
          >
            <div className="flex items-center gap-2.5">
              <Store className="w-5 h-5 text-[#95BF47] shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-bold mb-0.5">Shopify verbinden für 1-Klick-Push</h3>
                <p className="text-[10px] text-zinc-500 leading-snug">
                  Verbinde deinen Shop einmal — dann kannst du jedes Theme mit einem Klick installieren.
                </p>
              </div>
              <button
                onClick={() => router.push("/setup")}
                className="btn-accent px-3 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 flex items-center gap-1"
              >
                Setup
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {themes.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong rounded-xl p-6 border border-white/10 text-center"
          >
            <ImageIcon className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
            <h2 className="text-sm font-bold mb-1">Noch keine Themes verfügbar</h2>
            <p className="text-xs text-zinc-500">Sobald Themes hinterlegt sind, erscheinen sie hier.</p>
          </motion.div>
        )}

        {/* Theme gallery */}
        {themes.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {themes.map((theme, idx) => {
              const isPushing = pushingId === theme.id;
              const isPurchasing = purchasingId === theme.id;
              const isOpen = openChangelogId === theme.id;
              const showVideo = videoOpenId === theme.id;
              const ytEmbed = theme.previewVideoUrl ? youtubeEmbed(theme.previewVideoUrl) : null;
              const suggestedPlan = suggestedTierLabel(theme.tierAccess);
              return (
                <motion.div
                  key={theme.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * idx }}
                  className="glass-strong rounded-xl border border-white/10 overflow-hidden flex flex-col"
                >
                  {/* Preview */}
                  <div className="relative aspect-video bg-zinc-900 border-b border-white/5">
                    {showVideo && theme.previewVideoUrl ? (
                      ytEmbed ? (
                        <iframe
                          src={`${ytEmbed}?autoplay=1`}
                          className="w-full h-full"
                          allow="autoplay; encrypted-media; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <video
                          src={theme.previewVideoUrl}
                          autoPlay
                          controls
                          className="w-full h-full object-cover"
                        />
                      )
                    ) : theme.previewImageUrl ? (
                      <>
                        <img src={theme.previewImageUrl} alt={theme.name} className="w-full h-full object-cover" />
                        {!theme.hasAccess && (
                          <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px] flex items-center justify-center">
                            <div className="flex flex-col items-center gap-1 text-zinc-200">
                              <Lock className="w-7 h-7" />
                              <span className="text-[10px] font-bold uppercase tracking-widest">
                                Im Plan nicht enthalten
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 text-[11px] gap-1">
                        <ImageIcon className="w-8 h-8" />
                        <span>Keine Vorschau</span>
                      </div>
                    )}
                    {!showVideo && theme.previewVideoUrl && (
                      <button
                        onClick={() => setVideoOpenId(theme.id)}
                        className="absolute inset-0 flex items-center justify-center group"
                        title="Vorschau-Video abspielen"
                      >
                        <span className="w-12 h-12 rounded-full bg-black/65 backdrop-blur border border-white/20 flex items-center justify-center group-hover:scale-110 transition">
                          <PlayCircle className="w-7 h-7 text-white" />
                        </span>
                      </button>
                    )}
                    {showVideo && (
                      <button
                        onClick={() => setVideoOpenId(null)}
                        className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black/70 border border-white/15 text-[10px] font-semibold"
                      >
                        Schließen
                      </button>
                    )}
                    {theme.version && !showVideo && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur border border-white/10 text-[10px] font-bold text-[#95BF47] tabular-nums">
                        {theme.version}
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-3 flex flex-col flex-1 gap-2">
                    <div>
                      <h2 className="text-sm font-bold leading-tight truncate">{theme.name}</h2>
                      {theme.description && (
                        <p className="text-[11px] text-zinc-500 mt-1 leading-snug line-clamp-3">{theme.description}</p>
                      )}
                    </div>

                    {/* Tier-access labels */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {theme.tierAccess.length === 0 ? (
                        <span className="text-[9px] uppercase tracking-wider text-zinc-500 px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.06]">
                          nur Einmalkauf
                        </span>
                      ) : (
                        theme.tierAccess.map((k) => (
                          <span
                            key={k}
                            className="text-[9px] uppercase tracking-wider text-[#95BF47] px-1.5 py-0.5 rounded bg-[#95BF47]/10 border border-[#95BF47]/20"
                          >
                            {TIER_LABEL[k]}
                          </span>
                        ))
                      )}
                      {theme.reason === "purchased" && (
                        <span className="text-[9px] uppercase tracking-wider text-amber-300 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/25">
                          freigeschaltet
                        </span>
                      )}
                    </div>

                    {/* Action area */}
                    <div className="mt-auto pt-2 flex flex-col gap-2">
                      {theme.hasAccess ? (
                        // Has access — show Push (or Setup CTA when shop not connected)
                        session.hasShopifyConnection ? (
                          <button
                            onClick={() => handlePushTheme(theme)}
                            disabled={isPushing || pushingId !== null}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 transition disabled:opacity-60"
                          >
                            {isPushing ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Pushe…
                              </>
                            ) : (
                              <>
                                <Upload className="w-3.5 h-3.5" />
                                In Shopify pushen
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => router.push("/setup")}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold border border-[#95BF47]/30 bg-[#95BF47]/10 text-[#95BF47] hover:bg-[#95BF47]/20 transition"
                          >
                            <Store className="w-3.5 h-3.5" />
                            Shop verbinden
                          </button>
                        )
                      ) : (
                        // Locked — show upgrade + buy CTAs
                        <>
                          <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-2.5 py-2">
                            <p className="text-[10.5px] text-amber-200 leading-snug">
                              Im aktuellen Plan nicht enthalten — Upgrade auf <b>{suggestedPlan}</b>
                              {theme.priceEur > 0 && (
                                <> oder einmalig freischalten für <b>{theme.priceEur} €</b></>
                              )}
                              .
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => router.push("/credits")}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 transition"
                            >
                              <Crown className="w-3.5 h-3.5" />
                              Upgrade
                            </button>
                            {theme.priceEur > 0 ? (
                              <button
                                onClick={() => handlePurchase(theme)}
                                disabled={isPurchasing || !activeSub}
                                title={
                                  !activeSub
                                    ? "Einmalkauf erfordert ein aktives Abo"
                                    : `${theme.priceEur} € als Credits abziehen`
                                }
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold border border-[#95BF47]/30 bg-[#95BF47]/10 text-[#95BF47] hover:bg-[#95BF47]/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isPurchasing ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Kaufe…
                                  </>
                                ) : (
                                  <>
                                    <ShoppingCart className="w-3.5 h-3.5" />
                                    {theme.priceEur} €
                                  </>
                                )}
                              </button>
                            ) : (
                              <span className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] text-zinc-500 border border-white/[0.06] bg-white/[0.02]">
                                kein Einzelkauf
                              </span>
                            )}
                          </div>
                          {theme.priceEur > 0 && (
                            <p className="text-[9.5px] text-zinc-500 leading-snug">
                              Einmalig freischalten — gültig solange dein Abo aktiv ist.
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    {theme.changelog && (
                      <div className="border-t border-white/[0.04] pt-2 mt-1">
                        <button
                          onClick={() => setOpenChangelogId(isOpen ? null : theme.id)}
                          className="w-full flex items-center gap-1.5 text-left"
                        >
                          <Info className="w-3 h-3 text-[#95BF47] shrink-0" />
                          <span className="text-[10px] font-semibold flex-1 text-zinc-300">Changelog</span>
                          <ChevronDown className={`w-3 h-3 text-zinc-500 transition ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.pre
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="text-[10px] text-zinc-400 whitespace-pre-wrap font-sans leading-relaxed pt-2 overflow-hidden"
                            >
                              {theme.changelog}
                            </motion.pre>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {pushingId && (
          <p className="text-zinc-500 text-[10px] text-center">
            Shopify entpackt &amp; installiert das Theme — bis zu 60s.
          </p>
        )}
      </div>
    </div>
  );
}
