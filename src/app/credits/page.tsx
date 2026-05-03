"use client";

// ─── /credits — Credit Shop ──────────────────────────────────────
// Strictly hub-internal: any non-logged-in visitor is bounced to "/".
// Premium two-column layout: balance + voucher redemption on the
// left, a vertical stack of three packages on the right. Cart links
// patch the customer's email into the URL so the Shopify checkout
// pre-fills, which the orders/paid webhook later uses to credit the
// right account.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coins,
  ShoppingCart,
  ShieldCheck,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Ticket,
  Loader2,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { useCredits } from "@/lib/credits";
import {
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

export default function CreditsPage() {
  const router = useRouter();
  const credits = useCredits();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState<string | null>(null);

  // Voucher
  const [voucher, setVoucher] = useState("");
  const [voucherStatus, setVoucherStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "success"; credits: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

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

  function handleBuy(pkg: CreditPackage) {
    if (!checkoutEmail) {
      window.location.href = pkg.cartUrl.replace("?checkout[email]=[USER_EMAIL]", "");
      return;
    }
    setRedirecting(pkg.id);
    window.location.href = buildCartUrl(pkg, checkoutEmail);
  }

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = voucher.trim();
    if (!trimmed) return;
    setVoucherStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/credits/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVoucherStatus({
          kind: "error",
          message: data.error || "Code konnte nicht eingelöst werden.",
        });
        return;
      }
      setVoucherStatus({ kind: "success", credits: data.creditsAdded });
      setVoucher("");
      if (typeof data.balance === "number") {
        credits.setBalance(data.balance);
      } else {
        credits.refresh();
      }
    } catch {
      setVoucherStatus({ kind: "error", message: "Verbindungsfehler – bitte erneut versuchen." });
    }
  }

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-credits-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-credits-mesh font-sf text-white relative overflow-hidden">
      <Navigation />

      {/* Ambient orbs — ultra subtle, premium feel */}
      <div className="pointer-events-none fixed top-32 right-[-200px] w-[600px] h-[600px] rounded-full opacity-50"
        style={{ background: "radial-gradient(closest-side, rgba(149,191,71,0.18), transparent 70%)" }}
      />
      <div className="pointer-events-none fixed bottom-[-150px] left-[-150px] w-[500px] h-[500px] rounded-full opacity-40"
        style={{ background: "radial-gradient(closest-side, rgba(99,102,241,0.16), transparent 70%)" }}
      />
      <div className="pointer-events-none fixed top-1/2 left-1/3 w-[700px] h-[700px] rounded-full opacity-30 -translate-y-1/2"
        style={{ background: "radial-gradient(closest-side, rgba(168,85,247,0.10), transparent 70%)" }}
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-12">
        {/* Back link */}
        <Link
          href="/home"
          className="inline-flex items-center gap-1.5 text-[12px] text-white/45 hover:text-white transition mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Zurück zum Dashboard
        </Link>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 md:mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] text-[10.5px] uppercase tracking-[0.18em] text-white/55 mb-5">
            <Sparkles className="w-3 h-3 text-[#95BF47]" />
            Credit-Aufladung
          </div>
          <h1 className="font-sf-display text-4xl md:text-6xl font-bold tracking-[-0.025em] leading-[1.05] max-w-3xl">
            Lade dein <span className="bg-gradient-to-r from-[#95BF47] to-[#c8e87a] bg-clip-text text-transparent">Brospify-Konto</span> auf.
          </h1>
          <p className="text-white/55 text-[15px] mt-4 max-w-xl leading-relaxed">
            Wähle ein Paket oder löse einen Gutschein-Code ein. Dein Guthaben wird
            unmittelbar nach dem Bezahlvorgang gutgeschrieben.
          </p>
        </motion.div>

        {/* Two-column workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-5 md:gap-7">
          {/* LEFT: Balance + voucher */}
          <div className="space-y-5">
            <BalanceCard
              balance={credits.balance}
              loading={credits.loading}
              email={checkoutEmail}
            />

            <VoucherCard
              voucher={voucher}
              setVoucher={setVoucher}
              status={voucherStatus}
              onSubmit={handleRedeem}
              onDismissStatus={() => setVoucherStatus({ kind: "idle" })}
            />

            {/* Trust strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <TrustItem icon={Zap} title="Sofort verfügbar">
                Echtzeit-Gutschrift nach erfolgreichem Bezahlvorgang.
              </TrustItem>
              <TrustItem icon={ShieldCheck} title="Sichere Bezahlung">
                Abwicklung über den offiziellen Brospify-Shopify-Checkout.
              </TrustItem>
            </div>
          </div>

          {/* RIGHT: Packages stacked vertically */}
          <div className="space-y-3.5">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className="text-[13px] uppercase tracking-[0.18em] font-semibold text-white/55">
                Pakete
              </h2>
              <span className="text-[11px] text-white/30">Einmalzahlung · inkl. MwSt.</span>
            </div>
            {CREDIT_PACKAGES.map((pkg, idx) => (
              <PackageRow
                key={pkg.id}
                pkg={pkg}
                index={idx}
                redirecting={redirecting === pkg.id}
                disabled={Boolean(redirecting && redirecting !== pkg.id)}
                hasEmail={Boolean(checkoutEmail)}
                onBuy={() => handleBuy(pkg)}
              />
            ))}
          </div>
        </div>

        {/* Mandatory hint */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-10 rounded-2xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-2xl px-5 py-4 flex items-start gap-3"
        >
          <ShieldCheck className="w-5 h-5 text-[#95BF47] mt-0.5 shrink-0" />
          <div className="text-[13.5px] leading-relaxed text-white/75">
            <span className="font-semibold text-white">Hinweis: </span>
            Diese Credits sind nur in Verbindung mit einem Brospify Abo nutzbar.
          </div>
        </motion.div>

        {checkoutEmail && (
          <p className="mt-6 text-[11px] text-white/30 text-center">
            Checkout vorausgefüllt mit{" "}
            <span className="font-mono text-white/55">{checkoutEmail}</span>
          </p>
        )}
      </div>

      {/* Page-local mesh background — only on this route. Doesn't
          touch the global tokens, so the rest of the hub is unaffected. */}
      <style jsx global>{`
        .bg-credits-mesh {
          background:
            radial-gradient(ellipse 1100px 800px at 8% -10%, rgba(149, 191, 71, 0.12) 0%, transparent 55%),
            radial-gradient(ellipse 900px 700px at 92% 110%, rgba(99, 102, 241, 0.08) 0%, transparent 55%),
            radial-gradient(ellipse 700px 500px at 50% 50%, rgba(255, 255, 255, 0.012) 0%, transparent 70%),
            #050507;
        }
      `}</style>
    </div>
  );
}

