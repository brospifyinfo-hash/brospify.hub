"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Store,
  Package,
  Rocket,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink,
  Copy,
  ChevronRight,
  Info,
  SkipForward,
  X,
  Play,
} from "lucide-react";
import Navigation from "@/components/Navigation";

interface SessionInfo {
  isLoggedIn: boolean;
  isAdmin: boolean;
  setupStep1Done: boolean;
  setupStep2Done: boolean;
  shopDomain: string | null;
  hasShopifyToken: boolean;
}

export default function SetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-mesh flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SetupContent />
    </Suspense>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 glass border border-white/10 rounded-xl px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-0.5">
          {label}
        </div>
        <div className="text-sm text-zinc-200 font-mono truncate">{text}</div>
      </div>
      <button
        onClick={handleCopy}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition text-xs font-medium"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400">Kopiert</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-300">Kopieren</span>
          </>
        )}
      </button>
    </div>
  );
}

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [step1Done, setStep1Done] = useState(false);
  const [step2Done, setStep2Done] = useState(false);
  const [shopDomain, setShopDomain] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [step1Skipped, setStep1Skipped] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/session").then((r) => r.json()),
      fetch("/api/admin/settings").then((r) => r.json()).catch(() => ({})),
    ]).then(([data, settings]) => {
      if (!data.isLoggedIn || data.isAdmin) {
        router.replace("/");
        return;
      }
      setSession(data);
      setStep1Done(data.setupStep1Done);
      setStep2Done(data.setupStep2Done);
      if (data.shopDomain) setShopDomain(data.shopDomain);
      if (settings.youtubeUrl) setYoutubeUrl(settings.youtubeUrl);
    });
  }, [router]);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "oauth_failed") {
      setError("Shopify-Verbindung fehlgeschlagen. Bitte überprüfe deine Daten und versuche es erneut.");
    } else if (errorParam === "token_failed") {
      setError("Token-Austausch fehlgeschlagen. Bitte überprüfe Client-ID und Schlüssel.");
    } else if (errorParam) {
      setError("Verbindung fehlgeschlagen. Bitte versuche es erneut.");
    }
    const step = searchParams.get("step");
    if (step === "1done") {
      setStep1Done(true);
    }
  }, [searchParams]);

  async function connectShop() {
    if (!shopDomain.trim()) { setError("Bitte gib deine Shop-Domain ein."); return; }
    if (!clientId.trim()) { setError("Bitte gib die Client-ID ein."); return; }
    if (!clientSecret.trim()) { setError("Bitte gib den Schlüssel (Client Secret) ein."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/setup/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopDomain: shopDomain.trim(), clientId: clientId.trim(), clientSecret: clientSecret.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Fehler beim Verbinden."); setLoading(false); return; }
      window.location.href = data.authUrl;
    } catch {
      setError("Verbindungsfehler. Bitte versuche es erneut.");
      setLoading(false);
    }
  }

  async function skipStep1() {
    setLoading(true);
    try {
      await fetch("/api/setup/skip", { method: "POST" });
      setStep1Skipped(true);
      setStep1Done(true);
      setShowSkipModal(false);
    } catch { setError("Fehler beim Überspringen."); }
    finally { setLoading(false); }
  }

  async function completeStep2() {
    setLoading(true);
    try {
      await fetch("/api/setup/step2", { method: "POST" });
      setStep2Done(true);
    } catch { setError("Fehler beim Speichern."); }
    finally { setLoading(false); }
  }

  // Convert YouTube URL to embed URL
  function getYoutubeEmbedUrl(url: string): string | null {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
    return null;
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const embedUrl = getYoutubeEmbedUrl(youtubeUrl);

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      <div className="fixed top-40 left-10 w-72 h-72 bg-[#95BF47]/8 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Store className="w-8 h-8 text-[#95BF47]" />
            Setup
          </h1>
          <p className="text-zinc-400 mb-8">
            Drei kurze Schritte, dann bist du startklar.
          </p>
        </motion.div>

        {/* YouTube Tutorial */}
        {embedUrl && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-strong rounded-2xl border border-white/10 overflow-hidden mb-8"
          >
            <div className="p-4 pb-3 flex items-center gap-2">
              <Play className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-semibold">Video-Anleitung</h3>
            </div>
            <div className="aspect-video">
              <iframe
                src={embedUrl}
                title="Setup Anleitung"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </motion.div>
        )}

        <div className="space-y-4">
          {/* STEP 1 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`border rounded-2xl p-6 transition backdrop-blur-md ${
              step1Done
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "glass border-white/10"
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                step1Done ? "bg-emerald-500/20" : "bg-[#95BF47]/10 border border-[#95BF47]/20"
              }`}>
                {step1Done ? (
                  <Check className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Store className="w-5 h-5 text-[#95BF47]" />
                )}
              </div>
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Schritt 1</div>
                <h2 className="font-semibold">Shopify Store verbinden</h2>
              </div>
            </div>

            {step1Done && !step1Skipped && (
              <p className="text-emerald-400 text-sm">
                Store verbunden: {session.shopDomain || shopDomain}
              </p>
            )}

            {step1Done && step1Skipped && (
              <p className="text-amber-400 text-sm flex items-center gap-1.5">
                <Info className="w-4 h-4" />
                Übersprungen - 1-Klick-Import ist deaktiviert.
              </p>
            )}

            {!step1Done && (
              <div className="space-y-5">
                {/* Instructions */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-zinc-300 mb-3">
                    Anleitung: App im Dev Dashboard erstellen
                  </h3>

                  <div className="space-y-2.5">
                    {[
                      <>Klicke in deinem Shopify-Admin links im Menü auf <strong className="text-white">&apos;Apps&apos;</strong> und dann auf den Button <strong className="text-white">&apos;Apps im Dev Dashboard erstellen&apos;</strong>.</>,
                      <>Im neuen Fenster klicke oben rechts auf <strong className="text-white">&apos;App erstellen&apos;</strong> und nenne sie <strong className="text-white">&apos;brospify&apos;</strong>.</>,
                      <>Klicke links im Menü auf <strong className="text-white">&apos;Versionen&apos;</strong> und dann auf <strong className="text-white">&apos;Neue Version&apos;</strong>.</>,
                    ].map((text, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-[#95BF47]/10 border border-[#95BF47]/20 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-[#95BF47]">{i + 1}</span>
                        </div>
                        <p className="text-sm text-zinc-300 leading-relaxed">{text}</p>
                      </div>
                    ))}

                    {/* Step 4 with sub-items */}
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-[#95BF47]/10 border border-[#95BF47]/20 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-[#95BF47]">4</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-zinc-300 leading-relaxed mb-2">Konfiguration ausfüllen:</p>
                        <ul className="space-y-1.5 text-sm text-zinc-400">
                          <li className="flex items-start gap-2">
                            <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#95BF47]" />
                            <span><strong className="text-zinc-300">&apos;App-URL&apos;</strong>: Füge unsere Hub-URL ein (siehe Copy-Feld unten)</span>
                          </li>
                          <li>
                            <div className="flex items-center gap-2 text-xs text-amber-400/80 bg-amber-400/5 border border-amber-400/10 rounded-lg px-3 py-2 mt-1 mb-1">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>WICHTIG: Entferne den Haken bei &apos;App in den Shopify-Adminbereich einbetten&apos;.</span>
                            </div>
                          </li>
                          <li className="flex items-start gap-2">
                            <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#95BF47]" />
                            <span><strong className="text-zinc-300">&apos;Bereiche&apos;</strong>: Füge die Rechte ein (siehe Copy-Feld unten)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#95BF47]" />
                            <span><strong className="text-zinc-300">&apos;Weiterleitungs-URLs&apos;</strong>: Füge die Redirect-URL ein (siehe Copy-Feld unten)</span>
                          </li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-[#95BF47]/10 border border-[#95BF47]/20 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-[#95BF47]">5</span>
                      </div>
                      <p className="text-sm text-zinc-300 leading-relaxed">
                        Klicke oben rechts auf <strong className="text-white">&apos;Veröffentlichen&apos;</strong> und bestätige.
                      </p>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-[#95BF47]/10 border border-[#95BF47]/20 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-[#95BF47]">6</span>
                      </div>
                      <p className="text-sm text-zinc-300 leading-relaxed">
                        Gehe nun links auf <strong className="text-white">&apos;Einstellungen&apos;</strong>. Kopiere die <strong className="text-white">&apos;Client-ID&apos;</strong> und den <strong className="text-white">&apos;Schlüssel&apos;</strong> (Secret) in die Felder unten.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Copy Fields */}
                <div className="space-y-2">
                  <CopyButton text={appUrl || "https://brospify-hub.vercel.app"} label="Unsere Hub-URL (für App-URL)" />
                  <CopyButton text={`${appUrl || "https://brospify-hub.vercel.app"}/api/auth/shopify/callback`} label="Redirect-URL (für Weiterleitungs-URLs)" />
                  <CopyButton text="read_products, write_products, read_themes, write_themes" label="Benötigte Bereiche" />
                </div>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-zinc-950 text-zinc-500">
                      Deine Shopify-Daten eingeben
                    </span>
                  </div>
                </div>

                {/* Input Fields */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Shop Domain</label>
                    <input
                      type="text"
                      value={shopDomain}
                      onChange={(e) => setShopDomain(e.target.value)}
                      placeholder="dein-shop.myshopify.com"
                      className="input-glass w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Client-ID</label>
                    <input
                      type="text"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="z.B. a1b2c3d4e5f6..."
                      className="input-glass w-full font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Schlüssel (Client Secret)</label>
                    <input
                      type="password"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder="z.B. shpss_..."
                      className="input-glass w-full font-mono"
                    />
                  </div>
                </div>

                {/* Connect Button */}
                <button
                  onClick={connectShop}
                  disabled={loading}
                  className="w-full btn-accent py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Store className="w-4 h-4" />Shop jetzt verbinden</>}
                </button>

                {/* Skip Button */}
                <button
                  onClick={() => setShowSkipModal(true)}
                  className="w-full py-2.5 text-zinc-500 hover:text-zinc-300 transition text-sm flex items-center justify-center gap-2"
                >
                  <SkipForward className="w-4 h-4" />
                  Diesen Schritt überspringen
                </button>
              </div>
            )}
          </motion.div>

          {/* STEP 2 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`border rounded-2xl p-6 transition backdrop-blur-md ${
              step2Done
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "glass border-white/10"
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                step2Done ? "bg-emerald-500/20" : "bg-white/5"
              }`}>
                {step2Done ? <Check className="w-5 h-5 text-emerald-400" /> : <Package className="w-5 h-5 text-zinc-400" />}
              </div>
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Schritt 2</div>
                <h2 className="font-semibold">Fulfillment Automatisierung</h2>
              </div>
            </div>

            {!step2Done && (
              <div className="space-y-3">
                <p className="text-zinc-400 text-sm">
                  Installiere jetzt die kostenlose <strong className="text-white">DSers-App</strong> im Shopify App Store, um später günstigen Versand zu nutzen.
                </p>
                <a href="https://apps.shopify.com/dsers" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[#95BF47] hover:text-[#86ad3f] text-sm transition">
                  DSers im App Store öffnen <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button onClick={completeStep2} disabled={loading} className="w-full py-2.5 glass hover:bg-white/10 border border-white/10 rounded-xl font-medium transition text-sm">
                  Erledigt (App installiert)
                </button>
              </div>
            )}

            {step2Done && (
              <p className="text-emerald-400 text-sm">DSers-App wurde als installiert markiert.</p>
            )}
          </motion.div>

          {/* STEP 3 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="glass border border-white/10 rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5">
                <Rocket className="w-5 h-5 text-zinc-400" />
              </div>
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider">Schritt 3</div>
                <h2 className="font-semibold">Dashboard freischalten</h2>
              </div>
            </div>

            <button
              onClick={() => router.push("/home")}
              disabled={!step1Done || !step2Done}
              className={`w-full py-3 rounded-xl font-medium transition text-sm flex items-center justify-center gap-2 ${
                step1Done && step2Done
                  ? "btn-accent"
                  : "bg-white/5 text-zinc-500 cursor-not-allowed"
              }`}
            >
              <Rocket className="w-4 h-4" />
              Zum Dashboard
            </button>

            {(!step1Done || !step2Done) && (
              <p className="text-zinc-500 text-xs mt-2 text-center">
                Schließe zuerst Schritt 1 &amp; 2 ab.
              </p>
            )}
          </motion.div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-red-400 text-sm glass border border-red-500/20 px-4 py-3 rounded-xl mt-4"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </div>

      {/* Skip Modal */}
      {showSkipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="glass-strong border border-white/10 rounded-2xl p-6 w-full max-w-md relative">
            <button onClick={() => setShowSkipModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
            <div className="mb-5">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 mb-4">
                <AlertCircle className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-lg font-bold">Achtung!</h3>
              <p className="text-zinc-400 text-sm mt-2 leading-relaxed">
                Ohne Shopify-Verbindung ist kein automatischer 1-Klick-Import möglich. Du kannst die Produkte nur ansehen. Willst du trotzdem fortfahren?
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowSkipModal(false)} className="flex-1 py-2.5 glass hover:bg-white/10 border border-white/10 rounded-xl font-medium transition text-sm">
                Zurück
              </button>
              <button onClick={skipStep1} disabled={loading} className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 rounded-xl font-medium transition text-sm flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ja, überspringen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
