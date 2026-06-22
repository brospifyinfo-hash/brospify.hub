"use client";

// ─── /account/subscription ───────────────────────────────────────
// Komplette Abo-Uebersicht in einem Bildschirm. Drei Etagen:
//   1. STATUS HERO: Plan + Status (aktiv/gekuendigt/abgelaufen)
//   2. CREDITS-CARDS: aktuelle Balance + monatliche Allowance + Verlauf
//   3. ACTIONS: Upgrade-, Topup-, Kuendigen-Buttons
//
// Kuendigen geht direkt zum Shopify Customer-Portal (kein API-Modal),
// damit der Kunde selbst seine Subscription bei Shopify managed.

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Coins,
  Calendar,
  RefreshCcw,
  CheckCircle2,
  XCircle,
  ShieldOff,
  Crown,
  TrendingUp,
  Plus,
  ExternalLink,
  Sparkles,
  Receipt,
} from "lucide-react";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import { tierFromSku, TIER_DISPLAY_LABEL, DEFAULT_TIERS, type TierKey } from "@/lib/tiers-shared";

interface CreditTransaction {
  ts: string;
  type: "starter" | "deduct" | "topup" | "voucher" | "admin-grant" | "admin-revoke" | "subscription" | "recurring" | "survey";
  delta: number;
  balanceAfter: number;
  reason?: string;
}

interface CreditCycle {
  startedAt: string | null;
  periodDays: number;
  recurringAmount: number;
  nextGrantAt: string | null;
  daysUntilNext: number | null;
  cycleProgressPct: number;
  periodsGranted: number;
  lastGrantAt: string | null;
}

interface ProfileWithSub {
  tier?: TierKey;
  tierSince?: string;
  tierCanceledAt?: string;
  subscriptionEndsAt?: string;
  lastSubscriptionRefillAt?: string;
  subscriptionContractId?: string;
  credits?: {
    balance: number;
    totalPurchased: number;
    totalUsed: number;
    log?: CreditTransaction[];
  };
}

const SHOPIFY_PORTAL_URL = process.env.NEXT_PUBLIC_SHOPIFY_CUSTOMER_PORTAL_URL || "https://brospify.com/account";

