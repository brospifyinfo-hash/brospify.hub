"use client";

// ─── /themes ─────────────────────────────────────────────────────
// Theme gallery: customers browse uploaded themes, see preview
// images, and 1-click push the chosen theme into their Shopify store.

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
  Info,
  AlertCircle,
  X,
  ChevronDown,
  Image as ImageIcon,
} from "lucide-react";
import Navigation from "@/components/Navigation";

interface SessionInfo {
  isLoggedIn: boolean;
  hasShopifyConnection: boolean;
}

interface ThemeEntry {
  id: string;
  name: string;
  fileUrl: string;
  fileName?: string;
  version?: string;
  description?: string;
  previewImageUrl?: string;
  changelog?: string;
}

interface ThemeSettings {
  themes?: ThemeEntry[];
  // legacy single-theme fallback
  themeFileUrl?: string;
  themeFileName?: string;
  themeVersion?: string;
  themeChangelog?: string;
}

export default function ThemesPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [themes, setThemes] = useState<ThemeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [pushResult, setPushResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [openChangelogId, setOpenChangelogId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/session").then((r) => r.json()),
      fetch("/api/admin/settings").then((r) => r.json()).catch(() => ({})),
    ])
      .then(([sess, sett]: [SessionInfo, ThemeSettings]) => {
        if (!sess.isLoggedIn) {
          router.push("/");
          return;
        }
        setSession(sess);

        let list: ThemeEntry[] = Array.isArray(sett.themes) ? sett.themes : [];
        // Legacy fallback if no themes[] but old single-theme exists
        if (list.length === 0 && sett.themeFileUrl) {
          list = [{
            id: "legacy",
            name: sett.themeFileName || "Brospify Theme",
            fileUrl: sett.themeFileUrl,
            fileName: sett.themeFileName,
            version: sett.themeVersion,
            changelog: sett.themeChangelog,
          }];
        }
        setThemes(list.filter((t) => t && t.fileUrl));
        setLoading(false);
      })
      .catch(() => router.push("/"));
  }, [router]);

  async function handlePushTheme(theme: ThemeEntry) {
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
          message: data.error || "Theme konnte nicht installiert werden.",
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
                Wähle ein Theme · Download oder direkt in Shopify pushen
              </p>
            </div>
            {themes.length > 0 && (
              <div className="text-right shrink-0">
                <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">Verfügbar</div>
                <div className="text-sm font-bold text-[#95BF47] tabular-nums">{themes.length}</div>
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

        {/* Connect CTA — top, only if not connected */}
        {!session.hasShopifyConnection && themes.length > 0 && (
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
              const isOpen = openChangelogId === theme.id;
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
                    {theme.previewImageUrl ? (
                      <img src={theme.previewImageUrl} alt={theme.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 text-[11px] gap-1">
                        <ImageIcon className="w-8 h-8" />
                        <span>Keine Vorschau</span>
                      </div>
                    )}
                    {theme.version && (
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
                        <p className="text-[11px] text-zinc-500 mt-1 leading-snug line-clamp-2">{theme.description}</p>
                      )}
                    </div>

                    <div className="mt-auto pt-2 grid grid-cols-2 gap-2">
                      <a
                        href={theme.fileUrl}
                        download
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold border border-white/10 bg-white/[0.04] hover:bg-white/10 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </a>
                      {session.hasShopifyConnection ? (
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
                              Pushen
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => router.push("/setup")}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold border border-[#95BF47]/30 bg-[#95BF47]/10 text-[#95BF47] hover:bg-[#95BF47]/20 transition"
                        >
                          <Store className="w-3.5 h-3.5" />
                          Verbinden
                        </button>
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
