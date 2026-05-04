"use client";

// ─── /themes ─────────────────────────────────────────────────────
// Brospify-Theme download + 1-click push to the connected Shopify
// store. Mobile-first compact layout: hero card stacks vertical on
// phone, action row is sticky-friendly, changelog is collapsed.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette,
  Download,
  Upload,
  Store,
  ArrowRight,
  Check,
  Loader2,
  FileArchive,
  Info,
  AlertCircle,
  X,
  ChevronDown,
  Sparkles,
  Zap,
} from "lucide-react";
import Navigation from "@/components/Navigation";

interface SessionInfo {
  isLoggedIn: boolean;
  hasShopifyConnection: boolean;
}

interface ThemeSettings {
  themeFileUrl?: string;
  themeFileName?: string;
  themeVersion?: string;
  themeChangelog?: string;
}

const THEME_FEATURES = [
  { icon: Zap, label: "Speed-optimiert", desc: "Sub-2s Mobile" },
  { icon: Sparkles, label: "Conversion-tuned", desc: "ATC + Sticky" },
  { icon: Palette, label: "Brand-ready", desc: "1-Klick Farben" },
];

export default function ThemesPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [settings, setSettings] = useState<ThemeSettings>({});
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/session").then((r) => r.json()),
      fetch("/api/admin/settings").then((r) => r.json()).catch(() => ({})),
    ])
      .then(([sess, sett]) => {
        if (!sess.isLoggedIn) {
          router.push("/");
          return;
        }
        setSession(sess);
        setSettings(sett);
        setLoading(false);
      })
      .catch(() => router.push("/"));
  }, [router]);

  async function handlePushTheme() {
    setPushing(true);
    setPushResult(null);
    try {
      const res = await fetch("/api/themes/push", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setPushResult({
          type: "success",
          message: `Theme "${data.theme?.name || "Brospify Premium Theme"}" wurde installiert. Online Store → Themes prüfen.`,
        });
      } else {
        setPushResult({
          type: "error",
          message: data.error || "Theme konnte nicht installiert werden.",
        });
      }
    } catch {
      setPushResult({
        type: "error",
        message: "Verbindung fehlgeschlagen. Bitte erneut versuchen.",
      });
    }
    setPushing(false);
  }

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      <div className="fixed top-32 right-8 w-56 h-56 bg-purple-500/[0.06] rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-3 sm:px-5 py-3 sm:py-4 space-y-3">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-base font-bold flex items-center gap-2">
                <Palette className="w-5 h-5 text-purple-400 shrink-0" />
                <span className="truncate">Themes</span>
              </h1>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Brospify-Theme · Download oder direkt in Shopify pushen
              </p>
            </div>
            {settings.themeVersion && (
              <div className="text-right shrink-0">
                <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">Version</div>
                <div className="text-sm font-bold text-[#95BF47] tabular-nums">{settings.themeVersion}</div>
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

        {/* Theme card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-strong rounded-xl p-3 border border-white/10"
        >
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
              <FileArchive className="w-6 h-6 text-purple-400" />
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold leading-tight truncate">
                {settings.themeFileName || "Brospify Theme"}
              </h2>
              <p className="text-zinc-400 text-[11px] mt-1 leading-snug">
                Optimiertes Shopify-Theme für maximale Conversion. Ständig aktualisiert.
              </p>

              {/* Feature chips — only on tablet+ */}
              <div className="hidden sm:flex flex-wrap gap-1.5 mt-3">
                {THEME_FEATURES.map((f) => (
                  <span
                    key={f.label}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-white/[0.04] border border-white/10 text-zinc-300"
                  >
                    <f.icon className="w-3 h-3 text-purple-400" />
                    {f.label}
                    <span className="text-zinc-500 ml-0.5">· {f.desc}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            {settings.themeFileUrl ? (
              <a
                href={settings.themeFileUrl}
                download
                className="btn-accent flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold"
              >
                <Download className="w-3.5 h-3.5" />
                Theme herunterladen
              </a>
            ) : (
              <div className="glass rounded-xl px-4 py-2.5 text-zinc-500 text-xs flex items-center justify-center gap-2">
                <Info className="w-3.5 h-3.5" />
                Noch kein Theme verfügbar
              </div>
            )}

            {session.hasShopifyConnection && settings.themeFileUrl && (
              <button
                onClick={handlePushTheme}
                disabled={pushing}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 transition disabled:opacity-70"
              >
                {pushing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Pushe…</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    In Shopify pushen
                  </>
                )}
              </button>
            )}
          </div>

          {pushing && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-zinc-500 text-[10px] mt-2"
            >
              Shopify entpackt & installiert das Theme — bis zu 60s.
            </motion.p>
          )}
        </motion.div>

        {/* Mobile feature chips (below card) */}
        <div className="grid grid-cols-3 gap-1.5 sm:hidden">
          {THEME_FEATURES.map((f) => (
            <div
              key={f.label}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2 text-center"
            >
              <f.icon className="w-3.5 h-3.5 text-purple-400 mx-auto mb-1" />
              <div className="text-[10px] font-semibold leading-tight">{f.label}</div>
              <div className="text-[9px] text-zinc-500 leading-tight mt-0.5">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Changelog (collapsible) */}
        {settings.themeChangelog && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden"
          >
            <button
              onClick={() => setShowChangelog((v) => !v)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
            >
              <Info className="w-3.5 h-3.5 text-[#95BF47] shrink-0" />
              <span className="text-xs font-semibold flex-1">Changelog</span>
              <ChevronDown className={`w-4 h-4 text-zinc-500 transition ${showChangelog ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {showChangelog && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <pre className="text-[11px] text-zinc-400 whitespace-pre-wrap font-sans leading-relaxed px-3 pb-3 pt-1 border-t border-white/[0.04]">
                    {settings.themeChangelog}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Connect CTA */}
        {!session.hasShopifyConnection && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl border border-[#95BF47]/20 bg-[#95BF47]/[0.04] p-3"
          >
            <div className="flex items-center gap-2.5">
              <Store className="w-5 h-5 sm:w-7 sm:h-7 text-[#95BF47] shrink-0 mt-0.5 sm:mt-0" />
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-bold mb-0.5">Shopify verbinden für 1-Klick-Push</h3>
                <p className="text-[10px] text-zinc-500 leading-snug">
                  Spar dir den manuellen Theme-Upload — verbinde deinen Shop einmal, push immer mit einem Klick.
                </p>
              </div>
              <button
                onClick={() => router.push("/setup")}
                className="btn-accent px-3 py-1.5 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl text-[11px] font-semibold shrink-0 flex items-center gap-1"
              >
                Setup
                <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