export default function AccountSubscriptionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [planSku, setPlanSku] = useState("");
  const [profile, setProfile] = useState<ProfileWithSub | null>(null);
  const [balance, setBalance] = useState(0);
  const [creditCycle, setCreditCycle] = useState<CreditCycle | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => { if (r.status === 401) { router.push("/"); return null; } return r.json(); })
      .then((data) => {
        if (!data) return;
        setProfile(data.profile || {});
        setPlanSku(data.sku || "");
        setBalance(data.credits?.balance || 0);
        setCreditCycle(data.creditCycle || null);
        setLoading(false);
      })
      .catch(() => router.push("/"));
  }, [router]);

  const tierKey = tierFromSku(planSku);
  const tier = (tierKey ? DEFAULT_TIERS.find((t) => t.key === tierKey) : null) || null;
  const tierLabel = tierKey ? TIER_DISPLAY_LABEL[tierKey] : "Kein Abo";

  const isCanceled = !!profile?.tierCanceledAt;
  const isExpired = !!(profile?.subscriptionEndsAt && new Date(profile.subscriptionEndsAt) < new Date());
  const statusLabel = isExpired ? "Abgelaufen" : isCanceled ? "Gekuendigt" : tierKey ? "Aktiv" : "Inaktiv";

  // Verbleibende Tage bis subscriptionEndsAt (für die prominente Anzeige).
  const daysLeft = profile?.subscriptionEndsAt
    ? Math.max(0, Math.ceil((new Date(profile.subscriptionEndsAt).getTime() - Date.now()) / 86400000))
    : null;

  async function confirmCancel() {
    if (!cancelReason || canceling) return;
    setCanceling(true);
    try {
      await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      });
    } catch {
      /* lokal evtl. nicht gespeichert — Weiterleitung trotzdem, dort kündigt der Kunde final */
    }
    // Direkt zu Shopify weiterleiten, wo das Abo final gekündigt wird.
    window.location.href = SHOPIFY_PORTAL_URL;
  }

  // Transaktions-Log aufbereiten: letzte 30 Tage, neueste oben
  const recentTx = useMemo(() => {
    const log = profile?.credits?.log || [];
    const cutoff = Date.now() - 30 * 86400000;
    return [...log]
      .filter((t) => new Date(t.ts).getTime() >= cutoff)
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, 12);
  }, [profile?.credits?.log]);

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5">
        {/* ─── Header ────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Coins className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Abo verwalten</h1>
            <p className="text-zinc-400 text-xs sm:text-sm">
              Status, Verlaengerung, Kuendigung und Verlauf
            </p>
          </div>
        </motion.div>

        {/* ─── STATUS HERO ──────────────────────────────── */}
        <PlanHero
          tierKey={tierKey}
          tierLabel={tierLabel}
          statusLabel={statusLabel}
          isCanceled={isCanceled}
          isExpired={isExpired}
          tier={tier}
          daysLeft={daysLeft}
        />

        {/* ─── CREDITS GRID ──────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KPICard
            icon={Coins}
            label="Aktuelles Guthaben"
            value={balance.toLocaleString("de-DE")}
            suffix="Credits"
            color="#F59E0B"
            highlight
          />
          <KPICard
            icon={TrendingUp}
            label="Monatlich"
            value={tier ? tier.monthlyCreditAllowance.toLocaleString("de-DE") : "—"}
            suffix={tier ? "Credits / Monat" : ""}
            color="#10B981"
          />
          <KPICard
            icon={Receipt}
            label="Insgesamt erworben"
            value={(profile?.credits?.totalPurchased || 0).toLocaleString("de-DE")}
            suffix="seit Beginn"
            color="#6366F1"
          />
        </div>

        {/* ─── CREDIT-ZYKLUS (Live-Countdown bis zur nächsten Gutschrift) ─── */}
        {creditCycle && creditCycle.startedAt && (
          <CreditCycleCard cycle={creditCycle} />
        )}

        {/* ─── TIMELINE / RENEWAL ────────────────────────── */}
        {tierKey && (
          <Card>
            <div className="space-y-3">
              <h2 className="text-[13px] font-bold flex items-center gap-2 text-zinc-200">
                <Calendar className="w-4 h-4 text-zinc-500" />
                Zeitleiste
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TimelineRow
                  label="Abo seit"
                  value={profile?.tierSince ? formatDate(profile.tierSince) : "—"}
                  icon={Calendar}
                />
                <TimelineRow
                  label="Letzte Aufladung"
                  value={profile?.lastSubscriptionRefillAt ? formatRelative(profile.lastSubscriptionRefillAt) : "Noch keine"}
                  icon={RefreshCcw}
                />
                {!isCanceled && !isExpired && profile?.subscriptionEndsAt && (
                  <TimelineRow
                    label="Naechste Verlaengerung"
                    value={`${formatDate(profile.subscriptionEndsAt)} (${formatRelative(profile.subscriptionEndsAt)})`}
                    icon={Sparkles}
                    highlight
                    note={tier ? `+${tier.monthlyCreditAllowance.toLocaleString("de-DE")} Credits automatisch` : undefined}
                  />
                )}
                {isCanceled && !isExpired && profile?.subscriptionEndsAt && (
                  <TimelineRow
                    label="Zugriff bis"
                    value={`${formatDate(profile.subscriptionEndsAt)} (${formatRelative(profile.subscriptionEndsAt)})`}
                    icon={ShieldOff}
                    warning
                    note="Danach laeuft das Abo aus, keine neuen Credits"
                  />
                )}
              </div>
            </div>
          </Card>
        )}

        {/* ─── ACTIONS ────────────────────────────────── */}
        <Card>
          <div className="space-y-3">
            <h2 className="text-[13px] font-bold flex items-center gap-2 text-zinc-200">
              <Sparkles className="w-4 h-4 text-zinc-500" />
              Aktionen
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Credits aufladen */}
              <Link
                href="/credits"
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-[12px] font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 transition"
              >
                <Plus className="w-4 h-4" />
                Credits aufladen
              </Link>

              {/* Abo abschliessen */}
              {!tierKey && (
                <Link
                  href="/tiers"
                  className="flex items-center justify-center gap-2 py-3 rounded-xl text-[12px] font-semibold bg-gradient-to-r from-[#95BF47]/15 to-emerald-500/15 hover:from-[#95BF47]/25 hover:to-emerald-500/25 text-[#95BF47] border border-[#95BF47]/25 transition"
                >
                  <Crown className="w-4 h-4" />
                  Membership abschliessen
                </Link>
              )}

              {/* Kuendigen — erst Grund wählen, dann Weiterleitung zu Shopify */}
              {tierKey && !isCanceled && (
                <button
                  onClick={() => setCancelOpen(true)}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl text-[12px] font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 transition"
                >
                  <ShieldOff className="w-4 h-4" />
                  Abo kündigen
                </button>
              )}
            </div>
            {tierKey && !isCanceled && (
              <p className="text-[10.5px] text-zinc-600 leading-snug">
                Kuendigung erfolgt direkt im Shopify-Kundenkonto. Du behaeltst
                Zugriff bis zum Ende der bereits bezahlten Periode.
              </p>
            )}
          </div>
        </Card>

        {/* ─── TRANSAKTIONEN ──────────────────────────── */}
        {recentTx.length > 0 && (
          <Card>
            <div className="space-y-3">
              <h2 className="text-[13px] font-bold flex items-center gap-2 text-zinc-200">
                <Receipt className="w-4 h-4 text-zinc-500" />
                Verlauf <span className="text-zinc-600 font-normal">(letzte 30 Tage)</span>
              </h2>
              <div className="space-y-1">
                {recentTx.map((tx, idx) => (
                  <TxRow key={`${tx.ts}_${idx}`} tx={tx} />
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* ─── Kündigungs-Modal: erst Grund wählen, dann zu Shopify ─── */}
      {cancelOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4"
          onClick={() => !canceling && setCancelOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-2xl sm:rounded-2xl p-5 sm:p-6"
          >
            <h2 className="text-lg font-bold text-white">Abo kündigen</h2>
            <p className="mt-1 text-[12px] text-zinc-400 leading-snug">
              Schade, dass du gehst. Bitte wähle einen Grund — danach leiten wir dich zu Shopify
              weiter, wo du die Kündigung abschließt.
            </p>

            <div className="mt-4 space-y-1.5">
              {CANCEL_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setCancelReason(r)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left text-[13px] transition ${
                    cancelReason === r
                      ? "border-[#95BF47]/40 bg-[#95BF47]/10 text-white"
                      : "border-white/[0.07] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.05]"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      cancelReason === r ? "border-[#95BF47] bg-[#95BF47]" : "border-white/25"
                    }`}
                  >
                    {cancelReason === r && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
                  </span>
                  {r}
                </button>
              ))}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => !canceling && setCancelOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold bg-white/[0.05] border border-white/10 text-zinc-300 hover:bg-white/[0.08] transition"
              >
                Doch behalten
              </button>
              <button
                onClick={confirmCancel}
                disabled={!cancelReason || canceling}
                className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold bg-red-500/15 border border-red-500/25 text-red-300 hover:bg-red-500/25 transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
              >
                {canceling ? "Weiterleiten…" : "Weiter zu Shopify"}
                {!canceling && <ExternalLink className="w-3.5 h-3.5" />}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

const CANCEL_REASONS = [
  "Zu teuer",
  "Ich nutze es nicht genug",
  "Mir fehlen Funktionen",
  "Technische Probleme",
  "Nur vorübergehend / Pause",
  "Anderer Grund",
];

// ─── Credit-Zyklus (28-Tage-Gutschrift, grafische Timeline) ──────

function CreditCycleCard({ cycle }: { cycle: CreditCycle }) {
  const days = cycle.periodDays;
  const daysLeft = cycle.daysUntilNext ?? days;
  const daysDone = Math.max(0, Math.min(days, days - daysLeft));
  const pct = Math.max(0, Math.min(100, cycle.cycleProgressPct));

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h2 className="text-[13px] font-bold flex items-center gap-2 text-zinc-200">
            <RefreshCcw className="w-4 h-4 text-[#95BF47]" />
            Deine nächste Gutschrift
          </h2>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#95BF47]/10 border border-[#95BF47]/25 text-[11px] font-semibold text-[#95BF47]">
            <Plus className="w-3 h-3" />
            {cycle.recurringAmount.toLocaleString("de-DE")} Credits alle {days} Tage
          </span>
        </div>

        {/* Großer Countdown */}
        <div className="flex items-end gap-2">
          <span className="text-4xl font-black text-white tabular-nums leading-none">{daysLeft}</span>
          <span className="text-[13px] text-zinc-400 mb-0.5">
            {daysLeft === 1 ? "Tag" : "Tage"} bis <span className="text-[#95BF47] font-semibold">+{cycle.recurringAmount.toLocaleString("de-DE")} Credits</span>
          </span>
        </div>

        {/* Grafische Tage-Timeline */}
        <div>
          <div className="relative h-3 rounded-full bg-white/[0.05] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-[#95BF47] to-emerald-400"
            />
          </div>
          {/* Tag-Marker (alle 7 Tage) */}
          <div className="relative mt-1 h-4">
            {Array.from({ length: Math.floor(days / 7) + 1 }, (_, i) => i * 7).map((d) => (
              <span
                key={d}
                className="absolute -translate-x-1/2 text-[9px] text-zinc-600 tabular-nums"
                style={{ left: `${Math.min(100, (d / days) * 100)}%` }}
              >
                {d === 0 ? "Start" : `T${d}`}
              </span>
            ))}
          </div>
          <div className="flex justify-between text-[10.5px] text-zinc-500 mt-1">
            <span>Tag {daysDone} von {days}</span>
            <span>
              {cycle.nextGrantAt ? `Nächste: ${formatDate(cycle.nextGrantAt)}` : ""}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02]">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">Letzte Gutschrift</div>
            <div className="text-[12.5px] text-zinc-200 mt-0.5">
              {cycle.lastGrantAt ? formatRelative(cycle.lastGrantAt) : "Noch keine (Willkommens-Bonus war der Start)"}
            </div>
          </div>
          <div className="p-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02]">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">Bisher erhalten</div>
            <div className="text-[12.5px] text-zinc-200 mt-0.5 tabular-nums">
              {cycle.periodsGranted}× {cycle.recurringAmount.toLocaleString("de-DE")} Credits
            </div>
          </div>
        </div>

        <p className="text-[10.5px] text-zinc-600 leading-snug">
          Jeder Account bekommt beim ersten Login 1.500 Credits und danach automatisch alle {days} Tage
          {" "}{cycle.recurringAmount.toLocaleString("de-DE")} Credits dazu — unabhängig vom Abo-Status.
        </p>
      </div>
    </Card>
  );
}

// ─── Plan Hero ────────────────────────────────────────────────────

function PlanHero({
  tierKey, tierLabel, statusLabel, isCanceled, isExpired, tier, daysLeft,
}: {
  tierKey: TierKey | null;
  tierLabel: string;
  statusLabel: string;
  isCanceled: boolean;
  isExpired: boolean;
  tier: typeof DEFAULT_TIERS[number] | null;
  daysLeft: number | null;
}) {
  const gradient = tierKey
    ? "from-amber-500/15 via-amber-500/8 to-transparent"
    : "from-zinc-500/8 to-transparent";
  const statusIcon = isExpired ? XCircle : isCanceled ? ShieldOff : tierKey ? CheckCircle2 : XCircle;
  const StatusIcon = statusIcon;
  const statusColor = isExpired ? "text-red-400" : isCanceled ? "text-amber-400" : tierKey ? "text-green-400" : "text-zinc-500";
  const statusBg = isExpired ? "bg-red-500/10 border-red-500/20" : isCanceled ? "bg-amber-500/10 border-amber-500/20" : tierKey ? "bg-green-500/10 border-green-500/20" : "bg-zinc-500/10 border-zinc-500/20";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl border border-white/[0.08] overflow-hidden"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} pointer-events-none`} />
      <div className="relative p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Aktueller Plan</div>
            <div className="text-3xl sm:text-4xl font-black tracking-tight flex items-center gap-2">
              {tierKey && <Crown className="w-6 h-6 text-amber-300" />}
              {tierLabel}
            </div>
            {tier && (
              <div className="text-[12px] text-zinc-500 mt-1">
                {tier.priceMonthlyEur} EUR / Monat · {tier.monthlyCreditAllowance.toLocaleString("de-DE")} Credits / Monat
              </div>
            )}
          </div>
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold uppercase tracking-wider ${statusBg} ${statusColor}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            {statusLabel}
          </div>
        </div>

        {/* Prominente Restlaufzeit */}
        {tierKey && !isExpired && daysLeft !== null && (
          <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.05] border border-white/[0.10]">
            <Calendar className={`w-4 h-4 ${isCanceled ? "text-amber-400" : "text-green-400"}`} />
            <span className="text-[13px] text-zinc-200">
              {isCanceled ? "Zugriff noch" : "Abo läuft noch"}{" "}
              <span className="font-bold text-white">{daysLeft} {daysLeft === 1 ? "Tag" : "Tage"}</span>
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────

function KPICard({
  icon: Icon, label, value, suffix, color, highlight,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  suffix?: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-4 ${highlight ? "border-white/[0.12] bg-white/[0.04]" : "border-white/[0.06] bg-white/[0.02]"}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center border"
          style={{ backgroundColor: `${color}15`, borderColor: `${color}30` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{label}</div>
      </div>
      <div className="text-2xl font-black text-white tabular-nums">{value}</div>
      {suffix && <div className="text-[10.5px] text-zinc-500 mt-0.5">{suffix}</div>}
    </motion.div>
  );
}

// ─── Card ───────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5"
    >
      {children}
    </motion.div>
  );
}

function TimelineRow({
  label, value, icon: Icon, highlight, warning, note,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
  warning?: boolean;
  note?: string;
}) {
  return (
    <div className={`p-3 rounded-xl border ${
      warning ? "border-amber-500/20 bg-amber-500/[0.04]" :
      highlight ? "border-green-500/20 bg-green-500/[0.04]" :
      "border-white/[0.04] bg-white/[0.01]"
    }`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-3.5 h-3.5 ${
          warning ? "text-amber-400" : highlight ? "text-green-400" : "text-zinc-500"
        }`} />
        <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{label}</span>
      </div>
      <div className={`text-[13px] font-semibold ${
        warning ? "text-amber-200" : highlight ? "text-green-200" : "text-zinc-200"
      }`}>{value}</div>
      {note && <div className="text-[10.5px] text-zinc-500 mt-1">{note}</div>}
    </div>
  );
}

// ─── Transaction Row ─────────────────────────────────────────────

function TxRow({ tx }: { tx: CreditTransaction }) {
  const isPositive = tx.delta > 0;
  const typeLabel = {
    starter: "Willkommens-Bonus",
    subscription: "Monats-Credits",
    recurring: "28-Tage-Gutschrift",
    survey: "Umfrage-Bonus",
    topup: "Aufladung",
    voucher: "Code eingeloest",
    "admin-grant": "Admin-Gutschrift",
    "admin-revoke": "Admin-Abzug",
    deduct: "Tool-Nutzung",
  }[tx.type] || tx.type;

  return (
    <div className="flex items-center gap-3 py-2 px-2.5 rounded-lg hover:bg-white/[0.02] transition">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${
        isPositive ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"
      }`}>
        {isPositive ? <Plus className="w-3.5 h-3.5" /> : <span className="text-xs font-bold">−</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold text-zinc-200 truncate">
          {typeLabel}
          {tx.reason && <span className="text-zinc-500 font-normal"> · {tx.reason}</span>}
        </div>
        <div className="text-[10px] text-zinc-600">{formatDateTime(tx.ts)}</div>
      </div>
      <div className={`font-mono text-sm font-bold tabular-nums ${isPositive ? "text-green-400" : "text-red-400"}`}>
        {isPositive ? "+" : ""}{tx.delta.toLocaleString("de-DE")}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return iso; }
}

function formatDateTime(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("de-DE", {
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function formatRelative(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diffDays = Math.round((t - Date.now()) / 86400000);
  if (Math.abs(diffDays) < 1) return "heute";
  if (diffDays === 1) return "morgen";
  if (diffDays === -1) return "gestern";
  if (diffDays > 0) return `in ${diffDays} Tagen`;
  return `vor ${Math.abs(diffDays)} Tagen`;
}
