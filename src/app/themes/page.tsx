"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
}

export default function ThemesPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [settings, setSettings] = useState<ThemeSettings>({});
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [pushDone, setPushDone] = useState(false);

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
    try {
      const res = await fetch("/api/themes/push", { method: "POST" });
      if (res.ok) {
        setPushDone(true);
        setTimeout(() => setPushDone(false), 3000);
      }
    } catch {
      // ignore
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

      <div className="fixed top-40 right-20 w-72 h-72 bg-purple-500/8 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Palette className="w-8 h-8 text-purple-400" />
            Themes
          </h1>
          <p className="text-zinc-400">
            Lade das aktuelle Brospify-Theme herunter oder pushe es direkt in deinen Shop.
          </p>
        </motion.div>

        {/* Theme Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-strong rounded-2xl p-8 border border-white/10 mb-6"
        >
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
              <FileArchive className="w-10 h-10 text-purple-400" />
            </div>

            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-1">
                {settings.themeFileName || "Brospify Theme"}
              </h2>
              {settings.themeVersion && (
                <p className="text-[#95BF47] text-sm font-medium mb-3">
                  Version {settings.themeVersion}
                </p>
              )}
              <p className="text-zinc-400 text-sm mb-6">
                Das offiziell optimierte Shopify-Theme f&uuml;r dein Dropshipping-Business.
                Regelm&auml;&szlig;ig aktualisiert f&uuml;r maximale Conversion.
              </p>

              <div className="flex flex-wrap gap-3">
                {/* Download Button - always visible */}
                {settings.themeFileUrl ? (
                  <a
                    href={settings.themeFileUrl}
                    download
                    className="btn-accent inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold"
                  >
                    <Download className="w-5 h-5" />
                    Theme herunterladen
                  </a>
                ) : (
                  <div className="glass rounded-xl px-6 py-3 text-zinc-500 text-sm flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Noch kein Theme verf&uuml;gbar
                  </div>
                )}

                {/* Push Button - only if Shopify connected */}
                {session.hasShopifyConnection && settings.themeFileUrl && (
                  <button
                    onClick={handlePushTheme}
                    disabled={pushing || pushDone}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold border border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all disabled:opacity-70"
                  >
                    {pushDone ? (
                      <>
                        <Check className="w-5 h-5" />
                        Gepusht!
                      </>
                    ) : pushing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Pushe Theme...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        In Shopify pushen
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Connect CTA for non-connected users */}
        {!session.hasShopifyConnection && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-2xl p-6 border border-[#95BF47]/20"
          >
            <div className="flex items-center gap-4">
              <Store className="w-10 h-10 text-[#95BF47] shrink-0" />
              <div className="flex-1">
                <h3 className="font-bold mb-1">Shopify verbinden f&uuml;r 1-Klick Push</h3>
                <p className="text-zinc-400 text-sm">
                  Verbinde deinen Shop, um das Theme direkt in Shopify zu pushen &mdash; ohne manuellen Upload.
                </p>
              </div>
              <button
                onClick={() => router.push("/setup")}
                className="btn-accent px-5 py-2.5 rounded-xl text-sm font-semibold shrink-0 flex items-center gap-2"
              >
                Verbinden
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
