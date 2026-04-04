"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { KeyRound, Loader2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lizenzschluessel: key }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      router.push(data.redirect);
    } catch { setError("Verbindungsfehler."); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl glass mb-4"
          >
            <KeyRound className="w-8 h-8 text-[#95BF47]" />
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight">BrospifyHub</h1>
          <p className="text-white/40 mt-2">Dein Managed Dropshipping Dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="glass rounded-2xl p-6 space-y-4">
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Lizenzschlüssel eingeben"
              className="input-glass w-full px-4 py-3 rounded-xl text-sm"
              autoFocus
              disabled={loading}
            />

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 px-4 py-3 rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-accent w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Wird geprüft...</> : "Anmelden"}
            </button>
          </div>
        </form>

        <p className="text-center text-white/20 text-xs mt-8">
          Keinen Schlüssel? Kontaktiere deinen Account Manager.
        </p>
      </motion.div>
    </div>
  );
}
