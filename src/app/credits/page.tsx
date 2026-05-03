"use client";

// ─── /credits — Credit Shop ──────────────────────────────────────
// Strictly hub-internal: any non-logged-in visitor is bounced to "/".
// Three Shopify cart permalinks; we patch the customer's email into
// the URL so the Shopify checkout pre-fills the contact field, which
// the orders/paid webhook later uses to credit the right account.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Coins,
  ShoppingCart,
  ShieldCheck,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Mail,
  ImageUp,
  PenTool,
  BarChart,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { useCredits } from "@/lib/credits";
import {
  CREDIT_COSTS,
  CREDIT_PACKAGES,
  buildCartUrl,
  type CreditPackage,
} from "@/lib/credit-costs";

interface SessionInfo {
  isLoggedIn: boolean;
  isAdmin: boolean;
  googleEmail?: string;
}

interface ProfileInfo {
  kundenEmail?: string;
}

const PER_CREDIT_PRICE = (pkg: CreditPackage) => pkg.priceCents / pkg.credits;

export default function CreditsPage() {
  const router = useRouter();
  const credits = useCredits();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/session").then((r) => r.json()),
      fetch("/api/profile").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([sess, prof]) => {
        if (!sess?.isLoggedIn) {
          router.push("/");
          return;
        }
        setSession(sess);
        setProfile(prof || null);
        setLoading(false);
        credits.refresh();
      })
      .catch(() => router.push("/"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Pick the freshest email we can find — Shopify-side customer record
  // wins over the OAuth Google email so the cart matches what the
  // webhook will look up.
  const checkoutEmail = useMemo(() => {
    return (
      profile?.kundenEmail?.trim() ||
      session?.googleEmail?.trim() ||
      ""
    );
  }, [profile, session]);

  const cheapest = useMemo(() => {
    return CREDIT_PACKAGES.reduce((best, p) =>
      PER_CREDIT_PRICE(p) < PER_CREDIT_PRICE(best) ? p : best,
    );
  }, []);

  function handleBuy(pkg: CreditPackage) {
    if (!checkoutEmail) {
      // Without an email we'd send the user to a permalink with the
      // literal `[USER_EMAIL]` placeholder — Shopify would reject it.
      // Fall back to the unbranded cart URL.
      window.location.href = pkg.cartUrl.replace("?checkout[email]=[USER_EMAIL]", "");
      return;
    }
    setRedirecting(pkg.id);
    window.location.href = buildCartUrl(pkg, checkoutEmail);
  }

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-email-mesh font-sf text-white">
      <Navigation />

      <div className="fixed top-32 right-10 w-72 h-72 bg-[#95BF47]/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-20 left-10 w-72 h-72 bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-10">
        {/* Back link */}
        <Link
          href="/home"
          className="inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-white transition mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Zurück zum Dashboard
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 sm:justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-11 h-11 rounded-2xl bg-[#95BF47]/15 border border-[#95BF47]/30 flex items-center justify-center">
                  <Coins className="w-6 h-6 text-[#95BF47]" />
                </div>
                <div>
                  <h1 className="font-sf-display text-2xl md:text-3xl font-bold tracking-tight">
                    Credit-Shop
                  </h1>
                  <p className="text-zinc-400 text-sm mt-0.5">
                    Lade dein Guthaben auf – sofort verfügbar nach dem Kauf.
                  </p>
                </div>
              </div>
            </div>

            {/* Live balance card */}
            <div className="glass-email px-5 py-3.5 flex items-center gap-3 self-start sm:self-end">
              <div className="text-[10px] uppercase tracking-[0.14em] text-white/45 leading-none">
                Aktuelles Guthaben
              </div>
              <div className="font-mono font-bold text-2xl tabular-nums text-[#95BF47] leading-none">
                {credits.loading ? "···" : credits.balance.toLocaleString("de-DE")}
              </div>
            </div>
          </div>

          {credits.balance <= 0 && !credits.loading && (
            <div className="mt-5 flex items-start gap-2 text-[13px] text-amber-200/90 bg-amber-500/10 border border-amber-500/25 px-4 py-3 rounded-xl">
              <AlertTriangle className="w-4 h-4 mt-px shrink-0" />
              <span>
                Dein Guthaben ist leer. AI-Tools bleiben blockiert, bis du Credits aufgeladen hast.
              </span>
            </div>
          )}
        </motion.div>

        {/* Cost reference strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-8">
          <CostBox icon={Mail} label="E-Mail" value={CREDIT_COSTS.EMAIL_GENERATE} accent="#fb7185" />
          <CostBox icon={PenTool} label="Blog" value={CREDIT_COSTS.BLOG_GENERATE} accent="#95BF47" />
          <CostBox icon={ImageUp} label="Upscale" value={CREDIT_COSTS.UPSCALE_IMAGE} accent="#a78bfa" />
          <CostBox icon={BarChart} label="SEO" value={CREDIT_COSTS.SEO_AUDIT} accent="#60a5fa" free />
        </div>

        {/* Packages */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {CREDIT_PACKAGES.map((pkg, idx) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              index={idx}
              isCheapest={pkg.id === cheapest.id}
              email={checkoutEmail}
              redirecting={redirecting === pkg.id}
              disabled={Boolean(redirecting && redirecting !== pkg.id)}
              onBuy={() => handleBuy(pkg)}
            />
          ))}
        </div>

        {/* Mandatory hint */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-8 glass-email px-5 py-4 flex items-start gap-3"
        >
          <ShieldCheck className="w-5 h-5 text-[#95BF47] mt-0.5 shrink-0" />
          <div className="text-[13px] leading-relaxed text-white/75">
            <span className="font-semibold text-white">Hinweis: </span>
            Diese Credits sind nur in Verbindung mit einem Brospify Abo nutzbar.
          </div>
        </motion.div>

        {/* Trust strip */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px] text-white/55">
          <TrustItem icon={Zap} title="Sofort verfügbar">
            Credits werden in Echtzeit nach erfolgreichem Kauf gutgeschrieben.
          </TrustItem>
          <TrustItem icon={ShieldCheck} title="Sichere Bezahlung">
            Abwicklung über den offiziellen Brospify Shopify-Checkout.
          </TrustItem>
          <TrustItem icon={Sparkles} title="Kein Verfall">
            Dein Guthaben bleibt bestehen, solange dein Abo aktiv ist.
          </TrustItem>
        </div>

        {/* Email used for checkout (transparency) */}
        {checkoutEmail && (
          <p className="mt-6 text-[11px] text-white/35 text-center">
            Checkout-Email wird vorausgefüllt mit{" "}
            <span className="font-mono text-white/60">{checkoutEmail}</span>
            {" "}— deine Credits landen automatisch auf diesem Konto.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Cost Box ────────────────────────────────────────────────────

function CostBox({
  icon: Icon,
  label,
  value,
  accent,
  free,
}: {
  icon: typeof Coins;
  label: string;
  value: number;
  accent: string;
  free?: boolean;
}) {
  return (
    <div
      className="rounded-xl border px-3 py-2.5 flex items-center gap-2.5"
      style={{
        background: "rgba(255,255,255,0.025)",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${accent}1f`, border: `1px solid ${accent}3a` }}
      >
        <Icon className="w-4 h-4" style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.12em] text-white/40 leading-none">
          {label}
        </div>
        <div className="text-[14px] font-bold text-white mt-1 leading-none tabular-nums">
          {free ? "Gratis" : `${value} CR`}
        </div>
      </div>
    </div>
  );
}

// ─── Package Card ────────────────────────────────────────────────

function PackageCard({
  pkg,
  index,
  isCheapest,
  email,
  redirecting,
  disabled,
  onBuy,
}: {
  pkg: CreditPackage;
  index: number;
  isCheapest: boolean;
  email: string;
  redirecting: boolean;
  disabled: boolean;
  onBuy: () => void;
}) {
  const ratePerCent = pkg.credits / pkg.priceCents;
  const ratePerEuro = ratePerCent * 100;
  const featured = pkg.id === "pro";

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.05, type: "spring", stiffness: 220, damping: 22 }}
      className={`relative rounded-3xl border backdrop-blur-2xl overflow-hidden transition-all duration-300 ${
        featured
          ? "border-[#95BF47]/35 bg-[#95BF47]/[0.06] shadow-[0_30px_80px_-30px_rgba(149,191,71,0.45)]"
          : "border-white/[0.08] bg-white/[0.025] hover:border-white/[0.18]"
      }`}
    >
      {pkg.hint && (
        <div
          className={`absolute top-0 right-5 -translate-y-1/2 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.12em] font-bold border ${
            featured
              ? "bg-[#95BF47] text-[#0a1604] border-[#86ad3f]"
              : "bg-white/10 text-white/85 border-white/20 backdrop-blur"
          }`}
        >
          {pkg.hint}
        </div>
      )}

      <div className="p-6 md:p-7">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[11px] uppercase tracking-[0.16em] font-semibold text-white/55">
            {pkg.id === "starter" ? "Starter" : pkg.id === "pro" ? "Pro" : "Max"}
          </span>
          {isCheapest && (
            <span className="text-[10px] font-mono text-[#95BF47]">
              {ratePerEuro.toFixed(0)} Cr / €
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-2 mb-3">
          <span className="font-sf-display font-black text-4xl md:text-5xl tabular-nums tracking-tight">
            {pkg.credits.toLocaleString("de-DE")}
          </span>
          <span className="text-sm text-white/55 font-medium">Credits</span>
        </div>

        <div className="mb-5 pb-5 border-b border-white/[0.06]">
          <div className="flex items-baseline gap-2">
            <span className="font-sf-display text-2xl font-bold">{pkg.priceLabel}</span>
            <span className="text-[11px] text-white/40">einmalig · inkl. MwSt.</span>
          </div>
        </div>

        <ul className="space-y-2 mb-6 text-[13px] text-white/70">
          <Bullet>
            ≈ {Math.floor(pkg.credits / CREDIT_COSTS.EMAIL_GENERATE).toLocaleString("de-DE")} E-Mail-Generierungen
          </Bullet>
          <Bullet>
            ≈ {Math.floor(pkg.credits / CREDIT_COSTS.BLOG_GENERATE).toLocaleString("de-DE")} Blog-Beiträge
          </Bullet>
          <Bullet>
            ≈ {Math.floor(pkg.credits / CREDIT_COSTS.UPSCALE_IMAGE).toLocaleString("de-DE")} Cloud-Upscales
          </Bullet>
          <Bullet>SEO-Analyse immer kostenfrei</Bullet>
        </ul>

        <button
          onClick={onBuy}
          disabled={disabled || redirecting || !email}
          className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            featured ? "btn-deploy" : "btn-accent"
          }`}
          style={featured ? undefined : { paddingTop: 12, paddingBottom: 12 }}
        >
          {redirecting ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Weiterleitung …
            </>
          ) : (
            <>
              <ShoppingCart className="w-4 h-4" />
              Jetzt kaufen
            </>
          )}
        </button>

        {!email && (
          <p className="mt-3 text-[11px] text-amber-300/85 text-center">
            Hinterlege eine E-Mail in deinem Profil, um den Checkout vorzubefüllen.
          </p>
        )}
      </div>
    </motion.div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="w-4 h-4 text-[#95BF47] mt-0.5 shrink-0" />
      <span>{children}</span>
    </li>
  );
}

// ─── Trust strip ────────────────────────────────────────────────

function TrustItem({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Coins;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 flex gap-3">
      <Icon className="w-4 h-4 text-[#95BF47] mt-0.5 shrink-0" />
      <div>
        <div className="font-semibold text-white/85 text-[12.5px]">{title}</div>
        <div className="text-white/50 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
