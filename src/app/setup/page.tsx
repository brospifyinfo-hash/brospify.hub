"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Shield,
  Key,
  Globe,
  SkipForward,
  X,
  Info,
} from "lucide-react";

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
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
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
    <div className="flex items-center gap-2 bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-0.5">
          {label}
        </div>
        <div className="text-sm text-zinc-200 font-mono truncate">{text}</div>
      </div>
      <button
        onClick={handleCopy}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition text-xs font-medium"
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
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const appUrl =
    typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data: SessionInfo) => {
        if (!data.isLoggedIn || data.isAdmin) {
          router.replace("/");
          return;
        }
        setSession(data);
        setStep1Done(data.setupStep1Done);
        setStep2Done(data.setupStep2Done);
        if (data.shopDomain) setShopDomain(data.shopDomain);
      });
  }, [router]);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setError("Verbindung fehlgeschlagen. Bitte versuche es erneut.");
    }
  }, [searchParams]);

  async function connectShop() {
    if (!shopDomain.trim()) {
      setError("Bitte gib deine Shop-Domain ein.");
      return;
    }
    if (!clientId.trim()) {
      setError("Bitte gib die Client-ID ein.");
      return;
    }
    if (!clientSecret.trim()) {
      setError("Bitte gib den Schlüssel (Client Secret) ein.");
      return;
    }
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
      if (!res.ok) {
        setError(data.error || "Fehler beim Verbinden.");
        return;
      }
      setStep1Done(true);
    } catch {
      setError("Verbindungsfehler. Bitte versuche es erneut.");
    } finally {
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
    } catch {
      setError("Fehler beim Überspringen.");
    } finally {
      setLoading(false);
    }
  }

  async function completeStep2() {
    setLoading(true);
    try {
      await fetch("/api/setup/step2", { method: "POST" });
      setStep2Done(true);
    } catch {
      setError("Fehler beim Speichern.");
    } finally {
      setLoading(false);
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  const instructions = [
    {
      num: 1,
      icon: Globe,
      text: "Klicke in deinem Shopify-Admin links im Menü auf 'Apps' und dann auf den Button 'Apps im Dev Dashboard erstellen'.",
    },
    {
      num: 2,
      icon: Store,
      text: "Im neuen Fenster klicke oben rechts auf 'App erstellen' und nenne sie 'brospify'.",
    },
    {
      num: 3,
      icon: Package,
      text: "Klicke links im Menü auf 'Versionen' und dann auf 'Neue Version'.",
    },
    {
      num: 4,
      icon: Shield,
      text: "Konfiguration ausfüllen:",
      details: true,
    },
    {
      num: 5,
      icon: Check,
      text: "Klicke oben rechts auf 'Veröffentlichen' und bestätige.",
    },
    {
      num: 6,
      icon: Key,
      text: "Gehe nun links auf 'Einstellungen'. Kopiere die 'Client-ID' und den 'Schlüssel' (Secret) in die Felder unten.",
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">Setup</h1>
        <p className="text-zinc-400 mb-8">
          Drei kurze Schritte, dann bist du startklar.
        </p>

        <div className="space-y-4">
          {/* STEP 1 */}
          <div
            className={`border rounded-2xl p-6 transition ${
              step1Done
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-zinc-800 bg-zinc-900"
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  step1Done ? "bg-emerald-500/20" : "bg-zinc-800"
                }`}
              >
                {step1Done ? (
                  <Check className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Store className="w-5 h-5 text-zinc-400" />
                )}
              </div>
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider">
                  Schritt 1
                </div>
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
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-zinc-300 mb-3">
                    Anleitung: Custom App erstellen
                  </h3>

                  {instructions.map((inst) => (
                    <div key={inst.num}>
                      <button
                        onClick={() =>
                          setExpandedStep(
                            expandedStep === inst.num ? null : inst.num
                          )
                        }
                        className="w-full flex items-start gap-3 text-left group"
                      >
                        <div className="w-7 h-7 rounded-lg bg-indigo-600/20 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-indigo-400">
                            {inst.num}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-300 leading-relaxed">
                            {inst.text}
                          </p>
                        </div>
                        {inst.details && (
                          <ChevronRight
                            className={`w-4 h-4 text-zinc-500 shrink-0 mt-1 transition-transform ${
                              expandedStep === inst.num ? "rotate-90" : ""
                            }`}
                          />
                        )}
                      </button>

                      {inst.details && expandedStep === inst.num && (
                        <div className="ml-10 mt-3 space-y-3">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                              <ChevronRight className="w-3 h-3" />
                              <span>
                                <strong className="text-zinc-300">'App-URL'</strong>: Füge unsere Hub-URL ein
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-amber-400/80 bg-amber-400/5 border border-amber-400/10 rounded-lg px-3 py-2">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                WICHTIG: Entferne den Haken bei 'App in den Shopify-Adminbereich einbetten'.
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                              <ChevronRight className="w-3 h-3" />
                              <span>
                                <strong className="text-zinc-300">'Bereiche'</strong>: Füge die benötigten Rechte ein
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Copy Fields */}
                <div className="space-y-2">
                  <CopyButton
                    text={appUrl || "https://brospify-hub.vercel.app"}
                    label="Unsere Hub-URL"
                  />
                  <CopyButton
                    text="read_products, write_products"
                    label="Benötigte Bereiche"
                  />
                </div>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-800"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-zinc-900 text-zinc-500">
                      Deine Shopify-Daten eingeben
                    </span>
                  </div>
                </div>

                {/* Input Fields */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                      Shop Domain
                    </label>
                    <input
                      type="text"
                      value={shopDomain}
                      onChange={(e) => setShopDomain(e.target.value)}
                      placeholder="dein-shop.myshopify.com"
                      className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                      Client-ID
                    </label>
                    <input
                      type="text"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="z.B. a1b2c3d4e5f6..."
                      className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                      Schlüssel (Client Secret)
                    </label>
                    <input
                      type="password"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder="z.B. shpss_..."
                      className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm font-mono"
                    />
                  </div>
                </div>

                {/* Connect Button */}
                <button
                  onClick={connectShop}
                  disabled={loading}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-medium transition text-sm flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Store className="w-4 h-4" />
                      Shop jetzt verbinden
                    </>
                  )}
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
          </div>

          {/* STEP 2 */}
          <div
            className={`border rounded-2xl p-6 transition ${
              step2Done
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-zinc-800 bg-zinc-900"
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  step2Done ? "bg-emerald-500/20" : "bg-zinc-800"
                }`}
              >
                {step2Done ? (
                  <Check className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Package className="w-5 h-5 text-zinc-400" />
                )}
              </div>
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider">
                  Schritt 2
                </div>
                <h2 className="font-semibold">Fulfillment Automatisierung</h2>
              </div>
            </div>

            {!step2Done && (
              <div className="space-y-3">
                <p className="text-zinc-400 text-sm">
                  Installiere jetzt die kostenlose{" "}
                  <strong className="text-white">DSers-App</strong> im Shopify
                  App Store, um später günstigen Versand zu nutzen.
                </p>
                <a
                  href="https://apps.shopify.com/dsers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-sm transition"
                >
                  DSers im App Store öffnen
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={completeStep2}
                  disabled={loading}
                  className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl font-medium transition text-sm"
                >
                  Erledigt (App installiert)
                </button>
              </div>
            )}

            {step2Done && (
              <p className="text-emerald-400 text-sm">
                DSers-App wurde als installiert markiert.
              </p>
            )}
          </div>

          {/* STEP 3 */}
          <div className="border border-zinc-800 bg-zinc-900 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-zinc-800">
                <Rocket className="w-5 h-5 text-zinc-400" />
              </div>
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wider">
                  Schritt 3
                </div>
                <h2 className="font-semibold">Dashboard freischalten</h2>
              </div>
            </div>

            <button
              onClick={() => router.push("/dashboard")}
              disabled={!step1Done || !step2Done}
              className={`w-full py-3 rounded-xl font-medium transition text-sm flex items-center justify-center gap-2 ${
                step1Done && step2Done
                  ? "bg-indigo-600 hover:bg-indigo-500 cursor-pointer"
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              }`}
            >
              <Rocket className="w-4 h-4" />
              Zu meinen Produkten
            </button>

            {(!step1Done || !step2Done) && (
              <p className="text-zinc-500 text-xs mt-2 text-center">
                Schließe zuerst Schritt 1 & 2 ab.
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 px-4 py-3 rounded-xl mt-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Skip Modal */}
      {showSkipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md relative">
            <button
              onClick={() => setShowSkipModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-5">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 mb-4">
                <AlertCircle className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-lg font-bold">Achtung!</h3>
              <p className="text-zinc-400 text-sm mt-2 leading-relaxed">
                Ohne Shopify-Verbindung ist kein automatischer 1-Klick-Import
                möglich. Du kannst die Produkte nur ansehen. Willst du trotzdem
                fortfahren?
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSkipModal(false)}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl font-medium transition text-sm"
              >
                Zurück
              </button>
              <button
                onClick={skipStep1}
                disabled={loading}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 rounded-xl font-medium transition text-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Ja, trotzdem überspringen"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
