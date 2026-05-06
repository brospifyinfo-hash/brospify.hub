"use client";

// ─── /setup ───────────────────────────────────────────────────────
// Interactive 3-step onboarding. Mobile-first, every input is
// validated live (green check / red hint), the global progress bar
// tracks how close the user is to a connectable state, and the
// active step softly pulses so the next action is obvious.
//
// Auto-formatting: pasting a full Shopify URL (https://foo.com or
// admin.shopify.com paths) is normalised to <handle>.myshopify.com.

import { useState, useEffect, useMemo, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
  X,
  Play,
  ChevronDown,
  Sparkles,
  ShieldCheck,
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

// ─── Validators ──────────────────────────────────────────────────

function normaliseDomain(raw: string): string {
  let v = raw.trim().toLowerCase();
  // strip protocol
  v = v.replace(/^https?:\/\//, "");
  // strip everything after first slash
  v = v.split("/")[0];
  // if user pasted admin.shopify.com/store/<handle>, the handle is on the next path segment
  // we already stripped after slash, so this won't catch it — but admin URL will be foo.myshopify.com anyway
  // strip trailing whitespace
  v = v.trim();
  // append .myshopify.com if missing
  if (v && !v.includes(".myshopify.com") && !v.includes(".")) {
    v = `${v}.myshopify.com`;
  }
  return v;
}

function isValidDomain(v: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,60}\.myshopify\.com$/.test(v);
}

function isValidClientId(v: string): boolean {
  // Shopify client_id is a 32-char hex string (no dashes typically)
  return /^[a-f0-9]{32,}$/i.test(v.trim());
}

function isValidClientSecret(v: string): boolean {
  // Shopify client secrets are typically 32+ alphanumeric, often prefixed with "shpss_"
  const t = v.trim();
  return t.length >= 30 && /^[a-z0-9_-]+$/i.test(t);
}

// ─── Page ────────────────────────────────────────────────────────

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
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  // True when the user explicitly opens the connect form after Step 1 is
  // already done (re-connect / change shop / re-copy field flow).
  const [reconnectMode, setReconnectMode] = useState(false);

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
      setError("Shopify-Verbindung fehlgeschlagen. Bitte prüfe deine Daten.");
    } else if (errorParam === "token_failed") {
      setError("Token-Austausch fehlgeschlagen. Prüfe Client-ID und Schlüssel.");
    } else if (errorParam) {
      setError("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
    }
    const step = searchParams.get("step");
    if (step === "1done") setStep1Done(true);
  }, [searchParams]);

  // ── Live validation ──
  const domainValid = isValidDomain(shopDomain);
  const clientIdValid = isValidClientId(clientId);
  const clientSecretValid = isValidClientSecret(clientSecret);
  const allFieldsValid = domainValid && clientIdValid && clientSecretValid;
  const filledCount = [domainValid, clientIdValid, clientSecretValid].filter(Boolean).length;
  const fieldProgress = (filledCount / 3) * 100;

  function handleDomainChange(v: string) {
    setShopDomain(normaliseDomain(v));
  }

  async function connectShop() {
    if (!domainValid) { setError("Shop-Domain ungültig."); return; }
    if (!clientIdValid) { setError("Client-ID ungültig (32-stelliger Hex-String)."); return; }
    if (!clientSecretValid) { setError("Client Secret ungültig."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/setup/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopDomain: shopDomain.trim(),
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Fehler beim Verbinden."); setLoading(false); return; }
      window.location.href = data.authUrl;
    } catch {
      setError("Verbindungsfehler. Bitte erneut versuchen.");
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

  function getYoutubeId(url: string): string | null {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const youtubeId = getYoutubeId(youtubeUrl);
  const embedUrl = youtubeId ? `https://www.youtube.com/embed/${youtubeId}?autoplay=1` : null;

  // Overall step progress (0/1/2/3 done)
  const completedSteps = (step1Done ? 1 : 0) + (step2Done ? 1 : 0) + (step1Done && step2Done ? 1 : 0);
  const overallPct = Math.round((completedSteps / 3) * 100);

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      <div className="fixed top-32 left-6 w-56 h-56 bg-[#95BF47]/8 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-2xl mx-auto px-3 sm:px-5 py-3 sm:py-4">

        {/* ─── Header (slim) ──────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-3">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Store className="w-5 h-5 text-[#95BF47]" />
            Setup
          </h1>
          <p className="text-zinc-400 text-[12px] mt-1">
            3 Schritte bis zum vollen Funktionsumfang.
          </p>
        </motion.div>

        {/* ─── Animated stepper ────────────────────── */}
        <Stepper
          step1Done={step1Done}
          step2Done={step2Done}
          step1Skipped={step1Skipped}
          progress={overallPct}
        />

        {/* ─── YouTube tutorial (collapsed by default on mobile) ── */}
        {youtubeId && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-strong rounded-xl border border-white/10 overflow-hidden mb-3 sm:mb-5"
          >
            <button
              onClick={() => setShowHelp((v) => !v)}
              className="w-full px-3 py-2.5 flex items-center gap-2 text-left"
            >
              <Play className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <h3 className="text-xs font-semibold flex-1">Video-Anleitung</h3>
              <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${showHelp ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {showHelp && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="aspect-video relative">
                    {videoPlaying && embedUrl ? (
                      <iframe
                        src={embedUrl}
                        title="Setup Anleitung"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full"
                      />
                    ) : (
                      <button
                        onClick={() => setVideoPlaying(true)}
                        className="w-full h-full relative group cursor-pointer"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`}
                          alt="Video Thumbnail"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-all flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-red-600 group-hover:bg-red-500 flex items-center justify-center shadow-2xl shadow-red-500/30 transition-all group-hover:scale-110">
                            <Play className="w-5 h-5 text-white ml-1" fill="white" />
                          </div>
                        </div>
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        <div className="space-y-3">
          {/* ─── STEP 1 ─────────────────────────────── */}
          <StepCard
            number={1}
            title="Shopify Store verbinden"
            done={step1Done}
            active={!step1Done}
            icon={Store}
            color="#95BF47"
          >
            {step1Done && !step1Skipped && !reconnectMode && (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-emerald-400 text-xs flex items-center gap-1.5 min-w-0">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Verbunden: <span className="font-mono">{session.shopDomain || shopDomain}</span></span>
                </p>
                <button
                  onClick={() => setReconnectMode(true)}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-[11px] text-zinc-300 hover:bg-white/[0.08] transition flex items-center gap-1.5"
                >
                  <Store className="w-3 h-3" />
                  Neu verbinden / Daten ändern
                </button>
              </div>
            )}

            {step1Done && step1Skipped && !reconnectMode && (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-amber-400 text-xs flex items-center gap-1.5 min-w-0">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  Übersprungen — 1-Klick-Import deaktiviert.
                </p>
                <button
                  onClick={() => setReconnectMode(true)}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[11px] text-amber-300 hover:bg-amber-500/20 transition flex items-center gap-1.5"
                >
                  <Store className="w-3 h-3" />
                  Jetzt nachholen
                </button>
              </div>
            )}

            {(!step1Done || reconnectMode) && (
              <div className="space-y-3">
                {/* Field-progress bar */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
                      Eingabe
                    </span>
                    <span className="text-[10px] font-bold tabular-nums" style={{ color: allFieldsValid ? "#10B981" : "#95BF47" }}>
                      {filledCount}/3
                    </span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: allFieldsValid ? "linear-gradient(90deg,#10b981,#34d399)" : "linear-gradient(90deg,#95BF47,#B8D96E)" }}
                      animate={{ width: `${fieldProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>

                {/* Inputs (live-validated) */}
                <div className="space-y-2.5">
                  <ValidatedField
                    label="Shop Domain"
                    placeholder="dein-shop.myshopify.com"
                    value={shopDomain}
                    onChange={handleDomainChange}
                    valid={domainValid}
                    invalidHint={
                      shopDomain.length === 0
                        ? "Shopify-Handle oder vollständige .myshopify.com-Domain"
                        : "Format: <handle>.myshopify.com"
                    }
                    validHint="Domain erkannt"
                  />
                  <ValidatedField
                    label="Client-ID"
                    placeholder="a1b2c3d4e5f6…"
                    value={clientId}
                    onChange={setClientId}
                    valid={clientIdValid}
                    invalidHint="32-stelliger Hex-String aus dem Dev-Dashboard"
                    validHint="Client-ID gültig"
                    mono
                  />
                  <ValidatedField
                    label="Schlüssel (Client Secret)"
                    placeholder="shpss_…"
                    value={clientSecret}
                    onChange={setClientSecret}
                    valid={clientSecretValid}
                    invalidHint="Mind. 30 Zeichen, alphanumerisch"
                    validHint="Schlüssel gültig"
                    type="password"
                    mono
                  />
                </div>

                {/* Connect / Skip CTA — only enabled when all valid */}
                <motion.button
                  onClick={connectShop}
                  disabled={loading || !allFieldsValid}
                  animate={allFieldsValid && !loading ? {
                    boxShadow: [
                      "0 4px 16px -4px rgba(149, 191, 71, 0.3)",
                      "0 8px 24px -4px rgba(149, 191, 71, 0.6)",
                      "0 4px 16px -4px rgba(149, 191, 71, 0.3)",
                    ],
                  } : {}}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all ${
                    allFieldsValid
                      ? "bg-[#95BF47] text-black"
                      : "bg-white/[0.04] border border-white/10 text-zinc-500"
                  } disabled:cursor-not-allowed`}
                >
                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : allFieldsValid ? (
                    <>
                      <Store className="w-3.5 h-3.5" />
                      Shop jetzt verbinden
                      <ChevronRight className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 opacity-60" />
                      {filledCount === 0 ? "Daten oben eingeben" : `Noch ${3 - filledCount} ${3 - filledCount === 1 ? "Feld" : "Felder"}`}
                    </>
                  )}
                </motion.button>

                {/* Show instructions / copy fields collapsibly */}
                <Disclosure title="So bekommst du die Zugangsdaten">
                  <Step1Instructions appUrl={appUrl} />
                </Disclosure>

                {!step1Done && (
                  <button
                    onClick={() => setShowSkipModal(true)}
                    className="w-full py-2 text-zinc-500 hover:text-zinc-300 transition text-[11px] flex items-center justify-center gap-1.5"
                  >
                    Diesen Schritt überspringen
                  </button>
                )}
                {step1Done && reconnectMode && (
                  <button
                    onClick={() => setReconnectMode(false)}
                    className="w-full py-2 text-zinc-500 hover:text-zinc-300 transition text-[11px] flex items-center justify-center gap-1.5"
                  >
                    Abbrechen — bestehende Verbindung behalten
                  </button>
                )}
              </div>
            )}
          </StepCard>

          {/* ─── STEP 2 ─────────────────────────────── */}
          <StepCard
            number={2}
            title="Fulfillment automatisieren"
            done={step2Done}
            active={step1Done && !step2Done}
            icon={Package}
            color="#8B5CF6"
          >
            {!step2Done && (
              <div className="space-y-3">
                <p className="text-zinc-400 text-xs">
                  Installiere die kostenlose <strong className="text-white">DSers-App</strong> für günstigen Versand.
                </p>
                <div className="flex gap-2">
                  <a
                    href="https://apps.shopify.com/dsers"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => completeStep2()}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 transition text-xs font-semibold"
                  >
                    DSers öffnen <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    onClick={completeStep2}
                    disabled={loading}
                    className="flex-1 py-2.5 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] rounded-xl text-xs font-semibold transition"
                  >
                    Erledigt
                  </button>
                </div>
              </div>
            )}

            {step2Done && (
              <p className="text-emerald-400 text-xs flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                DSers als installiert markiert.
              </p>
            )}
          </StepCard>

          {/* ─── STEP 3 ─────────────────────────────── */}
          <StepCard
            number={3}
            title="Dashboard freischalten"
            done={false}
            active={step1Done && step2Done}
            icon={Rocket}
            color="#F59E0B"
          >
            <button
              onClick={() => router.push("/home")}
              disabled={!step1Done || !step2Done}
              className={`w-full py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition ${
                step1Done && step2Done
                  ? "btn-accent"
                  : "bg-white/5 text-zinc-500 cursor-not-allowed"
              }`}
            >
              <Rocket className="w-3.5 h-3.5" />
              Zum Dashboard
              {step1Done && step2Done && <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {(!step1Done || !step2Done) && (
              <p className="text-zinc-500 text-[10px] mt-2 text-center">
                Schließe zuerst {!step1Done && !step2Done ? "Schritt 1 & 2" : !step1Done ? "Schritt 1" : "Schritt 2"} ab.
              </p>
            )}
          </StepCard>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-red-400 text-xs glass border border-red-500/20 px-3 py-2.5 rounded-xl mt-3"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError("")} className="p-1 hover:bg-red-500/10 rounded-md">
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showSkipModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSkipModal(false)}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:px-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong border border-white/10 rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 w-full sm:max-w-md relative"
            >
              <button onClick={() => setShowSkipModal(false)} className="absolute top-3 right-3 text-zinc-500 hover:text-white transition">
                <X className="w-4 h-4" />
              </button>
              <div className="mb-4">
                <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-500/10 mb-3">
                  <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                </div>
                <h3 className="text-base sm:text-lg font-bold">Schritt überspringen?</h3>
                <p className="text-zinc-400 text-xs mt-1.5 leading-relaxed">
                  Ohne Shopify-Verbindung kein automatischer 1-Klick-Import.
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowSkipModal(false)} className="flex-1 py-2.5 glass hover:bg-white/10 border border-white/10 rounded-xl font-medium transition text-xs">
                  Zurück
                </button>
                <button onClick={skipStep1} disabled={loading} className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 rounded-xl font-medium transition text-xs flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Ja, überspringen"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Stepper ─────────────────────────────────────────────────────

function Stepper({ step1Done, step2Done, step1Skipped, progress }: {
  step1Done: boolean;
  step2Done: boolean;
  step1Skipped: boolean;
  progress: number;
}) {
  const steps = [
    { n: 1, label: "Shop", done: step1Done, skipped: step1Skipped },
    { n: 2, label: "DSers", done: step2Done, skipped: false },
    { n: 3, label: "Start", done: step1Done && step2Done, skipped: false },
  ];
  return (
    <div className="mb-3 sm:mb-5">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">Fortschritt</span>
        <span className="text-[11px] font-bold text-[#95BF47] tabular-nums">{progress}%</span>
      </div>
      <div className="relative flex items-center justify-between gap-1">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center gap-1 flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 relative">
              <motion.div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-colors`}
                style={{
                  background: s.done
                    ? "rgba(16,185,129,0.15)"
                    : "rgba(255,255,255,0.04)",
                  borderColor: s.done
                    ? "rgba(16,185,129,0.45)"
                    : "rgba(149,191,71,0.35)",
                  color: s.done ? "#10b981" : s.skipped ? "#fbbf24" : "#95BF47",
                }}
                animate={s.done ? { scale: [1, 1.15, 1] } : {}}
              >
                {s.done ? <Check className="w-3.5 h-3.5" /> : s.n}
              </motion.div>
              <span className={`text-[10px] font-semibold ${s.done ? "text-emerald-400" : "text-zinc-500"}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 h-0.5 bg-white/5 rounded-full mx-1 -mt-3 sm:-mt-4 relative overflow-hidden">
                <motion.div
                  className="h-full bg-emerald-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: s.done ? "100%" : "0%" }}
                  transition={{ duration: 0.6 }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── StepCard ────────────────────────────────────────────────────

function StepCard({ number, title, done, active, icon: Icon, color, children }: {
  number: number;
  title: string;
  done: boolean;
  active: boolean;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border rounded-xl p-3 transition backdrop-blur-md ${
        done
          ? "border-emerald-500/30 bg-emerald-500/5"
          : active
            ? "border-white/20 bg-white/[0.04]"
            : "border-white/10 bg-white/[0.02] opacity-60"
      }`}
      style={active ? { boxShadow: `0 0 0 1px ${color}25, 0 8px 32px -16px ${color}40` } : undefined}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0`}
          style={{
            background: done ? "rgba(16,185,129,0.15)" : `${color}10`,
            border: `1px solid ${done ? "rgba(16,185,129,0.30)" : `${color}25`}`,
          }}
        >
          {done ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <Icon className="w-4 h-4" style={{ color }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
            Schritt {number}
          </div>
          <h2 className="text-xs font-semibold leading-tight truncate">{title}</h2>
        </div>
        {active && !done && (
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: color }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </div>
      {children}
    </motion.div>
  );
}

// ─── ValidatedField ──────────────────────────────────────────────

function ValidatedField({ label, placeholder, value, onChange, valid, invalidHint, validHint, mono, type = "text" }: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  valid: boolean;
  invalidHint: string;
  validHint: string;
  mono?: boolean;
  type?: "text" | "password";
}) {
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);
  const filled = value.length > 0;
  const showState = filled || touched;
  return (
    <div>
      <label className="block text-[10px] text-zinc-400 mb-1 font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          onFocus={() => setFocused(true)}
          placeholder={placeholder}
          className={`w-full bg-white/[0.04] border rounded-xl px-3 py-2.5 pr-9 text-[13px] sm:text-sm outline-none transition placeholder:text-zinc-600 ${
            mono ? "font-mono" : ""
          }`}
          style={{
            borderColor: showState
              ? valid
                ? "rgba(16,185,129,0.40)"
                : focused ? "rgba(149,191,71,0.40)" : "rgba(239,68,68,0.30)"
              : focused ? "rgba(149,191,71,0.30)" : "rgba(255,255,255,0.10)",
            boxShadow: valid && filled
              ? "0 0 0 3px rgba(16,185,129,0.10)"
              : focused
                ? "0 0 0 3px rgba(149,191,71,0.10)"
                : undefined,
          }}
        />
        {showState && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {valid ? (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <Check className="w-4 h-4 text-emerald-400" />
              </motion.div>
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400/70" />
            )}
          </div>
        )}
      </div>
      <AnimatePresence mode="wait">
        {showState && (
          <motion.p
            key={valid ? "v" : "i"}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={`text-[10px] mt-1 leading-snug ${
              valid ? "text-emerald-400/80" : "text-red-400/80"
            }`}
          >
            {valid ? validHint : invalidHint}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Disclosure (collapsible help) ───────────────────────────────

function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/[0.06] rounded-xl bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
      >
        <Sparkles className="w-3.5 h-3.5 text-[#95BF47] shrink-0" />
        <span className="text-xs font-semibold flex-1">{title}</span>
        <ChevronDown className={`w-4 h-4 text-zinc-500 transition ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-white/[0.04]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Step 1 instructions (instructions + copy fields) ───────────

function Step1Instructions({ appUrl }: { appUrl: string }) {
  const steps: { n: number; body: React.ReactNode }[] = [
    { n: 1, body: <>In deinem Shopify-Admin auf <b className="text-white">&lsquo;Apps&rsquo;</b> → <b className="text-white">&lsquo;Apps im Dev Dashboard erstellen&rsquo;</b>.</> },
    { n: 2, body: <>Oben rechts <b className="text-white">&lsquo;App erstellen&rsquo;</b>, Name <b className="text-white">&lsquo;brospify&rsquo;</b>.</> },
    { n: 3, body: <>Links <b className="text-white">&lsquo;Versionen&rsquo;</b> → <b className="text-white">&lsquo;Neue Version&rsquo;</b>.</> },
    { n: 4, body: <>App-URL, Bereiche und Weiterleitungs-URL einfügen — <b className="text-amber-300">Häkchen bei „App einbetten&ldquo; entfernen!</b></> },
    { n: 5, body: <>Oben rechts <b className="text-white">&lsquo;Veröffentlichen&rsquo;</b> bestätigen.</> },
    { n: 6, body: <>Links <b className="text-white">&lsquo;Einstellungen&rsquo;</b> → Client-ID & Schlüssel kopieren, oben einfügen.</> },
  ];
  return (
    <>
      <ol className="space-y-1.5 sm:space-y-2 mt-2">
        {steps.map((s) => (
          <li key={s.n} className="flex items-start gap-2 text-[11px] sm:text-[13px] text-zinc-300 leading-relaxed">
            <span className="w-5 h-5 rounded-md bg-[#95BF47]/12 border border-[#95BF47]/25 flex items-center justify-center text-[10px] font-bold text-[#95BF47] shrink-0 mt-0.5">
              {s.n}
            </span>
            <span>{s.body}</span>
          </li>
        ))}
      </ol>
      <div className="space-y-1.5 mt-3">
        <CopyField text={appUrl || "https://brospify-hub.vercel.app"} label="Hub-URL" />
        <CopyField text={`${appUrl || "https://brospify-hub.vercel.app"}/api/auth/shopify/callback`} label="Redirect-URL" />
        <CopyField text="read_products, write_products, read_themes, write_themes, read_content, write_content, write_legal_policies, read_files, write_files, read_orders, read_customers" label="Bereiche" />
      </div>
    </>
  );
}

function CopyField({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    if (ref.current) {
      ref.current.select();
    }
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5">
        <div className="text-[8px] sm:text-[9px] uppercase tracking-widest text-zinc-500 font-semibold leading-tight">
          {label}
        </div>
        <input
          ref={ref}
          readOnly
          value={text}
          className="w-full bg-transparent border-0 outline-none text-[11px] text-zinc-200 font-mono truncate"
        />
      </div>
      <button
        onClick={handleCopy}
        className={`shrink-0 p-2 rounded-lg border transition ${
          copied
            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
            : "bg-white/[0.04] border-white/10 text-zinc-400 hover:bg-white/[0.08]"
        }`}
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
