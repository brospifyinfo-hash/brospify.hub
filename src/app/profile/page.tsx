"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  User,
  Store,
  Scale,
  Save,
  Loader2,
  Check,
  AlertCircle,
  X,
  Key,
  Globe,
  Zap,
  Crown,
  CreditCard,
  Link2,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { useI18n } from "@/lib/i18n";

interface Profile {
  shopify_credentials?: { clientId?: string; clientSecret?: string };
  legal_data?: {
    firmenname?: string; inhaber?: string; strasse?: string; plz?: string;
    stadt?: string; land?: string; email?: string; telefon?: string;
    ustId?: string; handelsregister?: string;
  };
  ai_usage?: { month: string; count: number };
  linkedGoogleEmail?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [shopDomain, setShopDomain] = useState("");
  const [kundenEmail, setKundenEmail] = useState("");
  const [hasShopifyToken, setHasShopifyToken] = useState(false);
  const [googleProfile, setGoogleProfile] = useState<{ name?: string; email?: string; image?: string } | null>(null);
  const [linkedGoogleEmail, setLinkedGoogleEmail] = useState("");
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [linkGoogleInput, setLinkGoogleInput] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [credits, setCredits] = useState({ used: 0, remaining: 500, max: 500 });

  const [credentials, setCredentials] = useState({ clientId: "", clientSecret: "" });
  const [legalData, setLegalData] = useState({
    firmenname: "", inhaber: "", strasse: "", plz: "", stadt: "",
    land: "Deutschland", email: "", telefon: "", ustId: "", handelsregister: "",
  });

