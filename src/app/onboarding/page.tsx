"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2, User, Check, AlertCircle } from "lucide-react";
import { useI18n, LOCALES, type Locale } from "@/lib/i18n";
import { BrandLogo } from "@/lib/branding";

const ACCENT = "#95BF47";

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-mesh flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <OnboardingWizard />
    </Suspense>
  );
}

function OnboardingWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const { t, lang, setLang } = useI18n();

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [saving, setSaving] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const googleTaken = params.get("google") === "taken";

  async function submitStep1(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name, language: lang, rememberMe }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Fehler");
        return;
      }
      setStep(2);
    } catch {
      setError(lang === "en" ? "Connection error." : "Verbindungsfehler.");
    } finally {
      setSaving(false);
    }
  }

  function connectGoogle() {
    setGoogleLoading(true);
    // Nach dem OAuth landet der Nutzer auf /api/onboarding/link-google,
    // das die Google-Mail verknüpft und in die Tour weiterleitet.
    signIn("google", { callbackUrl: "/api/onboarding/link-google" });
  }

  async function skipGoogle() {
    setGoogleLoading(true);
    try {
      // Onboarding abschließen, dann in die interaktive Tour.
      await fetch("/api/profile/onboarding", { method: "POST" });
    } catch {
      /* nicht fatal */
    }
    router.push("/home?tour=1");
  }

  return (
    <div className="relative min-h-screen bg-mesh flex items-center justify-center p-4 overflow-hidden">
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-[#95BF47]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo + Fortschritt */}
        <div className="text-center mb-6">
          <div className="inline-flex mb-4">
            <BrandLogo size="lg" />
          </div>
          <div className="flex items-center justify-center gap-2">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step ? "w-8 bg-[#95BF47]" : s < step ? "w-4 bg-[#95BF47]/40" : "w-4 bg-white/10"
                }`}
              />
            ))}
          </div>
          <p className="text-[11px] text-white/35 mt-2">
            {step} {t.onboarding.stepOf} 2
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.form
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              onSubmit={submitStep1}
              className="glass rounded-2xl p-6 sm:p-7 space-y-5 backdrop-blur-xl"
            >
              <div>
                <h1 className="text-xl font-bold text-white">{t.onboarding.welcomeTitle}</h1>
                <p className="text-[13px] text-white/50 mt-1">{t.onboarding.welcomeSub}</p>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-white/75">
                  {t.onboarding.nameLabel}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.onboarding.namePlaceholder}
                    maxLength={60}
                    autoFocus
                    className="input-glass w-full pl-10"
                  />
                </div>
                <p className="text-[11px] text-white/35">{t.onboarding.nameHint}</p>
              </div>

              {/* Sprache */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-white/75">
                  {t.onboarding.langLabel}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {LOCALES.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => setLang(l.code as Locale)}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition ${
                        lang === l.code
                          ? "border-[#95BF47]/50 bg-[#95BF47]/10 text-white"
                          : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white hover:border-white/20"
                      }`}
                    >
                      <span className="text-lg leading-none">{l.flag}</span>
                      {l.label}
                      {lang === l.code && <Check className="w-4 h-4" style={{ color: ACCENT }} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Angemeldet bleiben */}
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 accent-[#95BF47]"
                />
                <span>
                  <span className="text-[13.5px] text-white/80">{t.onboarding.rememberMe}</span>
                  <span className="block text-[11px] text-white/40">{t.onboarding.rememberHint}</span>
                </span>
              </label>

              {error && (
                <div className="flex items-center gap-1.5 text-[12px] text-red-300">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="btn-accent w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {t.onboarding.step1Cta}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </motion.form>
          ) : (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="glass rounded-2xl p-6 sm:p-7 space-y-5 backdrop-blur-xl text-center"
            >
              <div className="mx-auto w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
                <svg className="w-7 h-7" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              </div>

              <div>
                <h1 className="text-xl font-bold text-white">{t.onboarding.googleTitle}</h1>
                <p className="text-[13px] text-white/50 mt-1.5 leading-relaxed">
                  {t.onboarding.googleSub}
                </p>
              </div>

              {googleTaken && (
                <div className="flex items-center gap-1.5 text-[12px] text-amber-300 justify-center">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {lang === "en"
                    ? "This Google account is already linked to another license."
                    : "Dieses Google-Konto ist bereits mit einer anderen Lizenz verknüpft."}
                </div>
              )}

              <button
                onClick={connectGoogle}
                disabled={googleLoading}
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
                {googleLoading ? t.onboarding.googleConnecting : t.onboarding.googleButton}
              </button>

              <button
                onClick={skipGoogle}
                disabled={googleLoading}
                className="w-full text-[13px] text-white/45 hover:text-white transition py-1"
              >
                {t.onboarding.googleSkip}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
