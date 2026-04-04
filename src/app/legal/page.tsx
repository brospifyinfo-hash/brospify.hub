"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scale,
  Loader2,
  Check,
  AlertCircle,
  X,
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  ShieldCheck,
} from "lucide-react";
import Navigation from "@/components/Navigation";

interface LegalForm {
  firmenname: string;
  inhaber: string;
  strasse: string;
  plz: string;
  stadt: string;
  land: string;
  email: string;
  telefon: string;
  ustId: string;
  handelsregister: string;
  disclaimer: boolean;
}

const EMPTY_FORM: LegalForm = {
  firmenname: "",
  inhaber: "",
  strasse: "",
  plz: "",
  stadt: "",
  land: "Deutschland",
  email: "",
  telefon: "",
  ustId: "",
  handelsregister: "",
  disclaimer: false,
};

export default function LegalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasShopify, setHasShopify] = useState(false);
  const [form, setForm] = useState<LegalForm>(EMPTY_FORM);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
    details?: string[];
  } | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        if (!s.isLoggedIn) { router.push("/"); return; }
        setHasShopify(!!s.hasShopifyConnection);
        setLoading(false);
      })
      .catch(() => router.push("/"));
  }, [router]);

  function updateField<K extends keyof LegalForm>(key: K, value: LegalForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleGenerate() {
    if (!form.disclaimer) {
      setResult({ type: "error", message: "Bitte bestätige den Disclaimer." });
      return;
    }
    if (!form.firmenname || !form.inhaber || !form.strasse || !form.plz || !form.stadt || !form.email) {
      setResult({ type: "error", message: "Bitte fülle alle Pflichtfelder aus." });
      return;
    }

    setGenerating(true);
    setResult(null);

    try {
      const res = await fetch("/api/legal/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setResult({ type: "error", message: data.error || "Fehler beim Erstellen." });
        return;
      }

      const details: string[] = [];
      if (data.pages?.created?.length) {
        details.push(`Seiten erstellt: ${data.pages.created.join(", ")}`);
      }
      if (data.pages?.failed?.length) {
        details.push(`Fehlgeschlagen: ${data.pages.failed.join(", ")}`);
      }
      if (data.menuCreated) {
        details.push('Footer-Menü "Rechtliches" erstellt');
      }
      if (data.policiesSet) {
        details.push("Shopify-Richtlinien aktualisiert");
      }

      setResult({
        type: data.pages?.failed?.length ? "error" : "success",
        message: data.pages?.failed?.length
          ? "Teilweise erfolgreich. Einige Seiten konnten nicht erstellt werden."
          : "Alle Rechtstexte wurden erfolgreich in deinem Shop erstellt!",
        details,
      });
    } catch {
      setResult({ type: "error", message: "Verbindung fehlgeschlagen." });
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      <div className="fixed bottom-20 left-10 w-72 h-72 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Scale className="w-8 h-8 text-blue-400" />
            DACH-Sicherheitspaket
          </h1>
          <p className="text-zinc-400">
            Generiere rechtskonforme Seiten (Impressum, AGB, Datenschutz, Widerruf) und pushe sie direkt in deinen Shop.
          </p>
        </motion.div>

        {/* Result Toast */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`px-5 py-4 rounded-xl mb-6 border ${
                result.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                  : "bg-red-500/10 border-red-500/20 text-red-300"
              }`}
            >
              <div className="flex items-start gap-3">
                {result.type === "success" ? <Check className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
                <div className="flex-1">
                  <p className="text-sm font-medium">{result.message}</p>
                  {result.details && (
                    <ul className="mt-2 space-y-1">
                      {result.details.map((d, i) => (
                        <li key={i} className="text-xs opacity-80 flex items-center gap-1.5">
                          <Check className="w-3 h-3" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button onClick={() => setResult(null)} className="shrink-0"><X className="w-4 h-4" /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* No Shopify Banner */}
        {!hasShopify && (
          <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 px-5 py-4 rounded-xl mb-6">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Shopify nicht verbunden</p>
              <p className="text-xs text-amber-400/70 mt-0.5">Verbinde zuerst deinen Shop, um Rechtstexte zu erstellen.</p>
            </div>
            <button onClick={() => router.push("/setup")} className="shrink-0 btn-accent px-4 py-2 rounded-lg text-sm font-medium">Verbinden</button>
          </div>
        )}

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-strong rounded-2xl border border-white/10 p-6 space-y-6"
        >
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            Unternehmensdaten
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Firmenname *</label>
              <input type="text" value={form.firmenname} onChange={(e) => updateField("firmenname", e.target.value)} placeholder="Meine GmbH" className="input-glass w-full" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Inhaber / Geschäftsführer *</label>
              <input type="text" value={form.inhaber} onChange={(e) => updateField("inhaber", e.target.value)} placeholder="Max Mustermann" className="input-glass w-full" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" />Adresse *</label>
            <input type="text" value={form.strasse} onChange={(e) => updateField("strasse", e.target.value)} placeholder="Musterstraße 1" className="input-glass w-full mb-2" />
            <div className="grid grid-cols-3 gap-2">
              <input type="text" value={form.plz} onChange={(e) => updateField("plz", e.target.value)} placeholder="12345" className="input-glass" />
              <input type="text" value={form.stadt} onChange={(e) => updateField("stadt", e.target.value)} placeholder="Berlin" className="input-glass col-span-2" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Land</label>
            <select value={form.land} onChange={(e) => updateField("land", e.target.value)} className="input-glass w-full">
              <option value="Deutschland">Deutschland</option>
              <option value="Österreich">Österreich</option>
              <option value="Schweiz">Schweiz</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1 flex items-center gap-1"><Mail className="w-3 h-3" />E-Mail *</label>
              <input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} placeholder="info@firma.de" className="input-glass w-full" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1 flex items-center gap-1"><Phone className="w-3 h-3" />Telefon</label>
              <input type="tel" value={form.telefon} onChange={(e) => updateField("telefon", e.target.value)} placeholder="+49 123 456789" className="input-glass w-full" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">USt-IdNr.</label>
              <input type="text" value={form.ustId} onChange={(e) => updateField("ustId", e.target.value)} placeholder="DE123456789" className="input-glass w-full" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Handelsregister</label>
              <input type="text" value={form.handelsregister} onChange={(e) => updateField("handelsregister", e.target.value)} placeholder="HRB 12345, AG Berlin" className="input-glass w-full" />
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.disclaimer}
                onChange={(e) => updateField("disclaimer", e.target.checked)}
                className="mt-1 w-4 h-4 accent-[#95BF47] rounded"
              />
              <span className="text-xs text-amber-200 leading-relaxed">
                <strong className="text-amber-100">Pflicht-Disclaimer:</strong> Ich bestätige, dass ich die generierten Rechtstexte selbst auf Richtigkeit und Vollständigkeit prüfe. BrospifyHub leistet keine Rechtsberatung und übernimmt keine Haftung für Abmahnungen oder rechtliche Konsequenzen. Die Texte sind Vorlagen und ersetzen keine anwaltliche Beratung.
              </span>
            </label>
          </div>

          {/* Info */}
          <div className="glass rounded-xl p-4 flex items-start gap-3">
            <FileText className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-400 leading-relaxed">
              <p className="font-medium text-zinc-300 mb-1">Folgende Seiten werden erstellt:</p>
              <ul className="space-y-0.5">
                <li>Impressum (gem. § 5 TMG)</li>
                <li>AGB (Allgemeine Geschäftsbedingungen)</li>
                <li>Datenschutzerklärung (DSGVO-konform)</li>
                <li>Widerrufsbelehrung (14-Tage Widerrufsrecht)</li>
              </ul>
              <p className="mt-2 text-zinc-500">+ Footer-Menü &quot;Rechtliches&quot; wird automatisch erstellt</p>
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleGenerate}
            disabled={generating || !hasShopify || !form.disclaimer}
            className="w-full btn-accent py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Rechtstexte werden erstellt & gepusht...
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5" />
                Rechtstexte generieren & in Shopify pushen
              </>
            )}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