  useEffect(() => {
    fetch("/api/auth/session").then((r) => r.json()).then((data) => {
      if (data.googleName || data.googleEmail || data.googleImage) {
        setGoogleProfile({ name: data.googleName, email: data.googleEmail, image: data.googleImage });
      }
    }).catch(() => {});

    fetch("/api/profile")
      .then((r) => { if (r.status === 401) { router.push("/"); return null; } return r.json(); })
      .then((data) => {
        if (!data) return;
        const p: Profile = data.profile || {};
        setShopDomain(data.shopDomain || "");
        setKundenEmail(data.kundenEmail || "");
        setHasShopifyToken(data.hasShopifyToken || false);
        setLinkedGoogleEmail(p.linkedGoogleEmail || "");
        if (data.credits) setCredits(data.credits);
        setCredentials({
          clientId: p.shopify_credentials?.clientId || "",
          clientSecret: p.shopify_credentials?.clientSecret || "",
        });
        setLegalData({
          firmenname: p.legal_data?.firmenname || "",
          inhaber: p.legal_data?.inhaber || "",
          strasse: p.legal_data?.strasse || "",
          plz: p.legal_data?.plz || "",
          stadt: p.legal_data?.stadt || "",
          land: p.legal_data?.land || "Deutschland",
          email: p.legal_data?.email || "",
          telefon: p.legal_data?.telefon || "",
          ustId: p.legal_data?.ustId || "",
          handelsregister: p.legal_data?.handelsregister || "",
        });
        setLoading(false);
      })
      .catch(() => router.push("/"));
  }, [router]);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopify_credentials: credentials, legal_data: legalData }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Fehler"); return; }
      setSuccess(t.profile.saved);
      setTimeout(() => setSuccess(""), 3000);
    } catch { setError("Speichern fehlgeschlagen."); }
    finally { setSaving(false); }
  }

  async function handleLinkGoogle() {
    if (!linkGoogleInput.includes("@")) return;
    setLinkingGoogle(true);
    try {
      const res = await fetch("/api/profile/link-google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googleEmail: linkGoogleInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setLinkedGoogleEmail(data.linkedEmail);
        setShowLinkInput(false);
        setSuccess(t.profile.googleLinked + ": " + data.linkedEmail);
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch { /* ignore */ }
    finally { setLinkingGoogle(false); }
  }

  const creditPercent = credits.max > 0 ? ((credits.remaining / credits.max) * 100) : 0;
  const creditColor = creditPercent > 50 ? "#95BF47" : creditPercent > 20 ? "#F59E0B" : "#EF4444";

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

      <div className="fixed top-40 left-10 w-72 h-72 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 md:py-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-3">
            <User className="w-7 h-7 md:w-8 md:h-8 text-indigo-400" />
            {t.profile.title}
          </h1>
          <p className="text-zinc-400 text-sm">{t.profile.subtitle}</p>
          {kundenEmail && <p className="text-xs text-zinc-600 mt-1">{kundenEmail} &bull; {shopDomain || "Kein Shop verbunden"}</p>}
        </motion.div>

        {/* Toasts */}
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
            <button onClick={() => setError("")} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 rounded-xl mb-4">
            <Check className="w-4 h-4 shrink-0" /><span>{success}</span>
          </div>
        )}

        <div className="space-y-5">
          {/* Profile Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}
            className="glass-strong rounded-2xl border border-white/10 p-5 md:p-6 backdrop-blur-xl">
            <div className="flex items-start gap-4 md:gap-5">
              <div className="shrink-0">
                {googleProfile?.image ? (
                  <img src={googleProfile.image} alt="" className="w-16 h-16 md:w-20 md:h-20 rounded-2xl border-2 border-white/10 object-cover" />
                ) : (
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
                    <User className="w-8 h-8 md:w-10 md:h-10 text-zinc-500" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg md:text-xl font-bold truncate">{googleProfile?.name || kundenEmail || "Kunde"}</h2>
                <p className="text-sm text-zinc-400 truncate">{googleProfile?.email || kundenEmail}</p>
                {shopDomain && <p className="text-xs text-zinc-600 mt-0.5">{shopDomain}</p>}
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#95BF47]/10 border border-[#95BF47]/20">
                  <Crown className="w-4 h-4 text-[#95BF47]" />
                  <span className="text-sm font-semibold text-[#95BF47]">{t.profile.activeSub}</span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-5 grid grid-cols-3 gap-2 md:gap-3">
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2.5 md:p-3 text-center">
                <CreditCard className="w-4 h-4 text-zinc-500 mx-auto mb-1" />
                <div className="text-[10px] md:text-xs text-zinc-500">{t.profile.plan}</div>
                <div className="text-xs md:text-sm font-bold text-white mt-0.5">Managed</div>
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2.5 md:p-3 text-center">
                <Zap className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                <div className="text-[10px] md:text-xs text-zinc-500">{t.profile.aiCredits}</div>
                <div className="text-xs md:text-sm font-bold text-white mt-0.5">{credits.remaining}/{credits.max}</div>
              </div>
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2.5 md:p-3 text-center">
                <Store className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                <div className="text-[10px] md:text-xs text-zinc-500">{t.profile.shop}</div>
                <div className="text-xs md:text-sm font-bold text-white mt-0.5">{hasShopifyToken ? t.profile.active : "\u2014"}</div>
              </div>
            </div>

            {/* Google Link */}
            <div className="mt-5 pt-4 border-t border-white/5">
              {linkedGoogleEmail || googleProfile?.email ? (
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  {t.profile.googleLinked}: {linkedGoogleEmail || googleProfile?.email}
                </div>
              ) : showLinkInput ? (
                <div className="flex items-center gap-2">
                  <input type="email" value={linkGoogleInput} onChange={(e) => setLinkGoogleInput(e.target.value)} placeholder="Google E-Mail eingeben" className="input-glass flex-1 text-xs" />
                  <button onClick={handleLinkGoogle} disabled={linkingGoogle} className="btn-accent px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5">
                    {linkingGoogle ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                    Link
                  </button>
                  <button onClick={() => setShowLinkInput(false)} className="text-zinc-600 p-2"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <button onClick={() => setShowLinkInput(true)} className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  {t.profile.linkGoogle}
                </button>
              )}
            </div>
          </motion.div>

          {/* Credit System Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
            className="relative overflow-hidden rounded-2xl border border-white/10 p-5 md:p-6 backdrop-blur-xl"
            style={{ background: "linear-gradient(135deg, rgba(149,191,71,0.08) 0%, rgba(255,255,255,0.04) 50%, rgba(99,102,241,0.06) 100%)" }}>
            {/* Decorative glow */}
            <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-[80px] pointer-events-none" style={{ background: `${creditColor}15` }} />

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${creditColor}20`, border: `1px solid ${creditColor}30` }}>
                  <Zap className="w-5 h-5" style={{ color: creditColor }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Monatliche Credits</h3>
                  <p className="text-[10px] text-zinc-500">Setzt sich jeden Monat automatisch zur&uuml;ck</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl md:text-2xl font-black tabular-nums" style={{ color: creditColor }}>
                  {credits.remaining}
                </div>
                <div className="text-[10px] text-zinc-500">von {credits.max}</div>
              </div>
            </div>

            {/* Animated Progress Bar */}
            <div className="relative h-4 bg-white/[0.06] rounded-full overflow-hidden border border-white/[0.06]">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${creditColor}, ${creditColor}CC)`,
                  boxShadow: `0 0 20px ${creditColor}40`,
                }}
                initial={{ width: 0 }}
                animate={{ width: `${creditPercent}%` }}
                transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
              />
              {/* Shimmer effect */}
              <motion.div
                className="absolute inset-y-0 w-20 rounded-full"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)" }}
                initial={{ left: "-80px" }}
                animate={{ left: "calc(100% + 80px)" }}
                transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
              />
            </div>

            <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-500">
              <span>{credits.remaining} / {credits.max} verf&uuml;gbar</span>
              {credits.remaining <= 0 && (
                <span className="text-red-400 font-semibold">Limit erreicht</span>
              )}
            </div>
          </motion.div>

          {/* Shopify API */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
            className="glass-strong rounded-2xl border border-white/10 p-5 md:p-6 space-y-4 backdrop-blur-xl">
            <h2 className="font-bold flex items-center gap-2">
              <Store className="w-5 h-5 text-[#95BF47]" />
              {t.profile.shopifyTitle}
            </h2>
            <div className="flex items-center gap-2 text-xs">
              {hasShopifyToken ? (
                <span className="text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" />{t.profile.shopConnected}: {shopDomain}</span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{t.profile.shopNotConnected}</span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 flex items-center gap-1"><Key className="w-3 h-3" />{t.profile.clientId}</label>
                <input type="text" value={credentials.clientId} onChange={(e) => setCredentials((p) => ({ ...p, clientId: e.target.value }))} placeholder="Shopify Client-ID" className="input-glass w-full font-mono text-xs" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 flex items-center gap-1"><Key className="w-3 h-3" />{t.profile.clientSecret}</label>
                <input type="password" value={credentials.clientSecret} onChange={(e) => setCredentials((p) => ({ ...p, clientSecret: e.target.value }))} placeholder="Shopify Client Secret" className="input-glass w-full font-mono text-xs" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 flex items-center gap-1"><Globe className="w-3 h-3" />{t.profile.shopDomain}</label>
              <input type="text" value={shopDomain} disabled className="input-glass w-full text-xs" />
              <p className="text-[10px] text-zinc-600 mt-1.5">{t.profile.shopDomainHint}</p>
            </div>
          </motion.div>

          {/* Legal Data */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="glass-strong rounded-2xl border border-white/10 p-5 md:p-6 space-y-4 backdrop-blur-xl">
            <h2 className="font-bold flex items-center gap-2">
              <Scale className="w-5 h-5 text-blue-400" />
              {t.profile.legalTitle}
            </h2>
            <p className="text-zinc-400 text-xs">{t.profile.legalDesc}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t.profile.companyName}</label>
                <input type="text" value={legalData.firmenname} onChange={(e) => setLegalData((p) => ({ ...p, firmenname: e.target.value }))} className="input-glass w-full" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t.profile.owner}</label>
                <input type="text" value={legalData.inhaber} onChange={(e) => setLegalData((p) => ({ ...p, inhaber: e.target.value }))} className="input-glass w-full" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">{t.profile.street}</label>
              <input type="text" value={legalData.strasse} onChange={(e) => setLegalData((p) => ({ ...p, strasse: e.target.value }))} className="input-glass w-full" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input type="text" value={legalData.plz} onChange={(e) => setLegalData((p) => ({ ...p, plz: e.target.value }))} placeholder={t.profile.zip} className="input-glass" />
              <input type="text" value={legalData.stadt} onChange={(e) => setLegalData((p) => ({ ...p, stadt: e.target.value }))} placeholder={t.profile.city} className="input-glass col-span-2" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">{t.profile.country}</label>
              <select value={legalData.land} onChange={(e) => setLegalData((p) => ({ ...p, land: e.target.value }))} className="input-glass w-full">
                <option value="Deutschland">Deutschland</option>
                <option value={"\u00d6sterreich"}>{"\u00d6sterreich"}</option>
                <option value="Schweiz">Schweiz</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t.profile.email}</label>
                <input type="email" value={legalData.email} onChange={(e) => setLegalData((p) => ({ ...p, email: e.target.value }))} className="input-glass w-full" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t.profile.phone}</label>
                <input type="tel" value={legalData.telefon} onChange={(e) => setLegalData((p) => ({ ...p, telefon: e.target.value }))} className="input-glass w-full" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t.profile.vatId}</label>
                <input type="text" value={legalData.ustId} onChange={(e) => setLegalData((p) => ({ ...p, ustId: e.target.value }))} placeholder="DE123456789" className="input-glass w-full" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t.profile.tradeRegister}</label>
                <input type="text" value={legalData.handelsregister} onChange={(e) => setLegalData((p) => ({ ...p, handelsregister: e.target.value }))} placeholder="HRB 12345" className="input-glass w-full" />
              </div>
            </div>
          </motion.div>

          {/* Save */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <button onClick={handleSave} disabled={saving} className="w-full btn-accent py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" />{t.profile.save}</>}
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