// ─── Balance Card ───────────────────────────────────────────────

function BalanceCard({
  balance,
  loading,
  email,
}: {
  balance: number;
  loading: boolean;
  email: string;
}) {
  const empty = balance <= 0 && !loading;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="relative rounded-3xl border border-white/[0.10] backdrop-blur-2xl px-6 py-7 overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, rgba(149,191,71,0.08) 0%, rgba(255,255,255,0.04) 50%, rgba(168,85,247,0.06) 100%)",
        boxShadow:
          "0 30px 80px -40px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      <div
        className="absolute -top-24 -right-24 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(closest-side, rgba(149,191,71,0.25), transparent 70%)" }}
      />

      <div className="relative">
        <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.18em] text-white/45 mb-3">
          <Coins className="w-3.5 h-3.5 text-[#95BF47]" />
          Aktuelles Guthaben
        </div>

        <div className="flex items-baseline gap-2.5">
          <motion.span
            key={balance}
            initial={{ y: -4, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="font-sf-display font-black text-5xl md:text-6xl tabular-nums tracking-[-0.03em] leading-none text-white"
          >
            {loading ? "···" : balance.toLocaleString("de-DE")}
          </motion.span>
          <span className="text-[14px] font-medium text-white/45">Credits</span>
        </div>

        {empty ? (
          <p className="mt-4 text-[13px] text-amber-200/85 leading-relaxed">
            <AlertTriangle className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />
            Dein Guthaben ist leer – AI-Tools sind blockiert. Lade auf, um wieder loszulegen.
          </p>
        ) : (
          <p className="mt-4 text-[13px] text-white/50 leading-relaxed">
            Dein Guthaben verfällt nicht – verbrauchte Credits werden in Echtzeit aktualisiert.
          </p>
        )}

        {email && (
          <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-white/40" />
            <span className="text-[11px] text-white/40 font-mono truncate">{email}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Voucher Card ───────────────────────────────────────────────

function VoucherCard({
  voucher,
  setVoucher,
  status,
  onSubmit,
  onDismissStatus,
}: {
  voucher: string;
  setVoucher: (v: string) => void;
  status:
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "success"; credits: number }
    | { kind: "error"; message: string };
  onSubmit: (e: React.FormEvent) => void;
  onDismissStatus: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-3xl border border-white/[0.08] backdrop-blur-2xl px-6 py-6"
      style={{
        background: "rgba(255,255,255,0.025)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.18em] text-white/45 mb-1.5">
        <Ticket className="w-3.5 h-3.5 text-[#95BF47]" />
        Gutschein einlösen
      </div>
      <h3 className="font-sf-display text-xl font-semibold tracking-tight mb-4">
        Hast du einen Code?
      </h3>

      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2.5">
        <input
          value={voucher}
          onChange={(e) => {
            setVoucher(e.target.value.toUpperCase());
            if (status.kind !== "idle" && status.kind !== "loading") {
              onDismissStatus();
            }
          }}
          placeholder="z. B. WELCOME50"
          maxLength={64}
          className="flex-1 rounded-xl px-4 py-3 text-[14px] font-mono tracking-wider uppercase outline-none transition placeholder:text-white/20 placeholder:font-sans placeholder:tracking-normal placeholder:normal-case"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        />
        <button
          type="submit"
          disabled={status.kind === "loading" || voucher.trim().length < 3}
          className="btn-accent inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[13.5px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {status.kind === "loading" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Ticket className="w-4 h-4" />
          )}
          Einlösen
        </button>
      </form>

      <AnimatePresence mode="wait">
        {status.kind === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-3 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#95BF47]/12 border border-[#95BF47]/30 text-[13px] text-[#bce078]"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              <span className="font-semibold">+{status.credits.toLocaleString("de-DE")} Credits</span> wurden gutgeschrieben.
            </span>
          </motion.div>
        )}
        {status.kind === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-3 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-[13px] text-red-200"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{status.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Package Row ────────────────────────────────────────────────

function PackageRow({
  pkg,
  index,
  redirecting,
  disabled,
  hasEmail,
  onBuy,
}: {
  pkg: CreditPackage;
  index: number;
  redirecting: boolean;
  disabled: boolean;
  hasEmail: boolean;
  onBuy: () => void;
}) {
  const featured = pkg.id === "pro";
  const max = pkg.id === "max";

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.08 + index * 0.06,
        type: "spring",
        stiffness: 220,
        damping: 22,
      }}
      className="relative group"
    >
      <div
        className={`relative rounded-3xl border backdrop-blur-2xl overflow-hidden transition-all duration-300 ${
          featured
            ? "border-[#95BF47]/35 group-hover:border-[#95BF47]/55"
            : "border-white/[0.08] group-hover:border-white/[0.18]"
        }`}
        style={{
          background: featured
            ? "linear-gradient(135deg, rgba(149,191,71,0.10) 0%, rgba(149,191,71,0.04) 60%, rgba(255,255,255,0.025) 100%)"
            : max
            ? "linear-gradient(135deg, rgba(168,85,247,0.07) 0%, rgba(255,255,255,0.025) 100%)"
            : "rgba(255,255,255,0.025)",
          boxShadow: featured
            ? "0 30px 80px -40px rgba(149,191,71,0.5), inset 0 1px 0 rgba(255,255,255,0.06)"
            : "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <div className="p-5 md:p-6 flex items-center gap-4 md:gap-6">
          {/* Credits + price */}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="font-sf-display font-black text-3xl md:text-4xl tabular-nums tracking-[-0.025em] leading-none">
                {pkg.credits.toLocaleString("de-DE")}
              </span>
              <span className="text-[12.5px] text-white/45 font-medium">Credits</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="font-sf-display text-lg font-bold tabular-nums">
                {pkg.priceLabel}
              </span>
              <span className="text-[10.5px] text-white/35 uppercase tracking-[0.12em]">
                einmalig
              </span>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={onBuy}
            disabled={disabled || redirecting || !hasEmail}
            className={`shrink-0 inline-flex items-center justify-center gap-1.5 px-4 md:px-5 h-11 md:h-12 rounded-xl font-semibold text-[13.5px] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
              featured ? "btn-deploy" : "btn-accent"
            }`}
            title={hasEmail ? "Zur Kasse" : "Kein E-Mail-Profil hinterlegt"}
          >
            {redirecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Kaufen"
            )}
          </button>
        </div>
      </div>
    </motion.div>
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
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md px-4 py-3 flex gap-3">
      <Icon className="w-4 h-4 text-[#95BF47] mt-0.5 shrink-0" />
      <div>
        <div className="font-semibold text-white/85 text-[12.5px]">{title}</div>
        <div className="text-white/45 text-[11.5px] leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
