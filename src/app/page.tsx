"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  KeyRound,
  Loader2,
  AlertCircle,
  HelpCircle,
  Mail,
  Send,
  CheckCircle2,
  Crown,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Check,
  ChevronDown,
} from "lucide-react";
import { useI18n, LOCALES } from "@/lib/i18n";
import LicenseKeyInput from "@/components/LicenseKeyInput";
import { BrandLogo, useBranding } from "@/lib/branding";
import { DEFAULT_TIERS } from "@/lib/tiers-shared";

const ACCENT = "#95BF47";
const MEMBERSHIP = DEFAULT_TIERS[0];

// Was die Membership enthält — sichtbarer, crawlbarer Inhalt (SEO) +
// Verkaufsargumente im „Abo abschließen"-Bereich.
const MEMBERSHIP_PERKS = [
  "Tägliche Winning-Product-Drops mit echten Markt-Daten",
  "KI-Produktfotos (AI Studio) & präziser Background Remover",
  "Video Scout, Image Upscaler & AI E-Mail-Generator",
  "500 Credits bei jeder Zahlung + Theme & Coaching",
];

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
  const { t, lang, setLang } = useI18n();
  const { brandName } = useBranding();
  const [key, setKey] = useState("");
  const [manualKey, setManualKey] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [aboImageUrl, setAboImageUrl] = useState("");
  // Der „Abo abschließen"-Bereich ist standardmäßig versteckt. Er taucht
  // nur auf, wenn der Login 3× scheitert oder man „Hol dir Zugang" klickt.
  const [showAbo, setShowAbo] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const aboRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const params = useSearchParams();
  const urlError = params.get("error");

  useEffect(() => {
    if (showAbo) aboRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [showAbo]);

  // Admin-Abo-Bild laden (öffentlich, ohne Session).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/branding")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && typeof d.aboImageUrl === "string") setAboImageUrl(d.aboImageUrl);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const ERROR_MAP: Record<string, string> = {
    no_email: t.login.errorNoEmail,
    no_license: t.login.errorNoLicense,
    server: t.login.errorServer,
  };

  async function doKeyLogin(keyValue: string) {
    if (loading || googleLoading) return;
    if (!keyValue.trim()) { setError(t.login.errorInvalidKey); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lizenzschluessel: keyValue, rememberMe }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        const next = failedAttempts + 1;
        setFailedAttempts(next);
        if (next >= 3) setShowAbo(true);
        return;
      }
      router.push(data.redirect);
    } catch {
      setError(t.login.errorConnection);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyLogin(e: React.FormEvent) {
    e.preventDefault();
    doKeyLogin(key);
  }

  function handleGoogleLogin() {
    setGoogleLoading(true);
    // „Angemeldet bleiben" durch den OAuth-Round-Trip tragen.
    signIn("google", {
      callbackUrl: `/api/auth/google-callback?remember=${rememberMe ? "1" : "0"}`,
    });
  }

  const displayError = error || (urlError ? ERROR_MAP[urlError] || urlError : "");
  const brand = brandName || "Brospify Hub";

  return (
    <div className="relative min-h-screen bg-mesh overflow-hidden">
      {/* Ambient orbs */}
      <div
        className="pointer-events-none fixed -top-40 -right-40 w-[560px] h-[560px] rounded-full opacity-50"
        style={{ background: "radial-gradient(closest-side, rgba(149,191,71,0.18), transparent 70%)" }}
      />
      <div
        className="pointer-events-none fixed -bottom-40 -left-40 w-[520px] h-[520px] rounded-full opacity-40"
        style={{ background: "radial-gradient(closest-side, rgba(99,102,241,0.16), transparent 70%)" }}
      />

      <main className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 py-10 lg:py-16">
        {/* Sprachumschalter (Deutsch / English mit Flagge) */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 flex items-center gap-1 rounded-full bg-white/[0.04] border border-white/10 p-1 backdrop-blur">
          {LOCALES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLang(l.code)}
              aria-pressed={lang === l.code}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium transition ${
                lang === l.code ? "bg-white/10 text-white" : "text-white/45 hover:text-white"
              }`}
            >
              <span className="text-sm leading-none">{l.flag}</span>
              <span className="hidden sm:inline">{l.code.toUpperCase()}</span>
            </button>
          ))}
        </div>

        {/* Hero — Logo bleibt der visuelle Anker. Die SEO-Überschrift
            ist bewusst unauffällig (sr-only), bleibt aber für Google im
            DOM. „Brospify" steckt zusätzlich sichtbar im Feature-Block. */}
        <header className="text-center mb-8 lg:mb-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
            className="inline-flex items-center justify-center mb-3"
          >
            <BrandLogo size="xl" />
          </motion.div>
          <h1 className="sr-only">{brand} – Dropshipping Dashboard & KI-Tools von Brospify</h1>
          <p className="mt-1 text-[12.5px] text-white/35 max-w-sm mx-auto leading-relaxed">
            {t.login.intro}
          </p>
        </header>

        <div className="mx-auto max-w-md space-y-5">
          {/* Login + Hilfe + „Hol dir Zugang" */}
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            aria-label="Anmelden"
          >
            <div className="glass rounded-2xl p-6 space-y-5 backdrop-blur-xl">
              <div>
                <h2 className="text-lg font-semibold text-white">{t.login.signInHeading}</h2>
                <p className="text-[12.5px] text-white/45 mt-0.5">
                  {t.login.signInSub}
                </p>
              </div>

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

              {/* Google */}
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

              {/* License key — segmentierte Eingabe (3 + Bindestrich + 6) */}
              <form id="license-form" onSubmit={handleKeyLogin} className="space-y-3">
                <label className="text-xs text-zinc-400 font-medium flex items-center gap-1.5 justify-center">
                  <KeyRound className="w-3.5 h-3.5" />
                  {t.login.licenseLabel}
                </label>
                {manualKey ? (
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder={t.login.licensePlaceholder}
                    className="input-glass w-full text-center tracking-wider"
                    autoComplete="off"
                    disabled={loading || googleLoading}
                  />
                ) : (
                  <LicenseKeyInput
                    value={key}
                    onChange={setKey}
                    onComplete={(full) => doKeyLogin(full)}
                    disabled={loading || googleLoading}
                  />
                )}
                <button
                  type="button"
                  onClick={() => { setManualKey((v) => !v); setKey(""); }}
                  className="block mx-auto text-[11px] text-white/35 hover:text-white/70 transition"
                >
                  {manualKey
                    ? (lang === "en" ? "Use boxes" : "Kästchen verwenden")
                    : (lang === "en" ? "Enter key manually" : "Schlüssel manuell eingeben")}
                </button>
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

                {/* Angemeldet bleiben */}
                <label className="flex items-center justify-center gap-2 text-[12.5px] text-white/55 cursor-pointer select-none pt-0.5">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 accent-[#95BF47]"
                  />
                  {t.login.rememberMe}
                </label>
              </form>

              {/* Hilfe bei der Anmeldung */}
              <div className="pt-1">
                <button
                  onClick={() => setShowHelp((v) => !v)}
                  className="w-full flex items-center justify-center gap-2 text-[12.5px] font-medium text-white/55 hover:text-white transition"
                >
                  <HelpCircle className="w-4 h-4" style={{ color: ACCENT }} />
                  {t.login.helpToggle}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showHelp ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence initial={false}>
                  {showHelp && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <HelpForm />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* „Hol dir Zugang" — blendet den Abo-Bereich ein */}
              {!showAbo && (
                <button
                  onClick={() => setShowAbo(true)}
                  className="w-full text-center text-[12px] text-white/40 hover:text-white transition"
                >
                  {t.login.noAccess}{" "}
                  <span className="font-semibold" style={{ color: ACCENT }}>{t.login.getAccess}</span>
                </button>
              )}
            </div>
          </motion.section>

          {/* Abo — nur nach 3 Fehlversuchen oder Klick auf „Hol dir Zugang" */}
          <AnimatePresence initial={false}>
            {showAbo && (
              <motion.section
                ref={aboRef}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                aria-label="Membership abschließen"
              >
                <AboSection aboImageUrl={aboImageUrl} />
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* SEO-Content — bewusst dezent gehalten (klein, gedämpft), aber
            mit allen relevanten „Brospify"-Keywords für die Indexierung. */}
        <section className="mt-10 max-w-2xl mx-auto text-center" aria-label="Über Brospify Hub">
          <p className="text-[11.5px] text-white/30 leading-relaxed">
            <strong className="text-white/45 font-medium">Brospify Hub</strong> ist das All-in-One
            Dropshipping-Dashboard von Brospify: tägliche Winning-Product-Drops, KI-Produktfotos (AI Studio),
            Background Remover, Video Scout, Image Upscaler, AI E-Mail-Generator, Mediathek &amp; Coaching —
            alles an einem Ort.
          </p>
        </section>

        <footer className="text-center text-white/25 text-xs mt-8">
          &copy; {new Date().getFullYear()} {brand}. {t.login.footer}
        </footer>
      </main>
    </div>
  );
}

// ─── Abo abschließen ─────────────────────────────────────────────

function AboSection({ aboImageUrl }: { aboImageUrl: string }) {
  return (
    <div
      className="relative rounded-2xl overflow-hidden border"
      style={{
        borderColor: "rgba(149,191,71,0.30)",
        background:
          "linear-gradient(160deg, rgba(149,191,71,0.10) 0%, rgba(255,255,255,0.03) 45%, rgba(168,85,247,0.06) 100%)",
        boxShadow: "0 30px 80px -42px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      {/* Bild / Header */}
      <div className="relative h-44 sm:h-52 w-full overflow-hidden">
        {aboImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={aboImageUrl} alt="Brospify Membership" className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #1a2410 0%, #0c0c0e 60%, #1a132a 100%)" }}
          >
            <Crown className="w-12 h-12" style={{ color: ACCENT }} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div
          className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold uppercase tracking-[0.12em]"
          style={{ background: ACCENT, color: "#0a1604" }}
        >
          <Sparkles className="w-3 h-3" />
          Voller Zugang
        </div>
        <div className="absolute bottom-3 left-4 right-4">
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/70 font-semibold">
            {MEMBERSHIP.tagline}
          </div>
          <div className="text-xl font-bold text-white tracking-tight">{MEMBERSHIP.label}</div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 sm:p-6 space-y-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums text-white">
            {MEMBERSHIP.priceMonthlyEur} €
          </span>
          <span className="text-[13px] text-white/45">/ Monat</span>
        </div>

        <ul className="space-y-2">
          {MEMBERSHIP_PERKS.map((perk) => (
            <li key={perk} className="flex items-start gap-2.5 text-[13px] text-white/75 leading-snug">
              <span
                className="mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
                style={{ background: "rgba(149,191,71,0.18)" }}
              >
                <Check className="w-2.5 h-2.5" style={{ color: ACCENT }} />
              </span>
              {perk}
            </li>
          ))}
        </ul>

        <a
          href={MEMBERSHIP.ctaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-deploy w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
        >
          <Crown className="w-4 h-4" />
          {MEMBERSHIP.ctaLabel || "Membership abschließen"}
          <ArrowRight className="w-4 h-4" />
        </a>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-white/40 text-center">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT }} />
          Sichere Bezahlung über den offiziellen Brospify-Checkout · jederzeit kündbar
        </div>
      </div>
    </div>
  );
}

// ─── Hilfe-Formular (direkte E-Mail an den Support) ──────────────

function HelpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !message.trim()) {
      setStatus("error");
      setErrMsg("Bitte E-Mail und Nachricht ausfüllen.");
      return;
    }
    setStatus("loading");
    setErrMsg("");
    try {
      const res = await fetch("/api/login-help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, company }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setErrMsg(data.error || "Senden fehlgeschlagen.");
        return;
      }
      setStatus("success");
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      setStatus("error");
      setErrMsg("Verbindungsfehler — bitte erneut versuchen.");
    }
  }

  if (status === "success") {
    return (
      <div className="mt-3 rounded-xl bg-[#95BF47]/10 border border-[#95BF47]/25 px-4 py-4 text-center">
        <CheckCircle2 className="w-6 h-6 mx-auto mb-1.5" style={{ color: ACCENT }} />
        <div className="text-[13px] font-semibold text-white">Nachricht gesendet</div>
        <div className="text-[12px] text-white/55 mt-0.5">
          Wir melden uns so schnell wie möglich per E-Mail bei dir.
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2.5 rounded-xl bg-white/[0.03] border border-white/10 p-4">
      <p className="text-[12px] text-white/55 leading-snug">
        Kommst du nicht rein? Schreib uns kurz — <strong className="text-white/80">deine E-Mail
        nicht vergessen</strong>, damit wir dir direkt antworten können.
      </p>

      {/* Honeypot (vor Bots versteckt) */}
      <input
        type="text"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name (optional)"
        className="input-glass w-full text-[13px]"
        disabled={status === "loading"}
      />
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/35" />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Deine E-Mail-Adresse *"
          required
          className="input-glass w-full text-[13px] pl-9"
          disabled={status === "loading"}
        />
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Wobei brauchst du Hilfe? *"
        rows={3}
        required
        className="input-glass w-full text-[13px] resize-none"
        disabled={status === "loading"}
      />

      {status === "error" && (
        <div className="flex items-center gap-1.5 text-[12px] text-red-300">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {errMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="btn-accent w-full py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {status === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Nachricht senden
      </button>
    </form>
  );
}

