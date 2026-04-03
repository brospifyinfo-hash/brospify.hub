"use client";

import { useState, useEffect, useCallback, useRef, DragEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Pencil, Trash2, Upload, Loader2, X, LogOut, Shield, Save,
  Check, AlertCircle, ImagePlus, BarChart3, DollarSign, Zap,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────

interface ProduktExtra {
  stats?: { trendScore: number; viralScore: number; impulseBuyFactor: number; problemSolverIndex: number; marketSaturation: number };
  finances?: { buyPrice: number; recommendedSellPrice: number; profitMargin: number };
  images?: string[];
}

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
  extra: ProduktExtra;
}

interface EditProduct {
  rowIndex?: number;
  id: string;
  sku: string;
  monat: string;
  titel: string;
  beschreibung: string;
  aliExpressLink: string;
  images: string[];
  stats: { trendScore: number; viralScore: number; impulseBuyFactor: number; problemSolverIndex: number; marketSaturation: number };
  finances: { buyPrice: number; recommendedSellPrice: number; profitMargin: number };
}

const EMPTY: EditProduct = {
  id: "", sku: "SPORT", monat: "", titel: "", beschreibung: "", aliExpressLink: "",
  images: [],
  stats: { trendScore: 0, viralScore: 0, impulseBuyFactor: 0, problemSolverIndex: 0, marketSaturation: 0 },
  finances: { buyPrice: 0, recommendedSellPrice: 0, profitMargin: 0 },
};

const SKU_OPTIONS = ["SPORT", "TREND", "HAUSTIER", "KÜCHE", "BEAUTY"];

// ─── Drop Zone ───────────────────────────────────────────────────

