"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Loader2,
  Check,
  Copy,
  X,
  LogOut,
  TrendingUp,
  ExternalLink,
  Settings,
  AlertCircle,
  Store,
  Shield,
  Key,
  Globe,
  ChevronRight,
  Info,
  SkipForward,
  Package,
} from "lucide-react";

interface Produkt {
  id: string;
  sku: string;
  monat: string;
  titel: string;
  bildUrl: string;
  beschreibung: string;
  preis: string;
  aliExpressLink: string;
}

interface MonthChart {
  monat: string;
  produkte: Produkt[];
}

const MONTH_NAMES: Record<string, string> = {
  "01": "Januar",
  "02": "Februar",
  "03": "März",
  "04": "April",
  "05": "Mai",
  "06": "Juni",
  "07": "Juli",
  "08": "August",
  "09": "September",
  "10": "Oktober",
  "11": "November",
  "12": "Dezember",
};

function formatMonth(monat: string): string {
  const [mm, yyyy] = monat.split("/");
  const name = MONTH_NAMES[mm] || mm;
  return `Charts ${name} ${yyyy}`;
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
        <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-0.5">{label}</div>
        <div className="text-sm text-zinc-200 font-mono truncate">{text}</div>
      </div>
      <button onClick={handleCopy} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition text-xs font-medium">
        {copied ? (
          <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Kopiert</span></>
        ) : (
          <><Copy className="w-3.5 h-3.5 text-zinc-400" /><span className="text-zinc-300">Kopieren</span></>
        )}
      </button>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [charts, setCharts] = useState<MonthChart[]>([]);
  const [loading, setLoading] = useState(true);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState<{
    open: boolean;
    aliExpressLink: string;
  }>({ open: false, aliExpressLink: "" });
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [hasShopifyToken, setHasShopifyToken] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [shopDomain, setShopDomain] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      if (res.status === 401) {
        router.push("/");
        return;
      }
      const data = await res.json();
      setCharts(data.charts || []);
    } catch {
      setError("Fehler beim Laden der Produkte.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        setHasShopifyToken(data.hasShopifyToken || false);
        if (data.shopDomain) setShopDomain(data.shopDomain);
      });
    loadProducts();
  }, [loadProducts]);

  async function handleImport(produktId: string) {
    if (!hasShopifyToken) return;
    setImportingId(produktId);
    setError("");

    try {
      const res = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produktId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setSuccessModal({
        open: true,
        aliExpressLink: data.aliExpressLink || "",
      });
    } catch {
      setError("Import fehlgeschlagen.");
    } finally {
      setImportingId(null);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  function copyLink() {
    navigator.clipboard.writeText(successModal.aliExpressLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function connectShop() {
    if (!shopDomain.trim() || !clientId.trim() || !clientSecret.trim()) {
      setConnectError("Bitte fülle alle Felder aus.");
      return;
    }
    setConnectLoading(true);
    setConnectError("");

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
        setConnectError(data.error || "Fehler beim Verbinden.");
        return;
      }
      setHasShopifyToken(true);
      setShowSettings(false);
      setClientId("");
      setClientSecret("");
    } catch {
      setConnectError("Verbindungsfehler.");
    } finally {
      setConnectLoading(false);
    }
  }

  const instructions = [
    { num: 1, text: "Klicke in deinem Shopify-Admin links im Menü auf 'Apps' und dann auf den Button 'Apps im Dev Dashboard erstellen'." },
    { num: 2, text: "Im neuen Fenster klicke oben rechts auf 'App erstellen' und nenne sie 'brospify'." },
    { num: 3, text: "Klicke links im Menü auf 'Versionen' und dann auf 'Neue Version'." },
    { num: 4, text: "Konfiguration ausfüllen:", details: true },
    { num: 5, text: "Klicke oben rechts auf 'Veröffentlichen' und bestätige." },
    { num: 6, text: "Gehe nun links auf 'Einstellungen'. Kopiere die 'Client-ID' und den 'Schlüssel' (Secret) in die Felder unten." },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            <h1 className="text-lg font-bold">BrospifyHub</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition p-2 hover:bg-zinc-800 rounded-lg"
              title="Einstellungen"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition"
            >
              <LogOut className="w-4 h-4" />
              Abmelden
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* No Shopify Connection Banner */}
        {!hasShopifyToken && (
          <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 px-5 py-4 rounded-xl mb-6">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Shopify-Verbindung erforderlich</p>
              <p className="text-xs text-amber-400/70 mt-0.5">
                Der 1-Klick-Import ist deaktiviert. Verbinde deinen Shop über die Einstellungen.
              </p>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-medium text-white transition"
            >
              Jetzt verbinden
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 px-4 py-3 rounded-xl mb-6">
            <span>{error}</span>
          </div>
        )}

        {charts.length === 0 ? (
          <div className="text-center py-20">
            <TrendingUp className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-zinc-400">
              Noch keine Produkte verfügbar
            </h2>
            <p className="text-zinc-500 mt-2">
              Deine monatlichen Winning Product Charts erscheinen hier.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {charts.map((chart) => (
              <section key={chart.monat}>
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-400" />
                  {formatMonth(chart.monat)}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {chart.produkte.map((produkt) => (
                    <div
                      key={produkt.id}
                      className="border border-zinc-800 bg-zinc-900 rounded-2xl overflow-hidden hover:border-zinc-700 transition group"
                    >
                      {produkt.bildUrl && (
                        <div className="aspect-square bg-zinc-800 overflow-hidden">
                          <img
                            src={produkt.bildUrl}
                            alt={produkt.titel}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                        </div>
                      )}

                      <div className="p-4 space-y-3">
                        <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                          {produkt.titel}
                        </h3>

                        <div className="text-lg font-bold text-indigo-400">
                          {produkt.preis}&euro;
                        </div>

                        {hasShopifyToken ? (
                          <button
                            onClick={() => handleImport(produkt.id)}
                            disabled={importingId === produkt.id}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-medium transition text-sm flex items-center justify-center gap-2"
                          >
                            {importingId === produkt.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <ShoppingCart className="w-4 h-4" />
                                In den Shop importieren
                              </>
                            )}
                          </button>
                        ) : (
                          <div className="w-full py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-center text-zinc-500 flex items-center justify-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            Shopify-Verbindung erforderlich
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Success Modal */}
      {successModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md relative">
            <button
              onClick={() =>
                setSuccessModal({ open: false, aliExpressLink: "" })
              }
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 mb-4">
                <Check className="w-7 h-7 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold">
                Produkt erfolgreich importiert!
              </h3>
              <p className="text-zinc-400 text-sm mt-2">
                Kopiere jetzt diesen Link und füge ihn in DSers ein, um das
                Fulfillment zu automatisieren:
              </p>
            </div>

            {successModal.aliExpressLink && (
              <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-xl p-3">
                <input
                  type="text"
                  value={successModal.aliExpressLink}
                  readOnly
                  className="flex-1 bg-transparent text-sm text-zinc-300 outline-none truncate"
                />
                <button
                  onClick={copyLink}
                  className="shrink-0 p-2 hover:bg-zinc-700 rounded-lg transition"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-zinc-400" />
                  )}
                </button>
              </div>
            )}

            {successModal.aliExpressLink && (
              <a
                href={successModal.aliExpressLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl font-medium transition text-sm flex items-center justify-center gap-2 text-zinc-300"
              >
                <ExternalLink className="w-4 h-4" />
                Link öffnen
              </a>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setShowSettings(false);
                setConnectError("");
              }}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-5">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-400" />
                Einstellungen
              </h3>
              <p className="text-zinc-400 text-sm mt-1">
                Shopify Store verbinden oder Verbindung aktualisieren.
              </p>
            </div>

            {hasShopifyToken && (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-xl mb-4 text-sm">
                <Check className="w-4 h-4" />
                Shop verbunden{shopDomain ? `: ${shopDomain}` : ""}
              </div>
            )}

            {/* Instructions */}
            <div className="space-y-2 mb-5">
              <h4 className="text-sm font-medium text-zinc-300">
                Anleitung: Custom App erstellen
              </h4>
              {instructions.map((inst) => (
                <div key={inst.num}>
                  <button
                    onClick={() => setExpandedStep(expandedStep === inst.num ? null : inst.num)}
                    className="w-full flex items-start gap-2.5 text-left"
                  >
                    <div className="w-6 h-6 rounded-md bg-indigo-600/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-indigo-400">{inst.num}</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed flex-1">{inst.text}</p>
                    {inst.details && (
                      <ChevronRight className={`w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5 transition-transform ${expandedStep === inst.num ? "rotate-90" : ""}`} />
                    )}
                  </button>
                  {inst.details && expandedStep === inst.num && (
                    <div className="ml-8 mt-2 space-y-2">
                      <p className="text-xs text-zinc-400"><strong className="text-zinc-300">'App-URL'</strong>: Füge unsere Hub-URL ein</p>
                      <p className="text-xs text-amber-400">WICHTIG: Entferne den Haken bei 'App in den Shopify-Adminbereich einbetten'.</p>
                      <p className="text-xs text-zinc-400"><strong className="text-zinc-300">'Bereiche'</strong>: Füge die benötigten Rechte ein</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2 mb-5">
              <CopyButton text={appUrl || "https://brospify-hub.vercel.app"} label="Unsere Hub-URL" />
              <CopyButton text="read_products, write_products" label="Benötigte Bereiche" />
            </div>

            <div className="relative mb-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-zinc-900 text-zinc-500">Deine Shopify-Daten</span>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Shop Domain</label>
                <input
                  type="text"
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  placeholder="dein-shop.myshopify.com"
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Client-ID</label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="z.B. a1b2c3d4e5f6..."
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Schlüssel (Client Secret)</label>
                <input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="z.B. shpss_..."
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition text-sm font-mono"
                />
              </div>
            </div>

            {connectError && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 px-4 py-3 rounded-xl mb-4">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{connectError}</span>
              </div>
            )}

            <button
              onClick={connectShop}
              disabled={connectLoading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl font-medium transition text-sm flex items-center justify-center gap-2"
            >
              {connectLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Store className="w-4 h-4" />
                  Shop jetzt verbinden
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
