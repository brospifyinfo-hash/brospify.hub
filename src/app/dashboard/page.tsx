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
    loadProducts();
  }, [loadProducts]);

  async function handleImport(produktId: string) {
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
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition"
          >
            <LogOut className="w-4 h-4" />
            Abmelden
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
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
                          {produkt.preis}€
                        </div>

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
              onClick={() => setSuccessModal({ open: false, aliExpressLink: "" })}
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
    </div>
  );
}
