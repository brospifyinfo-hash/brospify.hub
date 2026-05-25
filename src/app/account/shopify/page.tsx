"use client";

// ─── /account/shopify ────────────────────────────────────────────
// Shopify-Connection-Management. Drei Sektionen:
//   1. CONNECTION STATUS: verbunden / nicht verbunden, Shop-Domain
//   2. CREDENTIALS: Client-ID + Secret mit Show/Hide-Toggle
//   3. ACTIONS: Verbindung testen, Re-Connect, Disconnect

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Store,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Check,
  ExternalLink,
  RefreshCcw,
  Unlink,
  Save,
  X,
} from "lucide-react";
import Link from "next/link";
import Navigation from "@/components/Navigation";

interface ProfileShopify {
  shopify_credentials?: { clientId?: string; clientSecret?: string };
}

export default function AccountShopifyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [shopDomain, setShopDomain] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [credentials, setCredentials] = useState({ clientId: "", clientSecret: "" });
  const [showSecret, setShowSecret] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => { if (r.status === 401) { router.push("/"); return null; } return r.json(); })
      .then((data) => {
        if (!data) return;
        const p: ProfileShopify = data.profile || {};
        setShopDomain(data.shopDomain || "");
        setHasToken(!!data.hasShopifyToken);
        setCredentials({
          clientId: p.shopify_credentials?.clientId || "",
          clientSecret: p.shopify_credentials?.clientSecret || "",
        });
        setLoading(false);
      })
      .catch(() => router.push("/"));
  }, [router]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 2500);
    return () => clearTimeout(t);
  }, [success]);

  const handleSaveCredentials = useCallback(async () => {
    setSaving(true);
    setError("");
    setTestResult(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopify_credentials: credentials }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Credentials gespeichert.");
      } else {
        setError(data.error || "Speichern fehlgeschlagen.");
      }
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setSaving(false);
    }
  }, [credentials]);

  const handleTestConnection = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // /api/setup/test ist ein bestehender Endpoint, der die Connection prueft.
      // Wenn nicht vorhanden, faellt das Result auf "noch nicht implementiert" zurueck.
      const res = await fetch("/api/setup/test", { method: "POST" });
      if (res.status === 404) {
        setTestResult({
          ok: false,
          msg: "Verbindungstest noch nicht verfuegbar. Pruefe stattdessen ueber 'Shop neu verbinden'.",
        });
      } else {
        const data = await res.json();
        setTestResult({
          ok: !!data.success,
          msg: data.success
            ? `Erfolgreich verbunden mit ${data.shopDomain || shopDomain}`
            : (data.error || "Verbindung fehlgeschlagen"),
        });
      }
    } catch {
      setTestResult({ ok: false, msg: "Netzwerkfehler beim Test." });
    } finally {
      setTesting(false);
    }
  }, [shopDomain]);

  const handleDisconnect = useCallback(async () => {
    if (!confirm("Verbindung wirklich trennen? Du musst sie danach via Setup-Wizard neu einrichten.")) return;
    setDisconnecting(true);
    setError("");
    try {
      // POST mit gecleartem credentials = effektives Disconnect
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopify_credentials: { clientId: "", clientSecret: "" } }),
      });
      if (res.ok) {
        setCredentials({ clientId: "", clientSecret: "" });
        setSuccess("Verbindung getrennt. Du kannst sie ueber Setup neu einrichten.");
      } else {
        const d = await res.json();
        setError(d.error || "Trennen fehlgeschlagen.");
      }
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setDisconnecting(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const connectionState = hasToken ? "connected" : credentials.clientId ? "credentials-only" : "disconnected";

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#95BF47]/10 border border-[#95BF47]/20 flex items-center justify-center">
            <Store className="w-5 h-5 text-[#95BF47]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Shopify-Verbindung</h1>
            <p className="text-zinc-400 text-xs sm:text-sm">
              API-Credentials und Verbindungsstatus zu deinem Shop
            </p>
          </div>
        </motion.div>

        {/* Toasts */}
        {error && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 px-3 py-2.5 rounded-xl">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError("")} className="p-1 hover:bg-red-500/10 rounded">
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
        {success && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-green-400 text-xs bg-green-500/10 border border-green-500/20 px-3 py-2.5 rounded-xl">
            <Check className="w-4 h-4 shrink-0" />
            {success}
          </motion.div>
        )}

        {/* ─── STATUS HERO ──────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl border border-white/[0.08] overflow-hidden"
        >
          <div className={`absolute inset-0 pointer-events-none bg-gradient-to-br ${
            connectionState === "connected"
              ? "from-green-500/15 via-emerald-500/8 to-transparent"
              : "from-zinc-500/8 to-transparent"
          }`} />
          <div className="relative p-5 sm:p-6 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">
                  Verbindungsstatus
                </div>
                <div className="text-2xl sm:text-3xl font-black tracking-tight">
                  {connectionState === "connected" ? "Verbunden" :
                   connectionState === "credentials-only" ? "Konfiguriert" : "Nicht verbunden"}
                </div>
                {shopDomain && (
                  <div className="text-[12px] text-zinc-400 mt-1.5 font-mono break-all">
                    {shopDomain}
                  </div>
                )}
              </div>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold uppercase tracking-wider ${
                connectionState === "connected"
                  ? "bg-green-500/10 border-green-500/20 text-green-400"
                  : connectionState === "credentials-only"
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                  : "bg-zinc-500/10 border-zinc-500/20 text-zinc-500"
              }`}>
                {connectionState === "connected" ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                 connectionState === "credentials-only" ? <AlertCircle className="w-3.5 h-3.5" /> :
                 <XCircle className="w-3.5 h-3.5" />}
                {connectionState === "connected" ? "Aktiv" :
                 connectionState === "credentials-only" ? "Token fehlt" : "Inaktiv"}
              </div>
            </div>
            {connectionState !== "connected" && (
              <Link
                href="/setup"
                className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-xl text-[12px] font-semibold btn-accent"
              >
                <Store className="w-4 h-4" />
                Setup-Wizard starten
              </Link>
            )}
          </div>
        </motion.div>

        {/* ─── CREDENTIALS ────────────────────────────── */}
        <Card icon={Key} title="API-Credentials" color="#3B82F6">
          <p className="text-[11.5px] text-zinc-500 mb-3 leading-snug">
            Wenn du eine Custom App in Shopify erstellst, bekommst du Client-ID und
            Secret. Diese werden hier gespeichert und vom Hub fuer API-Calls genutzt.
            Setup-Wizard ist der einfachste Weg &mdash; nur fuer Power-User direkt hier
            eingeben.
          </p>

          <div className="space-y-3">
            <Field
              label="Client-ID"
              value={credentials.clientId}
              onChange={(v) => setCredentials((c) => ({ ...c, clientId: v }))}
              placeholder="shopify_xxxxxxxxxxxxxxxxxxx"
              mono
            />
            <Field
              label="Client-Secret"
              value={credentials.clientSecret}
              onChange={(v) => setCredentials((c) => ({ ...c, clientSecret: v }))}
              placeholder="shpss_xxxxxxxxxxxxxxxxxxx"
              mono
              secret={!showSecret}
              rightAction={
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="text-zinc-500 hover:text-zinc-300 transition"
                  aria-label={showSecret ? "Secret verbergen" : "Secret zeigen"}
                >
                  {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              }
            />

            <button
              type="button"
              onClick={handleSaveCredentials}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-semibold btn-accent disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? "Speichere..." : "Credentials speichern"}
            </button>
          </div>
        </Card>

        {/* ─── ACTIONS ────────────────────────────── */}
        <Card icon={RefreshCcw} title="Aktionen" color="#A855F7">
          <div className="space-y-2">
            {/* Test connection */}
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || !hasToken}
              className="w-full flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl text-[12px] font-semibold bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-2">
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5 text-zinc-400" />}
                <span>Verbindung testen</span>
              </div>
              <span className="text-[10px] text-zinc-600">{hasToken ? "→" : "(Token fehlt)"}</span>
            </button>

            {testResult && (
              <div className={`text-[11.5px] px-3 py-2 rounded-lg border ${
                testResult.ok
                  ? "bg-green-500/10 border-green-500/20 text-green-300"
                  : "bg-red-500/10 border-red-500/20 text-red-300"
              }`}>
                {testResult.msg}
              </div>
            )}

            {/* Re-connect */}
            <Link
              href="/setup"
              className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl text-[12px] font-semibold bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] transition"
            >
              <div className="flex items-center gap-2">
                <Store className="w-3.5 h-3.5 text-zinc-400" />
                <span>Shop neu verbinden (Wizard)</span>
              </div>
              <ExternalLink className="w-3 h-3 text-zinc-600" />
            </Link>

            {/* Disconnect */}
            {(hasToken || credentials.clientId) && (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="w-full flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl text-[12px] font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 transition disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                  <span>Verbindung trennen</span>
                </div>
              </button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

function Card({
  icon: Icon, title, color, children,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center border"
          style={{ backgroundColor: `${color}15`, borderColor: `${color}30` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <h2 className="text-[13px] sm:text-sm font-bold text-white">{title}</h2>
      </div>
      <div>{children}</div>
    </motion.div>
  );
}

function Field({
  label, value, onChange, placeholder, mono, secret, rightAction,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  secret?: boolean;
  rightAction?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type={secret ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-white/25 transition placeholder:text-zinc-600 ${
            mono ? "font-mono" : ""
          } ${rightAction ? "pr-10" : ""}`}
        />
        {rightAction && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightAction}</div>
        )}
      </div>
    </div>
  );
}
