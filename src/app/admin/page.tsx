"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  Loader2,
  X,
  LogOut,
  Shield,
  Save,
  Check,
  AlertCircle,
} from "lucide-react";

interface Produkt {
  rowIndex: number;
  id: string;
  sku: string;
  monat: string;
  titel: string;
  bildUrl: string;
  beschreibung: string;
  preis: string;
  aliExpressLink: string;
}

const EMPTY_PRODUCT = {
  id: "",
  sku: "SPORT",
  monat: "",
  titel: "",
  bildUrl: "",
  beschreibung: "",
  preis: "",
  aliExpressLink: "",
};

const SKU_OPTIONS = ["SPORT", "TREND", "HAUSTIER", "KÜCHE", "BEAUTY"];

export default function AdminPage() {
  const router = useRouter();
  const [produkte, setProdukte] = useState<Produkt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal state
  const [editModal, setEditModal] = useState(false);
  const [editProduct, setEditProduct] = useState<
    (Omit<Produkt, "rowIndex"> & { rowIndex?: number }) | null
  >(null);
  const [isNew, setIsNew] = useState(false);

  // Bulk import state
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkJson, setBulkJson] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  // Filter
  const [filterSku, setFilterSku] = useState<string>("ALL");

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/products");
      if (res.status === 401) {
        router.push("/");
        return;
      }
      const data = await res.json();
      setProdukte(
        (data.produkte || []).filter((p: Produkt) => p.id || p.titel)
      );
    } catch {
      setError("Fehler beim Laden.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  function openNew() {
    setEditProduct({ ...EMPTY_PRODUCT });
    setIsNew(true);
    setEditModal(true);
  }

  function openEdit(p: Produkt) {
    setEditProduct({ ...p });
    setIsNew(false);
    setEditModal(true);
  }

  async function handleSave() {
    if (!editProduct) return;
    setSaving(true);
    setError("");

    try {
      const method = isNew ? "POST" : "PUT";
      const body = isNew
        ? editProduct
        : { ...editProduct, rowIndex: editProduct.rowIndex };

      const res = await fetch("/api/admin/products", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error);
        return;
      }

      setEditModal(false);
      setEditProduct(null);
      setSuccess(isNew ? "Produkt hinzugefügt." : "Produkt aktualisiert.");
      setTimeout(() => setSuccess(""), 3000);
      await loadProducts();
    } catch {
      setError("Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(rowIndex: number) {
    if (!confirm("Produkt wirklich löschen?")) return;

    try {
      const res = await fetch("/api/admin/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error);
        return;
      }

      setSuccess("Produkt gelöscht.");
      setTimeout(() => setSuccess(""), 3000);
      await loadProducts();
    } catch {
      setError("Löschen fehlgeschlagen.");
    }
  }

  async function handleBulkImport() {
    setBulkLoading(true);
    setError("");

    try {
      let parsed;
      try {
        parsed = JSON.parse(bulkJson);
      } catch {
        setError(
          "Ungültiges JSON. Bitte überprüfe die Formatierung."
        );
        setBulkLoading(false);
        return;
      }

      const payload = Array.isArray(parsed)
        ? { produkte: parsed }
        : parsed;

      const res = await fetch("/api/admin/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setBulkModal(false);
      setBulkJson("");
      setSuccess(data.message);
      setTimeout(() => setSuccess(""), 5000);
      await loadProducts();
    } catch {
      setError("Bulk-Import fehlgeschlagen.");
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  const filtered =
    filterSku === "ALL"
      ? produkte
      : produkte.filter((p) => p.sku === filterSku);

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
            <Shield className="w-5 h-5 text-amber-400" />
            <h1 className="text-lg font-bold">Admin Panel</h1>
            <span className="text-xs bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded-full">
              {produkte.length} Produkte
            </span>
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
        {/* Status messages */}
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 px-4 py-3 rounded-xl mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError("")} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-400/10 px-4 py-3 rounded-xl mb-4">
            <Check className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Actions bar */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" />
            Produkt hinzufügen
          </button>
          <button
            onClick={() => setBulkModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-sm font-medium transition"
          >
            <Upload className="w-4 h-4" />
            JSON Bulk Import
          </button>

          <select
            value={filterSku}
            onChange={(e) => setFilterSku(e.target.value)}
            className="ml-auto px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Alle SKUs</option>
            {SKU_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Products table */}
        <div className="border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-900 text-zinc-400 text-left">
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Monat</th>
                  <th className="px-4 py-3 font-medium">Titel</th>
                  <th className="px-4 py-3 font-medium">Preis</th>
                  <th className="px-4 py-3 font-medium w-24">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filtered.map((p) => (
                  <tr
                    key={`${p.rowIndex}-${p.id}`}
                    className="hover:bg-zinc-900/50 transition"
                  >
                    <td className="px-4 py-3 text-zinc-400 font-mono text-xs">
                      {p.id}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-md text-xs font-medium">
                        {p.sku}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{p.monat}</td>
                    <td className="px-4 py-3 text-white max-w-xs truncate">
                      {p.titel}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{p.preis}€</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 hover:bg-zinc-800 rounded-lg transition"
                        >
                          <Pencil className="w-4 h-4 text-zinc-400" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.rowIndex)}
                          className="p-1.5 hover:bg-red-500/10 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-zinc-500"
                    >
                      Keine Produkte gefunden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Edit/Add Modal */}
      {editModal && editProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">
                {isNew ? "Produkt hinzufügen" : "Produkt bearbeiten"}
              </h3>
              <button
                onClick={() => setEditModal(false)}
                className="text-zinc-500 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">ID</label>
                  <input
                    type="text"
                    value={editProduct.id}
                    onChange={(e) =>
                      setEditProduct({ ...editProduct, id: e.target.value })
                    }
                    placeholder="Auto-generiert"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">SKU</label>
                  <select
                    value={editProduct.sku}
                    onChange={(e) =>
                      setEditProduct({ ...editProduct, sku: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {SKU_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Monat (MM/YYYY)
                  </label>
                  <input
                    type="text"
                    value={editProduct.monat}
                    onChange={(e) =>
                      setEditProduct({ ...editProduct, monat: e.target.value })
                    }
                    placeholder="04/2026"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Preis
                  </label>
                  <input
                    type="text"
                    value={editProduct.preis}
                    onChange={(e) =>
                      setEditProduct({ ...editProduct, preis: e.target.value })
                    }
                    placeholder="29.99"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Titel</label>
                <input
                  type="text"
                  value={editProduct.titel}
                  onChange={(e) =>
                    setEditProduct({ ...editProduct, titel: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Bild URL
                </label>
                <input
                  type="text"
                  value={editProduct.bildUrl}
                  onChange={(e) =>
                    setEditProduct({ ...editProduct, bildUrl: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Beschreibung
                </label>
                <textarea
                  value={editProduct.beschreibung}
                  onChange={(e) =>
                    setEditProduct({
                      ...editProduct,
                      beschreibung: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  AliExpress Link
                </label>
                <input
                  type="text"
                  value={editProduct.aliExpressLink}
                  onChange={(e) =>
                    setEditProduct({
                      ...editProduct,
                      aliExpressLink: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditModal(false)}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-sm font-medium transition"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Speichern
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {bulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">JSON Bulk Import</h3>
              <button
                onClick={() => setBulkModal(false)}
                className="text-zinc-500 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-zinc-400 text-sm mb-3">
              Füge einen JSON-Array mit Produktdaten ein. Format:
            </p>

            <pre className="text-xs bg-zinc-800 border border-zinc-700 rounded-xl p-3 mb-4 text-zinc-400 overflow-x-auto">
{`[
  {
    "id": "1",
    "sku": "SPORT",
    "monat": "04/2026",
    "titel": "Produktname",
    "bildUrl": "https://...",
    "beschreibung": "Beschreibung...",
    "preis": "29.99",
    "aliExpressLink": "https://..."
  }
]`}
            </pre>

            <textarea
              value={bulkJson}
              onChange={(e) => setBulkJson(e.target.value)}
              rows={10}
              placeholder="JSON hier einfügen..."
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setBulkModal(false)}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-sm font-medium transition"
              >
                Abbrechen
              </button>
              <button
                onClick={handleBulkImport}
                disabled={bulkLoading || !bulkJson.trim()}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2"
              >
                {bulkLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Importieren
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
