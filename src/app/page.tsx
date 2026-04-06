"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, Loader2, AlertCircle, Crown } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-mesh flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const { t } = useI18n();
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const urlError = params.get("error");

  const ERROR_MAP: Record<string, string> = {
    no_email: t.login.errorNoEmail,
    no_license: t.login.errorNoLicense,
    server: t.login.errorServer,
  };

  async function handleKeyLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) { setError(t.login.errorInvalidKey); return; }
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
    } catch {
      setError(t.login.errorConnection);
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    setGoogleLoading(true);
    signIn("google", { callbackUrl: "/api/auth/google-callback" });
  }

  const displayError = error || (urlError ? ERROR_MAP[urlError] || urlError : "");

  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl glass mb-4"
          >
            <Crown className="w-8 h-8 text-[#95BF47]" />
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight">
            brospify <span className="text-[#95BF47]">hub</span>
          </h1>
          <p className="text-white/40 mt-2">{t.login.title}</p>
        </div>

        <div className="glass rounded-2xl p-6 space-y-5 backdrop-blur-xl">
          {/* Error */}
          <AnimatePresence>
            {displayError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-500/20 px-4 py-3 rounded-xl overflow-hidden"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{displayError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Option A: Google */}
          <button
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-white text-zinc-900 font-semibold text-sm hover:bg-zinc-100 transition disabled:opacity-60"
          >
            {googleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {googleLoading ? t.login.googleConnecting : t.login.googleButton}
          </button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-transparent text-zinc-500 backdrop-blur-sm">
                {t.login.divider}
              </span>
            </div>
          </div>

          {/* Option B: License Key */}
          <form onSubmit={handleKeyLogin} className="space-y-3">
            <label className="block text-xs text-zinc-400 font-medium flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              {t.login.licenseLabel}
            </label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={t.login.licensePlaceholder}
              className="input-glass w-full"
              disabled={loading || googleLoading}
            />
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="btn-accent w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  {t.login.licenseButton}
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-white/20 text-xs mt-8">{t.login.footer}</p>
      </motion.div>
    </div>
  );
}