function ImageDropZone({ images, onChange }: { images: string[]; onChange: (imgs: string[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(files: FileList | File[]) {
    const fileArr = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!fileArr.length) return;
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of fileArr) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (res.ok) {
          const data = await res.json();
          newUrls.push(data.url);
        } else {
          // Fallback: use object URL for preview (won't persist but shows in UI)
          newUrls.push(URL.createObjectURL(file));
        }
      } catch {
        newUrls.push(URL.createObjectURL(file));
      }
    }
    onChange([...images, ...newUrls]);
    setUploading(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: DragEvent) { e.preventDefault(); setDragging(true); }
  function handleDragLeave() { setDragging(false); }

  return (
    <div className="space-y-3">
      <label className="block text-xs text-zinc-400 font-medium">Bilder</label>

      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url, i) => (
            <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-zinc-700 group">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => onChange(images.filter((_, idx) => idx !== i))}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
          dragging
            ? "border-indigo-500 bg-indigo-500/10"
            : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50"
        }`}
      >
        {uploading ? (
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mx-auto" />
        ) : (
          <>
            <ImagePlus className={`w-8 h-8 mx-auto mb-2 ${dragging ? "text-indigo-400" : "text-zinc-600"}`} />
            <p className="text-sm text-zinc-400">Bilder hierher ziehen oder <span className="text-indigo-400">klicken</span></p>
            <p className="text-xs text-zinc-600 mt-1">PNG, JPG, WebP – max. 5MB</p>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => e.target.files && uploadFiles(e.target.files)} />
      </div>

      {/* URL Input */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Oder Bild-URL einfügen..."
          className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const val = (e.target as HTMLInputElement).value.trim();
              if (val) { onChange([...images, val]); (e.target as HTMLInputElement).value = ""; }
            }
          }}
        />
      </div>
    </div>
  );
}

// ─── Stat Input ──────────────────────────────────────────────────

function StatInput({ label, value, onChange, icon: Icon, color }: {
  label: string; value: number; onChange: (v: number) => void; icon: typeof Zap; color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className={`w-4 h-4 ${color} shrink-0`} />
      <span className="text-xs text-zinc-400 w-32 shrink-0">{label}</span>
      <input type="range" min={0} max={100} value={value} onChange={e => onChange(Number(e.target.value))} className="flex-1 accent-indigo-500" />
      <span className="text-sm font-mono text-white w-10 text-right">{value}%</span>
    </div>
  );
}

// ─── Admin Page ──────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const [produkte, setProdukte] = useState<Produkt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editModal, setEditModal] = useState(false);
  const [editProduct, setEditProduct] = useState<EditProduct | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkJson, setBulkJson] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [filterSku, setFilterSku] = useState("ALL");

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/products");
      if (res.status === 401) { router.push("/"); return; }
      const data = await res.json();
      setProdukte((data.produkte || []).filter((p: Produkt) => p.id || p.titel));
    } catch { setError("Fehler beim Laden."); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  function produktToEdit(p: Produkt): EditProduct {
    return {
      rowIndex: p.rowIndex, id: p.id, sku: p.sku, monat: p.monat, titel: p.titel,
      beschreibung: p.beschreibung, aliExpressLink: p.aliExpressLink,
      images: [p.bildUrl, ...(p.extra?.images || [])].filter(Boolean),
      stats: p.extra?.stats || { ...EMPTY.stats },
      finances: p.extra?.finances || { ...EMPTY.finances },
    };
  }

  function openNew() { setEditProduct({ ...EMPTY, stats: { ...EMPTY.stats }, finances: { ...EMPTY.finances }, images: [] }); setIsNew(true); setEditModal(true); }
  function openEdit(p: Produkt) { setEditProduct(produktToEdit(p)); setIsNew(false); setEditModal(true); }

  async function handleSave() {
    if (!editProduct) return;
    setSaving(true); setError("");
    try {
      const body = {
        ...(isNew ? {} : { rowIndex: editProduct.rowIndex }),
        id: editProduct.id || `prod_${Date.now()}`,
        sku: editProduct.sku, monat: editProduct.monat,
        titel: editProduct.titel, beschreibung: editProduct.beschreibung,
        aliExpressLink: editProduct.aliExpressLink,
        bildUrl: editProduct.images[0] || "",
        preis: String(editProduct.finances.recommendedSellPrice || ""),
        extra: { stats: editProduct.stats, finances: editProduct.finances, images: editProduct.images },
      };
      const res = await fetch("/api/admin/products", { method: isNew ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); setError(d.error); return; }
      setEditModal(false); setEditProduct(null);
      setSuccess(isNew ? "Produkt hinzugefügt." : "Produkt aktualisiert.");
      setTimeout(() => setSuccess(""), 3000);
      await loadProducts();
    } catch { setError("Speichern fehlgeschlagen."); }
    finally { setSaving(false); }
  }

  async function handleDelete(rowIndex: number) {
    if (!confirm("Produkt wirklich löschen?")) return;
    try {
      const res = await fetch("/api/admin/products", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rowIndex }) });
      if (!res.ok) { const d = await res.json(); setError(d.error); return; }
      setSuccess("Produkt gelöscht."); setTimeout(() => setSuccess(""), 3000);
      await loadProducts();
    } catch { setError("Löschen fehlgeschlagen."); }
  }

  async function handleBulkImport() {
    setBulkLoading(true); setError("");
    try {
      let parsed;
      try { parsed = JSON.parse(bulkJson); } catch { setError("Ungültiges JSON."); setBulkLoading(false); return; }
      const payload = Array.isArray(parsed) ? parsed : parsed;
      const res = await fetch("/api/admin/products/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setBulkModal(false); setBulkJson("");
      setSuccess(`${data.count} Produkte importiert.`); setTimeout(() => setSuccess(""), 5000);
      await loadProducts();
    } catch { setError("Bulk-Import fehlgeschlagen."); }
    finally { setBulkLoading(false); }
  }

  async function handleLogout() { await fetch("/api/auth/logout", { method: "POST" }); router.push("/"); }

  const filtered = filterSku === "ALL" ? produkte : produkte.filter(p => p.sku === filterSku);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>;

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-amber-400" />
            <h1 className="text-lg font-bold">Admin Panel</h1>
            <span className="text-xs bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded-full">{produkte.length} Produkte</span>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition"><LogOut className="w-4 h-4" />Abmelden</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 px-4 py-3 rounded-xl mb-4"><AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span><button onClick={() => setError("")} className="ml-auto"><X className="w-4 h-4" /></button></div>}
        {success && <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-400/10 px-4 py-3 rounded-xl mb-4"><Check className="w-4 h-4 shrink-0" /><span>{success}</span></div>}

        <div className="flex flex-wrap gap-3 mb-6">
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-medium transition"><Plus className="w-4 h-4" />Produkt hinzufügen</button>
          <button onClick={() => setBulkModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-sm font-medium transition"><Upload className="w-4 h-4" />JSON Bulk Import</button>
          <select value={filterSku} onChange={e => setFilterSku(e.target.value)} className="ml-auto px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="ALL">Alle SKUs</option>
            {SKU_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p, idx) => (
            <motion.div key={`${p.rowIndex}-${p.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
              className="border border-zinc-800 bg-zinc-900 rounded-xl overflow-hidden hover:border-zinc-700 transition group">
              <div className="aspect-video bg-zinc-800 overflow-hidden">
                {p.bildUrl ? <img src={p.bildUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-700"><ImagePlus className="w-8 h-8" /></div>}
              </div>
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-[10px] font-medium">{p.sku}</span>
                  <span className="text-[10px] text-zinc-500">{p.monat}</span>
                  <span className="text-[10px] text-zinc-500 ml-auto font-mono">{p.id}</span>
                </div>
                <h3 className="text-sm font-semibold truncate">{p.titel}</h3>
                <div className="flex items-center justify-between">
                  <span className="text-indigo-400 font-bold text-sm">{p.extra?.finances?.recommendedSellPrice || p.preis}&euro;</span>
                  {p.extra?.stats?.trendScore ? <span className="text-[10px] text-emerald-400 flex items-center gap-0.5"><Zap className="w-3 h-3" />{p.extra.stats.trendScore}%</span> : null}
                </div>
                <div className="flex gap-1 pt-1 border-t border-zinc-800">
                  <button onClick={() => openEdit(p)} className="flex-1 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition flex items-center justify-center gap-1"><Pencil className="w-3 h-3" />Bearbeiten</button>
                  <button onClick={() => handleDelete(p.rowIndex)} className="py-1.5 px-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && <div className="col-span-full text-center py-12 text-zinc-500">Keine Produkte gefunden.</div>}
        </div>
      </main>

      {/* ─── EDIT/ADD MODAL ─────────────────────────────────────── */}
      <AnimatePresence>
        {editModal && editProduct && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">{isNew ? "Produkt hinzufügen" : "Produkt bearbeiten"}</h3>
                <button onClick={() => setEditModal(false)} className="text-zinc-500 hover:text-white transition"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-5">
                {/* Basic fields */}
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="block text-xs text-zinc-400 mb-1">ID</label><input type="text" value={editProduct.id} onChange={e => setEditProduct({ ...editProduct, id: e.target.value })} placeholder="Auto" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                  <div><label className="block text-xs text-zinc-400 mb-1">SKU</label><select value={editProduct.sku} onChange={e => setEditProduct({ ...editProduct, sku: e.target.value })} className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">{SKU_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                  <div><label className="block text-xs text-zinc-400 mb-1">Monat (MM/YYYY)</label><input type="text" value={editProduct.monat} onChange={e => setEditProduct({ ...editProduct, monat: e.target.value })} placeholder="04/2026" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                </div>

                <div><label className="block text-xs text-zinc-400 mb-1">Titel</label><input type="text" value={editProduct.titel} onChange={e => setEditProduct({ ...editProduct, titel: e.target.value })} className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                <div><label className="block text-xs text-zinc-400 mb-1">Beschreibung (HTML)</label><textarea value={editProduct.beschreibung} onChange={e => setEditProduct({ ...editProduct, beschreibung: e.target.value })} rows={3} className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" /></div>
                <div><label className="block text-xs text-zinc-400 mb-1">AliExpress Link</label><input type="text" value={editProduct.aliExpressLink} onChange={e => setEditProduct({ ...editProduct, aliExpressLink: e.target.value })} className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>

                {/* Image Drop Zone */}
                <ImageDropZone images={editProduct.images} onChange={imgs => setEditProduct({ ...editProduct, images: imgs })} />

                {/* Finances */}
                <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-400" />Finanzen</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className="block text-[10px] text-zinc-500 mb-1">Einkaufspreis</label><input type="number" step="0.01" value={editProduct.finances.buyPrice || ""} onChange={e => setEditProduct({ ...editProduct, finances: { ...editProduct.finances, buyPrice: Number(e.target.value) } })} className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                    <div><label className="block text-[10px] text-zinc-500 mb-1">Verkaufspreis</label><input type="number" step="0.01" value={editProduct.finances.recommendedSellPrice || ""} onChange={e => setEditProduct({ ...editProduct, finances: { ...editProduct.finances, recommendedSellPrice: Number(e.target.value) } })} className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                    <div><label className="block text-[10px] text-zinc-500 mb-1">Marge</label><input type="number" step="0.01" value={editProduct.finances.profitMargin || ""} onChange={e => setEditProduct({ ...editProduct, finances: { ...editProduct.finances, profitMargin: Number(e.target.value) } })} className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                  </div>
                </div>

                {/* Stats */}
                <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-400" />Scores</h4>
                  <div className="space-y-2">
                    <StatInput label="Trend Score" value={editProduct.stats.trendScore} onChange={v => setEditProduct({ ...editProduct, stats: { ...editProduct.stats, trendScore: v } })} icon={Zap} color="text-indigo-400" />
                    <StatInput label="Viralitäts-Score" value={editProduct.stats.viralScore} onChange={v => setEditProduct({ ...editProduct, stats: { ...editProduct.stats, viralScore: v } })} icon={Zap} color="text-purple-400" />
                    <StatInput label="Impulskauf-Faktor" value={editProduct.stats.impulseBuyFactor} onChange={v => setEditProduct({ ...editProduct, stats: { ...editProduct.stats, impulseBuyFactor: v } })} icon={Zap} color="text-amber-400" />
                    <StatInput label="Problemlöser-Index" value={editProduct.stats.problemSolverIndex} onChange={v => setEditProduct({ ...editProduct, stats: { ...editProduct.stats, problemSolverIndex: v } })} icon={Zap} color="text-emerald-400" />
                    <StatInput label="Marktsättigung" value={editProduct.stats.marketSaturation} onChange={v => setEditProduct({ ...editProduct, stats: { ...editProduct.stats, marketSaturation: v } })} icon={Zap} color="text-red-400" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setEditModal(false)} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-sm font-medium transition">Abbrechen</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Speichern</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── BULK IMPORT MODAL ──────────────────────────────────── */}
      <AnimatePresence>
        {bulkModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">JSON Bulk Import</h3>
                <button onClick={() => setBulkModal(false)} className="text-zinc-500 hover:text-white transition"><X className="w-5 h-5" /></button>
              </div>

              <p className="text-zinc-400 text-sm mb-3">Neues JSON-Format mit Stats & Finanzen:</p>
              <pre className="text-[11px] bg-zinc-800 border border-zinc-700 rounded-xl p-3 mb-4 text-zinc-400 overflow-x-auto leading-relaxed">
{`[{
  "id": "prod_001", "sku": "SPORT", "monat": "04/2026",
  "title": "Ergonomisches Nackenkissen",
  "description": "<p>Perfekt für Reisen...</p>",
  "images": ["https://..."],
  "finances": { "buyPrice": 4.50, "recommendedSellPrice": 24.99, "profitMargin": 20.49 },
  "stats": { "trendScore": 98, "viralScore": 92, "impulseBuyFactor": 75, "problemSolverIndex": 90, "marketSaturation": 15 },
  "links": { "aliexpressLink": "https://..." }
}]`}
              </pre>

              <textarea value={bulkJson} onChange={e => setBulkJson(e.target.value)} rows={10} placeholder="JSON hier einfügen..."
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />

              <div className="flex gap-3 mt-4">
                <button onClick={() => setBulkModal(false)} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-sm font-medium transition">Abbrechen</button>
                <button onClick={handleBulkImport} disabled={bulkLoading || !bulkJson.trim()} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
                  {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Upload className="w-4 h-4" />Importieren</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
