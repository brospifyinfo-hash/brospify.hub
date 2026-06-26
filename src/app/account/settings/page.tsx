"use client";

// ─── /account/settings ───────────────────────────────────────────
// Reine Account-Verwaltung: wer bin ich, wie loggt man sich ein,
// Google-Verknuepfung, gefaehrliche Aktionen (Logout, Account-
// Loeschung). Bewusst KEINE Abo/Credit-Themen — die haben ihre
// eigene Seite unter /account/subscription.

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Settings as SettingsIcon,
  Key,
  Mail,
  Globe,
  Calendar,
  LogOut,
  AlertCircle,
  Check,
  Loader2,
  Link2,
  Unlink,
  Shield,
  X,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { useI18n, LOCALES, type Locale } from "@/lib/i18n";

interface SessionData {
  isLoggedIn: boolean;
  isAdmin: boolean;
  lizenzschluessel?: string | null;
  googleName?: string;
  googleEmail?: string;
  googleImage?: string;
}

interface ProfileData {
  linkedGoogleEmail?: string;
  signupAt?: string;
}

export default function AccountSettingsPage() {
  const router = useRouter();
  const { t, lang, setLang } = useI18n();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [kundenEmail, setKundenEmail] = useState("");

  // Google-Verknuepfung
  const [linkInput, setLinkInput] = useState("");
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linking, setLinking] = useState(false);

  // Toast/Feedback
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Initial fetch
  useEffect(() => {
    Promise.all([
      fetch("/api/auth/session").then((r) => r.json()),
      fetch("/api/profile").then((r) => {
        if (r.status === 401) { router.push("/"); return null; }
        return r.json();
      }),
    ])
      .then(([s, p]) => {
        if (!p) return;
        setSession(s);
        setProfile(p.profile || {});
        setKundenEmail(p.kundenEmail || "");
        setLoading(false);
      })
      .catch(() => router.push("/"));
  }, [router]);

  // Toast Auto-Dismiss
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 2500);
    return () => clearTimeout(t);
  }, [success]);

  // Handler: Google-Account verknuepfen
  const handleLinkGoogle = useCallback(async () => {
    if (!linkInput.includes("@")) {
      setError(t.settings.invalidEmail);
      return;
    }
    setLinking(true);
    setError("");
    try {
      const res = await fetch("/api/profile/link-google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googleEmail: linkInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfile((p) => ({ ...(p || {}), linkedGoogleEmail: data.linkedEmail }));
        setShowLinkForm(false);
        setLinkInput("");
        setSuccess(t.settings.linkSuccess);
      } else {
        setError(data.error || t.settings.linkFailed);
      }
    } catch {
      setError(t.settings.networkError);
    } finally {
      setLinking(false);
    }
  }, [linkInput, t]);

  // Handler: Verknuepfung loesen
  const handleUnlinkGoogle = useCallback(async () => {
    if (!confirm(t.settings.unlinkConfirm)) {
      return;
    }
    setLinking(true);
    try {
      const res = await fetch("/api/profile/link-google", { method: "DELETE" });
      if (res.ok) {
        setProfile((p) => ({ ...(p || {}), linkedGoogleEmail: undefined }));
        setSuccess(t.settings.unlinkSuccess);
      } else {
        const d = await res.json();
        setError(d.error || t.settings.unlinkFailed);
      }
    } catch {
      setError(t.settings.networkError);
    } finally {
      setLinking(false);
    }
  }, [t]);

  // Handler: Abmelden
  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }, [router]);

  // Handler: Sprache umstellen (sofort + im Profil speichern)
  const changeLang = useCallback((code: Locale) => {
    setLang(code);
    fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: code }),
    }).catch(() => {});
  }, [setLang]);

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">{t.settings.title}</h1>
              <p className="text-zinc-400 text-xs sm:text-sm">
                {t.settings.subtitle}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Toasts */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 px-3 py-2.5 rounded-xl"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError("")} className="p-1 hover:bg-red-500/10 rounded">
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-green-400 text-xs bg-green-500/10 border border-green-500/20 px-3 py-2.5 rounded-xl"
          >
            <Check className="w-4 h-4 shrink-0" />
            {success}
          </motion.div>
        )}

        {/* ─── 1. Account-Identitaet ────────────────────── */}
        <Card icon={Key} title={t.settings.identityCard} color="#6366F1">
          <InfoRow icon={Mail} label={t.settings.email} value={kundenEmail || "—"} />
          <InfoRow
            icon={Key}
            label={t.settings.licenseKey}
            value={session?.lizenzschluessel || "—"}
            mono
            copyable
          />
          {profile?.signupAt && (
            <InfoRow
              icon={Calendar}
              label={t.settings.createdAt}
              value={new Date(profile.signupAt).toLocaleDateString(lang === "en" ? "en-GB" : "de-DE", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            />
          )}
          {session?.isAdmin && (
            <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-semibold text-amber-300">
                {t.settings.adminAccount}
              </span>
            </div>
          )}
        </Card>

        {/* ─── 2. Google-Verknuepfung ────────────────────── */}
        <Card icon={Link2} title={t.settings.googleCard} color="#0EA5E9">
          {profile?.linkedGoogleEmail ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl border border-green-500/20 bg-green-500/[0.04]">
                {session?.googleImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={session.googleImage}
                    alt=""
                    className="w-10 h-10 rounded-lg border border-white/10 object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-green-500/15 flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold text-green-300">{t.settings.linked}</div>
                  <div className="text-[11px] text-zinc-400 truncate font-mono">
                    {profile.linkedGoogleEmail}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 leading-snug">
                {t.settings.linkedDesc}
              </p>
              <button
                type="button"
                onClick={handleUnlinkGoogle}
                disabled={linking}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[12px] font-semibold bg-white/[0.04] hover:bg-red-500/10 hover:text-red-300 border border-white/[0.06] hover:border-red-500/20 transition disabled:opacity-50"
              >
                {linking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Unlink className="w-3.5 h-3.5" />
                )}
                {t.settings.unlink}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[12px] text-zinc-400 leading-snug">
                {t.settings.linkDesc}
              </p>
              {!showLinkForm ? (
                <button
                  type="button"
                  onClick={() => setShowLinkForm(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-semibold btn-accent"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  {t.settings.linkBtn}
                </button>
              ) : (
                <div className="space-y-2">
                  <input
                    type="email"
                    placeholder="dein.gmail@example.com"
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-white/25 transition placeholder:text-zinc-600"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowLinkForm(false); setLinkInput(""); }}
                      disabled={linking}
                      className="flex-1 py-2 rounded-xl text-[12px] font-semibold bg-white/[0.04] hover:bg-white/[0.08] transition disabled:opacity-50"
                    >
                      {t.settings.cancel}
                    </button>
                    <button
                      type="button"
                      onClick={handleLinkGoogle}
                      disabled={linking || !linkInput.trim()}
                      className="flex-1 py-2 rounded-xl text-[12px] font-semibold btn-accent disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {linking ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      {t.settings.link}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ─── 3. Sprache (echter Umschalter, in i18n) ───── */}
        <Card icon={Globe} title={t.settings.languageCard} color="#A855F7">
          <div className="grid grid-cols-2 gap-2">
            {LOCALES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => changeLang(l.code as Locale)}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition ${
                  lang === l.code
                    ? "border-[#95BF47]/50 bg-[#95BF47]/10 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white hover:border-white/20"
                }`}
              >
                <span className="text-lg leading-none">{l.flag}</span>
                {l.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-zinc-600 mt-2 leading-snug">
            {t.settings.languageHint}
          </p>
        </Card>

        {/* ─── 4. Danger Zone ────────────────────── */}
        <Card icon={LogOut} title={t.settings.sessionCard} color="#EF4444">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t.settings.logout}
          </button>
          <p className="text-[11px] text-zinc-600 mt-2 leading-snug">
            {t.settings.logoutDesc}
          </p>
        </Card>
      </div>
    </div>
  );
}

// ─── Kleine Helper-Components ─────────────────────────────────────

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
      className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5 space-y-3"
    >
      <div className="flex items-center gap-2.5">
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

function InfoRow({
  icon: Icon, label, value, mono, copyable,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
      <Icon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-semibold">{label}</div>
        <div className={`text-[12.5px] text-zinc-200 truncate ${mono ? "font-mono" : ""}`}>
          {value}
        </div>
      </div>
      {copyable && (
        <button
          type="button"
          onClick={onCopy}
          className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] transition"
        >
          {copied ? <Check className="w-3 h-3 text-green-400" /> : "Kopieren"}
        </button>
      )}
    </div>
  );
}
