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
} from "lucide-react";

interface SessionInfo {
  setupStep1Done: boolean;
  setupStep2Done: boolean;
  shopDomain: string | null;
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

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [step1Done, setStep1Done] = useState(false);
  const [step2Done, setStep2Done] = useState(false);
  const [shopDomain, setShopDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data: SessionInfo) => {
        setSession(data);
        setStep1Done(data.setupStep1Done);
        setStep2Done(data.setupStep2Done);
        if (data.shopDomain) setShopDomain(data.shopDomain);
      });
  }, []);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setError("Shopify-Verbindung fehlgeschlagen. Bitte versuche es erneut.");
    }
    const step = searchParams.get("step");
    if (step === "2") {
      setStep1Done(true);
    }
  }, [searchParams]);

  async function startShopifyOAuth() {
    if (!shopDomain.trim()) {
      setError("Bitte gib deine Shop-Domain ein.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/shopify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopDomain: shopDomain.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      window.location.href = data.authUrl;
    } catch {
      setError("Verbindungsfehler.");
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

  const steps = [
    {
      icon: Store,
      title: "Shopify Store verbinden",
      done: step1Done,
    },
    {
      icon: Package,
      title: "Fulfillment Automatisierung",
      done: step2Done,
    },
    {
      icon: Rocket,
      title: "Dashboard freischalten",
      done: false,
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
                <h2 className="font-semibold">{steps[0].title}</h2>
              </div>
            </div>

            {!step1Done && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  placeholder="dein-shop.myshopify.com"
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm"
                />
                <button
                  onClick={startShopifyOAuth}
                  disabled={loading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-medium transition text-sm flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Store className="w-4 h-4" />
                      Mit Shopify verbinden
                    </>
                  )}
                </button>
              </div>
            )}

            {step1Done && (
              <p className="text-emerald-400 text-sm">
                Store verbunden: {session.shopDomain || shopDomain}
              </p>
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
                <h2 className="font-semibold">{steps[1].title}</h2>
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
                <h2 className="font-semibold">{steps[2].title}</h2>
              </div>
            </div>

            <button
              onClick={() => router.push("/dashboard")}
              disabled={!step1Done || !step2Done}
              className={`w-full py-3 rounded-xl font-medium transition text-sm flex items-center justify-center gap-2 ${
                step1Done && step2Done
                  ? "bg-indigo-600 hover:bg-indigo-500"
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
    </div>
  );
}
