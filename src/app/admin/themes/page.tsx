"use client";

// ─── /admin/themes ───────────────────────────────────────────────
// Admin lädt Shopify-Theme-ZIPs hoch. Ablauf: Datei → /api/upload
// (Vercel Blob) → Metadaten an /api/admin/themes. Es werden immer nur
// die 10 neuesten Versionen behalten; ältere verschwinden automatisch
// aus der Kundenliste.

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Navigation from "@/components/Navigation";
import {
  LayoutTemplate,
  Upload,
  Trash2,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface Theme {
  rowIndex: number;
  id: string;
  name: string;
  version: string;
  url: string;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
}

function formatBytes(n: number): string {
  if (!n || n <= 0) return "";
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

export default function AdminThemesPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadThemes = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/themes", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setThemes(Array.isArray(data.themes) ? data.themes : []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        if (!d.isLoggedIn || !d.isAdmin) {
          router.push("/");
          return;
        }
        setReady(true);
        loadThemes();
      })
      .catch(() => router.push("/"));
  }, [router, loadThemes]);

  async function handleUpload() {
    setError("");
    setOk("");
    if (!name.trim()) {
      setError("Bitte einen Namen eingeben.");
      return;
    }
    if (!file) {
      setError("Bitte eine ZIP-Datei wählen.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError("Nur .zip-Dateien erlaubt.");
      return;
    }
    setBusy(true);
    try {
      // 1) Datei zu Vercel Blob hochladen.
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok || !upData.url) {
        setError(upData?.error || "Upload fehlgeschlagen.");
        return;
      }
      // 2) Metadaten speichern.
      const res = await fetch("/api/admin/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          version: version.trim(),
          url: upData.url,
          fileName: file.name,
          sizeBytes: file.size,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Speichern fehlgeschlagen.");
        return;
      }
      setOk(`„${name.trim()}" hochgeladen.`);
      setName("");
      setVersion("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await loadThemes();
    } catch {
      setError("Verbindungsfehler.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(t: Theme) {
    if (!window.confirm(`Theme „${t.name}" aus der Kundenliste entfernen?`)) return;
    try {
      await fetch("/api/admin/themes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex: t.rowIndex }),
      });
      await loadThemes();
    } catch {
      /* ignore */
    }
  }

  if (!ready) return null;

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-mesh font-sf">
        <div className="max-w-2xl mx-auto px-3 sm:px-5 py-5 sm:py-8">
          <header className="mb-5">
            <div className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] font-semibold mb-1.5 text-amber-300">
              <LayoutTemplate className="w-3 h-3" /> Admin
            </div>
            <h1 className="text-[22px] sm:text-[26px] font-bold text-white">Themes verwalten</h1>
            <p className="mt-1.5 text-[13px] text-zinc-400">
              Lade Shopify-Theme-ZIPs hoch (max. 50 MB). Es werden immer nur die{" "}
              <span className="text-zinc-200 font-medium">10 neuesten</span> behalten — ältere
              verschwinden automatisch aus der Kundenliste.
            </p>
            <p className="mt-2 text-[12.5px] text-[#cfe9a3] flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Das <span className="font-semibold">neueste hochgeladene Theme</span> wird automatisch
                zur Basis des Theme-Editors: Kunden passen es auf{" "}
                <span className="text-zinc-200">/themes</span> mit eigenen Farben, Schriften, Ecken &
                KI-Produkttexten an und laden es fertig herunter. Ohne Upload wird die eingebaute
                Brospify-Schablone verwendet — der Editor funktioniert also sofort.
              </span>
            </p>
          </header>

          {/* Upload-Form */}
          <section className="glass-strong rounded-2xl border border-white/[0.08] p-4 sm:p-5 space-y-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. Brospify Theme"
                maxLength={60}
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.10] text-[14px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#95BF47]/40"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Version <span className="normal-case font-normal text-zinc-600">(optional)</span>
              </label>
              <input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="z. B. v2.3"
                maxLength={30}
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.10] text-[14px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#95BF47]/40"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                Theme-ZIP
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-[12.5px] text-zinc-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-white/[0.06] file:text-zinc-200 file:text-[12px] file:font-medium hover:file:bg-white/[0.10] file:cursor-pointer"
              />
              {file && (
                <p className="mt-1.5 text-[11px] text-zinc-500">
                  {file.name} · {formatBytes(file.size)}
                </p>
              )}
            </div>

            <button
              onClick={handleUpload}
              disabled={busy}
              className="btn-deploy w-full flex items-center justify-center gap-2 py-3 text-[14px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Lädt hoch…
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" /> Theme hochladen
                </>
              )}
            </button>

            {error && (
              <p className="text-[12px] text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> {error}
              </p>
            )}
            {ok && (
              <p className="text-[12px] text-[#cfe9a3] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> {ok}
              </p>
            )}
          </section>

          {/* Liste */}
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-white mb-3">
              Hochgeladene Themes <span className="text-zinc-500 font-normal">· {themes.length}/10</span>
            </h2>
            {themes.length === 0 ? (
              <p className="text-[13px] text-zinc-500">Noch keine Themes hochgeladen.</p>
            ) : (
              <div className="space-y-2">
                {themes.map((t, i) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
                      <LayoutTemplate className="w-4 h-4 text-[#95BF47]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-semibold text-white truncate">{t.name}</span>
                        {i === 0 && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#95BF47]/15 text-[#cfe9a3] whitespace-nowrap">
                            Neueste · Editor-Basis
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {t.version && <span className="font-mono">{t.version} · </span>}
                        {formatBytes(t.sizeBytes)}
                      </div>
                    </div>
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-white/[0.06] text-zinc-400 hover:text-white transition"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => remove(t)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition"
                      title="Entfernen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
