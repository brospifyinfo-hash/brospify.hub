"use client";

// ─── /admin/test-license ─────────────────────────────────────────
// Admin-Tool: stellt manuell einen Lizenzschlüssel an eine E-Mail aus
// (Sheets-Eintrag + Resend-Mail) — ohne Shopify. Dient zum Ausliefern
// UND zum Diagnostizieren: jeder Schritt wird einzeln angezeigt.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navigation from "@/components/Navigation";

interface Result {
  ok?: boolean;
  key?: string;
  sheetWritten?: boolean;
  sheetError?: string;
  action?: string;
  emailSent?: boolean;
  emailError?: string;
  error?: string;
}

export default function TestLicensePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("devidkasbeitzer@gmail.com");
  const [sku, setSku] = useState("abo");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupMsg, setCleanupMsg] = useState("");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        if (!d.isLoggedIn || !d.isAdmin) {
          router.push("/");
          return;
        }
        setReady(true);
      })
      .catch(() => router.push("/"));
  }, [router]);

  async function issue() {
    if (loading || !email.includes("@")) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/license/issue-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), sku: sku.trim() || "abo" }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: "Verbindungsfehler." });
    } finally {
      setLoading(false);
    }
  }

  async function cleanup() {
    if (cleaning) return;
    if (!window.confirm("Alle Test-Lizenzen (Bestellnummer TEST-…) endgültig aus dem Sheet löschen? Echte Kunden bleiben unberührt.")) {
      return;
    }
    setCleaning(true);
    setCleanupMsg("");
    try {
      const res = await fetch("/api/admin/license/cleanup-test", { method: "POST" });
      const d = await res.json();
      setCleanupMsg(res.ok ? `${d.deletedCount} Test-Lizenz(en) gelöscht.` : d.error || "Fehler.");
    } catch {
      setCleanupMsg("Verbindungsfehler.");
    } finally {
      setCleaning(false);
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const Row = ({ label, ok, error }: { label: string; ok?: boolean; error?: string }) => (
    <div className="flex items-start gap-2 text-sm">
      <span className={ok ? "text-[#95BF47]" : "text-red-400"}>{ok ? "✓" : "✗"}</span>
      <div>
        <span className="text-zinc-200">{label}</span>
        {error && <span className="text-red-400/90"> — {error}</span>}
      </div>
    </div>
  );

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-mesh font-sf">
        <div className="max-w-lg mx-auto px-4 py-6 sm:py-10">
          <h1 className="text-xl font-bold text-white">Test-Lizenz ausstellen</h1>
          <p className="mt-1 text-[12px] text-zinc-400 leading-snug">
            Erzeugt einen Lizenzschlüssel, trägt ihn in Sheets ein und schickt die Lizenz-Mail per Resend —
            ohne Shopify. Zeigt pro Schritt, ob es geklappt hat.
          </p>

          <div className="mt-5 glass-strong rounded-2xl border border-white/[0.08] p-4 sm:p-5 space-y-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">E-Mail</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-glass w-full mt-1"
                placeholder="kunde@example.com"
              />
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">SKU</span>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="input-glass w-full mt-1"
                placeholder="abo"
              />
              <span className="text-[10px] text-zinc-600">z. B. abo, kauf, bronze — bestimmt die Tier-Zuordnung.</span>
            </label>
            <button
              onClick={issue}
              disabled={loading || !email.includes("@")}
              className="btn-deploy w-full flex items-center justify-center gap-2 py-3 text-sm disabled:opacity-50"
            >
              {loading ? "Stelle aus…" : "Lizenz ausstellen + Mail senden"}
            </button>
          </div>

          {result && (
            <div className="mt-4 glass-strong rounded-2xl border border-white/[0.08] p-4 sm:p-5 space-y-2">
              {result.error ? (
                <Row label={`Fehler: ${result.error}`} ok={false} />
              ) : (
                <>
                  <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-1">Ergebnis</div>
                  {result.key && (
                    <div className="text-sm text-zinc-200">
                      Key:{" "}
                      <code className="font-mono text-[#95BF47] bg-black/40 px-2 py-0.5 rounded">{result.key}</code>
                    </div>
                  )}
                  <Row
                    label={`In Sheets eingetragen${result.action ? ` (${result.action})` : ""}`}
                    ok={result.sheetWritten}
                    error={result.sheetError}
                  />
                  <Row label="Resend-Mail gesendet" ok={result.emailSent} error={result.emailError} />
                  {!result.emailSent && !result.emailError && (
                    <p className="text-[11px] text-amber-300/90 mt-1">
                      Mail nicht gesendet — meist fehlt <code className="font-mono">RESEND_API_KEY</code> /{" "}
                      <code className="font-mono">RESEND_FROM_EMAIL</code> in Vercel.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Aufräumen: vom Testen erzeugte Lizenz-Zeilen löschen */}
          <div className="mt-6 border-t border-white/[0.06] pt-5">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">
              Aufräumen
            </div>
            <button
              onClick={cleanup}
              disabled={cleaning}
              className="w-full py-2.5 rounded-xl text-[12px] font-semibold bg-red-500/10 border border-red-500/25 text-red-300 hover:bg-red-500/20 transition disabled:opacity-50"
            >
              {cleaning ? "Lösche…" : "Alle Test-Lizenzen löschen (TEST-…)"}
            </button>
            {cleanupMsg && <p className="mt-2 text-[12px] text-zinc-300">{cleanupMsg}</p>}
            <p className="mt-1 text-[10px] text-zinc-600">
              Löscht nur Zeilen mit Bestellnummer „TEST-…" (aus diesem Test-Tool). Echte Kunden bleiben unberührt.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
